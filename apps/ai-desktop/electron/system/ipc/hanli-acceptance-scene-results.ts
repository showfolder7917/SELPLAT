import type { AcceptanceSceneSegmentOutDto, HanliAcceptanceRunOutDto, HanliAcceptanceStepResultOutDto, HanliComputerAcceptanceInDto } from "../../../contracts/services/personas/hanli/index.js";

/** 按原条件编号取得阶段条件，模型不能用数组位置把一个场景的事实套到另一个条件。 */
export function createSegmentGoal(goal: HanliComputerAcceptanceInDto, segment: AcceptanceSceneSegmentOutDto): HanliComputerAcceptanceInDto {
  const criteria = segment.conditions.map(({ criterionId }) => {
    const index = Number(criterionId.replace("criterion-", "")) - 1;
    return goal.criteria[index];
  });
  return { ...goal, criteria, preparedScene: segment };
}

/** 把阶段内局部编号还原为原提案编号，最终任务卡只保存一套可追溯条件。 */
export function remapAcceptanceRun(run: HanliAcceptanceRunOutDto, segment: AcceptanceSceneSegmentOutDto): HanliAcceptanceRunOutDto {
  const mapCriterionId = (criterionId: string) => {
    const index = Number(criterionId.replace("criterion-", "")) - 1;
    return segment.conditions[index]?.criterionId || criterionId;
  };
  return {
    ...run,
    stepResults: run.stepResults.map((step) => ({
      ...step,
      checkId: mapCriterionId(step.checkId),
      operation: step.operation.type === "judgement"
        ? { ...step.operation, criterionId: mapCriterionId(step.operation.criterionId) }
        : step.operation,
    })),
  };
}

/** 多阶段只在此处合并状态和证据，人物验收器继续保持单窗口、单数据源职责。 */
export function mergeAcceptanceRuns(goal: HanliComputerAcceptanceInDto, runs: HanliAcceptanceRunOutDto[]): HanliAcceptanceRunOutDto {
  if (!runs.length) throw new Error("韩立尚未产生可汇总的验收结果。");
  const first = runs[0];
  const last = runs[runs.length - 1];
  const status = runs.some((run) => run.status === "failed")
    ? "failed"
    : runs.some((run) => run.status === "blocked") ? "blocked" : "passed";
  const stepResults: HanliAcceptanceStepResultOutDto[] = runs.flatMap((run) => run.stepResults)
    .map((step, operationIndex) => ({ ...step, operationIndex }));
  return {
    ...last,
    runId: first.runId,
    topicId: goal.topicId,
    proposalId: goal.proposalId,
    criteria: goal.criteria,
    status,
    initialBounds: first.initialBounds,
    stepResults,
    evidenceAttachmentIds: [...new Set(runs.flatMap((run) => run.evidenceAttachmentIds))],
    startedAt: first.startedAt,
    completedAt: last.completedAt,
  };
}
