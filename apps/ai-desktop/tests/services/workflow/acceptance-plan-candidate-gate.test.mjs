import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { controlledTestRoot } from "#test-paths";
import { verifyAcceptancePlanCapabilities } from "../../../../../build/ai-desktop/electron/electron/services/support/capabilities/release/internal/integration.verifier.js";

function writeCandidate(root, state, runtime, projection) {
  const desktop = path.join(root, "apps", "ai-desktop", "electron", "services");
  mkdirSync(path.join(desktop, "evolution", "internal"), { recursive: true });
  mkdirSync(path.join(desktop, "workflow", "internal", "evolution"), { recursive: true });
  mkdirSync(path.join(desktop, "workflow", "domain"), { recursive: true });
  writeFileSync(path.join(desktop, "evolution", "internal", "evolution-state.store.ts"), state);
  writeFileSync(path.join(desktop, "workflow", "internal", "evolution", "persona-evolution.runtime.ts"), runtime);
  writeFileSync(path.join(desktop, "workflow", "domain", "current-topic-stage.projection.ts"), projection);
}

test("最终候选缺少任一验收计划能力时不得进入统一测试", () => {
  const root = mkdtempSync(path.join(controlledTestRoot, "acceptance-plan-candidate-"));
  try {
    writeCandidate(root, "saveAcceptancePlan acceptance.plan_frozen reopenCompletedAcceptance acceptance.reopened decideResult(proposalId plan.conditions.find((condition) => condition.conditionId === step.checkId)", "plan.conditions.filter mode: \"mixed\" completeAutomaticAcceptance", "acceptanceRoundId currentRoundId");
    assert.doesNotThrow(() => verifyAcceptancePlanCapabilities(root));
    writeCandidate(root, "saveAcceptancePlan acceptance.plan_frozen reopenCompletedAcceptance acceptance.reopened decideResult(proposalId", "plan.conditions.filter mode: \"mixed\" completeAutomaticAcceptance", "acceptanceRoundId currentRoundId");
    assert.throws(() => verifyAcceptancePlanCapabilities(root), /失败归因/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
