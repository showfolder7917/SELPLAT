import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import type { CodexStreamEvent } from "../../../contracts/codex/codex-stream.js";
import type {
  CollaborationParticipantSnapshot,
  CollaborationState,
  CollaborationTimelineGroup,
  CollaborationTimelineNode,
  CollaborationTimelineSnapshot,
} from "../../../contracts/collaboration/collaboration.js";
import type { CollaborationTimelineBusinessEvent } from "../../../contracts/collaboration/collaboration-timeline-event.js";
import { projectCollaborationFlowEvent } from "./collaboration-timeline-flow-projector.js";
import type { SqliteDatabase } from "./persistence/sqlite-database.js";

const NANGONG: CollaborationParticipantSnapshot = { memberId: "nangong-wan", displayName: "南宫婉" };

type TimelineFact = Omit<CollaborationTimelineNode, "durationMs"> & {
  groupId: string;
  proposalId: string | null;
  sourceFactKey: string;
  occurredAt: string;
};

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
  appendBusinessEvent(event: CollaborationTimelineBusinessEvent): void {
    this.#database.transaction((connection) => {
      this.#upsertTopic(connection, event.group);
      this.#appendFact(connection, { ...event.fact, groupId: event.group.groupId });
    });
  }

  /** 只消费 Coordinator 已追加的 flowEvents，不再从 executionRecords、plan 或 task.state 重建历史。 */
  appendTaskFlowEvents(state: CollaborationState, taskIds: string[]): void {
    this.#database.transaction((connection) => {
      for (const task of state.tasks.filter((candidate) => taskIds.includes(candidate.taskId))) {
        let group = task.evolutionProposalId ? connection.prepare(`SELECT groupId, topicId, proposalId, title, startedAt
          FROM AiDesktopTaskCollaborationTopic WHERE proposalId=$proposalId ORDER BY updatedAt DESC LIMIT 1`)
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
          if (connection.prepare("SELECT 1 FROM AiDesktopTaskCollaborationEvent WHERE sourceFactKey=$sourceFactKey").get({ $sourceFactKey: `flow:${event.eventId}` })) continue;
          const projection = projectCollaborationFlowEvent(task, event, task.initiator || NANGONG);
          for (const { sourceSuffix, ...fact } of projection.facts) this.#appendFact(connection, {
            ...fact, groupId: String(group.groupId), proposalId: task.evolutionProposalId, taskId: task.taskId,
            sourceFactKey: `flow:${event.eventId}${sourceSuffix}`, occurredAt: event.occurredAt,
          });
          connection.prepare(`UPDATE AiDesktopTaskCollaborationTopic SET status=$status, summary=$summary,
            updatedAt=CASE WHEN updatedAt < $updatedAt THEN $updatedAt ELSE updatedAt END WHERE groupId=$groupId`).run({
            $status: projection.topicStatus, $summary: projection.facts.at(-1)?.summary || event.summary,
            $updatedAt: event.occurredAt, $groupId: String(group.groupId),
          });
        }
      }
    });
  }

  appendStream(taskId: string, memberId: string, event: CodexStreamEvent, occurredAt = new Date().toISOString()): string | null {
    return this.#database.transaction((connection) => {
      const active = connection.prepare(`
        SELECT timeline.groupId, timeline.nodeId
        FROM AiDesktopTaskCollaborationEvent timeline
        JOIN AiDesktopTaskCollaborationTopic topic ON topic.groupId = timeline.groupId
        WHERE timeline.taskId=$taskId AND timeline.actorMemberId=$memberId AND timeline.status='current'
        ORDER BY timeline.sequenceNumber DESC LIMIT 1
      `).get({ $taskId: taskId, $memberId: memberId }) as { groupId: string; nodeId: string } | undefined;
      if (!active) return null;
      const sequence = Number((connection.prepare("SELECT COALESCE(MAX(sequenceNumber), 0) + 1 AS value FROM AiDesktopTaskCollaborationStream WHERE taskId=$taskId").get({ $taskId: taskId }) as { value: number | bigint }).value);
      connection.prepare(`INSERT INTO AiDesktopTaskCollaborationStream
        (chunkId, groupId, taskId, nodeId, memberId, turnId, segmentId, itemId, eventType, sequenceNumber, deltaText, snapshotText, occurredAt)
        VALUES ($chunkId, $groupId, $taskId, $nodeId, $memberId, $turnId, $segmentId, $itemId, $eventType, $sequenceNumber, $deltaText, $snapshotText, $occurredAt)`).run({
        $chunkId: `timeline-stream-${randomUUID()}`, $groupId: active.groupId, $taskId: taskId, $nodeId: active.nodeId,
        $memberId: memberId, $turnId: event.turnId, $segmentId: event.segmentId || null, $itemId: event.itemId || null,
        $eventType: event.type, $sequenceNumber: sequence, $deltaText: event.delta || null,
        $snapshotText: event.text || event.managedExecution?.message || event.error || null, $occurredAt: occurredAt,
      });
      connection.prepare("UPDATE AiDesktopTaskCollaborationTopic SET updatedAt=$occurredAt WHERE groupId=$groupId AND updatedAt < $occurredAt").run({ $occurredAt: occurredAt, $groupId: active.groupId });
      return active.nodeId;
    });
  }

  snapshot(now = new Date().toISOString()): CollaborationTimelineSnapshot {
    return this.#database.withConnection((connection) => {
      const topics = connection.prepare(`SELECT groupId, topicId, proposalId, title, status, summary, startedAt, updatedAt
        FROM AiDesktopTaskCollaborationTopic ORDER BY updatedAt DESC, groupId`).all() as Array<Record<string, unknown>>;
      const groups = topics.map((topic) => this.#group(connection, topic, now));
      return { version: 1, groups, updatedAt: groups.map((group) => group.updatedAt).sort().at(-1) || now };
    });
  }

  #upsertTopic(connection: DatabaseSync, input: {
    groupId: string; topicId: string | null; proposalId: string | null; title: string;
    status: CollaborationTimelineGroup["status"]; summary: string; startedAt: string; updatedAt: string;
  }): void {
    connection.prepare(`INSERT INTO AiDesktopTaskCollaborationTopic
      (groupId, topicId, proposalId, title, status, summary, startedAt, updatedAt, createdAt)
      VALUES ($groupId, $topicId, $proposalId, $title, $status, $summary, $startedAt, $updatedAt, $createdAt)
      ON CONFLICT(groupId) DO UPDATE SET proposalId=excluded.proposalId, title=excluded.title,
        status=excluded.status, summary=excluded.summary,
        updatedAt=CASE WHEN AiDesktopTaskCollaborationTopic.updatedAt < excluded.updatedAt THEN excluded.updatedAt ELSE AiDesktopTaskCollaborationTopic.updatedAt END`).run({
      $groupId: input.groupId, $topicId: input.topicId, $proposalId: input.proposalId, $title: input.title,
      $status: input.status, $summary: input.summary, $startedAt: input.startedAt,
      $updatedAt: input.updatedAt, $createdAt: new Date().toISOString(),
    });
  }

  #appendFact(connection: DatabaseSync, fact: TimelineFact): void {
    if (connection.prepare("SELECT 1 FROM AiDesktopTaskCollaborationEvent WHERE sourceFactKey=$sourceFactKey").get({ $sourceFactKey: fact.sourceFactKey })) return;
    const sequenceNumber = Number((connection.prepare("SELECT COALESCE(MAX(sequenceNumber), 0) + 1 AS value FROM AiDesktopTaskCollaborationEvent WHERE groupId=$groupId").get({ $groupId: fact.groupId }) as { value: number | bigint }).value);
    connection.prepare(`INSERT INTO AiDesktopTaskCollaborationEvent
      (factId, groupId, proposalId, taskId, nodeId, sourceFactKey, sequenceNumber, kind, actorMemberId, actorDisplayName,
       recipientsJson, status, action, summary, content, detail, startedAt, completedAt, automaticOpen,
       manualApprovalProposalId, occurredAt, recordedAt)
      VALUES ($factId, $groupId, $proposalId, $taskId, $nodeId, $sourceFactKey, $sequenceNumber, $kind, $actorMemberId,
       $actorDisplayName, $recipientsJson, $status, $action, $summary, $content, $detail, $startedAt, $completedAt,
       $automaticOpen, $manualApprovalProposalId, $occurredAt, $recordedAt)`).run({
      $factId: `timeline-fact-${randomUUID()}`, $groupId: fact.groupId, $proposalId: fact.proposalId, $taskId: fact.taskId,
      $nodeId: fact.nodeId, $sourceFactKey: fact.sourceFactKey, $sequenceNumber: sequenceNumber, $kind: fact.kind,
      $actorMemberId: fact.actor.memberId, $actorDisplayName: fact.actor.displayName, $recipientsJson: JSON.stringify(fact.recipients),
      $status: fact.status, $action: fact.action, $summary: fact.summary.slice(0, 8_000), $content: fact.content.slice(0, 40_000),
      $detail: fact.detail.slice(0, 40_000), $startedAt: fact.startedAt, $completedAt: fact.completedAt,
      $automaticOpen: fact.automaticOpen ? 1 : 0, $manualApprovalProposalId: fact.manualApprovalProposalId,
      $occurredAt: fact.occurredAt, $recordedAt: new Date().toISOString(),
    });
  }

  #group(connection: DatabaseSync, topic: Record<string, unknown>, now: string): CollaborationTimelineGroup {
    const rows = connection.prepare(`SELECT * FROM AiDesktopTaskCollaborationEvent WHERE groupId=$groupId
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
    const executingCount = nodes.filter((node) => node.kind === "execution" && node.status === "current").length;
    const verifyingCount = nodes.filter((node) => node.kind === "verification" && node.status === "current").length;
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
      durationMs: durationMs(String(topic.startedAt), calculated === "completed" ? updatedAt : now), nextStep: nextStep(calculated, nodes),
    };
  }

  #node(connection: DatabaseSync, row: Record<string, unknown>, now: string): CollaborationTimelineNode {
    const nodeId = String(row.nodeId);
    const stream = visibleStreamText(connection, String(row.groupId), nodeId);
    const startedAt = String(row.startedAt);
    const completedAt = nullable(row.completedAt);
    return {
      nodeId, taskId: nullable(row.taskId), kind: row.kind as CollaborationTimelineNode["kind"],
      actor: participant(String(row.actorMemberId), String(row.actorDisplayName)), recipients: parseParticipants(row.recipientsJson),
      status: row.status as CollaborationTimelineNode["status"], action: String(row.action), summary: String(row.summary),
      content: stream || String(row.content), detail: String(row.detail), startedAt, completedAt,
      durationMs: durationMs(startedAt, completedAt || now), automaticOpen: Number(row.automaticOpen) === 1,
      manualApprovalProposalId: nullable(row.manualApprovalProposalId),
    };
  }
}

function visibleStreamText(connection: DatabaseSync, groupId: string, nodeId: string): string {
  const rows = connection.prepare(`SELECT turnId, eventType, deltaText, snapshotText FROM AiDesktopTaskCollaborationStream
    WHERE groupId=$groupId AND nodeId=$nodeId AND eventType IN ('message-delta', 'message-completed', 'reasoning-summary-delta', 'managed-execution')
    ORDER BY sequenceNumber, occurredAt, chunkId`).all({ $groupId: groupId, $nodeId: nodeId }) as Array<Record<string, unknown>>;
  const turns = new Map<string, { deltas: string[]; completed: string | null }>();
  for (const row of rows) {
    const turn = String(row.turnId);
    const value = turns.get(turn) || { deltas: [], completed: null };
    if (row.eventType === "message-completed" && row.snapshotText) value.completed = String(row.snapshotText);
    else {
      const text = nullable(row.deltaText) || nullable(row.snapshotText);
      if (text) value.deltas.push(text);
    }
    turns.set(turn, value);
  }
  return [...turns.values()].map((turn) => turn.completed || turn.deltas.join("")).filter(Boolean).join("\n\n");
}

function nextStep(status: CollaborationTimelineGroup["status"], nodes: CollaborationTimelineNode[]): string {
  const active = nodes.filter((node) => node.status === "current" || node.status === "waiting");
  const current = active.at(-1);
  if (current?.kind === "approval-application") return `${current.recipients[0]?.displayName || "韩立"} · 等待审批`;
  if (current) return `${current.actor.displayName} · ${current.action}`;
  if (status === "waiting-approval") return "韩立审批 · 等待中";
  if (status === "blocked") return "令狐老祖持续保障 · 等待恢复条件";
  if (status === "completed") return "本专题已完成";
  return active.length ? `结果汇总与验收 · 等待 ${active.length} 个节点完成` : "下一任务 · 等待中";
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
