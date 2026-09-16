import type { CodexStreamEventOutDto } from "../../../../../../../contracts/services/support/platform/codex/index.js";
import type {
  CollaborationStateOutDto,
  CollaborationTimelineChangedEventOutDto,
  CollaborationTimelineProjectionStatusOutDto,
  CollaborationTimelineSnapshotOutDto,
} from "../../../../../../../contracts/services/workflow/index.js";
import type { CollaborationTimelineBusinessEventOutDto } from "../../../../../../../contracts/services/workflow/index.js";
import { CollaborationTimelineRepository } from "./collaboration-timeline.repository.js";
import { createHash, randomUUID } from "node:crypto";
import type { DatabasePort as SqliteDatabase } from "../../../../platform/persistence/index.js";

type TimelineChangedListener = (event: CollaborationTimelineChangedEventOutDto) => void;
type ProjectionStatusListener = (status: CollaborationTimelineProjectionStatusOutDto) => void;

/** 页面重试只重放这一次未确认写入，不能把其他时间线操作一并重复。 */
type ProjectionRetry = () => void;
type ProjectionOperation = "stream" | "task-flow" | "business-event";

/**
 * 任务时间线唯一业务门面：所有写入先提交 SQLite，再向订阅者发布变更。
 * 调用方不得越过该类直接操作 Repository 或借人物状态刷新页面。
 */
export class CollaborationTimelineFacade {
  readonly #repository: CollaborationTimelineRepository;
  readonly #listeners = new Set<TimelineChangedListener>();
  readonly #projectionStatusListeners = new Set<ProjectionStatusListener>();
  #projectionFailure: { message: string; retry: ProjectionRetry; taskId: string | null; operation: ProjectionOperation } | null = null;

  constructor(database: SqliteDatabase) {
    this.#repository = new CollaborationTimelineRepository(database);
  }

  appendTimelineEvent(event: CollaborationTimelineBusinessEventOutDto): void {
    const write = () => this.#repository.appendBusinessEvent(event);
    let commit: ReturnType<CollaborationTimelineRepository["appendBusinessEvent"]>;
    try { commit = write(); }
    catch (error) { this.#recordProjectionFailure(error, write, event.fact.taskId, "business-event"); throw error; }
    if (commit) this.#publish(commit);
  }

  appendTaskFlowEvents(state: CollaborationStateOutDto, taskIds: string[]): void {
    const write = () => this.#repository.appendTaskFlowEvents(state, taskIds);
    let commit: ReturnType<CollaborationTimelineRepository["appendTaskFlowEvents"]>;
    try { commit = write(); }
    catch (error) { this.#recordProjectionFailure(error, write, taskIds.length === 1 ? taskIds[0]! : null, "task-flow"); throw error; }
    if (commit) this.#publish(commit);
  }

  /** 只重放最近失败的幂等投影，成功后会通过正常提交事件通知页面刷新。 */
  retryProjection(): void {
    const failed = this.#projectionFailure;
    if (!failed) return;
    try { failed.retry(); }
    catch (error) { this.#recordProjectionFailure(error, failed.retry, failed.taskId, failed.operation); throw error; }
    this.#projectionFailure = null;
    this.#publishProjectionStatus();
  }

  getProjectionStatus(): CollaborationTimelineProjectionStatusOutDto {
    return this.#projectionFailure
      ? { status: "unavailable", message: this.#projectionFailure.message, taskId: this.#projectionFailure.taskId, operation: this.#projectionFailure.operation }
      : { status: "ready", message: "", taskId: null, operation: "none" };
  }

  /** 只投影明确问题与实际动作，正常且无变化的巡检不产生会话消息。 */
  appendInspectionObservation(type: string, details: Record<string, unknown>, taskId?: string): void {
    const actions: Record<string, string> = {
      "linghu.automation.issue_detected": "巡检发现问题",
      "linghu.automation.recovery_requested": "已发起恢复",
      "linghu.automation.check_failed": "巡检遇到异常",
      "linghu.automation.local_change_ownership_waiting": "文件归属检查结果",
    };
    const action = actions[type];
    if (!action) return;
    const content = String(details.report || details.detail || details.message || "").trim();
    if (!content) return;
    const key = createHash("sha256").update(JSON.stringify([type, taskId || null, details.fingerprint || null, content])).digest("hex");
    const now = new Date().toISOString();
    this.appendTimelineEvent({ eventId: key, eventType: "inspection.observation",
      group: { groupId: "inspection:linghu", topicId: null, proposalId: null, title: "令狐老祖自动巡检记录", status: "completed", summary: "只记录发现的问题和已经发起的动作，修复结果以任务测试记录为准。", startedAt: now, updatedAt: now },
      fact: { nodeId: `inspection:${key}`, taskId: taskId || null, proposalId: null, sourceFactKey: `inspection:${key}`, occurredAt: now,
        kind: "result", actor: { memberId: "linghu-ancestor", displayName: "令狐老祖" }, recipients: [], status: "completed", action,
        summary: content, contentRole: "status", content, detailRole: "none", detail: "", startedAt: now, completedAt: now,
        automaticOpen: false, manualApprovalProposalId: null },
    });
  }

  appendStream(taskId: string, memberId: string, event: CodexStreamEventOutDto): string | null {
    // 首次写入就固定片段标识；若事务提交后才报告异常，重试仍可由 SQLite 去重。
    const chunkId = `timeline-stream-${randomUUID()}`;
    const occurredAt = new Date().toISOString();
    const write = () => this.#repository.appendStream(taskId, memberId, event, occurredAt, chunkId);
    let commit: ReturnType<CollaborationTimelineRepository["appendStream"]>;
    try { commit = write(); }
    catch (error) { this.#recordProjectionFailure(error, write, taskId, "stream"); throw error; }
    if (!commit) return null;
    // 流式增量已经通过专用 IPC 直接送到页面；逐字发布“时间线已变化”会让页面反复全量读取历史。
    // 一轮正文完成或报错时再通知完整快照收口，既保留持久化记录，也避免长任务拖慢人物切换。
    if (event.type === "message-completed" || event.type === "error") this.#publish(commit);
    return commit.nodeId;
  }

  getTimelineSnapshot(now = new Date().toISOString()): CollaborationTimelineSnapshotOutDto {
    return this.#repository.snapshot(now);
  }

  getTimelineGroups(groupIds: string[], now = new Date().toISOString()): CollaborationTimelineSnapshotOutDto {
    return this.#repository.snapshotGroups(groupIds, now);
  }

  subscribeTimelineChanged(listener: TimelineChangedListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  subscribeProjectionStatus(listener: ProjectionStatusListener): () => void {
    this.#projectionStatusListeners.add(listener);
    return () => this.#projectionStatusListeners.delete(listener);
  }

  #publish(event: CollaborationTimelineChangedEventOutDto): void {
    for (const listener of this.#listeners) listener(event);
  }

  #publishProjectionStatus(): void {
    const status = this.getProjectionStatus();
    for (const listener of this.#projectionStatusListeners) listener(status);
  }

  /** 失败状态只保存技术重试上下文，不把失败伪造为任务或时间线业务事实。 */
  #recordProjectionFailure(error: unknown, retry: ProjectionRetry, taskId: string | null, operation: ProjectionOperation): void {
    this.#projectionFailure = { message: error instanceof Error ? error.message : String(error), retry, taskId, operation };
    this.#publishProjectionStatus();
  }
}
