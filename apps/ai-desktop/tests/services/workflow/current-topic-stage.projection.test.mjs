import assert from "node:assert/strict";
import { build } from "esbuild";
import test from "node:test";
import { fileURLToPath } from "node:url";

const result = await build({
  entryPoints: [fileURLToPath(new URL("../../../electron/services/workflow/domain/current-topic-stage.projection.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "es2022",
  write: false,
});
const { projectCurrentTopicStage } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);

function task(state = "integrated") {
  return {
    taskId: "task-current", evolutionProposalId: "proposal-current", replacementForTaskId: null, state,
    createdAt: "2026-09-12T04:00:00.000Z", updatedAt: "2026-09-12T04:00:00.000Z",
    snapshot: { title: "修正测试台状态", confirmedIntent: "统一测试台专题状态" },
    resultSummary: { changes: "统一测试台专题状态", solvedProblem: "状态矛盾", remaining: "" },
    flowEvents: [],
  };
}

function evolution(acceptanceStatus) {
  const finalConclusionRecordId = acceptanceStatus === "passed" ? "result-decision-current" : null;
  return {
    updatedAt: "2026-09-12T04:42:19.000Z",
    oneShotConfirmation: null,
    oneShotRun: { proposalId: "proposal-current" },
    proposals: [{ proposalId: "proposal-current", topicId: "topic-current", title: "修正测试台修复状态误导", content: "统一状态投影", status: "pending-acceptance", finalConclusionRecordId, distributedTaskIds: ["task-current"], updatedAt: "2026-09-12T04:00:00.000Z" }],
    topics: [{ topicId: "topic-current", title: "修正测试台修复状态误导" }],
    deliberations: [],
    archiveRecords: [
      { proposalId: "proposal-current", eventType: "acceptance.result_checked", occurredAt: "2026-09-12T04:42:19.000Z", payload: { acceptanceRun: { runId: "hanli-computer-db0e8dce-a91a-46c1-b63b-51f992e48243", status: acceptanceStatus } } },
      ...(finalConclusionRecordId ? [{ recordId: finalConclusionRecordId, topicId: "topic-current", proposalId: "proposal-current", eventType: "proposal.result_decided", occurredAt: "2026-09-12T04:42:20.000Z", payload: { finalConclusion: { recordId: finalConclusionRecordId, handler: "韩立", occurredAt: "2026-09-12T04:42:20.000Z", acceptanceRunId: "hanli-computer-db0e8dce-a91a-46c1-b63b-51f992e48243", conditionResults: [{ checkId: "criterion-1", status: "passed", evidenceReferences: ["tests/evidence"] }], evidenceReferences: ["tests/evidence"] } } }] : []),
    ],
  };
}

function deliveredCollaboration({ published = true, restartHealthy = true, acceptanceStatus = "passed" } = {}) {
  const currentTask = task("awaiting-restart");
  currentTask.integrationGeneration = 7;
  currentTask.unifiedTest = { status: "passed" };
  currentTask.flowEvents = [
    { type: "unified_test.passed", status: "completed" },
    ...(published ? [{ type: "release.published", status: "completed" }] : []),
    ...(restartHealthy ? [{ type: "release.restart_healthy", status: "completed" }] : []),
  ];
  return {
    tasks: [currentTask],
    integrationBatches: [{ generation: 7, state: restartHealthy ? "completed" : "verified", integrationSha: "final-candidate-sha" }],
    acceptanceStatus,
  };
}

test("最新真实验收失败覆盖已集成任务，投影保持失败待处理", () => {
  const stage = projectCurrentTopicStage(evolution("failed"), { tasks: [task()] });
  assert.equal(stage.status, "failed-pending-repair");
  assert.equal(stage.latestAcceptance?.runId, "hanli-computer-db0e8dce-a91a-46c1-b63b-51f992e48243");
  assert.deepEqual(stage.effectiveTaskIds, ["task-current"]);
});

test("活动技术卡点即使原运行阻塞也不在缺少完整指导时签发恢复动作", () => {
  const state = evolution("failed");
  state.technicalRecovery = {
    issueId: "technical-recovery:topic-current:proposal-current:criterion-1:product-defect",
    topicId: "topic-current", proposalId: "proposal-current", acceptanceConditionIds: ["criterion-1"], failureCategory: "product-defect",
    evidenceReferences: ["event-1"], occurrences: [{ runId: "run-1", taskId: "repair-1", occurrenceId: "event-1", reason: "原验收失败", occurredAt: "2026-09-12T05:00:00.000Z" }],
    attemptCount: 1, handler: "linghu-ancestor", handoffStatus: "handed-off", failureReason: null, nextAction: "等待令狐沿原验收范围调查、修复并复验。", active: true, updatedAt: "2026-09-12T05:00:00.000Z",
  };
  state.oneShotRun = { runId: "blocked-recovery", topicId: "topic-current", proposalId: "proposal-current", status: "blocked" };
  const stage = projectCurrentTopicStage(state, { tasks: [task()] });
  assert.equal(stage.userAction, "none");
  assert.equal(stage.resumeOneShotRunId, null);
  assert.equal(stage.resumeTaskId, null);
  assert.equal(stage.readRecovery.requiresUserAction, false);
  assert.match(stage.summary, /令狐老祖处理中/);
});

test("活动技术卡点没有原运行阻塞时不伪造恢复动作", () => {
  const state = evolution("failed");
  state.technicalRecovery = {
    issueId: "technical-recovery:topic-current:proposal-current:criterion-1:product-defect",
    topicId: "topic-current", proposalId: "proposal-current", acceptanceConditionIds: ["criterion-1"], failureCategory: "product-defect",
    evidenceReferences: ["event-1"], occurrences: [{ runId: "run-1", taskId: "repair-1", occurrenceId: "event-1", reason: "原验收失败", occurredAt: "2026-09-12T05:00:00.000Z" }],
    attemptCount: 1, handler: "linghu-ancestor", handoffStatus: "handed-off", failureReason: null, nextAction: "等待令狐沿原验收范围调查、修复并复验。", active: true, updatedAt: "2026-09-12T05:00:00.000Z",
  };
  const stage = projectCurrentTopicStage(state, { tasks: [task()] });
  assert.equal(stage.userAction, "none");
  assert.equal(stage.resumeOneShotRunId, null);
  assert.match(stage.summary, /令狐老祖处理中/);
});

test("技术故障历史仍保留但任务已进入统一测试时撤销恢复动作", () => {
  const state = evolution("failed");
  state.technicalRecovery = {
    issueId: "technical-recovery:topic-current:proposal-current:criterion-1:product-defect",
    topicId: "topic-current", proposalId: "proposal-current", acceptanceConditionIds: ["criterion-1"], failureCategory: "product-defect",
    evidenceReferences: ["event-1"], occurrences: [{ runId: "run-1", taskId: "task-current", occurrenceId: "event-1", reason: "原验收失败", occurredAt: "2026-09-12T05:00:00.000Z" }],
    attemptCount: 1, handler: "linghu-ancestor", handoffStatus: "handed-off", failureReason: null, nextAction: "等待统一测试。", active: true, updatedAt: "2026-09-12T05:00:00.000Z",
  };
  const stage = projectCurrentTopicStage(state, { tasks: [task("unified-testing")] });
  assert.equal(stage.userAction, "none");
  assert.equal(stage.resumeOneShotRunId, null);
  assert.equal(stage.readRecovery.requiresUserAction, false);
  assert.deepEqual(stage.effectiveTaskIds, ["task-current"]);
});

test("点击继续进入恢复处理中时立即撤销恢复动作", () => {
  const state = evolution("failed");
  state.technicalRecovery = {
    issueId: "technical-recovery:topic-current:proposal-current:criterion-1:product-defect",
    topicId: "topic-current", proposalId: "proposal-current", acceptanceConditionIds: ["criterion-1"], failureCategory: "product-defect",
    evidenceReferences: ["event-1"], occurrences: [{ runId: "run-1", taskId: "task-current", occurrenceId: "event-1", reason: "原验收失败", occurredAt: "2026-09-12T05:00:00.000Z" }],
    attemptCount: 1, handler: "linghu-ancestor", handoffStatus: "handed-off", failureReason: null, nextAction: "等待令狐复核。", active: true, updatedAt: "2026-09-12T05:00:00.000Z",
  };
  const stage = projectCurrentTopicStage(state, { tasks: [task("recovering")] });
  assert.equal(stage.userAction, "none");
  assert.equal(stage.resumeOneShotRunId, null);
  assert.equal(stage.readRecovery.requiresUserAction, false);
  assert.deepEqual(stage.effectiveTaskIds, ["task-current"]);
});

test("没有同指纹完整指导时，关联阻塞任务只显示令狐核对中", () => {
  const state = evolution("failed");
  state.technicalRecovery = {
    issueId: "technical-recovery:topic-current:proposal-current:criterion-1:product-defect",
    topicId: "topic-current", proposalId: "proposal-current", acceptanceConditionIds: ["criterion-1"], failureCategory: "product-defect",
    evidenceReferences: ["event-1"], occurrences: [{ runId: "run-1", taskId: "task-current", occurrenceId: "event-1", reason: "原验收失败", occurredAt: "2026-09-12T05:00:00.000Z" }],
    attemptCount: 1, handler: "linghu-ancestor", handoffStatus: "handed-off", failureReason: null, nextAction: "等待令狐复核。", active: true, updatedAt: "2026-09-12T05:00:00.000Z",
  };
  const stage = projectCurrentTopicStage(state, { tasks: [task("blocked")] });
  assert.equal(stage.userAction, "none");
  assert.equal(stage.resumeOneShotRunId, null);
  assert.equal(stage.resumeTaskId, null);
  assert.equal(stage.readRecovery.requiresUserAction, false);
  assert.deepEqual(stage.effectiveTaskIds, ["task-current"]);
});

test("较新的验收运行不能覆盖仍在阻塞且没有完整指导的活动卡点", () => {
  const state = evolution("failed");
  state.technicalRecovery = {
    issueId: "technical-recovery:topic-current:proposal-current:criterion-1:product-defect",
    topicId: "topic-current", proposalId: "proposal-current", acceptanceConditionIds: ["criterion-1"], failureCategory: "product-defect",
    evidenceReferences: ["event-1"], occurrences: [{ runId: "old-run", taskId: "task-current", occurrenceId: "event-1", reason: "原验收失败", occurredAt: "2026-09-12T04:50:00.000Z" }],
    attemptCount: 1, handler: "linghu-ancestor", handoffStatus: "handed-off", failureReason: null, nextAction: "令狐正在核对；当前无需你操作。", active: true, updatedAt: "2026-09-12T04:50:00.000Z",
  };
  state.oneShotRun = {
    runId: "new-acceptance", topicId: "topic-current", proposalId: "proposal-current",
    status: "running", phase: "accepting", updatedAt: "2026-09-12T05:00:00.000Z",
  };

  const stage = projectCurrentTopicStage(state, { tasks: [task("blocked")] });

  assert.equal(stage.status, "failed-pending-repair");
  assert.equal(stage.waitingFor, "令狐老祖");
  assert.equal(stage.userAction, "none");
  assert.equal(stage.resumeTaskId, null);
  assert.equal(stage.resumeOneShotRunId, null);
});

test("同指纹完整客户指导才签发唯一任务级确认入口", () => {
  const state = evolution("failed");
  state.technicalRecovery = {
    issueId: "technical-recovery:topic-current:proposal-current:criterion-1:product-defect", faultFingerprint: "failure-current",
    topicId: "topic-current", proposalId: "proposal-current", acceptanceConditionIds: ["criterion-1"], failureCategory: "product-defect",
    evidenceReferences: ["event-1"], occurrences: [{ runId: "run-1", taskId: "task-current", occurrenceId: "event-1", reason: "原验收失败", occurredAt: "2026-09-12T05:00:00.000Z" }],
    attemptCount: 1, handler: "linghu-ancestor", handoffStatus: "handed-off", failureReason: null, nextAction: "提交后由令狐复查。", active: true, updatedAt: "2026-09-12T05:00:00.000Z",
  };
  const blocked = task("blocked");
  blocked.integrationFailure = { conflictFiles: ["apps/ai-desktop/electron/main.ts"] };
  blocked.customerActionGuidance = {
    sourceFingerprint: "failure-current", affectedFiles: ["apps/ai-desktop/electron/main.ts"], problem: "本地修改归属待确认。", reasonCustomerMustAct: "只有客户能确认归属。",
    steps: ["确认该文件属于当前专题。"], completionCriteria: ["确认后提交复查。"], resumeLabel: "确认并请令狐复查",
  };
  const stage = projectCurrentTopicStage(state, { tasks: [blocked] });
  assert.equal(stage.userAction, "resume");
  assert.equal(stage.resumeTaskId, "task-current");
  assert.equal(stage.resumeOneShotRunId, null);
  assert.equal(stage.readRecovery.requiresUserAction, true);
  assert.equal(stage.customerActionGuidance?.resumeLabel, "确认并请令狐复查");
  assert.deepEqual(stage.customerActionGuidance?.affectedFiles, ["apps/ai-desktop/electron/main.ts"]);
});

test("概括性客户指导即使带有同指纹和文件也不签发确认入口", () => {
  const state = evolution("failed");
  state.technicalRecovery = {
    issueId: "technical-recovery:topic-current:proposal-current:criterion-2:product-defect", faultFingerprint: "failure-current",
    topicId: "topic-current", proposalId: "proposal-current", acceptanceConditionIds: ["criterion-2"], failureCategory: "product-defect",
    evidenceReferences: ["event-2"], occurrences: [{ runId: "run-1", taskId: "task-current", occurrenceId: "event-2", reason: "指导不完整", occurredAt: "2026-09-12T05:00:00.000Z" }],
    attemptCount: 1, handler: "linghu-ancestor", handoffStatus: "handed-off", failureReason: null, nextAction: "令狐继续核对。", active: true, updatedAt: "2026-09-12T05:00:00.000Z",
  };
  const blocked = task("blocked");
  blocked.customerActionGuidance = {
    sourceFingerprint: "failure-current", affectedFiles: ["apps/ai-desktop/electron/main.ts"], problem: "当前阻塞需要你确认已完成指定操作。",
    reasonCustomerMustAct: "只有你能确认外部条件已经满足。", steps: ["核对阻塞说明", "完成指定操作"], completionCriteria: ["操作已完成", "可由令狐复查"], resumeLabel: "提交确认并请求令狐复查",
  };
  const stage = projectCurrentTopicStage(state, { tasks: [blocked] });
  assert.equal(stage.userAction, "none");
  assert.equal(stage.resumeTaskId, null);
  assert.equal(stage.customerActionGuidance, null);
});

test("技术卡点计数依据缺失不会进入监控接管", () => {
  const state = evolution("failed");
  state.technicalRecovery = { issueId: "unverified:topic-current:proposal-current", topicId: "topic-current", proposalId: "proposal-current", acceptanceConditionIds: [], failureCategory: "technical-runtime", evidenceReferences: ["event-2"], occurrences: [], attemptCount: 0, handler: "system", handoffStatus: "basis-unverified", failureReason: "缺少原验收条件", nextAction: "系统重新读取原验收条件与失败依据。", active: true, updatedAt: "2026-09-12T05:00:00.000Z" };
  const stage = projectCurrentTopicStage(state, { tasks: [task()] });
  assert.equal(stage.userAction, "none");
  assert.match(stage.summary, /次数依据尚未核验/);
});

test("已取消关联只保留历史取消结论，不生成恢复或验收动作", () => {
  const state = evolution("missing");
  state.oneShotRun = {
    runId: "cancelled-run", topicId: "topic-current", proposalId: "proposal-current",
    status: "blocked", phase: "blocked", updatedAt: "2026-09-12T05:00:00.000Z",
  };
  const stage = projectCurrentTopicStage(state, { tasks: [task("cancelled")] });
  assert.equal(stage.status, "cancelled");
  assert.equal(stage.nextAction, "本专题已取消");
  assert.equal(stage.userAction, "none");
  assert.equal(stage.resumeOneShotRunId, null);
  assert.deepEqual(stage.effectiveTaskIds, []);
});

test("已被有效替代的旧取消任务不阻断当前专题", () => {
  const state = evolution("missing");
  const oldTask = task("cancelled");
  const replacement = {
    ...task("integrated"),
    taskId: "task-current-replacement",
    replacementForTaskId: oldTask.taskId,
    updatedAt: "2026-09-12T05:00:00.000Z",
  };
  const stage = projectCurrentTopicStage(state, { tasks: [oldTask, replacement] });
  assert.notEqual(stage.status, "cancelled");
  assert.deepEqual(stage.effectiveTaskIds, ["task-current-replacement"]);
});

test("尚未开始真实验收时，待验收提案不得显示验收中", () => {
  const state = evolution("passed");
  state.archiveRecords = [];
  const stage = projectCurrentTopicStage(state, deliveredCollaboration());
  assert.equal(stage.status, "pending-acceptance");
});


test("新一轮真实验收开始覆盖旧失败，结束后以新结果为准", () => {
  const state = evolution("failed");
  state.oneShotRun = { proposalId: "proposal-current", status: "running", phase: "accepting", updatedAt: "2026-09-12T05:00:00.000Z" };
  const delivered = deliveredCollaboration();
  assert.equal(projectCurrentTopicStage(state, delivered).status, "accepting");
  state.archiveRecords.push({ ...state.archiveRecords[0], occurredAt: "2026-09-12T05:01:00.000Z", payload: { acceptanceRun: { runId: "new-run", status: "failed" } } });
  const stage = projectCurrentTopicStage(state, delivered);
  assert.equal(stage.status, "failed-pending-repair");
  assert.equal(stage.latestAcceptance.runId, "new-run");
});

test("新一轮真实验收开始后旧技术恢复只保留审计，不再覆盖当前负责人和动作", () => {
  const state = evolution("failed");
  state.technicalRecovery = {
    issueId: "technical-recovery:topic-current:proposal-current:criterion-1:product-defect",
    topicId: "topic-current", proposalId: "proposal-current", acceptanceConditionIds: ["criterion-1"], failureCategory: "product-defect",
    evidenceReferences: ["event-1"], occurrences: [{ runId: "old-run", taskId: "task-current", occurrenceId: "event-1", reason: "上一轮验收失败", occurredAt: "2026-09-12T04:50:00.000Z" }],
    attemptCount: 1, handler: "system", handoffStatus: "failed", failureReason: "上一轮令狐转交未完成",
    nextAction: "系统重试写入令狐交接。", active: true, updatedAt: "2026-09-12T04:50:00.000Z",
  };
  state.oneShotRun = {
    runId: "resumed-acceptance", topicId: "topic-current", proposalId: "proposal-current",
    status: "running", phase: "accepting", updatedAt: "2026-09-12T05:00:00.000Z",
  };

  const stage = projectCurrentTopicStage(state, deliveredCollaboration());

  assert.equal(stage.status, "accepting");
  assert.equal(stage.waitingFor, "韩立真实验收");
  assert.equal(stage.userAction, "none");
  assert.equal(stage.resumeOneShotRunId, null);
  assert.doesNotMatch(stage.summary, /令狐转交未完成|系统恢复处理/);
});

test("完成态后的当前复核运行阻塞时优先显示原卡恢复状态", () => {
  const state = evolution("passed");
  state.proposals[0].status = "completed";
  state.oneShotRun = {
    runId: "completion-review", topicId: "topic-current", proposalId: "proposal-current",
    status: "blocked", phase: "blocked", updatedAt: "2026-09-12T05:00:00.000Z",
  };
  const stage = projectCurrentTopicStage(state, { tasks: [task()] });
  assert.equal(stage.status, "failed-pending-repair");
  assert.equal(stage.userAction, "resume");
  assert.equal(stage.resumeOneShotRunId, "completion-review");
});

test("已完成专题缺少唯一结论引用时只能显示尚未核验", () => {
  const state = evolution("passed");
  state.proposals[0].status = "completed";
  state.proposals[0].finalConclusionRecordId = null;
  const stage = projectCurrentTopicStage(state, deliveredCollaboration());
  assert.equal(stage.status, "completed-unverified");
  assert.equal(stage.finalConclusion, null);
  assert.match(stage.summary, /尚未核验/);
  assert.equal(stage.waitingFor, "验收依据");
});

test("错误关联或不完整结论记录不能把 completed 显示为最终验收通过", () => {
  const state = evolution("passed");
  state.proposals[0].status = "completed";
  state.archiveRecords.at(-1).payload.finalConclusion.evidenceReferences = [];
  const stage = projectCurrentTopicStage(state, deliveredCollaboration());
  assert.equal(stage.status, "completed-unverified");
  assert.equal(stage.finalConclusion, null);
});

test("未确立的新研讨不能覆盖已经绑定专题的验收卡点", () => {
  const state = evolution("failed");
  state.oneShotRun = {
    runId: "blocked-acceptance", topicId: "topic-current", proposalId: "proposal-current",
    status: "blocked", phase: "blocked", updatedAt: "2026-09-12T05:00:00.000Z",
  };
  state.deliberations = [{
    deliberationId: "later-questioning-deliberation", topicId: null, status: "questioning",
    updatedAt: "2026-09-12T05:01:00.000Z", rounds: [],
  }];

  const stage = projectCurrentTopicStage(state, { tasks: [task()] });
  assert.equal(stage.topicId, "topic-current");
  assert.equal(stage.proposalId, "proposal-current");
  assert.equal(stage.status, "failed-pending-repair");
  assert.equal(stage.userAction, "resume");
  assert.equal(stage.resumeOneShotRunId, "blocked-acceptance");
});

test("没有已绑定专题运行时仍展示待确认研讨", () => {
  const state = evolution("missing");
  state.oneShotRun = null;
  state.deliberations = [{
    deliberationId: "pending-deliberation", status: "ready-to-establish",
    rounds: [{ confirmation: { offeredAt: "2026-09-12T05:01:00.000Z", reply: null } }],
  }];

  const stage = projectCurrentTopicStage(state, { tasks: [task()] });
  assert.equal(stage.status, "awaiting-confirmation");
  assert.equal(stage.userAction, "confirmation");
  assert.equal(stage.topicId, null);
});

test("没有已绑定专题运行时显示已持久化的南宫婉活跃研讨", () => {
  const state = evolution("missing");
  state.oneShotRun = null;
  state.proposals = [];
  state.topics = [];
  state.deliberations = [{
    deliberationId: "active-questioning-deliberation", topicId: null, status: "questioning",
    updatedAt: "2026-09-12T05:02:00.000Z", rounds: [],
  }];

  const stage = projectCurrentTopicStage(state, { tasks: [task()] });
  assert.equal(stage.status, "deliberating");
  assert.equal(stage.topicId, null);
  assert.equal(stage.proposalId, null);
  assert.equal(stage.userAction, "none");
  assert.match(stage.title, /南宫婉正在内部研讨/);
  assert.match(stage.nextAction, /形成可执行范围后再显示确认/);
  assert.equal(stage.updatedAt, "2026-09-12T05:02:00.000Z");
});

test("独立专题建立中和建立失败不退化为空任务或旧专题恢复入口", () => {
  const state = evolution("missing");
  state.activeTopicId = null;
  state.topics[0].status = "rejected";
  state.proposals[0].status = "rejected";
  state.oneShotRun = {
    runId: "independent-topic-run", topicId: null, proposalId: null,
    status: "running", phase: "preparing-topic", topicEstablishmentMode: "independent-switch",
    updatedAt: "2026-09-12T05:00:00.000Z", blockingReason: null,
  };

  let stage = projectCurrentTopicStage(state, { tasks: [task("cancelled")] });
  assert.equal(stage.status, "establishing-topic");
  assert.equal(stage.topicId, null);
  assert.equal(stage.userAction, "none");
  assert.match(stage.nextAction, /继续当前研讨/);

  state.oneShotRun = { ...state.oneShotRun, status: "blocked", phase: "blocked", blockingReason: "建立专题时缺少可用事实" };
  stage = projectCurrentTopicStage(state, { tasks: [task("cancelled")] });
  assert.equal(stage.status, "topic-establishment-failed");
  assert.equal(stage.resumeOneShotRunId, null);
  assert.match(stage.summary, /缺少可用事实/);
});

test("真实验收进行中优先于已经完成的提案状态", () => {
  const state = evolution("passed");
  state.proposals[0].status = "completed";
  state.oneShotRun = { proposalId: "proposal-current", status: "running", phase: "accepting", updatedAt: "2026-09-12T05:00:00.000Z" };
  assert.equal(projectCurrentTopicStage(state, deliveredCollaboration()).status, "accepting");
});

test("验收结果按真实发生时间选择，保留历史顺序不修改输入", () => {
  const state = evolution("failed");
  const old = { ...state.archiveRecords[0], occurredAt: "2026-09-12T03:00:00.000Z", payload: { acceptanceRun: { runId: "old-pass", status: "passed" } } };
  state.archiveRecords.push(old);
  const before = structuredClone(state);
  assert.equal(projectCurrentTopicStage(state, { tasks: [task()] }).status, "failed-pending-repair");
  assert.deepEqual(state, before);
});

test("完成必须绑定同一最终候选的测试、发布、重启健康与真实验收", () => {
  const complete = deliveredCollaboration();
  const completedState = evolution(complete.acceptanceStatus);
  completedState.proposals[0].status = "completed";
  completedState.topics[0].status = "completed";
  const completed = projectCurrentTopicStage(completedState, complete);
  assert.equal(completed.status, "completed");
  assert.equal(completed.summary, "韩立结果验收已经通过，专题已完成。");
  assert.equal(completed.waitingFor, "当前无需操作");
  assert.equal(completed.nextAction, "可开始下一专题。");
  assert.equal(completed.userAction, "none");
  assert.equal(completed.readRecovery.requiresUserAction, false);
  assert.equal(completed.deliveryEvidence.candidate.integrationSha, "final-candidate-sha");

  const missingRelease = deliveredCollaboration({ published: false });
  assert.equal(projectCurrentTopicStage(evolution(missingRelease.acceptanceStatus), missingRelease).status, "awaiting-release");

  const missingRestart = deliveredCollaboration({ restartHealthy: false });
  assert.equal(projectCurrentTopicStage(evolution(missingRestart.acceptanceStatus), missingRestart).status, "awaiting-restart-health");
});

test("监控者独立验收卡缺少最终结论时不能冒充已通过", () => {
  const state = evolution("missing");
  state.topics[0].status = "completed";
  state.topics[0].recoveryPoint = "monitor-formal-acceptance-passed";
  state.proposals[0].status = "completed";
  state.proposals[0].distributionPlan = null;
  state.proposals[0].distributedTaskIds = [];
  state.proposals[0].resultSummary = "人物切换、任务卡展开收起和滚动条拖动均通过。";
  state.oneShotRun = {
    runId: "monitor-acceptance-run", topicId: "topic-current", proposalId: "proposal-current",
    status: "completed", phase: "completed", updatedAt: "2026-09-12T05:00:00.000Z", completedAt: "2026-09-12T05:00:00.000Z",
  };
  state.archiveRecords = [];

  const stage = projectCurrentTopicStage(state, { tasks: [], integrationBatches: [] });
  assert.equal(stage.status, "completed-unverified");
  assert.match(stage.summary, /尚未核验/);
  assert.equal(stage.waitingFor, "韩立独立验收");
  assert.match(stage.nextAction, /记录最终结论/);
  assert.equal(stage.latestAcceptance, null);
  assert.equal(stage.finalConclusion, null);
  assert.deepEqual(stage.effectiveTaskIds, []);
  assert.equal(stage.deliveryEvidence.candidate, null);
  assert.equal(stage.deliveryEvidence.acceptance, "missing");

  state.topics[0].status = "pending-acceptance";
  state.topics[0].recoveryPoint = "monitor-formal-acceptance-pending";
  state.proposals[0].status = "pending-acceptance";
  state.oneShotRun.status = "running";
  assert.equal(projectCurrentTopicStage(state, { tasks: [], integrationBatches: [] }).status, "pending-acceptance");
  state.topics[0].status = "supplement-required";
  state.topics[0].recoveryPoint = "monitor-formal-acceptance-failed";
  state.oneShotRun.status = "blocked";
  assert.equal(projectCurrentTopicStage(state, { tasks: [], integrationBatches: [] }).status, "failed-pending-repair");
});

test("重启健康只将最终候选交给真实验收，不能单独完成", () => {
  const delivered = deliveredCollaboration({ acceptanceStatus: "running" });
  const stage = projectCurrentTopicStage(evolution(delivered.acceptanceStatus), delivered);
  assert.equal(stage.status, "accepting");
  assert.equal(stage.waitingFor, "韩立真实验收");
});

test("待验收提案先说明缺少的交付事实，不能提前等待真实验收", () => {
  const withoutCandidate = projectCurrentTopicStage(evolution("missing"), { tasks: [task()] });
  assert.equal(withoutCandidate.status, "verifying");
  assert.equal(withoutCandidate.waitingFor, "最终候选");
  assert.match(withoutCandidate.remaining, /缺少最终候选/);
  assert.match(withoutCandidate.nextAction, /生成最终候选/);

  const withoutUnifiedTest = deliveredCollaboration();
  withoutUnifiedTest.tasks[0].unifiedTest = undefined;
  withoutUnifiedTest.tasks[0].flowEvents = [];
  const stage = projectCurrentTopicStage(evolution("missing"), withoutUnifiedTest);
  assert.equal(stage.status, "verifying");
  assert.equal(stage.waitingFor, "完整统一测试结论");
  assert.match(stage.remaining, /缺少完整统一测试结论/);
  assert.match(stage.nextAction, /完成最终候选的完整统一测试/);
});

test("交付投影逐项说明发布、重启健康和真实验收缺项", () => {
  const missingRelease = projectCurrentTopicStage(evolution("missing"), deliveredCollaboration({ published: false }));
  assert.equal(missingRelease.status, "awaiting-release");
  assert.match(missingRelease.remaining, /缺少发布结果/);

  const missingRestart = projectCurrentTopicStage(evolution("missing"), deliveredCollaboration({ restartHealthy: false }));
  assert.equal(missingRestart.status, "awaiting-restart-health");
  assert.match(missingRestart.remaining, /缺少重启健康检查结果/);

  const missingAcceptance = projectCurrentTopicStage(evolution("missing"), deliveredCollaboration());
  assert.equal(missingAcceptance.status, "pending-acceptance");
  assert.match(missingAcceptance.remaining, /缺少真实验收结果/);
});

test("读取恢复政策只随当前专题档案的用户操作变化", () => {
  const automatic = projectCurrentTopicStage(evolution("missing"), { tasks: [task()] });
  assert.equal(automatic.readRecovery.requiresUserAction, false);

  const blocked = evolution("missing");
  blocked.oneShotRun = { topicId: "topic-current", proposalId: "proposal-current", runId: "blocked-run", status: "blocked", updatedAt: "2026-09-12T05:00:00.000Z" };
  const manual = projectCurrentTopicStage(blocked, { tasks: [task()] });
  assert.equal(manual.readRecovery.requiresUserAction, true);
  assert.equal(manual.resumeOneShotRunId, "blocked-run");
  assert.match(manual.readRecovery.nextAction, /重新读取当前交付投影/);
});

test("Host 启动通过只接受当前专题同一启动标识的完整退出与 health 事实", () => {
  const state = evolution("missing");
  state.archiveRecords.push({
    topicId: "topic-current", proposalId: "proposal-current", eventType: "host-startup.evidence-recorded", occurredAt: "2026-09-19T00:00:02.000Z",
    payload: { hostStartupEvidence: { launchId: "host-1", handler: "启动SELPLAT.command", startedAt: "2026-09-19T00:00:00.000Z", command: { launchId: "host-1", state: "running", exitCode: null }, health: { launchId: "host-1", success: true, checkedAt: "2026-09-19T00:00:01.000Z", summary: '{"success":true,"data":{"status":"READY"}}' }, evidenceSnapshot: { launcherSource: "#!/bin/zsh\necho startup", healthResponse: '{"success":true,"data":{"status":"READY"}}' }, evidenceReferences: ["archive://host-startup/host-1/launcherSource", "archive://host-startup/host-1/healthResponse"] } },
  });
  let stage = projectCurrentTopicStage(state, { tasks: [task()] });
  assert.equal(stage.hostStartupAcceptance.status, "unverified");
  assert.equal(stage.hostStartupAcceptance.launchId, "host-1");
  assert.equal(stage.hostStartupAcceptance.commandStatus, "running");
  state.archiveRecords.push({ ...state.archiveRecords.at(-1), payload: { hostStartupEvidence: { ...state.archiveRecords.at(-1).payload.hostStartupEvidence, command: { launchId: "host-1", state: "exited", exitCode: 0 } } } });
  stage = projectCurrentTopicStage(state, { tasks: [task()] });
  assert.equal(stage.hostStartupAcceptance.status, "passed");
  state.archiveRecords.at(-1).payload.hostStartupEvidence.evidenceSnapshot.launcherSource = null;
  stage = projectCurrentTopicStage(state, { tasks: [task()] });
  assert.equal(stage.hostStartupAcceptance.status, "unverified");
  state.archiveRecords.at(-1).payload.hostStartupEvidence.evidenceSnapshot.launcherSource = "#!/bin/zsh\necho startup";
  state.archiveRecords.at(-1).payload.hostStartupEvidence.health.launchId = "other-host";
  stage = projectCurrentTopicStage(state, { tasks: [task()] });
  assert.equal(stage.hostStartupAcceptance.status, "unverified");
  const releaseOnly = projectCurrentTopicStage(evolution("missing"), deliveredCollaboration());
  assert.equal(releaseOnly.hostStartupAcceptance.status, "unverified");
});
