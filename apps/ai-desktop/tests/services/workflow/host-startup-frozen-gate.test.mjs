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

function stageFor(command) {
  const state = {
    updatedAt: "2026-09-19T00:00:02.000Z",
    oneShotConfirmation: null,
    oneShotRun: { proposalId: "proposal-current" },
    proposals: [{ proposalId: "proposal-current", topicId: "topic-current", title: "Host 启动验收", status: "pending-acceptance", distributedTaskIds: ["task-current"] }],
    topics: [{ topicId: "topic-current", title: "Host 启动验收" }],
    deliberations: [],
    archiveRecords: [{
      topicId: "topic-current", proposalId: "proposal-current", eventType: "host-startup.evidence-recorded", occurredAt: "2026-09-19T00:00:02.000Z",
      payload: { hostStartupEvidence: {
        launchId: "host-1", handler: "启动SELPLAT.command", startedAt: "2026-09-19T00:00:00.000Z",
        command: { launchId: "host-1", ...command },
        health: { launchId: "host-1", success: true, checkedAt: "2026-09-19T00:00:01.000Z", summary: '{"success":true,"status":"READY"}' },
        evidenceReferences: ["启动SELPLAT.command"],
      } },
    }],
  };
  const task = { taskId: "task-current", evolutionProposalId: "proposal-current", state: "integrated", createdAt: "2026-09-19T00:00:00.000Z", updatedAt: "2026-09-19T00:00:00.000Z", snapshot: { title: "Host 启动验收" }, flowEvents: [] };
  return projectCurrentTopicStage(state, { tasks: [task] }).hostStartupAcceptance;
}

test("运行中即使 8080 health 成功也不能越过真实退出码门禁", () => {
  assert.equal(stageFor({ state: "running", exitCode: null }).status, "unverified");
  assert.equal(stageFor({ state: "exited", exitCode: 1 }).status, "unverified");
  assert.equal(stageFor({ state: "exited", exitCode: 0 }).status, "passed");
});
