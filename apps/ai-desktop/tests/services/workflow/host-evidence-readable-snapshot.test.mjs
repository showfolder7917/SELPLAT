import assert from "node:assert/strict";
import { build } from "esbuild";
import test from "node:test";
import { fileURLToPath } from "node:url";

const result = await build({
  entryPoints: [fileURLToPath(new URL("../../../electron/services/workflow/domain/current-topic-stage.projection.ts", import.meta.url))],
  bundle: true, format: "esm", platform: "node", target: "es2022", write: false,
});
const { projectCurrentTopicStage } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);

test("Host 验收不能用可访问的引用文字代替本次归档的原始证据", () => {
  const healthResponse = '{"success":true,"data":{"status":"READY"}}';
  const evidence = {
    launchId: "host-1", handler: "启动SELPLAT.command", startedAt: "2026-09-19T00:00:00.000Z",
    command: { launchId: "host-1", state: "exited", exitCode: 0 },
    health: { launchId: "host-1", success: true, checkedAt: "2026-09-19T00:00:01.000Z", summary: healthResponse },
    evidenceReferences: ["启动SELPLAT.command", "http://localhost:8080/api/platform/runtime/health"],
    evidence: { status: "readable", reason: "当前文件可访问" },
  };
  const state = {
    updatedAt: "2026-09-19T00:00:02.000Z", oneShotConfirmation: null,
    oneShotRun: { proposalId: "proposal-current" },
    proposals: [{ proposalId: "proposal-current", topicId: "topic-current", title: "Host 启动验收", status: "pending-acceptance", distributedTaskIds: ["task-current"] }],
    topics: [{ topicId: "topic-current", title: "Host 启动验收" }], deliberations: [],
    archiveRecords: [{ topicId: "topic-current", proposalId: "proposal-current", eventType: "host-startup.evidence-recorded", occurredAt: "2026-09-19T00:00:02.000Z", payload: { hostStartupEvidence: evidence } }],
  };
  const task = { taskId: "task-current", evolutionProposalId: "proposal-current", state: "integrated", createdAt: "2026-09-19T00:00:00.000Z", updatedAt: "2026-09-19T00:00:00.000Z", snapshot: { title: "Host 启动验收" }, flowEvents: [] };
  const read = () => projectCurrentTopicStage(state, { tasks: [task] }).hostStartupAcceptance;
  assert.equal(read().status, "unverified");
  evidence.evidenceSnapshot = { launcherSource: "#!/bin/zsh\necho startup", healthResponse };
  assert.equal(read().status, "unverified");
  evidence.evidenceReferences = ["archive://host-startup/host-1/launcherSource", "archive://host-startup/host-1/healthResponse"];
  assert.equal(read().status, "passed");
  evidence.evidenceSnapshot.healthResponse = "无法读取";
  assert.equal(read().status, "unverified");
  evidence.evidenceSnapshot.healthResponse = healthResponse;
  evidence.evidenceReferences[1] = "archive://host-startup/another-launch/healthResponse";
  assert.equal(read().status, "unverified");
  evidence.evidenceReferences[1] = "archive://host-startup/host-1/healthResponse";
  evidence.evidenceReferences.push("http://localhost:8080/api/platform/runtime/health");
  assert.equal(read().status, "unverified");
});
