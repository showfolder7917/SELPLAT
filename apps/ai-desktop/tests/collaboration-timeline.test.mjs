import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { CollaborationTimelineRepository } from "../../../build/ai-desktop/electron/electron/services/event-center/collaboration-timeline-repository.js";
import { SqliteDatabase } from "../../../build/ai-desktop/electron/electron/services/event-center/persistence/sqlite-database.js";
import { appRoot, controlledTestRoot } from "./test-paths.mjs";

const member = (memberId, displayName) => ({ memberId, displayName });

test("数据库时间线按申请、拒绝、补充申请和通过顺序追加，手动审批只属于当前申请", () => {
  const fixture = createFixture("approval");
  try {
    const proposal1 = proposal(fixture.at(1), "proposal-1", 1, "supplement-required", null, [{
      approvalId: "approval-1", proposalId: "proposal-1", decision: "supplement-required", source: "manual-user", stage: "direction",
      approverMemberId: "han-li", approverDisplayName: "韩立", advice: "请补充忙碌状态。", feedbackTarget: "proposal-content",
      capabilityScope: null, referencedApprovalIds: [], preferenceSnapshotVersion: 0, createdAt: fixture.at(2),
    }]);
    const proposal2 = { ...proposal(fixture.at(3), "proposal-2", 2, "pending-approval", "proposal-1", []), revisionFeedbackApprovalId: "approval-1", content: "已补充忙碌状态。" };
    fixture.timeline.syncEvolutionState(evolution(fixture.at(4), [proposal1, proposal2], false));
    let nodes = fixture.timeline.snapshot(fixture.at(5)).groups[0].nodes;
    assert.deepEqual(nodes.map((node) => node.action), ["审批申请", "审批未通过", "补充后再次申请"]);
    assert.equal(nodes.at(-1).manualApprovalProposalId, "proposal-2");

    proposal2.status = "approved";
    proposal2.approvals = [{ ...proposal1.approvals[0], approvalId: "approval-2", proposalId: "proposal-2", decision: "approved", advice: "范围明确，可以执行。", createdAt: fixture.at(6) }];
    proposal2.updatedAt = fixture.at(6);
    fixture.timeline.syncEvolutionState(evolution(fixture.at(6), [proposal1, proposal2], false));
    nodes = fixture.timeline.snapshot(fixture.at(7)).groups[0].nodes;
    assert.deepEqual(nodes.map((node) => node.action), ["审批申请", "审批未通过", "补充后再次申请", "审批通过"]);
    assert.equal(nodes.filter((node) => node.manualApprovalProposalId).length, 0);
    assert.equal(fixture.timeline.snapshot(fixture.at(7)).groups[0].status, "running");
  } finally { fixture.close(); }
});

test("十人并行保持单列稳定节点并分别统计执行和验证", () => {
  const fixture = createFixture("parallel");
  try {
    const approved = proposal(fixture.at(1), "proposal-1", 1, "approved", null, [{
      approvalId: "approval-1", proposalId: "proposal-1", decision: "approved", source: "automatic", stage: "direction",
      approverMemberId: "han-li", approverDisplayName: "韩立", advice: "可以执行。", feedbackTarget: "proposal-content",
      capabilityScope: null, referencedApprovalIds: [], preferenceSnapshotVersion: 0, createdAt: fixture.at(2),
    }]);
    fixture.timeline.syncEvolutionState(evolution(fixture.at(2), [approved], true));
    const tasks = Array.from({ length: 10 }, (_, offset) => task(fixture, offset + 1, offset < 6 ? "implementing" : "verifying"));
    fixture.timeline.syncCollaborationState(collaboration(fixture.at(8), tasks));
    approved.status = "executing";
    approved.distributedTaskIds = tasks.map((item) => item.taskId);
    approved.distributionPlan = { version: 1, summary: "十人并行执行", units: tasks.map((item) => ({ title: item.snapshot.title, scope: item.snapshot.confirmedIntent, acceptanceCriteria: [], expectedFiles: [], independentReason: "可独立完成" })), audit: { decision: "passed", reason: "可并行", findings: [], auditedAt: fixture.at(3) }, plannedAt: fixture.at(3) };
    approved.updatedAt = fixture.at(3);
    fixture.timeline.syncEvolutionState(evolution(fixture.at(9), [approved], true));

    const group = fixture.timeline.snapshot(fixture.at(10)).groups[0];
    assert.equal(group.executingCount, 6);
    assert.equal(group.verifyingCount, 4);
    assert.equal(group.nodes.filter((node) => node.kind === "analysis").length, 10);
    assert.equal(group.nodes.find((node) => node.kind === "distribution").recipients.length, 10);
  } finally { fixture.close(); }
});

test("任务转交令狐后保留原执行人、原时间和正文，后续修复独立追加", () => {
  const fixture = createFixture("handoff");
  try {
    const original = task(fixture, 1, "implementing");
    original.evolutionProposalId = null;
    original.evolutionRoundId = null;
    fixture.timeline.syncCollaborationState(collaboration(fixture.at(5), [original]));
    const before = fixture.timeline.snapshot(fixture.at(6)).groups[0].nodes.find((node) => node.kind === "execution");

    original.executionRecords[0].status = "blocked";
    original.executionRecords[0].completedAt = fixture.at(7);
    original.executionRecords[0].blockingReason = "依赖路径不在当前工作树";
    original.executionRecords.push({ assignmentId: "repair-assignment", executor: member("linghu-ancestor", "令狐老祖"), workerGeneration: 2, status: "executing", assignedAt: fixture.at(8), executionStartedAt: fixture.at(9), completedAt: null, transferFromAssignmentId: "assignment-1", handoffType: "transfer", result: null, blockingReason: null, changedFiles: [] });
    original.currentHandler = member("linghu-ancestor", "令狐老祖");
    original.state = "repairing-execution";
    original.taskRevision = 2;
    original.updatedAt = fixture.at(9);
    original.flowEvents.push({ eventId: "repair-start", type: "execution.repair_started", stage: "recovery", status: "started", actor: member("linghu-ancestor", "令狐老祖"), summary: "令狐老祖正在修复真实依赖路径错误", occurredAt: fixture.at(9), error: false });
    fixture.timeline.syncCollaborationState(collaboration(fixture.at(9), [original]));

    const nodes = fixture.timeline.snapshot(fixture.at(10)).groups[0].nodes;
    const oldExecution = nodes.find((node) => node.nodeId === before.nodeId);
    assert.equal(oldExecution.actor.displayName, "执行人1");
    assert.equal(oldExecution.startedAt, before.startedAt);
    assert.match(oldExecution.summary, /依赖路径/);
    assert.ok(nodes.some((node) => node.kind === "repair" && node.actor.displayName === "令狐老祖"));
  } finally { fixture.close(); }
});

test("流式正文按轮次向下追加，完成正文不与 delta 重复", () => {
  const fixture = createFixture("stream");
  try {
    const running = task(fixture, 1, "implementing");
    running.evolutionProposalId = null;
    running.evolutionRoundId = null;
    fixture.timeline.syncCollaborationState(collaboration(fixture.at(3), [running]));
    fixture.timeline.appendStream(running.taskId, "worker-1", { type: "message-delta", turnId: "turn-1", delta: "第一段" }, fixture.at(4));
    fixture.timeline.appendStream(running.taskId, "worker-1", { type: "message-delta", turnId: "turn-1", delta: "正文" }, fixture.at(5));
    fixture.timeline.appendStream(running.taskId, "worker-1", { type: "message-completed", turnId: "turn-1", text: "第一段正文" }, fixture.at(6));
    fixture.timeline.appendStream(running.taskId, "worker-1", { type: "message-completed", turnId: "turn-2", text: "第二轮向下新增" }, fixture.at(7));
    const content = fixture.timeline.snapshot(fixture.at(8)).groups[0].nodes.find((node) => node.kind === "execution" && node.status === "current").content;
    assert.equal(content, "第一段正文\n\n第二轮向下新增");
  } finally { fixture.close(); }
});

test("页面 IPC 只读数据库时间线且旧 JSON 投影已经退役", () => {
  const ipc = readFileSync(path.join(appRoot, "electron/ipc/domains/register-collaboration-ipc.ts"), "utf8");
  assert.match(ipc, /workflowRepository\.getCollaborationTimeline/);
  assert.doesNotMatch(ipc, /buildCollaborationTimeline|collaboration\.state\(\).*nangongEvolution\.state/);
  assert.equal(existsSync(path.join(appRoot, "electron/services/collaboration/collaboration-timeline-projection.ts")), false);
});

function task(fixture, index, phase) {
  const actor = member(`worker-${index}`, `执行人${index}`);
  return {
    taskId: `task-${index}`, taskRevision: 1, assignmentId: `assignment-${index}`, workerGeneration: 1, state: "executing", phase,
    executorMemberId: actor.memberId, preferredExecutorMemberId: actor.memberId, originalExecutor: actor, currentHandler: actor,
    repairKind: null, repairFailureReason: null, unifiedTest: null, currentPlanVersion: 1, infrastructureFailureCount: 0,
    mergeStrategy: "ATOMIC_GROUP", atomicGroupId: "proposal-1", dependencyTaskIds: [], integrationGeneration: null,
    initiator: member("nangong-wan", "南宫婉"), automationSource: null, evolutionProposalId: "proposal-1", evolutionRoundId: "proposal-1",
    returnedToNangongAt: null, selfUpgradeTargetMemberId: null, selfUpgradeCapabilityScope: null, sourceEvolutionApprovalId: "approval-1", historyCompleteness: "complete",
    snapshot: { title: `并行任务${index}`, problemStatement: "修复问题", confirmedIntent: `完成第 ${index} 项工作`, constraints: [], acceptanceCriteria: [], sourceMessageIds: [], attachmentIds: [], workspaceState: { roots: [], primaryRootId: null }, locale: "zh-CN", contentHash: `hash-${index}` },
    plans: [{ version: 1, ownerMemberId: actor.memberId, ownerDisplayName: actor.displayName, status: "ready-for-execution", text: `执行人${index}的技术分析`, contentHash: "plan", createdAt: fixture.at(2) }],
    executionRecords: [{ assignmentId: `assignment-${index}`, executor: actor, workerGeneration: 1, status: "executing", assignedAt: fixture.at(1), executionStartedAt: fixture.at(2), completedAt: null, transferFromAssignmentId: null, handoffType: "initial", result: null, blockingReason: null, changedFiles: [] }],
    flowEvents: [], versionWorkspace: null, integrationFailure: null, finalResult: null, resultSummary: null, blockingReason: null, recoveryTargetState: null,
    startedAt: fixture.at(1), codeVerifiedAt: null, createdAt: fixture.at(1), updatedAt: fixture.at(3), completedAt: null,
  };
}

function proposal(createdAt, proposalId, version, status, supersedesProposalId, approvals) {
  return {
    proposalId, topicId: "topic-1", version, title: "修订截图按钮可用态", type: "代码修正", origin: "nangong",
    submitterMemberId: "nangong-wan", submitterDisplayName: "南宫婉", purpose: "work-proposal", targetMemberId: null, targetMemberDisplayName: null,
    capabilityScope: null, supersedesProposalId, revisionFeedbackApprovalId: null, content: "统一截图按钮状态。", evidence: [], impactScope: [], exclusions: [], risks: [], rollbackPlan: "回退", acceptanceCriteria: [], distributionPlan: null,
    status, approvals, distributedTaskIds: [], resultSummary: null, createdAt, updatedAt: createdAt,
  };
}

function evolution(updatedAt, proposals, automaticNangongApprovalEnabled) {
  return {
    automaticNangongApprovalEnabled, automaticLinghuApprovalEnabled: false,
    topics: [{ topicId: "topic-1", title: "修订截图按钮可用态", status: proposals.at(-1).status, createdAt: proposals[0].createdAt, updatedAt }],
    proposals,
  };
}

function collaboration(updatedAt, tasks) {
  const participants = tasks.flatMap((item) => item.executionRecords.map((record) => record.executor));
  const members = [...new Map(participants.map((actor) => [actor.memberId, actor])).values()].map((actor) => ({
    ...actor, kind: "worker", protected: false, enabled: true, state: "working", role: "executor", phase: "implementing", generation: 1,
    currentTaskId: null, blockingReason: null, lastHeartbeatAt: updatedAt, lastProtocolProgressAt: updatedAt, lastAssignedAt: updatedAt, createdAt: updatedAt, updatedAt,
  }));
  return { version: 1, mode: "collaboration", selectedMemberId: "han-li", members, tasks, integrationBatches: [], nextIntegrationGeneration: 1, updatedAt };
}

function createFixture(suffix) {
  const root = mkdtempSync(path.join(controlledTestRoot, `collaboration-timeline-${suffix}-`));
  const sqlRoot = path.join(root, "sql");
  cpSync(path.join(appRoot, "db", "sql"), sqlRoot, { recursive: true });
  const database = SqliteDatabase.open(path.join(root, "events.sqlite3"), sqlRoot, true);
  const timeline = new CollaborationTimelineRepository(database);
  const base = Date.now() + 1_000;
  return {
    timeline,
    at(offset) { return new Date(base + offset * 1_000).toISOString(); },
    close() { database.close(); rmSync(root, { recursive: true, force: true }); },
  };
}
