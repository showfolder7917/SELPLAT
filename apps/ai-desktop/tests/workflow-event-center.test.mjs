import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../build/ai-desktop/electron/electron/services/event-center/persistence/sqlite-database.js";
import { CollaborationMemoryService } from "../../../build/ai-desktop/electron/electron/services/event-center/collaboration-memory-service.js";
import { CodexConversationCorpusIngestion } from "../../../build/ai-desktop/electron/electron/services/event-center/codex-conversation-corpus-ingestion.js";
import { CodexConversationSemanticBackfill } from "../../../build/ai-desktop/electron/electron/services/event-center/codex-conversation-semantic-backfill.js";
import { WorkflowRepository } from "../../../build/ai-desktop/electron/electron/services/event-center/workflow-repository.js";
import { WorkflowSupervisor } from "../../../build/ai-desktop/electron/electron/services/event-center/workflow-supervisor.js";
import { appRoot, controlledTestRoot } from "./test-paths.mjs";

mkdirSync(controlledTestRoot, { recursive: true });

test("统一迁移建立事件、流程、任务、审批、对话记忆、专题档案和演化轮次表", () => {
  const fixture = createFixture("schema");
  try {
    for (const table of ["AiDesktopEvent", "AiDesktopWorkflowRun", "AiDesktopTaskExecution", "AiDesktopApprovalRecord", "AiDesktopApprovalGovernance", "AiDesktopMemberRuntime", "AiDesktopRuntimeSession", "AiDesktopConversationMemory", "AiDesktopConversationTopic", "AiDesktopConversationTopicLink", "AiDesktopTrainingCorpusTopic", "AiDesktopTrainingCorpusMessage", "AiDesktopCorpusIngestionCheckpoint", "AiDesktopEvolutionDeliberation", "AiDesktopEvolutionSourceSnapshot", "AiDesktopEvolutionArchiveRecord", "AiDesktopEvolutionRound", "AiDesktopEvolutionRoundTask", "AiDesktopEvolutionWorkbenchPreference", "AiDesktopTaskTimelineTopic", "AiDesktopTaskTimelineEvent", "AiDesktopTaskTimelineStream"]) {
      assert.equal(fixture.repository.tableCount(table), 0, table);
    }
    assert.equal(fixture.database.latestSchemaVersion, "1013");
    fixture.database.withConnection((connection) => {
      for (const retired of ["AiDesktopCollaborationTopic", "AiDesktopCollaborationTimelineEvent", "AiDesktopCollaborationStreamChunk", "AiDesktopTaskCollaborationTopic", "AiDesktopTaskCollaborationEvent", "AiDesktopTaskCollaborationStream"]) {
        assert.equal(connection.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(retired), undefined, retired);
      }
      assert.ok(connection.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='AiDesktopPersonaSession'").get());
    });
  } finally {
    fixture.close();
  }
});

test("一键清空只删除运行投影并保留数据库版本与人物训练语料", () => {
  const fixture = createFixture("clear-test-data");
  try {
    fixture.repository.startRuntimeSession(4321, "2026-08-28T00:00:00.000Z");
    fixture.repository.recordAuditEvent("test.recorded", { message: "待清空事件" });
    fixture.repository.syncCollaborationState(collaborationState("2026-08-28T00:00:01.000Z"));
    fixture.repository.saveEvolutionWorkbenchPreference({ perspective: "nangong", nodeId: "manual-topic", page: 3, pageSize: 50, keyword: "滚动条", status: "已阻塞", selectedRowId: "topic-25" }, "2026-08-28T00:00:01.500Z");
    const memory = new CollaborationMemoryService(fixture.database);
    memory.syncConversation({ conversationId: "training-conversation", messages: [
      { messageId: "training-user", role: "user", content: "这是必须保留的训练原话。", attachmentIds: [], createdAt: "2026-08-28T00:00:02.000Z" },
    ], updatedAt: "2026-08-28T00:00:02.000Z" });
    fixture.database.withConnection((connection) => {
      connection.prepare(`INSERT INTO AiDesktopPersonaSession (sessionKey, threadId, workspaceSignature, updatedAt)
        VALUES ('linghu', 'thread-linghu', 'workspace-v1', '2026-08-28T00:00:00.000Z')`).run();
      connection.prepare(`INSERT INTO AiDesktopTaskTimelineTopic
        (groupId, topicId, proposalId, title, status, summary, startedAt, updatedAt, createdAt)
        VALUES ('timeline-topic:test', 'task-test', 'proposal-test', '时间线待清空专题', 'running', '时间线运行数据', '2026-08-28T00:00:00.000Z', '2026-08-28T00:00:01.000Z', '2026-08-28T00:00:00.000Z')`).run();
      connection.prepare(`INSERT INTO AiDesktopTaskTimelineEvent
        (factId, groupId, proposalId, taskId, nodeId, sourceFactKey, sequenceNumber, eventType, contentRole, detailRole, schemaVersion, kind, actorMemberId, actorDisplayName, recipientsJson, status, action, summary, content, detail, startedAt, completedAt, automaticOpen, manualApprovalProposalId, occurredAt, committedAt)
        VALUES ('timeline-fact-test', 'timeline-topic:test', 'proposal-test', 'task-test', 'task-node-test', 'timeline-fact:test', 1, 'execution.started', 'execution-output', 'changed-files', 2, 'execution', 'zi-ling', '紫灵', '[]', 'current', '当前正在执行', '测试', '测试', '', '2026-08-28T00:00:00.000Z', NULL, 1, NULL, '2026-08-28T00:00:00.000Z', '2026-08-28T00:00:00.000Z')`).run();
      connection.prepare(`INSERT INTO AiDesktopTaskTimelineStream
        (chunkId, groupId, taskId, nodeId, memberId, turnId, segmentId, itemId, eventType, sequenceNumber, deltaText, snapshotText, occurredAt, committedAt)
        VALUES ('timeline-chunk-test', 'timeline-topic:test', 'task-test', 'task-node-test', 'zi-ling', 'turn-test', NULL, NULL, 'message-delta', 1, '时间线流式测试', NULL, '2026-08-28T00:00:00.000Z', '2026-08-28T00:00:00.000Z')`).run();
      connection.prepare(`INSERT INTO AiDesktopTrainingCorpusTopic
        (corpusTopicId, source, sourceConversationId, sourceTurnId, title, topicType, inferredIntent, tagsJson, definitionSource, createdAt, updatedAt)
        VALUES ('training-topic', 'codex', 'training-thread', 'training-turn', '训练', '人物训练语料', NULL, '[]', 'pending', '2026-08-28T00:00:03.000Z', '2026-08-28T00:00:03.000Z')`).run();
      connection.prepare(`INSERT INTO AiDesktopTrainingCorpusMessage
        (corpusMessageId, corpusTopicId, source, sourceConversationId, sourceTurnId, sourceMessageId, sequenceNumber, speakerRole, content, contentRetention, evidenceTier, createdAt, recordedAt)
        VALUES ('training-codex', 'training-topic', 'codex', 'training-thread', 'training-turn', 'training-message', 0, 'codex', '保留的韩立回答', 'preview-300', 'supporting', '2026-08-28T00:00:03.000Z', '2026-08-28T00:00:03.000Z')`).run();
      connection.prepare(`INSERT INTO AiDesktopCorpusIngestionCheckpoint
        (sourceKey, sourceThreadId, sourceContentHash, sourceSize, ingestedMessageCount, updatedAt)
        VALUES ('2026/08/28/rollout.jsonl', 'training-thread', $hash, 10, 1, '2026-08-28T00:00:03.000Z')`).run({ $hash: "a".repeat(64) });
    });
    const schemaCountBefore = fixture.database.withConnection((connection) => Number(connection.prepare("SELECT COUNT(*) AS count FROM AiDesktopSchemaVersion").get().count));
    assert.ok(fixture.repository.clearTestData() > 0);
    for (const table of ["AiDesktopEvent", "AiDesktopWorkflowRun", "AiDesktopTaskExecution", "AiDesktopApprovalRecord", "AiDesktopApprovalGovernance", "AiDesktopMemberRuntime", "AiDesktopRuntimeSession", "AiDesktopEvolutionDeliberation", "AiDesktopEvolutionSourceSnapshot", "AiDesktopEvolutionArchiveRecord", "AiDesktopEvolutionRound", "AiDesktopEvolutionRoundTask", "AiDesktopTaskTimelineTopic", "AiDesktopTaskTimelineEvent", "AiDesktopTaskTimelineStream"]) {
      assert.equal(fixture.repository.tableCount(table), 0, table);
    }
    for (const retired of ["AiDesktopTaskCollaborationTopic", "AiDesktopTaskCollaborationEvent", "AiDesktopTaskCollaborationStream"]) {
      assert.equal(fixture.database.withConnection((connection) => connection.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(retired)), undefined, retired);
    }
    assert.equal(fixture.repository.tableCount("AiDesktopConversationMemory"), 1);
    assert.equal(fixture.database.withConnection((connection) => connection.prepare("SELECT threadId FROM AiDesktopPersonaSession WHERE sessionKey='linghu'").get()).threadId, "thread-linghu");
    assert.deepEqual(fixture.repository.getEvolutionWorkbenchPreference("nangong", "manual-topic"), { perspective: "nangong", nodeId: "manual-topic", page: 3, pageSize: 50, keyword: "滚动条", status: "已阻塞", selectedRowId: "topic-25", updatedAt: "2026-08-28T00:00:01.500Z" });
    assert.equal(fixture.repository.tableCount("AiDesktopTrainingCorpusMessage"), 2);
    assert.equal(fixture.database.withConnection((connection) => connection.prepare("SELECT COUNT(*) AS count FROM AiDesktopCorpusIngestionCheckpoint").get()).count, 1);
    const schemaCountAfter = fixture.database.withConnection((connection) => Number(connection.prepare("SELECT COUNT(*) AS count FROM AiDesktopSchemaVersion").get().count));
    assert.equal(schemaCountAfter, schemaCountBefore);
    assert.ok(schemaCountAfter > 0);
  } finally { fixture.close(); }
});

test("Codex 主人物语料按水位自动入库并在失败后保留旧检查点重试", () => {
  const fixture = createFixture("corpus-ingestion");
  const sessionsRoot = path.join(fixture.root, "sessions", "2026", "08", "28");
  mkdirSync(sessionsRoot, { recursive: true });
  const rolloutPath = path.join(sessionsRoot, "rollout-main.jsonl");
  const internalRolloutPath = path.join(sessionsRoot, "rollout-internal.jsonl");
  const records = [
    { timestamp: "2026-08-28T01:00:00.000Z", type: "session_meta", payload: { session_id: "thread-main", thread_source: "ai-desktop" } },
    { ordinal: 8, timestamp: "2026-08-28T01:00:01.000Z", type: "response_item", payload: { type: "message", role: "user", id: "user-1", content: [{ text: "保留我的完整原话。\n\nRegistered workspace roots:\n- /project (primary, workspace-write)" }] } },
    { ordinal: 13, timestamp: "2026-08-28T01:00:02.000Z", type: "response_item", payload: { type: "message", role: "assistant", phase: "final_answer", id: "answer-1", content: [{ text: `韩立回答。\n<!-- SELPLAT_CORPUS_META ${JSON.stringify({ title: "完整原话归档", type: "训练语料", intent: "保留用户完整原话", tags: ["语料", "原话"], summary: "用户原话已完整归档，AI 仅保留本段主旨。" })} -->` }] } },
  ];
  const writeRollout = (values) => writeFileSync(rolloutPath, `${values.map((value) => JSON.stringify(value)).join("\n")}\n`, "utf8");
  try {
    writeRollout(records);
    writeFileSync(internalRolloutPath, `${[
      { timestamp: "2026-08-28T01:00:00.000Z", type: "session_meta", payload: { session_id: "thread-internal", thread_source: "ai-desktop-han-li-evolution" } },
      { ordinal: 1, timestamp: "2026-08-28T01:00:01.000Z", type: "response_item", payload: { type: "message", role: "user", content: [{ text: "内部自动审批提示不得进入训练语料。" }] } },
    ].map((value) => JSON.stringify(value)).join("\n")}\n`, "utf8");
    const ingestion = new CodexConversationCorpusIngestion(fixture.database, path.join(fixture.root, "sessions"));
    assert.deepEqual(ingestion.ingestPendingRollouts(), { scannedFileCount: 2, changedFileCount: 2, ingestedMessageCount: 2, skippedInternalFileCount: 1 });
    const stored = fixture.database.withConnection((connection) => connection.prepare("SELECT speakerRole AS sourceRole, content, contentRetention FROM AiDesktopTrainingCorpusMessage WHERE source='codex' ORDER BY sequenceNumber").all());
    assert.equal(stored[0].content, "保留我的完整原话。");
    assert.equal(stored[0].contentRetention, "exact");
    assert.equal(stored[1].contentRetention, "preview-300");
    assert.equal(stored[1].content, "用户原话已完整归档，AI 仅保留本段主旨。");
    assert.deepEqual(ingestion.ingestPendingRollouts(), { scannedFileCount: 2, changedFileCount: 0, ingestedMessageCount: 0, skippedInternalFileCount: 0 });
    assert.equal(fixture.repository.tableCount("AiDesktopCorpusIngestionCheckpoint"), 2);

    writeFileSync(rolloutPath, `${records.map((value) => JSON.stringify(value)).join("\n")}\n{broken`, "utf8");
    assert.throws(() => ingestion.ingestPendingRollouts(), /无法解析/);
    const checkpointBeforeRetry = fixture.database.withConnection((connection) => connection.prepare("SELECT sourceContentHash FROM AiDesktopCorpusIngestionCheckpoint WHERE sourceKey = '2026/08/28/rollout-main.jsonl'").get()).sourceContentHash;
    records.push({ ordinal: 21, timestamp: "2026-08-28T01:00:03.000Z", type: "response_item", payload: { type: "message", role: "assistant", phase: "commentary", id: "answer-2", content: [{ text: "补录成功。" }] } });
    writeRollout(records);
    assert.equal(ingestion.ingestPendingRollouts().ingestedMessageCount, 0);
    const checkpointAfterRetry = fixture.database.withConnection((connection) => connection.prepare("SELECT sourceContentHash FROM AiDesktopCorpusIngestionCheckpoint WHERE sourceKey = '2026/08/28/rollout-main.jsonl'").get()).sourceContentHash;
    assert.notEqual(checkpointAfterRetry, checkpointBeforeRetry);
    assert.equal(fixture.repository.tableCount("AiDesktopTrainingCorpusMessage"), 2);
  } finally { fixture.close(); }
});

test("Codex 桌面会话只在每轮完成后按 SELPLAT 工作区分批增量入库", async () => {
  const fixture = createFixture("codex-app-corpus-ingestion");
  const sessionsRoot = path.join(fixture.root, "codex-app-sessions");
  mkdirSync(sessionsRoot, { recursive: true });
  const rolloutPath = path.join(sessionsRoot, "rollout-codex-app.jsonl");
  const otherWorkspacePath = path.join(sessionsRoot, "rollout-other-workspace.jsonl");
  const records = [
    { timestamp: "2026-08-28T02:00:00.000Z", type: "session_meta", payload: { session_id: "codex-app-thread", thread_source: "user", originator: "codex_work_desktop", cwd: fixture.root } },
    { timestamp: "2026-08-28T02:00:01.000Z", type: "event_msg", payload: { type: "task_started" } },
    { ordinal: 1, timestamp: "2026-08-28T02:00:02.000Z", type: "response_item", payload: { type: "message", role: "user", content: [{ text: "第一轮用户原话。" }] } },
    { ordinal: 2, timestamp: "2026-08-28T02:00:03.000Z", type: "response_item", payload: { type: "custom_tool_call_output", output: "不得进入语料" } },
    { ordinal: 3, timestamp: "2026-08-28T02:00:04.000Z", type: "response_item", payload: { type: "message", role: "assistant", phase: "final_answer", content: [{ text: `第一轮最终回答。\n<!-- SELPLAT_CORPUS_META ${JSON.stringify({ title: "第一轮主题", type: "测试", intent: "完成第一轮入库", tags: ["第一轮", "入库"], summary: "第一轮最终回答主旨。" })} -->` }] } },
    { timestamp: "2026-08-28T02:00:05.000Z", type: "event_msg", payload: { type: "task_complete" } },
    { timestamp: "2026-08-28T02:01:00.000Z", type: "event_msg", payload: { type: "task_started" } },
    { ordinal: 4, timestamp: "2026-08-28T02:01:01.000Z", type: "response_item", payload: { type: "message", role: "user", content: [{ text: "第二轮尚未完成。" }] } },
  ];
  const writeRollout = () => writeFileSync(rolloutPath, `${records.map((value) => JSON.stringify(value)).join("\n")}\n`, "utf8");
  try {
    writeRollout();
    writeFileSync(otherWorkspacePath, `${JSON.stringify({ timestamp: "2026-08-28T02:00:00.000Z", type: "session_meta", payload: { session_id: "other-workspace", thread_source: "user", originator: "codex_work_desktop", cwd: path.join(fixture.root, "..", "OTHER") } })}\n`, "utf8");
    const ingestion = new CodexConversationCorpusIngestion(fixture.database, sessionsRoot, {
      sourceKeyPrefix: "codex-app/active",
      eligibleThreadSources: ["user"],
      requiredWorkspaceRoot: fixture.root,
      requiredOriginator: "codex_work_desktop",
      requireCompletedTurns: true,
    });
    assert.deepEqual(await ingestion.ingestPendingRolloutsIncrementally(), { scannedFileCount: 2, changedFileCount: 2, ingestedMessageCount: 2, skippedInternalFileCount: 1 });
    assert.equal(fixture.repository.tableCount("AiDesktopTrainingCorpusMessage"), 2);
    assert.equal(fixture.database.withConnection((connection) => connection.prepare("SELECT sourceKey FROM AiDesktopCorpusIngestionCheckpoint WHERE sourceThreadId = 'codex-app-thread'").get()).sourceKey, "codex-app/active/rollout-codex-app.jsonl");
    assert.equal(fixture.repository.tableCount("AiDesktopCorpusIngestionCheckpoint"), 2);

    records.push(
      { ordinal: 5, timestamp: "2026-08-28T02:01:02.000Z", type: "response_item", payload: { type: "message", role: "assistant", phase: "final_answer", content: [{ text: `第二轮最终回答。\n<!-- SELPLAT_CORPUS_META ${JSON.stringify({ title: "第二轮主题", type: "测试", intent: "完成第二轮入库", tags: ["第二轮", "入库"], summary: "第二轮最终回答主旨。" })} -->` }] } },
      { timestamp: "2026-08-28T02:01:03.000Z", type: "event_msg", payload: { type: "task_complete" } },
    );
    writeRollout();
    assert.equal((await ingestion.ingestPendingRolloutsIncrementally()).ingestedMessageCount, 2);
    assert.equal(fixture.repository.tableCount("AiDesktopTrainingCorpusMessage"), 4);
  } finally { fixture.close(); }
});

test("Codex 历史最终回答由 AI 生成短摘要并按原始消息去重补齐", async () => {
  const fixture = createFixture("codex-semantic-backfill");
  const sessionsRoot = path.join(fixture.root, "codex-app-sessions");
  mkdirSync(sessionsRoot, { recursive: true });
  const rolloutPath = path.join(sessionsRoot, "rollout-history.jsonl");
  const records = [
    { timestamp: "2026-08-28T03:00:00.000Z", type: "session_meta", payload: { session_id: "history-thread", thread_source: "user", originator: "codex_work_desktop", cwd: fixture.root } },
    { ordinal: 1, timestamp: "2026-08-28T03:00:01.000Z", type: "response_item", payload: { type: "message", role: "user", id: "history-user", content: [{ text: "怎样从南宫婉的回答继续发问？" }] } },
    { ordinal: 2, timestamp: "2026-08-28T03:00:02.000Z", type: "response_item", payload: { type: "message", role: "assistant", phase: "final_answer", id: "history-answer", content: [{ text: "先识别回答里的事实、缺口和假设，再围绕缺口提出下一问，并让问题指向可执行的演化方向。" }] } },
    { timestamp: "2026-08-28T03:00:03.000Z", type: "event_msg", payload: { type: "task_complete" } },
  ];
  const writeRollout = () => writeFileSync(rolloutPath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
  writeRollout();
  try {
    const ingestion = new CodexConversationCorpusIngestion(fixture.database, sessionsRoot, {
      sourceKeyPrefix: "codex-app/active", eligibleThreadSources: ["user"], requiredWorkspaceRoot: fixture.root,
      requiredOriginator: "codex_work_desktop", requireCompletedTurns: true,
    });
    await ingestion.ingestPendingRolloutsIncrementally();
    assert.equal(fixture.repository.tableCount("AiDesktopTrainingCorpusMessage"), 1, "没有元数据标记时先只保留用户原话");
    const backfill = new CodexConversationSemanticBackfill({
      database: fixture.database,
      roots: [sessionsRoot],
      requiredWorkspaceRoot: fixture.root,
      analyzer: async (candidates) => candidates.map((candidate) => ({
        turnId: candidate.turnId,
        title: "根据回答继续发问",
        type: "演化提问训练",
        intent: "学习从南宫婉回答中识别缺口并继续发问",
        tags: ["南宫婉", "继续发问", "演化方向"],
        summary: "识别回答中的事实、缺口和假设，围绕缺口继续提问，并让问题指向可执行的演化方向。",
      })),
    });
    backfill.start(10);
    for (let count = 0; count < 100 && backfill.status().state === "running"; count += 1) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(backfill.status().state, "completed");
    assert.equal(backfill.status().insertedCount, 1);
    assert.equal(fixture.repository.tableCount("AiDesktopTrainingCorpusMessage"), 2);
    const stored = fixture.database.withConnection((connection) => connection.prepare("SELECT content, contentRetention FROM AiDesktopTrainingCorpusMessage WHERE speakerRole='codex'").get());
    assert.equal(stored.contentRetention, "preview-300");
    assert.match(stored.content, /缺口/);

    records.push(
      { ordinal: 3, timestamp: "2026-08-28T03:01:01.000Z", type: "response_item", payload: { type: "message", role: "user", id: "history-user-2", content: [{ text: "继续补充新的问题。" }] } },
      { ordinal: 4, timestamp: "2026-08-28T03:01:02.000Z", type: "response_item", payload: { type: "message", role: "assistant", phase: "final_answer", id: "history-answer-2", content: [{ text: "新的回答暂时没有语料元数据。" }] } },
      { timestamp: "2026-08-28T03:01:03.000Z", type: "event_msg", payload: { type: "task_complete" } },
    );
    writeRollout();
    assert.equal((await ingestion.ingestPendingRolloutsIncrementally()).ingestedMessageCount, 1);
    const appended = fixture.database.withConnection((connection) => connection.prepare("SELECT sourceMessageId, sequenceNumber FROM AiDesktopTrainingCorpusMessage WHERE sourceConversationId='history-thread' ORDER BY sequenceNumber").all());
    assert.deepEqual(appended.map((row) => Number(row.sequenceNumber)), [0, 1, 2]);
    assert.match(appended[2].sourceMessageId, /-3$/);

    backfill.start(10);
    for (let count = 0; count < 100 && backfill.status().state === "running"; count += 1) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(backfill.status().insertedCount, 1);
    assert.equal(fixture.repository.tableCount("AiDesktopTrainingCorpusMessage"), 4);
    backfill.start(10);
    for (let count = 0; count < 100 && backfill.status().state === "running"; count += 1) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(backfill.status().insertedCount, 0);
    assert.equal(fixture.repository.tableCount("AiDesktopTrainingCorpusMessage"), 4);
  } finally { fixture.close(); }
});

test("Codex 历史摘要批次异常时隔离失败轮并继续写入合格轮", async () => {
  const fixture = createFixture("codex-semantic-backfill-partial-failure");
  const sessionsRoot = path.join(fixture.root, "codex-app-sessions");
  mkdirSync(sessionsRoot, { recursive: true });
  const records = [
    { timestamp: "2026-08-28T04:00:00.000Z", type: "session_meta", payload: { session_id: "partial-thread", thread_source: "user", originator: "codex_work_desktop", cwd: fixture.root } },
    { ordinal: 1, timestamp: "2026-08-28T04:00:01.000Z", type: "response_item", payload: { type: "message", role: "user", content: [{ text: "第一轮问题" }] } },
    { ordinal: 2, timestamp: "2026-08-28T04:00:02.000Z", type: "response_item", payload: { type: "message", role: "assistant", phase: "final_answer", content: [{ text: "第一轮回答" }] } },
    { timestamp: "2026-08-28T04:00:03.000Z", type: "event_msg", payload: { type: "task_complete" } },
    { ordinal: 3, timestamp: "2026-08-28T04:01:01.000Z", type: "response_item", payload: { type: "message", role: "user", content: [{ text: "第二轮问题" }] } },
    { ordinal: 4, timestamp: "2026-08-28T04:01:02.000Z", type: "response_item", payload: { type: "message", role: "assistant", phase: "final_answer", content: [{ text: "第二轮回答" }] } },
    { timestamp: "2026-08-28T04:01:03.000Z", type: "event_msg", payload: { type: "task_complete" } },
  ];
  writeFileSync(path.join(sessionsRoot, "rollout-partial.jsonl"), `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
  try {
    const backfill = new CodexConversationSemanticBackfill({
      database: fixture.database,
      roots: [sessionsRoot],
      requiredWorkspaceRoot: fixture.root,
      analyzer: async (candidates) => {
        if (candidates.length > 1) throw new Error("AI 摘要字段 tag 为空或超过 30 字。");
        if (candidates[0].assistantText.includes("第一轮")) throw new Error("AI 摘要字段 tag 为空或超过 30 字。");
        return [{ turnId: candidates[0].turnId, title: "第二轮", type: "测试", intent: "验证失败隔离", tags: ["续跑"], summary: "第二轮合格摘要。" }];
      },
    });
    backfill.start(10);
    for (let count = 0; count < 100 && backfill.status().state === "running"; count += 1) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(backfill.status().state, "failed");
    assert.equal(backfill.status().processedCount, 2);
    assert.equal(backfill.status().insertedCount, 1);
    assert.equal(backfill.status().failedCount, 1);
    assert.match(backfill.status().message, /再次点击续跑/);
    assert.equal(fixture.repository.tableCount("AiDesktopTrainingCorpusMessage"), 1);
  } finally { fixture.close(); }
});

test("统一测试失败优先按结构化 verification 投影为测试阻塞", () => {
  const fixture = createFixture("test-failure-kind");
  try {
    const state = collaborationState("2026-08-28T00:00:00.000Z");
    Object.assign(state.tasks[0], {
      state: "test-failed",
      phase: null,
      blockingReason: "统一测试失败：规则正文包含用户明确选择；expected 5.100.0, actual 5.103.0",
      integrationFailure: { kind: "verification", detail: "过期断言", conflictFiles: [], baseSha: "base", resultSha: "result", generation: 1, occurredAt: "2026-08-28T00:00:00.000Z" },
    });
    fixture.repository.syncCollaborationState(state);
    const task = fixture.database.withConnection((connection) => connection.prepare("SELECT blockingKind, runtimeStatus, acceptanceState FROM AiDesktopTaskExecution WHERE taskId='task-1'").get());
    assert.deepEqual({ ...task }, { blockingKind: "test", runtimeStatus: "failed", acceptanceState: "failed" });
  } finally { fixture.close(); }
});

test("异常从统一队列受理并在相关流程恢复后进入已解决终态", () => {
  const fixture = createFixture("exception-lifecycle");
  try {
    fixture.repository.recordAuditEvent("technical.exception", { message: "渲染失败", correlationId: "round-1", fingerprint: "renderer:round-1" });
    fixture.repository.recordAuditEvent("linghu.unified_exception.accepted", { message: "旧版令狐接收事件", sourceEventId: "source-old" });
    fixture.repository.recordAuditEvent("linghu.unified_issue.accepted", { message: "新版令狐接收事件", sourceEventId: "source-new" });
    const open = fixture.repository.listUnhandledExceptions();
    assert.equal(open.length, 1);
    assert.equal(open[0].status, "open");
    assert.deepEqual(fixture.repository.claimExceptions([open[0].eventId], "linghu-ancestor", "2026-08-26T00:00:00.000Z"), [open[0].eventId]);
    assert.equal(fixture.repository.listUnhandledExceptions()[0].status, "processing");
    fixture.repository.recordAuditEvent("nangong.evolution.state_changed", { correlationId: "round-1", reason: "blocked" });
    assert.equal(fixture.repository.listUnhandledExceptions()[0].status, "processing");
    fixture.repository.recordAuditEvent("conversation.round.completed", { correlationId: "round-1" });
    assert.equal(fixture.repository.listUnhandledExceptions().length, 0);
    const resolved = fixture.database.withConnection((connection) => connection.prepare("SELECT status, handlingOwnerId, resolutionSummary FROM AiDesktopEvent WHERE eventId = $eventId").get({ $eventId: open[0].eventId }));
    assert.equal(resolved.status, "resolved");
    assert.equal(resolved.handlingOwnerId, "linghu-ancestor");
    assert.match(resolved.resolutionSummary, /流程继续推进/);
    fixture.repository.recordAuditEvent("technical.exception", { message: "渲染失败再次发生", correlationId: "round-1", fingerprint: "renderer:round-1" });
    const reopened = fixture.repository.listUnhandledExceptions();
    assert.equal(reopened.length, 1);
    assert.equal(reopened[0].eventId, open[0].eventId);
    assert.equal(reopened[0].status, "open");
    assert.equal(reopened[0].handlingOwnerId, null);
  } finally {
    fixture.close();
  }
});

test("南宫婉轮次收集状态和任务返回结果统一投影到 SQLite", () => {
  const fixture = createFixture("evolution-round");
  try {
    const returnedAt = "2026-08-26T01:00:00.000Z";
    const state = collaborationState(returnedAt);
    Object.assign(state.tasks[0], {
      state: "returned-to-nangong", phase: "ready", evolutionProposalId: "proposal-round-1",
      evolutionRoundId: "proposal-round-1", returnedToNangongAt: returnedAt,
      versionWorkspace: { workspaceId: "workspace-1", rootPath: "/tmp/workspace-1", branchName: "codex/round-1", baseSha: "base", resultSha: "result", createdAt: returnedAt, retiredAt: null },
    });
    fixture.database.withConnection((connection) => connection.prepare(`
      INSERT INTO AiDesktopWorkflowRun (workflowId, topicId, proposalId, origin, title, state, currentStage, currentOwnerId, recoveryPoint, nextLaunchAt, startedAt, completedAt, updatedAt)
      VALUES ('evolution:proposal-round-1', 'topic-round-1', 'proposal-round-1', 'nangong', '轮次投影', 'executing', 'execution', 'nangong-wan', NULL, NULL, $now, NULL, $now)
    `).run({ $now: returnedAt }));
    fixture.repository.syncCollaborationState(state);
    const round = fixture.database.withConnection((connection) => connection.prepare("SELECT state, expectedTaskCount, returnedTaskCount, sealedAt FROM AiDesktopEvolutionRound WHERE roundId='proposal-round-1'").get());
    const task = fixture.database.withConnection((connection) => connection.prepare("SELECT collectionState, resultSha, returnedAt FROM AiDesktopEvolutionRoundTask WHERE roundId='proposal-round-1' AND taskId='task-1'").get());
    assert.deepEqual({ ...round }, { state: "collecting", expectedTaskCount: 1, returnedTaskCount: 1, sealedAt: null });
    assert.deepEqual({ ...task }, { collectionState: "returned", resultSha: "result", returnedAt });
  } finally { fixture.close(); }
});

test("用户与南宫婉完整原文独立保存预览且每轮自由登记主题类型", () => {
  const fixture = createFixture("conversation-memory");
  const memory = new CollaborationMemoryService(fixture.database);
  try {
    const firstConversation = {
      conversationId: "conversation-old",
      messages: [
        { messageId: "user-old", role: "user", content: "我的原话必须逐字保留，包括空格  和换行\n不能拿摘要替代。", attachmentIds: [], createdAt: "2026-08-25T00:00:00.000Z" },
        { messageId: "nangong-old", role: "nangong", content: `南宫婉完整回答：${"详细调查内容".repeat(20)}`, attachmentIds: [], createdAt: "2026-08-25T00:00:01.000Z" },
      ],
      updatedAt: "2026-08-25T00:00:01.000Z",
    };
    firstConversation.messages[0].inferredIntent = "完整保存用户原话，不得由摘要替代。";
    memory.registerRound(firstConversation, "user-old", "nangong-old", { title: "统一日志入口", type: "架构治理", switchTopic: false, userIntent: firstConversation.messages[0].inferredIntent, tags: ["日志", "架构"], summary: "南宫婉确认完整保存用户原话。" });
    const stored = fixture.database.withConnection((connection) => connection.prepare("SELECT content, contentPreview, conversationTopicId FROM AiDesktopConversationMemory WHERE messageId='nangong-old'").get());
    const storedUser = fixture.database.withConnection((connection) => connection.prepare("SELECT content, inferredIntent FROM AiDesktopConversationMemory WHERE messageId='user-old'").get());
    assert.equal(storedUser.inferredIntent, "完整保存用户原话，不得由摘要替代。");
    assert.equal(stored.content, firstConversation.messages[1].content);
    assert.ok(Array.from(stored.contentPreview).length <= 81);
    assert.ok(stored.conversationTopicId);
    const firstContext = memory.buildNangongContext(firstConversation);
    assert.match(firstContext, /我的原话必须逐字保留，包括空格  和换行/);
    assert.doesNotMatch(firstContext, new RegExp(firstConversation.messages[1].content.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    const continued = {
      ...firstConversation,
      messages: [...firstConversation.messages,
        { messageId: "user-next", role: "user", content: "继续处理这个统一入口。", attachmentIds: [], createdAt: "2026-08-25T00:01:00.000Z" },
        { messageId: "nangong-next", role: "nangong", content: "继续调查并给出证据。", attachmentIds: [], createdAt: "2026-08-25T00:01:01.000Z" },
      ],
      updatedAt: "2026-08-25T00:01:01.000Z",
    };
    continued.messages[2].inferredIntent = "继续完成统一入口。";
    memory.registerRound(continued, "user-next", "nangong-next", { title: "标题可由 AI 调整", type: "自由类型", switchTopic: false, userIntent: continued.messages[2].inferredIntent, tags: ["统一入口"], summary: "继续调查统一入口并补充证据。" });
    assert.equal(fixture.database.withConnection((connection) => connection.prepare("SELECT COUNT(*) AS count FROM AiDesktopConversationTopic").get()).count, 1);

    const switched = {
      conversationId: "conversation-old",
      messages: [...continued.messages,
        { messageId: "user-new", role: "user", content: "现在切换到审批习惯分析。", attachmentIds: [], createdAt: "2026-08-26T00:00:00.000Z" },
        { messageId: "nangong-new", role: "nangong", content: "已识别为新的话题中心。", attachmentIds: [], createdAt: "2026-08-26T00:00:01.000Z" },
      ],
      updatedAt: "2026-08-26T00:00:01.000Z",
    };
    switched.messages.at(-2).inferredIntent = "切换问题中心并分析审批习惯。";
    memory.registerRound(switched, "user-new", "nangong-new", { title: "审批习惯分析", type: "审批偏好", switchTopic: true, userIntent: switched.messages.at(-2).inferredIntent, tags: ["审批", "习惯"], summary: "识别并分析新的审批习惯主题。" });
    const context = memory.buildNangongContext({ conversationId: "conversation-current", messages: [], updatedAt: "2026-08-26T00:02:00.000Z" });
    assert.match(context, /我的原话必须逐字保留，包括空格  和换行/);
    assert.match(context, /审批习惯分析|现在切换到审批习惯分析/);
    const topics = fixture.database.withConnection((connection) => connection.prepare("SELECT title, topicType, state FROM AiDesktopConversationTopic ORDER BY startedAt").all());
    assert.deepEqual(topics.map((item) => [item.title, item.topicType]), [["统一日志入口", "架构治理"], ["审批习惯分析", "审批偏好"]]);
    assert.deepEqual(topics.map((item) => item.state), ["closed", "active"]);
    const searched = memory.searchTrainingCorpusTopics("审批");
    assert.equal(searched[0].title, "审批习惯分析");
    assert.deepEqual(searched[0].tags, ["审批", "习惯"]);
    assert.ok(searched[0].messages.some((message) => message.content === "现在切换到审批习惯分析。"));
    fixture.database.withConnection((connection) => {
      connection.prepare(`INSERT INTO AiDesktopTrainingCorpusTopic
        (corpusTopicId, source, sourceConversationId, sourceTurnId, title, topicType, inferredIntent, tagsJson, definitionSource, createdAt, updatedAt)
        VALUES ('codex-topic-1', 'codex', 'codex-thread-1', 'codex-turn-1', '专题档案', '执行记录', NULL, '["专题"]', 'ai-confirmed', '2026-08-26T00:03:00.000Z', '2026-08-26T00:03:00.000Z')`).run();
      connection.prepare(`INSERT INTO AiDesktopTrainingCorpusMessage
        (corpusMessageId, corpusTopicId, source, sourceConversationId, sourceTurnId, sourceMessageId, sequenceNumber, speakerRole, content, contentRetention, evidenceTier, createdAt, recordedAt)
        VALUES ('codex-corpus-1', 'codex-topic-1', 'codex', 'codex-thread-1', 'codex-turn-1', 'codex-source-1', 0, 'codex', 'Codex 执行原始记录必须进入专题案卷。', 'preview-300', 'supporting', '2026-08-26T00:03:00.000Z', '2026-08-26T00:03:00.000Z')`).run();
    });
    const corpus = memory.readHanLiEvolutionCorpus("deliberation-1");
    assert.ok(corpus.some((item) => item.source === "nangong" && item.content === "南宫婉确认完整保存用户原话。"));
    assert.ok(corpus.some((item) => item.source === "codex" && item.content === "Codex 执行原始记录必须进入专题案卷。"));
  } finally {
    fixture.close();
  }
});

test("所有角色事件走统一入口并区分业务异常、技术异常和审批", () => {
  const fixture = createFixture("events");
  try {
    fixture.repository.recordAuditEvent("business.exception", { channel: "desktop:dispatch-evolution-proposal", message: "验收条件缺失" }, "task-business");
    fixture.repository.recordAuditEvent("application.uncaught_exception", { message: "boom", sourceType: "launcher", sourceId: "electron-main", severity: "critical" });
    fixture.repository.recordAuditEvent("nangong.evolution.proposal_decided", { proposalId: "proposal-1" });
    const rows = fixture.database.withConnection((connection) => connection.prepare("SELECT eventType, category, severity, status, sourceType, sourceId FROM AiDesktopEvent ORDER BY occurredAt, rowid").all());
    assert.deepEqual(rows.map((row) => row.category), ["business-exception", "technical-error", "approval"]);
    assert.equal(rows[0].status, "open");
    assert.equal(rows[1].severity, "critical");
    assert.equal(rows[1].sourceType, "launcher");
    assert.equal(rows[1].sourceId, "electron-main");
    assert.equal(rows[2].status, "observed");
  } finally {
    fixture.close();
  }
});

test("南宫婉提案和韩立审批完整投影并保留人工偏好依据", () => {
  const fixture = createFixture("approval");
  try {
    const now = new Date().toISOString();
    fixture.repository.syncEvolutionState({
      version: 8, automaticEvolutionEnabled: true, automaticNangongApprovalEnabled: false,
      automaticLinghuApprovalEnabled: false, automaticExecutionEnabled: false, automationSettings: { maxRoundsPerTopic: 5, maxCorrectionRounds: 5 }, automationRuntime: { status: "running", completedRounds: 0, correctionRounds: 0, stopReason: null, startedAt: now, pausedAt: null }, automationContext: { workspaceState: { roots: [{ path: appRoot, permission: "workspace-write" }] }, locale: "zh-CN" }, preferenceSnapshotVersion: 1,
      activeTopicId: "topic-1", updatedAt: now, conversation: { conversationId: "conversation-1", messages: [], updatedAt: now },
      deliberations: [{
        deliberationId: "deliberation-1", topicId: "topic-1", status: "established",
        sourceSnapshots: [{ snapshotId: "snapshot-1", deliberationId: "deliberation-1", source: "codex", conversationId: "thread-1", sourceMessageId: "source-1", sequenceNumber: 0, role: "codex", responsePhase: "final_answer", content: "原始执行记录", originalCreatedAt: now, capturedAt: now }],
        rounds: [{ roundId: "round-1", roundNumber: 1, question: "异常记录缺在哪里？", questionReason: "需要确定边界", answer: "缺少专题关联。", assessment: "可以确立专项。", decision: "establish-topic", createdAt: now, answeredAt: now, assessedAt: now }],
        candidate: { title: "统一异常", goal: "让所有成员异常可追踪", scope: ["AI Desktop"], exclusions: [], evidence: ["用户要求统一入口"], acceptanceCriteria: ["异常可查询"], establishmentReason: "问题和验收边界已经明确" },
        createdAt: now, updatedAt: now,
      }],
      archiveRecords: [{ recordId: "archive-1", deliberationId: "deliberation-1", topicId: "topic-1", proposalId: null, taskId: null, sequenceNumber: 1, category: "topic", eventType: "topic.established_from_deliberation", actor: "han-li", title: "南宫婉按韩立通知登记专题池", payload: { original: true }, occurredAt: now }],
      topics: [{
        topicId: "topic-1", title: "统一异常", goal: "让所有成员异常可追踪", scope: ["AI Desktop"], exclusions: [],
        evidence: ["用户要求统一入口"], acceptanceCriteria: ["异常可查询"], workspaceState: { roots: [{ path: appRoot, permission: "workspace-write" }] },
        locale: "zh-CN", origin: "nangong", sourceConversationMessageIds: [], deliberationId: "deliberation-1", continuationOfTopicId: null, nextTopicId: null, seriesId: "topic-1", roundNumber: 1, status: "approved", topicRevision: 1,
        currentProposalVersion: 1, recoveryPoint: "approved-returned-to-nangong", createdAt: now, updatedAt: now,
      }],
      proposals: [{
        proposalId: "proposal-1", topicId: "topic-1", version: 1, title: "统一异常", type: "规则演进", origin: "nangong",
        submitterMemberId: "nangong-wan", submitterDisplayName: "南宫婉", purpose: "work-proposal", targetMemberId: null,
        targetMemberDisplayName: null, capabilityScope: null, supersedesProposalId: null, revisionFeedbackApprovalId: null,
        content: "建立统一入口", evidence: ["用户要求统一入口"], impactScope: ["AI Desktop"], exclusions: [], risks: ["迁移风险"],
        rollbackPlan: "保留原状态", acceptanceCriteria: ["异常可查询"], distributionPlan: null, status: "approved", distributedTaskIds: [],
        resultSummary: null, createdAt: now, updatedAt: now,
        approvals: [{
          approvalId: "approval-1", proposalId: "proposal-1", decision: "approved", source: "manual-user", stage: "direction", approverMemberId: "han-li",
          approverDisplayName: "韩立", advice: "保留事实证据", feedbackTarget: "proposal-content", capabilityScope: null,
          referencedApprovalIds: [], preferenceSnapshotVersion: 1, createdAt: now,
        }],
      }],
    });
    const approval = fixture.database.withConnection((connection) => connection.prepare("SELECT title, proposalType, submitterDisplayName, approverDisplayName, decision, evidenceJson FROM AiDesktopApprovalRecord WHERE approvalId='approval-1'").get());
    assert.deepEqual({ title: approval.title, type: approval.proposalType, submitter: approval.submitterDisplayName, approver: approval.approverDisplayName, decision: approval.decision }, {
      title: "统一异常", type: "规则演进", submitter: "南宫婉", approver: "韩立", decision: "approved",
    });
    assert.deepEqual(JSON.parse(approval.evidenceJson), ["用户要求统一入口"]);
    const governance = fixture.database.withConnection((connection) => connection.prepare("SELECT domain, decision, approverDisplayName FROM AiDesktopApprovalGovernance WHERE governanceId='evolution-approval:approval-1'").get());
    assert.deepEqual({ domain: governance.domain, decision: governance.decision, approver: governance.approverDisplayName }, { domain: "evolution", decision: "approved", approver: "韩立" });
    assert.equal(fixture.repository.tableCount("AiDesktopEvolutionDeliberation"), 1);
    assert.equal(fixture.repository.tableCount("AiDesktopEvolutionSourceSnapshot"), 1);
    assert.equal(fixture.repository.tableCount("AiDesktopEvolutionArchiveRecord"), 1);
    const collaboration = collaborationState(now);
    collaboration.tasks[0].evolutionProposalId = "proposal-1";
    fixture.repository.syncCollaborationState(collaboration);
    const task = fixture.database.withConnection((connection) => connection.prepare("SELECT workflowId, proposalId FROM AiDesktopTaskExecution WHERE taskId='task-1'").get());
    assert.deepEqual({ ...task }, { workflowId: "evolution:proposal-1", proposalId: "proposal-1" });
    const dossier = fixture.repository.getEvolutionTopicDossier("topic-1", {
      version: 8, topics: [{ topicId: "topic-1", deliberationId: "deliberation-1" }], proposals: [{ proposalId: "proposal-1", topicId: "topic-1" }],
      deliberations: [{ deliberationId: "deliberation-1", sourceSnapshots: [{ content: "不应覆盖数据库快照" }], rounds: [] }], archiveRecords: [],
    });
    assert.equal(dossier.deliberation.sourceSnapshots[0].content, "原始执行记录");
    assert.equal(dossier.archiveRecords.length, 1);
    assert.equal(dossier.archiveRecords[0].eventType, "topic.established_from_deliberation");
    assert.deepEqual(dossier.archiveRecords[0].payload, { original: true });
    assert.ok(dossier.executionRecords.some((item) => item.taskId === "task-1"));
  } finally {
    fixture.close();
  }
});

test("专题工作台列表由 SQLite 完成搜索和真实分页且不返回原始 JSON", () => {
  const fixture = createFixture("evolution-workbench-pagination");
  try {
    fixture.database.withConnection((connection) => {
      const insert = connection.prepare(`INSERT INTO AiDesktopWorkflowRun
        (workflowId, topicId, proposalId, origin, title, state, currentStage, currentOwnerId, recoveryPoint, nextLaunchAt, startedAt, completedAt, updatedAt)
        VALUES ($workflowId, $topicId, $proposalId, 'nangong', $title, $state, $stage, 'nangong-wan', $recoveryPoint, NULL, $createdAt, NULL, $updatedAt)`);
      for (let index = 1; index <= 25; index += 1) insert.run({
        $workflowId: `evolution:proposal-${index}`, $topicId: `topic-${index}`, $proposalId: `proposal-${index}`,
        $title: index % 2 ? `滚动条专项 ${index}` : `分页专项 ${index}`, $state: index === 25 ? "blocked" : "executing",
        $stage: index === 25 ? "recovery" : "execution", $recoveryPoint: `checkpoint-${index}`,
        $createdAt: `2026-08-28T00:${String(index).padStart(2, "0")}:00.000Z`, $updatedAt: `2026-08-28T00:${String(index).padStart(2, "0")}:30.000Z`,
      });
    });
    const first = fixture.repository.queryEvolutionWorkbench({ view: "topics", page: 1, pageSize: 10, sortField: "updatedAt", sortDirection: "desc" });
    const third = fixture.repository.queryEvolutionWorkbench({ view: "topics", page: 3, pageSize: 10, sortField: "updatedAt", sortDirection: "desc" });
    const searched = fixture.repository.queryEvolutionWorkbench({ view: "topics", page: 1, pageSize: 20, keyword: "滚动条" });
    const blocked = fixture.repository.queryEvolutionWorkbench({ view: "topics", page: 1, pageSize: 20, status: "已阻塞" });
    assert.equal(first.total, 25);
    assert.equal(first.rows.length, 10);
    assert.equal(third.rows.length, 5);
    assert.equal(searched.total, 13);
    assert.equal(blocked.total, 1);
    assert.equal(blocked.rows[0].status, "blocked");
    assert.equal(first.stateVersion, "2026-08-28T00:25:30.000Z");
    assert.equal(searched.rows[0].owner, "南宫婉");
    const byTitle = fixture.repository.queryEvolutionWorkbench({ view: "topics", page: 1, pageSize: 10, sortField: "title", sortDirection: "asc" });
    assert.equal(byTitle.rows[0].title, "分页专项 10");
    assert.equal(Object.hasOwn(searched.rows[0], "payload"), false);
    assert.equal(Object.hasOwn(searched.rows[0], "internalPath"), false);
  } finally { fixture.close(); }
});

test("工作台树展开和列表排序偏好使用同一 SQLite 偏好表按人物视角恢复", () => {
  const fixture = createFixture("evolution-workbench-view-preferences");
  try {
    fixture.repository.saveEvolutionWorkbenchPreference({ perspective: "nangong", nodeId: "__tree__", page: 1, pageSize: 20, keyword: "evolution|manual", status: "", selectedRowId: null }, "2026-08-29T03:00:00.000Z");
    fixture.repository.saveEvolutionWorkbenchPreference({ perspective: "nangong", nodeId: "manual-proposal::sort", page: 1, pageSize: 20, keyword: "title", status: "asc", selectedRowId: null }, "2026-08-29T03:00:01.000Z");
    fixture.repository.saveEvolutionWorkbenchPreference({ perspective: "nangong", nodeId: "manual-proposal::columns", page: 1, pageSize: 20, keyword: "title=292,status=116,stage=140,owner=112,nextStep=230,updatedAt=160", status: "", selectedRowId: null }, "2026-08-29T03:00:01.500Z");
    fixture.repository.saveEvolutionWorkbenchPreference({ perspective: "hanli", nodeId: "__tree__", page: 1, pageSize: 20, keyword: "audit", status: "", selectedRowId: null }, "2026-08-29T03:00:02.000Z");
    assert.equal(fixture.repository.getEvolutionWorkbenchPreference("nangong", "__tree__").keyword, "evolution|manual");
    assert.deepEqual(fixture.repository.getEvolutionWorkbenchPreference("nangong", "manual-proposal::sort"), { perspective: "nangong", nodeId: "manual-proposal::sort", page: 1, pageSize: 20, keyword: "title", status: "asc", selectedRowId: null, updatedAt: "2026-08-29T03:00:01.000Z" });
    assert.equal(fixture.repository.getEvolutionWorkbenchPreference("nangong", "manual-proposal::columns").keyword, "title=292,status=116,stage=140,owner=112,nextStep=230,updatedAt=160");
    assert.equal(fixture.repository.getEvolutionWorkbenchPreference("hanli", "__tree__").keyword, "audit");
  } finally { fixture.close(); }
});

test("专题分发使用 SQLite 幂等日志、全局状态版本和单专题互斥锁", () => {
  const fixture = createFixture("evolution-mutation-guard");
  try {
    const version = "2026-08-29T02:00:00.000Z";
    const request = { expectedStateVersion: version, idempotencyKey: "dispatch-topic-1-once" };
    assert.equal(fixture.repository.beginEvolutionMutation("topic-1", "返还南宫婉并分发", request, version), "started");
    assert.throws(() => fixture.repository.beginEvolutionMutation("topic-1", "返还南宫婉并分发", request, version), /正在处理中/);
    assert.throws(() => fixture.repository.beginEvolutionMutation("topic-1", "恢复专题", { expectedStateVersion: version, idempotencyKey: "recover-topic-1" }, version), /其他推进或恢复操作/);
    fixture.repository.completeEvolutionMutation(request.idempotencyKey, "2026-08-29T02:00:01.000Z");
    assert.equal(fixture.repository.beginEvolutionMutation("topic-1", "返还南宫婉并分发", request, "2026-08-29T02:00:02.000Z"), "completed");
    assert.throws(() => fixture.repository.beginEvolutionMutation("topic-1", "返还南宫婉并分发", { expectedStateVersion: version, idempotencyKey: "stale-dispatch" }, "2026-08-29T02:00:02.000Z"), /状态已更新/);
    const retry = { expectedStateVersion: version, idempotencyKey: "retry-after-failure" };
    assert.equal(fixture.repository.beginEvolutionMutation("topic-2", "返还南宫婉并分发", retry, version), "started");
    fixture.repository.failEvolutionMutation(retry.idempotencyKey, new Error("任务创建失败"));
    assert.equal(fixture.repository.beginEvolutionMutation("topic-2", "返还南宫婉并分发", retry, version), "started");
    fixture.repository.startRuntimeSession(12345, "2026-08-29T02:00:03.000Z");
    assert.equal(fixture.repository.beginEvolutionMutation("topic-2", "返还南宫婉并分发", retry, version), "started");
  } finally { fixture.close(); }
});

test("成员任务心跳超时只登记一次卡住事件并交给有限重试链", () => {
  const fixture = createFixture("stalled");
  try {
    const now = new Date("2026-08-26T00:10:00.000Z");
    const heartbeat = new Date(now.getTime() - 180_000).toISOString();
    fixture.repository.syncCollaborationState(collaborationState(heartbeat));
    const first = fixture.repository.detectStalledTasks(now.toISOString());
    const second = fixture.repository.detectStalledTasks(new Date(now.getTime() + 30_000).toISOString());
    assert.equal(first.length, 1);
    assert.equal(first[0].taskId, "task-1");
    assert.equal(first[0].maxRetries, 3);
    assert.equal(second.length, 0);
    const events = fixture.database.withConnection((connection) => connection.prepare("SELECT COUNT(*) AS count FROM AiDesktopEvent WHERE category='stalled' AND correlationId='task-1'").get());
    assert.equal(Number(events.count), 1);
  } finally {
    fixture.close();
  }
});

test("非正常退出在下一次启动被识别并留下恢复事件", () => {
  const fixture = createFixture("restart");
  try {
    const first = new WorkflowRepository(fixture.database);
    first.startRuntimeSession(101, "2026-08-26T00:00:00.000Z");
    const second = new WorkflowRepository(fixture.database);
    const interrupted = second.startRuntimeSession(202, "2026-08-26T00:01:00.000Z");
    assert.equal(interrupted.length, 1);
    const event = fixture.database.withConnection((connection) => connection.prepare("SELECT category, status FROM AiDesktopEvent WHERE eventType='application.previous_runtime_interrupted'").get());
    assert.deepEqual({ ...event }, { category: "technical-error", status: "open" });
    second.stopRuntimeSession("2026-08-26T00:02:00.000Z");
  } finally {
    fixture.close();
  }
});

test("独立监督器同步全流程后把卡住任务交给令狐入口", async () => {
  const fixture = createFixture("supervisor");
  const now = new Date("2026-08-26T00:10:00.000Z");
  const heartbeat = new Date(now.getTime() - 180_000).toISOString();
  const handedOff = [];
  const handedOffExceptions = [];
  let linghuEnabled = false;
  const supervisor = new WorkflowSupervisor({
    repository: fixture.repository,
    intervalMs: 60_000,
    now: () => now,
    readers: {
      collaboration: () => collaborationState(heartbeat),
      evolution: () => ({ version: 5, automaticEvolutionEnabled: false, automaticNangongApprovalEnabled: false, automaticLinghuApprovalEnabled: false, automaticExecutionEnabled: false, preferenceSnapshotVersion: 0, activeTopicId: null, topics: [], proposals: [], conversation: { conversationId: "conversation", messages: [], updatedAt: now.toISOString() }, updatedAt: now.toISOString() }),
      linghu: () => ({ version: 2, enabled: linghuEnabled, pollIntervalMs: 30_000, cycle: 1, currentModule: "flow-completion", activePromptId: null, activeTaskId: null, pendingRepairProposalId: null, recoveryAttemptCount: 0, currentFaultFingerprint: null, recoveryAttemptsByFingerprint: {}, detectionCursor: null, flowSnapshots: [], testResourceState: null, recoveryCheckpoint: null, lastDispatchAt: null, lastCompletedAt: null, lastCheckedAt: null, blockingReason: null, lastFeedback: null, lastModuleReport: null, prompts: [], updatedAt: now.toISOString() }),
    },
    projectCollaborationTimeline: () => undefined,
    onStalledTasks: (taskIds) => handedOff.push(...taskIds),
    onUnhandledExceptions: (events) => handedOffExceptions.push(...events),
  });
  try {
    // 令狐关闭时异常保持 open，不能先认领为 processing 后失去实际处理者。
    await supervisor.checkNow();
    assert.deepEqual(handedOff, ["task-1"]);
    assert.equal(handedOffExceptions.length, 0);
    assert.ok(fixture.repository.listUnhandledExceptions().every((event) => event.status === "open"));
    linghuEnabled = true;
    // 开启后才由统一入口原子认领并交给令狐。
    await supervisor.checkNow();
    assert.ok(handedOffExceptions.some((event) => event.category === "stalled" && event.handlingOwnerId === "linghu-ancestor"));
    assert.ok(handedOffExceptions.some((event) => event.eventType === "workflow.supervisor.evolution_sync_failed" && event.handlingOwnerId === "linghu-ancestor"));
  } finally {
    supervisor.stop();
    fixture.close();
  }
});

function collaborationState(heartbeat) {
  const updatedAt = heartbeat;
  return {
    version: 1, mode: "collaboration", selectedMemberId: "han-li", integrationBatches: [], nextIntegrationGeneration: 1, updatedAt,
    members: [{ memberId: "zi-ling", displayName: "紫灵", kind: "worker", protected: false, enabled: true, state: "working", role: "executor", phase: "implementing", generation: 1, currentTaskId: "task-1", blockingReason: null, lastHeartbeatAt: heartbeat, lastProtocolProgressAt: heartbeat, lastAssignedAt: heartbeat, createdAt: heartbeat, updatedAt }],
    tasks: [{
      taskId: "task-1", taskRevision: 1, assignmentId: "assignment-1", workerGeneration: 1, state: "executing", phase: "implementing",
      executorMemberId: "zi-ling", currentReviewerMemberId: null, currentPlanVersion: 1, explicitRejectionCount: 0, infrastructureFailureCount: 0,
      mergeStrategy: "INDEPENDENT", atomicGroupId: null, dependencyTaskIds: [], integrationGeneration: null,
      initiator: { memberId: "nangong-wan", displayName: "南宫婉" }, automationSource: null, evolutionProposalId: null, evolutionRoundId: null, returnedToNangongAt: null,
      selfUpgradeTargetMemberId: null, selfUpgradeCapabilityScope: null, sourceEvolutionApprovalId: null, historyCompleteness: "complete",
      snapshot: { title: "执行统一异常", problemStatement: "异常分散", confirmedIntent: "统一入口", constraints: [], acceptanceCriteria: ["可追踪"], sourceMessageIds: [], attachmentIds: [], workspaceState: { roots: [{ path: appRoot, permission: "workspace-write" }] }, locale: "zh-CN", contentHash: "hash" },
      plans: [], executionRecords: [], flowEvents: [], versionWorkspace: null, finalResult: null,
      resultSummary: null, blockingReason: null, recoveryTargetState: null, startedAt: updatedAt, codeVerifiedAt: null, createdAt: updatedAt, updatedAt, completedAt: null,
    }],
  };
}

function createFixture(suffix) {
  const root = mkdtempSync(path.join(controlledTestRoot, `workflow-event-center-${suffix}-`));
  const sqlRoot = path.join(root, "sql");
  const databasePath = path.join(root, "events.sqlite3");
  cpSync(path.join(appRoot, "db", "sql"), sqlRoot, { recursive: true });
  const database = SqliteDatabase.open(databasePath, sqlRoot, true);
  const repository = new WorkflowRepository(database);
  return { root, database, repository, close() { database.close(); rmSync(root, { recursive: true, force: true }); } };
}
