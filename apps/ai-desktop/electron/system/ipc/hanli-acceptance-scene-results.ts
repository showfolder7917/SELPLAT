import type { AcceptanceSceneSegmentOutDto, HanliAcceptanceRunOutDto, HanliAcceptanceStepResultOutDto, HanliComputerAcceptanceInDto } from "../../../contracts/services/personas/hanli/index.js";
import { acceptanceSceneSegmentCriterionIds } from "./hanli-acceptance-scene-goals.js";

/** 场景结果必须直接携带原提案编号；禁止在汇总时按位置猜测并重编号。 */
export function assertSegmentAcceptanceRun(run: HanliAcceptanceRunOutDto, segment: AcceptanceSceneSegmentOutDto): HanliAcceptanceRunOutDto {
  const expectedIds = acceptanceSceneSegmentCriterionIds(segment);
  const resultIds = run.stepResults.map(({ checkId }) => checkId);
  const hasExactResults = resultIds.length === expectedIds.length
    && new Set(resultIds).size === resultIds.length
    && expectedIds.every((criterionId) => resultIds.includes(criterionId));
  const judgementIds = run.stepResults.flatMap((step) => step.operation.type === "judgement" ? [step.operation.criterionId] : []);
  const hasMatchingJudgements = judgementIds.length === expectedIds.length
    && expectedIds.every((criterionId) => judgementIds.includes(criterionId));
  if (!hasExactResults || !hasMatchingJudgements) {
    throw new Error(`验收场景结果与原条件编号不一致：应为 ${expectedIds.join("、")}，实际为 ${resultIds.join("、") || "空"}`);
  }
  return run;
}

const acceptanceStatusPriority = { passed: 0, blocked: 1, failed: 2 } as const;

/** 关联场景把新增证据合入条件唯一结论，避免重复结论，也不能丢掉后续场景发现的失败。 */
export function appendRelatedAcceptanceRun(runs: HanliAcceptanceRunOutDto[], relatedRun: HanliAcceptanceRunOutDto, segment: AcceptanceSceneSegmentOutDto): void {
  for (const relatedResult of relatedRun.stepResults) {
    const ownerRun = runs.find((run) => run.stepResults.some((result) => result.checkId === relatedResult.checkId));
    const ownerResultIndex = ownerRun?.stepResults.findIndex((result) => result.checkId === relatedResult.checkId) ?? -1;
    if (!ownerRun || ownerResultIndex < 0 || !segment.relatedCriterionIds.includes(relatedResult.checkId)) {
      throw new Error(`关联场景找不到 ${relatedResult.checkId} 的唯一归属结论。`);
    }
    const ownerResult = ownerRun.stepResults[ownerResultIndex];
    const relatedFunctionIsWorse = acceptanceStatusPriority[relatedResult.status] > acceptanceStatusPriority[ownerResult.status];
    const relatedLayoutIsWorse = acceptanceStatusPriority[relatedResult.layoutStatus ?? "blocked"] > acceptanceStatusPriority[ownerResult.layoutStatus ?? "blocked"];
    ownerRun.stepResults[ownerResultIndex] = {
      ...ownerResult,
      status: relatedFunctionIsWorse ? relatedResult.status : ownerResult.status,
      actual: `${ownerResult.actual}\n${segment.reason}：${relatedResult.actual}`,
      screenshotAttachmentId: relatedFunctionIsWorse ? relatedResult.screenshotAttachmentId : ownerResult.screenshotAttachmentId,
      layoutStatus: relatedLayoutIsWorse ? relatedResult.layoutStatus : ownerResult.layoutStatus,
      layoutActual: `${ownerResult.layoutActual || "未记录"}\n${segment.reason}：${relatedResult.layoutActual || "未记录"}`,
      layoutScreenshotAttachmentId: relatedLayoutIsWorse ? relatedResult.layoutScreenshotAttachmentId : ownerResult.layoutScreenshotAttachmentId,
    };
    if (relatedFunctionIsWorse || relatedLayoutIsWorse) ownerRun.status = relatedRun.status;
  }
  // 关联运行只保留操作轨迹、整体状态和附件；条件结论已经合入唯一归属运行。
  runs.push({ ...relatedRun, stepResults: [] });
}

/** 多阶段只在此处合并状态和证据，人物验收器继续保持单窗口、单数据源职责。 */
export function mergeAcceptanceRuns(goal: HanliComputerAcceptanceInDto, runs: HanliAcceptanceRunOutDto[]): HanliAcceptanceRunOutDto {
  if (!runs.length) throw new Error("韩立尚未产生可汇总的验收结果。");
  const first = runs[0];
  const last = runs[runs.length - 1];
  const status = runs.some((run) => run.status === "failed")
    ? "failed"
    : runs.some((run) => run.status === "blocked") ? "blocked" : "passed";
  // 先按每段原始操作顺序拼接，再分别投影操作轨迹与逐条件结论，保证失败复现不会因场景汇总丢失真实输入。
  const timeline = runs.flatMap((run) => [...(run.interactionSteps || []), ...run.stepResults]
    .sort((left, right) => left.operationIndex - right.operationIndex))
    .map((step, operationIndex) => ({ ...step, operationIndex }));
  const interactionSteps: HanliAcceptanceStepResultOutDto[] = timeline.filter((step) => step.checkId === "interaction");
  const stepResults: HanliAcceptanceStepResultOutDto[] = timeline.filter((step) => step.operation.type === "judgement");
  return {
    ...last,
    runId: first.runId,
    topicId: goal.topicId,
    proposalId: goal.proposalId,
    criteria: goal.criteria,
    status,
    initialBounds: first.initialBounds,
    interactionSteps,
    stepResults,
    evidenceAttachmentIds: [...new Set(runs.flatMap((run) => run.evidenceAttachmentIds))],
    startedAt: first.startedAt,
    completedAt: last.completedAt,
  };
}
