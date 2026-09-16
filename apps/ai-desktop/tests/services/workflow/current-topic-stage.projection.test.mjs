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
  };
}

function evolution(acceptanceStatus) {
  return {
    updatedAt: "2026-09-12T04:42:19.000Z",
    oneShotConfirmation: null,
    oneShotRun: { proposalId: "proposal-current" },
    proposals: [{ proposalId: "proposal-current", topicId: "topic-current", title: "修正测试台修复状态误导", content: "统一状态投影", status: "pending-acceptance", distributedTaskIds: ["task-current"], updatedAt: "2026-09-12T04:00:00.000Z" }],
    topics: [{ topicId: "topic-current", title: "修正测试台修复状态误导" }],
    deliberations: [],
    archiveRecords: [{ proposalId: "proposal-current", eventType: "acceptance.result_checked", occurredAt: "2026-09-12T04:42:19.000Z", payload: { acceptanceRun: { runId: "hanli-computer-db0e8dce-a91a-46c1-b63b-51f992e48243", status: acceptanceStatus } } }],
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
  const completed = projectCurrentTopicStage(evolution(complete.acceptanceStatus), complete);
  assert.equal(completed.status, "completed");
  assert.equal(completed.deliveryEvidence.candidate.integrationSha, "final-candidate-sha");

  const missingRelease = deliveredCollaboration({ published: false });
  assert.equal(projectCurrentTopicStage(evolution(missingRelease.acceptanceStatus), missingRelease).status, "awaiting-release");

  const missingRestart = deliveredCollaboration({ restartHealthy: false });
  assert.equal(projectCurrentTopicStage(evolution(missingRestart.acceptanceStatus), missingRestart).status, "awaiting-restart-health");
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
  assert.match(manual.readRecovery.nextAction, /重新读取当前交付投影/);
});
