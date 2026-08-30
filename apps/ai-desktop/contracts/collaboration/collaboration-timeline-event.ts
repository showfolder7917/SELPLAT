import type { CollaborationParticipantSnapshot, CollaborationTimelineGroup, CollaborationTimelineNode } from "./collaboration.js";

/** 非执行流的专题业务事件；审批与分发必须显式声明语义，禁止依靠 action 文案反推类型。 */
export type CollaborationTimelineBusinessEventType =
  | "approval.application"
  | "approval.decision"
  | "approval.supplement_waiting"
  | "approval.supplement_completed"
  | "task.distribution_planning_started"
  | "task.distribution_planning_completed"
  | "task.distribution_planning_failed"
  | "task.distribution";

/** 专题卡只接收已发生的不可变业务事件，不接收任务或提案当前快照。 */
export interface CollaborationTimelineBusinessEvent {
  eventId: string;
  eventType: CollaborationTimelineBusinessEventType;
  group: {
    groupId: string;
    topicId: string | null;
    proposalId: string | null;
    title: string;
    status: CollaborationTimelineGroup["status"];
    summary: string;
    startedAt: string;
    updatedAt: string;
  };
  fact: Omit<CollaborationTimelineNode, "durationMs" | "eventType"> & {
    proposalId: string | null;
    sourceFactKey: string;
    occurredAt: string;
  };
}

export function timelineParticipant(memberId: string, displayName: string): CollaborationParticipantSnapshot {
  return { memberId, displayName };
}
