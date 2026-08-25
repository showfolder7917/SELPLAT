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
      if (row.checksum !== migration.checksum) throw new Error(`已发布 SQL 校验和不一致：${migration.fileName}`);
    }

    const appliedVersions: string[] = [];
    for (const migration of migrations) {
      if (applied.has(migration.versionCode)) continue;
      const startedAt = Date.now();
      runSqliteTransaction(database, () => {
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
