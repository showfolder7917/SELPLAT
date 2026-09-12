/** 令狐根据逐项验收前提选择场景；程序只执行已登记场景，不解析用户文案。 */
export interface AcceptanceScenePlanOutDto {
  kind: "current-window" | "empty-task-group" | "blocked";
  reason: string;
  /** 与原验收条件逐项对应的前提，不能省略未覆盖条件。 */
  conditions: { criterionId: string; prerequisite: string }[];
}
