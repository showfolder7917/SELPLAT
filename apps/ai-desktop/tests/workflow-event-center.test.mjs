import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../build/ai-desktop/electron/electron/services/event-center/persistence/sqlite-database.js";
import { WorkflowRepository } from "../../../build/ai-desktop/electron/electron/services/event-center/workflow-repository.js";
import { WorkflowSupervisor } from "../../../build/ai-desktop/electron/electron/services/event-center/workflow-supervisor.js";
import { appRoot, controlledTestRoot } from "./test-paths.mjs";

mkdirSync(controlledTestRoot, { recursive: true });

test("统一迁移建立事件、流程、任务、审批、成员和运行会话表", () => {
  const fixture = createFixture("schema");
  try {
    for (const table of ["AiDesktopEvent", "AiDesktopWorkflowRun", "AiDesktopTaskExecution", "AiDesktopApprovalRecord", "AiDesktopMemberRuntime", "AiDesktopRuntimeSession"]) {
      assert.equal(fixture.repository.tableCount(table), 0, table);
    }
    assert.equal(fixture.database.latestSchemaVersion, "0002");
  } finally {
    fixture.close();
  }
});

test("所有角色事件走统一入口并区分业务异常、技术异常和审批", () => {
  const fixture = createFixture("events");
  try {
    fixture.repository.recordAuditEvent("business.exception", { channel: "desktop:dispatch-evolution-proposal", message: "验收条件缺失" }, "task-business");
    fixture.repository.recordAuditEvent("application.uncaught_exception", { message: "boom" });
    fixture.repository.recordAuditEvent("nangong.evolution.proposal_decided", { proposalId: "proposal-1" });
    const rows = fixture.database.withConnection((connection) => connection.prepare("SELECT eventType, category, severity, status FROM AiDesktopEvent ORDER BY occurredAt, rowid").all());
    assert.deepEqual(rows.map((row) => row.category), ["business-exception", "technical-error", "approval"]);
    assert.equal(rows[0].status, "open");
    assert.equal(rows[1].severity, "error");
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
      version: 4, automaticEvolutionEnabled: true, automaticNangongApprovalEnabled: false,
      automaticLinghuApprovalEnabled: false, automaticExecutionEnabled: false, preferenceSnapshotVersion: 1,
      activeTopicId: "topic-1", updatedAt: now, conversation: { conversationId: "conversation-1", messages: [], updatedAt: now },
      topics: [{
        topicId: "topic-1", title: "统一异常", goal: "让所有成员异常可追踪", scope: ["AI Desktop"], exclusions: [],
        evidence: ["用户要求统一入口"], acceptanceCriteria: ["异常可查询"], workspaceState: { roots: [{ path: appRoot, permission: "workspace-write" }] },
        locale: "zh-CN", origin: "nangong", sourceConversationMessageIds: [], status: "approved", topicRevision: 1,
        currentProposalVersion: 1, recoveryPoint: "approved-returned-to-nangong", createdAt: now, updatedAt: now,
      }],
      proposals: [{
        proposalId: "proposal-1", topicId: "topic-1", version: 1, title: "统一异常", type: "规则演进", origin: "nangong",
        submitterMemberId: "nangong-wan", submitterDisplayName: "南宫婉", purpose: "work-proposal", targetMemberId: null,
        targetMemberDisplayName: null, capabilityScope: null, supersedesProposalId: null, revisionFeedbackApprovalId: null,
        content: "建立统一入口", evidence: ["用户要求统一入口"], impactScope: ["AI Desktop"], exclusions: [], risks: ["迁移风险"],
        rollbackPlan: "保留原状态", acceptanceCriteria: ["异常可查询"], distributionUnits: [], status: "approved", distributedTaskIds: [],
        resultSummary: null, createdAt: now, updatedAt: now,
        approvals: [{
          approvalId: "approval-1", proposalId: "proposal-1", decision: "approved", source: "manual-user", approverMemberId: "user",
          approverDisplayName: "用户", advice: "保留事实证据", feedbackTarget: "proposal-content", capabilityScope: null,
          referencedApprovalIds: [], preferenceSnapshotVersion: 1, createdAt: now,
        }],
      }],
    });
    const approval = fixture.database.withConnection((connection) => connection.prepare("SELECT title, proposalType, submitterDisplayName, approverDisplayName, decision, evidenceJson FROM AiDesktopApprovalRecord WHERE approvalId='approval-1'").get());
    assert.deepEqual({ title: approval.title, type: approval.proposalType, submitter: approval.submitterDisplayName, approver: approval.approverDisplayName, decision: approval.decision }, {
      title: "统一异常", type: "规则演进", submitter: "南宫婉", approver: "用户", decision: "approved",
    });
    assert.deepEqual(JSON.parse(approval.evidenceJson), ["用户要求统一入口"]);
    const collaboration = collaborationState(now);
    collaboration.tasks[0].evolutionProposalId = "proposal-1";
    fixture.repository.syncCollaborationState(collaboration);
    const task = fixture.database.withConnection((connection) => connection.prepare("SELECT workflowId, proposalId FROM AiDesktopTaskExecution WHERE taskId='task-1'").get());
    assert.deepEqual({ ...task }, { workflowId: "evolution:proposal-1", proposalId: "proposal-1" });
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
  });
  try {
    supervisor.start();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(handedOff, ["task-1"]);
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
      initiator: { memberId: "nangong-wan", displayName: "南宫婉" }, automationSource: null, evolutionProposalId: null,
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
