/** 非执行流的专题业务事件类型；禁止依靠展示文案反推事件语义。 */
export type CollaborationTimelineBusinessEventTypeValue =
  | "acceptance.received"
  | "acceptance.started"
  | "acceptance.passed"
  | "acceptance.failed"
  | "inspection.observation"
  | "approval.application"
  | "approval.decision"
  | "approval.supplement_waiting"
  | "approval.supplement_completed"
  | "task.distribution_planning_started"
  | "task.distribution_planning_completed"
  | "task.distribution_planning_failed"
  | "task.distribution";
