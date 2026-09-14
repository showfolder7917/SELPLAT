import type { AcceptanceSceneSegmentOutDto, HanliComputerAcceptanceInDto } from "../../../contracts/services/personas/hanli/index.js";

const COMPLETION_GATE_CRITERION = "确认当前真实窗口已进入目标专题的韩立验收阶段，任务卡可读、尚未误示为已完成，且页面没有阻止完成收口的错误。";

/** 场景执行读取唯一归属或后续关联的条件编号；两种来源已由计划模型保证互斥。 */
export function acceptanceSceneSegmentCriterionIds(segment: AcceptanceSceneSegmentOutDto): string[] {
  if (segment.ownedConditions.length) return segment.ownedConditions.map(({ criterionId }) => criterionId);
  return segment.relatedCriterionIds;
}

/** 按原条件编号取得阶段目标；模型不能用局部数组位置重编号。 */
export function createSegmentGoal(goal: HanliComputerAcceptanceInDto, segment: AcceptanceSceneSegmentOutDto): HanliComputerAcceptanceInDto {
  const criterionIds = acceptanceSceneSegmentCriterionIds(segment);
  const criteria = criterionIds.map((criterionId) => {
    const index = Number(criterionId.replace("criterion-", "")) - 1;
    return goal.criteria[index];
  });
  const { workspaceAcceptanceFixture, crossTaskMemberOccupancyFixture, memberIdleFixture, collaborationStateProjectionFixture, ...segmentBase } = goal;
  return {
    ...segmentBase,
    ...(segment.kind === "workspace-explorer-fixture" && workspaceAcceptanceFixture ? { workspaceAcceptanceFixture } : {}),
    ...(segment.kind === "cross-task-member-occupancy" && crossTaskMemberOccupancyFixture ? { crossTaskMemberOccupancyFixture } : {}),
    ...(segment.kind === "member-idle" && memberIdleFixture ? { memberIdleFixture } : {}),
    ...((segment.kind === "collaboration-state-syncing" || segment.kind === "collaboration-state-unavailable") && collaborationStateProjectionFixture ? { collaborationStateProjectionFixture } : {}),
    criteria,
    criterionIds,
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
