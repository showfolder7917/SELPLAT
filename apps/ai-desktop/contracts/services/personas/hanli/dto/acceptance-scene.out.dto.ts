export type AcceptanceSceneKind = "current-window" | "workspace-explorer-fixture" | "workspace-lifecycle-review" | "empty-task-group" | "completed-recovery-timeline" | "inspection-lifecycle-timeline" | "user-language-detail-timeline" | "recovery-action-lifecycle" | "persona-empty-conversation" | "persona-conversation-lifecycle" | "persona-conversation-with-task-handoff" | "cross-task-member-occupancy" | "member-idle" | "collaboration-state-syncing" | "collaboration-state-unavailable" | "blocked";

/** 一个证据阶段只负责同一数据来源下的验收条件，避免隔离数据与真实审计互相假设。 */
export interface AcceptanceSceneSegmentOutDto {
  kind: AcceptanceSceneKind;
  reason: string;
  /** 原条件是否必须跨越“验收中 -> 已完成”才能取得完整证据；仅当前窗口可以启用。 */
  completionReviewRequired: boolean;
  /** 本阶段唯一占用并产出正式结论的原验收条件及其前提。 */
  ownedConditions: { criterionId: string; prerequisite: string }[];
  /** 后续场景为完成已签发能力而关联的已占用条件；它不产生第二份正式结论。 */
  relatedCriterionIds: string[];
}

/** 韩立可以组合多个只读证据阶段；程序按顺序执行并按原条件编号汇总结论。 */
export interface AcceptanceScenePlanOutDto {
  reason: string;
  segments: AcceptanceSceneSegmentOutDto[];
}
