export type AcceptanceSceneKind = "current-window" | "workspace-explorer-fixture" | "workspace-lifecycle-review" | "empty-task-group" | "failure-recovery-timeline" | "inspection-lifecycle-timeline" | "user-language-detail-timeline" | "recovery-action-lifecycle" | "persona-conversation-lifecycle" | "persona-conversation-with-task-handoff" | "cross-task-member-occupancy" | "blocked";

/** 一个证据阶段只负责同一数据来源下的验收条件，避免隔离数据与真实审计互相假设。 */
export interface AcceptanceSceneSegmentOutDto {
  kind: AcceptanceSceneKind;
  reason: string;
  /** 原条件是否必须跨越“验收中 -> 已完成”才能取得完整证据；仅当前窗口可以启用。 */
  completionReviewRequired: boolean;
  /** 本阶段负责的原验收条件及其前提。 */
  conditions: { criterionId: string; prerequisite: string }[];
}

/** 韩立可以组合多个只读证据阶段；程序按顺序执行并按原条件编号汇总结论。 */
export interface AcceptanceScenePlanOutDto {
  reason: string;
  segments: AcceptanceSceneSegmentOutDto[];
}
