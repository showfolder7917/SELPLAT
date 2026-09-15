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

test("独立验证一次收齐全部失败且不进入发布链", async () => {
  mkdirSync(controlledTestRoot, { recursive: true });
  const root = mkdtempSync(path.join(controlledTestRoot, "full-test-gate-"));
  const appRoot = path.join(root, "apps", "ai-desktop");
  mkdirSync(appRoot, { recursive: true });
  writeFileSync(path.join(appRoot, "package.json"), JSON.stringify({ scripts: {
    test: "node -e \"console.error('full-suite-regression');process.exit(17)\"",
    "test:interaction": "node -e \"require('fs').writeFileSync('interaction-ran','yes')\"",
    "test:collaboration": "node -e \"console.error('collaboration-regression');process.exit(19)\"",
    "test:managed": "node -e \"require('fs').writeFileSync('managed-ran','yes')\"",
    "package:mac:developer": "node -e \"require('fs').writeFileSync('package-must-not-run','bad')\"",
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
    await assert.rejects(runner.run(), (error) => {
      assert.equal(error.name, "UnifiedTestAggregateError");
      assert.deepEqual(error.failures.map((failure) => failure.script), ["test", "test:collaboration"]);
      assert.match(error.message, /full-suite-regression/);
      assert.match(error.message, /collaboration-regression/);
      return true;
    });
    assert.deepEqual(events.map(({type,details}) => [type,details.script]),
      [["gate.unified_test.started","test"],["gate.unified_test.failed","test"],
       ["gate.unified_test.started","test:interaction"],["gate.unified_test.completed","test:interaction"],
       ["gate.unified_test.started","test:collaboration"],["gate.unified_test.failed","test:collaboration"],
       ["gate.unified_test.started","test:managed"],["gate.unified_test.completed","test:managed"]]);
    assert.equal(existsSync(path.join(appRoot, "interaction-ran")), true);
    assert.equal(existsSync(path.join(appRoot, "managed-ran")), true);
    assert.equal(existsSync(path.join(appRoot, "package-must-not-run")), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("候选分别缺少每项验收计划能力时固定流程不执行全量测试", async () => {
  const root = mkdtempSync(path.join(controlledTestRoot, "missing-acceptance-capability-"));
  const appRoot = path.join(root, "apps", "ai-desktop");
  mkdirSync(appRoot, { recursive: true });
  writeFileSync(path.join(appRoot, "package.json"), JSON.stringify({ scripts: {
    test: "node -e \"require('fs').writeFileSync('must-not-run','bad')\"",
  }}));
  const state = path.join(root, "apps", "ai-desktop", "electron", "services", "evolution", "internal", "evolution-state.store.ts");
  const runtime = path.join(root, "apps", "ai-desktop", "electron", "services", "workflow", "internal", "evolution", "persona-evolution.runtime.ts");
  const candidates = [
    ["验收计划持久化", () => writeFileSync(state, "reopenCompletedAcceptance acceptance.reopened decideResult(proposalId plan.conditions.find((condition) => condition.conditionId === step.checkId)")],
    ["同专题重开", () => writeFileSync(state, "saveAcceptancePlan acceptance.plan_frozen decideResult(proposalId plan.conditions.find((condition) => condition.conditionId === step.checkId)")],
    ["混合证据汇总", () => writeFileSync(runtime, "plan.conditions.filter completeAutomaticAcceptance")],
    ["自动与人工共用完成门禁", () => writeFileSync(runtime, 'plan.conditions.filter mode: "mixed"')],
    ["失败归因", () => writeFileSync(state, "saveAcceptancePlan acceptance.plan_frozen reopenCompletedAcceptance acceptance.reopened decideResult(proposalId")],
  ];
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
    for (const [capability, removeCapability] of candidates) {
      writeAcceptancePlanCandidate(root);
      removeCapability();
      await assert.rejects(runner.run(), new RegExp(capability));
      assert.deepEqual(events, []);
      assert.equal(resourceRuns, 0);
      assert.equal(existsSync(path.join(appRoot, "must-not-run")), false);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
