import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";

// 本测试验证当前工作树的工作流源码；禁止构建时不能把缺失产物误报为协调器失败。
async function loadWorkflowSource(entryPoint) {
  const result = await build({
    entryPoints: [entryPoint],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "es2022",
    write: false,
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

const { CheckpointCoordinator } = await loadWorkflowSource("electron/services/workflow/internal/checkpoint/checkpoint-coordinator.ts");
const { createOneShotFailureFingerprint } = await loadWorkflowSource("electron/services/workflow/internal/evolution/one-shot-failure-identity.ts");
const { selectCurrentAcceptanceFailure, selectRepeatedAcceptanceFailures } = await loadWorkflowSource("electron/services/workflow/internal/checkpoint/checkpoint-failure-selection.ts");
const { CheckpointHandoffService } = await loadWorkflowSource("electron/services/workflow/internal/checkpoint/checkpoint-handoff.service.ts");
const { AcceptanceHandoffService } = await loadWorkflowSource("electron/services/workflow/internal/acceptance/acceptance-handoff.service.ts");
const { SqliteCollaborationTimelineDao } = await loadWorkflowSource("electron/dao/timeline/internal/collaboration-timeline.dao.ts");

test("真实验收每轮使用独立故障身份，普通轮询仍保持稳定去重", () => {
  const base = { runId: "run-1", proposalId: "proposal-1" };
  const first = createOneShotFailureFingerprint({ ...base, operation: "run_hanli_result_acceptance", occurrenceId: "attempt-1" });
  const second = createOneShotFailureFingerprint({ ...base, operation: "run_hanli_result_acceptance", occurrenceId: "attempt-2" });
  assert.notEqual(first, second);
  assert.throws(() => createOneShotFailureFingerprint({ ...base, operation: "run_hanli_result_acceptance" }), /缺少本轮发生身份/);
  assert.equal(
    createOneShotFailureFingerprint({ ...base, operation: "plan_and_dispatch_one_shot" }),
    createOneShotFailureFingerprint({ ...base, operation: "plan_and_dispatch_one_shot" }),
  );
});

test("旧主卡点只保存恢复关系，修复事实选择本轮最新验收失败", () => {
  const oldPrimary = {
    eventId: "old-json", occurredAt: "2026-09-14T01:00:00Z", flowImpact: "blocked", message: "旧 JSON 解析失败",
    payload: { proposalId: "proposal-1", operation: "plan_and_dispatch_one_shot" },
  };
  const currentAcceptance = {
    eventId: "current-acceptance", occurredAt: "2026-09-14T02:00:00Z", flowImpact: "blocked", message: "本轮验收条件编号不一致",
    payload: { proposalId: "proposal-1", operation: "run_hanli_result_acceptance" },
  };
  const unrelated = {
    eventId: "other-proposal", occurredAt: "2026-09-14T03:00:00Z", flowImpact: "blocked", message: "其他提案验收失败",
    payload: { proposalId: "proposal-2", operation: "run_hanli_result_acceptance" },
  };
  assert.equal(selectCurrentAcceptanceFailure(oldPrimary, [oldPrimary, currentAcceptance, unrelated], "proposal-1"), currentAcceptance);
});

test("两次韩立验收失败只按同一提案的不同真实运行计数", () => {
  const failure = (eventId, acceptanceRunId, proposalId = "proposal-1") => ({
    eventId, occurredAt: `2026-09-14T0${eventId.length}:00:00Z`, flowImpact: "blocked", message: `验收失败 ${eventId}`,
    payload: { proposalId, operation: "repair_failed_hanli_acceptance", acceptanceRunId,
      acceptanceFailureKind: "product-defect", acceptanceFailureScope: { decision: "within-original-acceptance", defects: [{ checkId: "criterion-1" }] } },
  });
  const first = failure("a", "accept-1");
  const replay = failure("b", "accept-1");
  const second = failure("cc", "accept-2");
  const unrelated = failure("ddd", "accept-3", "proposal-other");
  assert.deepEqual(selectRepeatedAcceptanceFailures([first, replay, second, unrelated], "proposal-1"), [replay, second]);
  assert.equal(selectRepeatedAcceptanceFailures([first, replay, unrelated], "proposal-1").length, 1);
  assert.equal(selectRepeatedAcceptanceFailures([{ ...second, payload: { ...second.payload, acceptanceFailureScope: { decision: "outside-original-acceptance" } } }], "proposal-1").length, 0);
  const latestUnverified = { ...failure("dddd", "accept-4"), payload: { ...second.payload,
    acceptanceRunId: "accept-4", acceptanceFailureScope: { decision: "outside-original-acceptance" } } };
  assert.deepEqual(selectRepeatedAcceptanceFailures([first, second, latestUnverified], "proposal-1"), []);
});

// 端口夹具只模拟已发生的任务状态，不调用真实服务、不修改生产运行。
function fixture() {
  const event = { eventId: "issue-1", correlationId: "topic-1", category: "technical-error", flowImpact: "blocked", message: "真实点击被工具拒绝", occurredAt: "2026-09-05T00:00:00Z", payload: { runId: "run-1", proposalId: "proposal-1", phase: "accepting", recoveryPoint: "真实界面验收", acceptanceFailureKind: "product-defect" } };
  const evolution = { automationSettings: { automaticCustodyEnabled: false }, automationRuntime: { status: "idle" }, oneShotRun: { runId: "run-1", proposalId: "proposal-1", status: "blocked" }, topics: [{ topicId: "topic-1", title: "验收", workspaceState: { roots: [] }, locale: "zh-CN" }], proposals: [{ proposalId: "proposal-1", topicId: "topic-1", title: "原验收" }] };
  const collaboration = { tasks: [], members: [] };
  const effects = { submitted: [], resumed: [], handled: [], resolved: [], phases: [], technicalRecoveries: [] };
  const events = [event];
  const options = { evolution: () => evolution, collaboration: () => collaboration, pending: () => events,
    save: (id, state) => { events.find((item) => item.eventId === id).payload.checkpoint = structuredClone(state); },
    resolve: (id) => effects.resolved.push(id),
    areTechnicalRecoveryEventsResolved: (ids) => ids.length > 0 && ids.every((id) => effects.resolved.includes(id)),
    resume: async (id) => { effects.resumed.push(id); return evolution; },
    handleTask: async (...args) => { effects.handled.push(args); },
    refreshRepair: async (id, request) => { effects.refreshed ||= []; effects.refreshed.push({ id, request }); collaboration.tasks.find(task => task.taskId === id).snapshot = request; },
    submitRepair: (request) => { effects.submitted.push(request); collaboration.tasks.push({ taskId: `repair-${effects.submitted.length}`, state: "executing", snapshot: request }); return collaboration; },
    recordTechnicalRecovery: (input) => {
      const recovery = structuredClone(input);
      effects.technicalRecoveries.push(recovery);
      evolution.technicalRecovery = { ...recovery, updatedAt: "2026-09-05T00:00:00Z" };
    },
    handoff: { publish: (_event, state, phase) => effects.phases.push(`${state.round}:${phase}`) },
  };
  return { event, events, evolution, collaboration, effects, options, run: () => new CheckpointCoordinator(options).process(events) };
}

test("旧业务选择卡点不抢占后来真实验收故障的自动修复主记录", async () => {
  const f = fixture();
  f.event.payload.operation = "run_hanli_result_acceptance";
  f.event.payload.acceptanceFailureKind = "acceptance-capability-blocked";
  const business = {
    ...structuredClone(f.event), eventId: "old-business-choice", category: "business-exception",
    occurredAt: "2026-09-04T00:00:00Z", message: "旧人工范围选择等待确认",
    payload: { runId: "run-1", proposalId: "proposal-1", phase: "accepting", operation: "review_acceptance_failure_scope" },
  };
  f.events.unshift(business);
  await f.run();
  assert.equal(f.effects.submitted.length, 1);
  assert.equal(f.event.payload.checkpoint.repairTaskId, "repair-1");
  assert.equal(business.payload.checkpoint.repairTaskId, null);
});

test("正式业务验收前提未出现时保留卡点而不派发令狐源码修复", async () => {
  const f = fixture();
  f.event.payload.operation = "run_hanli_result_acceptance";
  f.event.payload.acceptanceFailureKind = "acceptance-precondition-unavailable";
  f.event.message = "当前正式页面没有归属阻塞场景";
  f.evolution.proposals[0].acceptanceCriteria = ["归属阻塞时的真实页面状态"];
  await f.run();
  assert.equal(f.effects.submitted.length, 0);
  assert.equal(f.event.payload.checkpoint.phase, "waiting");
  assert.match(f.event.payload.checkpoint.latestProgress, /不派发源码修复/);
  assert.equal(f.effects.technicalRecoveries.at(-1)?.handler, "monitor");
  assert.match(f.effects.technicalRecoveries.at(-1)?.nextAction || "", /等待正式业务自然出现原验收前提/);
});

test("卡点真实派发、重启去重、返回原点后才允许解除", async () => {
  const f = fixture();
  await f.run(); await f.run();
  assert.equal(f.effects.submitted.length, 1);
  assert.equal(f.effects.submitted[0].preferredExecutorMemberId, "linghu-ancestor");
  assert.equal(f.effects.submitted[0].initiatorMemberId, "han-li");
  assert.equal(f.effects.submitted[0].evolutionProposalId, "proposal-1");
  assert.equal(f.effects.submitted[0].evolutionRoundId, "proposal-1");
  const recovery = f.effects.technicalRecoveries.at(-1);
  assert.deepEqual(recovery.acceptanceConditionIds, []);
  assert.equal(recovery.handoffStatus, "basis-unverified");
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
  assert.equal(f.evolution.technicalRecovery.active, false);
  assert.deepEqual(f.evolution.technicalRecovery.evidenceReferences, ["issue-1"]);
  assert.equal(f.evolution.technicalRecovery.nextAction, "卡点已解除，继续当前专题验收。");
});

test("同一卡点监督轮询不重复提交技术恢复投影", async () => {
  const f = fixture();
  await f.run();
  const committed = f.effects.technicalRecoveries.length;
  const occurrence = structuredClone(f.evolution.technicalRecovery.occurrences);
  await f.run();
  assert.equal(f.effects.technicalRecoveries.length, committed);
  assert.deepEqual(f.evolution.technicalRecovery.occurrences, occurrence);
});

test("历史卡点重放不覆盖较新的当前技术恢复投影", async () => {
  const f = fixture();
  f.evolution.technicalRecovery = {
    issueId: "technical-recovery:newer", topicId: "topic-1", proposalId: "proposal-1",
    acceptanceConditionIds: ["criterion-new"], failureCategory: "technical-runtime",
    evidenceReferences: ["newer-event"], occurrences: [{ runId: "run-1", taskId: "newer-task",
      occurrenceId: "newer-event", reason: "较新的卡点", occurredAt: "2026-09-05T01:00:00Z" }],
    attemptCount: 1, handler: "system", handoffStatus: "pending", failureReason: null,
    nextAction: "等待较新卡点恢复。", active: true, updatedAt: "2026-09-05T01:00:00Z",
  };
  await f.run();
  assert.equal(f.evolution.technicalRecovery.issueId, "technical-recovery:newer");
  assert.equal(f.effects.technicalRecoveries.length, 0);
});

test("同一问题的旧卡点只补充证据而不覆盖较新恢复状态", async () => {
  const f = fixture();
  f.evolution.proposals[0].acceptanceCriteria = ["恢复后继续原流程"];
  f.evolution.automationRuntime.status = "paused";
  await f.run();
  const issueId = f.evolution.technicalRecovery.issueId;
  f.evolution.technicalRecovery = {
    ...f.evolution.technicalRecovery,
    evidenceReferences: ["newer-event"],
    occurrences: [{ runId: "run-1", taskId: "newer-task", occurrenceId: "newer-event",
      reason: "较新的卡点正在恢复", occurredAt: "2026-09-05T01:00:00Z" }],
    handler: "system", handoffStatus: "pending", failureReason: null,
    nextAction: "等待较新卡点恢复。", updatedAt: "2026-09-05T01:00:00Z",
  };
  f.effects.technicalRecoveries.length = 0;

  await f.run();

  assert.equal(f.evolution.technicalRecovery.issueId, issueId);
  assert.equal(f.evolution.technicalRecovery.handoffStatus, "pending");
  assert.equal(f.evolution.technicalRecovery.failureReason, null);
  assert.equal(f.evolution.technicalRecovery.nextAction, "等待较新卡点恢复。");
  assert.deepEqual(f.evolution.technicalRecovery.evidenceReferences, ["newer-event", "issue-1"]);
  assert.deepEqual(f.evolution.technicalRecovery.occurrences.map((item) => item.occurrenceId), ["issue-1", "newer-event"]);
});

test("重启后仅在全部持久卡点事件已解除时收口技术恢复投影", async () => {
  const f = fixture();
  await f.run();
  const original = structuredClone(f.evolution.technicalRecovery);
  f.effects.resolved.push("issue-1");
  await new CheckpointCoordinator(f.options).process([]);
  assert.equal(f.evolution.technicalRecovery.active, false);
  assert.deepEqual(f.evolution.technicalRecovery.evidenceReferences, original.evidenceReferences);

  f.evolution.technicalRecovery = { ...original, evidenceReferences: ["issue-1", "missing-event"] };
  await new CheckpointCoordinator(f.options).process([]);
  assert.equal(f.evolution.technicalRecovery.active, true);
});

test("韩立验收卡点不因原开发任务已集成而误报解除", async () => {
  // 真实场景中代码任务先完成集成，韩立随后才会检查正式应用。
  const f = fixture();
  f.collaboration.tasks.push({
    taskId: "original", state: "integrated", phase: "integrated", updatedAt: "2026-09-05T00:00:00Z",
    executorMemberId: "mo-caihuan", evolutionProposalId: "proposal-1", snapshot: { constraints: [] },
  });
  f.event.payload.operation = "run_hanli_result_acceptance";
  f.evolution.proposals[0].distributedTaskIds = ["original"];
  await f.run();
  // 开发任务的 integrated 不能冒充韩立复验通过，令狐必须收到真实调查修复任务。
  assert.deepEqual(f.effects.resolved, []);
  assert.equal(f.effects.submitted.length, 1);
  assert.equal("materials" in f.effects.submitted[0], false);
  assert.equal(f.event.payload.checkpoint.repairTaskId, "repair-1");
  assert.equal(f.event.payload.checkpoint.phase, "repairing");
});

test("韩立范围内验收失败建立令狐新修复任务并明确完整测试复验链", async () => {
  const f = fixture();
  f.event.payload.operation = "repair_failed_hanli_acceptance";
  f.event.payload.acceptanceFailureKind = "product-defect";
  f.event.payload.acceptanceFailureScope = {
    decision: "within-original-acceptance",
    summary: "验收条件 1：右侧边缘可以拖动加宽；实际结果：拖动无效；期望结果：窗口加宽",
    reason: "失败逐项对应原验收条件",
    defects: [{ checkId: "criterion-1", target: "验收条件 1：右侧边缘可以拖动加宽", actual: "拖动无效", expected: "窗口加宽", reproductionOperations: [], screenshotAttachmentIds: ["shot-1"] }],
  };
  await f.run();
  assert.equal(f.effects.submitted.length, 1);
  const repair = f.effects.submitted[0];
  assert.equal(repair.preferredExecutorMemberId, "linghu-ancestor");
  assert.match(repair.problemStatement, /原专题“验收”/);
  assert.match(repair.confirmedIntent, /代码测试、统一测试、运行版本更新和重启健康检查/);
  assert.match(repair.confirmedIntent, /韩立结果验收/);
  assert.match(repair.confirmedIntent, /故障分类：product-defect/);
  assert.match(repair.confirmedIntent, /相同条件证明原现象已经改变/);
  assert.ok(repair.constraints.some((item) => item.includes("不得仅修改韩立验收工具")));
  assert.ok(repair.constraints.some((item) => item.includes("修复方向错误")));
  assert.ok(repair.constraints.some((item) => item.includes("acceptanceFailureScope")));
  assert.ok(repair.acceptanceCriteria.some((item) => item.includes("自动返回同一提案")));
  const recovery = f.effects.technicalRecoveries.at(-1);
  assert.equal(recovery.topicId, "topic-1");
  assert.equal(recovery.proposalId, "proposal-1");
  assert.deepEqual(recovery.acceptanceConditionIds, ["criterion-1"]);
  assert.equal(recovery.handoffStatus, "handed-off");
});

test("韩立两次真实验收未通过时令狐同时核查验收误判与产品缺陷", async () => {
  const f = fixture();
  const failureScope = { decision: "within-original-acceptance", defects: [{ checkId: "criterion-1" }] };
  Object.assign(f.event.payload, { operation: "repair_failed_hanli_acceptance", acceptanceRunId: "accept-1",
    acceptanceFailureKind: "product-defect", acceptanceFailureScope: failureScope });
  f.events.push({ ...structuredClone(f.event), eventId: "issue-2", occurredAt: "2026-09-05T00:01:00Z",
    message: "第二次同条件验收失败", payload: { ...structuredClone(f.event.payload), acceptanceRunId: "accept-2" } });
  await f.run();
  assert.equal(f.effects.submitted.length, 1);
  const repair = f.effects.submitted[0];
  assert.match(repair.confirmedIntent, /韩立已有两次不同验收运行未通过/);
  assert.match(repair.confirmedIntent, /accept-1/);
  assert.match(repair.confirmedIntent, /accept-2/);
  assert.match(repair.confirmedIntent, /验收实现或提示词错误/);
  assert.ok(repair.constraints.some((item) => item.includes("原条件与门禁保持不变")));
  assert.ok(repair.acceptanceCriteria.some((item) => item.includes("两次验收失败")));
});

test("韩立验收能力受阻进入令狐修复链并保留故障分类边界", async () => {
  const f = fixture();
  f.event.payload.operation = "run_hanli_result_acceptance";
  f.event.payload.acceptanceFailureKind = "acceptance-capability-blocked";
  await f.run(); await f.run();
  assert.equal(f.effects.submitted.length, 1);
  assert.equal(f.effects.submitted[0].preferredExecutorMemberId, "linghu-ancestor");
  assert.match(f.effects.submitted[0].confirmedIntent, /故障分类：acceptance-capability-blocked/);
  assert.ok(f.effects.submitted[0].constraints.some((item) => item.includes("只能在已批准范围内修复现有验收能力")));
  assert.equal(f.event.payload.checkpoint.phase, "repairing");
  assert.equal(f.event.payload.checkpoint.repairTaskId, "repair-1");
});

test("缺少验收失败分类时不猜测产品缺陷或交令狐", async () => {
  const f = fixture();
  f.event.payload.operation = "run_hanli_result_acceptance";
  delete f.event.payload.acceptanceFailureKind;
  await f.run();
  assert.equal(f.effects.submitted.length, 0);
  assert.deepEqual(f.effects.phases, []);
  assert.equal(f.event.payload.checkpoint.phase, "waiting");
});

test("验收能力受阻在原流程完成后解除时不补写令狐节点", async () => {
  const f = fixture();
  f.event.payload.operation = "run_hanli_result_acceptance";
  f.event.payload.acceptanceFailureKind = "acceptance-capability-blocked";
  f.evolution.oneShotRun.status = "completed";
  await f.run();
  assert.equal(f.effects.submitted.length, 0);
  assert.deepEqual(f.effects.phases, []);
  assert.deepEqual(f.effects.resolved, ["issue-1"]);
});

test("韩立审批前的结构化结果异常保留历史，不派发令狐修复", async () => {
  const f = fixture();
  f.event.payload.operation = "review_one_shot_proposal";
  f.event.payload.phase = "approving";
  f.event.payload.recoveryPoint = "正在审批提案";
  await f.run();
  assert.equal(f.effects.submitted.length, 0);
  assert.equal(f.event.payload.checkpoint.phase, "waiting");
  assert.match(f.event.payload.checkpoint.latestProgress, /不创建令狐修复任务/);
});

test("非验收任务完成集成后仍可直接解除原执行卡点", async () => {
  // 普通执行阶段卡点仍以原任务完成集成为解除依据，避免影响已有恢复路径。
  const f = fixture();
  f.event.payload.phase = "executing";
  f.collaboration.tasks.push({
    taskId: "original", state: "integrated", phase: "integrated", updatedAt: "2026-09-05T00:00:00Z",
    executorMemberId: "mo-caihuan", evolutionProposalId: "proposal-1", snapshot: { constraints: [] },
  });
  f.event.correlationId = "original";
  await f.run();
  assert.deepEqual(f.effects.resolved, ["issue-1"]);
  assert.equal(f.effects.submitted.length, 0);
});

test("韩立验收原流程真正完成后才解除卡点", async () => {
  // 即使关联开发任务已经集成，权威的一次性运行 completed 仍可正常结束验收卡点。
  const f = fixture();
  f.evolution.oneShotRun.status = "completed";
  f.collaboration.tasks.push({
    taskId: "original", state: "integrated", phase: "integrated", updatedAt: "2026-09-05T00:00:00Z",
    executorMemberId: "mo-caihuan", evolutionProposalId: "proposal-1", snapshot: { constraints: [] },
  });
  f.event.correlationId = "original";
  await f.run();
  assert.deepEqual(f.effects.resolved, ["issue-1"]);
  assert.equal(f.effects.submitted.length, 0);
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

test("旧卡点三轮耗尽后新验收事实建立独立修复任务", async () => {
  const f = fixture();
  for (let round = 1; round <= 3; round++) {
    await f.run();
    f.collaboration.tasks.at(-1).state = "integrated";
    await f.run();
  }
  assert.equal(f.event.payload.checkpoint.exhausted, true);
  const newFailure = {
    ...structuredClone(f.event),
    eventId: "issue-new-evidence",
    occurredAt: "2026-09-05T01:00:00Z",
    message: "正式页面显示南宫婉仍为空闲",
    payload: {
      ...structuredClone(f.event.payload),
      acceptanceRunId: "accept-new-evidence",
      checkpoint: undefined,
    },
  };
  f.events.push(newFailure);
  await f.run();
  assert.equal(f.effects.submitted.length, 4);
  assert.equal(newFailure.payload.checkpoint.repairTaskId, "repair-4");
  assert.equal(newFailure.payload.checkpoint.phase, "repairing");
  assert.ok(f.effects.submitted[3].constraints.some((item) => item === "卡点标识：run-1:proposal:proposal-1:round:1:event:issue-new-evidence"));
  assert.match(f.effects.submitted[3].problemStatement, /南宫婉仍为空闲/);
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

test("自动存活心跳持续刷新也不能掩盖已确认的协议进展停滞", async () => {
  const f = fixture();
  const progressAt = "2026-09-05T00:00:00Z";
  f.collaboration.members.push({ memberId: "linghu-ancestor", lastHeartbeatAt: "2026-09-05T00:20:00Z", lastProtocolProgressAt: progressAt });
  f.collaboration.tasks.push({ taskId: "original", state: "executing", phase: "implementing", executorMemberId: "linghu-ancestor",
    assignmentId: "assignment-1", startedAt: progressAt, updatedAt: "2026-09-05T00:20:00Z",
    executionRecords: [{ assignmentId: "assignment-1", assignedAt: progressAt, executionStartedAt: progressAt }], snapshot: { constraints: [] } });
  f.event.correlationId = "original";
  f.event.category = "stalled";
  f.event.payload.lastHeartbeatAt = progressAt;
  await f.run();
  assert.deepEqual(f.effects.handled, [["original", true]]);
  f.collaboration.members[0].lastProtocolProgressAt = "2026-09-05T00:21:00Z";
  await f.run();
  assert.equal(f.effects.handled.length, 1);
});

test("本地修改归属卡点先交令狐调查，不再提前转成人工等待", async () => {
  const f = fixture();
  f.collaboration.tasks.push({
    taskId: "original", state: "blocked", phase: null, updatedAt: "2026-09-05T00:00:00Z",
    executorMemberId: "mo-caihuan", integrationFailure: {
      kind: "local-change-ownership", workspaceRoot: "/workspace/SELPLAT",
      detail: "main.ts 未登记", conflictFiles: ["apps/ai-desktop/electron/main.ts"],
    }, snapshot: { constraints: [] },
  });
  f.event.correlationId = "original";
  f.event.payload.taskId = "original";
  await f.run();
  assert.deepEqual(f.effects.handled, [["original", false]]);
  assert.equal(f.event.payload.checkpoint.phase, "repairing");
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

test("卡点只在原处理人与令狐之间幂等留痕，不固定经过南宫婉", async () => {
  const f = memoryFixture();
  const service = new CheckpointHandoffService({ ...f, publish: event => f.events.set(event.eventId, event), changed: () => {}, name: id => id, topic: () => ({ title: "原任务", createdAt: "2026-09-05T00:00:00Z", completed: false }) });
  const state = { round: 1, sourceMemberId: "han-li", conversations: {}, topicId: "topic-1" };
  for (let repeat = 0; repeat < 2; repeat++) service.publish(fixture().event, state, "received", "接收事实");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.messages.size, 1); assert.equal(f.events.size, 1);
  assert.deepEqual([...f.messages.values()].map((message) => message.ownerPersonaId), ["han-li"]);
  assert.equal([...f.events.values()][0].group.title, "原任务");
  assert.equal([...f.events.values()][0].fact.content, "第 1 轮卡点处理 · 令狐已接收卡点");
  assert.match([...f.events.values()][0].fact.detail, /发生位置：accepting/);
  assert.match([...f.events.values()][0].fact.detail, /遇到的问题：真实点击被工具拒绝/);
  assert.match([...f.events.values()][0].fact.detail, /当前进展：接收事实/);
  assert.match([...f.events.values()][0].fact.detail, /原提案：proposal-1/);
  state.round = 2; service.publish(fixture().event, state, "received", "第二轮");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.messages.size, 2); assert.equal(f.events.size, 2);
});

test("协调器把同轮多异常收口为一个完成事实，重放稳定且新轮次独立追加", async () => {
  const connection = new DatabaseSync(":memory:", { enableForeignKeyConstraints: true });
  connection.exec(readFileSync(new URL("../../../db/sql/schema-AiDesktopTaskTimelineTopic.sql", import.meta.url), "utf8"));
  connection.exec(readFileSync(new URL("../../../db/sql/schema-AiDesktopTaskTimelineEvent.sql", import.meta.url), "utf8"));
  connection.exec(readFileSync(new URL("../../../db/sql/schema-AiDesktopTaskTimelineStream.sql", import.meta.url), "utf8"));
  // 专题快照会读取同专题完成归档；夹具必须声明 DAO 的这项只读持久化依赖。
  connection.exec(`CREATE TABLE AiDesktopEvolutionArchiveRecord (
    recordId TEXT PRIMARY KEY,
    topicId TEXT,
    proposalId TEXT,
    taskId TEXT,
    sequenceNumber INTEGER NOT NULL,
    eventType TEXT NOT NULL,
    originalPayloadJson TEXT NOT NULL,
    occurredAt TEXT NOT NULL
  ) STRICT`);
  // 时间线任务卡会读取正式任务表的标题；夹具只建本用例实际消费的列。
  connection.exec("CREATE TABLE AiDesktopTaskExecution (taskId TEXT PRIMARY KEY, title TEXT NOT NULL)");
  connection.prepare("INSERT INTO AiDesktopTaskExecution (taskId, title) VALUES ($taskId, $title)")
    .run({ $taskId: "original-task", $title: "原任务" });
  const database = {
    // 本测试仅验证仓库的同步业务事实写入，不开启额外运行时或构建产物。
    transaction(operation) { return operation(connection); },
    withConnection(operation) { return operation(connection); },
  };
  const timeline = new SqliteCollaborationTimelineDao(database);
  const resolved = [];
  const originalTask = {
    taskId: "original-task", state: "integrated", phase: "integrated", updatedAt: "2026-09-14T00:00:00.000Z",
    executorMemberId: "mo-caihuan", evolutionProposalId: "proposal-1", snapshot: { constraints: [] },
  };
  const event = (eventId, message, checkpoint) => ({
    eventId, correlationId: "original-task", category: "technical-error", flowImpact: "blocked", message,
    occurredAt: "2026-09-14T00:00:00.000Z", payload: {
      taskId: "original-task", runId: "run-1", proposalId: "proposal-1", phase: "implementing", recoveryPoint: "原任务验证",
      ...(checkpoint ? { checkpoint } : {}),
    },
  });
  const roundOneCheckpoint = (issue, investigation, repairResult, testResult) => ({
    round: 1, phase: "returned", repairTaskId: "repair-1", runId: "run-1", proposalId: "proposal-1", topicId: "topic-1",
    taskId: "original-task", sourceMemberId: "mo-caihuan", conversations: {}, sourcePhase: "implementing", recoveryPoint: "原任务验证",
    issue, blockedImpact: "原流程尚不能继续完成专题。", repairGoal: "回到原节点复验。", investigation, repairResult, testResult,
    latestProgress: "修复结果已返回，等待原任务验证。",
  });
  const events = [
    event("issue-first", "首个异常已解除", roundOneCheckpoint("首个异常已解除", "第一项调查", "第一项修复", "第一项验证")),
    event("issue-second", "同轮第二个异常已解除", roundOneCheckpoint("同轮第二个异常已解除", "第二项调查", "第二项修复", "第二项验证")),
  ];
  const evolution = {
    automationSettings: { automaticCustodyEnabled: false }, automationRuntime: { status: "idle" },
    oneShotRun: { runId: "run-1", proposalId: "proposal-1", status: "completed" },
    topics: [{ topicId: "topic-1", title: "原专题", workspaceState: { roots: [] }, locale: "zh-CN" }],
    proposals: [{ proposalId: "proposal-1", topicId: "topic-1", title: "原提案", distributedTaskIds: ["original-task"] }],
  };
  const collaboration = { tasks: [originalTask], members: [] };
  const coordinator = new CheckpointCoordinator({
    evolution: () => evolution,
    collaboration: () => collaboration,
    pending: () => events,
    save: (eventId, state) => { events.find((item) => item.eventId === eventId).payload.checkpoint = structuredClone(state); },
    resolve: (eventId) => resolved.push(eventId),
    areTechnicalRecoveryEventsResolved: (ids) => ids.length > 0 && ids.every((id) => resolved.includes(id)),
    resume: async () => evolution,
    handleTask: async () => {},
    submitRepair: () => collaboration,
    recordTechnicalRecovery: (input) => {
      evolution.technicalRecovery = { ...structuredClone(input), updatedAt: "2026-09-14T00:00:00.000Z" };
    },
    handoff: new CheckpointHandoffService({
      memory: null,
      publish: (timelineEvent) => { timeline.appendBusinessEvent(timelineEvent); },
      changed: () => {},
      name: (memberId) => ({ "mo-caihuan": "墨彩环", "linghu-ancestor": "令狐老祖" })[memberId] || memberId,
      topic: () => ({ title: "原专题", createdAt: "2026-09-14T00:00:00.000Z", completed: false }),
    }),
  });
  try {
    await coordinator.process(events);
    const completed = () => timeline.snapshot().groups.flatMap((group) => group.nodes)
      .filter((node) => node.action.includes("原流程已验证卡点解除"));
    assert.equal(completed().length, 1);
    assert.equal(completed()[0].nodeId, "checkpoint-resolution:task:original-task:round:1");
    assert.match(completed()[0].detail, /issue-first：首个异常已解除/);
    assert.match(completed()[0].detail, /issue-second：同轮第二个异常已解除/);
    assert.match(completed()[0].detail, /调查结论：第一项调查/);
    assert.match(completed()[0].detail, /修复结果：第二项修复/);
    assert.match(completed()[0].detail, /测试结果：第二项验证/);
    assert.deepEqual(resolved, ["issue-first", "issue-second"]);

    await coordinator.process(events);
    assert.equal(completed().length, 1, "重放只能复用规范完成事实");

    events.push(event("issue-next-round", "新恢复轮次异常已解除", {
      round: 2, phase: "returned", repairTaskId: "repair-2", runId: "run-1", proposalId: "proposal-1", topicId: "topic-1",
      taskId: "original-task", sourceMemberId: "mo-caihuan", conversations: {}, sourcePhase: "implementing", recoveryPoint: "原任务验证",
      issue: "新恢复轮次异常已解除", blockedImpact: "原流程尚不能继续完成专题。", repairGoal: "回到原节点复验。",
    }));
    await coordinator.process(events);
    assert.deepEqual(completed().map((node) => node.nodeId), [
      "checkpoint-resolution:task:original-task:round:1",
      "checkpoint-resolution:task:original-task:round:2",
    ]);
  } finally {
    connection.close();
  }
});

test("验收每轮独立身份，结果留在专题时间线而不写入客户会话", async () => {
  const f = memoryFixture();
  const service = new AcceptanceHandoffService({ memory: f.memory, store: { state: () => ({ topics: [{ topicId: "topic-1", title: "原任务" }] }) }, readHanliConversationId: () => "han-li-conversation", recordTimelineEvent: event => f.events.set(event.eventId, event) });
  const proposal = { topicId: "topic-1", proposalId: "proposal-1" };
  for (const attempt of ["first", "second"]) {
    service.publish(proposal, "received", "南宫婉提交", attempt);
    service.publish(proposal, "failed", "实际受阻", attempt);
  }
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.events.size, 4);
  assert.equal([...f.messages.values()].filter(message => message.ownerPersonaId === "nangong-wan").length, 4);
  assert.equal([...f.messages.values()].filter(message => message.messageId.startsWith("hanli-result:")).length, 0);
  assert.ok([...f.messages.values()].every(message => message.messageId.startsWith("internal:")));
});


test("自动托管原点复验超过三轮仍交令狐调查，不关闭流程或重复派同一轮", async () => {
  const f = fixture();
  f.evolution.automationSettings.automaticCustodyEnabled = true;
  f.evolution.proposals[0].acceptanceCriteria = ["真实页面必须显示恢复状态"];
  for (let round = 1; round <= 5; round += 1) {
    await f.run();
    assert.equal(f.effects.submitted.length, round);
    assert.equal(f.effects.submitted.at(-1).preferredExecutorMemberId, "linghu-ancestor");
    await f.run();
    assert.equal(f.effects.submitted.length, round);
    f.collaboration.tasks.at(-1).state = "integrated";
    await f.run();
  }
  assert.equal(f.effects.submitted.length, 5);
  assert.notEqual(f.event.payload.checkpoint.exhausted, true);
  assert.equal(f.evolution.technicalRecovery.attemptCount, 6);
  assert.equal(f.evolution.technicalRecovery.handler, "system");
  assert.equal(f.evolution.technicalRecovery.handoffStatus, "pending");
  assert.notEqual(f.evolution.technicalRecovery.nextAction, "监控接管复验，并保留本轮依据。");
  await f.run();
  assert.equal(f.effects.submitted.length, 6);
  assert.equal(f.evolution.technicalRecovery.handler, "linghu-ancestor");
  assert.equal(f.evolution.technicalRecovery.handoffStatus, "handed-off");
  assert.deepEqual(f.effects.resolved, []);
});


test("验收能力修复中出现新产品失败时沿原任务刷新最新证据", async () => {
  const f = fixture();
  Object.assign(f.event.payload, { operation: "run_hanli_result_acceptance", acceptanceRunId: "old-run", acceptanceFailureKind: "acceptance-capability-blocked", evidenceAttachmentIds: ["old-shot"] });
  await f.run();
  assert.equal(f.effects.submitted.length, 1);
  f.events.push({ ...f.event, eventId: "issue-2", occurredAt: "2026-09-05T01:00:00Z", message: "已完成与验收中冲突", payload: {
    runId: "run-1", proposalId: "proposal-1", phase: "accepting", operation: "repair_failed_hanli_acceptance",
    acceptanceRunId: "new-run", acceptanceFailureKind: "product-defect", evidenceAttachmentIds: ["new-shot"],
    acceptanceFailureScope: { decision: "within-original-acceptance", summary: "实际仍在验收，期望不得显示已完成" },
  } });
  await f.run(); await f.run();
  assert.equal(f.effects.submitted.length, 1);
  assert.equal(f.effects.refreshed.length, 1);
  const repair = f.effects.refreshed[0].request;
  assert.match(repair.problemStatement, /已完成与验收中冲突/);
  assert.match(repair.confirmedIntent, /故障分类：product-defect/);
  assert.match(repair.confirmedIntent, /new-run/);
  assert.match(repair.confirmedIntent, /new-shot/);
  assert.doesNotMatch(repair.confirmedIntent, /old-run|old-shot|acceptance-capability-blocked/);
  assert.equal(f.event.payload.acceptanceRunId, "old-run");
  assert.equal(f.event.payload.checkpoint.round, 1);
});

test("最新验收范围待确认时旧技术卡点不得派发修复", async () => {
  const f = fixture();
  f.event.payload.operation = "run_hanli_result_acceptance";
  f.events.push({ ...f.event, eventId: "issue-2", category: "business-exception", occurredAt: "2026-09-05T01:00:00Z", message: "新失败范围需要用户确认", payload: {
    runId: "run-1", proposalId: "proposal-1", operation: "review_acceptance_failure_scope",
  } });
  await f.run();
  assert.equal(f.effects.submitted.length, 0);
  assert.equal(f.event.payload.checkpoint.phase, "waiting");
});

test("验收能力受阻交令狐时保留既有授权排除项", async () => {
  const f = fixture();
  f.event.payload.acceptanceFailureKind = "acceptance-capability-blocked";
  f.evolution.topics[0].exclusions = ["不改变全窗口截图", "不开自动托管"];
  f.evolution.proposals[0].exclusions = ["不开自动托管", "不扩展验收工具"];
  await f.run();
  assert.equal(f.effects.submitted.length, 1);
  assert.equal(f.event.payload.checkpoint.phase, "repairing");
  assert.equal(f.event.payload.checkpoint.repairTaskId, "repair-1");
  assert.ok(f.effects.submitted[0].constraints.includes("原确认范围排除项：不改变全窗口截图"));
  assert.ok(f.effects.submitted[0].constraints.includes("原确认范围排除项：不扩展验收工具"));
});

test("客户范围修订后旧卡点只按当前提案版本创建修复任务", async () => {
  const f = fixture();
  f.evolution.proposals[0].exclusions = ["后续状态更新失败"];
  f.evolution.proposals.push({
    proposalId: "proposal-2",
    topicId: "topic-1",
    title: "已收窄的验收范围",
    supersedesProposalId: "proposal-1",
    version: 2,
    exclusions: ["后续状态更新失败", "不重建任务"],
  });
  // Evolution Store 在创建修订时会原子更新运行绑定；这里保留同一事实，
  // 让协调器核对旧卡点是否真正读取到当前范围版本。
  f.evolution.oneShotRun.proposalId = "proposal-2";

  await f.run();

  const repair = f.effects.submitted[0];
  assert.equal(repair.evolutionProposalId, "proposal-2");
  assert.equal(repair.evolutionRoundId, "proposal-2");
  assert.match(repair.confirmedIntent, /已收窄的验收范围/);
  assert.deepEqual(repair.constraints.filter((item) => item.startsWith("原确认范围排除项：")), [
    "原确认范围排除项：后续状态更新失败",
    "原确认范围排除项：不重建任务",
  ]);
});


test("同一运行新确认提案不被旧提案卡点拦截，也不复用旧修复任务", async () => {
  const f = fixture();
  await f.run();
  const originalCheckpoint = structuredClone(f.event.payload.checkpoint);
  f.collaboration.tasks[0].state = "integrated";
  f.evolution.topics.push({ topicId: "topic-2", title: "完整隔离验收", workspaceState: { roots: [] }, locale: "zh-CN" });
  f.evolution.proposals.push({ proposalId: "proposal-2", topicId: "topic-2", title: "新确认范围" });
  f.evolution.oneShotRun.proposalId = "proposal-2";
  const current = { ...structuredClone(f.event), eventId: "new-proposal-failure", correlationId: "topic-2",
    occurredAt: "2026-09-05T02:00:00Z", message: "隔离启动器未接入真实验收", payload: {
      runId: "run-1", proposalId: "proposal-2", phase: "accepting", operation: "run_hanli_result_acceptance",
      acceptanceFailureKind: "acceptance-capability-blocked",
    } };
  f.events.push(current);
  await f.run(); await f.run();
  assert.equal(f.effects.submitted.length, 2);
  assert.equal(current.payload.checkpoint.phase, "repairing");
  assert.equal(current.payload.checkpoint.repairTaskId, "repair-2");
  assert.equal(f.event.payload.checkpoint.repairTaskId, originalCheckpoint.repairTaskId);
  assert.equal(f.event.payload.checkpoint.round, originalCheckpoint.round);
  assert.deepEqual(f.effects.resumed, []);
  // 新提案的能力受阻重放应复用本提案已有修复任务，不能重复创建。
  delete current.payload.checkpoint;
  await f.run();
  assert.equal(f.effects.submitted.length, 2);
  assert.equal(current.payload.checkpoint.repairTaskId, "repair-2");
  assert.deepEqual(f.effects.resolved, []);
  // 完成新提案不能冒充旧提案的真实复验通过。
  f.evolution.oneShotRun.status = "completed";
  await f.run();
  assert.deepEqual(f.effects.resolved, ["new-proposal-failure"]);
});


test("混合验收失败同时传递能力阻塞且保留原授权排除项", async () => {
  const f = fixture();
  f.event.payload.acceptanceFailureKind = "product-defect";
  f.event.payload.acceptanceBlockedSteps = [{ checkId: "criterion-4", status: "blocked", actual: "隔离窗口拒绝写入，未生成测试任务", layoutStatus: "blocked", screenshotAttachmentId: "blocked-shot" }];
  f.evolution.proposals[0].exclusions = ["不得写入正式记录"];
  await f.run(); await f.run();
  assert.equal(f.effects.submitted.length, 1);
  const repair = f.effects.submitted[0];
  assert.match(repair.confirmedIntent, /隔离窗口拒绝写入，未生成测试任务/);
  assert.match(repair.confirmedIntent, /blocked-shot/);
  assert.ok(repair.constraints.some(text => /同时逐项调查 acceptanceBlockedSteps/.test(text)));
  assert.ok(repair.constraints.includes("原确认范围排除项：不得写入正式记录"));
  assert.ok(repair.acceptanceCriteria.some(text => /原已确认范围/.test(text)));
});


test("旧技术主卡点把最新验收证据写回原任务，重启与重复轮询不重复修订", async () => {
  const f = fixture();
  f.event.payload.operation = "plan_and_dispatch_one_shot";
  f.event.payload.phase = "distributing";
  f.event.message = "旧规则登记失败";
  await f.run();
  const latest = {
    ...structuredClone(f.event), eventId: "latest-failure", occurredAt: "2026-09-06T00:00:00Z",
    message: "恢复中与失败状态未验证",
    payload: { runId: "run-1", proposalId: "proposal-1", phase: "accepting",
      operation: "run_hanli_result_acceptance", acceptanceFailureKind: "acceptance-capability-blocked" },
  };
  f.events.push(latest);
  await f.run();
  assert.equal(f.effects.submitted.length, 1);
  assert.equal(f.effects.refreshed.length, 1);
  assert.match(f.effects.refreshed[0].request.confirmedIntent, /acceptance-capability-blocked/);
  assert.equal(latest.payload.checkpoint.phase, "waiting");
  assert.equal(latest.payload.checkpoint.repairTaskId, null);
  await f.run(); await f.run();
  assert.equal(f.effects.refreshed.length, 1);
  assert.equal(f.collaboration.tasks.length, 1);
});

test("后续修复任务已接管时旧主卡点不重开已集成任务", async () => {
  const f = fixture();
  f.event.payload.operation = "plan_and_dispatch_one_shot";
  f.event.payload.phase = "distributing";
  await f.run();
  f.collaboration.tasks[0].state = "integrated";
  const latest = {
    ...structuredClone(f.event), eventId: "new-acceptance-failure", occurredAt: "2026-09-06T00:00:00Z",
    message: "韩立本轮验收能力受阻",
    payload: { runId: "run-1", proposalId: "proposal-1", phase: "accepting",
      operation: "run_hanli_result_acceptance", acceptanceFailureKind: "acceptance-capability-blocked" },
  };
  f.events.push(latest);
  f.collaboration.tasks.push({
    taskId: "newer-repair", state: "integrated", automationSource: "linghu-safeguard",
    evolutionProposalId: "proposal-1", snapshot: { constraints: ["卡点标识：run-1:proposal:proposal-1:round:1:event:issue-1", "卡点故障事实：new-acceptance-failure"] },
  });
  f.options.resume = async (id) => { f.effects.resumed.push(id); f.evolution.oneShotRun.status = "running"; return f.evolution; };
  await f.run();
  assert.equal(f.event.payload.checkpoint.exhausted, true);
  assert.equal(f.event.payload.checkpoint.phase, "superseded");
  assert.equal(f.event.payload.checkpoint.repairTaskId, "newer-repair");
  assert.equal(latest.payload.checkpoint.repairTaskId, "newer-repair");
  assert.equal(f.effects.refreshed, undefined);
  assert.deepEqual(f.effects.resumed, ["run-1"]);
  await f.run();
  assert.equal(f.effects.refreshed, undefined);
  assert.equal(f.effects.submitted.length, 1);
  assert.deepEqual(f.effects.resumed, ["run-1"]);
});

test("已集成旧修复任务遇到新验收失败时退出主卡点并只派发一次新修复", async () => {
  const f = fixture();
  f.event.payload.operation = "repair_failed_hanli_acceptance";
  await f.run();
  f.collaboration.tasks[0].state = "integrated";
  const latest = {
    ...structuredClone(f.event), eventId: "new-acceptance-failure", occurredAt: "2026-09-06T00:00:00Z",
    message: "窄窗口详情面板高度为零", payload: {
      runId: "run-1", proposalId: "proposal-1", phase: "accepting",
      operation: "repair_failed_hanli_acceptance", acceptanceFailureKind: "product-defect",
    },
  };
  f.events.push(latest);
  await f.run();
  assert.equal(f.event.payload.checkpoint.phase, "superseded");
  assert.equal(f.event.payload.checkpoint.exhausted, true);
  assert.equal(latest.payload.checkpoint.phase, "repairing");
  assert.equal(latest.payload.checkpoint.repairTaskId, "repair-2");
  assert.equal(f.effects.submitted.length, 2);
  assert.equal(f.effects.refreshed, undefined);
  assert.ok(f.effects.submitted[1].constraints.includes("卡点故障事实：new-acceptance-failure"));
  await f.run();
  assert.equal(f.effects.submitted.length, 2);
});

test("多条未建立修复任务的旧事件不抢占最新验收故障", async () => {
  const f = fixture();
  const earlier = ["old-failure-2", "old-failure-3"].map((eventId, index) => ({
    ...structuredClone(f.event), eventId, occurredAt: `2026-09-05T0${index + 1}:00:00Z`,
    payload: { runId: "run-1", proposalId: "proposal-1", phase: "accepting",
      operation: "run_hanli_result_acceptance", acceptanceFailureKind: "acceptance-capability-blocked" },
  }));
  const latest = {
    ...structuredClone(f.event), eventId: "latest-product-failure", occurredAt: "2026-09-06T00:00:00Z",
    message: "窄窗口详情面板高度为零", payload: { runId: "run-1", proposalId: "proposal-1",
      phase: "accepting", operation: "repair_failed_hanli_acceptance", acceptanceFailureKind: "product-defect" },
  };
  f.events.push(...earlier, latest);
  await f.run();
  for (const old of [f.event, ...earlier]) {
    assert.equal(old.payload.checkpoint.phase, "superseded");
    assert.equal(old.payload.checkpoint.exhausted, true);
  }
  assert.equal(latest.payload.checkpoint.phase, "repairing");
  assert.equal(f.effects.submitted.length, 1);
  assert.ok(f.effects.submitted[0].constraints.includes("卡点故障事实：latest-product-failure"));
  await f.run();
  assert.equal(f.effects.submitted.length, 1);
});

test("最新验收需要范围确认时旧技术主卡点不得更新或重启修复", async () => {
  const f = fixture();
  f.event.payload.operation = "plan_and_dispatch_one_shot";
  f.event.payload.phase = "distributing";
  await f.run();
  f.events.push({
    ...structuredClone(f.event), eventId: "scope-block", category: "business-exception",
    occurredAt: "2026-09-06T00:00:00Z",
    payload: { runId: "run-1", proposalId: "proposal-1", phase: "accepting", operation: "run_hanli_result_acceptance" },
  });
  await f.run();
  assert.equal(f.effects.refreshed, undefined);
  assert.deepEqual(f.effects.resumed, []);
});

test("新验收修复接续同根当前任务而不回跳到最初任务", async () => {
  const f = fixture();
  f.evolution.proposals[0].distributedTaskIds = ["task-original"];
  f.collaboration.tasks.push(
    { taskId: "task-original", state: "blocked", evolutionProposalId: "proposal-1", replacementForTaskId: null,
      createdAt: "2026-09-05T00:00:00.000Z", updatedAt: "2026-09-05T00:00:00.000Z", snapshot: { constraints: [] } },
    { taskId: "task-delivered", state: "integrated", evolutionProposalId: "proposal-1", replacementForTaskId: "task-original",
      createdAt: "2026-09-05T00:01:00.000Z", updatedAt: "2026-09-05T00:02:00.000Z", snapshot: { constraints: [] } },
  );
  await f.run();
  assert.equal(f.effects.submitted.length, 1);
  assert.equal(f.effects.submitted[0].replacementForTaskId, "task-delivered");
});
