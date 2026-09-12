import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { transform } from "esbuild";

const source = readFileSync(new URL("../../../src/features/test-console/model/createTestConsoleViewModel.ts", import.meta.url), "utf8");
const transformed = await transform(source, { loader: "ts", format: "esm", target: "es2022" });
const { createTestConsoleViewModel } = await import(`data:text/javascript;base64,${Buffer.from(transformed.code).toString("base64")}`);

function task({
  taskId,
  proposalId = "proposal-current",
  state,
  replacementForTaskId = null,
  updatedAt = "2026-09-12T00:00:00.000Z",
  changes = "已完成当前修复",
  flowEvents = [],
  changedFiles = [],
  repairRequiresUserConfirmation = false,
}) {
  return {
    taskId,
    evolutionProposalId: proposalId,
    replacementForTaskId,
    state,
    updatedAt,
    createdAt: updatedAt,
    repairRequiresUserConfirmation,
    snapshot: { title: `${taskId} 标题`, confirmedIntent: changes, acceptanceCriteria: [] },
    resultSummary: { changes, solvedProblem: changes, remaining: "" },
    flowEvents,
    executionRecords: [{ changedFiles }],
    unifiedTest: null,
    blockingReason: null,
  };
}

function event(eventId, summary, status = "running") {
  return { eventId, summary, status, occurredAt: "2026-09-12T00:00:00.000Z", type: "execution.progress", details: { technicalEvidence: [] } };
}

function fixture({
  oneShotConfirmation = null,
  oneShotRun = null,
  proposals = [],
  topics = [],
  tasks = [],
  archiveRecords = [],
  currentTopicStage = undefined,
} = {}) {
  return {
    locale: "zh-CN",
    runtime: null,
    modelCatalog: { models: [] },
    modelCatalogLoaded: false,
    modelCatalogLoading: false,
    modelCatalogError: "",
    audit: null,
    collaboration: { tasks, updatedAt: "2026-09-12T00:00:00.000Z" },
    evolution: {
      oneShotConfirmation,
      oneShotRun,
      proposals,
      topics,
      archiveRecords,
      currentTopicStage,
      updatedAt: "2026-09-12T00:00:00.000Z",
    },
  };
}

function stage({
  status = "executing",
  title = "当前专题",
  effectiveTaskIds = ["task-current"],
  missingTaskIds = [],
  repairContent = "当前专题的修复内容",
  latestAcceptance = null,
} = {}) {
  return {
    topicId: "topic-current", proposalId: "proposal-current", status, title, summary: "当前专题统一状态说明", repairContent,
    remaining: "", effectiveTaskIds, missingTaskIds, latestAcceptance, updatedAt: "2026-09-12T00:00:00.000Z",
  };
}

function currentProposal(distributedTaskIds) {
  return {
    proposalId: "proposal-current",
    topicId: "topic-current",
    title: "当前专题",
    content: "当前专题的修复说明",
    evidence: [],
    acceptanceCriteria: [],
    distributedTaskIds,
    status: "executing",
    updatedAt: "2026-09-12T00:00:00.000Z",
  };
}

test("等待用户确认且没有任务时不显示当前修复、进行中或历史记录", () => {
  const viewModel = createTestConsoleViewModel(fixture({
    oneShotConfirmation: { status: "awaiting-user-confirmation", createdAt: "2026-09-12T00:00:00.000Z" },
    currentTopicStage: stage({ status: "awaiting-confirmation", title: "等待用户确认", effectiveTaskIds: [], repairContent: "" }),
  }));

  assert.equal(viewModel.summary.statusCode, "awaiting-confirmation");
  assert.equal(viewModel.summary.status, "等待用户确认");
  assert.equal(viewModel.summary.title, "等待用户确认");
  assert.equal(viewModel.summary.change, "");
  assert.deepEqual(viewModel.history, []);
  assert.deepEqual(viewModel.details.changedFiles, []);
});

test("只有当前专题的有效执行任务才显示进行中与对应记录", () => {
  const activeTask = task({ taskId: "task-current", state: "executing", flowEvents: [event("current-event", "当前任务正在执行")], changedFiles: ["src/features/test-console/model/createTestConsoleViewModel.ts"] });
  const staleTask = task({ taskId: "task-stale", proposalId: "proposal-stale", state: "executing", flowEvents: [event("stale-event", "历史任务不应出现")], changes: "历史修复" });
  const viewModel = createTestConsoleViewModel(fixture({
    oneShotRun: { proposalId: "proposal-current", topicId: "topic-current", status: "running" },
    proposals: [currentProposal(["task-current"])],
    topics: [{ topicId: "topic-current", title: "当前专题" }],
    tasks: [activeTask, staleTask],
    currentTopicStage: stage({ status: "executing" }),
  }));

  assert.equal(viewModel.summary.statusCode, "executing");
  assert.equal(viewModel.summary.status, "进行中");
  assert.deepEqual(viewModel.history.map((item) => item.id), ["current-event"]);
  assert.deepEqual(viewModel.details.changedFiles, ["src/features/test-console/model/createTestConsoleViewModel.ts"]);
});

test("修复替代链以最新有效任务决定完成状态，旧失败任务不能覆盖结果", () => {
  const original = task({ taskId: "task-original", state: "failed", flowEvents: [event("original-failure", "旧失败记录", "failed")], changes: "旧失败内容" });
  const repaired = task({ taskId: "task-repaired", state: "integrated", replacementForTaskId: "task-original", flowEvents: [event("repair-complete", "修复已完成", "completed")], changes: "修复完成内容" });
  const viewModel = createTestConsoleViewModel(fixture({
    oneShotRun: { proposalId: "proposal-current", topicId: "topic-current", status: "running" },
    proposals: [currentProposal(["task-original"])],
    topics: [{ topicId: "topic-current", title: "当前专题" }],
    tasks: [original, repaired],
    currentTopicStage: stage({ status: "accepting", effectiveTaskIds: ["task-repaired"], repairContent: "修复完成内容" }),
  }));

  assert.equal(viewModel.summary.statusCode, "accepting");
  assert.equal(viewModel.summary.change, "修复完成内容");
  assert.deepEqual(viewModel.history.map((item) => item.id), ["repair-complete"]);
});

test("失败状态和归档记录只使用当前专题的有效任务链", () => {
  const failedTask = task({ taskId: "task-current", state: "blocked", flowEvents: [event("current-failure", "当前任务失败", "failed")] });
  const archiveRecords = [
    { recordId: "current-record", proposalId: "proposal-current", category: "recovery", title: "当前专题恢复记录", occurredAt: "2026-09-12T00:00:01.000Z" },
    { recordId: "stale-record", proposalId: "proposal-stale", category: "recovery", title: "历史专题记录", occurredAt: "2026-09-12T00:00:02.000Z" },
  ];
  const viewModel = createTestConsoleViewModel(fixture({
    oneShotRun: { proposalId: "proposal-current", topicId: "topic-current", status: "blocked" },
    proposals: [currentProposal(["task-current"])],
    topics: [{ topicId: "topic-current", title: "当前专题" }],
    tasks: [failedTask],
    archiveRecords,
    currentTopicStage: stage({ status: "failed-pending-repair" }),
  }));

  assert.equal(viewModel.summary.statusCode, "failed-pending-repair");
  assert.deepEqual(viewModel.history.map((item) => item.id), ["current-record", "current-failure"]);
});

test("最新真实验收失败优先于已集成任务，顶部与验收区使用同一专题阶段", () => {
  const integrated = task({ taskId: "task-current", state: "integrated", changes: "旧任务已经集成" });
  const input = fixture({
    proposals: [currentProposal(["task-current"])],
    topics: [{ topicId: "topic-current", title: "当前专题" }],
    tasks: [integrated],
  });
  input.evolution.currentTopicStage = stage({
    status: "failed-pending-repair",
    repairContent: "修正测试台状态矛盾",
    latestAcceptance: { runId: "hanli-computer-db0e8dce-a91a-46c1-b63b-51f992e48243", status: "failed", occurredAt: "2026-09-12T04:42:19.000Z" },
  });

  const viewModel = createTestConsoleViewModel(input);
  assert.equal(viewModel.summary.status, "失败待处理");
  assert.equal(viewModel.summary.change, "修正测试台状态矛盾");
  assert.equal(viewModel.checks.find((item) => item.id === "acceptance")?.status, "failed");
});


test("页面缺少运行时投影时不再根据研讨或任务快照自行猜测专题阶段", () => {
  const input = fixture({ oneShotRun: { status: "running", phase: "preparing-topic", proposalId: null } });
  const confirmation = { offer: "测试台状态修正范围", reply: null, offeredAt: "2026-09-12T03:33:56.027Z" };
  input.evolution.deliberations = [{ status: "ready-to-establish", rounds: [{ confirmation }] }];
  assert.equal(createTestConsoleViewModel(input).summary.statusCode, "not-run");
});

test("缺少正式投影时即使旧运行快照处于验收也不推断阶段", () => {
  const acceptingTask = task({ taskId: "task-current", state: "integrated", changes: "补齐任务完成后的验收恢复判断" });
  const input = fixture({
    oneShotRun: { topicId: "topic-current", proposalId: "proposal-current", phase: "accepting", status: "running", action: "正在真实界面验收", updatedAt: "2026-09-12T00:00:00.000Z" },
    proposals: [currentProposal(["task-current"])],
    topics: [{ topicId: "topic-current", title: "修复鼠标点击后持续转圈" }],
    tasks: [acceptingTask],
  });

  const viewModel = createTestConsoleViewModel(input);
  assert.equal(viewModel.summary.statusCode, "not-run");
  assert.equal(viewModel.summary.title, "暂无修复任务");
  assert.equal(viewModel.summary.change, "");
});
