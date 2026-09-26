import test from "node:test";
import assert from "node:assert/strict";
import { releaseRestartArguments } from "../../../../build/ai-desktop/electron/electron/system/bootstrap/release-restart-arguments.js";

test("发布重启只保留独立用户目录且退役无人消费的验收隔离参数", () => {
  const identity = ["--ai-desktop-user-data-dir=/isolated/user-data"];
  const retired = ["--ai-desktop-acceptance-isolation-root=/isolated", "--ai-desktop-acceptance-protected-project-root=/formal", "--ai-desktop-acceptance-protected-user-data-root=/formal-data"];
  const args = releaseRestartArguments("/isolated/project", "new-sha", ["app", "--selplat-root=/old", "--ai-desktop-runtime-sha=old", "--ai-desktop-health-check-file=/old-health", ...identity, ...retired]);
  assert.deepEqual(args, ["--selplat-root=/isolated/project", "--ai-desktop-variant=developer", "--ai-desktop-runtime-sha=new-sha", ...identity]);
});
test("正式实例重启不产生隔离参数", () => {
  assert.equal(releaseRestartArguments("/formal", "sha", []).length, 3);
});

test("候选运行器激活只额外携带待恢复批次", () => {
  assert.deepEqual(
    releaseRestartArguments("/formal", "candidate-sha", ["app", "--ai-desktop-resume-release=stale"], "release-0.1.1-g9"),
    ["--selplat-root=/formal", "--ai-desktop-variant=developer", "--ai-desktop-runtime-sha=candidate-sha", "--ai-desktop-resume-release=release-0.1.1-g9"],
  );
});


test("只有正确包真实就绪才结束任务并回收工作树", async () => {
  const { VersionIntegrationPipeline } = await import("../../../../build/ai-desktop/electron/electron/services/support/capabilities/release/internal/version-integration.pipeline.js");
  const state = { members: [{ memberId: "linghu-ancestor", displayName: "令狐" }],
    tasks: [{ taskId: "original", state: "awaiting-restart", integrationGeneration: 17, versionWorkspace: { rootPath: "/original" }, flowEvents: [], resultSummary: {} }],
    integrationBatches: [{ generation: 17, state: "verified", integrationSha: "tested-sha", taskIds: ["original"] }],
  };
  const store = { state: () => structuredClone(state), updateTask: (id, _reason, update) => update(state.tasks.find((task) => task.taskId === id), state) };
  const retiredStates = [];
  const confirmedBatches = [];
  const durationEvents = [];
  const options = { store, actorMemberId: "linghu-ancestor", releaseVersion: "0.1.1", releaseBatches: {
    runningDocument: (batchId) => batchId === "release-0.1.1-g17" ? {
      releaseBatchId: batchId, state: "integrated", candidateSha: "tested-sha", executable: null,
      tasks: [{ taskId: "original", resultSha: "tested-result" }],
    } : null,
    confirmDeveloperRestart: (batchId) => confirmedBatches.push(batchId), retireRuntimeActivationPackage: () => undefined,
  }, durations: {
    start: (taskId, phase, detail) => { durationEvents.push(["start", taskId, phase, detail]); return "restart-health"; },
    finish: (spanId, status, detail) => durationEvents.push(["finish", spanId, status, detail]),
    instant: () => {},
  }, workspaces: { retireWorkspace: async () => { retiredStates.push(state.tasks[0].state); } } };
  assert.deepEqual(new VersionIntegrationPipeline({ ...options, loadedRuntimeSha: "other-sha" }).confirmPublishedRestart(), []);
  assert.deepEqual(confirmedBatches, []);
  assert.deepEqual(retiredStates, []);
  assert.deepEqual(new VersionIntegrationPipeline({ ...options, loadedRuntimeSha: "tested-sha" }).confirmPublishedRestart(), [17]);
  assert.deepEqual(confirmedBatches, ["release-0.1.1-g17"]);
  assert.deepEqual(durationEvents, [
    ["start", "original", "restart-health", { generation: 17, candidateSha: "tested-sha" }],
    ["finish", "restart-health", "completed", { generation: 17, candidateSha: "tested-sha" }],
  ]);
  await Promise.resolve();
  assert.deepEqual(retiredStates, ["integrated"]);
  assert.ok(state.tasks[0].versionWorkspace.retiredAt);
});
