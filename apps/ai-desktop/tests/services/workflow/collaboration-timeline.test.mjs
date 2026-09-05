import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { CollaborationTimelineRepository } from "../../../../../build/ai-desktop/electron/electron/services/support/capabilities/event-center/internal/timeline/collaboration-timeline.repository.js";
import { CollaborationTimelineFacade } from "../../../../../build/ai-desktop/electron/electron/services/support/capabilities/event-center/internal/timeline/collaboration-timeline.facade.js";
import { SqliteDatabase } from "../../../../../build/ai-desktop/electron/electron/services/support/platform/persistence/internal/sqlite-database.js";
import { appRoot, controlledTestRoot } from "#test-paths";

const member = (memberId, displayName) => ({ memberId, displayName });

test("每轮自测与自修独立收尾，完成后耗时不再增长且重复同步幂等", () => {
  const fixture = createFixture("self-repair-rounds");
  try {
    const running = task(fixture, 1, false);
    running.evolutionProposalId = null;
    const actor = running.executionRecords[0].executor;
    const details = (round) => ({ assignmentId: running.executionRecords[0].assignmentId, validationRound: round });
    const events = [
      ["executor.self_test_started", "started", 1, 5], ["executor.self_test_failed", "failed", 1, 6],
      ["executor.self_repair_started", "started", 1, 7], ["executor.self_repair_completed", "completed", 1, 8],
      ["executor.self_test_started", "started", 2, 9], ["executor.self_test_passed", "completed", 2, 10],
    ];
    for (const [type, status, round, at] of events) running.flowEvents.push({ ...flow(`${type}:${round}`, type, "execution", status, actor, `${type} 实际证据`, fixture.at(at), status === "failed"), details: details(round) });
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(11), [running]), [running.taskId]);
    const read = (at) => fixture.timeline.snapshot(fixture.at(at)).groups.flatMap((group) => group.nodes).filter((node) => node.nodeId.startsWith("self-"));
    const before = read(12);
    assert.equal(before.length, 3);
    assert.deepEqual(before.map((node) => node.status), ["failed", "completed", "completed"]);
    assert.ok(before.every((node) => node.completedAt));
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(15), [running]), [running.taskId]);
    assert.deepEqual(read(30), before);
  } finally { fixture.close(); }
});

test("令狐巡检问题与恢复动作落库为会话事实，重复巡检不刷屏", () => {
  const fixture = createFixture("inspection-observation");
  try {
    const facade = new CollaborationTimelineFacade(fixture.database);
    facade.appendInspectionObservation("linghu.automation.inspection_no_action_required", { report: "没有问题" });
    facade.appendInspectionObservation("linghu.automation.issue_detected", { report: "墨大夫测试失败，正在核对失败证据", fingerprint: "failure-1" }, "task-1");
    facade.appendInspectionObservation("linghu.automation.issue_detected", { report: "墨大夫测试失败，正在核对失败证据", fingerprint: "failure-1" }, "task-1");
    facade.appendInspectionObservation("linghu.automation.recovery_requested", { report: "已发起第1次恢复，尚未验证通过", fingerprint: "failure-1" }, "task-1");
    const nodes = new CollaborationTimelineFacade(fixture.database).getTimelineSnapshot().groups.flatMap((group) => group.nodes);
    assert.equal(nodes.length, 2);
    assert.deepEqual(nodes.map((node) => node.action), ["巡检发现问题", "已发起恢复"]);
    assert.ok(nodes.every((node) => node.actor.memberId === "linghu-ancestor"));
    assert.match(nodes[1].content, /尚未验证通过/);
  } finally { fixture.close(); }
});

test("缺少专题关联的历史卡点只显示一张汇总卡且原始事实仍保留", () => {
  const fixture = createFixture("unlinked-checkpoints");
  try {
    for (let index = 1; index <= 4; index++) fixture.append({
      eventId: `checkpoint:issue-${index}:1:waiting`, eventType: "checkpoint.progress",
      group: { groupId: `checkpoint:issue-${index}`, topicId: null, proposalId: null, title: "第 1 轮卡点处理", status: "blocked", summary: "无法确认原任务或授权工作区", startedAt: fixture.at(index), updatedAt: fixture.at(index) },
      fact: { nodeId: `checkpoint:issue-${index}:1:waiting`, sourceFactKey: `checkpoint:issue-${index}:1:waiting`, taskId: null, proposalId: null, kind: "repair", actor: member("linghu-ancestor", "令狐老祖"), recipients: [], status: "completed", action: "第 1 轮卡点处理 · 卡点待处理", summary: "无法确认原任务或授权工作区", contentRole: "analysis-output", content: "等待核实", detailRole: "recovery-conditions", detail: `原始事件 issue-${index}`, startedAt: fixture.at(index), completedAt: fixture.at(index), automaticOpen: false, manualApprovalProposalId: null, occurredAt: fixture.at(index) },
    });
    const snapshot = fixture.timeline.snapshot(fixture.at(8));
    assert.equal(snapshot.groups.length, 1);
    assert.equal(snapshot.groups[0].groupId, "checkpoint:unlinked-history");
    assert.equal(snapshot.groups[0].title, "未关联历史卡点（4项）");
    assert.equal(snapshot.groups[0].nodes.length, 1, "相同等待原因只展示一次");
    const persisted = fixture.database.withConnection((connection) => connection.prepare("SELECT COUNT(*) AS value FROM AiDesktopTaskTimelineTopic").get());
    assert.equal(Number(persisted.value), 4, "汇总只改变读模型，不删除审计事实");
  } finally { fixture.close(); }
});

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

test("时间线门面只在事务提交后通知页面读取已落库事实", () => {
  const fixture = createFixture("commit-notification");
  try {
    const facade = new CollaborationTimelineFacade(fixture.database);
    const received = [];
    const unsubscribe = facade.subscribeTimelineChanged((event) => {
      const snapshot = facade.getTimelineSnapshot(fixture.at(2));
      received.push({ event, nodeCount: snapshot.groups[0]?.nodes.length || 0 });
    });
    facade.appendTimelineEvent(approvalApplication(fixture, "proposal-commit", 1, "审批申请"));
    facade.appendTimelineEvent(approvalApplication(fixture, "proposal-commit", 1, "审批申请"));
    unsubscribe();
    assert.equal(received.length, 1);
    assert.equal(received[0].nodeCount, 1);
    assert.deepEqual(received[0].event.groupIds, ["topic:topic-1"]);
    assert.equal(received[0].event.groupVersions["topic:topic-1"], 1);
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
    assert.equal(group.nodes.find((node) => node.kind === "distribution" && node.action === "任务分发").recipients.length, 10);
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
      flow("repair-investigated", "execution.repair_investigated", "recovery", "completed", member("linghu-ancestor", "令狐老祖"), "故障调查完成，开始修复", fixture.at(6)),
    );
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(6), [original]), [original.taskId]);
    const nodes = fixture.timeline.snapshot(fixture.at(7)).groups[0].nodes;
    const oldExecution = nodes.find((node) => node.kind === "execution");
    assert.equal(oldExecution.actor.displayName, "执行人1");
    assert.equal(oldExecution.status, "failed");
    assert.match(oldExecution.summary, /依赖路径/);
    assert.ok(nodes.some((node) => node.kind === "analysis" && node.actor.displayName === "令狐老祖"));
    assert.ok(nodes.some((node) => node.kind === "repair" && node.actor.displayName === "令狐老祖"));
  } finally { fixture.close(); }
});

test("卡点修复任务沿用原专题时间线而不另建分叉专题", () => {
  const fixture = createFixture("checkpoint-original-topic");
  try {
    fixture.append(approvalApplication(fixture, "proposal-1", 1, "审批申请"));
    const repair = task(fixture, 9, false);
    repair.taskId = "checkpoint-repair-task";
    repair.snapshot.title = "修复原专题卡点";
    repair.originalExecutor = member("linghu-ancestor", "令狐老祖");
    repair.currentHandler = repair.originalExecutor;
    repair.executorMemberId = repair.originalExecutor.memberId;
    repair.executionRecords[0].executor = repair.originalExecutor;
    repair.flowEvents = [
      flow("checkpoint-repair-assigned", "executor.assigned", "analysis", "started", repair.originalExecutor, "已接手原专题卡点", fixture.at(2)),
      flow("checkpoint-repair-investigated", "execution.repair_investigated", "recovery", "completed", repair.originalExecutor, "已确认卡点原因", fixture.at(3)),
    ];
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(4), [repair]), [repair.taskId]);

    const snapshot = fixture.timeline.snapshot(fixture.at(5));
    assert.equal(snapshot.groups.length, 1);
    assert.equal(snapshot.groups[0].groupId, "topic:topic-1");
    assert.equal(snapshot.groups[0].proposalId, "proposal-1");
    assert.ok(snapshot.groups[0].nodes.some((node) => node.taskId === repair.taskId && node.actor.memberId === "linghu-ancestor"));
    assert.ok(snapshot.groups.every((group) => group.groupId !== `task:${repair.taskId}`));
  } finally { fixture.close(); }
});

test("客户行动指导显示在原等待节点并在点击继续后交给令狐复查", () => {
  const fixture = createFixture("customer-action-guidance");
  try {
    const blocked = task(fixture, 1, false);
    const linghu = member("linghu-ancestor", "令狐老祖");
    const guidance = {
      guidanceId: "customer-action:fingerprint-1", sourceFingerprint: "fingerprint-1",
      title: "等待客户提交本地修改", problem: "当前修改尚未提交，无法继续集成。",
      reasonCustomerMustAct: "只有客户能确认并提交自己工作区中的修改。",
      steps: ["确认修改属于当前专题。", "提交本地修改。"],
      completionCriteria: ["工作区不再显示未提交修改。"], resumeLabel: "从卡点继续", generatedBy: linghu,
      createdAt: fixture.at(4),
    };
    blocked.state = "blocked";
    blocked.currentHandler = linghu;
    blocked.integrationFailure = { kind: "local-change-ownership", detail: "main.ts 未登记", conflictFiles: ["main.ts"], baseSha: "base", resultSha: "result", generation: 1, occurredAt: fixture.at(3) };
    blocked.flowEvents.push({ ...flow("customer-guidance", "customer.action_required", "recovery", "waiting", linghu, guidance.title, fixture.at(4)), details: { customerActionGuidance: guidance } });
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(4), [blocked]), [blocked.taskId]);
    let node = fixture.timeline.snapshot(fixture.at(5)).groups[0].nodes.find((item) => item.nodeId === guidance.guidanceId);
    assert.equal(node.status, "waiting");
    assert.equal(node.eventType, "customer.action_required");
    assert.match(node.content, /为什么需要您处理/);
    assert.match(node.content, /1\. 确认修改属于当前专题/);
    assert.match(node.content, /完成标准/);

    blocked.flowEvents.push({ ...flow("customer-resume", "task.recovery_requested", "recovery", "started", linghu, "客户已完成操作，令狐正在复查", fixture.at(6)), details: { customerActionGuidance: guidance } });
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(6), [blocked]), [blocked.taskId]);
    node = fixture.timeline.snapshot(fixture.at(7)).groups[0].nodes.find((item) => item.nodeId === guidance.guidanceId);
    assert.equal(node.status, "completed");
    assert.match(node.action, /令狐开始复查/);
    assert.ok(fixture.timeline.snapshot(fixture.at(7)).groups[0].nodes.some((item) => item.action === "正在恢复任务" && item.actor.memberId === "linghu-ancestor"));
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

test("任务提交在执行人接收后结束计时并显示真实接收人", () => {
  const fixture = createFixture("distribution-duration");
  try {
    const submitted = task(fixture, 1, false);
    const executor = submitted.executionRecords[0].executor;
    const executionRecord = { ...submitted.executionRecords[0], assignedAt: fixture.at(3), executionStartedAt: fixture.at(4) };
    submitted.originalExecutor = null;
    submitted.executorMemberId = null;
    submitted.preferredExecutorMemberId = null;
    submitted.currentHandler = submitted.initiator;
    submitted.executionRecords = [];
    submitted.flowEvents = [flow("submitted", "task.submitted", "task", "started", submitted.initiator, "任务已提交并进入协同执行队列", fixture.at(1))];
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(2), [submitted]), [submitted.taskId]);
    const waiting = fixture.timeline.snapshot(fixture.at(8)).groups[0].nodes.find((node) => node.kind === "distribution");
    assert.equal(waiting.status, "waiting");
    assert.equal(waiting.action, "等待分配执行人");
    assert.equal(waiting.recipients[0].displayName, "执行池");

    submitted.originalExecutor = executor;
    submitted.executorMemberId = executor.memberId;
    submitted.currentHandler = executor;
    submitted.executionRecords = [executionRecord];
    submitted.flowEvents.push(flow("assigned", "executor.assigned", "analysis", "started", executor, `${executor.displayName}收到任务`, fixture.at(3)));
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(3), [submitted]), [submitted.taskId]);
    const completed = fixture.timeline.snapshot(fixture.at(50)).groups[0].nodes.find((node) => node.kind === "distribution");
    assert.equal(completed.status, "completed");
    assert.equal(completed.action, "任务已分发");
    assert.equal(completed.actor.displayName, "南宫婉");
    assert.equal(completed.recipients[0].displayName, executor.displayName);
    assert.equal(completed.durationMs, 2_000);
  } finally { fixture.close(); }
});

test("旧数据库中的流程处理中提交节点追加纠正事实后停止计时", () => {
  const fixture = createFixture("legacy-submission-correction");
  try {
    const running = task(fixture, 1, false);
    const executor = running.executionRecords[0].executor;
    running.flowEvents = [
      flow("submitted", "task.submitted", "task", "started", running.initiator, "任务已提交并进入协同执行队列", fixture.at(1)),
      flow("assigned", "executor.assigned", "analysis", "started", executor, `${executor.displayName}收到任务`, fixture.at(3)),
    ];
    fixture.append(businessEvent(fixture, "legacy-submitted", "proposal-1", 1, {
      nodeId: `unmapped:${running.taskId}:submitted`, taskId: running.taskId, proposalId: "proposal-1",
      sourceFactKey: "flow:submitted", kind: "distribution", actor: running.initiator, recipients: [running.initiator],
      status: "current", action: "流程处理中", summary: "任务已提交并进入协同执行队列", content: "",
      detail: "事件类型：task.submitted", startedAt: fixture.at(1), completedAt: null, automaticOpen: true,
      manualApprovalProposalId: null, occurredAt: fixture.at(1),
    }, "running"));
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(3), [running]), [running.taskId]);
    const nodes = fixture.timeline.snapshot(fixture.at(50)).groups[0].nodes;
    const corrected = nodes.find((node) => node.nodeId === `unmapped:${running.taskId}:submitted`);
    assert.equal(corrected.status, "completed");
    assert.equal(corrected.action, "任务已分发");
    assert.equal(corrected.recipients[0].displayName, executor.displayName);
    assert.equal(corrected.durationMs, 2_000);
    assert.equal(nodes.some((node) => node.action === "流程处理中"), false);
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
    assert.ok(nodes.some((node) => node.action === "第 1 次统一测试中" && node.actor.displayName === "令狐老祖"));
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

test("同一回合多个消息项分别完成时不会用后到短快照覆盖前文", () => {
  const fixture = createFixture("stream-items");
  try {
    const running = task(fixture, 1, false);
    running.evolutionProposalId = null;
    running.evolutionRoundId = null;
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(3), [running]), [running.taskId]);
    fixture.timeline.appendStream(running.taskId, "worker-1", { type: "message-completed", turnId: "turn-1", itemId: "item-1", text: "第一项完整内容" }, fixture.at(4));
    fixture.timeline.appendStream(running.taskId, "worker-1", { type: "message-completed", turnId: "turn-1", itemId: "item-2", text: "第二项" }, fixture.at(5));
    const content = fixture.timeline.snapshot(fixture.at(6)).groups[0].nodes.find((node) => node.kind === "execution" && node.status === "current").content;
    assert.equal(content, "第一项完整内容\n\n第二项");
  } finally { fixture.close(); }
});

test("运行状态原样入库但不会重复拼入人物业务正文", () => {
  const fixture = createFixture("stream-status-projection");
  try {
    const running = task(fixture, 1, false);
    running.evolutionProposalId = null;
    running.evolutionRoundId = null;
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(3), [running]), [running.taskId]);
    const status = { type: "managed-execution", turnId: "turn-1", managedExecution: { mode: "test-managed", stage: "code-validation", status: "continuing", round: 1, maximumRounds: 3, message: "AI Desktop 正在当前任务分支执行隔离 Playwright" } };
    fixture.timeline.appendStream(running.taskId, "worker-1", status, fixture.at(4));
    fixture.timeline.appendStream(running.taskId, "worker-1", status, fixture.at(5));
    fixture.timeline.appendStream(running.taskId, "worker-1", { type: "message-completed", turnId: "turn-1", text: "失败原因已定位为测试回调签名不符合 fixture 约定。" }, fixture.at(6));
    const node = fixture.timeline.snapshot(fixture.at(7)).groups[0].nodes.find((candidate) => candidate.kind === "execution" && candidate.status === "current");
    assert.equal(node.content, "失败原因已定位为测试回调签名不符合 fixture 约定。");
    assert.equal(fixture.database.withConnection((connection) => Number(connection.prepare("SELECT COUNT(*) AS count FROM AiDesktopTaskTimelineStream WHERE eventType='managed-execution'").get().count)), 2);
  } finally { fixture.close(); }
});

test("执行与自检流式正文按节点隔离，后续自检不会覆盖执行内容", () => {
  const fixture = createFixture("stream-stage-isolation");
  try {
    const running = task(fixture, 1, false);
    running.evolutionProposalId = null;
    running.evolutionRoundId = null;
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(3), [running]), [running.taskId]);
    fixture.timeline.appendStream(running.taskId, "worker-1", { type: "message-completed", turnId: "execution-turn", text: "执行阶段正文" }, fixture.at(4));
    running.flowEvents.push(flow("verifying", "worker.phase.verifying", "execution", "started", running.executionRecords[0].executor, "开始执行人自检", fixture.at(5)));
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(5), [running]), [running.taskId]);
    fixture.timeline.appendStream(running.taskId, "worker-1", { type: "message-completed", turnId: "verification-turn", text: "自检阶段正文" }, fixture.at(6));
    const nodes = fixture.timeline.snapshot(fixture.at(7)).groups[0].nodes;
    assert.equal(nodes.find((node) => node.kind === "execution").content, "执行阶段正文");
    assert.equal(nodes.find((node) => node.kind === "verification").content, "自检阶段正文");
  } finally { fixture.close(); }
});

test("集成本地修改归属阻塞生成令狐等待节点并同步专题下一步", () => {
  const fixture = createFixture("integration-ownership-blocked");
  try {
    const blocked = task(fixture, 1, true, true);
    blocked.currentHandler = member("linghu-ancestor", "令狐老祖");
    blocked.state = "blocked";
    blocked.blockingReason = "本地修改 collaboration-timeline-event.ts 未登记到任何待集成任务。";
    blocked.integrationFailure = { kind: "local-change-ownership", detail: blocked.blockingReason, conflictFiles: ["collaboration-timeline-event.ts"], baseSha: null, resultSha: null, generation: 1, occurredAt: fixture.at(7) };
    blocked.flowEvents.push(
      flow("verified", "task.code_verified", "execution", "completed", blocked.executionRecords[0].executor, "执行与自检完成", fixture.at(5)),
      flow("collected", "evolution.task_collected", "integration", "completed", member("nangong-wan", "南宫婉"), "南宫婉提交统一测试", fixture.at(6)),
      flow("ownership", "integration.local_change_ownership_blocked", "integration", "waiting", member("linghu-ancestor", "令狐老祖"), blocked.blockingReason, fixture.at(7)),
    );
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(7), [blocked]), [blocked.taskId]);
    const group = fixture.timeline.snapshot(fixture.at(8)).groups[0];
    const ownership = group.nodes.find((node) => node.action === "等待确认本地修改归属");
    assert.equal(group.status, "blocked");
    assert.equal(ownership.actor.displayName, "令狐老祖");
    assert.equal(ownership.status, "waiting");
    assert.match(ownership.content, /未登记到任何待集成任务/);
    assert.equal(group.nextStep, "令狐老祖 · 等待确认本地修改归属");
    assert.match(group.failureNextStep, /恢复条件/);
    assert.equal(group.nodes.find((node) => node.kind === "execution").status, "completed");
  } finally { fixture.close(); }
});

test("恢复请求结束本地修改归属等待节点并追加恢复节点", () => {
  const fixture = createFixture("integration-ownership-recovered");
  try {
    const recovered = task(fixture, 1, true, true);
    recovered.integrationGeneration = 1;
    recovered.currentHandler = member("linghu-ancestor", "令狐老祖");
    recovered.integrationFailure = { kind: "local-change-ownership", detail: "等待确认本地修改归属", conflictFiles: ["collaboration-timeline-event.ts"], baseSha: null, resultSha: null, generation: 1, occurredAt: fixture.at(6) };
    recovered.flowEvents.push(
      flow("ownership", "integration.local_change_ownership_blocked", "integration", "waiting", member("linghu-ancestor", "令狐老祖"), "等待确认本地修改归属", fixture.at(6)),
      flow("recovery", "task.recovery_requested", "recovery", "started", member("linghu-ancestor", "令狐老祖"), "归属已确认，恢复任务", fixture.at(7)),
    );
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(7), [recovered]), [recovered.taskId]);
    const nodes = fixture.timeline.snapshot(fixture.at(8)).groups[0].nodes;
    assert.equal(nodes.find((node) => node.action === "本地修改归属已确认").status, "completed");
    assert.equal(nodes.find((node) => node.action === "正在恢复任务").status, "current");
    assert.equal(nodes.some((node) => node.action === "等待确认本地修改归属" && node.status === "waiting"), false);
  } finally { fixture.close(); }
});

test("恢复复查再次遇到归属阻塞时关闭恢复节点并回到等待", () => {
  const fixture = createFixture("integration-ownership-reblocked");
  try {
    const blocked = task(fixture, 1, true, true);
    blocked.integrationGeneration = 2;
    blocked.state = "blocked";
    blocked.integrationFailure = { kind: "local-change-ownership", detail: "main.ts 仍未提交", conflictFiles: ["main.ts"], baseSha: null, resultSha: null, generation: 2, occurredAt: fixture.at(8) };
    blocked.flowEvents.push(
      flow("recovery-again", "task.recovery_requested", "recovery", "started", member("linghu-ancestor", "令狐老祖"), "复查客户处理结果", fixture.at(7)),
      flow("ownership-again", "integration.local_change_ownership_blocked", "integration", "waiting", member("linghu-ancestor", "令狐老祖"), "main.ts 仍未提交", fixture.at(8)),
    );
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(8), [blocked]), [blocked.taskId]);
    const nodes = fixture.timeline.snapshot(fixture.at(9)).groups[0].nodes;
    assert.equal(nodes.find((node) => node.action === "恢复复查已结束").status, "completed");
    assert.equal(nodes.find((node) => node.action === "等待确认本地修改归属").status, "waiting");
    assert.equal(nodes.some((node) => node.action === "正在恢复任务" && node.status === "current"), false);
  } finally { fixture.close(); }
});

test("统一测试开始后结束等待令狐接手节点", () => {
  const fixture = createFixture("integration-queue-started");
  try {
    const testing = task(fixture, 1, true, true);
    testing.integrationGeneration = 1;
    testing.unifiedTest = { startedAt: fixture.at(7), completedAt: null, status: "running", summary: null };
    testing.flowEvents.push(
      flow("batch", "integration.batch_frozen", "integration", "waiting", member("nangong-wan", "南宫婉"), "等待令狐老祖统一测试", fixture.at(6)),
      flow("test", "unified_test.started", "integration", "started", member("linghu-ancestor", "令狐老祖"), "令狐老祖开始统一测试", fixture.at(7)),
    );
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(7), [testing]), [testing.taskId]);
    const nodes = fixture.timeline.snapshot(fixture.at(8)).groups[0].nodes;
    assert.equal(nodes.find((node) => node.action === "测试批次已就绪").status, "completed");
    assert.equal(nodes.find((node) => node.action === "第 1 次统一测试中").status, "current");
    assert.equal(nodes.some((node) => node.action === "等待令狐老祖统一测试" && node.status === "waiting"), false);
  } finally { fixture.close(); }
});

test("候选分支冲突按测试准备失败投影且三个数据库语义字段不重复", () => {
  const fixture = createFixture("candidate-preparation-failure");
  try {
    const blocked = task(fixture, 1, true, true);
    blocked.integrationGeneration = 1;
    blocked.state = "blocked";
    blocked.currentHandler = member("linghu-ancestor", "令狐老祖");
    blocked.integrationFailure = {
      kind: "candidate-branch-conflict", phase: "preparation",
      summary: "发布候选批次 1 冲突，统一测试尚未启动",
      impact: "候选分支创建阶段被阻断，本批次尚未运行统一测试命令，不能记作测试用例未通过。",
      recoveryAction: "保留既有发布证据，分配新的集成代次后重新准备测试。",
      detail: "发布候选分支 release/0.1.1-rc-g1 已存在，禁止覆盖同一批次证据。",
      conflictFiles: [], baseSha: "base", resultSha: "result", generation: 1, occurredAt: fixture.at(7),
    };
    blocked.flowEvents.push(
      flow("batch", "integration.batch_frozen", "integration", "waiting", member("nangong-wan", "南宫婉"), "等待令狐老祖统一测试", fixture.at(6)),
      flow("prepare-failed", "integration.candidate_preparation_failed", "integration", "failed", member("linghu-ancestor", "令狐老祖"), blocked.integrationFailure.summary, fixture.at(7)),
    );
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(7), [blocked]), [blocked.taskId]);
    const node = fixture.timeline.snapshot(fixture.at(8)).groups[0].nodes.find((candidate) => candidate.action === "统一测试准备失败");
    assert.ok(node);
    assert.match(node.summary, /尚未启动/);
    assert.match(node.content, /不能记作测试用例未通过/);
    assert.match(node.detail, /技术证据：.*release\/0\.1\.1-rc-g1/s);
    assert.match(node.detail, /恢复动作：/);
    assert.equal(new Set([node.summary, node.content, node.detail]).size, 3);
  } finally { fixture.close(); }
});

test("旧版误记为统一测试失败的候选分支冲突追加语义纠正事实", () => {
  const fixture = createFixture("legacy-candidate-failure-correction");
  try {
    const blocked = task(fixture, 1, true, true);
    blocked.integrationGeneration = 1;
    blocked.state = "test-failed";
    blocked.currentHandler = member("linghu-ancestor", "令狐老祖");
    blocked.integrationFailure = {
      kind: "verification",
      detail: "发布候选分支 release/0.1.1-rc-g1 已存在，禁止覆盖同一批次证据。",
      conflictFiles: [], baseSha: "base", resultSha: "result", generation: 1, occurredAt: fixture.at(7),
    };
    blocked.flowEvents.push(flow("legacy-failed", "unified_test.failed", "integration", "failed", member("linghu-ancestor", "令狐老祖"), blocked.integrationFailure.detail, fixture.at(7)));
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(7), [blocked]), [blocked.taskId]);
    const node = fixture.timeline.snapshot(fixture.at(8)).groups[0].nodes.find((candidate) => candidate.action === "统一测试准备失败");
    assert.ok(node);
    assert.equal(new Set([node.summary, node.content, node.detail]).size, 3);
    assert.doesNotMatch(node.content, /^发布候选分支/);
  } finally { fixture.close(); }
});

test("未登记的历史流程事件生成可读兜底节点而非静默丢弃", () => {
  const fixture = createFixture("unknown-flow-fallback");
  try {
    const running = task(fixture, 1, false);
    running.evolutionProposalId = null;
    running.evolutionRoundId = null;
    running.flowEvents = [flow("future", "integration.future_waiting_fact", "integration", "waiting", member("linghu-ancestor", "令狐老祖"), "等待未来版本条件", fixture.at(4))];
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(4), [running]), [running.taskId]);
    const group = fixture.timeline.snapshot(fixture.at(5)).groups[0];
    assert.equal(group.status, "blocked");
    assert.equal(group.nodes[0].action, "等待后续处理");
    assert.match(group.nodes[0].detail, /integration\.future_waiting_fact/);
  } finally { fixture.close(); }
});

test("旧状态反推接口和旧表读取已退役", () => {
  const source = readFileSync(path.join(appRoot, "electron/services/support/capabilities/event-center/internal/timeline/collaboration-timeline.repository.ts"), "utf8");
  assert.doesNotMatch(source, /syncEvolutionState|#appendProposalFacts|#appendTaskFacts/);
  assert.doesNotMatch(source, /AiDesktopTaskCollaboration(?:Topic|Event|Stream)/);
  assert.match(source, /appendBusinessEvent/);
  assert.match(source, /AiDesktopTaskTimelineEvent/);
  assert.match(source, /projectCollaborationFlowEvent/);
  assert.doesNotMatch(source, /function flowFact/);
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
  const eventType = fact.kind === "approval-application" ? "approval.application"
    : fact.kind === "approval-decision" ? "approval.decision"
      : fact.kind === "distribution" ? "task.distribution"
        : fact.status === "completed" ? "approval.supplement_completed" : "approval.supplement_waiting";
  const contentRole = fact.kind === "approval-application" ? "approval-content"
    : fact.kind === "approval-decision" ? "approval-reason"
      : fact.kind === "distribution" ? "task-content" : "analysis-output";
  const detailRole = fact.kind === "approval-application" ? "application-evidence"
    : fact.kind === "approval-decision" ? "approval-scope"
      : fact.kind === "distribution" ? "task-breakdown" : "result-evidence";
  return { eventId, eventType, group: { groupId: "topic:topic-1", topicId: "topic-1", proposalId, title: "修订截图按钮可用态", status, summary: fact.summary, startedAt: fixture.at(1), updatedAt: fixture.at(offset) }, fact: { ...fact, contentRole, detailRole } };
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
test("三次测试两次修复保留顺序且通过后等待健康检查而不是重新分发", () => {
  const fixture = createFixture("round-history");
  try {
    const item = task(fixture, 1, true, true);
    item.flowEvents.push(flow("verified", "task.code_verified", "execution", "completed", item.originalExecutor, "自检完成", fixture.at(5)));
    let offset = 6;
    for (let round = 1; round <= 3; round++) {
      const actor = member("linghu-ancestor", "令狐老祖");
      item.flowEvents.push(flow(`test-${round}`, "unified_test.started", "integration", "started", actor, "测试中", fixture.at(offset++)));
      item.flowEvents.push(flow(`result-${round}`, round === 3 ? "unified_test.passed" : "unified_test.failed", "integration", round === 3 ? "completed" : "failed", actor, round === 3 ? "通过" : "失败", fixture.at(offset++)));
      if (round < 3) for (const [suffix, status] of [["started", "started"], ["investigated", "completed"], ["completed", "completed"]]) item.flowEvents.push(flow(`repair-${round}-${suffix}`, `unified_test.repair_${suffix}`, "recovery", status, actor, suffix, fixture.at(offset++)));
    }
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(offset), [item]), [item.taskId]);
    const group = fixture.timeline.snapshot(fixture.at(offset)).groups[0];
    const tests = group.nodes.filter((node) => node.nodeId.startsWith("test-round:"));
    assert.deepEqual(tests.map((node) => node.action), ["第 1 次统一测试未通过", "第 2 次统一测试未通过", "第 3 次统一测试通过"]);
    assert.equal(group.nodes.filter((node) => node.kind === "repair").length, 2);
    assert.ok(group.nodes.filter((node) => node.eventType.startsWith("unified_test.repair_")).every((node) => node.actor.memberId === "linghu-ancestor" && node.recipients.length === 0));
    assert.match(group.nextStep, /重启健康检查.*韩立验收/);
    assert.doesNotMatch(group.nextStep, /分配执行人/);
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(offset), [item]), [item.taskId]);
    assert.equal(fixture.timeline.snapshot().groups[0].nodes.length, group.nodes.length);
    item.flowEvents.push(flow("healthy", "release.restart_healthy", "integration", "completed", member("linghu-ancestor", "令狐老祖"), "重启健康检查通过", fixture.at(offset + 1)));
    fixture.timeline.appendTaskFlowEvents(collaboration(fixture.at(offset + 1), [item]), [item.taskId]);
    const healthy = fixture.timeline.snapshot().groups[0];
    assert.notEqual(healthy.status, "completed", "健康检查不能冒充韩立验收完成");
    assert.match(healthy.nextStep, /韩立.*验收/);
  } finally { fixture.close(); }
});

function flow(eventId, type, stage, status, actor, summary, occurredAt, error = false) { return { eventId, type, stage, status, actor, summary, occurredAt, error }; }
function collaboration(updatedAt, tasks) { return { version: 1, mode: "collaboration", selectedMemberId: "han-li", members: [], tasks, integrationBatches: [], nextIntegrationGeneration: 1, updatedAt }; }
function createFixture(suffix) {
  const root = mkdtempSync(path.join(controlledTestRoot, `collaboration-timeline-${suffix}-`));
  const sqlRoot = path.join(root, "sql");
  cpSync(path.join(appRoot, "db", "sql"), sqlRoot, { recursive: true });
  const database = SqliteDatabase.open(path.join(root, "events.sqlite3"), sqlRoot, true);
  const timeline = new CollaborationTimelineRepository(database);
  const base = Date.now() + 1_000;
  return { database, timeline, at(offset) { return new Date(base + offset * 1_000).toISOString(); }, append(event) { timeline.appendBusinessEvent(event); }, close() { database.close(); rmSync(root, { recursive: true, force: true }); } };
}
