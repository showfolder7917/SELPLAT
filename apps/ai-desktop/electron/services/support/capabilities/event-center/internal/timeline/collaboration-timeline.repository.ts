import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import type { CodexStreamEvent } from "../../../../../../../contracts/platform/codex/index.js";
import type {
  CollaborationParticipantSnapshot,
  CollaborationStateOutDto,
  CollaborationTimelineGroup,
  CollaborationTimelineNode,
  CollaborationTimelineSnapshotOutDto,
} from "../../../../../../../contracts/collaboration/workflow/index.js";
import type { CollaborationTimelineBusinessEvent } from "../../../../../../../contracts/collaboration/workflow/index.js";
import { projectCollaborationFlowEvent, projectLegacySubmittedFlowCorrection } from "./collaboration-timeline-flow.projector.js";
import type { DatabasePort as SqliteDatabase } from "../../../../platform/persistence/index.js";

const NANGONG: CollaborationParticipantSnapshot = { memberId: "nangong-wan", displayName: "南宫婉" };

type TimelineFact = Omit<CollaborationTimelineNode, "durationMs"> & {
  groupId: string;
  proposalId: string | null;
  sourceFactKey: string;
  occurredAt: string;
};

export interface CollaborationTimelineCommit {
  groupIds: string[];
  committedAt: string;
  groupVersions: Record<string, number>;
}

export interface CollaborationTimelineStreamCommit extends CollaborationTimelineCommit {
  nodeId: string;
}

const TIMELINE_CONTENT_EVENT_TYPES = new Set<CodexStreamEvent["type"]>([
  "message-delta",
  "message-completed",
  "reasoning-summary-delta",
  "error",
]);

/**
 * 任务协作群的 SQLite 事实仓库。事件与流分片只追加，页面读模型只从这里生成。
 *
 * 真实传参示例：同步新专题申请后调用 `snapshot()`，返回包含“南宫婉 @韩立 · 审批申请”的任务卡。
 * 真实返回示例：同一任务转交令狐后，旧执行人节点仍保留，令狐修复作为后续独立节点追加。
 * 异常或副作用示例：数据库不可写时抛出真实 SQLite 异常，由 EventCenter 的 IPC 边界记录并交给令狐捕捉。
 */
export class CollaborationTimelineRepository {
  readonly #database: SqliteDatabase;

  constructor(database: SqliteDatabase) {
    this.#database = database;
  }

  /** 追加一条已发生的业务事件；仓库不接收也不反推提案当前状态。 */
  appendBusinessEvent(event: CollaborationTimelineBusinessEvent): CollaborationTimelineCommit | null {
    const committedAt = new Date().toISOString();
    const changed = this.#database.transaction((connection) => {
      if (connection.prepare("SELECT 1 FROM AiDesktopTaskTimelineEvent WHERE sourceFactKey=$sourceFactKey").get({ $sourceFactKey: event.fact.sourceFactKey })) return false;
      this.#upsertTopic(connection, event.group);
      return this.#appendFact(connection, { ...event.fact, eventType: event.eventType, groupId: event.group.groupId }, committedAt);
    });
    return changed ? this.#commit([event.group.groupId], committedAt) : null;
  }

  /** 只消费 Coordinator 已追加的 flowEvents，不再从 executionRecords、plan 或 task.state 重建历史。 */
  appendTaskFlowEvents(state: CollaborationStateOutDto, taskIds: string[]): CollaborationTimelineCommit | null {
    const committedAt = new Date().toISOString();
    const changedGroupIds = new Set<string>();
    this.#database.transaction((connection) => {
      for (const task of state.tasks.filter((candidate) => taskIds.includes(candidate.taskId))) {
        let group = task.evolutionProposalId ? connection.prepare(`SELECT groupId, topicId, proposalId, title, startedAt
          FROM AiDesktopTaskTimelineTopic WHERE proposalId=$proposalId ORDER BY updatedAt DESC LIMIT 1`)
          .get({ $proposalId: task.evolutionProposalId }) as Record<string, unknown> | undefined : undefined;
        if (!group) {
          const groupId = `task:${task.taskId}`;
          this.#upsertTopic(connection, {
            groupId, topicId: null, proposalId: task.evolutionProposalId, title: task.snapshot.title,
            status: "running", summary: task.snapshot.confirmedIntent,
            startedAt: task.createdAt, updatedAt: task.updatedAt,
          });
          group = { groupId, topicId: null, proposalId: task.evolutionProposalId, title: task.snapshot.title, startedAt: task.createdAt };
        }
        for (const event of task.flowEvents) {
          const legacySourceFactKey = `flow:${event.eventId}`;
          const sourceFactKey = event.type === "task.submitted"
            ? `${legacySourceFactKey}:submission-lifecycle-v2`
            : event.type === "unified_test.failed"
              ? `${legacySourceFactKey}:failure-semantics-v2`
              : legacySourceFactKey;
          if (connection.prepare("SELECT 1 FROM AiDesktopTaskTimelineEvent WHERE sourceFactKey=$sourceFactKey").get({ $sourceFactKey: sourceFactKey })) continue;
          const legacySubmitted = event.type === "task.submitted"
            && Boolean(connection.prepare("SELECT 1 FROM AiDesktopTaskTimelineEvent WHERE sourceFactKey=$sourceFactKey").get({ $sourceFactKey: legacySourceFactKey }));
          const projection = legacySubmitted
            ? projectLegacySubmittedFlowCorrection(task, event, task.initiator || NANGONG)
            : projectCollaborationFlowEvent(task, event, task.initiator || NANGONG);
          if (!projection) continue;
          for (const { sourceSuffix, ...fact } of projection.facts) if (this.#appendFact(connection, {
            ...fact, groupId: String(group.groupId), proposalId: task.evolutionProposalId, taskId: task.taskId,
            sourceFactKey: `${sourceFactKey}${sourceSuffix}`, occurredAt: event.occurredAt,
          }, committedAt)) changedGroupIds.add(String(group.groupId));
          connection.prepare(`UPDATE AiDesktopTaskTimelineTopic SET status=$status, summary=$summary,
            updatedAt=CASE WHEN updatedAt < $updatedAt THEN $updatedAt ELSE updatedAt END WHERE groupId=$groupId`).run({
            $status: projection.topicStatus, $summary: projection.facts.at(-1)?.summary || event.summary,
            $updatedAt: event.occurredAt, $groupId: String(group.groupId),
          });
        }
      }
    });
    return changedGroupIds.size ? this.#commit([...changedGroupIds], committedAt) : null;
  }

  appendStream(taskId: string, memberId: string, event: CodexStreamEvent, occurredAt = new Date().toISOString()): CollaborationTimelineStreamCommit | null {
    const committedAt = new Date().toISOString();
    const stored = this.#database.transaction((connection) => {
      const active = connection.prepare(`
        SELECT timeline.groupId, timeline.nodeId
        FROM AiDesktopTaskTimelineEvent timeline
        JOIN AiDesktopTaskTimelineTopic topic ON topic.groupId = timeline.groupId
        WHERE timeline.taskId=$taskId AND timeline.actorMemberId=$memberId AND timeline.status='current'
        ORDER BY timeline.sequenceNumber DESC LIMIT 1
      `).get({ $taskId: taskId, $memberId: memberId }) as { groupId: string; nodeId: string } | undefined;
      if (!active) return null;
      const sequence = Number((connection.prepare("SELECT COALESCE(MAX(sequenceNumber), 0) + 1 AS value FROM AiDesktopTaskTimelineStream WHERE taskId=$taskId").get({ $taskId: taskId }) as { value: number | bigint }).value);
      connection.prepare(`INSERT INTO AiDesktopTaskTimelineStream
        (chunkId, groupId, taskId, nodeId, memberId, turnId, segmentId, itemId, eventType, sequenceNumber, deltaText, snapshotText, occurredAt, committedAt)
        VALUES ($chunkId, $groupId, $taskId, $nodeId, $memberId, $turnId, $segmentId, $itemId, $eventType, $sequenceNumber, $deltaText, $snapshotText, $occurredAt, $committedAt)`).run({
        $chunkId: `timeline-stream-${randomUUID()}`, $groupId: active.groupId, $taskId: taskId, $nodeId: active.nodeId,
        $memberId: memberId, $turnId: event.turnId, $segmentId: event.segmentId || null, $itemId: event.itemId || null,
        $eventType: event.type, $sequenceNumber: sequence, $deltaText: event.delta || null,
        $snapshotText: event.text || event.managedExecution?.message || event.error || null, $occurredAt: occurredAt, $committedAt: committedAt,
      });
      if (!TIMELINE_CONTENT_EVENT_TYPES.has(event.type)) return null;
      connection.prepare(`UPDATE AiDesktopTaskTimelineTopic SET revision=revision+1,
        updatedAt=CASE WHEN updatedAt < $occurredAt THEN $occurredAt ELSE updatedAt END WHERE groupId=$groupId`)
        .run({ $occurredAt: occurredAt, $groupId: active.groupId });
      return active;
    });
    if (!stored) return null;
    return { nodeId: stored.nodeId, ...this.#commit([stored.groupId], committedAt) };
  }

  snapshot(now = new Date().toISOString()): CollaborationTimelineSnapshotOutDto {
    return this.#database.withConnection((connection) => {
      const topics = connection.prepare(`SELECT groupId, topicId, proposalId, title, status, summary, startedAt, updatedAt
        FROM AiDesktopTaskTimelineTopic ORDER BY updatedAt DESC, groupId`).all() as Array<Record<string, unknown>>;
      const groups = topics.map((topic) => this.#group(connection, topic, now));
      return { version: 1, groups, updatedAt: groups.map((group) => group.updatedAt).sort().at(-1) || now };
    });
  }

  #upsertTopic(connection: DatabaseSync, input: {
    groupId: string; topicId: string | null; proposalId: string | null; title: string;
    status: CollaborationTimelineGroup["status"]; summary: string; startedAt: string; updatedAt: string;
  }): void {
    connection.prepare(`INSERT INTO AiDesktopTaskTimelineTopic
      (groupId, topicId, proposalId, title, status, summary, startedAt, updatedAt, createdAt)
      VALUES ($groupId, $topicId, $proposalId, $title, $status, $summary, $startedAt, $updatedAt, $createdAt)
      ON CONFLICT(groupId) DO UPDATE SET proposalId=excluded.proposalId, title=excluded.title,
        status=excluded.status, summary=excluded.summary,
        updatedAt=CASE WHEN AiDesktopTaskTimelineTopic.updatedAt < excluded.updatedAt THEN excluded.updatedAt ELSE AiDesktopTaskTimelineTopic.updatedAt END`).run({
      $groupId: input.groupId, $topicId: input.topicId, $proposalId: input.proposalId, $title: input.title,
      $status: input.status, $summary: input.summary, $startedAt: input.startedAt,
      $updatedAt: input.updatedAt, $createdAt: new Date().toISOString(),
    });
  }

  #appendFact(connection: DatabaseSync, fact: TimelineFact, committedAt: string): boolean {
    if (connection.prepare("SELECT 1 FROM AiDesktopTaskTimelineEvent WHERE sourceFactKey=$sourceFactKey").get({ $sourceFactKey: fact.sourceFactKey })) return false;
    const sequenceNumber = Number((connection.prepare("SELECT COALESCE(MAX(sequenceNumber), 0) + 1 AS value FROM AiDesktopTaskTimelineEvent WHERE groupId=$groupId").get({ $groupId: fact.groupId }) as { value: number | bigint }).value);
    connection.prepare(`INSERT INTO AiDesktopTaskTimelineEvent
      (factId, groupId, proposalId, taskId, nodeId, sourceFactKey, sequenceNumber, eventType, contentRole, detailRole, schemaVersion, kind, actorMemberId, actorDisplayName,
       recipientsJson, status, action, summary, content, detail, startedAt, completedAt, automaticOpen,
       manualApprovalProposalId, occurredAt, committedAt)
      VALUES ($factId, $groupId, $proposalId, $taskId, $nodeId, $sourceFactKey, $sequenceNumber, $eventType, $contentRole, $detailRole, 2, $kind, $actorMemberId,
       $actorDisplayName, $recipientsJson, $status, $action, $summary, $content, $detail, $startedAt, $completedAt,
       $automaticOpen, $manualApprovalProposalId, $occurredAt, $committedAt)`).run({
      $factId: `timeline-fact-${randomUUID()}`, $groupId: fact.groupId, $proposalId: fact.proposalId, $taskId: fact.taskId,
      $nodeId: fact.nodeId, $sourceFactKey: fact.sourceFactKey, $sequenceNumber: sequenceNumber, $eventType: fact.eventType,
      $contentRole: fact.contentRole, $detailRole: fact.detailRole, $kind: fact.kind,
      $actorMemberId: fact.actor.memberId, $actorDisplayName: fact.actor.displayName, $recipientsJson: JSON.stringify(fact.recipients),
      $status: fact.status, $action: fact.action, $summary: fact.summary.slice(0, 8_000), $content: fact.content.slice(0, 40_000),
      $detail: fact.detail.slice(0, 40_000), $startedAt: fact.startedAt, $completedAt: fact.completedAt,
      $automaticOpen: fact.automaticOpen ? 1 : 0, $manualApprovalProposalId: fact.manualApprovalProposalId,
      $occurredAt: fact.occurredAt, $committedAt: committedAt,
    });
    connection.prepare("UPDATE AiDesktopTaskTimelineTopic SET revision=revision+1 WHERE groupId=$groupId").run({ $groupId: fact.groupId });
    return true;
  }

  #commit(groupIds: string[], committedAt: string): CollaborationTimelineCommit {
    const groupVersions = this.#database.withConnection((connection) => Object.fromEntries(groupIds.map((groupId) => {
      const row = connection.prepare("SELECT revision FROM AiDesktopTaskTimelineTopic WHERE groupId=$groupId").get({ $groupId: groupId }) as { revision: number | bigint } | undefined;
      return [groupId, Number(row?.revision || 0)];
    })));
    return { groupIds, groupVersions, committedAt };
  }

  #group(connection: DatabaseSync, topic: Record<string, unknown>, now: string): CollaborationTimelineGroup {
    const rows = connection.prepare(`SELECT * FROM AiDesktopTaskTimelineEvent WHERE groupId=$groupId
      ORDER BY sequenceNumber, occurredAt, factId`).all({ $groupId: String(topic.groupId) }) as Array<Record<string, unknown>>;
    const latestByNode = new Map<string, Record<string, unknown>>();
    const firstSequence = new Map<string, number>();
    for (const row of rows) {
      const nodeId = String(row.nodeId);
      firstSequence.set(nodeId, firstSequence.get(nodeId) ?? Number(row.sequenceNumber));
      latestByNode.set(nodeId, row);
    }
    const nodes = [...latestByNode.values()].map((row) => this.#node(connection, row, now))
      .sort((left, right) => left.startedAt.localeCompare(right.startedAt) || (firstSequence.get(left.nodeId) || 0) - (firstSequence.get(right.nodeId) || 0));
    const executingCount = activeTaskCount(nodes, new Set(["analysis", "execution", "repair"]));
    const verifyingCount = activeTaskCount(nodes, new Set(["verification"]));
    const waitingCount = nodes.filter((node) => node.status === "waiting" || node.kind === "approval-application" && node.status === "current").length;
    const completedCount = nodes.filter((node) => node.status === "completed").length;
    const currentNodes = nodes.filter((node) => node.status === "current");
    const persistedStatus = String(topic.status) as CollaborationTimelineGroup["status"];
    const calculated = persistedStatus === "blocked" || persistedStatus === "cancelled" || persistedStatus === "completed" ? persistedStatus
      : currentNodes.some((node) => node.kind === "approval-application") ? "waiting-approval"
        : currentNodes.some((node) => node.kind === "verification") ? "verifying"
          : currentNodes.length > 0 ? "running"
            : nodes.at(-1)?.status === "failed" ? "blocked" : persistedStatus;
    const updatedAt = String(topic.updatedAt);
    return {
      groupId: String(topic.groupId), topicId: nullable(topic.topicId), proposalId: nullable(topic.proposalId), title: String(topic.title),
      status: calculated, summary: [...nodes].reverse().find((node) => node.status === "current" || node.status === "failed")?.summary || String(topic.summary),
      nodes, executingCount, verifyingCount, waitingCount, completedCount, startedAt: String(topic.startedAt), updatedAt,
      durationMs: durationMs(String(topic.startedAt), calculated === "completed" ? updatedAt : now), ...transition(calculated, nodes),
    };
  }

  #node(connection: DatabaseSync, row: Record<string, unknown>, now: string): CollaborationTimelineNode {
    const nodeId = String(row.nodeId);
    const stream = projectedContentText(connection, String(row.groupId), nodeId);
    const startedAt = String(row.startedAt);
    const status = row.status as CollaborationTimelineNode["status"];
    // 历史终态事实可能缺少 completedAt；以事实发生时间收口，禁止页面把已完成或失败节点继续计时。
    const completedAt = nullable(row.completedAt) || (status === "completed" || status === "failed" ? String(row.occurredAt) : null);
    return {
      nodeId, taskId: nullable(row.taskId), eventType: String(row.eventType), kind: row.kind as CollaborationTimelineNode["kind"],
      actor: participant(String(row.actorMemberId), String(row.actorDisplayName)), recipients: parseParticipants(row.recipientsJson),
      status, action: String(row.action), summary: String(row.summary), contentRole: row.contentRole as CollaborationTimelineNode["contentRole"],
      content: stream || String(row.content), detailRole: row.detailRole as CollaborationTimelineNode["detailRole"], detail: String(row.detail), startedAt, completedAt,
      durationMs: durationMs(startedAt, completedAt || now), automaticOpen: Number(row.automaticOpen) === 1,
      manualApprovalProposalId: nullable(row.manualApprovalProposalId),
    };
  }
}

/** 只投影人物产生的业务正文；managed-execution 等运行状态保留在原始流表，但绝不拼入可读内容。 */
function projectedContentText(connection: DatabaseSync, groupId: string, nodeId: string): string {
  const rows = connection.prepare(`SELECT turnId, segmentId, itemId, eventType, deltaText, snapshotText FROM AiDesktopTaskTimelineStream
    WHERE groupId=$groupId AND nodeId=$nodeId
    ORDER BY sequenceNumber, occurredAt, chunkId`).all({ $groupId: groupId, $nodeId: nodeId }) as Array<Record<string, unknown>>;
  const items = new Map<string, { deltas: string[]; completed: string | null }>();
  for (const row of rows) {
    if (!TIMELINE_CONTENT_EVENT_TYPES.has(String(row.eventType) as CodexStreamEvent["type"])) continue;
    const key = [String(row.turnId), nullable(row.itemId) || nullable(row.segmentId) || "default"].join(":");
    const value = items.get(key) || { deltas: [], completed: null };
    if (row.eventType === "message-completed" && row.snapshotText) value.completed = String(row.snapshotText);
    else {
      const text = nullable(row.deltaText) || nullable(row.snapshotText);
      if (text) value.deltas.push(text);
    }
    items.set(key, value);
  }
  return [...items.values()].map((item) => item.completed || item.deltas.join("")).filter(Boolean).join("\n\n");
}

function transition(status: CollaborationTimelineGroup["status"], nodes: CollaborationTimelineNode[]): Pick<CollaborationTimelineGroup, "nextStep" | "failureNextStep" | "nextOwner"> {
  const active = nodes.filter((node) => node.status === "current" || node.status === "waiting");
  const current = active.at(-1);
  if (current?.kind === "approval-application") return { nextStep: `${current.recipients[0]?.displayName || "韩立"} · 审批申请`, failureNextStep: "韩立 → 南宫婉 · 退回补充", nextOwner: current.recipients[0] || null };
  if (current?.kind === "analysis") return { nextStep: `${current.actor.displayName} · 执行已确认方案`, failureNextStep: `${current.actor.displayName} → 南宫婉 · 返回分析阻塞`, nextOwner: current.actor };
  if (current?.kind === "execution") return { nextStep: `${current.actor.displayName} · 执行人自检`, failureNextStep: `南宫婉 → 令狐老祖 · 转交执行故障`, nextOwner: current.actor };
  if (current?.kind === "verification") return { nextStep: `${current.actor.displayName} → 南宫婉 · 返回验证结果`, failureNextStep: `南宫婉 → 令狐老祖 · 转交验证故障`, nextOwner: current.actor };
  if (current?.kind === "repair") return { nextStep: `令狐老祖 → 南宫婉 · 返回修复结果`, failureNextStep: `令狐老祖 · 保留真实失败并等待恢复条件`, nextOwner: current.actor };
  if (status === "waiting-approval") return { nextStep: "韩立 · 等待审批", failureNextStep: "韩立 → 南宫婉 · 退回补充", nextOwner: null };
  if (status === "blocked") return { nextStep: "南宫婉 → 令狐老祖 · 明确故障并转交修复", failureNextStep: "等待人工解除恢复条件", nextOwner: { memberId: "linghu-ancestor", displayName: "令狐老祖" } };
  if (status === "completed") return { nextStep: "本专题已完成", failureNextStep: null, nextOwner: null };
  return { nextStep: "南宫婉 · 生成执行计划并分配执行人", failureNextStep: "南宫婉 · 说明无法分配的原因", nextOwner: NANGONG };
}

function activeTaskCount(nodes: CollaborationTimelineNode[], kinds: Set<CollaborationTimelineNode["kind"]>): number {
  return new Set(nodes.filter((node) => node.status === "current" && kinds.has(node.kind)).map((node) => node.taskId || node.nodeId)).size;
}

function participant(memberId: string, displayName: string): CollaborationParticipantSnapshot { return { memberId, displayName }; }
function nullable(value: unknown): string | null { return typeof value === "string" && value ? value : null; }
function parseParticipants(value: unknown): CollaborationParticipantSnapshot[] {
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.filter((item): item is CollaborationParticipantSnapshot => Boolean(item) && typeof item.memberId === "string" && typeof item.displayName === "string") : [];
  } catch { return []; }
}
function durationMs(startedAt: string, endedAt: string): number {
  const start = Date.parse(startedAt); const end = Date.parse(endedAt);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0;
}
