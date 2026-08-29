import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { CollaborationTimelineRepository } from "../../../build/ai-desktop/electron/electron/services/event-center/collaboration-timeline-repository.js";
import { SqliteDatabase } from "../../../build/ai-desktop/electron/electron/services/event-center/persistence/sqlite-database.js";
import { appRoot, controlledTestRoot } from "./test-paths.mjs";

const member = (memberId, displayName) => ({ memberId, displayName });

test("审批时间线只按显式事件追加申请、退回、补充和通过", () => {
  const fixture = createFixture("approval");
  try {
    fixture.append(approvalApplication(fixture, "proposal-1", 1, "审批申请"));
    fixture.append(approvalDecision(fixture, "proposal-1", "approval-1", 2, "审批退回补充", "failed"));
    fixture.append(supplement(fixture, "proposal-1", 3, "current", "正在补充审批材料"));
    fixture.append(supplement(fixture, "proposal-1", 4, "completed", "补充材料已重新提交"));
    fixture.append(approvalApplication(fixture, "proposal-2", 5, "补充后再次申请"));
    fixture.append(approvalDecision(fixture, "proposal-2", "approval-2", 6, "审批通过", "completed"));
    const nodes = fixture.timeline.snapshot(fixture.at(7)).groups[0].nodes;
    assert.deepEqual(nodes.map((node) => node.action), ["审批申请", "审批退回补充", "补充材料已重新提交", "补充后再次申请", "审批通过"]);
  } finally { fixture.close(); }
});

test("十人并行只消费 flowEvents，执行和自检分开统计", () => {
  const fixture = createFixture("parallel");
  try {
    fixture.append(approvalApplication(fixture, "proposal-1", 1, "审批申请"));
    const tasks = Array.from({ length: 10 }, (_, offset) => task(fixture, offset + 1, offset >= 6));
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(6), tasks), tasks.map((item) => item.taskId));
    fixture.append(distribution(fixture, tasks.map((item) => item.executionRecords[0].executor), 7));
    const group = fixture.timeline.snapshot(fixture.at(8)).groups[0];
    assert.equal(group.executingCount, 6);
    assert.equal(group.verifyingCount, 4);
    assert.equal(group.nodes.filter((node) => node.kind === "analysis").length, 10);
    assert.equal(group.nodes.find((node) => node.kind === "distribution").recipients.length, 10);
  } finally { fixture.close(); }
});

test("旧执行节点先失败结束，令狐修复作为新事件追加", () => {
  const fixture = createFixture("handoff");
  try {
    const original = task(fixture, 1, false);
    original.evolutionProposalId = null;
    original.evolutionRoundId = null;
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(3), [original]), [original.taskId]);
    original.blockingReason = "依赖路径不在当前工作树";
    original.flowEvents.push(
      flow("blocked", "task.blocked", "recovery", "failed", original.executionRecords[0].executor, original.blockingReason, fixture.at(4), true),
      flow("repair", "execution.repair_started", "recovery", "started", member("linghu-ancestor", "令狐老祖"), "令狐老祖开始修复", fixture.at(5)),
    );
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(5), [original]), [original.taskId]);
    const nodes = fixture.timeline.snapshot(fixture.at(6)).groups[0].nodes;
    const oldExecution = nodes.find((node) => node.kind === "execution");
    assert.equal(oldExecution.actor.displayName, "执行人1");
    assert.equal(oldExecution.status, "failed");
    assert.match(oldExecution.summary, /依赖路径/);
    assert.ok(nodes.some((node) => node.kind === "repair" && node.actor.displayName === "令狐老祖"));
  } finally { fixture.close(); }
});

test("修改任务快照但没有新业务事件时时间线不变", () => {
  const fixture = createFixture("no-state-inference");
  try {
    const running = task(fixture, 1, false);
    running.evolutionProposalId = null;
    running.evolutionRoundId = null;
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(3), [running]), [running.taskId]);
    const before = fixture.timeline.snapshot(fixture.at(4)).groups[0].nodes.map(stableNode);
    running.state = "blocked";
    running.phase = "failed";
    running.executionRecords[0].status = "blocked";
    running.updatedAt = fixture.at(5);
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(5), [running]), [running.taskId]);
    assert.deepEqual(fixture.timeline.snapshot(fixture.at(6)).groups[0].nodes.map(stableNode), before);
  } finally { fixture.close(); }
});

function stableNode({ durationMs: _durationMs, ...node }) {
  return node;
}

test("执行、自检、南宫交接和令狐统一测试按事件顺序形成独立节点", () => {
  const fixture = createFixture("strict-handoff");
  try {
    const completed = task(fixture, 1, true, true);
    completed.finalResult = "源码修改完成";
    completed.flowEvents.push(
      flow("return", "task.code_verified", "execution", "completed", completed.executionRecords[0].executor, "执行与自检完成，返回南宫婉", fixture.at(5)),
      flow("collect", "evolution.task_collected", "integration", "completed", member("nangong-wan", "南宫婉"), "南宫婉收齐结果", fixture.at(7)),
      flow("test", "unified_test.started", "integration", "started", member("linghu-ancestor", "令狐老祖"), "令狐老祖开始统一测试", fixture.at(8)),
    );
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(8), [completed]), [completed.taskId]);
    const nodes = fixture.timeline.snapshot(fixture.at(9)).groups[0].nodes;
    assert.ok(nodes.some((node) => node.action === "执行人自检完成"));
    assert.ok(nodes.some((node) => node.action === "执行与自检结果已返回" && node.recipients[0].displayName === "南宫婉"));
    assert.ok(nodes.some((node) => node.action === "提交统一测试" && node.actor.displayName === "南宫婉"));
    assert.ok(nodes.some((node) => node.action === "当前正在统一测试" && node.actor.displayName === "令狐老祖"));
  } finally { fixture.close(); }
});

test("流式正文按轮次追加到当前显式事件节点", () => {
  const fixture = createFixture("stream");
  try {
    const running = task(fixture, 1, false);
    running.evolutionProposalId = null;
    running.evolutionRoundId = null;
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(3), [running]), [running.taskId]);
    fixture.timeline.appendStream(running.taskId, "worker-1", { type: "message-delta", turnId: "turn-1", delta: "第一段" }, fixture.at(4));
    fixture.timeline.appendStream(running.taskId, "worker-1", { type: "message-completed", turnId: "turn-1", text: "第一段正文" }, fixture.at(5));
    fixture.timeline.appendStream(running.taskId, "worker-1", { type: "message-completed", turnId: "turn-2", text: "第二轮向下新增" }, fixture.at(6));
    const content = fixture.timeline.snapshot(fixture.at(7)).groups[0].nodes.find((node) => node.kind === "execution" && node.status === "current").content;
    assert.equal(content, "第一段正文\n\n第二轮向下新增");
  } finally { fixture.close(); }
});

test("旧状态反推接口和旧表读取已退役", () => {
  const source = readFileSync(path.join(appRoot, "electron/services/event-center/collaboration-timeline-repository.ts"), "utf8");
  assert.doesNotMatch(source, /syncEvolutionState|#appendProposalFacts|#appendTaskFacts/);
  assert.doesNotMatch(source, /FROM AiDesktopCollaborationTimelineEvent|FROM AiDesktopCollaborationTopic/);
  assert.match(source, /appendBusinessEvent/);
  assert.match(source, /AiDesktopTaskCollaborationEvent/);
});

function approvalApplication(fixture, proposalId, offset, action) {
  return businessEvent(fixture, `application:${proposalId}`, proposalId, offset, {
    nodeId: `proposal:${proposalId}`, taskId: null, proposalId, sourceFactKey: `application:${proposalId}`, kind: "approval-application",
    actor: member("nangong-wan", "南宫婉"), recipients: [member("han-li", "韩立")], status: "current", action,
    summary: "提交审批内容", content: "提交审批内容", detail: "", startedAt: fixture.at(offset), completedAt: null,
    automaticOpen: true, manualApprovalProposalId: proposalId, occurredAt: fixture.at(offset),
  }, "waiting-approval");
}
function approvalDecision(fixture, proposalId, approvalId, offset, action, status) {
  return businessEvent(fixture, approvalId, proposalId, offset, {
    nodeId: `approval:${approvalId}`, taskId: null, proposalId, sourceFactKey: approvalId, kind: "approval-decision",
    actor: member("han-li", "韩立"), recipients: [member("nangong-wan", "南宫婉")], status, action,
    summary: action, content: action, detail: "", startedAt: fixture.at(offset), completedAt: fixture.at(offset),
    automaticOpen: false, manualApprovalProposalId: null, occurredAt: fixture.at(offset),
  }, status === "failed" ? "waiting-approval" : "running");
}
function supplement(fixture, proposalId, offset, status, action) {
  return businessEvent(fixture, `${action}:${offset}`, proposalId, offset, {
    nodeId: `supplement:${proposalId}`, taskId: null, proposalId, sourceFactKey: `${action}:${offset}`, kind: "analysis",
    actor: member("nangong-wan", "南宫婉"), recipients: [member("han-li", "韩立")], status, action,
    summary: action, content: action, detail: "", startedAt: fixture.at(2), completedAt: status === "completed" ? fixture.at(offset) : null,
    automaticOpen: status === "current", manualApprovalProposalId: null, occurredAt: fixture.at(offset),
  }, "waiting-approval");
}
function distribution(fixture, recipients, offset) {
  return businessEvent(fixture, "distribution", "proposal-1", offset, {
    nodeId: "distribution:proposal-1", taskId: null, proposalId: "proposal-1", sourceFactKey: "distribution:proposal-1", kind: "distribution",
    actor: member("nangong-wan", "南宫婉"), recipients, status: "completed", action: "任务分发", summary: "十人并行",
    content: "分发内容", detail: "", startedAt: fixture.at(offset), completedAt: fixture.at(offset), automaticOpen: false,
    manualApprovalProposalId: null, occurredAt: fixture.at(offset),
  }, "running");
}
function businessEvent(fixture, eventId, proposalId, offset, fact, status) {
  return { eventId, group: { groupId: "topic:topic-1", topicId: "topic-1", proposalId, title: "修订截图按钮可用态", status, summary: fact.summary, startedAt: fixture.at(1), updatedAt: fixture.at(offset) }, fact };
}

function task(fixture, index, verifying, verified = false) {
  const actor = member(`worker-${index}`, `执行人${index}`);
  const events = [
    flow(`assigned-${index}`, "executor.assigned", "analysis", "started", actor, `${actor.displayName}收到任务`, fixture.at(1)),
    flow(`analysis-${index}`, "technical_analysis.ready", "analysis", "completed", actor, `${actor.displayName}完成技术分析`, fixture.at(2)),
    flow(`execution-${index}`, "execution.started", "execution", "started", actor, `${actor.displayName}开始执行`, fixture.at(3)),
  ];
  if (verifying) events.push(flow(`verifying-${index}`, "worker.phase.verifying", "execution", "started", actor, `${actor.displayName}开始自检`, fixture.at(4)));
  return {
    taskId: `task-${index}`, taskRevision: 1, assignmentId: `assignment-${index}`, workerGeneration: 1, state: "executing", phase: verifying ? "verifying" : "implementing",
    executorMemberId: actor.memberId, preferredExecutorMemberId: actor.memberId, originalExecutor: actor, currentHandler: actor,
    repairKind: null, repairFailureReason: null, unifiedTest: null, currentPlanVersion: 1, infrastructureFailureCount: 0,
    mergeStrategy: "ATOMIC_GROUP", atomicGroupId: "proposal-1", dependencyTaskIds: [], integrationGeneration: null,
    initiator: member("nangong-wan", "南宫婉"), automationSource: null, evolutionProposalId: "proposal-1", evolutionRoundId: "proposal-1",
    returnedToNangongAt: null, selfUpgradeTargetMemberId: null, selfUpgradeCapabilityScope: null, sourceEvolutionApprovalId: "approval-1", historyCompleteness: "complete",
    snapshot: { title: `并行任务${index}`, problemStatement: "修复问题", confirmedIntent: `完成第 ${index} 项工作`, constraints: [], acceptanceCriteria: [], sourceMessageIds: [], attachmentIds: [], workspaceState: { roots: [], primaryRootId: null }, locale: "zh-CN", contentHash: `hash-${index}` },
    plans: [{ version: 1, ownerMemberId: actor.memberId, ownerDisplayName: actor.displayName, status: "ready-for-execution", text: `${actor.displayName}的技术分析`, contentHash: "plan", createdAt: fixture.at(2) }],
    executionRecords: [{ assignmentId: `assignment-${index}`, executor: actor, workerGeneration: 1, status: verified ? "code-verified" : "executing", assignedAt: fixture.at(1), executionStartedAt: fixture.at(3), completedAt: verified ? fixture.at(5) : null, transferFromAssignmentId: null, handoffType: "initial", result: verified ? "自检通过" : null, blockingReason: null, changedFiles: [] }],
    flowEvents: events, versionWorkspace: null, integrationFailure: null, finalResult: null, resultSummary: null, blockingReason: null, recoveryTargetState: null,
    startedAt: fixture.at(1), codeVerifiedAt: verified ? fixture.at(5) : null, createdAt: fixture.at(1), updatedAt: fixture.at(5), completedAt: null,
  };
}
function flow(eventId, type, stage, status, actor, summary, occurredAt, error = false) { return { eventId, type, stage, status, actor, summary, occurredAt, error }; }
function collaboration(updatedAt, tasks) { return { version: 1, mode: "collaboration", selectedMemberId: "han-li", members: [], tasks, integrationBatches: [], nextIntegrationGeneration: 1, updatedAt }; }
function createFixture(suffix) {
  const root = mkdtempSync(path.join(controlledTestRoot, `collaboration-timeline-${suffix}-`));
  const sqlRoot = path.join(root, "sql");
  cpSync(path.join(appRoot, "db", "sql"), sqlRoot, { recursive: true });
  const database = SqliteDatabase.open(path.join(root, "events.sqlite3"), sqlRoot, true);
  const timeline = new CollaborationTimelineRepository(database);
  const base = Date.now() + 1_000;
  return { timeline, at(offset) { return new Date(base + offset * 1_000).toISOString(); }, append(event) { timeline.appendBusinessEvent(event); }, close() { database.close(); rmSync(root, { recursive: true, force: true }); } };
}
