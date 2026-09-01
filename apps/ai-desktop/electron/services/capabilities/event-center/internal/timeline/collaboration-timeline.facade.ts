import type { CodexStreamEvent } from "../../../../../../contracts/platform/codex/index.js";
import type {
  CollaborationStateOutDto,
  CollaborationTimelineChangedEventOutDto,
  CollaborationTimelineSnapshotOutDto,
} from "../../../../../../contracts/collaboration/workflow/index.js";
import type { CollaborationTimelineBusinessEvent } from "../../../../../../contracts/collaboration/workflow/index.js";
import { CollaborationTimelineRepository } from "./collaboration-timeline.repository.js";
import type { DatabasePort as SqliteDatabase } from "../../../../platform/persistence/index.js";

type TimelineChangedListener = (event: CollaborationTimelineChangedEventOutDto) => void;

/**
 * 任务时间线唯一业务门面：所有写入先提交 SQLite，再向订阅者发布变更。
 * 调用方不得越过该类直接操作 Repository 或借人物状态刷新页面。
 */
export class CollaborationTimelineFacade {
  readonly #repository: CollaborationTimelineRepository;
  readonly #listeners = new Set<TimelineChangedListener>();

  constructor(database: SqliteDatabase) {
    this.#repository = new CollaborationTimelineRepository(database);
  }

  appendTimelineEvent(event: CollaborationTimelineBusinessEvent): void {
    const commit = this.#repository.appendBusinessEvent(event);
    if (commit) this.#publish(commit);
  }

  appendTaskFlowEvents(state: CollaborationStateOutDto, taskIds: string[]): void {
    const commit = this.#repository.appendTaskFlowEvents(state, taskIds);
    if (commit) this.#publish(commit);
  }

  appendStream(taskId: string, memberId: string, event: CodexStreamEvent): string | null {
    const commit = this.#repository.appendStream(taskId, memberId, event);
    if (!commit) return null;
    this.#publish(commit);
    return commit.nodeId;
  }

  getTimelineSnapshot(now = new Date().toISOString()): CollaborationTimelineSnapshotOutDto {
    return this.#repository.snapshot(now);
  }

  subscribeTimelineChanged(listener: TimelineChangedListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #publish(event: CollaborationTimelineChangedEventOutDto): void {
    for (const listener of this.#listeners) listener(event);
  }
}
