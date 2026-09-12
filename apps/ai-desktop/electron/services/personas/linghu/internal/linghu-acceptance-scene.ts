import type { AcceptanceScenePlanOutDto, HanliComputerAcceptanceInDto } from "../../../../../contracts/services/personas/hanli/index.js";

/** 验证令狐的结构化准备计划，任何缺项都退回环境排障，不默认为当前窗口。 */
export function parseAcceptanceScenePlan(text: string, goal: HanliComputerAcceptanceInDto): AcceptanceScenePlanOutDto {
  const value = JSON.parse(text) as AcceptanceScenePlanOutDto;
  if (!value || !["current-window", "empty-task-group", "blocked"].includes(value.kind)
    || typeof value.reason !== "string" || !value.reason.trim() || !Array.isArray(value.conditions)) {
    throw new Error("令狐未提交有效的验收场景计划。");
  }
  const expectedIds = goal.criteria.map((_, index) => `criterion-${index + 1}`);
  const ids = value.conditions.map((condition) => condition?.criterionId);
  if (ids.length !== expectedIds.length || new Set(ids).size !== ids.length
    || expectedIds.some((id) => !ids.includes(id))
    || value.conditions.some((condition) => typeof condition?.prerequisite !== "string" || !condition.prerequisite.trim())) {
    throw new Error("令狐验收场景计划未逐项覆盖原验收条件。");
  }
  return { kind: value.kind, reason: value.reason.trim(), conditions: value.conditions.map(({ criterionId, prerequisite }) => ({ criterionId, prerequisite: prerequisite.trim() })) };
}
