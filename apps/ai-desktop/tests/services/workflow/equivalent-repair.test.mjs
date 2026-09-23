import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const result = await build({
  entryPoints: [fileURLToPath(new URL("../../../electron/services/workflow/domain/equivalent-repair.ts", import.meta.url))],
  bundle: true, format: "cjs", platform: "node", packages: "external", write: false,
});
const compiled = { exports: {} };
new Function("require", "module", "exports", result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const { findIntegratedEquivalentRepair } = compiled.exports;

const repair = (overrides = {}) => ({
  taskId: "old", automationSource: "linghu-safeguard", evolutionProposalId: "proposal-1", state: "blocked",
  createdAt: "2026-09-23T04:56:51.005Z", snapshot: { problemStatement: "same failure", confirmedIntent: "same repair" },
  ...overrides,
});

test("后续等价令狐修复已集成时，旧卡点不再派发", () => {
  const old = repair();
  const next = repair({ taskId: "new", state: "integrated", createdAt: "2026-09-23T06:46:11.490Z" });
  assert.equal(findIntegratedEquivalentRepair(old, { tasks: [old, next] }), next);
  assert.equal(findIntegratedEquivalentRepair(next, { tasks: [old, next] }), null);
});

test("不同提案、故障事实或未集成结果不得误退役旧任务", () => {
  const old = repair();
  for (const changed of [
    { evolutionProposalId: "proposal-2" }, { snapshot: { problemStatement: "new failure", confirmedIntent: "same repair" } },
    { state: "executing" }, { createdAt: "2026-09-23T03:00:00.000Z" },
  ]) {
    const next = repair({ taskId: "new", state: "integrated", createdAt: "2026-09-23T06:46:11.490Z", ...changed });
    assert.equal(findIntegratedEquivalentRepair(old, { tasks: [old, next] }), null);
  }
});
