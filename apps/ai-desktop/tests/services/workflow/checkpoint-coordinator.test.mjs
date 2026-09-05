import assert from "node:assert/strict";
import test from "node:test";
import { CheckpointCoordinator } from "../../../../../build/ai-desktop/electron/electron/services/workflow/internal/checkpoint-coordinator.js";
import { CheckpointHandoffService } from "../../../../../build/ai-desktop/electron/electron/services/workflow/internal/checkpoint-handoff.service.js";
import { AcceptanceHandoffService } from "../../../../../build/ai-desktop/electron/electron/services/workflow/internal/acceptance-handoff.service.js";

// 端口夹具只模拟已发生的任务状态，不调用真实服务、不修改生产运行。
function fixture() {
  const event = { eventId: "issue-1", correlationId: "topic-1", category: "technical-error", flowImpact: "blocked", message: "真实点击被工具拒绝", occurredAt: "2026-09-05T00:00:00Z", payload: { runId: "run-1", proposalId: "proposal-1", phase: "accepting", recoveryPoint: "真实界面验收" } };
  const evolution = { automationRuntime: { status: "idle" }, oneShotRun: { runId: "run-1", proposalId: "proposal-1", status: "blocked" }, topics: [{ topicId: "topic-1", title: "验收", workspaceState: { roots: [] }, locale: "zh-CN" }], proposals: [{ proposalId: "proposal-1", topicId: "topic-1", title: "原验收" }] };
  const collaboration = { tasks: [], members: [] };
  const effects = { submitted: [], resumed: [], handled: [], resolved: [], phases: [] };
  const events = [event];
  const options = { evolution: () => evolution, collaboration: () => collaboration, pending: () => events,
    save: (id, state) => { events.find((item) => item.eventId === id).payload.checkpoint = structuredClone(state); },
    resolve: (id) => effects.resolved.push(id),
    resume: async (id) => { effects.resumed.push(id); return evolution; },
    handleTask: async (...args) => { effects.handled.push(args); },
    submitRepair: (request) => { effects.submitted.push(request); collaboration.tasks.push({ taskId: `repair-${effects.submitted.length}`, state: "executing", snapshot: request }); return collaboration; },
    handoff: { publish: (_event, state, phase) => effects.phases.push(`${state.round}:${phase}`) },
  };
  return { event, events, evolution, collaboration, effects, options, run: () => new CheckpointCoordinator(options).process(events) };
}

test("卡点真实派发、重启去重、返回原点后才允许解除", async () => {
  const f = fixture();
  await f.run(); await f.run();
  assert.equal(f.effects.submitted.length, 1);
  assert.equal(f.effects.submitted[0].preferredExecutorMemberId, "linghu-ancestor");
  assert.equal(f.effects.submitted[0].evolutionProposalId, "proposal-1");
  assert.equal(f.effects.submitted[0].evolutionRoundId, "proposal-1");
  assert.deepEqual(f.effects.resolved, []);
  f.collaboration.tasks[0].state = "integrated";
  f.options.resume = async (id) => { f.effects.resumed.push(id); f.evolution.oneShotRun.status = "running"; return f.evolution; };
  await f.run(); await f.run();
  assert.deepEqual(f.effects.resumed, ["run-1"]);
  assert.deepEqual(f.effects.resolved, []);
  f.evolution.oneShotRun.status = "completed";
  await f.run();
  assert.deepEqual(f.effects.resolved, ["issue-1"]);
  assert.ok(f.effects.phases.includes("1:returned"));
});

test("创建后保存前中断通过原事件轮次标记找回，不重复提交", async () => {
  const f = fixture(); await f.run();
  delete f.event.payload.checkpoint;
  await f.run();
  assert.equal(f.effects.submitted.length, 1);
  assert.equal(f.event.payload.checkpoint.repairTaskId, "repair-1");
});

test("原点恢复异步运行后再次受阻，新增一轮而非重放上一份修复", async () => {
  const f = fixture(); await f.run(); f.collaboration.tasks[0].state = "integrated";
  f.options.resume = async () => { f.evolution.oneShotRun.status = "running"; return f.evolution; };
  await f.run(); f.evolution.oneShotRun.status = "blocked"; await f.run();
  assert.equal(f.effects.submitted.length, 2); assert.equal(f.event.payload.checkpoint.round, 2);
});

test("同一原流程重复异常不各派一份修复", async () => {
  const f = fixture(); f.events.push({ ...structuredClone(f.event), eventId: "issue-2", occurredAt: "2026-09-05T00:00:01Z" });
  await f.run(); await f.run();
  assert.equal(f.effects.submitted.length, 1);
});

test("三轮复验仍受阻停止派发，暂停恢复和重启不能重置上限", async () => {
  const f = fixture();
  for (let round = 1; round <= 3; round++) {
    await f.run(); f.collaboration.tasks.at(-1).state = "integrated"; await f.run();
  }
  assert.equal(f.effects.submitted.length, 3);
  assert.equal(f.event.payload.checkpoint.exhausted, true);
  f.evolution.automationRuntime.status = "paused"; await f.run();
  f.evolution.automationRuntime.status = "idle"; await f.run(); await f.run();
  assert.equal(f.effects.submitted.length, 3);
  assert.equal(f.effects.resumed.length, 3);
  assert.deepEqual(f.effects.resolved, []);
});

test("暂停、业务选择、未知工作区和取消修复不能自动越权", async () => {
  for (const configure of [f => { f.evolution.automationRuntime.status = "paused"; }, f => { f.event.category = "business-exception"; }, f => { f.evolution.topics = []; }]) {
    const f = fixture(); configure(f); await f.run(); assert.equal(f.effects.submitted.length, 0); assert.equal(f.effects.resumed.length, 0);
  }
  const f = fixture(); await f.run(); f.collaboration.tasks[0].state = "cancelled"; await f.run(); await f.run();
  assert.equal(f.effects.submitted.length, 1); assert.equal(f.effects.resumed.length, 0);
});

test("执行人正常自修复不抢占，已确认心跳停滞走原任务恢复", async () => {
  const f = fixture();
  f.collaboration.tasks.push({ taskId: "original", state: "executing", phase: "self-testing", updatedAt: "2026-09-05T00:00:00Z", snapshot: { constraints: [] } });
  f.event.correlationId = "original"; await f.run();
  assert.equal(f.effects.handled.length, 0); assert.equal(f.effects.submitted.length, 0);
  f.event.category = "stalled"; f.event.payload.lastHeartbeatAt = "2026-09-05T00:00:00Z"; await f.run();
  assert.deepEqual(f.effects.handled, [["original", true]]);
  f.collaboration.tasks[0].updatedAt = "2026-09-05T00:01:00Z"; await f.run();
  assert.equal(f.effects.handled.length, 1);
});

test("普通失败和统一测试失败不进入卡点恢复入口", async () => {
  const ordinary = fixture(); ordinary.event.flowImpact = "none"; await ordinary.run();
  assert.equal(ordinary.effects.submitted.length, 0);
  const unified = fixture();
  unified.collaboration.tasks.push({ taskId: "original", state: "test-failed", phase: "unified-testing", updatedAt: "2026-09-05T00:00:00Z", snapshot: { constraints: [] } });
  unified.event.correlationId = "original"; unified.event.payload.taskId = "original"; await unified.run();
  assert.equal(unified.effects.handled.length, 0); assert.equal(unified.effects.submitted.length, 0);
});

test("派发失败保留原卡点，下一次继续，不报告完成", async () => {
  const f = fixture(); const submit = f.options.submitRepair;
  f.options.submitRepair = () => { throw new Error("runtime offline"); };
  await f.run(); assert.equal(f.event.payload.checkpoint.phase, "waiting");
  f.options.submitRepair = submit; await f.run();
  assert.equal(f.effects.submitted.length, 1); assert.equal(f.effects.resolved.length, 0);
});

function memoryFixture() {
  const messages = new Map(); const events = new Map();
  const memory = { readPersonaConversation: (owner) => ({ conversationId: `${owner}-conversation` }), appendPersonaInternalMessage: (message) => { if (!messages.has(message.messageId)) messages.set(message.messageId, message); return {}; } };
  return { messages, events, memory };
}

test("卡点双方人物会话和令狐时间线幂等留痕，不覆盖专题名和上一轮", () => {
  const f = memoryFixture();
  const service = new CheckpointHandoffService({ ...f, publish: event => f.events.set(event.eventId, event), changed: () => {}, name: id => id, topic: () => ({ title: "原任务", createdAt: "2026-09-05T00:00:00Z", completed: false }) });
  const state = { round: 1, sourceMemberId: "han-li", conversations: {}, topicId: "topic-1" };
  for (let repeat = 0; repeat < 2; repeat++) service.publish(fixture().event, state, "received", "接收事实");
  assert.equal(f.messages.size, 2); assert.equal(f.events.size, 1);
  assert.equal([...f.events.values()][0].group.title, "原任务");
  assert.match([...f.events.values()][0].fact.content, /发生位置：accepting/);
  assert.match([...f.events.values()][0].fact.content, /遇到的问题：真实点击被工具拒绝/);
  assert.match([...f.events.values()][0].fact.detail, /原提案：proposal-1/);
  state.round = 2; service.publish(fixture().event, state, "received", "第二轮");
  assert.equal(f.messages.size, 4); assert.equal(f.events.size, 2);
});

test("验收每轮独立身份，结果返回韩立及南宫婉", () => {
  const f = memoryFixture();
  const service = new AcceptanceHandoffService({ memory: f.memory, store: { state: () => ({ topics: [{ topicId: "topic-1", title: "原任务" }] }) }, readHanliConversationId: () => "han-li-conversation", recordTimelineEvent: event => f.events.set(event.eventId, event) });
  const proposal = { topicId: "topic-1", proposalId: "proposal-1" };
  for (const attempt of ["first", "second"]) {
    service.publish(proposal, "received", "南宫婉提交", attempt);
    service.publish(proposal, "failed", "实际受阻", attempt);
  }
  assert.equal(f.events.size, 4);
  assert.equal([...f.messages.values()].filter(message => message.ownerPersonaId === "nangong-wan").length, 4);
  assert.equal([...f.messages.values()].filter(message => message.messageId.startsWith("hanli-result:")).length, 2);
});
