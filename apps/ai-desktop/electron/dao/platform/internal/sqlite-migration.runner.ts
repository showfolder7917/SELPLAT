import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

import { runSqliteTransaction } from "./sqlite-transaction.js";

type MigrationDefinition = {
  versionCode: string;
  fileName: string;
  description: string;
  sql: string;
  checksum: string;
};

type AppliedMigrationRow = {
  versionCode: string;
  checksum: string;
  successFlag: number;
};

const LEGACY_COLLABORATION_RETIREMENT_VERSION = "1007";
const PERSONA_CORPUS_GENERALIZATION_VERSION = "1023";
const PERSONA_CORPUS_COMPATIBLE_CHECKSUMS = new Set([
  "7288647d064d300b11d00267d99b8675fd86cd49947986d3d46dadd038ec49ac",
  "71540b875c321719608ae1b79fcc613c8f08fcd5e23ae755702a0fe341c5bd52",
]);
const LEGACY_COLLABORATION_TABLES = [
  "AiDesktopCollaborationStreamChunk",
  "AiDesktopCollaborationTimelineEvent",
  "AiDesktopCollaborationTopic",
] as const;

export type SqliteMigrationResult = {
  latestVersion: string | null;
  appliedVersions: string[];
};

export class SqliteMigrationRunner {
  constructor(private readonly sqlRoot: string) {}

  /**
   * 按唯一加载清单校验并执行尚未应用的 SQL 版本。
   *
   * 真实传参示例：`apply(database, true)` 表示本轮创建了全新数据库。
   * 真实返回示例：`{ latestVersion: "0001", appliedVersions: ["0001"] }`。
   * 异常或副作用示例：已发布 SQL 校验和不符或迁移失败时抛错，当前版本的结构和版本记录一起回滚。
   */
  apply(database: DatabaseSync, allowBootstrap: boolean): SqliteMigrationResult {
    const migrations = this.#loadMigrations();
    const hasVersionTable = versionTableExists(database);
    if (!hasVersionTable && !allowBootstrap) {
      throw new Error("已存在的 AI Memory 数据库缺少 AiDesktopSchemaVersion，禁止当作空库重建。");
    }

    const applied = hasVersionTable ? readAppliedMigrations(database) : new Map<string, AppliedMigrationRow>();
    for (const row of applied.values()) {
      const migration = migrations.find((candidate) => candidate.versionCode === row.versionCode);
      if (!migration) throw new Error(`数据库包含加载清单未登记的版本：${row.versionCode}`);
      if (row.successFlag !== 1) throw new Error(`数据库版本未成功完成：${row.versionCode}`);
      if (row.checksum !== migration.checksum && !isCompatiblePersonaCorpusChecksum(row, migration)) {
        throw new Error(`已发布 SQL 校验和不一致：${migration.fileName}`);
      }
    }

    const appliedVersions: string[] = [];
    for (const migration of migrations) {
      if (applied.has(migration.versionCode)) continue;
      const startedAt = Date.now();
      runMigrationTransaction(database, migration.versionCode, () => {
        if (migration.versionCode === LEGACY_COLLABORATION_RETIREMENT_VERSION) {
          assertLegacyCollaborationTablesEmpty(database);
        }
        database.exec(migration.sql);
        database.prepare(`
          INSERT INTO AiDesktopSchemaVersion
            (versionCode, description, checksum, appliedAt, durationMs, successFlag)
          VALUES (?, ?, ?, ?, ?, 1)
        `).run(
          migration.versionCode,
          migration.description,
          migration.checksum,
          new Date().toISOString(),
          Math.max(0, Date.now() - startedAt),
        );
      });
      appliedVersions.push(migration.versionCode);
    }
    return { latestVersion: migrations.at(-1)?.versionCode ?? null, appliedVersions };
  }

  #loadMigrations(): MigrationDefinition[] {
    const manifestPath = path.join(this.sqlRoot, "load-order.txt");
    if (!existsSync(manifestPath)) throw new Error(`SQLite 加载清单不存在：${manifestPath}`);
    const definitions = readFileSync(manifestPath, "utf8")
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line, index) => parseManifestLine(line, index + 1, this.sqlRoot));
    if (definitions.length === 0) throw new Error("SQLite 加载清单不能为空。");

    const versionCodes = new Set<string>();
    const fileNames = new Set<string>();
    let previousVersion = "";
    for (const definition of definitions) {
      if (versionCodes.has(definition.versionCode)) throw new Error(`SQLite 版本重复：${definition.versionCode}`);
      if (fileNames.has(definition.fileName)) throw new Error(`SQLite SQL 文件重复：${definition.fileName}`);
      if (previousVersion && definition.versionCode <= previousVersion) throw new Error("SQLite 版本必须严格递增。");
      versionCodes.add(definition.versionCode);
      fileNames.add(definition.fileName);
      previousVersion = definition.versionCode;
    }

    const unregisteredSql = readdirSync(this.sqlRoot)
      .filter((fileName) => fileName.endsWith(".sql") && !fileNames.has(fileName));
    if (unregisteredSql.length > 0) throw new Error(`存在未登记的 SQLite SQL 文件：${unregisteredSql.join(", ")}`);
    return definitions;
  }
}

/** 1023 曾产生两份等价结构的修复版本；只接受两份已知摘要，其他任何改写继续失败关闭。 */
function isCompatiblePersonaCorpusChecksum(row: AppliedMigrationRow, migration: MigrationDefinition): boolean {
  return row.versionCode === PERSONA_CORPUS_GENERALIZATION_VERSION
    && PERSONA_CORPUS_COMPATIBLE_CHECKSUMS.has(row.checksum)
    && PERSONA_CORPUS_COMPATIBLE_CHECKSUMS.has(migration.checksum);
}

/** 原始 1023 会替换被外部表引用的主题表；事务内暂停即时外键动作，提交前验证全部引用并恢复保护。 */
function runMigrationTransaction(database: DatabaseSync, versionCode: string, operation: () => void): void {
  if (versionCode !== PERSONA_CORPUS_GENERALIZATION_VERSION) {
    runSqliteTransaction(database, operation);
    return;
  }
  const foreignKeysEnabled = Number(Object.values(database.prepare("PRAGMA foreign_keys").get() || {})[0]) === 1;
  if (!foreignKeysEnabled) throw new Error("AI Memory 迁移前外键保护未开启。");
  database.exec("PRAGMA foreign_keys = OFF");
  try {
    runSqliteTransaction(database, () => {
      operation();
      const violations = database.prepare("PRAGMA foreign_key_check").all();
      if (violations.length > 0) throw new Error(`AI Memory 迁移后外键检查失败：${violations.length}`);
    });
  } finally {
    database.exec("PRAGMA foreign_keys = ON");
  }
}

function assertLegacyCollaborationTablesEmpty(database: DatabaseSync): void {
  const nonempty = LEGACY_COLLABORATION_TABLES.flatMap((table) => {
    const exists = database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
    if (!exists) return [];
    const row = database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number | bigint };
    const count = Number(row.count);
    return count > 0 ? [`${table}=${count}`] : [];
  });
  if (nonempty.length > 0) {
    throw new Error(`旧协作时间线表仍有数据，已阻止部分删除：${nonempty.join("，")}。请先完成受控备份与清空。`);
  }
}

function parseManifestLine(line: string, lineNumber: number, sqlRoot: string): MigrationDefinition {
  const [versionCode, fileName, description, ...extra] = line.split("|").map((value) => value.trim());
  if (extra.length > 0 || !/^\d{4}$/u.test(versionCode || "") || !description) {
    throw new Error(`SQLite 加载清单第 ${lineNumber} 行格式无效。`);
  }
  if (!fileName || fileName !== path.basename(fileName) || !/^(?:schema-[A-Za-z0-9]+|migration-\d{4}-[a-z0-9-]+)\.sql$/u.test(fileName)) {
    throw new Error(`SQLite 加载清单第 ${lineNumber} 行文件名无效。`);
  }
  const migrationFileVersion = /^migration-(\d{4})-/u.exec(fileName)?.[1];
  if (migrationFileVersion && migrationFileVersion !== versionCode) {
    throw new Error(`SQLite 加载清单第 ${lineNumber} 行版本与文件名不一致。`);
  }
  const sqlPath = path.join(sqlRoot, fileName);
  if (!existsSync(sqlPath)) throw new Error(`SQLite SQL 文件不存在：${sqlPath}`);
  const sql = readFileSync(sqlPath, "utf8");
  if (!sql.trim()) throw new Error(`SQLite SQL 文件不能为空：${sqlPath}`);
  return {
    versionCode: versionCode!,
    fileName,
    description,
    sql,
    checksum: createHash("sha256").update(sql, "utf8").digest("hex"),
  };
}

function versionTableExists(database: DatabaseSync): boolean {
  const row = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'AiDesktopSchemaVersion'").get() as { name?: unknown } | undefined;
  return row?.name === "AiDesktopSchemaVersion";
}

function readAppliedMigrations(database: DatabaseSync): Map<string, AppliedMigrationRow> {
  const rows = database.prepare("SELECT versionCode, checksum, successFlag FROM AiDesktopSchemaVersion ORDER BY versionCode").all() as unknown as AppliedMigrationRow[];
  return new Map(rows.map((row) => [String(row.versionCode), {
    versionCode: String(row.versionCode),
    checksum: String(row.checksum),
    successFlag: Number(row.successFlag),
  }]));
}
