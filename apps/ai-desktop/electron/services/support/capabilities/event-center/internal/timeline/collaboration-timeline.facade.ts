import type { CodexStreamEventOutDto } from "../../../../../../../contracts/services/support/platform/codex/index.js";
import type {
  CollaborationStateOutDto,
  CollaborationTimelineChangedEventOutDto,
  CollaborationTimelineSnapshotOutDto,
} from "../../../../../../../contracts/services/workflow/index.js";
import type { CollaborationTimelineBusinessEventOutDto } from "../../../../../../../contracts/services/workflow/index.js";
import { CollaborationTimelineRepository } from "./collaboration-timeline.repository.js";
import { createHash } from "node:crypto";
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

  appendTimelineEvent(event: CollaborationTimelineBusinessEventOutDto): void {
    const commit = this.#repository.appendBusinessEvent(event);
    if (commit) this.#publish(commit);
  }

  appendTaskFlowEvents(state: CollaborationStateOutDto, taskIds: string[]): void {
    const commit = this.#repository.appendTaskFlowEvents(state, taskIds);
    if (commit) this.#publish(commit);
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
