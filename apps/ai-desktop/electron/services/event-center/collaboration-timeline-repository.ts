import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import type { CodexStreamEvent } from "../../../contracts/codex/codex-stream.js";
import type {
  CollaborationParticipantSnapshot,
  CollaborationState,
  CollaborationTask,
  CollaborationTimelineGroup,
  CollaborationTimelineNode,
  CollaborationTimelineSnapshot,
} from "../../../contracts/collaboration/collaboration.js";
import type { EvolutionProposal, NangongEvolutionState } from "../../../contracts/collaboration/nangong-evolution.js";
import type { SqliteDatabase } from "./persistence/sqlite-database.js";

const HAN_LI: CollaborationParticipantSnapshot = { memberId: "han-li", displayName: "韩立" };
const NANGONG: CollaborationParticipantSnapshot = { memberId: "nangong-wan", displayName: "南宫婉" };
const LINGHU: CollaborationParticipantSnapshot = { memberId: "linghu-ancestor", displayName: "令狐老祖" };
const SYSTEM: CollaborationParticipantSnapshot = { memberId: "system", displayName: "系统" };

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
  readonly #cutoverAt: string;

  constructor(database: SqliteDatabase) {
    this.#database = database;
    this.#cutoverAt = database.withConnection((connection) => {
      const row = connection.prepare("SELECT appliedAt FROM AiDesktopSchemaVersion WHERE versionCode = '1003'").get() as { appliedAt?: unknown } | undefined;
      return typeof row?.appliedAt === "string" ? row.appliedAt : new Date().toISOString();
    });
  }

  syncEvolutionState(state: NangongEvolutionState): void {
    this.#database.transaction((connection) => {
      for (const topic of state.topics) {
        const groupId = `topic:${topic.topicId}`;
        if (!this.#tracks(connection, groupId, topic.createdAt)) continue;
        const proposals = state.proposals.filter((proposal) => proposal.topicId === topic.topicId).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
        if (!proposals.length) continue;
        const latest = proposals.at(-1)!;
        this.#upsertTopic(connection, {
          groupId, topicId: topic.topicId, proposalId: latest.proposalId, title: topic.title,
          status: topicStatus(latest.status), summary: latest.resultSummary || latest.content,
          startedAt: topic.createdAt, updatedAt: topic.updatedAt,
        });
        for (const proposal of proposals) this.#appendProposalFacts(connection, groupId, proposal, proposals, state);
      }
    });
  }

  syncCollaborationState(state: CollaborationState): void {
    this.#database.transaction((connection) => {
      for (const task of state.tasks) {
        let group = task.evolutionProposalId ? connection.prepare(`
          SELECT groupId, topicId, proposalId, title FROM AiDesktopCollaborationTopic
          WHERE proposalId = $proposalId OR groupId IN (
            SELECT groupId FROM AiDesktopCollaborationTimelineEvent WHERE proposalId = $proposalId
          ) ORDER BY updatedAt DESC LIMIT 1
        `).get({ $proposalId: task.evolutionProposalId }) as Record<string, unknown> | undefined : undefined;
        if (!group) {
          const groupId = `task:${task.taskId}`;
          if (!this.#tracks(connection, groupId, task.createdAt)) continue;
          this.#upsertTopic(connection, {
            groupId, topicId: null, proposalId: task.evolutionProposalId, title: task.snapshot.title,
            status: taskStatus(task), summary: task.blockingReason || task.finalResult || task.snapshot.confirmedIntent,
            startedAt: task.createdAt, updatedAt: task.updatedAt,
          });
          group = { groupId, topicId: null, proposalId: task.evolutionProposalId, title: task.snapshot.title };
        } else {
          connection.prepare(`UPDATE AiDesktopCollaborationTopic SET status=$status, summary=$summary,
            updatedAt=CASE WHEN updatedAt < $updatedAt THEN $updatedAt ELSE updatedAt END WHERE groupId=$groupId`).run({
            $status: taskStatus(task), $summary: task.blockingReason || task.finalResult || task.snapshot.confirmedIntent,
            $updatedAt: task.updatedAt, $groupId: String(group.groupId),
          });
        }
        this.#appendTaskFacts(connection, String(group.groupId), task);
      }
    });
  }

  appendStream(taskId: string, memberId: string, event: CodexStreamEvent, occurredAt = new Date().toISOString()): void {
    this.#database.transaction((connection) => {
      const active = connection.prepare(`
        SELECT timeline.groupId, timeline.nodeId
        FROM AiDesktopCollaborationTimelineEvent timeline
        JOIN AiDesktopCollaborationTopic topic ON topic.groupId = timeline.groupId
        WHERE timeline.taskId=$taskId AND timeline.actorMemberId=$memberId
        ORDER BY timeline.sequenceNumber DESC LIMIT 1
      `).get({ $taskId: taskId, $memberId: memberId }) as { groupId: string; nodeId: string } | undefined;
      if (!active) return;
      const sequence = Number((connection.prepare("SELECT COALESCE(MAX(sequenceNumber), 0) + 1 AS value FROM AiDesktopCollaborationStreamChunk WHERE taskId=$taskId").get({ $taskId: taskId }) as { value: number | bigint }).value);
      connection.prepare(`INSERT INTO AiDesktopCollaborationStreamChunk
        (chunkId, groupId, taskId, nodeId, memberId, turnId, segmentId, itemId, eventType, sequenceNumber, deltaText, snapshotText, occurredAt)
        VALUES ($chunkId, $groupId, $taskId, $nodeId, $memberId, $turnId, $segmentId, $itemId, $eventType, $sequenceNumber, $deltaText, $snapshotText, $occurredAt)`).run({
        $chunkId: `timeline-stream-${randomUUID()}`, $groupId: active.groupId, $taskId: taskId, $nodeId: active.nodeId,
        $memberId: memberId, $turnId: event.turnId, $segmentId: event.segmentId || null, $itemId: event.itemId || null,
        $eventType: event.type, $sequenceNumber: sequence, $deltaText: event.delta || null,
        $snapshotText: event.text || event.managedExecution?.message || event.error || null, $occurredAt: occurredAt,
      });
      connection.prepare("UPDATE AiDesktopCollaborationTopic SET updatedAt=$occurredAt WHERE groupId=$groupId AND updatedAt < $occurredAt").run({ $occurredAt: occurredAt, $groupId: active.groupId });
    });
  }

  snapshot(now = new Date().toISOString()): CollaborationTimelineSnapshot {
    return this.#database.withConnection((connection) => {
      const topics = connection.prepare(`SELECT groupId, topicId, proposalId, title, status, summary, startedAt, updatedAt
        FROM AiDesktopCollaborationTopic ORDER BY updatedAt DESC, groupId`).all() as Array<Record<string, unknown>>;
      const groups = topics.map((topic) => this.#group(connection, topic, now));
      return { version: 1, groups, updatedAt: groups.map((group) => group.updatedAt).sort().at(-1) || now };
    });
  }

  #tracks(connection: DatabaseSync, groupId: string, sourceCreatedAt: string): boolean {
    if (connection.prepare("SELECT 1 FROM AiDesktopCollaborationTopic WHERE groupId=$groupId").get({ $groupId: groupId })) return true;
    return sourceCreatedAt >= this.#cutoverAt;
  }

  #upsertTopic(connection: DatabaseSync, input: {
    groupId: string; topicId: string | null; proposalId: string | null; title: string;
    status: CollaborationTimelineGroup["status"]; summary: string; startedAt: string; updatedAt: string;
  }): void {
    connection.prepare(`INSERT INTO AiDesktopCollaborationTopic
      (groupId, topicId, proposalId, title, status, summary, startedAt, updatedAt, createdAt)
      VALUES ($groupId, $topicId, $proposalId, $title, $status, $summary, $startedAt, $updatedAt, $createdAt)
      ON CONFLICT(groupId) DO UPDATE SET proposalId=excluded.proposalId, title=excluded.title,
        status=excluded.status, summary=excluded.summary,
        updatedAt=CASE WHEN AiDesktopCollaborationTopic.updatedAt < excluded.updatedAt THEN excluded.updatedAt ELSE AiDesktopCollaborationTopic.updatedAt END`).run({
      $groupId: input.groupId, $topicId: input.topicId, $proposalId: input.proposalId, $title: input.title,
      $status: input.status, $summary: input.summary, $startedAt: input.startedAt,
      $updatedAt: input.updatedAt, $createdAt: new Date().toISOString(),
    });
  }

  #appendProposalFacts(connection: DatabaseSync, groupId: string, proposal: EvolutionProposal, proposals: EvolutionProposal[], state: NangongEvolutionState): void {
    const waiting = proposal.status === "pending-approval"
      && !(proposal.origin === "linghu" ? state.automaticLinghuApprovalEnabled : state.automaticNangongApprovalEnabled);
    const decisionAt = proposal.approvals[0]?.createdAt || (proposal.status === "pending-approval" ? null : proposal.updatedAt);
    this.#appendFact(connection, {
      groupId, proposalId: proposal.proposalId, taskId: null, nodeId: `proposal:${proposal.proposalId}`,
      sourceFactKey: `proposal:${proposal.proposalId}:application:${waiting ? "waiting" : "submitted"}`,
      kind: "approval-application", actor: participant(proposal.submitterMemberId, proposal.submitterDisplayName), recipients: [HAN_LI],
      status: waiting ? "current" : "completed", action: proposal.supersedesProposalId ? "补充后再次申请" : "审批申请",
      summary: proposal.content, content: proposal.content, detail: proposal.evidence.join("\n"), startedAt: proposal.createdAt,
      completedAt: waiting ? null : decisionAt || proposal.createdAt, automaticOpen: waiting,
      manualApprovalProposalId: waiting ? proposal.proposalId : null, occurredAt: decisionAt || proposal.createdAt,
    });
    for (const approval of proposal.approvals) this.#appendFact(connection, {
      groupId, proposalId: proposal.proposalId, taskId: null, nodeId: `approval:${approval.approvalId}`,
      sourceFactKey: `approval:${approval.approvalId}`, kind: "approval-decision",
      actor: participant(approval.approverMemberId, approval.approverDisplayName),
      recipients: [participant(proposal.submitterMemberId, proposal.submitterDisplayName)],
      status: approval.decision === "approved" ? "completed" : "failed",
      action: approval.decision === "approved" ? "审批通过" : "审批未通过",
      summary: approval.advice, content: approval.advice, detail: approval.capabilityScope || "",
      startedAt: approval.createdAt, completedAt: approval.createdAt, automaticOpen: false,
      manualApprovalProposalId: null, occurredAt: approval.createdAt,
    });
    if (!proposal.distributedTaskIds.length) return;
    const recipients = proposal.distributedTaskIds.map((taskId) => {
      const timelineActor = connection.prepare(`SELECT actorMemberId, actorDisplayName
        FROM AiDesktopCollaborationTimelineEvent WHERE taskId=$taskId AND kind IN ('analysis', 'execution')
        ORDER BY sequenceNumber LIMIT 1`).get({ $taskId: taskId }) as { actorMemberId?: unknown; actorDisplayName?: unknown } | undefined;
      if (typeof timelineActor?.actorMemberId === "string" && typeof timelineActor.actorDisplayName === "string") {
        return participant(timelineActor.actorMemberId, timelineActor.actorDisplayName);
      }
      const row = connection.prepare("SELECT executorMemberId FROM AiDesktopTaskExecution WHERE taskId=$taskId").get({ $taskId: taskId }) as { executorMemberId?: unknown } | undefined;
      const memberId = typeof row?.executorMemberId === "string" ? row.executorMemberId : "pending";
      const runtimeMember = connection.prepare("SELECT displayName FROM AiDesktopMemberRuntime WHERE memberId=$memberId").get({ $memberId: memberId }) as { displayName?: unknown } | undefined;
      return participant(memberId, typeof runtimeMember?.displayName === "string" ? runtimeMember.displayName : memberId === "pending" ? "等待分配" : memberId);
    }).filter(uniqueParticipant);
    const plannedAt = proposal.distributionPlan?.plannedAt || proposal.updatedAt;
    this.#appendFact(connection, {
      groupId, proposalId: proposal.proposalId, taskId: null, nodeId: `distribution:${proposal.proposalId}`,
      sourceFactKey: `distribution:${proposal.proposalId}`, kind: "distribution",
      actor: participant(proposal.submitterMemberId, proposal.submitterDisplayName), recipients,
      status: "completed", action: "任务分发", summary: proposal.distributionPlan?.summary || proposal.content,
      content: distributionContent(proposal, proposals),
      detail: proposal.distributionPlan?.units.map((unit) => `${unit.title}：${unit.scope}`).join("\n") || "",
      startedAt: plannedAt, completedAt: plannedAt, automaticOpen: false, manualApprovalProposalId: null, occurredAt: plannedAt,
    });
  }

  #appendTaskFacts(connection: DatabaseSync, groupId: string, task: CollaborationTask): void {
    const initiator = task.initiator || NANGONG;
    const completedAnalysisAssignments = new Set<string>();
    for (const plan of task.plans) {
      const assignment = [...task.executionRecords].reverse().find((record) => record.executor.memberId === plan.ownerMemberId && record.assignedAt <= plan.createdAt);
      const firstForAssignment = Boolean(assignment && !completedAnalysisAssignments.has(assignment.assignmentId));
      if (assignment) completedAnalysisAssignments.add(assignment.assignmentId);
      this.#appendFact(connection, {
        groupId, proposalId: task.evolutionProposalId, taskId: task.taskId,
        nodeId: firstForAssignment ? `analysis:${task.taskId}:assignment:${assignment!.assignmentId}` : `analysis:${task.taskId}:plan:${plan.version}`,
        sourceFactKey: `analysis:${task.taskId}:plan:${plan.version}`, kind: "analysis",
        actor: participant(plan.ownerMemberId, plan.ownerDisplayName), recipients: [initiator], status: "completed", action: "技术分析",
        summary: plan.text, content: plan.text, detail: [...task.snapshot.constraints, ...task.snapshot.acceptanceCriteria].join("\n"),
        startedAt: assignment?.assignedAt || task.startedAt, completedAt: plan.createdAt, automaticOpen: false,
        manualApprovalProposalId: null, occurredAt: plan.createdAt,
      });
    }
    for (const record of task.executionRecords) {
      const plan = [...task.plans].reverse().find((candidate) => candidate.ownerMemberId === record.executor.memberId && candidate.createdAt >= record.assignedAt);
      if (!plan && record.status === "analyzing") this.#appendFact(connection, {
        groupId, proposalId: task.evolutionProposalId, taskId: task.taskId, nodeId: `analysis:${task.taskId}:assignment:${record.assignmentId}`,
        sourceFactKey: `analysis:${task.taskId}:${record.assignmentId}:started`, kind: "analysis", actor: record.executor,
        recipients: [initiator], status: "current", action: "当前正在技术分析", summary: task.snapshot.confirmedIntent,
        content: "", detail: [...task.snapshot.constraints, ...task.snapshot.acceptanceCriteria].join("\n"),
        startedAt: record.assignedAt, completedAt: null, automaticOpen: true,
        manualApprovalProposalId: null, occurredAt: record.assignedAt,
      });

      const isLatestVerification = record === task.executionRecords.at(-1) && task.phase === "verifying";
      const executionStatus: CollaborationTimelineNode["status"] = record.status === "blocked" ? "failed"
        : record.status === "assigned" || record.status === "analyzing" ? "waiting"
          : isLatestVerification || ["code-verified", "transferred", "cancelled"].includes(record.status) ? "completed" : "current";
      const executionCompletedAt = executionStatus === "completed" || executionStatus === "failed" ? record.completedAt || task.updatedAt : null;
      this.#appendFact(connection, {
        groupId, proposalId: task.evolutionProposalId, taskId: task.taskId, nodeId: `execution:${task.taskId}:${record.assignmentId}`,
        sourceFactKey: `execution:${task.taskId}:${record.assignmentId}:${record.status}:${executionCompletedAt || "open"}`,
        kind: "execution", actor: record.executor, recipients: [initiator], status: executionStatus,
        action: executionStatus === "failed" ? "处理失败" : executionStatus === "waiting" ? "等待执行" : executionStatus === "completed" ? "执行完成" : "当前正在执行",
        summary: record.blockingReason || record.result || task.snapshot.confirmedIntent,
        content: record.result || (executionStatus === "current" ? "" : task.snapshot.confirmedIntent),
        detail: (record.changedFiles || []).join("\n"), startedAt: record.executionStartedAt || plan?.createdAt || record.assignedAt,
        completedAt: executionCompletedAt, automaticOpen: executionStatus === "current" || executionStatus === "failed",
        manualApprovalProposalId: null, occurredAt: executionCompletedAt || record.executionStartedAt || record.assignedAt,
      });

      const verifying = isLatestVerification;
      const verified = record.status === "code-verified";
      if (verifying || verified) this.#appendFact(connection, {
        groupId, proposalId: task.evolutionProposalId, taskId: task.taskId, nodeId: `verification:${task.taskId}:${record.assignmentId}`,
        sourceFactKey: `verification:${task.taskId}:${record.assignmentId}:${verified ? "completed" : "started"}`,
        kind: "verification", actor: record.executor, recipients: [initiator], status: verified ? "completed" : "current",
        action: verified ? "验证完成" : "当前正在验证", summary: record.result || task.flowEvents.at(-1)?.summary || "正在验证已完成的修改",
        content: record.result || "", detail: (record.changedFiles || []).join("\n"),
        startedAt: record.executionStartedAt || record.assignedAt, completedAt: verified ? record.completedAt || task.codeVerifiedAt : null,
        automaticOpen: !verified, manualApprovalProposalId: null, occurredAt: verified ? record.completedAt || task.codeVerifiedAt || task.updatedAt : task.updatedAt,
      });
    }

    if (!task.executionRecords.length) {
      const actor = task.originalExecutor || task.currentHandler || participant(task.preferredExecutorMemberId || "pending", "等待分配");
      this.#appendFact(connection, {
        groupId, proposalId: task.evolutionProposalId, taskId: task.taskId, nodeId: `execution:${task.taskId}:waiting`,
        sourceFactKey: `execution:${task.taskId}:waiting`, kind: "execution", actor, recipients: [initiator], status: "waiting",
        action: "等待执行", summary: task.snapshot.confirmedIntent, content: task.snapshot.confirmedIntent,
        detail: task.snapshot.acceptanceCriteria.join("\n"), startedAt: task.createdAt, completedAt: null,
        automaticOpen: false, manualApprovalProposalId: null, occurredAt: task.createdAt,
      });
    }

    for (const event of task.flowEvents) {
      const mapped = flowFact(task, event, initiator);
      if (mapped) this.#appendFact(connection, { ...mapped, groupId, proposalId: task.evolutionProposalId, taskId: task.taskId, sourceFactKey: `flow:${event.eventId}`, occurredAt: event.occurredAt });
    }
  }

  #appendFact(connection: DatabaseSync, fact: TimelineFact): void {
    if (connection.prepare("SELECT 1 FROM AiDesktopCollaborationTimelineEvent WHERE sourceFactKey=$sourceFactKey").get({ $sourceFactKey: fact.sourceFactKey })) return;
    const sequenceNumber = Number((connection.prepare("SELECT COALESCE(MAX(sequenceNumber), 0) + 1 AS value FROM AiDesktopCollaborationTimelineEvent WHERE groupId=$groupId").get({ $groupId: fact.groupId }) as { value: number | bigint }).value);
    connection.prepare(`INSERT INTO AiDesktopCollaborationTimelineEvent
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
    const rows = connection.prepare(`SELECT * FROM AiDesktopCollaborationTimelineEvent WHERE groupId=$groupId
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
    const calculated = currentNodes.some((node) => node.kind === "approval-application") ? "waiting-approval"
      : currentNodes.some((node) => node.kind === "verification") ? "verifying"
        : currentNodes.length > 0 ? "running"
          : nodes.at(-1)?.status === "failed" ? "blocked"
            : String(topic.status) as CollaborationTimelineGroup["status"];
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

function flowFact(task: CollaborationTask, event: CollaborationTask["flowEvents"][number], initiator: CollaborationParticipantSnapshot): Omit<TimelineFact, "groupId" | "proposalId" | "taskId" | "sourceFactKey" | "occurredAt"> | null {
  const actor = event.actor || SYSTEM;
  if (event.type === "task.code_verified" && task.evolutionProposalId) return {
    nodeId: `return:${task.taskId}`, kind: "result", actor, recipients: [initiator], status: "completed", action: "执行结果返回",
    summary: event.summary, content: task.finalResult || event.summary, detail: task.resultSummary?.changes || "",
    startedAt: task.startedAt, completedAt: event.occurredAt, automaticOpen: false, manualApprovalProposalId: null,
  };
  if (event.type === "evolution.task_collected") return {
    nodeId: `collection:${task.evolutionRoundId || task.taskId}`, kind: "result", actor: NANGONG, recipients: [LINGHU], status: "completed",
    action: "结果汇总并交给令狐", summary: event.summary, content: event.summary, detail: task.finalResult || "",
    startedAt: event.occurredAt, completedAt: event.occurredAt, automaticOpen: false, manualApprovalProposalId: null,
  };
  if (event.type === "unified_test.started" || event.type === "unified_test.passed" || event.type === "unified_test.failed") return {
    nodeId: `unified-test:${task.taskId}:${task.integrationGeneration || 0}`, kind: "verification", actor, recipients: [NANGONG],
    status: event.type === "unified_test.failed" ? "failed" : event.type === "unified_test.passed" ? "completed" : "current",
    action: event.type === "unified_test.failed" ? "统一测试未通过" : event.type === "unified_test.passed" ? "统一测试通过" : "当前正在统一测试",
    summary: event.summary, content: event.summary, detail: task.integrationFailure?.detail || "", startedAt: task.unifiedTest?.startedAt || event.occurredAt,
    completedAt: event.type === "unified_test.started" ? null : event.occurredAt, automaticOpen: event.type !== "unified_test.passed", manualApprovalProposalId: null,
  };
  if (event.type.startsWith("unified_test.repair_") || event.type.startsWith("execution.repair_")) return {
    nodeId: `repair:${task.taskId}:${task.taskRevision}`, kind: "repair", actor: event.actor || LINGHU, recipients: [initiator],
    status: event.status === "failed" ? "failed" : event.status === "completed" ? "completed" : "current",
    action: event.status === "failed" ? "修复失败" : event.status === "completed" ? "修复完成" : "当前正在修复",
    summary: event.summary, content: event.summary, detail: task.repairFailureReason || task.integrationFailure?.detail || "",
    startedAt: event.occurredAt, completedAt: event.status === "started" ? null : event.occurredAt,
    automaticOpen: event.status !== "completed", manualApprovalProposalId: null,
  };
  if (event.type === "integration.batch_frozen") return {
    nodeId: `handoff:${task.taskId}:${task.integrationGeneration || 0}`, kind: "result", actor: NANGONG, recipients: [LINGHU], status: "completed",
    action: "任务交接", summary: event.summary, content: "南宫婉已将完整执行结果交给令狐老祖统一验证。", detail: event.summary,
    startedAt: event.occurredAt, completedAt: event.occurredAt, automaticOpen: false, manualApprovalProposalId: null,
  };
  if (event.type === "release.restart_healthy") return {
    nodeId: `acceptance:${task.taskId}:${task.integrationGeneration || 0}`, kind: "result", actor, recipients: [NANGONG], status: "completed",
    action: "发布验收完成", summary: event.summary, content: event.summary, detail: task.finalResult || "",
    startedAt: event.occurredAt, completedAt: event.occurredAt, automaticOpen: false, manualApprovalProposalId: null,
  };
  if (event.type === "task.blocked") return {
    nodeId: `blocked:${event.eventId}`, kind: "repair", actor, recipients: [LINGHU], status: "failed", action: "处理失败",
    summary: event.summary, content: event.summary, detail: task.blockingReason || "", startedAt: event.occurredAt,
    completedAt: event.occurredAt, automaticOpen: true, manualApprovalProposalId: null,
  };
  return null;
}

function visibleStreamText(connection: DatabaseSync, groupId: string, nodeId: string): string {
  const rows = connection.prepare(`SELECT turnId, eventType, deltaText, snapshotText FROM AiDesktopCollaborationStreamChunk
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

function topicStatus(status: EvolutionProposal["status"]): CollaborationTimelineGroup["status"] {
  if (status === "pending-approval" || status === "supplement-required") return "waiting-approval";
  if (status === "blocked" || status === "rejected") return "blocked";
  if (status === "completed") return "completed";
  if (status === "pending-acceptance" || status === "verifying") return "verifying";
  return "running";
}

function taskStatus(task: CollaborationTask): CollaborationTimelineGroup["status"] {
  if (task.state === "integrated") return "completed";
  if (task.state === "cancelled") return "cancelled";
  if (task.state === "blocked" || task.state === "test-failed") return "blocked";
  if (task.state === "unified-testing" || task.state === "awaiting-restart" || task.phase === "verifying") return "verifying";
  return "running";
}

function distributionContent(proposal: EvolutionProposal, proposals: EvolutionProposal[]): string {
  const supplements = proposal.revisionFeedbackApprovalId ? proposals
    .filter((candidate) => candidate.createdAt < proposal.createdAt)
    .flatMap((candidate) => candidate.approvals)
    .filter((approval) => approval.decision !== "approved" && approval.advice.trim())
    .map((approval) => `审批未通过补充：${approval.advice.trim()}`).join("\n") : "";
  const tasks = proposal.distributionPlan?.units.map((unit) => `${unit.title}：${unit.scope}`).join("\n") || proposal.content;
  return [proposal.content, supplements, tasks].filter(Boolean).join("\n\n");
}

function nextStep(status: CollaborationTimelineGroup["status"], nodes: CollaborationTimelineNode[]): string {
  if (status === "waiting-approval") return "韩立审批 · 等待中";
  if (status === "blocked") return "问题修复 · 等待恢复";
  if (status === "completed") return "本专题已完成";
  const active = nodes.filter((node) => node.status === "current" || node.status === "waiting");
  return active.length ? `结果汇总与验收 · 等待 ${active.length} 个节点完成` : "下一任务 · 等待中";
}

function participant(memberId: string, displayName: string): CollaborationParticipantSnapshot { return { memberId, displayName }; }
function uniqueParticipant(value: CollaborationParticipantSnapshot, index: number, items: CollaborationParticipantSnapshot[]): boolean { return items.findIndex((item) => item.memberId === value.memberId) === index; }
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
