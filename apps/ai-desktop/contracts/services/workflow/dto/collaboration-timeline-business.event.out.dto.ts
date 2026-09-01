import type { CollaborationTimelineGroupOutDto, CollaborationTimelineNodeOutDto } from "./collaboration-timeline.out.dto.js";
import type { CollaborationTimelineBusinessEventTypeValue } from "../value/collaboration-timeline-business-event.value.js";

/** 专题卡只接收已发生的不可变业务事件，不接收任务或提案当前快照。 */
export interface CollaborationTimelineBusinessEventOutDto {
  eventId: string;
  eventType: CollaborationTimelineBusinessEventTypeValue;
  group: {
    groupId: string;
    topicId: string | null;
    proposalId: string | null;
    title: string;
    status: CollaborationTimelineGroupOutDto["status"];
    summary: string;
    startedAt: string;
    updatedAt: string;
  };
  fact: Omit<CollaborationTimelineNodeOutDto, "durationMs" | "eventType"> & {
    proposalId: string | null;
    sourceFactKey: string;
    occurredAt: string;
  };
}
