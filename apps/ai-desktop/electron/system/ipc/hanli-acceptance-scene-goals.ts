import type { AcceptanceSceneSegmentOutDto, HanliComputerAcceptanceInDto } from "../../../contracts/services/personas/hanli/index.js";

const COMPLETION_GATE_CRITERION = "确认当前真实窗口已进入目标专题的韩立验收阶段，任务卡可读、尚未误示为已完成，且页面没有阻止完成收口的错误。";

/** 按原条件编号取得阶段目标；模型不能用局部数组位置重编号。 */
export function createSegmentGoal(goal: HanliComputerAcceptanceInDto, segment: AcceptanceSceneSegmentOutDto): HanliComputerAcceptanceInDto {
  const criteria = segment.conditions.map(({ criterionId }) => {
    const index = Number(criterionId.replace("criterion-", "")) - 1;
    return goal.criteria[index];
  });
  const { workspaceAcceptanceFixture, ...segmentBase } = goal;
  return {
    ...segmentBase,
    ...(segment.kind === "workspace-explorer-fixture" && workspaceAcceptanceFixture ? { workspaceAcceptanceFixture } : {}),
    criteria,
    criterionIds: segment.conditions.map(({ criterionId }) => criterionId),
    preparedScene: segment,
  };
}

/** 完成前门使用独立的一项内部目标，绝不继承当前场景的原客户条件编号。 */
export function createCompletionGateGoal(segmentGoal: HanliComputerAcceptanceInDto): HanliComputerAcceptanceInDto {
  const { criterionIds: _originalCriterionIds, ...base } = segmentGoal;
  return {
    ...base,
    criteria: [COMPLETION_GATE_CRITERION],
    criterionIds: ["criterion-1"],
    reviewMode: "pre-completion-gate",
  };
}
