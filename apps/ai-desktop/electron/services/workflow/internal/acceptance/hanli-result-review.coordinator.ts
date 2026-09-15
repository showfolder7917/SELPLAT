import type { EvolutionAcceptancePlanOutDto } from "../../../../../contracts/services/evolution/index.js";
import type { HanliAcceptanceRunOutDto } from "../../../../../contracts/services/personas/hanli/index.js";
import type { CollaborationTaskOutDto } from "../../../../../contracts/services/workflow/index.js";

/** 韩立只接收客户要求、交付摘要、工程门禁状态和变更文件，不接收详细测试流水。 */
export function buildHanliResultReviewContext(tasks: CollaborationTaskOutDto[]): unknown[] {
  return tasks.map((task) => ({
    taskId: task.taskId,
    requirement: {
      title: task.snapshot.title,
      problemStatement: task.snapshot.problemStatement,
      confirmedIntent: task.snapshot.confirmedIntent,
      constraints: task.snapshot.constraints,
      acceptanceCriteria: task.snapshot.acceptanceCriteria,
    },
    resultSummary: task.resultSummary,
    finalResult: task.finalResult,
    engineeringGate: task.unifiedTest?.status || null,
    changedFiles: [...new Set(task.executionRecords.flatMap((record) => record.changedFiles))],
  }));
}

/** 合并正式页面结果与独立源码审查，保证每条客户条件只有一个最终结论。 */
export function composeHanliResultReview(
  plan: EvolutionAcceptancePlanOutDto,
  sourceRun: HanliAcceptanceRunOutDto,
  pageRun: HanliAcceptanceRunOutDto,
): HanliAcceptanceRunOutDto {
  const pageCriterionIds = plan.conditions.filter((item) => item.evidenceType === "page-experience").map((item) => item.conditionId);
  const expectedIds = new Set(pageCriterionIds);
  if (pageRun.stepResults.length !== pageCriterionIds.length || pageRun.stepResults.some((step) => !expectedIds.has(step.checkId))) {
    throw new Error("正式页面检查结果没有与已登记的原始条件逐项对应。");
  }
  const stepResults = [...sourceRun.stepResults, ...pageRun.stepResults]
    .sort((left, right) => Number(left.checkId.slice("criterion-".length)) - Number(right.checkId.slice("criterion-".length)))
    .map((step, operationIndex) => ({ ...step, operationIndex }));
  const failed = sourceRun.sourceReview?.status === "failed"
    || stepResults.some((step) => step.status === "failed" || step.layoutStatus === "failed");
  const blocked = sourceRun.sourceReview?.status === "blocked"
    || stepResults.some((step) => step.status === "blocked" || step.layoutStatus === "blocked");
  return {
    ...pageRun,
    mode: "mixed",
    planId: plan.planId,
    acceptanceRoundId: plan.currentRoundId,
    criteria: plan.conditions.map((item) => item.criterion),
    pageCriterionIds,
    sourceReview: sourceRun.sourceReview,
    status: failed ? "failed" : blocked ? "blocked" : "passed",
    stepResults,
  };
}
