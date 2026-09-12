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
    archiveRecords: [{ proposalId: "proposal-current", eventType: "acceptance.real_app_checked", occurredAt: "2026-09-12T04:42:19.000Z", payload: { acceptanceRun: { runId: "hanli-computer-db0e8dce-a91a-46c1-b63b-51f992e48243", status: acceptanceStatus } } }],
  };
}

test("最新真实验收失败覆盖已集成任务，投影保持失败待处理", () => {
  const stage = projectCurrentTopicStage(evolution("failed"), { tasks: [task()] });
  assert.equal(stage.status, "failed-pending-repair");
  assert.equal(stage.latestAcceptance?.runId, "hanli-computer-db0e8dce-a91a-46c1-b63b-51f992e48243");
  assert.deepEqual(stage.effectiveTaskIds, ["task-current"]);
});

test("没有失败验收事实时，待验收提案保持验收中", () => {
  const state = evolution("passed");
  state.archiveRecords = [];
  const stage = projectCurrentTopicStage(state, { tasks: [task()] });
  assert.equal(stage.status, "accepting");
});
