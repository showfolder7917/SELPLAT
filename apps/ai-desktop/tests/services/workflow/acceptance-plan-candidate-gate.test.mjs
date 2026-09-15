import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { controlledTestRoot } from "#test-paths";
import { verifyAcceptancePlanCapabilities } from "../../../electron/services/support/capabilities/release/internal/integration.verifier.ts";
import { readAcceptancePlanCandidateSources } from "../../../electron/services/support/capabilities/release/internal/acceptance-plan-candidate-source.ts";

function writeCandidate(root, state, runtime, projection) {
  const desktop = path.join(root, "apps", "ai-desktop", "electron", "services");
  mkdirSync(path.join(desktop, "evolution", "internal"), { recursive: true });
  mkdirSync(path.join(desktop, "workflow", "internal", "evolution"), { recursive: true });
  mkdirSync(path.join(desktop, "workflow", "domain"), { recursive: true });
  writeFileSync(path.join(desktop, "evolution", "internal", "evolution-state.store.ts"), state);
  writeFileSync(path.join(desktop, "workflow", "internal", "evolution", "persona-evolution.runtime.ts"), runtime);
  writeFileSync(path.join(desktop, "workflow", "domain", "current-topic-stage.projection.ts"), projection);
}

test("最终候选分别缺少每项验收计划能力时不得进入统一测试", () => {
  const root = mkdtempSync(path.join(controlledTestRoot, "acceptance-plan-candidate-"));
  try {
    const complete = {
      state: "saveAcceptancePlan acceptance.plan_frozen reopenCompletedAcceptance acceptance.reopened decideResult(proposalId plan.conditions.find((condition) => condition.conditionId === step.checkId)",
      runtime: `if (review.mode === "mixed") {
        const pageCriterionIds = plan.conditions.filter((item) => item.evidenceType === "page-experience");
        runResult = composeHanliResultReview(plan, review, pageRun);
      }
      completeAutomaticAcceptance`,
      projection: "acceptanceRoundId currentRoundId",
    };
    writeCandidate(root, complete.state, complete.runtime, complete.projection);
    assert.doesNotThrow(() => verifyAcceptancePlanCapabilities(root));
    const missingCapabilities = [
      ["验收计划持久化", { ...complete, state: complete.state.replace("acceptance.plan_frozen", "") }],
      ["同专题重开", { ...complete, state: complete.state.replace("acceptance.reopened", "") }],
      ["混合证据汇总", { ...complete, runtime: complete.runtime.replace('review.mode === "mixed"', "review.mode === \"code\"") }],
      ["混合证据汇总", { ...complete, runtime: complete.runtime.replace('item.evidenceType === "page-experience"', 'item.evidenceType === "code"') }],
      ["混合证据汇总", { ...complete, runtime: complete.runtime.replace("composeHanliResultReview(plan, review, pageRun)", "composeHanliResultReview(plan, review, codeRun)") }],
      ["自动与人工共用完成门禁", { ...complete, runtime: complete.runtime.replace("completeAutomaticAcceptance", "") }],
      ["失败归因", { ...complete, state: complete.state.replace("plan.conditions.find((condition) => condition.conditionId === step.checkId)", "") }],
    ];
    for (const [capability, candidate] of missingCapabilities) {
      writeCandidate(root, candidate.state, candidate.runtime, candidate.projection);
      assert.throws(() => verifyAcceptancePlanCapabilities(root), new RegExp(capability));
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("候选材料缺少验收计划源码时报告材料装配错误", () => {
  const root = mkdtempSync(path.join(controlledTestRoot, "acceptance-plan-material-"));
  try {
    assert.throws(
      () => readAcceptancePlanCandidateSources(path.join(root, "apps", "ai-desktop")),
      /最终候选材料不完整：缺少 electron\/services\/evolution\/internal\/evolution-state\.store\.ts/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
