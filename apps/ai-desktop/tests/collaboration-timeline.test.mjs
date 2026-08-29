import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildCollaborationTimeline } from "../../../build/ai-desktop/electron/electron/services/collaboration/collaboration-timeline-projection.js";

const now = "2026-08-29T10:00:00.000Z";
const member = (memberId, displayName) => ({ memberId, displayName });

function task(index, state = "executing", phase = "implementing") {
  const actor = member(`worker-${index}`, `执行人${index}`);
  return {
    taskId: `task-${index}`, taskRevision: 1, assignmentId: `assignment-${index}`, workerGeneration: 1, state, phase,
    executorMemberId: actor.memberId, preferredExecutorMemberId: actor.memberId, originalExecutor: actor, currentHandler: actor,
    repairKind: null, repairFailureReason: null, unifiedTest: null, currentPlanVersion: 1, infrastructureFailureCount: 0,
    mergeStrategy: "ATOMIC_GROUP", atomicGroupId: "proposal-2", dependencyTaskIds: [], integrationGeneration: null,
    initiator: member("nangong-wan", "南宫婉"), automationSource: null, evolutionProposalId: "proposal-2", evolutionRoundId: "proposal-2",
    returnedToNangongAt: null, selfUpgradeTargetMemberId: null, selfUpgradeCapabilityScope: null, sourceEvolutionApprovalId: "approval-2",
    historyCompleteness: "complete",
    snapshot: { title: `并行任务${index}`, problemStatement: "修复问题", confirmedIntent: `完成第 ${index} 项工作`, constraints: [], acceptanceCriteria: [], sourceMessageIds: [], attachmentIds: [], workspaceState: { roots: [], primaryRootId: null }, locale: "zh-CN", contentHash: `hash-${index}` },
    plans: [{ version: 1, ownerMemberId: actor.memberId, ownerDisplayName: actor.displayName, status: "ready-for-execution", text: "技术分析内容", contentHash: "plan", createdAt: `2026-08-29T09:${String(index).padStart(2, "0")}:00.000Z` }],
    executionRecords: state === "queued-executor" ? [] : [{ assignmentId: `assignment-${index}`, executor: actor, workerGeneration: 1, status: state === "integrated" ? "code-verified" : "executing", assignedAt: `2026-08-29T09:${String(index).padStart(2, "0")}:00.000Z`, executionStartedAt: `2026-08-29T09:${String(index).padStart(2, "0")}:10.000Z`, completedAt: state === "integrated" ? `2026-08-29T09:${String(index).padStart(2, "0")}:50.000Z` : null, transferFromAssignmentId: null, handoffType: "initial", result: state === "integrated" ? "已完成" : null, blockingReason: null, changedFiles: [] }],
    flowEvents: [], versionWorkspace: null, integrationFailure: null, finalResult: null, resultSummary: null, blockingReason: null, recoveryTargetState: null,
    startedAt: `2026-08-29T09:${String(index).padStart(2, "0")}:00.000Z`, codeVerifiedAt: null, createdAt: `2026-08-29T09:${String(index).padStart(2, "0")}:00.000Z`, updatedAt: now, completedAt: state === "integrated" ? now : null,
  };
}

function evolution(proposals, automaticNangongApprovalEnabled = false) {
  return { automaticNangongApprovalEnabled, automaticLinghuApprovalEnabled: false, topics: [{ topicId: "topic-1", title: "修订截图按钮可用态" }], proposals };
}

const proposal1 = {
  proposalId: "proposal-1", topicId: "topic-1", version: 1, title: "修订截图按钮可用态", type: "代码修正", origin: "nangong",
  submitterMemberId: "nangong-wan", submitterDisplayName: "南宫婉", purpose: "work-proposal", targetMemberId: null, targetMemberDisplayName: null,
  capabilityScope: null, supersedesProposalId: null, revisionFeedbackApprovalId: null, content: "统一截图按钮状态。", evidence: [], impactScope: [], exclusions: [], risks: [], rollbackPlan: "回退", acceptanceCriteria: [], distributionPlan: null,
  status: "supplement-required", approvals: [{ approvalId: "approval-1", proposalId: "proposal-1", decision: "supplement-required", source: "manual-user", stage: "direction", approverMemberId: "han-li", approverDisplayName: "韩立", advice: "请补充忙碌状态。", feedbackTarget: "proposal-content", capabilityScope: null, referencedApprovalIds: [], preferenceSnapshotVersion: 0, createdAt: "2026-08-29T09:10:00.000Z" }], distributedTaskIds: [], resultSummary: null, createdAt: "2026-08-29T09:00:00.000Z", updatedAt: "2026-08-29T09:10:00.000Z",
};

test("时间线按申请、拒绝和补充申请追加，手动审批只属于当前申请", () => {
  const proposal2 = { ...proposal1, proposalId: "proposal-2", version: 2, supersedesProposalId: "proposal-1", revisionFeedbackApprovalId: "approval-1", content: "已补充忙碌状态。", status: "pending-approval", approvals: [], createdAt: "2026-08-29T09:20:00.000Z", updatedAt: "2026-08-29T09:20:00.000Z" };
  const snapshot = buildCollaborationTimeline({ tasks: [] }, evolution([proposal1, proposal2]), now);
  const group = snapshot.groups[0];
  assert.deepEqual(group.nodes.map((node) => node.action), ["审批申请", "审批未通过", "补充后再次申请"]);
  assert.equal(group.status, "waiting-approval");
  assert.equal(group.nodes.filter((node) => node.manualApprovalProposalId).length, 1);
  assert.equal(group.nodes.at(-1).manualApprovalProposalId, "proposal-2");
});

test("十人并行保持单列稳定节点并分别统计执行、验证和等待", () => {
  const tasks = Array.from({ length: 10 }, (_, offset) => {
    const index = offset + 1;
    if (index <= 5) return task(index, "executing", "implementing");
    if (index <= 8) return task(index, "executing", "verifying");
    return task(index, "queued-executor", null);
  });
  const proposal = { ...proposal1, proposalId: "proposal-2", status: "executing", approvals: [{ ...proposal1.approvals[0], approvalId: "approval-2", proposalId: "proposal-2", decision: "approved", advice: "范围明确，可以执行。" }], distributedTaskIds: tasks.map((item) => item.taskId), distributionPlan: { version: 1, summary: "十人并行执行", units: [], audit: { decision: "passed", reason: "可并行", findings: [], auditedAt: now }, plannedAt: now } };
  const snapshot = buildCollaborationTimeline({ tasks }, evolution([proposal]), now);
  const group = snapshot.groups[0];
  assert.equal(group.nodes.filter((node) => ["execution", "verification"].includes(node.kind)).length, 13);
  assert.equal(group.nodes.filter((node) => node.kind === "analysis").length, 10);
  assert.equal(group.executingCount, 5);
  assert.equal(group.verifyingCount, 3);
  assert.equal(group.waitingCount, 2);
  assert.deepEqual(group.nodes.filter((node) => node.kind === "analysis").map((node) => node.actor.displayName), Array.from({ length: 10 }, (_, index) => `执行人${index + 1}`));
});

test("同一任务转交后保留每一位执行人的独立节点", () => {
  const transferred = task(1);
  transferred.executionRecords.push({ ...transferred.executionRecords[0], assignmentId: "assignment-1-next", executor: member("worker-next", "令狐老祖"), transferFromAssignmentId: "assignment-1", assignedAt: "2026-08-29T09:30:00.000Z", executionStartedAt: "2026-08-29T09:31:00.000Z" });
  transferred.currentHandler = member("worker-next", "令狐老祖");
  const snapshot = buildCollaborationTimeline({ tasks: [transferred] }, evolution([]), now);
  assert.deepEqual(snapshot.groups[0].nodes.filter((node) => node.kind === "execution").map((node) => node.actor.displayName), ["执行人1", "令狐老祖"]);
  assert.equal(new Set(snapshot.groups[0].nodes.map((node) => node.nodeId)).size, snapshot.groups[0].nodes.length);
});

test("技术分析、执行、令狐修复和统一验证分别追加，旧内容不被覆盖", () => {
  const repairing = task(1, "repairing-execution", "implementing");
  repairing.currentHandler = member("linghu-ancestor", "令狐老祖");
  let nodes = buildCollaborationTimeline({ tasks: [repairing] }, evolution([]), now).groups[0].nodes;
  assert.deepEqual(nodes.map((node) => node.action), ["技术分析", "执行完成", "当前正在修复"]);
  assert.deepEqual(nodes.map((node) => node.actor.displayName), ["执行人1", "执行人1", "令狐老祖"]);

  const verifying = task(2, "unified-testing", "verifying");
  nodes = buildCollaborationTimeline({ tasks: [verifying] }, evolution([]), now).groups[0].nodes;
  assert.deepEqual(nodes.map((node) => node.action), ["技术分析", "执行完成", "当前正在验证"]);
  assert.equal(nodes.at(-1).status, "current");
});

test("新页面复用 SELUI Disclosure 且旧四阶段实现保持隔离待退役", () => {
  const page = readFileSync(new URL("../src/features/collaboration/components/TaskCollaborationGroup.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/variants/developer/DeveloperApp.tsx", import.meta.url), "utf8");
  const ipc = readFileSync(new URL("../electron/ipc/domains/register-collaboration-ipc.ts", import.meta.url), "utf8");
  assert.match(page, /SelUiDisclosure/);
  assert.match(page, /nodeOpenOverrides/);
  assert.match(page, /node\.automaticOpen/);
  assert.doesNotMatch(page, /deriveCollaborationTaskProgress/);
  assert.match(app, /任务协作群/);
  assert.match(ipc, /handle\("desktop:get-collaboration-timeline"/);
  assert.match(ipc, /registerEventCenterIpcHandler/);
  assert.doesNotMatch(readFileSync(new URL("../electron/services/collaboration/collaboration-timeline-projection.ts", import.meta.url), "utf8"), /console\.|appendFile|writeFile/);
});
