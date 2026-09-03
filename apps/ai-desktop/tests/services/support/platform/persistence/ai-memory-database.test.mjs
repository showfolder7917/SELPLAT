import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { initializeAiMemoryDatabase } from "../../../../../../../build/ai-desktop/electron/electron/services/support/platform/persistence/internal/sqlite-database.js";
import { EvolutionStateRepository } from "../../../../../../../build/ai-desktop/electron/electron/services/evolution/internal/evolution-state.repository.js";
import { EvolutionStateStore } from "../../../../../../../build/ai-desktop/electron/electron/services/evolution/internal/evolution-state.store.js";
import { runSqliteTransaction } from "../../../../../../../build/ai-desktop/electron/electron/services/support/platform/persistence/internal/sqlite-transaction.js";
import { appRoot, controlledTestRoot } from "#test-paths";

mkdirSync(controlledTestRoot, { recursive: true });

test("首次初始化建立版本表并在重复启动时保持幂等", () => {
  const fixture = createFixture("bootstrap");
  try {
    const first = initializeAiMemoryDatabase(fixture.options);
    assert.equal(first.status.state, "ready");
    assert.equal(first.status.schemaVersion, "1024");
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
      assert.equal(Number(row.count), 25);
      const version = inspection.prepare("SELECT versionCode, checksum, successFlag FROM AiDesktopSchemaVersion ORDER BY versionCode DESC LIMIT 1").get();
      assert.deepEqual({ versionCode: version.versionCode, successFlag: Number(version.successFlag) }, { versionCode: "1024", successFlag: 1 });
      assert.match(String(version.checksum), /^[a-f0-9]{64}$/);
      assert.equal(inspection.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='AiDesktopEvolutionWorkbenchPreference'").get(), undefined);
    } finally {
      inspection.close();
    }
  } finally {
    rmSync(fixture.projectRoot, { recursive: true, force: true });
  }
});

test("1023 在主题已有语义提取和需求轨迹引用时原子升级并保留数据", () => {
  const fixture = createFixture("1023-referenced-topic");
  try {
    installSchemaUpTo(fixture, 1022);
    const legacy = initializeAiMemoryDatabase(fixture.options);
    assert.equal(legacy.status.schemaVersion, "1022");
    legacy.database?.withConnection((connection) => {
      connection.prepare(`INSERT INTO AiDesktopTrainingCorpusTopic
        (corpusTopicId, source, sourceConversationId, sourceTurnId, title, topicType, inferredIntent, tagsJson, definitionSource, createdAt, updatedAt)
        VALUES ('topic-1023', 'codex', 'conversation-1023', 'turn-1023', '迁移保留主题', 'requirement', '验证引用迁移', '[]', 'ai-confirmed', '2026-09-03T00:00:00.000Z', '2026-09-03T00:00:00.000Z')`).run();
      connection.prepare(`INSERT INTO AiDesktopTrainingCorpusMessage
        (corpusMessageId, corpusTopicId, source, sourceConversationId, sourceTurnId, sourceMessageId, sequenceNumber, speakerRole, content, contentRetention, evidenceTier, createdAt, recordedAt)
        VALUES ('message-1023', 'topic-1023', 'codex', 'conversation-1023', 'turn-1023', 'source-message-1023', 0, 'user', '必须保留的原始需求', 'exact', 'primary', '2026-09-03T00:00:00.000Z', '2026-09-03T00:00:00.000Z')`).run();
      connection.prepare(`INSERT INTO AiDesktopCorpusExtractionState
        (extractionId, corpusTopicId, stableUserId, extractorType, sourceContentHash, extractorVersion, status, attemptCount, updatedAt)
        VALUES ('extraction-1023', 'topic-1023', 'XUNAN', 'hanli-semantic', ?, 'v1', 'completed', 1, '2026-09-03T00:00:00.000Z')`).run("a".repeat(64));
      connection.prepare(`INSERT INTO AiDesktopRequirementTrajectory
        (trajectoryId, stableUserId, sourceCorpusTopicId, projectScope, customerGoal, confirmedFactsJson, assumptionsJson, conflictsJson, informationGapsJson, implicitRequirementsJson, selectedAction, acceptanceEvidenceJson, maturityScore, createdAt, updatedAt)
        VALUES ('trajectory-1023', 'XUNAN', 'topic-1023', 'selplat', '保留需求轨迹', '[]', '[]', '[]', '[]', '[]', 'continue', '[]', 0.8, '2026-09-03T00:00:00.000Z', '2026-09-03T00:00:00.000Z')`).run();
      connection.prepare(`INSERT INTO AiDesktopRequirementNode
        (requirementNodeId, trajectoryId, nodeKey, title, category, status, statement, critical, evidenceMessageIdsJson, createdAt, updatedAt)
        VALUES ('requirement-node-1023', 'trajectory-1023', 'root', '保留需求节点', 'goal', 'confirmed', '需求节点正文', 1, '["message-1023"]', '2026-09-03T00:00:00.000Z', '2026-09-03T00:00:00.000Z')`).run();
    });
    legacy.database?.close();
    installSchemaUpTo(fixture, 1023);

    const upgraded = initializeAiMemoryDatabase(fixture.options);
    assert.equal(upgraded.status.state, "ready");
    assert.equal(upgraded.status.schemaVersion, "1023");
    upgraded.database?.withConnection((connection) => {
      assert.equal(connection.prepare("SELECT content FROM AiDesktopTrainingCorpusMessage WHERE corpusMessageId='message-1023'").get().content, "必须保留的原始需求");
      assert.equal(connection.prepare("SELECT status FROM AiDesktopCorpusExtractionState WHERE extractionId='extraction-1023'").get().status, "completed");
      assert.equal(connection.prepare("SELECT customerGoal FROM AiDesktopRequirementTrajectory WHERE trajectoryId='trajectory-1023'").get().customerGoal, "保留需求轨迹");
      assert.equal(connection.prepare("SELECT statement FROM AiDesktopRequirementNode WHERE requirementNodeId='requirement-node-1023'").get().statement, "需求节点正文");
      assert.deepEqual(connection.prepare("PRAGMA foreign_key_check").all(), []);
      assert.equal(Number(Object.values(connection.prepare("PRAGMA foreign_keys").get())[0]), 1);
      assert.throws(() => connection.prepare(`INSERT INTO AiDesktopTrainingCorpusMessage
        (corpusMessageId, corpusTopicId, source, sourceMessageId, sourceConversationId, sourceTurnId, sequenceNumber, speakerRole, content, contentRetention, evidenceTier, createdAt, recordedAt)
        VALUES ('invalid-message', 'missing-topic', 'future-persona', 'invalid-source-message', 'conversation-invalid', 'turn-invalid', 0, 'future-persona', '不得写入', 'exact', 'primary', '2026-09-03T00:00:01.000Z', '2026-09-03T00:00:01.000Z')`).run(), /FOREIGN KEY constraint failed/);
      connection.prepare(`INSERT INTO AiDesktopTrainingCorpusTopic
        (corpusTopicId, source, sourceConversationId, sourceTurnId, title, topicType, tagsJson, definitionSource, createdAt, updatedAt)
        VALUES ('topic-future-persona', 'future-persona', 'conversation-future', 'turn-future', '未来人物', 'discussion', '[]', 'pending', '2026-09-03T00:00:01.000Z', '2026-09-03T00:00:01.000Z')`).run();
    });
    upgraded.database?.close();
  } finally {
    rmSync(fixture.projectRoot, { recursive: true, force: true });
  }
});

test("1023 两份已知等价校验和可继续启动但未知改写仍被阻断", () => {
  const fixture = createFixture("1023-compatible-checksum");
  try {
    const initialized = initializeAiMemoryDatabase(fixture.options);
    assert.equal(initialized.status.state, "ready");
    initialized.database?.withConnection((connection) => connection.prepare(
      "UPDATE AiDesktopSchemaVersion SET checksum=? WHERE versionCode='1023'",
    ).run("7288647d064d300b11d00267d99b8675fd86cd49947986d3d46dadd038ec49ac"));
    initialized.database?.close();

    const compatible = initializeAiMemoryDatabase(fixture.options);
    assert.equal(compatible.status.state, "ready");
    compatible.database?.close();

    const inspection = new DatabaseSync(fixture.databasePath);
    inspection.prepare("UPDATE AiDesktopSchemaVersion SET checksum=? WHERE versionCode='1023'").run("b".repeat(64));
    inspection.close();
    const rejected = initializeAiMemoryDatabase(fixture.options);
    assert.equal(rejected.status.state, "recovery-required");
    assert.match(rejected.status.message || "", /校验和不一致/);
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
    const schemaPath = path.join(fixture.sqlRoot, "schema-AiDesktopCurrent.sql");
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

test("专题演化状态只写入 SQLite 并在清空后验证运行态归零", () => {
  const fixture = createFixture("evolution-state");
  try {
    const initialized = initializeAiMemoryDatabase(fixture.options);
    assert.equal(initialized.status.state, "ready");
    const repository = new EvolutionStateRepository(initialized.database);
    const store = new EvolutionStateStore(repository);
    store.appendConversation("user", "保留的用户原话", []);
    store.beginOneShotRun({ primaryId: "root", roots: [{ id: "root", name: "SELPLAT", path: fixture.projectRoot, permission: "workspace-write" }] }, "zh-CN");
    assert.equal(new EvolutionStateStore(repository).state().oneShotRun?.status, "running");
    store.clearTestData();
    store.assertTestDataCleared();
    const persisted = initialized.database?.withConnection((connection) => connection.prepare("SELECT stateVersion, stateJson FROM AiDesktopEvolutionState WHERE singletonId=1").get());
    assert.equal(Number(persisted.stateVersion), 8);
    assert.equal(JSON.parse(String(persisted.stateJson)).conversation, undefined);
    const preservedMessage = initialized.database?.withConnection((connection) => connection.prepare(`
      SELECT content FROM AiDesktopPersonaConversationMessage
      WHERE ownerPersonaId='nangong-wan' AND speakerType='user'
      ORDER BY sequenceNumber LIMIT 1
    `).get());
    assert.equal(preservedMessage.content, "保留的用户原话");
    initialized.database?.close();
  } finally {
    rmSync(fixture.projectRoot, { recursive: true, force: true });
  }
});

test("旧协作三表为空时整批物理删除并升级到 1007", () => {
  const fixture = createFixture("legacy-empty-retirement");
  try {
    installUpTo1006(fixture);
    const legacy = initializeAiMemoryDatabase(fixture.options);
    assert.equal(legacy.status.schemaVersion, "1006");
    legacy.database?.close();
    restore1007(fixture);

    const retired = initializeAiMemoryDatabase(fixture.options);
    assert.equal(retired.status.state, "ready");
    assert.equal(retired.status.schemaVersion, "1007");
    retired.database?.withConnection((connection) => {
      for (const table of legacyCollaborationTables) {
        assert.equal(connection.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table), undefined, table);
      }
    });
    retired.database?.close();
  } finally {
    rmSync(fixture.projectRoot, { recursive: true, force: true });
  }
});

test("旧协作任一表非空时阻断全部删除并保留三表", () => {
  const fixture = createFixture("legacy-nonempty-retirement");
  try {
    installUpTo1006(fixture);
    const legacy = initializeAiMemoryDatabase(fixture.options);
    assert.equal(legacy.status.schemaVersion, "1006");
    legacy.database?.withConnection((connection) => connection.prepare(`INSERT INTO AiDesktopCollaborationTopic
      (groupId, topicId, proposalId, title, status, summary, startedAt, updatedAt, createdAt)
      VALUES ('legacy:topic', 'legacy-topic', 'legacy-proposal', '旧专题', 'running', '待退役', '2026-08-29T00:00:00.000Z', '2026-08-29T00:00:00.000Z', '2026-08-29T00:00:00.000Z')`).run());
    legacy.database?.close();
    restore1007(fixture);

    const blocked = initializeAiMemoryDatabase(fixture.options);
    assert.equal(blocked.database, null);
    assert.equal(blocked.status.state, "recovery-required");
    assert.match(blocked.status.message || "", /旧协作时间线仍有数据/);
    const inspection = new DatabaseSync(fixture.databasePath, { readOnly: true });
    try {
      for (const table of legacyCollaborationTables) {
        assert.ok(inspection.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table), table);
      }
      assert.equal(Number(inspection.prepare("SELECT COUNT(*) AS count FROM AiDesktopCollaborationTopic").get().count), 1);
      assert.equal(inspection.prepare("SELECT 1 FROM AiDesktopSchemaVersion WHERE versionCode='1007'").get(), undefined);
    } finally { inspection.close(); }
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
      "1000|schema-AiDesktopCurrent.sql|建立当前数据库基线",
      "1001|migration-1001-invalid.sql|模拟失败迁移",
      "",
    ].join("\n"), "utf8");
    writeFileSync(path.join(fixture.sqlRoot, "migration-1001-invalid.sql"), "CREATE TABLE BrokenTable (id INTEGER PRIMARY KEY);\nTHIS IS NOT SQL;\n", "utf8");

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
  const mainSource = readFileSync(path.join(appRoot, "electron", "system", "bootstrap", "persistence.bootstrap.ts"), "utf8");
  const ipcSource = readFileSync(path.join(appRoot, "electron", "system", "ipc", "domains", "register-system-ipc.ts"), "utf8");
  const preloadSource = [
    readFileSync(path.join(appRoot, "electron", "system", "preload", "preload.cts"), "utf8"),
    readFileSync(path.join(appRoot, "electron", "system", "preload", "domains", "system-bridge.cts"), "utf8"),
  ].join("\n");
  const rendererSource = [
    path.join(appRoot, "src", "applications", "developer", "DeveloperApplication.tsx"),
    path.join(appRoot, "src", "features", "settings", "components", "DeveloperSettingsFeature.tsx"),
  ].map((file) => readFileSync(file, "utf8")).join("\n");
  assert.match(mainSource, /initializeAiMemoryDatabase/);
  assert.match(mainSource, /database\?\.close\(\)/);
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

const legacyCollaborationTables = [
  "AiDesktopCollaborationStreamChunk",
  "AiDesktopCollaborationTimelineEvent",
  "AiDesktopCollaborationTopic",
];

function installUpTo1006(fixture) {
  installSchemaUpTo(fixture, 1006);
}

function restore1007(fixture) {
  installSchemaUpTo(fixture, 1007);
}

/** 迁移夹具必须同时收敛清单和 SQL 文件，避免后续新增版本被误判为当前历史版本的未登记脚本。 */
function installSchemaUpTo(fixture, maximumVersion) {
  const sourceSqlRoot = path.join(appRoot, "db", "sql");
  const manifest = readFileSync(path.join(sourceSqlRoot, "load-order.txt"), "utf8").split(/\r?\n/u)
    .filter((line) => line.trim().startsWith("#") || Number.parseInt(line.split("|")[0] || "0", 10) <= maximumVersion)
    .join("\n");
  const allowedSql = new Set(manifest.split(/\r?\n/u).filter((line) => line && !line.startsWith("#")).map((line) => line.split("|")[1]));
  writeFileSync(path.join(fixture.sqlRoot, "load-order.txt"), manifest, "utf8");
  for (const fileName of readdirSync(fixture.sqlRoot).filter((name) => name.endsWith(".sql"))) {
    if (!allowedSql.has(fileName)) unlinkSync(path.join(fixture.sqlRoot, fileName));
  }
  for (const fileName of allowedSql) copyFileSync(path.join(sourceSqlRoot, fileName), path.join(fixture.sqlRoot, fileName));
}
