import type { CollaborationParticipantSnapshot, CollaborationTimelineGroup, CollaborationTimelineNode } from "./collaboration.js";

/** 专题卡只接收已发生的不可变业务事件，不接收任务或提案当前快照。 */
export interface CollaborationTimelineBusinessEvent {
  eventId: string;
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
  fact: Omit<CollaborationTimelineNode, "durationMs"> & {
    proposalId: string | null;
    sourceFactKey: string;
    occurredAt: string;
  };
}

export function timelineParticipant(memberId: string, displayName: string): CollaborationParticipantSnapshot {
  return { memberId, displayName };
}
