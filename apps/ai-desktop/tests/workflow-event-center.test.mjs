import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../build/ai-desktop/electron/electron/services/event-center/persistence/sqlite-database.js";
import { CollaborationMemoryService } from "../../../build/ai-desktop/electron/electron/services/event-center/collaboration-memory-service.js";
import { WorkflowRepository } from "../../../build/ai-desktop/electron/electron/services/event-center/workflow-repository.js";
import { WorkflowSupervisor } from "../../../build/ai-desktop/electron/electron/services/event-center/workflow-supervisor.js";
import { appRoot, controlledTestRoot } from "./test-paths.mjs";

mkdirSync(controlledTestRoot, { recursive: true });

test("统一迁移建立事件、流程、任务、审批、对话记忆、专题档案和演化轮次表", () => {
  const fixture = createFixture("schema");
  try {
    for (const table of ["AiDesktopEvent", "AiDesktopWorkflowRun", "AiDesktopTaskExecution", "AiDesktopApprovalRecord", "AiDesktopApprovalGovernance", "AiDesktopMemberRuntime", "AiDesktopRuntimeSession", "AiDesktopConversationMemory", "AiDesktopConversationTopic", "AiDesktopConversationTopicLink", "AiDesktopConversationArchiveMessage", "AiDesktopEvolutionDeliberation", "AiDesktopEvolutionSourceSnapshot", "AiDesktopEvolutionArchiveRecord", "AiDesktopEvolutionRound", "AiDesktopEvolutionRoundTask"]) {
      assert.equal(fixture.repository.tableCount(table), 0, table);
    }
    assert.equal(fixture.database.latestSchemaVersion, "0008");
  } finally {
    fixture.close();
  }
});

test("一键清空在单一事务删除业务投影并保留数据库版本记录", () => {
  const fixture = createFixture("clear-test-data");
  try {
    fixture.repository.startRuntimeSession(4321, "2026-08-28T00:00:00.000Z");
    fixture.repository.recordAuditEvent("test.recorded", { message: "待清空事件" });
    fixture.repository.syncCollaborationState(collaborationState("2026-08-28T00:00:01.000Z"));
    const schemaCountBefore = fixture.database.withConnection((connection) => Number(connection.prepare("SELECT COUNT(*) AS count FROM AiDesktopSchemaVersion").get().count));
    assert.ok(fixture.repository.clearTestData() > 0);
    for (const table of ["AiDesktopEvent", "AiDesktopWorkflowRun", "AiDesktopTaskExecution", "AiDesktopApprovalRecord", "AiDesktopApprovalGovernance", "AiDesktopMemberRuntime", "AiDesktopRuntimeSession", "AiDesktopConversationMemory", "AiDesktopConversationTopic", "AiDesktopConversationTopicLink", "AiDesktopConversationArchiveMessage", "AiDesktopEvolutionDeliberation", "AiDesktopEvolutionSourceSnapshot", "AiDesktopEvolutionArchiveRecord", "AiDesktopEvolutionRound", "AiDesktopEvolutionRoundTask"]) {
      assert.equal(fixture.repository.tableCount(table), 0, table);
    }
    const schemaCountAfter = fixture.database.withConnection((connection) => Number(connection.prepare("SELECT COUNT(*) AS count FROM AiDesktopSchemaVersion").get().count));
    assert.equal(schemaCountAfter, schemaCountBefore);
    assert.ok(schemaCountAfter > 0);
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
    fixture.repository.recordAuditEvent("technical.exception", { message: "渲染失败", correlationId: "round-1" });
    fixture.repository.recordAuditEvent("linghu.unified_exception.accepted", { message: "旧版令狐接收事件", sourceEventId: "source-old" });
    fixture.repository.recordAuditEvent("linghu.unified_issue.accepted", { message: "新版令狐接收事件", sourceEventId: "source-new" });
    const open = fixture.repository.listUnhandledExceptions();
    assert.equal(open.length, 1);
    assert.equal(open[0].status, "open");
    assert.deepEqual(fixture.repository.claimExceptions([open[0].eventId], "linghu-ancestor", "2026-08-26T00:00:00.000Z"), [open[0].eventId]);
    assert.equal(fixture.repository.listUnhandledExceptions()[0].status, "processing");
    fixture.repository.recordAuditEvent("conversation.round.completed", { correlationId: "round-1" });
    assert.equal(fixture.repository.listUnhandledExceptions().length, 0);
    const resolved = fixture.database.withConnection((connection) => connection.prepare("SELECT status, handlingOwnerId, resolutionSummary FROM AiDesktopEvent WHERE eventId = $eventId").get({ $eventId: open[0].eventId }));
    assert.equal(resolved.status, "resolved");
    assert.equal(resolved.handlingOwnerId, "linghu-ancestor");
    assert.match(resolved.resolutionSummary, /流程继续推进/);
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
    memory.registerRound(firstConversation, "user-old", "nangong-old", { title: "统一日志入口", type: "架构治理", switchTopic: false, userIntent: firstConversation.messages[0].inferredIntent });
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
    memory.registerRound(continued, "user-next", "nangong-next", { title: "标题可由 AI 调整", type: "自由类型", switchTopic: false, userIntent: continued.messages[2].inferredIntent });
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
    memory.registerRound(switched, "user-new", "nangong-new", { title: "审批习惯分析", type: "审批偏好", switchTopic: true, userIntent: switched.messages.at(-2).inferredIntent });
    const context = memory.buildNangongContext({ conversationId: "conversation-current", messages: [], updatedAt: "2026-08-26T00:02:00.000Z" });
    assert.match(context, /我的原话必须逐字保留，包括空格  和换行/);
    assert.match(context, /审批习惯分析|现在切换到审批习惯分析/);
    const topics = fixture.database.withConnection((connection) => connection.prepare("SELECT title, topicType, state FROM AiDesktopConversationTopic ORDER BY startedAt").all());
    assert.deepEqual(topics.map((item) => [item.title, item.topicType]), [["统一日志入口", "架构治理"], ["审批习惯分析", "审批偏好"]]);
    assert.deepEqual(topics.map((item) => item.state), ["closed", "active"]);
    fixture.database.withConnection((connection) => connection.prepare(`
      INSERT INTO AiDesktopConversationArchiveMessage
        (messageId, threadId, sequenceNumber, sourceRole, responsePhase, content, contentRetention, inferredIntent, topicTitle, topicType, createdAt, recordedAt)
      VALUES ('codex-source-1', 'codex-thread-1', 0, 'codex', 'final_answer', 'Codex 执行原始记录必须进入专题案卷。', 'preview-80', NULL, '专题档案', '执行记录', '2026-08-26T00:03:00.000Z', '2026-08-26T00:03:00.000Z')
    `).run());
    const corpus = memory.readHanLiEvolutionCorpus("deliberation-1");
    assert.ok(corpus.some((item) => item.source === "nangong" && item.content === firstConversation.messages[1].content));
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
      deliberations: [{ deliberationId: "deliberation-1", sourceSnapshots: [{ content: "原始执行记录" }] }], archiveRecords: [{ topicId: "topic-1", eventType: "topic.established_from_deliberation" }],
    });
    assert.equal(dossier.deliberation.sourceSnapshots[0].content, "原始执行记录");
    assert.ok(dossier.executionRecords.some((item) => item.taskId === "task-1"));
  } finally {
    fixture.close();
  }
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
  const supervisor = new WorkflowSupervisor({
    repository: fixture.repository,
    intervalMs: 60_000,
    now: () => now,
    readers: {
      collaboration: () => collaborationState(heartbeat),
      evolution: () => ({ version: 5, automaticEvolutionEnabled: false, automaticNangongApprovalEnabled: false, automaticLinghuApprovalEnabled: false, automaticExecutionEnabled: false, preferenceSnapshotVersion: 0, activeTopicId: null, topics: [], proposals: [], conversation: { conversationId: "conversation", messages: [], updatedAt: now.toISOString() }, updatedAt: now.toISOString() }),
      linghu: () => ({ version: 2, enabled: true, pollIntervalMs: 30_000, cycle: 1, currentModule: "flow-completion", activePromptId: null, activeTaskId: null, pendingRepairProposalId: null, recoveryAttemptCount: 0, currentFaultFingerprint: null, recoveryAttemptsByFingerprint: {}, detectionCursor: null, flowSnapshots: [], testResourceState: null, recoveryCheckpoint: null, lastDispatchAt: null, lastCompletedAt: null, lastCheckedAt: null, blockingReason: null, lastFeedback: null, lastModuleReport: null, prompts: [], updatedAt: now.toISOString() }),
    },
    onStalledTasks: (taskIds) => handedOff.push(...taskIds),
    onUnhandledExceptions: (events) => handedOffExceptions.push(...events),
  });
  try {
    // 直接等待一次完整监督周期，保证卡住任务交接与异常认领两个异步回调都已结束。
    await supervisor.checkNow();
    assert.deepEqual(handedOff, ["task-1"]);
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
      plans: [], reviews: [], reviewAttempts: [], executionRecords: [], flowEvents: [], versionWorkspace: null, finalResult: null,
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
  return { database, repository, close() { database.close(); rmSync(root, { recursive: true, force: true }); } };
}
