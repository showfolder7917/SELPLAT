import test from "node:test";
import assert from "node:assert/strict";
import { releaseRestartArguments } from "../../../../build/ai-desktop/electron/electron/system/bootstrap/release-restart-arguments.js";

test("发布重启保留隔离身份且更新版本，不携带旧健康检查", () => {
  const identity = ["--ai-desktop-user-data-dir=/isolated/user-data", "--ai-desktop-acceptance-isolation-root=/isolated", "--ai-desktop-acceptance-protected-project-root=/formal", "--ai-desktop-acceptance-protected-user-data-root=/formal-data"];
  const args = releaseRestartArguments("/isolated/project", "new-sha", ["app", "--selplat-root=/old", "--ai-desktop-runtime-sha=old", "--ai-desktop-health-check-file=/old-health", ...identity]);
  assert.deepEqual(args, ["--selplat-root=/isolated/project", "--ai-desktop-variant=developer", "--ai-desktop-runtime-sha=new-sha", ...identity]);
});
test("正式实例重启不产生隔离参数", () => {
  assert.equal(releaseRestartArguments("/formal", "sha", []).length, 3);
});


test("只有正确包真实就绪才结束任务并回收工作树", async () => {
  const { VersionIntegrationPipeline } = await import("../../../../build/ai-desktop/electron/electron/services/support/capabilities/release/internal/version-integration.pipeline.js");
  const state = { members: [{ memberId: "linghu-ancestor", displayName: "令狐" }],
    tasks: [{ taskId: "original", state: "awaiting-restart", integrationGeneration: 17, versionWorkspace: { rootPath: "/original" }, flowEvents: [], resultSummary: {} }],
    integrationBatches: [{ generation: 17, state: "verified", integrationSha: "tested-sha", taskIds: ["original"] }],
  };
  const store = { state: () => structuredClone(state), updateTask: (id, _reason, update) => update(state.tasks.find((task) => task.taskId === id), state) };
  const retiredStates = [];
  const options = { store, actorMemberId: "linghu-ancestor", durations: { instant: () => {} }, workspaces: { retireWorkspace: async () => { retiredStates.push(state.tasks[0].state); } } };
  assert.deepEqual(new VersionIntegrationPipeline({ ...options, loadedRuntimeSha: "other-sha" }).confirmPublishedRestart(), []);
  assert.deepEqual(retiredStates, []);
  assert.deepEqual(new VersionIntegrationPipeline({ ...options, loadedRuntimeSha: "tested-sha" }).confirmPublishedRestart(), [17]);
  await Promise.resolve();
  assert.deepEqual(retiredStates, ["integrated"]);
  assert.ok(state.tasks[0].versionWorkspace.retiredAt);
});
