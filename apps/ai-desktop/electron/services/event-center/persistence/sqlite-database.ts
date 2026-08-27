import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { AiMemoryDatabaseStatus } from "../../../../contracts/desktop/database.js";
import { resolveAiMemoryPaths } from "../../../config/ai-memory-path-resolver.js";
import { SqliteMigrationRunner } from "./sqlite-migration-runner.js";
import { runSqliteTransaction } from "./sqlite-transaction.js";

const RUNTIME_MARKER_SCHEMA_VERSION = 1;

type RuntimeMarker = {
  schemaVersion: number;
  databasePathHash: string;
  initializedAt: string;
};

export type AiMemoryDatabaseInitialization = {
  database: SqliteDatabase | null;
  status: AiMemoryDatabaseStatus;
};

export type InitializeAiMemoryDatabaseOptions = {
  projectRoot: string;
  runtimeMarkerPath: string;
};

export class SqliteDatabase {
  readonly databasePath: string;
  readonly latestSchemaVersion: string | null;
  #connection: DatabaseSync | null;

  private constructor(databasePath: string, connection: DatabaseSync, latestSchemaVersion: string | null) {
    this.databasePath = databasePath;
    this.#connection = connection;
    this.latestSchemaVersion = latestSchemaVersion;
  }

  /**
   * 对已安全解析的唯一路径打开 SQLite，配置 PRAGMA 并完成迁移。
   *
   * 真实传参示例：`open("/project/apps/ai-desktop/db/events.sqlite3", "/project/apps/ai-desktop/db/sql", true)`。
   * 真实返回示例：`latestSchemaVersion` 为 `"0001"` 的单连接数据库对象。
   * 异常或副作用示例：已有库缺少版本表、校验和异常或快速完整性检查失败时关闭连接并抛错。
   */
  static open(databasePath: string, sqlRoot: string, allowBootstrap: boolean): SqliteDatabase {
    const connection = new DatabaseSync(databasePath, {
      enableForeignKeyConstraints: true,
      enableDoubleQuotedStringLiterals: false,
      allowExtension: false,
    });
    try {
      connection.exec("PRAGMA foreign_keys = ON");
      connection.exec("PRAGMA journal_mode = WAL");
      connection.exec("PRAGMA synchronous = NORMAL");
      connection.exec("PRAGMA busy_timeout = 5000");
      const migration = new SqliteMigrationRunner(sqlRoot).apply(connection, allowBootstrap);
      assertQuickCheck(connection);
      return new SqliteDatabase(databasePath, connection, migration.latestVersion);
    } catch (error) {
      connection.close();
      throw error;
    }
  }

  /** 只向主进程持久化服务开放当前唯一连接，渲染层和 IPC 合同不得接收该对象。 */
  withConnection<T>(operation: (connection: DatabaseSync) => T): T {
    const connection = this.#connection;
    if (!connection) throw new Error("AI Memory SQLite 连接已关闭。");
    return operation(connection);
  }

  /** 把一组业务状态与事件写入同一个立即事务，失败时不留下半条流程。 */
  transaction<T>(operation: (connection: DatabaseSync) => T): T {
    return this.withConnection((connection) => runSqliteTransaction(connection, () => operation(connection)));
  }

  /**
   * 在进程退出前收敛 WAL 并关闭唯一连接。
   *
   * 真实传参示例：`database.close()`。
   * 真实返回示例：首次返回 `true`，重复关闭返回 `false`。
   * 异常或副作用示例：checkpoint 失败仍会关闭连接，然后向调用方抛出真实异常。
   */
  close(): boolean {
    const connection = this.#connection;
    if (!connection) return false;
    this.#connection = null;
    let checkpointError: unknown;
    try {
      connection.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    } catch (error) {
      checkpointError = error;
    } finally {
      connection.close();
    }
    if (checkpointError) throw checkpointError;
    return true;
  }
}

/**
 * 根据首次初始化标记区分“允许新建”和“丢库必须恢复”。
 *
 * 真实传参示例：`{ projectRoot: "/project", runtimeMarkerPath: "/userData/ai-memory-database-state.json" }`。
 * 真实返回示例：首次成功返回 `{ database, status: { state: "ready", schemaVersion: "0001" } }`。
 * 异常或副作用示例：已初始化数据库丢失时返回 `recovery-required`，不会生成替代空库。
 */
export function initializeAiMemoryDatabase(options: InitializeAiMemoryDatabaseOptions): AiMemoryDatabaseInitialization {
  let databasePath: string | null = null;
  let createdThisAttempt = false;
  let openedDatabase: SqliteDatabase | null = null;
  let recoveryEvidence = false;
  try {
    const resolved = resolveAiMemoryPaths(options.projectRoot);
    databasePath = resolved.databasePath;
    recoveryEvidence = existsSync(databasePath) || existsSync(options.runtimeMarkerPath);
    const sqlRoot = path.join(resolved.databaseRoot, "sql");
    const marker = readRuntimeMarker(options.runtimeMarkerPath);
    const expectedPathHash = hashDatabasePath(databasePath);
    if (marker && marker.databasePathHash !== expectedPathHash) {
      return recoveryRequired("数据库配置已变更，必须确认原数据的迁移或恢复，未创建新库。");
    }
    if (marker && !existsSync(databasePath)) {
      return recoveryRequired("已初始化的 AI Memory 数据库丢失，数据库业务已停用，请先恢复原文件。");
    }

    createdThisAttempt = !existsSync(databasePath);
    openedDatabase = SqliteDatabase.open(databasePath, sqlRoot, createdThisAttempt);
    writeRuntimeMarker(options.runtimeMarkerPath, marker || {
      schemaVersion: RUNTIME_MARKER_SCHEMA_VERSION,
      databasePathHash: expectedPathHash,
      initializedAt: new Date().toISOString(),
    });
    return {
      database: openedDatabase,
      status: { state: "ready", schemaVersion: openedDatabase.latestSchemaVersion, message: null },
    };
  } catch (error) {
    try {
      openedDatabase?.close();
    } catch {
      // 初始化错误仍是主因；关闭错误不覆盖它。
    }
    if (createdThisAttempt && databasePath) removeFreshDatabaseArtifacts(databasePath);
    return {
      database: null,
      status: {
        state: recoveryEvidence ? "recovery-required" : "unavailable",
        schemaVersion: null,
        message: publicErrorMessage(error),
      },
    };
  }
}

function readRuntimeMarker(markerPath: string): RuntimeMarker | null {
  if (!path.isAbsolute(markerPath)) throw new Error("AI Memory 运行标记必须使用绝对路径。");
  if (!existsSync(markerPath)) return null;
  const parsed = JSON.parse(readFileSync(markerPath, "utf8")) as Partial<RuntimeMarker>;
  if (parsed.schemaVersion !== RUNTIME_MARKER_SCHEMA_VERSION
    || typeof parsed.databasePathHash !== "string"
    || !/^[a-f0-9]{64}$/u.test(parsed.databasePathHash)
    || typeof parsed.initializedAt !== "string") {
    throw new Error("AI Memory 运行标记损坏，已阻断数据库初始化。");
  }
  return parsed as RuntimeMarker;
}

function writeRuntimeMarker(markerPath: string, marker: RuntimeMarker): void {
  mkdirSync(path.dirname(markerPath), { recursive: true });
  const temporaryPath = `${markerPath}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(marker, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(temporaryPath, markerPath);
}

function hashDatabasePath(databasePath: string): string {
  return createHash("sha256").update(path.resolve(databasePath), "utf8").digest("hex");
}

function assertQuickCheck(database: DatabaseSync): void {
  const row = database.prepare("PRAGMA quick_check").get() as Record<string, unknown> | undefined;
  if (!row || Object.values(row)[0] !== "ok") throw new Error("AI Memory SQLite 快速完整性检查未通过。");
}

function recoveryRequired(message: string): AiMemoryDatabaseInitialization {
  return { database: null, status: { state: "recovery-required", schemaVersion: null, message } };
}

function removeFreshDatabaseArtifacts(databasePath: string): void {
  for (const target of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) rmSync(target, { force: true });
}

function publicErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("校验和不一致")) return "已发布 SQL 校验和不一致，数据库业务已停用，请恢复正确的 SQL 版本。";
  if (message.includes("AiDesktopSchemaVersion")) return "现有数据库缺少可验证的版本记录，已阻断自动重建。";
  if (message.includes("运行标记损坏")) return "AI Memory 初始化标记损坏，数据库业务已停用。";
  if (message.includes("完整性检查")) return "AI Memory 数据库完整性检查未通过，请先恢复数据。";
  return "AI Memory 数据库配置、迁移或打开失败，数据库业务已停用。";
}
