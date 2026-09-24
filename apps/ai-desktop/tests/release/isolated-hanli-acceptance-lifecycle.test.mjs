import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import path from "node:path";
import test from "node:test";

import { acceptedHanliRunId, resolveIsolatedAcceptancePaths, superviseIsolatedAcceptance } from "../../scripts/run-isolated-hanli-acceptance.mjs";

function acceptedState() {
  const topicId = "topic-accepted";
  const proposalId = "proposal-accepted";
  const runId = "hanli-accepted-run";
  return {
    topics: [{ topicId, status: "completed" }],
    proposals: [{ topicId, proposalId, status: "completed", finalConclusionRecordId: "conclusion-1", acceptancePlan: {
      planId: "plan-1", currentRoundId: "round-1", conditions: [{ conditionId: "criterion-1" }, { conditionId: "criterion-2" }],
    } }],
    archiveRecords: [
      { recordId: "conclusion-1", topicId, proposalId, eventType: "proposal.result_decided", payload: {
        finalConclusion: { acceptanceRunId: runId, conditionResults: [{ status: "passed" }, { status: "passed" }] },
      } },
      { recordId: "acceptance-1", topicId, proposalId, eventType: "acceptance.result_checked", payload: {
        acceptanceRun: { runId, planId: "plan-1", acceptanceRoundId: "round-1", status: "passed", sourceReview: { status: "passed" },
          stepResults: [{ checkId: "criterion-1", status: "passed" }, { checkId: "criterion-2", status: "passed" }] },
      } },
    ],
  };
}

test("只有韩立同专题最终决定、源码审查和全部条件均通过才关闭隔离实例", () => {
  const state = acceptedState();
  assert.equal(acceptedHanliRunId(state, "topic-accepted"), "hanli-accepted-run");
  assert.equal(acceptedHanliRunId(state, "another-topic"), null);
  state.archiveRecords[1].payload.acceptanceRun.stepResults[1].status = "failed";
  assert.equal(acceptedHanliRunId(state, "topic-accepted"), null);
  state.archiveRecords[1].payload.acceptanceRun.stepResults[1].status = "passed";
  state.archiveRecords[1].payload.acceptanceRun.sourceReview.status = "blocked";
  assert.equal(acceptedHanliRunId(state, "topic-accepted"), null);
  state.archiveRecords[1].payload.acceptanceRun.sourceReview.status = "passed";
  state.archiveRecords[0].payload.finalConclusion.conditionResults.pop();
  assert.equal(acceptedHanliRunId(state, "topic-accepted"), null);
});

test("隔离验收启动器拒绝把正式工程根当作可关闭实例", () => {
  const sourceRoot = path.resolve("../..");
  assert.throws(() => resolveIsolatedAcceptancePaths(sourceRoot, sourceRoot), /隔离验收实例必须位于/);
});

test("验收通过时只向本次启动的子进程发送退出信号", async () => {
  const child = new EventEmitter();
  const signals = [];
  let passed = false;
  let launch;
  child.kill = (signal) => {
    signals.push(signal);
    queueMicrotask(() => child.emit("exit", null, signal));
    return true;
  };
  const waiting = superviseIsolatedAcceptance({
    executable: "/sandbox/AI Desktop.app/Contents/MacOS/AI Desktop", sandboxRoot: "/sandbox",
    userDataRoot: "/sandbox/user-data", topicId: "topic-accepted", pollIntervalMs: 5,
    readAcceptedRunId: () => passed ? "hanli-accepted-run" : null,
    spawnProcess: (executable, args, options) => { launch = { executable, args, options }; return child; },
  });
  assert.equal(signals.length, 0, "未通过前不得关闭测试实例");
  passed = true;
  const result = await waiting;
  assert.equal(result.acceptedRunId, "hanli-accepted-run");
  assert.deepEqual(signals, ["SIGTERM"]);
  assert.equal(launch.executable, "/sandbox/AI Desktop.app/Contents/MacOS/AI Desktop");
  assert.equal(launch.args.some((argument) => argument === "--selplat-root=/sandbox"), true);
});

test("隔离实例先退出不能冒充韩立验收完成", async () => {
  const child = new EventEmitter();
  child.kill = () => { throw new Error("不应发出退出信号"); };
  const waiting = superviseIsolatedAcceptance({
    executable: "/sandbox/AI Desktop", sandboxRoot: "/sandbox", userDataRoot: "/sandbox/user-data",
    topicId: "topic-accepted", pollIntervalMs: 5, readAcceptedRunId: () => null,
    spawnProcess: () => child,
  });
  queueMicrotask(() => child.emit("exit", 0, null));
  await assert.rejects(waiting, /正式验收通过前退出/);
});
