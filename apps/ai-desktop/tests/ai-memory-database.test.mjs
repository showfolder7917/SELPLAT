import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { initializeAiMemoryDatabase } from "../../../build/ai-desktop/electron/electron/services/event-center/persistence/sqlite-database.js";
import { runSqliteTransaction } from "../../../build/ai-desktop/electron/electron/services/event-center/persistence/sqlite-transaction.js";
import { appRoot, controlledTestRoot } from "./test-paths.mjs";

mkdirSync(controlledTestRoot, { recursive: true });

test("首次初始化建立版本表并在重复启动时保持幂等", () => {
  const fixture = createFixture("bootstrap");
  try {
    const first = initializeAiMemoryDatabase(fixture.options);
    assert.equal(first.status.state, "ready");
    assert.equal(first.status.schemaVersion, "0008");
    assert.equal(existsSync(fixture.databasePath), true);
    assert.equal(existsSync(fixture.markerPath), true);
    assert.equal(first.database?.close(), true);
    assert.equal(first.database?.close(), false);

    const second = initializeAiMemoryDatabase(fixture.options);
    assert.equal(second.status.state, "ready");
    assert.equal(second.database?.close(), true);

    const inspection = new DatabaseSync(fixture.databasePath, { readOnly: true });
    try {
      const row = inspection.prepare("SELECT COUNT(*) AS count FROM AiDesktopSchemaVersion").get();
      assert.equal(Number(row.count), 8);
      const version = inspection.prepare("SELECT versionCode, checksum, successFlag FROM AiDesktopSchemaVersion ORDER BY versionCode DESC LIMIT 1").get();
      assert.deepEqual({ versionCode: version.versionCode, successFlag: Number(version.successFlag) }, { versionCode: "0008", successFlag: 1 });
      assert.match(String(version.checksum), /^[a-f0-9]{64}$/);
    } finally {
      inspection.close();
    }
  } finally {
    rmSync(fixture.projectRoot, { recursive: true, force: true });
  }
});

test("已发布 SQL 被修改时阻断启动且保留原数据库", () => {
  const fixture = createFixture("checksum");
  try {
    const first = initializeAiMemoryDatabase(fixture.options);
    assert.equal(first.status.state, "ready");
    first.database?.close();
    const schemaPath = path.join(fixture.sqlRoot, "schema-AiDesktopSchemaVersion.sql");
    writeFileSync(schemaPath, `${readFileSync(schemaPath, "utf8")}\n-- forbidden rewrite\n`, "utf8");

    const second = initializeAiMemoryDatabase(fixture.options);
    assert.equal(second.database, null);
    assert.equal(second.status.state, "recovery-required");
    assert.match(second.status.message || "", /校验和不一致/);
    assert.equal(existsSync(fixture.databasePath), true);
  } finally {
    rmSync(fixture.projectRoot, { recursive: true, force: true });
  }
});

test("已初始化数据库丢失时进入恢复且不伪造空库", () => {
  const fixture = createFixture("missing");
  try {
    const first = initializeAiMemoryDatabase(fixture.options);
    assert.equal(first.status.state, "ready");
    first.database?.close();
    unlinkSync(fixture.databasePath);

    const second = initializeAiMemoryDatabase(fixture.options);
    assert.equal(second.database, null);
    assert.equal(second.status.state, "recovery-required");
    assert.match(second.status.message || "", /数据库丢失/);
    assert.equal(existsSync(fixture.databasePath), false);
  } finally {
    rmSync(fixture.projectRoot, { recursive: true, force: true });
  }
});

test("首次迁移失败回滚并清理本轮创建的数据库现场", () => {
  const fixture = createFixture("rollback");
  try {
    writeFileSync(path.join(fixture.sqlRoot, "load-order.txt"), [
      "0001|schema-AiDesktopSchemaVersion.sql|建立版本表",
      "0002|migration-0002-invalid.sql|模拟失败迁移",
      "",
    ].join("\n"), "utf8");
    writeFileSync(path.join(fixture.sqlRoot, "migration-0002-invalid.sql"), "CREATE TABLE BrokenTable (id INTEGER PRIMARY KEY);\nTHIS IS NOT SQL;\n", "utf8");

    const result = initializeAiMemoryDatabase(fixture.options);
    assert.equal(result.database, null);
    assert.equal(result.status.state, "unavailable");
    assert.equal(existsSync(fixture.databasePath), false);
    assert.equal(existsSync(`${fixture.databasePath}-wal`), false);
    assert.equal(existsSync(`${fixture.databasePath}-shm`), false);
    assert.equal(existsSync(fixture.markerPath), false);
  } finally {
    rmSync(fixture.projectRoot, { recursive: true, force: true });
  }
});

test("已存在的未登记空库不能被当作首次初始化", () => {
  const fixture = createFixture("unknown-existing");
  try {
    writeFileSync(fixture.databasePath, "", "utf8");
    const result = initializeAiMemoryDatabase(fixture.options);
    assert.equal(result.database, null);
    assert.equal(result.status.state, "recovery-required");
    assert.match(result.status.message || "", /缺少可验证的版本记录/);
    assert.equal(existsSync(fixture.databasePath), true);
  } finally {
    rmSync(fixture.projectRoot, { recursive: true, force: true });
  }
});

test("损坏的初始化标记阻断建库并返回不含路径的恢复提示", () => {
  const fixture = createFixture("corrupt-marker");
  try {
    mkdirSync(path.dirname(fixture.markerPath), { recursive: true });
    writeFileSync(fixture.markerPath, "{\"schemaVersion\":1}\n", "utf8");
    const result = initializeAiMemoryDatabase(fixture.options);
    assert.equal(result.database, null);
    assert.equal(result.status.state, "recovery-required");
    assert.match(result.status.message || "", /初始化标记损坏/);
    assert.doesNotMatch(result.status.message || "", new RegExp(fixture.projectRoot.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")));
    assert.equal(existsSync(fixture.databasePath), false);
  } finally {
    rmSync(fixture.projectRoot, { recursive: true, force: true });
  }
});

test("通用事务包装在异常时不留下部分写入", () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec("CREATE TABLE TransactionProbe (id INTEGER PRIMARY KEY, value TEXT NOT NULL) STRICT");
    assert.throws(() => runSqliteTransaction(database, () => {
      database.prepare("INSERT INTO TransactionProbe (value) VALUES (?)").run("partial");
      throw new Error("stop");
    }), /stop/);
    const row = database.prepare("SELECT COUNT(*) AS count FROM TransactionProbe").get();
    assert.equal(Number(row.count), 0);
  } finally {
    database.close();
  }
});

test("主进程与渲染层只公开数据库状态，不公开连接或 SQL", () => {
  const mainSource = readFileSync(path.join(appRoot, "electron", "main.ts"), "utf8");
  const ipcSource = readFileSync(path.join(appRoot, "electron", "ipc", "domains", "register-system-ipc.ts"), "utf8");
  const preloadSource = [
    readFileSync(path.join(appRoot, "electron", "preload.cts"), "utf8"),
    readFileSync(path.join(appRoot, "electron", "preload", "domains", "system-bridge.cts"), "utf8"),
  ].join("\n");
  const rendererSource = readFileSync(path.join(appRoot, "src", "variants", "developer", "DeveloperApp.tsx"), "utf8");
  assert.match(mainSource, /initializeAiMemoryDatabase/);
  assert.match(mainSource, /aiMemoryDatabase\?\.close\(\)/);
  assert.match(ipcSource, /desktop:get-ai-memory-database-status/);
  assert.match(preloadSource, /getAiMemoryDatabaseStatus/);
  assert.match(rendererSource, /ai-memory-recovery/);
  assert.doesNotMatch(preloadSource, /DatabaseSync|executeSql|runSql/);
});

function createFixture(suffix) {
  const projectRoot = mkdtempSync(path.join(controlledTestRoot, `ai-memory-database-${suffix}-`));
  const dbRoot = path.join(projectRoot, "apps", "ai-desktop", "db");
  const sqlRoot = path.join(dbRoot, "sql");
  mkdirSync(sqlRoot, { recursive: true });
  // Windows 含中文受控测试路径下的目录级 cpSync 可能不落盘，逐个复制正式清单文件以保证夹具证据完整。
  const sourceSqlRoot = path.join(appRoot, "db", "sql");
  for (const sqlFile of readdirSync(sourceSqlRoot)) {
    copyFileSync(path.join(sourceSqlRoot, sqlFile), path.join(sqlRoot, sqlFile));
  }
  writeFileSync(path.join(dbRoot, "ai-memory-paths.json"), `${JSON.stringify({
    schemaVersion: 2,
    databaseFile: "events.sqlite3",
  }, null, 2)}\n`, "utf8");
  const markerPath = path.join(projectRoot, "user-data", "ai-memory-database-state.json");
  return {
    projectRoot,
    databasePath: path.join(dbRoot, "events.sqlite3"),
    markerPath,
    sqlRoot,
    options: { projectRoot, runtimeMarkerPath: markerPath },
  };
}
