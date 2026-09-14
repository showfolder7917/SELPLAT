import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { build, transform } from "esbuild";

async function sourceModule(file) {
  const { code } = await transform(readFileSync(file, "utf8"), { loader: "ts", format: "esm", target: "es2022" });
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}
async function bundledSourceModule(file) {
  const result = await build({ entryPoints: [file], bundle: true, format: "esm", platform: "node", target: "es2022", write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}
const { validateAcceptanceScenePlan, createAcceptanceSceneSubmission } = await sourceModule("electron/services/personas/hanli/internal/acceptance/hanli-acceptance-scene.ts");
const { inspectAcceptanceRunEvidence } = await sourceModule("electron/services/personas/hanli/domain/acceptance-run-evidence.policy.ts");
const { createCompletionGateGoal, createSegmentGoal } = await sourceModule("electron/system/ipc/hanli-acceptance-scene-goals.ts");
const { appendRelatedAcceptanceRun, assertSegmentAcceptanceRun, mergeAcceptanceRuns } = await bundledSourceModule("electron/system/ipc/hanli-acceptance-scene-results.ts");
const { prepareAcceptanceSceneWindow } = await sourceModule("electron/system/ipc/acceptance-scene-window.ts");
const { AcceptanceEmptyTaskGroupSession, acceptanceRecoveryFailureMessage } = await sourceModule("electron/system/ipc/acceptance-empty-task-group-session.ts");
const { runHanliAcceptanceSceneSession } = await bundledSourceModule("electron/system/ipc/hanli-acceptance-scene-session.ts");
const hanliContractBarrel = readFileSync("contracts/services/personas/hanli/index.ts", "utf8");
const goal = { topicId: "t", proposalId: "p", title: "引导", criteria: ["没有任务时，先告诉我怎么开始", "按钮和说明相邻"] };
const currentWindowGoal = {
  ...goal,
  sceneContext: {
    topic: { topicId: "t", status: "accepted" },
    proposal: { proposalId: "p", topicId: "t", status: "pending-acceptance" },
    oneShotRun: { topicId: "t", proposalId: "p", status: "running", phase: "accepting" },
  },
};
const workspaceFixtureGoal = {
  ...currentWindowGoal,
  interactionCapabilities: ["workspace-explorer", "workspace-explorer-scenarios"],
  workspaceAcceptanceFixture: {
    kind: "workspace-explorer",
    mode: "scenarios",
    displayName: "韩立验收工作区-本轮",
    instructions: ["添加入口会直接登记临时目录。"],
  },
};
const crossTaskMemberOccupancyGoal = {
  ...currentWindowGoal,
  interactionCapabilities: ["cross-task-member-occupancy"],
  crossTaskMemberOccupancyFixture: {
    kind: "cross-task-member-occupancy",
    instructions: ["只观察令狐另一项任务的当前状态。"],
  },
};
const collaborationStateProjectionGoal = {
  ...currentWindowGoal,
  interactionCapabilities: ["collaboration-state-projection"],
  collaborationStateProjectionFixture: {
    kind: "collaboration-state-projection",
    instructions: ["只观察状态读取结果。"],
  },
};
const segment = { kind: "empty-task-group", reason: "两个条件需要零任务数据", completionReviewRequired: false, ownedConditions: [
  { criterionId: "criterion-1", prerequisite: "没有专题任务" },
  { criterionId: "criterion-2", prerequisite: "说明和按钮在同一空页面" },
], relatedCriterionIds: [] };
const plan = { reason: "使用隔离空任务场景", segments: [segment] };

async function registerPlan(submission, requestId, candidate) {
  for (const item of candidate.segments) {
    const registered = await submission.tools.call("hanli_register_acceptance_scene_segment", { ...item, requestId });
    if (!registered.success) return registered;
  }
  return submission.tools.call("hanli_finalize_acceptance_scene", { requestId, reason: candidate.reason });
}

test("跨任务人物占用夹具从韩立契约桶导出", () => {
  assert.match(hanliContractBarrel, /CrossTaskMemberOccupancyFixtureContextOutDto/);
});

test("韩立显式选择场景不依赖用户语言、页面名和词序", () => {
  assert.deepEqual(validateAcceptanceScenePlan(plan, goal), plan);
  assert.deepEqual(validateAcceptanceScenePlan(plan, { ...goal, criteria: ["Empty tasks guidance", "Adjacent button"] }), plan);
  const recoveryPlan = { ...plan, segments: [{ ...segment, kind: "completed-recovery-timeline", reason: "条件要求核对失败与恢复的完整事实" }] };
  assert.deepEqual(validateAcceptanceScenePlan(recoveryPlan, goal), recoveryPlan);
  const inspectionPlan = { ...plan, segments: [{ ...segment, kind: "inspection-lifecycle-timeline", reason: "条件要求核对三类巡检记录" }] };
  assert.deepEqual(validateAcceptanceScenePlan(inspectionPlan, goal), inspectionPlan);
  const detailPlan = { ...plan, segments: [{ ...segment, kind: "user-language-detail-timeline", reason: "条件同时要求技术详情和客户待办" }] };
  assert.deepEqual(validateAcceptanceScenePlan(detailPlan, goal), detailPlan);
  const lifecyclePlan = { ...plan, segments: [{ ...segment, kind: "recovery-action-lifecycle", reason: "条件要求观察当前等待节点继续后的状态收口" }] };
  assert.deepEqual(validateAcceptanceScenePlan(lifecyclePlan, goal), lifecyclePlan);
  const emptyConversationPlan = { ...plan, segments: [{ ...segment, kind: "persona-empty-conversation", reason: "条件要求在全新空会话中核对首次使用引导" }] };
  assert.deepEqual(validateAcceptanceScenePlan(emptyConversationPlan, goal), emptyConversationPlan);
  const conversationPlan = { ...plan, segments: [{ ...segment, kind: "persona-conversation-lifecycle", reason: "条件要求核对人物会话补载、重试和附件" }] };
  assert.deepEqual(validateAcceptanceScenePlan(conversationPlan, goal), conversationPlan);
  const compositePlan = { ...plan, segments: [{ ...segment, kind: "persona-conversation-with-task-handoff", reason: "条件同时要求人物会话与当前专题的原任务交接记录" }] };
  assert.deepEqual(validateAcceptanceScenePlan(compositePlan, goal), compositePlan);
});
test("场景缺项、重复、未知类型不能默认进入正式窗口", () => {
  for (const invalid of [
    { ...plan, segments: [{ ...segment, kind: "guess" }] },
    { ...plan, segments: [] },
    { ...plan, segments: [{ ...segment, ownedConditions: [segment.ownedConditions[0], segment.ownedConditions[0]] }] },
    { ...plan, reason: "" },
    { ...plan, segments: [{ ...segment, completionReviewRequired: undefined }] },
    { ...plan, segments: [{ ...segment, completionReviewRequired: true }] },
  ]) {
    assert.throws(() => validateAcceptanceScenePlan(invalid, goal));
  }
});
test("当前窗口必须使用运行时核验过的同一专题、提案和验收运行身份", () => {
  const currentPlan = { ...plan, segments: [{ ...segment, kind: "current-window", reason: "已核验目标专题正在验收", completionReviewRequired: true }] };
  assert.deepEqual(validateAcceptanceScenePlan(currentPlan, currentWindowGoal), currentPlan);
  assert.throws(() => validateAcceptanceScenePlan(currentPlan, goal), /只读专题、提案或运行记录/);
  assert.throws(() => validateAcceptanceScenePlan(currentPlan, {
    ...currentWindowGoal,
    sceneContext: { ...currentWindowGoal.sceneContext, proposal: { ...currentWindowGoal.sceneContext.proposal, topicId: "other-topic" } },
  }), /只读专题、提案或运行记录/);
});
test("工作区夹具场景只能使用已签发的场景说明并复用真实窗口", async () => {
  const fixturePlan = { ...plan, segments: [{ ...segment, kind: "workspace-explorer-fixture", reason: "已签发加载、重试与空目录夹具", completionReviewRequired: false }] };
  assert.deepEqual(validateAcceptanceScenePlan(fixturePlan, workspaceFixtureGoal), fixturePlan);
  assert.throws(() => validateAcceptanceScenePlan(fixturePlan, currentWindowGoal), /缺少已签发的受控夹具/);
  const f = fixture();
  const prepared = await prepareAcceptanceSceneWindow(fixturePlan.segments[0], f.options);
  assert.equal(prepared.window, f.options.target);
  prepared.dispose();
});
test("已经签发工作区夹具时拒绝只观察普通工作区", () => {
  const ordinaryWindowOnly = {
    ...plan,
    segments: [{ ...segment, kind: "current-window", reason: "观察当前普通工作区", completionReviewRequired: false }],
  };
  assert.throws(
    () => validateAcceptanceScenePlan(ordinaryWindowOnly, workspaceFixtureGoal),
    /必须包含一个工作区夹具阶段/,
  );
});
test("跨任务人物占用场景只能消费主进程已签发的窗口私有夹具", () => {
  const crossTaskPlan = { ...plan, segments: [{ ...segment, kind: "cross-task-member-occupancy", reason: "核对令狐另一项任务的当前占用", completionReviewRequired: false }] };
  assert.deepEqual(validateAcceptanceScenePlan(crossTaskPlan, crossTaskMemberOccupancyGoal), crossTaskPlan);
  assert.throws(() => validateAcceptanceScenePlan(crossTaskPlan, currentWindowGoal), /缺少主进程签发/);
  assert.throws(() => validateAcceptanceScenePlan({ ...plan, segments: [{ ...segment, kind: "current-window", reason: "跳过已签发夹具", completionReviewRequired: false }] }, crossTaskMemberOccupancyGoal), /必须使用该夹具阶段/);
});
test("协作状态夹具只能覆盖同步中与状态暂未更新", () => {
  const syncing = { ...plan, segments: [{ ...segment, kind: "collaboration-state-syncing", reason: "核对首次读取期间的同步状态", completionReviewRequired: false }] };
  const unavailable = { ...plan, segments: [{ ...segment, kind: "collaboration-state-unavailable", reason: "核对读取失败后的明确状态", completionReviewRequired: false }] };
  assert.deepEqual(validateAcceptanceScenePlan(syncing, collaborationStateProjectionGoal), syncing);
  assert.deepEqual(validateAcceptanceScenePlan(unavailable, collaborationStateProjectionGoal), unavailable);
  assert.throws(() => validateAcceptanceScenePlan(syncing, currentWindowGoal), /缺少主进程签发/);
});
test("工作区收尾与重启证据必须在夹具之后由专用生命周期场景复核", () => {
  const lifecycleGoal = { ...workspaceFixtureGoal, interactionCapabilities: ["workspace-explorer", "workspace-cleanup-recovery", "workspace-startup-recovery"] };
  const fixtureSegment = { ...segment, kind: "workspace-explorer-fixture", ownedConditions: [segment.ownedConditions[0]] };
  const lifecycleSegment = { ...segment, kind: "workspace-lifecycle-review", ownedConditions: [segment.ownedConditions[1]] };
  assert.deepEqual(validateAcceptanceScenePlan({ ...plan, segments: [fixtureSegment, lifecycleSegment] }, lifecycleGoal), { ...plan, segments: [fixtureSegment, lifecycleSegment] });
  assert.throws(() => validateAcceptanceScenePlan({ ...plan, segments: [lifecycleSegment, fixtureSegment] }, lifecycleGoal), /紧接夹具阶段/);
  assert.throws(() => validateAcceptanceScenePlan({ ...plan, segments: [fixtureSegment, { ...lifecycleSegment, kind: "completed-recovery-timeline" }] }, lifecycleGoal), /生命周期复核/);
});
test("一次性工作区夹具不能被拆分到多个正式验收阶段", () => {
  const splitFixturePlan = {
    ...plan,
    segments: [
      { ...segment, kind: "workspace-explorer-fixture", ownedConditions: [segment.ownedConditions[0]] },
      { ...segment, kind: "workspace-explorer-fixture", ownedConditions: [segment.ownedConditions[1]] },
    ],
  };
  assert.throws(() => validateAcceptanceScenePlan(splitFixturePlan, workspaceFixtureGoal), /一次性工作区夹具只能使用一个验收阶段/);
});
test("不同证据源可以分段覆盖原条件且每项只能出现一次", () => {
  const composite = {
    reason: "功能行为与真实交接分别取证",
    segments: [
      { ...segment, kind: "persona-conversation-lifecycle", ownedConditions: [segment.ownedConditions[0]] },
      { ...segment, kind: "current-window", ownedConditions: [segment.ownedConditions[1]] },
    ],
  };
  assert.deepEqual(validateAcceptanceScenePlan(composite, currentWindowGoal), composite);
  assert.throws(() => validateAcceptanceScenePlan({
    ...composite,
    segments: composite.segments.map((item) => ({ ...item, ownedConditions: [segment.ownedConditions[0]] })),
  }, currentWindowGoal), /重复占用/);
});
test("要求人物会话发送态的条件必须使用既有人物会话生命周期场景", () => {
  const conversationGoal = { ...currentWindowGoal, criteria: ["恢复入口显示当前状态", "活动或确认区域在发送中显示忙碌状态"] };
  const recoverySegment = { ...segment, kind: "recovery-action-lifecycle", ownedConditions: [segment.ownedConditions[0]] };
  const conversationSegment = { ...segment, kind: "persona-conversation-lifecycle", ownedConditions: [segment.ownedConditions[1]] };
  const valid = { reason: "恢复入口和会话发送态分别在受控场景观察", segments: [recoverySegment, conversationSegment] };
  assert.deepEqual(validateAcceptanceScenePlan(valid, conversationGoal), valid);
  assert.throws(() => validateAcceptanceScenePlan({ ...valid, segments: [recoverySegment, { ...conversationSegment, kind: "current-window" }] }, conversationGoal), /人物会话生命周期/);
});
test("分段目标直接携带原条件编号并拒绝按局部位置重编号", () => {
  const secondSegment = { ...segment, ownedConditions: [segment.ownedConditions[1]] };
  const localRun = {
    version: 2, runId: "run-1", topicId: "t", proposalId: "p", criteria: [goal.criteria[1]], status: "passed",
    windowTitle: "AI Desktop", initialBounds: { x: 0, y: 0, width: 100, height: 100 }, finalBounds: { x: 0, y: 0, width: 100, height: 100 },
    stepResults: [{ checkId: "criterion-2", operationIndex: 0, operation: { type: "judgement", criterionId: "criterion-2" }, status: "passed", actual: "功能可见", layoutStatus: "passed", layoutActual: "布局清楚", layoutScreenshotAttachmentId: "shot-1", screenshotAttachmentId: "shot-1", occurredAt: "2026-09-13T00:00:00.000Z" }],
    evidenceAttachmentIds: ["shot-1"], startedAt: "2026-09-13T00:00:00.000Z", completedAt: "2026-09-13T00:00:01.000Z",
  };
  assert.deepEqual(createSegmentGoal(goal, secondSegment), { ...goal, criteria: [goal.criteria[1]], criterionIds: ["criterion-2"], preparedScene: secondSegment });
  const preserved = assertSegmentAcceptanceRun(localRun, secondSegment);
  assert.equal(preserved.stepResults[0].checkId, "criterion-2");
  assert.throws(() => assertSegmentAcceptanceRun({ ...localRun, stepResults: localRun.stepResults.map((step) => ({ ...step, checkId: "criterion-1", operation: { type: "judgement", criterionId: "criterion-1" } })) }, secondSegment), /原条件编号不一致/);
  const blocked = { ...preserved, runId: "run-2", status: "blocked", evidenceAttachmentIds: ["shot-1", "shot-2"] };
  const merged = mergeAcceptanceRuns(goal, [preserved, blocked]);
  assert.equal(merged.status, "blocked");
  assert.deepEqual(merged.criteria, goal.criteria);
  assert.deepEqual(merged.evidenceAttachmentIds, ["shot-1", "shot-2"]);
  assert.deepEqual(merged.stepResults.map((item) => item.operationIndex), [0, 1]);
});

test("完成前内部检查不继承多项客户条件编号", () => {
  const segmentGoal = createSegmentGoal(currentWindowGoal, { ...segment, kind: "current-window", completionReviewRequired: true });
  const gateGoal = createCompletionGateGoal(segmentGoal);
  assert.equal(gateGoal.criteria.length, 1);
  assert.deepEqual(gateGoal.criterionIds, ["criterion-1"]);
  assert.equal(gateGoal.reviewMode, "pre-completion-gate");
});

test("一次性工作区夹具只投影给正式夹具场景", () => {
  const currentWindowSegment = { ...segment, kind: "current-window", ownedConditions: [segment.ownedConditions[0]] };
  const fixtureSegment = { ...segment, kind: "workspace-explorer-fixture", ownedConditions: [segment.ownedConditions[1]] };

  const currentWindowGoal = createSegmentGoal(workspaceFixtureGoal, currentWindowSegment);
  const fixtureGoal = createSegmentGoal(workspaceFixtureGoal, fixtureSegment);

  assert.equal("workspaceAcceptanceFixture" in currentWindowGoal, false, "前置当前窗口段不能提前消费一次性夹具");
  assert.deepEqual(fixtureGoal.workspaceAcceptanceFixture, workspaceFixtureGoal.workspaceAcceptanceFixture);
  assert.deepEqual(currentWindowGoal.criteria, [workspaceFixtureGoal.criteria[0]]);
  assert.deepEqual(fixtureGoal.criteria, [workspaceFixtureGoal.criteria[1]]);
});

test("跨任务人物夹具只投影给专用场景", () => {
  const segmentGoal = createSegmentGoal(crossTaskMemberOccupancyGoal, { ...segment, kind: "cross-task-member-occupancy" });
  const ordinaryGoal = createSegmentGoal(crossTaskMemberOccupancyGoal, { ...segment, kind: "empty-task-group" });
  assert.deepEqual(segmentGoal.crossTaskMemberOccupancyFixture, crossTaskMemberOccupancyGoal.crossTaskMemberOccupancyFixture);
  assert.equal("crossTaskMemberOccupancyFixture" in ordinaryGoal, false);
});
test("协作状态夹具只投影给状态场景", () => {
  const projected = createSegmentGoal(collaborationStateProjectionGoal, { ...segment, kind: "collaboration-state-unavailable" });
  const ordinary = createSegmentGoal(collaborationStateProjectionGoal, { ...segment, kind: "empty-task-group" });
  assert.deepEqual(projected.collaborationStateProjectionFixture, collaborationStateProjectionGoal.collaborationStateProjectionFixture);
  assert.equal("collaborationStateProjectionFixture" in ordinary, false);
});

test("场景会话只在正式夹具阶段激活一次性目录", async () => {
  const target = { name: "target", webContents: { id: 77 }, isDestroyed: () => false, getBounds: () => ({ x: 0, y: 0, width: 100, height: 100 }) };
  const sceneActivity = [];
  const fixturePlan = {
    reason: "前置真实窗口后再操作夹具",
    segments: [
      { ...segment, kind: "current-window", ownedConditions: [segment.ownedConditions[0]] },
      { ...segment, kind: "workspace-explorer-fixture", ownedConditions: [segment.ownedConditions[1]] },
    ],
  };
  await runHanliAcceptanceSceneSession({
    goal: workspaceFixtureGoal, plan: fixturePlan, targetWindow: target, targetBounds: target.getBounds(), preloadPath: "preload.cjs", rendererRoot: "renderer",
    sessions: { register() {}, remove() {}, isActive: () => false }, createWindow: () => assert.fail("两个阶段都应复用真实窗口"),
    setWorkspaceFixtureSceneActive: (active) => sceneActivity.push(active),
    execute: async (currentGoal) => {
      const criterionId = currentGoal.criterionIds?.[0] || "criterion-1";
      return {
        version: 2, runId: criterionId, topicId: "t", proposalId: "p", criteria: currentGoal.criteria, status: "passed", windowTitle: "AI Desktop",
        initialBounds: { x: 0, y: 0, width: 100, height: 100 }, finalBounds: { x: 0, y: 0, width: 100, height: 100 },
        stepResults: [{ checkId: criterionId, operationIndex: 0, operation: { type: "judgement", criterionId }, status: "passed", actual: "功能通过", layoutStatus: "passed", layoutActual: "布局通过", layoutScreenshotAttachmentId: `${criterionId}-layout`, screenshotAttachmentId: `${criterionId}-function`, occurredAt: "2026-09-13T00:00:00.000Z" }],
        evidenceAttachmentIds: [`${criterionId}-function`, `${criterionId}-layout`], startedAt: "2026-09-13T00:00:00.000Z", completedAt: "2026-09-13T00:00:01.000Z",
      };
    },
    onSceneReady() {}, onCompletionReviewReady: () => assert.fail("本计划没有完成态复核"), record() {},
  });
  assert.deepEqual(sceneActivity, [false, false, true, false]);
});

test("最终验收记录在提交前逐项诊断重复、缺失和未登记的双截图证据", () => {
  const complete = {
    version: 2, runId: "evidence-run", topicId: "t", proposalId: "p", criteria: goal.criteria, status: "passed", windowTitle: "AI Desktop",
    initialBounds: { x: 0, y: 0, width: 100, height: 100 }, finalBounds: { x: 0, y: 0, width: 100, height: 100 },
    stepResults: goal.criteria.map((_criterion, index) => ({ checkId: `criterion-${index + 1}`, operationIndex: index, operation: { type: "judgement", criterionId: `criterion-${index + 1}` }, status: "passed", actual: "功能已核对", layoutStatus: "passed", layoutActual: "布局已核对", screenshotAttachmentId: `function-${index}`, layoutScreenshotAttachmentId: `layout-${index}`, occurredAt: "2026-09-13T00:00:00.000Z" })),
    evidenceAttachmentIds: ["function-0", "layout-0", "function-1", "layout-1"], startedAt: "2026-09-13T00:00:00.000Z", completedAt: "2026-09-13T00:00:01.000Z",
  };
  assert.equal(inspectAcceptanceRunEvidence(complete).valid, true);
  const duplicate = { ...complete, stepResults: [...complete.stepResults, { ...complete.stepResults[0], operationIndex: 2 }] };
  const diagnostic = inspectAcceptanceRunEvidence(duplicate);
  assert.equal(diagnostic.valid, false);
  assert.deepEqual(diagnostic.invalidCriterionIds, ["criterion-1"]);
  assert.deepEqual(diagnostic.criteria.map((criterion) => [criterion.criterionId, criterion.resultCount]), [["criterion-1", 2], ["criterion-2", 1]]);
  const missingLayout = inspectAcceptanceRunEvidence({ ...complete, stepResults: complete.stepResults.map((step) => step.checkId === "criterion-2" ? { ...step, layoutScreenshotAttachmentId: "missing-layout" } : step) });
  assert.equal(missingLayout.criteria[1].layoutScreenshotRegistered, false);
  assert.equal(missingLayout.criteria[1].valid, false);
});
test("操作轨迹与逐条件结论分离后仍能通过场景编号校验并保留复现顺序", () => {
  const segmentWithTwoCriteria = { ...segment, ownedConditions: [segment.ownedConditions[0], { criterionId: "criterion-2", condition: goal.criteria[1] }] };
  const run = {
    version: 2, runId: "interaction-run", topicId: "t", proposalId: "p", criteria: goal.criteria, status: "passed", windowTitle: "AI Desktop",
    initialBounds: { x: 0, y: 0, width: 100, height: 100 }, finalBounds: { x: 0, y: 0, width: 100, height: 100 },
    interactionSteps: [{ checkId: "interaction", operationIndex: 0, operation: { type: "click", x: 10, y: 10, reason: "打开工作区" }, status: "passed", actual: "已点击", layoutStatus: "passed", layoutActual: "动作后截图已记录", layoutScreenshotAttachmentId: "interaction-shot", screenshotAttachmentId: "interaction-shot", occurredAt: "2026-09-13T00:00:00.000Z" }],
    stepResults: goal.criteria.map((_criterion, index) => ({ checkId: `criterion-${index + 1}`, operationIndex: index + 1, operation: { type: "judgement", criterionId: `criterion-${index + 1}` }, status: "passed", actual: "条件已核对", layoutStatus: "passed", layoutActual: "布局已核对", layoutScreenshotAttachmentId: `criterion-shot-${index}`, screenshotAttachmentId: `criterion-shot-${index}`, occurredAt: "2026-09-13T00:00:01.000Z" })),
    evidenceAttachmentIds: ["interaction-shot", "criterion-shot-0", "criterion-shot-1"], startedAt: "2026-09-13T00:00:00.000Z", completedAt: "2026-09-13T00:00:01.000Z",
  };
  const asserted = assertSegmentAcceptanceRun(run, segmentWithTwoCriteria);
  const merged = mergeAcceptanceRuns(goal, [asserted]);
  assert.deepEqual(merged.stepResults.map((item) => item.checkId), ["criterion-1", "criterion-2"]);
  assert.deepEqual(merged.interactionSteps.map((item) => item.operation.type), ["click"]);
  assert.deepEqual([...merged.interactionSteps, ...merged.stepResults].sort((left, right) => left.operationIndex - right.operationIndex).map((item) => item.operation.type), ["click", "judgement", "judgement"]);
});
test("多阶段编排依次使用隔离会话与真实窗口并汇总原条件", async () => {
  const target = { name: "target", webContents: { id: 77 }, isDestroyed: () => false, getBounds: () => ({ x: 0, y: 0, width: 100, height: 100 }) };
  const child = {
    name: "child", webContents: { id: 88, executeJavaScript: async () => true }, isDestroyed: () => false,
    once() {}, loadFile: async () => undefined, show() {}, close() {},
  };
  const active = new Set();
  const execution = [];
  let readyCount = 0;
  const composite = {
    reason: "功能和审计分别取证",
    segments: [
      { ...segment, kind: "persona-conversation-lifecycle", ownedConditions: [segment.ownedConditions[0]] },
      { ...segment, kind: "current-window", ownedConditions: [segment.ownedConditions[1]] },
    ],
  };
  const result = await runHanliAcceptanceSceneSession({
    goal: currentWindowGoal, plan: composite, targetWindow: target, targetBounds: target.getBounds(), preloadPath: "preload.cjs", rendererRoot: "renderer",
    sessions: { register: (id) => active.add(id), remove: (id) => active.delete(id), isActive: (id) => active.has(id) },
    createWindow: () => child,
    execute: async (currentGoal, window) => {
      execution.push({ criteria: currentGoal.criteria, window: window.name, priorPhaseEvidence: currentGoal.priorPhaseEvidence });
      const index = execution.length;
      const criterionId = currentGoal.criterionIds?.[0] || "criterion-1";
      return {
        version: 2, runId: `run-${index}`, topicId: "t", proposalId: "p", criteria: currentGoal.criteria, status: "passed", windowTitle: "AI Desktop",
        initialBounds: { x: 0, y: 0, width: 100, height: 100 }, finalBounds: { x: 0, y: 0, width: 100, height: 100 },
        stepResults: [{ checkId: criterionId, operationIndex: 0, operation: { type: "judgement", criterionId }, status: "passed", actual: "功能通过", layoutStatus: "passed", layoutActual: "布局通过", layoutScreenshotAttachmentId: `shot-${index}`, screenshotAttachmentId: `shot-${index}`, occurredAt: `2026-09-13T00:00:0${index}.000Z` }],
        evidenceAttachmentIds: [`shot-${index}`], startedAt: `2026-09-13T00:00:0${index}.000Z`, completedAt: `2026-09-13T00:00:0${index + 1}.000Z`,
      };
    },
    onSceneReady: () => { readyCount += 1; }, onCompletionReviewReady: () => assert.fail("没有完成态阶段时不应进入完成态复核"), record() {},
  });
  assert.deepEqual(execution, [
    { criteria: [goal.criteria[0]], window: "child", priorPhaseEvidence: undefined },
    {
      criteria: [goal.criteria[1]],
      window: "target",
      priorPhaseEvidence: {
        summary: "criterion-1：功能通过；布局：布局通过",
        evidenceAttachmentIds: ["shot-1"],
      },
    },
  ]);
  assert.equal(readyCount, 1);
  assert.equal(active.size, 0);
  assert.deepEqual(result.stepResults.map((item) => item.checkId), ["criterion-1", "criterion-2"]);
  assert.equal(result.status, "passed");
});

test("完成前门禁只交付复核许可，最终全量记录才覆盖原始条件", async () => {
  const target = { name: "target", webContents: { id: 77 }, isDestroyed: () => false, getBounds: () => ({ x: 0, y: 0, width: 100, height: 100 }) };
  const child = { name: "child", webContents: { id: 88, executeJavaScript: async () => true }, isDestroyed: () => false, once() {}, loadFile: async () => undefined, show() {}, close() {} };
  const execution = [];
  const lifecycle = [];
  const active = new Set();
  let gate = null;
  const completionPlan = {
    reason: "先验证普通条件，再在完成态复核最终条件",
    segments: [
      { ...segment, kind: "persona-conversation-lifecycle", ownedConditions: [segment.ownedConditions[0]] },
      { ...segment, kind: "current-window", completionReviewRequired: true, ownedConditions: [segment.ownedConditions[1]] },
    ],
  };
  const result = await runHanliAcceptanceSceneSession({
    goal: currentWindowGoal, plan: completionPlan, targetWindow: target, targetBounds: target.getBounds(), preloadPath: "preload.cjs", rendererRoot: "renderer",
    sessions: { register: (id) => active.add(id), remove: (id) => active.delete(id), isActive: (id) => active.has(id) }, createWindow: () => child,
    execute: async (currentGoal, window) => {
      lifecycle.push(currentGoal.reviewMode || "normal");
      execution.push({ criteria: currentGoal.criteria, reviewMode: currentGoal.reviewMode, window: window.name });
      const index = execution.length;
      const criterionId = currentGoal.criterionIds?.[0] || "criterion-1";
      return {
        version: 2, runId: "completion-review-run", topicId: "t", proposalId: "p", criteria: currentGoal.criteria, status: "passed", windowTitle: "AI Desktop",
        initialBounds: { x: 0, y: 0, width: 100, height: 100 }, finalBounds: { x: 0, y: 0, width: 100, height: 100 },
        stepResults: [{ checkId: criterionId, operationIndex: 0, operation: { type: "judgement", criterionId }, status: "passed", actual: `功能通过 ${index}`, layoutStatus: "passed", layoutActual: `布局通过 ${index}`, layoutScreenshotAttachmentId: `shot-${index}`, screenshotAttachmentId: `shot-${index}`, occurredAt: "2026-09-13T00:00:00.000Z" }],
        evidenceAttachmentIds: [`shot-${index}`], startedAt: "2026-09-13T00:00:00.000Z", completedAt: "2026-09-13T00:00:01.000Z",
      };
    },
    finalizeWorkspaceFixture: async () => { lifecycle.push("workspace-released"); },
    onSceneReady() {},
    onCompletionReviewReady: (value) => { lifecycle.push("completion-ready"); gate = value; },
    record() {},
  });
  assert.deepEqual(execution.map((item) => item.reviewMode || "normal"), ["normal", "pre-completion-gate", "post-completion-review"]);
  assert.deepEqual(lifecycle, ["normal", "workspace-released", "pre-completion-gate", "completion-ready", "post-completion-review"], "临时环境必须先释放，完成门和完成态复核才能继续");
  assert.deepEqual(gate.evidenceAttachmentIds, ["shot-1", "shot-2"]);
  assert.equal("stepResults" in gate, false);
  assert.deepEqual(result.stepResults.map((item) => item.checkId), ["criterion-1", "criterion-2"]);
  assert.equal(result.status, "passed");
  assert.equal(active.size, 0);
});

test("工作区生命周期复核先统一收尾，再把恢复证据和前序截图交给当前窗口", async () => {
  const target = { name: "target", webContents: { id: 77 }, isDestroyed: () => false, getBounds: () => ({ x: 0, y: 0, width: 100, height: 100 }) };
  const execution = [], lifecycle = [];
  const cleanupEvidence = { status: "passed", failureSimulated: true, firstFailurePhase: "directory", firstFailureReason: "受控失败", recovered: true, workspaceRegistrationRemoved: true, directoryRemoved: true, windowProjectionReleased: true };
  const lifecyclePlan = { ...plan, segments: [
    { ...segment, kind: "workspace-explorer-fixture", ownedConditions: [segment.ownedConditions[0]] },
    { ...segment, kind: "workspace-lifecycle-review", ownedConditions: [segment.ownedConditions[1]] },
  ] };
  const result = await runHanliAcceptanceSceneSession({
    goal: { ...workspaceFixtureGoal, interactionCapabilities: ["workspace-explorer", "workspace-cleanup-recovery"] }, plan: lifecyclePlan,
    targetWindow: target, targetBounds: target.getBounds(), preloadPath: "preload.cjs", rendererRoot: "renderer",
    sessions: { register() {}, remove() {}, isActive: () => false }, createWindow: () => assert.fail("两个工作区阶段都复用真实窗口"),
    finalizeWorkspaceFixture: async () => { lifecycle.push("finalized"); return cleanupEvidence; },
    execute: async (currentGoal) => {
      execution.push(currentGoal);
      const index = execution.length;
      const criterionId = currentGoal.criterionIds[0];
      return { version: 2, runId: `workspace-${index}`, topicId: "t", proposalId: "p", criteria: currentGoal.criteria, status: "passed", windowTitle: "AI Desktop",
        initialBounds: target.getBounds(), finalBounds: target.getBounds(), stepResults: [{ checkId: criterionId, operationIndex: 0, operation: { type: "judgement", criterionId }, status: "passed", actual: "功能通过", layoutStatus: "passed", layoutActual: "布局通过", screenshotAttachmentId: `shot-${index}`, layoutScreenshotAttachmentId: `shot-${index}`, occurredAt: "2026-09-14T00:00:00.000Z" }], evidenceAttachmentIds: [`shot-${index}`], startedAt: "2026-09-14T00:00:00.000Z", completedAt: "2026-09-14T00:00:01.000Z" };
    },
    onSceneReady() {}, onCompletionReviewReady: () => assert.fail("生命周期复核不改变业务完成态"), record() {},
  });
  assert.deepEqual(lifecycle, ["finalized"]);
  assert.equal(execution[0].workspaceCleanupRecoveryEvidence, undefined);
  assert.deepEqual(execution[1].workspaceCleanupRecoveryEvidence, cleanupEvidence);
  assert.match(execution[1].priorPhaseEvidence.summary, /criterion-1/);
  assert.equal(result.status, "passed");
});

test("前序条件失败后仍采集完成态段的原条件证据，但不触发完成态切换", async () => {
  const target = { name: "target", webContents: { id: 77 }, isDestroyed: () => false, getBounds: () => ({ x: 0, y: 0, width: 100, height: 100 }) };
  const child = { name: "child", webContents: { id: 88, executeJavaScript: async () => true }, isDestroyed: () => false, once() {}, loadFile: async () => undefined, show() {}, close() {} };
  const execution = [];
  const records = [];
  const active = new Set();
  const completionPlan = {
    reason: "先记录失败条件，再收集当前窗口条件的真实证据",
    segments: [
      { ...segment, kind: "persona-conversation-lifecycle", ownedConditions: [segment.ownedConditions[0]] },
      { ...segment, kind: "current-window", completionReviewRequired: true, ownedConditions: [segment.ownedConditions[1]] },
    ],
  };
  const result = await runHanliAcceptanceSceneSession({
    goal: currentWindowGoal, plan: completionPlan, targetWindow: target, targetBounds: target.getBounds(), preloadPath: "preload.cjs", rendererRoot: "renderer",
    sessions: { register: (id) => active.add(id), remove: (id) => active.delete(id), isActive: (id) => active.has(id) }, createWindow: () => child,
    execute: async (currentGoal, window) => {
      execution.push({ criteria: currentGoal.criteria, reviewMode: currentGoal.reviewMode, window: window.name });
      const index = execution.length;
      const criterionId = currentGoal.criterionIds?.[0] || "criterion-1";
      const failed = index === 1;
      return {
        version: 2, runId: `failure-then-evidence-${index}`, topicId: "t", proposalId: "p", criteria: currentGoal.criteria, status: failed ? "failed" : "passed", windowTitle: "AI Desktop",
        initialBounds: { x: 0, y: 0, width: 100, height: 100 }, finalBounds: { x: 0, y: 0, width: 100, height: 100 },
        stepResults: [{ checkId: criterionId, operationIndex: 0, operation: { type: "judgement", criterionId }, status: failed ? "failed" : "passed", actual: failed ? "条件未通过" : "条件已核对", layoutStatus: failed ? "failed" : "passed", layoutActual: failed ? "布局未通过" : "布局已核对", layoutScreenshotAttachmentId: `shot-${index}`, screenshotAttachmentId: `shot-${index}`, occurredAt: "2026-09-13T00:00:00.000Z" }],
        evidenceAttachmentIds: [`shot-${index}`], startedAt: "2026-09-13T00:00:00.000Z", completedAt: "2026-09-13T00:00:01.000Z",
      };
    },
    onSceneReady() {}, onCompletionReviewReady: () => assert.fail("前序失败不能触发完成态切换"), record: (event, details) => records.push({ event, details }),
  });
  assert.deepEqual(execution.map((item) => item.reviewMode || "normal"), ["normal", "normal"]);
  assert.equal(execution[1].window, "target");
  assert.deepEqual(result.stepResults.map((item) => item.checkId), ["criterion-1", "criterion-2"]);
  assert.equal(result.status, "failed");
  assert.equal(inspectAcceptanceRunEvidence(result).valid, true);
  assert.deepEqual(records.filter(({ event }) => event === "hanli.acceptance_scene.completion_review_skipped").map(({ details }) => details.priorStatuses), [["failed"]]);
  assert.equal(active.size, 0);
});

test("完成前门禁受阻时只返回能力阻塞，不提交局部记录作为全量验收", async () => {
  const target = { name: "target", webContents: { id: 77 }, isDestroyed: () => false, getBounds: () => ({ x: 0, y: 0, width: 100, height: 100 }) };
  const active = new Set();
  const completionPlan = {
    reason: "完成前门禁必须先确认当前窗口可用于复核",
    segments: [{ ...segment, kind: "current-window", completionReviewRequired: true }],
  };
  const result = await runHanliAcceptanceSceneSession({
    goal: currentWindowGoal, plan: completionPlan, targetWindow: target, targetBounds: target.getBounds(), preloadPath: "preload.cjs", rendererRoot: "renderer",
    sessions: { register: (id) => active.add(id), remove: (id) => active.delete(id), isActive: (id) => active.has(id) }, createWindow: () => assert.fail("当前窗口不应创建子窗口"),
    execute: async (currentGoal) => {
      // 生产故障发生在同一完成态场景承载多项客户条件时；内部门禁必须先形成自洽的一项目标。
      assert.equal(currentGoal.criteria.length, 1);
      assert.deepEqual(currentGoal.criterionIds, ["criterion-1"]);
      return {
        version: 2, runId: "blocked-gate", topicId: "t", proposalId: "p", criteria: currentGoal.criteria, status: "failed", windowTitle: "AI Desktop",
        initialBounds: { x: 0, y: 0, width: 100, height: 100 }, finalBounds: { x: 0, y: 0, width: 100, height: 100 },
        stepResults: [{ checkId: "criterion-1", operationIndex: 0, operation: { type: "judgement", criterionId: "criterion-1" }, status: "failed", actual: "门禁窗口无法继续复核", layoutStatus: "failed", layoutActual: "门禁窗口布局无法继续确认", layoutScreenshotAttachmentId: "gate-shot", screenshotAttachmentId: "gate-shot", occurredAt: "2026-09-13T00:00:00.000Z" }],
        evidenceAttachmentIds: ["gate-shot"], startedAt: "2026-09-13T00:00:00.000Z", completedAt: "2026-09-13T00:00:01.000Z",
      };
    },
    onSceneReady() {}, onCompletionReviewReady: () => assert.fail("受阻门禁不能进入完成态复核"), record() {},
  });
  assert.equal(result.status, "blocked");
  assert.deepEqual(result.stepResults.map((item) => item.checkId), ["pre-completion-gate"]);
  assert.equal(result.stepResults[0].status, "blocked");
  assert.equal(result.stepResults[0].layoutStatus, "blocked");
  assert.equal(active.size, 0);
});

test("运行时不把完成前门禁作为自动验收结果提交", () => {
  const runtime = readFileSync("electron/services/workflow/internal/evolution/persona-evolution.runtime.ts", "utf8");
  assert.match(runtime, /prepareOneShotCompletionReview\(topic\.topicId, proposal\.proposalId\)/);
  assert.doesNotMatch(runtime, /completeAutomaticAcceptance\(initialRun/);
  assert.match(runtime, /completeAutomaticAcceptance\(runResult/);
  assert.ok(runtime.indexOf('if (runResult.status === "blocked")') < runtime.indexOf("completeAutomaticAcceptance(runResult"));
});
function fixture(failure) {
  const registered = new Set(), events = [], handlers = {};
  let destroyed = false;
  const window = { webContents: { id: 12, executeJavaScript: async () => failure !== "not-mounted" },
    once: (event, action) => { handlers[event] = action; },
    isDestroyed: () => destroyed, show: () => events.push("show"),
    close: () => { destroyed = true; events.push("close"); handlers.closed?.(); },
    loadFile: async () => { if (failure === "load") throw new Error("load failed"); if (failure === "closed") window.close(); },
  };
  let targetDestroyed = false;
  const targetBounds = { x: 1, y: 1, width: 1200, height: 800 };
  const target = { isDestroyed: () => targetDestroyed, getBounds: () => targetBounds };
  const options = { target, targetBounds, preloadPath: "preload.cjs", rendererRoot: "renderer", sessions: {
    register: (id) => registered.add(id), remove: (id) => registered.delete(id), isActive: (id) => registered.has(id),
  }, createWindow: (settings) => { events.push("create"); assert.equal(settings.webPreferences.partition.startsWith("persist:"), false); return window; } };
  return { options, registered, events, window, closeTarget: () => { targetDestroyed = true; } };
}
test("当前场景沿用原窗口，释放时不关闭原应用", async () => {
  const f = fixture();
  const prepared = await prepareAcceptanceSceneWindow({ ...segment, kind: "current-window" }, f.options);
  assert.equal(prepared.window, f.options.target);
  prepared.dispose();
  assert.deepEqual(f.events, []);
});

test("主窗口在规划后关闭时，独立场景仍使用开始时冻结的边界", async () => {
  const f = fixture();
  f.closeTarget();
  await prepareAcceptanceSceneWindow(segment, f.options);
  assert.deepEqual(f.events, ["create", "show"]);
});

test("主窗口在规划后关闭时，当前窗口场景明确拒绝复用失效页面", async () => {
  const f = fixture();
  f.closeTarget();
  await assert.rejects(prepareAcceptanceSceneWindow({ ...segment, kind: "current-window" }, f.options), /验收主窗口已经关闭/);
  assert.deepEqual(f.events, []);
});

test("复合场景缺少交接快照时拒绝启动验收窗口", async () => {
  const f = fixture();
  await assert.rejects(prepareAcceptanceSceneWindow({ ...segment, kind: "persona-conversation-with-task-handoff" }, f.options), /缺少当前专题的只读交接记录/);
});
test("完成恢复场景创建同样只读的非持久化窗口", async () => {
  const f = fixture();
  await prepareAcceptanceSceneWindow({ ...segment, kind: "completed-recovery-timeline", reason: "核对失败和恢复详情" }, f.options);
  assert.equal(f.registered.size, 1);
  assert.equal(f.events.includes("show"), true);
});
test("巡检生命周期场景创建同样只读的非持久化窗口", async () => {
  const f = fixture();
  await prepareAcceptanceSceneWindow({ ...segment, kind: "inspection-lifecycle-timeline", reason: "核对三类巡检记录" }, f.options);
  assert.equal(f.registered.size, 1);
  assert.equal(f.events.includes("show"), true);
});
test("用户语言与技术详情场景创建同样只读的非持久化窗口", async () => {
  const f = fixture();
  await prepareAcceptanceSceneWindow({ ...segment, kind: "user-language-detail-timeline", reason: "核对技术详情与客户待办" }, f.options);
  assert.equal(f.registered.size, 1);
  assert.equal(f.events.includes("show"), true);
});
test("恢复入口生命周期场景创建同样非持久化的验收窗口", async () => {
  const f = fixture();
  await prepareAcceptanceSceneWindow({ ...segment, kind: "recovery-action-lifecycle", reason: "核对唯一入口和恢复中的收口状态" }, f.options);
  assert.equal(f.registered.size, 1);
  assert.equal(f.events.includes("show"), true);
});
test("恢复入口生命周期在窗口私有时间线中依次呈现恢复中和受控失败", () => {
  const session = new AcceptanceEmptyTaskGroupSession();
  session.register(94, "recovery-action-lifecycle");
  const waiting = session.timeline(94).groups[0];
  assert.equal(waiting.nodes.at(-1).eventType, "customer.action_required");
  const started = session.continueRecoveryLifecycle(94, "acceptance-failure-recovery-task").groups[0];
  assert.equal(started.status, "running");
  assert.equal(started.nodes.at(-1).eventType, "task.recovery_requested");
  const failed = session.failRecoveryLifecycle(94, "acceptance-failure-recovery-task").groups[0];
  assert.equal(failed.status, "blocked");
  assert.equal(failed.nodes.at(-1).eventType, "task.recovery_failed");
  assert.equal(failed.nodes.at(-1).status, "failed");
  assert.match(failed.nodes.at(-1).detail, /窗口私有时间线/);
  assert.match(acceptanceRecoveryFailureMessage, /受控验收恢复失败/);
  assert.throws(() => session.failRecoveryLifecycle(94, "acceptance-failure-recovery-task"), /没有可结束的恢复请求/);
  assert.throws(() => session.continueRecoveryLifecycle(94, "acceptance-failure-recovery-task"), /不能重复继续/);
  session.remove(94);
});
test("人物会话生命周期场景创建同样非持久化的验收窗口", async () => {
  const f = fixture();
  await prepareAcceptanceSceneWindow({ ...segment, kind: "persona-conversation-lifecycle", reason: "核对人物会话补载和附件" }, f.options);
  assert.equal(f.registered.size, 1);
  assert.equal(f.events.includes("show"), true);
});

test("首次使用人物会话场景创建两个人物都为空的非持久化窗口", async () => {
  const f = fixture();
  await prepareAcceptanceSceneWindow({ ...segment, kind: "persona-empty-conversation", reason: "核对两个人物的首次使用引导" }, f.options);
  assert.equal(f.registered.size, 1);
  assert.equal(f.events.includes("show"), true);
});

test("人物会话场景只在内存提供分页、一次失败重试、可观察发送中和附件回显", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const session = new AcceptanceEmptyTaskGroupSession();
  session.register(91, "persona-conversation-lifecycle");
  const latest = session.conversationWindow(91, "han-li");
  assert.equal(latest.messages.length, 60);
  assert.equal(latest.hasEarlier, true);
  const before = latest.messages[0].sequenceNumber;
  assert.throws(() => session.conversationWindow(91, "han-li", { beforeSequenceNumber: before }), /模拟补载失败/);
  const retried = session.conversationWindow(91, "han-li", { beforeSequenceNumber: before });
  assert.equal(retried.messages.length, 6);
  const pending = session.sendPersonaConversationMessage(91, "nangong-wan", { clientMessageId: "fixture-message", message: "附件验收", attachmentIds: ["fixture-image"], workspaceState: { roots: [], primaryId: null }, locale: "zh-CN" });
  let settled = false;
  void pending.then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false);
  t.mock.timers.tick(600);
  const sent = await pending;
  assert.equal(sent.messages.at(-2).attachmentIds[0], "fixture-image");
  assert.equal(sent.messages.at(-1).replyToMessageId, "fixture-message");
  const screenshot = session.createPersonaConversationScreenshot(91);
  assert.match(screenshot.attachment.id, /^00000000-0000-4000-8000-/);
  assert.match(screenshot.dataUrl, /^data:image\/png;base64,/);
  session.remove(91);
  assert.equal(session.isActive(91), false);
});

test("首次使用人物会话场景保持两个人物为空且只在窗口内接收后续消息", async () => {
  const session = new AcceptanceEmptyTaskGroupSession();
  session.register(93, "persona-empty-conversation");
  assert.equal(session.isPersonaConversationLifecycle(93), true);
  const initialHanli = session.conversationWindow(93, "han-li");
  const initialNangong = session.conversationWindow(93, "nangong-wan");
  assert.equal(initialHanli.messages.length, 0);
  assert.equal(initialHanli.hasEarlier, false);
  assert.equal(initialNangong.messages.length, 0);
  assert.equal(initialNangong.hasEarlier, false);
  const sent = await session.sendPersonaConversationMessage(93, "han-li", { clientMessageId: "empty-fixture-message", message: "首次使用验收", attachmentIds: [], workspaceState: { roots: [], primaryId: null }, locale: "zh-CN" });
  assert.equal(sent.messages.length, 2);
  assert.equal(session.conversationWindow(93, "han-li").messages.length, 2);
  assert.equal(session.conversationWindow(93, "nangong-wan").messages.length, 0);
  assert.equal(session.conversationWindow(93, "nangong-wan").hasEarlier, false);
});

test("人物会话发送等待在隔离窗口关闭后不补写确认消息", async () => {
  const session = new AcceptanceEmptyTaskGroupSession();
  session.register(95, "persona-conversation-lifecycle");
  const pending = session.sendPersonaConversationMessage(95, "han-li", { clientMessageId: "closing-fixture-message", message: "关闭前发送", attachmentIds: [], workspaceState: { roots: [], primaryId: null }, locale: "zh-CN" });
  session.remove(95);
  await assert.rejects(pending, /独立验收会话已关闭/);
  assert.equal(session.isActive(95), false);
});

// 复合场景的交接事实在窗口准备时冻结，人物消息仍不能回退读取正式会话。
test("人物会话复合场景只保留当前专题的交接快照", () => {
  const session = new AcceptanceEmptyTaskGroupSession();
  const handoff = { version: 1, updatedAt: "2026-01-01T00:00:00.000Z", groups: [{ topicId: "t", proposalId: "p", title: "原任务交接" }] };
  session.register(92, "persona-conversation-with-task-handoff", handoff);
  assert.equal(session.conversationWindow(92, "han-li").messages.length, 60);
  const timeline = session.timeline(92);
  assert.deepEqual(timeline.groups, handoff.groups);
  timeline.groups[0].title = "已篡改的验收窗口数据";
  assert.equal(session.timeline(92).groups[0].title, "原任务交接");
});

test("隔离场景成功后只回收自己登记的窗口，重复清理幂等", async () => {
  const f = fixture();
  const prepared = await prepareAcceptanceSceneWindow(segment, f.options);
  assert.equal(f.registered.size, 1);
  assert.deepEqual(f.events, ["create", "show"]);
  prepared.dispose(); prepared.dispose();
  assert.equal(f.registered.size, 0);
  assert.deepEqual(f.events, ["create", "show", "close"]);
});
test("加载失败、页面未挂载和用户中途关闭都释放临时注册", async () => {
  for (const failure of ["load", "not-mounted", "closed"]) {
    const f = fixture(failure);
    await assert.rejects(prepareAcceptanceSceneWindow(segment, f.options));
    assert.equal(f.registered.size, 0);
    assert.equal(f.events.filter((event) => event === "close").length, 1);
  }
});
test("不支持的场景不启动验收窗口", async () => {
  const f = fixture();
  await assert.rejects(prepareAcceptanceSceneWindow({ ...segment, kind: "blocked" }, f.options));
  assert.deepEqual(f.events, []);
});

test("渲染器无响应时准备超时仍关闭临时窗口", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  f.window.webContents.executeJavaScript = () => new Promise(() => {});
  const pending = prepareAcceptanceSceneWindow(segment, f.options);
  const rejected = assert.rejects(pending, /准备超时/);
  await Promise.resolve();
  t.mock.timers.tick(15000);
  await rejected;
  assert.equal(f.registered.size, 0);
  assert.equal(f.events.filter((event) => event === "close").length, 1);
});

test("说明文字不污染场景结果，只接受本轮工具提交并在结束后关闭", async () => {
  const submission = createAcceptanceSceneSubmission();
  assert.equal(submission.tools.definitions.some((definition) => definition.name === "hanli_submit_acceptance_scene"), false);
  assert.equal(submission.tools.definitions.some((definition) => definition.name === "hanli_register_acceptance_scene_segment"), true);
  assert.equal(submission.tools.definitions.some((definition) => definition.name === "hanli_finalize_acceptance_scene"), true);
  let lastId;
  const result = await submission.run(goal, async (requestId) => {
    lastId = requestId;
    assert.equal((await registerPlan(submission, "old", plan)).success, false);
    assert.equal((await registerPlan(submission, requestId, plan)).success, true);
    assert.equal((await registerPlan(submission, requestId, plan)).success, false);
    return "我会先核对工程协议。这里有普通说明文字。";
  });
  assert.deepEqual(result, plan);
  assert.equal((await registerPlan(submission, lastId, plan)).success, false);
});
test("缺少工具提交和模型异常均释放请求，不解析文字JSON或沿用上轮结果", async () => {
  const submission = createAcceptanceSceneSubmission();
  let missingSubmissionAttempts = 0;
  await assert.rejects(submission.run(goal, async () => {
    missingSubmissionAttempts += 1;
    return JSON.stringify(plan);
  }), /两次都未通过场景提交工具/);
  assert.equal(missingSubmissionAttempts, 2);
  await assert.rejects(submission.run(goal, async () => { throw new Error("disconnect"); }), /disconnect/);
  await submission.run(goal, async (requestId) => {
    assert.equal((await registerPlan(submission, requestId, plan)).success, true);
  });
});

test("韩立首次只回复说明文字时在原请求内纠正一次并接受工具提交", async () => {
  const submission = createAcceptanceSceneSubmission();
  const attempts = [];
  const result = await submission.run(goal, async (requestId, attempt) => {
    attempts.push(attempt);
    if (attempt === 2) assert.equal((await registerPlan(submission, requestId, plan)).success, true);
  });
  assert.deepEqual(attempts, [1, 2]);
  assert.deepEqual(result, plan);
});

test("首次工具参数被拒绝时把真实校验原因交给第二回合并接受修正", async () => {
  const submission = createAcceptanceSceneSubmission();
  const splitFixturePlan = {
    ...plan,
    segments: [
      { ...segment, kind: "workspace-explorer-fixture", ownedConditions: [segment.ownedConditions[0]] },
      { ...segment, kind: "workspace-explorer-fixture", ownedConditions: [segment.ownedConditions[1]] },
    ],
  };
  const mergedFixturePlan = {
    ...plan,
    segments: [{
      kind: "workspace-explorer-fixture",
      reason: "同一临时工作区完成全部取证",
      completionReviewRequired: false,
      ownedConditions: plan.segments.flatMap((item) => item.ownedConditions),
      relatedCriterionIds: [],
    }],
  };
  const result = await submission.run(workspaceFixtureGoal, async (requestId, attempt, planningContext) => {
    if (attempt === 1) {
      assert.deepEqual(planningContext.criteria, [
        { criterionId: "criterion-1", text: goal.criteria[0] },
        { criterionId: "criterion-2", text: goal.criteria[1] },
      ]);
      assert.deepEqual(planningContext.requirements, [{ requirementId: "workspace-acceptance-fixture", acceptedKinds: ["workspace-explorer-fixture"], completed: false }]);
      assert.equal((await registerPlan(submission, requestId, splitFixturePlan)).success, false);
      return;
    }
    assert.deepEqual(planningContext.remainingRequirementIds, ["workspace-acceptance-fixture"]);
    assert.equal("previousAttemptFailure" in planningContext, false);
    assert.equal("submittedSceneKinds" in planningContext, false);
    assert.equal((await registerPlan(submission, requestId, mergedFixturePlan)).success, true);
  });
  assert.deepEqual(result, mergedFixturePlan);
});

test("原条件遗漏时第二回合按当前目标重新生成完整编号计划且审计只保存结果", async () => {
  const rejections = [];
  const submission = createAcceptanceSceneSubmission({ onRejectedPlan: (rejection) => rejections.push(rejection) });
  const omittedCriterionPlan = { ...plan, segments: [{ ...segment, ownedConditions: [segment.ownedConditions[0]] }] };
  let firstPlanningContext;
  let firstRequestId;
  const result = await submission.run(goal, async (requestId, attempt, planningContext) => {
    if (attempt === 1) {
      firstRequestId = requestId;
      firstPlanningContext = planningContext;
      assert.deepEqual(planningContext.criteria, [
        { criterionId: "criterion-1", text: goal.criteria[0] },
        { criterionId: "criterion-2", text: goal.criteria[1] },
      ]);
      const registered = await submission.tools.call("hanli_register_acceptance_scene_segment", { ...omittedCriterionPlan.segments[0], requestId });
      assert.equal(registered.success, true);
      assert.match(registered.contentItems[0].text, /criterion-2/);
      const rejected = await submission.tools.call("hanli_finalize_acceptance_scene", { requestId, reason: omittedCriterionPlan.reason });
      assert.equal(rejected.success, false);
      assert.deepEqual(JSON.parse(rejected.contentItems[0].text), {
        message: "韩立验收场景计划未逐项覆盖原验收条件：criterion-2。",
        planningContext: {
          criteria: [
            { criterionId: "criterion-1", text: goal.criteria[0] },
            { criterionId: "criterion-2", text: goal.criteria[1] },
          ],
          requirements: [],
          remainingCriterionIds: ["criterion-2"],
          remainingRequirementIds: [],
        },
      });
      return;
    }
    assert.notEqual(planningContext, firstPlanningContext);
    assert.notEqual(requestId, firstRequestId);
    assert.deepEqual(planningContext.criteria, [
      { criterionId: "criterion-1", text: goal.criteria[0] },
      { criterionId: "criterion-2", text: goal.criteria[1] },
    ]);
    assert.equal("submittedSceneKinds" in planningContext, false);
    assert.equal("previousAttemptFailure" in planningContext, false);
    assert.equal((await registerPlan(submission, requestId, plan)).success, true);
  });
  assert.deepEqual(result, plan);
  assert.deepEqual(rejections, [{ message: "韩立验收场景计划未逐项覆盖原验收条件：criterion-2。" }]);
});

test("空归属 blocked 阶段返回当前剩余条件，第二回合从空权威模型重新登记", async () => {
  const rejections = [];
  const submission = createAcceptanceSceneSubmission({ onRejectedPlan: (rejection) => rejections.push(rejection) });
  let firstRequestId;
  const result = await submission.run(goal, async (requestId, attempt, planningContext) => {
    if (attempt === 1) {
      firstRequestId = requestId;
      const rejected = await submission.tools.call("hanli_register_acceptance_scene_segment", {
        ...segment,
        requestId,
        kind: "blocked",
        ownedConditions: [],
        relatedCriterionIds: [],
      });
      assert.equal(rejected.success, false);
      assert.deepEqual(JSON.parse(rejected.contentItems[0].text), {
        message: "验收场景阶段必须唯一占用条件，或关联已有条件完成剩余场景。",
        planningContext: {
          criteria: [
            { criterionId: "criterion-1", text: goal.criteria[0] },
            { criterionId: "criterion-2", text: goal.criteria[1] },
          ],
          requirements: [],
          remainingCriterionIds: ["criterion-1", "criterion-2"],
          remainingRequirementIds: [],
        },
      });
      return;
    }
    assert.notEqual(requestId, firstRequestId);
    assert.deepEqual(planningContext.remainingCriterionIds, ["criterion-1", "criterion-2"]);
    assert.equal("previousAttemptFailure" in planningContext, false);
    assert.equal((await registerPlan(submission, requestId, plan)).success, true);
  });
  assert.deepEqual(result, plan);
  assert.deepEqual(rejections, [{ message: "验收场景阶段必须唯一占用条件，或关联已有条件完成剩余场景。" }]);
});

test("协作状态夹具的两种允许阶段由同一需求规则校验和纠正", async () => {
  const submission = createAcceptanceSceneSubmission();
  const omittedFixturePlan = { ...plan, segments: [{ ...segment, kind: "current-window", reason: "错误地跳过状态夹具" }] };
  const correctedPlan = { ...plan, segments: [{ ...segment, kind: "collaboration-state-unavailable", reason: "核对读取失败后的明确状态" }] };
  const result = await submission.run(collaborationStateProjectionGoal, async (requestId, attempt, planningContext) => {
    if (attempt === 1) {
      assert.equal((await registerPlan(submission, requestId, omittedFixturePlan)).success, false);
      return;
    }
    assert.deepEqual(planningContext.requirements, [{ requirementId: "collaboration-state-projection", acceptedKinds: ["collaboration-state-syncing", "collaboration-state-unavailable"], completed: false }]);
    assert.equal("previousAttemptFailure" in planningContext, false);
    assert.equal((await registerPlan(submission, requestId, correctedPlan)).success, true);
  });
  assert.deepEqual(result, correctedPlan);
});

test("一个条件需要多个受控场景时分别推进条件归属和场景完成状态", async () => {
  const submission = createAcceptanceSceneSubmission();
  const multiRequirementGoal = {
    ...crossTaskMemberOccupancyGoal,
    criteria: [goal.criteria[0]],
    interactionCapabilities: ["cross-task-member-occupancy", "collaboration-state-projection"],
    collaborationStateProjectionFixture: collaborationStateProjectionGoal.collaborationStateProjectionFixture,
  };
  const owner = {
    kind: "cross-task-member-occupancy",
    reason: "先核对人物占用事实",
    completionReviewRequired: false,
    ownedConditions: [{ criterionId: "criterion-1", prerequisite: "人物占用夹具已签发" }],
    relatedCriterionIds: [],
  };
  const related = {
    kind: "collaboration-state-syncing",
    reason: "再核对同一条件要求的同步状态",
    completionReviewRequired: false,
    ownedConditions: [],
    relatedCriterionIds: ["criterion-1"],
  };
  const expected = { reason: "同一条件需要两个独立证据源", segments: [owner, related] };
  const result = await submission.run(multiRequirementGoal, async (requestId) => {
    const first = await submission.tools.call("hanli_register_acceptance_scene_segment", { ...owner, requestId });
    assert.equal(first.success, true);
    assert.deepEqual(JSON.parse(first.contentItems[0].text).remainingCriterionIds, []);
    assert.deepEqual(JSON.parse(first.contentItems[0].text).remainingRequirementIds, ["collaboration-state-projection"]);
    const second = await submission.tools.call("hanli_register_acceptance_scene_segment", { ...related, requestId });
    assert.equal(second.success, true);
    assert.deepEqual(JSON.parse(second.contentItems[0].text).remainingRequirementIds, []);
    assert.equal((await submission.tools.call("hanli_finalize_acceptance_scene", { requestId, reason: expected.reason })).success, true);
  });
  assert.deepEqual(result, expected);
  assert.deepEqual(validateAcceptanceScenePlan(expected, multiRequirementGoal), expected);
});

test("关联场景发现的问题合入唯一条件结论并保留新增证据", () => {
  const ownerRun = {
    version: 2, runId: "owner", topicId: "t", proposalId: "p", criteria: [goal.criteria[0]], status: "passed", windowTitle: "AI Desktop",
    initialBounds: { x: 0, y: 0, width: 100, height: 100 }, finalBounds: { x: 0, y: 0, width: 100, height: 100 }, interactionSteps: [],
    stepResults: [{ checkId: "criterion-1", operationIndex: 0, operation: { type: "judgement", criterionId: "criterion-1" }, status: "passed", actual: "人物占用正确", layoutStatus: "passed", layoutActual: "占用状态清楚", screenshotAttachmentId: "owner-shot", layoutScreenshotAttachmentId: "owner-layout", occurredAt: "2026-09-14T00:00:00.000Z" }],
    evidenceAttachmentIds: ["owner-shot", "owner-layout"], startedAt: "2026-09-14T00:00:00.000Z", completedAt: "2026-09-14T00:00:01.000Z",
  };
  const relatedRun = {
    ...ownerRun, runId: "related", status: "failed", evidenceAttachmentIds: ["related-shot", "related-layout"],
    stepResults: [{ ...ownerRun.stepResults[0], status: "failed", actual: "同步状态没有收口", screenshotAttachmentId: "related-shot", layoutStatus: "failed", layoutActual: "状态说明相互矛盾", layoutScreenshotAttachmentId: "related-layout" }],
  };
  const runs = [ownerRun];
  appendRelatedAcceptanceRun(runs, relatedRun, { kind: "collaboration-state-syncing", reason: "同步状态复验", completionReviewRequired: false, ownedConditions: [], relatedCriterionIds: ["criterion-1"] });
  const merged = mergeAcceptanceRuns({ ...goal, criteria: [goal.criteria[0]] }, runs);
  assert.equal(merged.status, "failed");
  assert.equal(merged.stepResults.length, 1);
  assert.match(merged.stepResults[0].actual, /同步状态没有收口/);
  assert.equal(merged.stepResults[0].screenshotAttachmentId, "related-shot");
  assert.deepEqual(merged.evidenceAttachmentIds, ["owner-shot", "owner-layout", "related-shot", "related-layout"]);
});

test("两次工具参数均被拒绝时报告最后一次真实校验原因", async () => {
  const submission = createAcceptanceSceneSubmission();
  await assert.rejects(
    submission.run(workspaceFixtureGoal, async (requestId) => {
      await registerPlan(submission, requestId, {
        ...plan,
        segments: [
          { ...segment, kind: "workspace-explorer-fixture", ownedConditions: [segment.ownedConditions[0]] },
          { ...segment, kind: "workspace-explorer-fixture", ownedConditions: [segment.ownedConditions[1]] },
        ],
      });
    }),
    /两次提交的场景计划均未通过校验：一次性工作区夹具只能使用一个验收阶段/,
  );
});

test("韩立场景工具通过本轮阶段连接装配，结束与应用退出都回收", () => {
  const runtime = readFileSync("electron/system/bootstrap/application-runtime.ts", "utf8");
  const workflowRuntime = readFileSync("electron/services/workflow/internal/evolution/persona-evolution.runtime.ts", "utf8");
  const scene = runtime.slice(runtime.indexOf("const planAcceptanceScene = (goal:"), runtime.indexOf("const personaContext"));
  assert.match(scene, /dynamicTools: submission.tools/);
  assert.match(workflowRuntime, /sceneContext/);
  assert.match(scene, /read: \(\) => null/);
  assert.match(scene, /JSON\.stringify\(planningContext\)/);
  assert.doesNotMatch(scene, /requiredSceneKinds/);
  assert.doesNotMatch(scene, /planningInstruction/);
  assert.doesNotMatch(scene, /rejectionSummary/);
  assert.doesNotMatch(scene, /invalidFields/);
  assert.doesNotMatch(scene, /previousAttemptFailure/);
  assert.doesNotMatch(scene, /retryContext/);
  assert.match(scene, /finally/);
  assert.match(scene, /service.dispose\(\)/);
  assert.match(runtime, /hanliSceneCodex\?\.dispose\(\)/);
  assert.doesNotMatch(scene, /JSON.parse/);
});

test("首次真实验收不把场景准备投影为令狐任务交接", () => {
  const workflowRuntime = readFileSync("electron/services/workflow/internal/evolution/persona-evolution.runtime.ts", "utf8");
  const acceptance = workflowRuntime.slice(workflowRuntime.indexOf('if (flowAction === "accept-result")'), workflowRuntime.indexOf('if (flowAction === "accept-result")') + 5000);
  assert.match(acceptance, /updateOneShotRun\("accepting", "han-li", "韩立", "正在准备真实界面验收场景"/);
  assert.match(acceptance, /publishAcceptance\("started", "韩立已准备验收场景/);
  assert.doesNotMatch(acceptance, /令狐已准备验收场景/);
  assert.doesNotMatch(acceptance, /updateOneShotRun\("accepting", "linghu-ancestor", "令狐老祖", "正在准备并核验/);
  const desktopIpc = readFileSync("electron/system/ipc/register-desktop-ipc.ts", "utf8");
  const sceneSession = readFileSync("electron/system/ipc/hanli-acceptance-scene-session.ts", "utf8");
  const applicationRuntime = readFileSync("electron/system/bootstrap/application-runtime.ts", "utf8");
  assert.match(desktopIpc, /hanli\.acceptance_scene\.planning/);
  assert.match(desktopIpc, /planAcceptanceScene\(acceptanceGoal\)/);
  assert.match(desktopIpc, /workspaceAcceptanceFixture\.prepare/);
  assert.match(desktopIpc, /displayName: workspaceAcceptanceEnvironment!\.displayName/);
  assert.match(desktopIpc, /fixtureLabel: workspaceAcceptanceEnvironment!\.displayName/);
  assert.match(desktopIpc, /hanli\.acceptance_workspace_fixture\.cleanup_failed/);
  assert.match(desktopIpc, /hanli\.acceptance_workspace_fixture\.cleanup_recovered/);
  assert.match(desktopIpc, /cleanup = await workspaceAcceptanceEnvironment\.dispose\(\)/);
  assert.match(desktopIpc, /finalizeWorkspaceFixture: finalizeWorkspaceAcceptanceEnvironment/);
  assert.match(sceneSession, /await options\.finalizeWorkspaceFixture\?\.\(\)/);
  assert.ok(
    desktopIpc.indexOf("workspaceAcceptanceFixture.prepare") < desktopIpc.indexOf("planAcceptanceScene(acceptanceGoal)"),
    "已确认页面可用的受控工作区必须在场景规划前准备好",
  );
  assert.match(desktopIpc, /goal: acceptanceGoal/);
  assert.match(sceneSession, /hanli\.acceptance_scene\.ready/);
  assert.doesNotMatch(desktopIpc, /linghuAutomation\.planAcceptanceScene/);
  assert.doesNotMatch(applicationRuntime, /linghu\.acceptance_scene\.(tool_policy|thread)/);
  const manifest = JSON.parse(readFileSync("prompts/manifest.json", "utf8"));
  const hanliPrompt = manifest.prompts.find((item) => item.id === "hanli.acceptance-scene");
  assert.deepEqual(hanliPrompt && { owner: hanliPrompt.owner, file: hanliPrompt.file }, { owner: "hanli", file: "personas/hanli/acceptance-scene.md" });
  assert.equal(manifest.prompts.some((item) => item.id === "linghu.acceptance-scene"), false);
});

test("场景说明区分条件式规则与必须构造的验收状态", () => {
  const prompt = readFileSync("prompts/personas/hanli/acceptance-scene.md", "utf8");
  assert.match(prompt, /动态 Schema/);
  assert.doesNotMatch(prompt, /"kind":"场景类型"/);
  assert.match(prompt, /若、如果、存在时、出现时/);
  assert.match(prompt, /不代表验收场景必须人为创建/);
  assert.match(prompt, /不得因此选择 blocked/);
  assert.match(prompt, /completed-recovery-timeline/);
  assert.match(prompt, /workspace-lifecycle-review/);
  assert.match(prompt, /inspection-lifecycle-timeline/);
  assert.match(prompt, /user-language-detail-timeline/);
  assert.match(prompt, /recovery-action-lifecycle/);
  assert.match(prompt, /persona-empty-conversation/);
  assert.match(prompt, /全新空会话/);
  assert.match(prompt, /persona-conversation-lifecycle/);
  assert.match(prompt, /persona-conversation-with-task-handoff/);
});

test("后续场景被明确告知复用前序证据而不重复已释放夹具", () => {
  const prompt = readFileSync("prompts/personas/hanli/computer-acceptance.md", "utf8");
  assert.match(prompt, /存在 `priorPhaseEvidence`/);
  assert.match(prompt, /不得重复前序场景动作/);
  assert.match(prompt, /一次性夹具已在段落结束时释放/);
  assert.match(prompt, /workspaceCleanupRecoveryEvidence/);
  assert.match(prompt, /completed-recovery-timeline 中的完成恢复记录代替工作区恢复证据/);
});

test("工作区重启验收由已打包隔离子进程提供最小证据", () => {
  const desktopIpc = readFileSync("electron/system/ipc/register-desktop-ipc.ts", "utf8");
  const prompt = readFileSync("prompts/personas/hanli/computer-acceptance.md", "utf8");
  assert.match(desktopIpc, /runWorkspaceStartupRecoveryAcceptance/);
  assert.match(desktopIpc, /interactionCapabilities\?\.includes\("workspace-startup-recovery"\)/);
  assert.match(desktopIpc, /hanli\.acceptance_workspace_startup_recovery\.checked/);
  assert.match(prompt, /workspaceStartupRecoveryEvidence/);
  assert.match(prompt, /当前已打包 AI Desktop/);
  assert.match(prompt, /当前真实或隔离页面截图/);
});

test("验收输入权限复用主进程会话登记与IPC边界，释放后立即失效", () => {
  const sessions = new AcceptanceEmptyTaskGroupSession();
  const actions = ["recovery", "persona-message", "persona-screenshot", "persona-navigation"];
  for (const action of actions) assert.equal(sessions.allowsComputerAction(700, action), false);
  sessions.register(701, "recovery-action-lifecycle");
  assert.equal(sessions.allowsComputerAction(701, "recovery"), true);
  assert.equal(sessions.allowsComputerAction(701, "persona-message"), false);
  sessions.register(702, "persona-conversation-lifecycle");
  assert.equal(sessions.allowsComputerAction(702, "recovery"), false);
  for (const action of actions.slice(1)) assert.equal(sessions.allowsComputerAction(702, action), true);
  sessions.remove(701); sessions.remove(702);
  for (const id of [701, 702]) for (const action of actions) assert.equal(sessions.allowsComputerAction(id, action), false);
});
