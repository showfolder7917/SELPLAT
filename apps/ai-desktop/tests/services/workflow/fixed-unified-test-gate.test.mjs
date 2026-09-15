import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { controlledTestRoot } from "#test-paths";
import { FixedUnifiedTestRunner } from "../../../../../build/ai-desktop/electron/electron/services/support/capabilities/testing/internal/fixed-unified-test.runner.js";

function writeAcceptancePlanCandidate(root) {
  const services = path.join(root, "apps", "ai-desktop", "electron", "services");
  const state = path.join(services, "evolution", "internal", "evolution-state.store.ts");
  const runtime = path.join(services, "workflow", "internal", "evolution", "persona-evolution.runtime.ts");
  const projection = path.join(services, "workflow", "domain", "current-topic-stage.projection.ts");
  mkdirSync(path.dirname(state), { recursive: true });
  mkdirSync(path.dirname(runtime), { recursive: true });
  mkdirSync(path.dirname(projection), { recursive: true });
  writeFileSync(state, "saveAcceptancePlan acceptance.plan_frozen reopenCompletedAcceptance acceptance.reopened decideResult(proposalId plan.conditions.find((condition) => condition.conditionId === step.checkId)");
  writeFileSync(runtime, 'plan.conditions.filter mode: "mixed" completeAutomaticAcceptance');
  writeFileSync(projection, "acceptanceRoundId currentRoundId");
}

test("全量测试失败时固定流程保留失败证据且不进入后续验证或发布", async () => {
  mkdirSync(controlledTestRoot, { recursive: true });
  const root = mkdtempSync(path.join(controlledTestRoot, "full-test-gate-"));
  const appRoot = path.join(root, "apps", "ai-desktop");
  mkdirSync(appRoot, { recursive: true });
  writeFileSync(path.join(appRoot, "package.json"), JSON.stringify({ scripts: {
    test: "node -e \"console.error('full-suite-regression');process.exit(17)\"",
    "test:interaction": "node -e \"require('fs').writeFileSync('should-not-run','bad')\"",
  }}));
  writeAcceptancePlanCandidate(root);
  const events = [];
  const runner = new FixedUnifiedTestRunner({
    sourceProjectRoot: root, applicationName: "ai-desktop", buildRoot: path.join(root, "build"),
    initiatorMemberId: "linghu-ancestor", eventNamespace: "gate",
    recordEvent: (type, details) => events.push({ type, details }),
    testResources: { run: async (_request, execute) => execute() },
  });
  try {
    await assert.rejects(runner.run(), /full-suite-regression/);
    assert.deepEqual(events.map(({type,details}) => [type,details.script]),
      [["gate.unified_test.started","test"],["gate.unified_test.failed","test"]]);
    assert.equal(existsSync(path.join(appRoot, "should-not-run")), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("候选缺少任一验收计划能力时固定流程不执行全量测试", async () => {
  const root = mkdtempSync(path.join(controlledTestRoot, "missing-acceptance-capability-"));
  const appRoot = path.join(root, "apps", "ai-desktop");
  mkdirSync(appRoot, { recursive: true });
  writeFileSync(path.join(appRoot, "package.json"), JSON.stringify({ scripts: {
    test: "node -e \"require('fs').writeFileSync('must-not-run','bad')\"",
  }}));
  // 删除失败归因能力时，候选门禁必须在任何固定脚本开始前拒绝。
  writeAcceptancePlanCandidate(root);
  const state = path.join(root, "apps", "ai-desktop", "electron", "services", "evolution", "internal", "evolution-state.store.ts");
  writeFileSync(state, "saveAcceptancePlan acceptance.plan_frozen reopenCompletedAcceptance acceptance.reopened decideResult(proposalId");
  const events = [];
  let resourceRuns = 0;
  const runner = new FixedUnifiedTestRunner({
    sourceProjectRoot: root, applicationName: "ai-desktop", buildRoot: path.join(root, "build"),
    initiatorMemberId: "linghu-ancestor", eventNamespace: "gate",
    recordEvent: (type, details) => events.push({ type, details }),
    testResources: { run: async (_request, execute) => {
      resourceRuns += 1;
      return execute();
    } },
  });
  try {
    await assert.rejects(runner.run(), /失败归因/);
    assert.deepEqual(events, []);
    assert.equal(resourceRuns, 0);
    assert.equal(existsSync(path.join(appRoot, "must-not-run")), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
