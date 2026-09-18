import type { CodexStreamEventOutDto } from "../../../../../contracts/services/support/platform/codex/index.js";
import type {
  CollaborationStateOutDto,
  CollaborationTimelineBusinessEventOutDto,
  CollaborationTimelineSnapshotOutDto,
} from "../../../../../contracts/services/workflow/index.js";

export interface CollaborationTimelineCommit {
  groupIds: string[];
  committedAt: string;
  groupVersions: Record<string, number>;
}

export interface CollaborationTimelineStreamCommit extends CollaborationTimelineCommit {
  nodeId: string;
}

/** 时间线门面所需的业务化持久化端口，不暴露连接、SQL 或表结构。 */
export interface CollaborationTimelinePersistencePort {
  appendBusinessEvent(event: CollaborationTimelineBusinessEventOutDto): CollaborationTimelineCommit | null;
  appendTaskFlowEvents(state: CollaborationStateOutDto, taskIds: string[]): CollaborationTimelineCommit | null;
  appendStream(taskId: string, memberId: string, event: CodexStreamEventOutDto, occurredAt?: string, chunkId?: string): CollaborationTimelineStreamCommit | null;
  snapshot(now?: string): CollaborationTimelineSnapshotOutDto;
  snapshotGroups(groupIds: string[], now?: string): CollaborationTimelineSnapshotOutDto;
}
