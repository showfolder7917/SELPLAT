import type { AcceptanceSceneSegmentOutDto, HanliAcceptanceRunOutDto, HanliAcceptanceStepResultOutDto, HanliComputerAcceptanceInDto } from "../../../contracts/services/personas/hanli/index.js";

/** 按原条件编号取得阶段条件，模型不能用数组位置把一个场景的事实套到另一个条件。 */
export function createSegmentGoal(goal: HanliComputerAcceptanceInDto, segment: AcceptanceSceneSegmentOutDto): HanliComputerAcceptanceInDto {
  const criteria = segment.conditions.map(({ criterionId }) => {
    const index = Number(criterionId.replace("criterion-", "")) - 1;
    return goal.criteria[index];
  });
  const { workspaceAcceptanceFixture, ...segmentBase } = goal;
  // 一次性夹具只能交给正式夹具段，避免前置当前窗口段提前登记并消耗本轮场景状态。
  return {
    ...segmentBase,
    ...(segment.kind === "workspace-explorer-fixture" && workspaceAcceptanceFixture ? { workspaceAcceptanceFixture } : {}),
    criteria,
    criterionIds: segment.conditions.map(({ criterionId }) => criterionId),
    preparedScene: segment,
  };
}

/** 场景结果必须直接携带原提案编号；禁止在汇总时按位置猜测并重编号。 */
export function assertSegmentAcceptanceRun(run: HanliAcceptanceRunOutDto, segment: AcceptanceSceneSegmentOutDto): HanliAcceptanceRunOutDto {
  const expectedIds = segment.conditions.map(({ criterionId }) => criterionId);
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
