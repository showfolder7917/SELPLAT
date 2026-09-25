import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { controlledTestRoot } from "#test-paths";
import { verifyAcceptancePlanCapabilities } from "../../../electron/services/support/capabilities/release/internal/integration.verifier.ts";
import { readAcceptancePlanCandidateSources } from "../../../electron/services/support/capabilities/release/internal/acceptance-plan-candidate-source.ts";

function writeCandidate(root, candidate) {
  const desktop = path.join(root, "apps", "ai-desktop", "electron", "services");
  mkdirSync(path.join(desktop, "evolution", "internal"), { recursive: true });
  mkdirSync(path.join(desktop, "workflow", "internal", "evolution"), { recursive: true });
  mkdirSync(path.join(desktop, "workflow", "domain"), { recursive: true });
  mkdirSync(path.join(desktop, "personas", "hanli", "internal", "application"), { recursive: true });
  mkdirSync(path.join(desktop, "support", "capabilities", "release", "internal"), { recursive: true });
  mkdirSync(path.join(root, "apps", "ai-desktop", "prompts", "personas", "hanli"), { recursive: true });
  writeFileSync(path.join(desktop, "evolution", "internal", "evolution-state.store.ts"), candidate.state);
  writeFileSync(path.join(desktop, "workflow", "internal", "evolution", "persona-evolution.runtime.ts"), candidate.runtime);
  writeFileSync(path.join(desktop, "workflow", "domain", "current-topic-stage.projection.ts"), candidate.projection);
  writeFileSync(path.join(desktop, "personas", "hanli", "internal", "application", "hanli-application.service.ts"), candidate.application);
  writeFileSync(path.join(desktop, "support", "capabilities", "release", "internal", "version-integration.pipeline.ts"), candidate.preflight);
  writeFileSync(path.join(root, "apps", "ai-desktop", "prompts", "personas", "hanli", "result-acceptance.md"), candidate.prompt);
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
      completeAutomaticAcceptance
      buildHanliResultReviewContext(
        acceptanceTasks,
        topic.workspaceState,
        proposalSourceTasks,
        plan?.sourceEvidenceFiles || [],
      )`,
      projection: "acceptanceRoundId currentRoundId",
      application: "version: 3 version-integration.pipeline.ts",
      preflight: "appendQuickPreflightDecision preflight.issues_found preflight.rerun_required",
      prompt: "acceptancePlan.version 为 2 或 3 sourceEvidenceFiles 清单以外文件",
    };
    writeCandidate(root, complete);
    assert.doesNotThrow(() => verifyAcceptancePlanCapabilities(root));
    const missingCapabilities = [
      ["验收计划持久化", { ...complete, state: complete.state.replace("acceptance.plan_frozen", "") }],
      ["同专题重开", { ...complete, state: complete.state.replace("acceptance.reopened", "") }],
      ["混合证据汇总", { ...complete, runtime: complete.runtime.replace('review.mode === "mixed"', "review.mode === \"code\"") }],
      ["混合证据汇总", { ...complete, runtime: complete.runtime.replace('item.evidenceType === "page-experience"', 'item.evidenceType === "code"') }],
      ["混合证据汇总", { ...complete, runtime: complete.runtime.replace("composeHanliResultReview(plan, review, pageRun)", "composeHanliResultReview(plan, review, codeRun)") }],
      ["自动与人工共用完成门禁", { ...complete, runtime: complete.runtime.replace("completeAutomaticAcceptance", "") }],
      ["失败归因", { ...complete, state: complete.state.replace("plan.conditions.find((condition) => condition.conditionId === step.checkId)", "") }],
      ["v3 冻结验收证据链", { ...complete, application: complete.application.replace("version-integration.pipeline.ts", "") }],
      ["v3 冻结验收证据链", { ...complete, runtime: complete.runtime.replace("plan?.sourceEvidenceFiles", "undefined") }],
      ["v3 冻结验收证据链", { ...complete, preflight: complete.preflight.replace("preflight.rerun_required", "") }],
      ["v3 冻结验收证据链", { ...complete, prompt: complete.prompt.replace("acceptancePlan.version 为 2 或 3", "acceptancePlan.version 为 2") }],
    ];
    for (const [capability, candidate] of missingCapabilities) {
      writeCandidate(root, candidate);
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
