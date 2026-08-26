import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import type { ApprovalGovernanceRecord } from "../../../contracts/approval-governance.js";
import type { CollaborationState, CollaborationTask } from "../../../contracts/collaboration.js";
import type { LinghuAutomationState } from "../../../contracts/linghu-automation.js";
import type { EvolutionArchiveActor, EvolutionArchiveCategory, EvolutionArchiveRecord, EvolutionProposal, EvolutionTopicDossier, NangongEvolutionState } from "../../../contracts/nangong-evolution.js";
import type { StalledTaskDetection, WorkflowEventCategory, WorkflowEventInput, WorkflowEventSeverity, WorkflowEventStatus, WorkflowExceptionRecord } from "../../../contracts/workflow.js";
import type { SqliteDatabase } from "./persistence/sqlite-database.js";

const STALE_AFTER_MS = 120_000;
const TERMINAL_TASK_STATES = new Set(["integrated", "cancelled"]);

/** 把现有协同控制面投影到统一 SQLite；JSON 继续负责恢复对象图，数据库负责跨角色查询、异常和审计。 */
export class WorkflowRepository {
  readonly #database: SqliteDatabase;
  readonly #sessionId = `runtime-session-${randomUUID()}`;

  constructor(database: SqliteDatabase) {
    this.#database = database;
  }

  startRuntimeSession(processId = process.pid, now = new Date().toISOString()): string[] {
    return this.#database.transaction((connection) => {
      const interrupted = connection.prepare("SELECT sessionId FROM AiDesktopRuntimeSession WHERE state = 'running'").all() as Array<{ sessionId: string }>;
      connection.prepare("UPDATE AiDesktopRuntimeSession SET state = 'interrupted', stoppedAt = $now WHERE state = 'running'").run({ $now: now });
      connection.prepare("UPDATE AiDesktopEvent SET status = 'open', handlingOwnerId = NULL, handlingStartedAt = NULL WHERE status = 'processing'").run();
      connection.prepare("INSERT INTO AiDesktopRuntimeSession (sessionId, processId, state, startedAt, heartbeatAt, stoppedAt) VALUES ($sessionId, $processId, 'running', $now, $now, NULL)").run({
        $sessionId: this.#sessionId,
        $processId: processId,
        $now: now,
      });
      for (const previous of interrupted) this.#insertEvent(connection, {
        eventId: `runtime-interrupted:${previous.sessionId}`,
        sourceType: "launcher",
        sourceId: "evolution-launcher",
        eventType: "application.previous_runtime_interrupted",
        category: "technical-error",
        severity: "error",
        status: "open",
        message: "上一次 AI Desktop 运行未正常结束，已在本次启动时登记恢复事实。",
        payload: { interruptedSessionId: previous.sessionId, recoveredBySessionId: this.#sessionId },
        fingerprint: `runtime-interrupted:${previous.sessionId}`,
        occurredAt: now,
      });
      return interrupted.map((item) => item.sessionId);
    });
  }

  heartbeatRuntimeSession(now = new Date().toISOString()): void {
    this.#database.withConnection((connection) => connection.prepare("UPDATE AiDesktopRuntimeSession SET heartbeatAt = $now WHERE sessionId = $sessionId AND state = 'running'").run({ $now: now, $sessionId: this.#sessionId }));
  }

  stopRuntimeSession(now = new Date().toISOString()): void {
    this.#database.withConnection((connection) => connection.prepare("UPDATE AiDesktopRuntimeSession SET state = 'stopped', heartbeatAt = $now, stoppedAt = $now WHERE sessionId = $sessionId AND state = 'running'").run({ $now: now, $sessionId: this.#sessionId }));
  }

  recordEvent(input: WorkflowEventInput): string {
    return this.#database.withConnection((connection) => this.#insertEvent(connection, input));
  }

  recordAuditEvent(type: string, details: Record<string, unknown>, taskId?: string, occurredAt = new Date().toISOString()): string {
    const classified = classifyAuditEvent(type);
    const correlationId = taskId || stringValue(details.correlationId) || stringValue(details.proposalId) || stringValue(details.topicId);
    const sourceType = taskId ? "task" : workflowSourceType(details.sourceType) || classified.sourceType;
    const sourceId = stringValue(details.sourceId) || classified.sourceId;
    const severity = workflowSeverity(details.severity) || classified.severity;
    const eventId = this.recordEvent({
      correlationId,
      sourceType,
      sourceId,
      eventType: type,
      category: classified.category,
      severity,
      status: classified.status,
      message: stringValue(details.message) || stringValue(details.reason) || type,
      payload: details,
      fingerprint: stringValue(details.fingerprint),
      occurredAt,
    });
    if (correlationId && !["technical-error", "business-exception", "stalled"].includes(classified.category)) {
      this.resolveCorrelatedExceptions(correlationId, `后续事件 ${type} 已证明流程继续推进。`, occurredAt);
    }
    return eventId;
  }

  /** Codex 授权保留自己的 accept/decline 语义，同时进入统一审批审计投影。 */
  recordCodexApprovalDecision(input: {
    requestId: number;
    title: string;
    kind: string;
    decision: "accept" | "decline";
    command?: string;
    cwd?: string;
    trusted: boolean;
    correlationId?: string | null;
  }): void {
    const decidedAt = new Date().toISOString();
    this.#database.withConnection((connection) => this.#upsertGovernance(connection, {
      governanceId: `codex-approval:${input.requestId}:${decidedAt}`,
      domain: "codex-command",
      subjectId: String(input.requestId),
      correlationId: input.correlationId || null,
      title: input.title || "Codex 执行授权",
      requestKind: input.kind,
      decision: input.decision,
      initiatorId: "codex",
      initiatorDisplayName: "Codex",
      approverId: "user",
      approverDisplayName: "用户",
      source: input.trusted ? "manual-user-and-trust" : "manual-user",
      reason: input.command || input.title || input.kind,
      evidence: { command: input.command || null, cwd: input.cwd || null, trusted: input.trusted },
      decidedAt,
    }));
  }

  listApprovalGovernance(limit = 100): ApprovalGovernanceRecord[] {
    return this.#database.withConnection((connection) => {
      const rows = connection.prepare(`
        SELECT governanceId, domain, subjectId, correlationId, title, requestKind, decision,
          initiatorId, initiatorDisplayName, approverId, approverDisplayName, source, reason, evidenceJson, decidedAt
        FROM AiDesktopApprovalGovernance
        ORDER BY decidedAt DESC
        LIMIT $limit
      `).all({ $limit: Math.max(1, Math.min(500, limit)) }) as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        governanceId: String(row.governanceId), domain: row.domain as ApprovalGovernanceRecord["domain"],
        subjectId: String(row.subjectId), correlationId: nullableString(row.correlationId), title: String(row.title),
        requestKind: String(row.requestKind), decision: String(row.decision), initiatorId: nullableString(row.initiatorId),
        initiatorDisplayName: nullableString(row.initiatorDisplayName), approverId: String(row.approverId),
        approverDisplayName: String(row.approverDisplayName), source: String(row.source), reason: String(row.reason),
        evidence: parsePayload(row.evidenceJson), decidedAt: String(row.decidedAt),
      }));
    });
  }

  listUnhandledExceptions(limit = 50): WorkflowExceptionRecord[] {
    return this.#database.withConnection((connection) => {
      const rows = connection.prepare(`
        SELECT eventId, correlationId, sourceType, sourceId, eventType, category, severity, status,
          message, payloadJson, fingerprint, occurredAt, handlingOwnerId, handlingStartedAt
        FROM AiDesktopEvent
        WHERE category IN ('technical-error', 'business-exception', 'stalled')
          AND status IN ('open', 'processing')
          AND eventType NOT IN ('linghu.unified_exception.accepted', 'linghu.unified_issue.accepted')
        ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, occurredAt ASC
        LIMIT $limit
      `).all({ $limit: Math.max(1, Math.min(200, limit)) }) as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        eventId: String(row.eventId), correlationId: nullableString(row.correlationId),
        sourceType: row.sourceType as WorkflowExceptionRecord["sourceType"], sourceId: String(row.sourceId),
        eventType: String(row.eventType), category: row.category as WorkflowExceptionRecord["category"],
        severity: row.severity as WorkflowExceptionRecord["severity"], status: row.status as WorkflowExceptionRecord["status"],
        message: String(row.message), payload: parsePayload(row.payloadJson), fingerprint: nullableString(row.fingerprint),
        occurredAt: String(row.occurredAt), handlingOwnerId: nullableString(row.handlingOwnerId),
        handlingStartedAt: nullableString(row.handlingStartedAt),
      }));
    });
  }

  claimExceptions(eventIds: string[], ownerId: string, now = new Date().toISOString()): string[] {
    if (!eventIds.length) return [];
    return this.#database.transaction((connection) => {
      const claim = connection.prepare(`
        UPDATE AiDesktopEvent SET status = 'processing', handlingOwnerId = $ownerId, handlingStartedAt = COALESCE(handlingStartedAt, $now)
        WHERE eventId = $eventId AND status = 'open'
      `);
      const claimed: string[] = [];
      for (const eventId of eventIds) {
        const result = claim.run({ $ownerId: ownerId, $now: now, $eventId: eventId });
        if (Number(result.changes) > 0) claimed.push(eventId);
      }
      return claimed;
    });
  }

  resolveException(eventId: string, resolutionSummary: string, now = new Date().toISOString()): void {
    this.#database.withConnection((connection) => connection.prepare(`
      UPDATE AiDesktopEvent SET status = 'resolved', resolvedAt = $now, resolutionSummary = $summary
      WHERE eventId = $eventId AND status IN ('open', 'processing')
    `).run({ $now: now, $summary: resolutionSummary.slice(0, 2_000), $eventId: eventId }));
  }

  resolveCorrelatedExceptions(correlationId: string, resolutionSummary: string, now = new Date().toISOString()): void {
    this.#database.withConnection((connection) => connection.prepare(`
      UPDATE AiDesktopEvent SET status = 'resolved', resolvedAt = $now, resolutionSummary = $summary
      WHERE correlationId = $correlationId AND category IN ('technical-error', 'business-exception', 'stalled')
        AND status IN ('open', 'processing')
    `).run({ $now: now, $summary: resolutionSummary.slice(0, 2_000), $correlationId: correlationId }));
  }

  syncCollaborationState(state: CollaborationState): void {
    this.#database.transaction((connection) => {
      for (const member of state.members) connection.prepare(`
        INSERT INTO AiDesktopMemberRuntime (memberId, displayName, state, role, currentTaskId, generation, heartbeatAt, protocolProgressAt, blockingReason, updatedAt)
        VALUES ($memberId, $displayName, $state, $role, $currentTaskId, $generation, $heartbeatAt, $protocolProgressAt, $blockingReason, $updatedAt)
        ON CONFLICT(memberId) DO UPDATE SET displayName=excluded.displayName, state=excluded.state, role=excluded.role,
          currentTaskId=excluded.currentTaskId, generation=excluded.generation, heartbeatAt=excluded.heartbeatAt,
          protocolProgressAt=excluded.protocolProgressAt, blockingReason=excluded.blockingReason, updatedAt=excluded.updatedAt
      `).run({
        $memberId: member.memberId, $displayName: member.displayName, $state: member.state, $role: member.role,
        $currentTaskId: member.currentTaskId, $generation: member.generation, $heartbeatAt: member.lastHeartbeatAt,
        $protocolProgressAt: member.lastProtocolProgressAt, $blockingReason: member.blockingReason, $updatedAt: member.updatedAt,
      });
      for (const task of state.tasks) this.#upsertTask(connection, state, task);
      const roundIds = [...new Set(state.tasks.map((task) => task.evolutionRoundId).filter((value): value is string => Boolean(value)))];
      for (const roundId of roundIds) this.#upsertEvolutionRound(connection, state, roundId);
    });
  }

  syncEvolutionState(state: NangongEvolutionState): void {
    this.#database.transaction((connection) => {
      for (const deliberation of state.deliberations) {
        connection.prepare(`
          INSERT INTO AiDesktopEvolutionDeliberation (deliberationId, topicId, status, candidateJson, createdAt, updatedAt)
          VALUES ($deliberationId, $topicId, $status, $candidateJson, $createdAt, $updatedAt)
          ON CONFLICT(deliberationId) DO UPDATE SET topicId=excluded.topicId, status=excluded.status,
            candidateJson=excluded.candidateJson, updatedAt=excluded.updatedAt
        `).run({
          $deliberationId: deliberation.deliberationId, $topicId: deliberation.topicId, $status: deliberation.status,
          $candidateJson: deliberation.candidate ? JSON.stringify(deliberation.candidate) : null,
          $createdAt: deliberation.createdAt, $updatedAt: deliberation.updatedAt,
        });
        const insertSource = connection.prepare(`
          INSERT OR IGNORE INTO AiDesktopEvolutionSourceSnapshot
            (snapshotId, deliberationId, source, conversationId, sourceMessageId, sequenceNumber, role, responsePhase, content, originalCreatedAt, capturedAt)
          VALUES ($snapshotId, $deliberationId, $source, $conversationId, $sourceMessageId, $sequenceNumber, $role, $responsePhase, $content, $originalCreatedAt, $capturedAt)
        `);
        for (const snapshot of deliberation.sourceSnapshots) insertSource.run({
          $snapshotId: snapshot.snapshotId, $deliberationId: snapshot.deliberationId, $source: snapshot.source,
          $conversationId: snapshot.conversationId, $sourceMessageId: snapshot.sourceMessageId, $sequenceNumber: snapshot.sequenceNumber,
          $role: snapshot.role, $responsePhase: snapshot.responsePhase, $content: snapshot.content,
          $originalCreatedAt: snapshot.originalCreatedAt, $capturedAt: snapshot.capturedAt,
        });
      }
      const insertArchive = connection.prepare(`
        INSERT OR IGNORE INTO AiDesktopEvolutionArchiveRecord
          (recordId, deliberationId, topicId, proposalId, taskId, sequenceNumber, category, eventType, actor, title, originalPayloadJson, occurredAt, recordedAt)
        VALUES ($recordId, $deliberationId, $topicId, $proposalId, $taskId, $sequenceNumber, $category, $eventType, $actor, $title, $originalPayloadJson, $occurredAt, $recordedAt)
      `);
      for (const record of state.archiveRecords) insertArchive.run({
        $recordId: record.recordId, $deliberationId: record.deliberationId, $topicId: record.topicId,
        $proposalId: record.proposalId, $taskId: record.taskId, $sequenceNumber: record.sequenceNumber,
        $category: record.category, $eventType: record.eventType, $actor: record.actor, $title: record.title,
        $originalPayloadJson: JSON.stringify(record.payload), $occurredAt: record.occurredAt, $recordedAt: new Date().toISOString(),
      });
      for (const topic of state.topics) {
        const proposal = state.proposals.filter((item) => item.topicId === topic.topicId).sort((left, right) => right.version - left.version)[0];
        if (proposal) connection.prepare("DELETE FROM AiDesktopWorkflowRun WHERE workflowId = $workflowId").run({ $workflowId: `evolution-topic:${topic.topicId}` });
        connection.prepare(`
          INSERT INTO AiDesktopWorkflowRun (workflowId, topicId, proposalId, origin, title, state, currentStage, currentOwnerId, recoveryPoint, nextLaunchAt, startedAt, completedAt, updatedAt)
          VALUES ($workflowId, $topicId, $proposalId, $origin, $title, $state, $currentStage, $currentOwnerId, $recoveryPoint, $nextLaunchAt, $startedAt, $completedAt, $updatedAt)
          ON CONFLICT(workflowId) DO UPDATE SET proposalId=excluded.proposalId, title=excluded.title, state=excluded.state,
            currentStage=excluded.currentStage, currentOwnerId=excluded.currentOwnerId, recoveryPoint=excluded.recoveryPoint,
            nextLaunchAt=excluded.nextLaunchAt, completedAt=excluded.completedAt, updatedAt=excluded.updatedAt
        `).run({
          $workflowId: proposal ? `evolution:${proposal.proposalId}` : `evolution-topic:${topic.topicId}`,
          $topicId: topic.topicId, $proposalId: proposal?.proposalId || null,
          $origin: topic.origin, $title: topic.title, $state: topic.status, $currentStage: evolutionStage(topic.status),
          $currentOwnerId: evolutionOwner(topic.status, topic.origin), $recoveryPoint: topic.recoveryPoint,
          $nextLaunchAt: topic.status === "completed" && state.automaticEvolutionEnabled ? topic.updatedAt : null,
          $startedAt: topic.createdAt, $completedAt: topic.status === "completed" ? topic.updatedAt : null, $updatedAt: topic.updatedAt,
        });
      }
      for (const proposal of state.proposals) this.#upsertApprovals(connection, proposal);
    });
  }

  getEvolutionTopicDossier(topicId: string, state: NangongEvolutionState): EvolutionTopicDossier {
    const topic = state.topics.find((item) => item.topicId === topicId);
    if (!topic) throw new Error("专题池中不存在该专题。 ");
    const deliberation = topic.deliberationId ? state.deliberations.find((item) => item.deliberationId === topic.deliberationId) || null : null;
    const proposals = state.proposals.filter((item) => item.topicId === topicId);
    const proposalIds = new Set(proposals.map((item) => item.proposalId));
    const archiveRecords = state.archiveRecords.filter((item) => item.topicId === topicId || (deliberation && item.deliberationId === deliberation.deliberationId));
    const executionRecords = this.#database.withConnection((connection) => {
      // 任务即使还没有产生 flowEvent，也已经是专题从审批进入执行的事实，档案不能因此漏掉整条执行记录。
      const tasks = connection.prepare(`
        SELECT taskId, proposalId, executorMemberId, state, phase, runtimeStatus, heartbeatAt,
          timeoutAt, acceptanceState, startedAt, completedAt, updatedAt
        FROM AiDesktopTaskExecution
        ORDER BY startedAt, updatedAt, taskId
      `).all() as Array<Record<string, unknown>>;
      const rows = connection.prepare(`
        SELECT event.eventId, event.correlationId, event.sourceId, event.eventType, event.category, event.message,
          event.payloadJson, event.occurredAt, task.proposalId
        FROM AiDesktopEvent event
        JOIN AiDesktopTaskExecution task ON task.taskId = event.correlationId
        ORDER BY event.occurredAt, event.recordedAt
      `).all() as Array<Record<string, unknown>>;
      const taskRecords = tasks.filter((task) => proposalIds.has(String(task.proposalId))).map((task, index): EvolutionArchiveRecord => ({
        recordId: `task-snapshot:${String(task.taskId)}`, deliberationId: deliberation?.deliberationId || null, topicId,
        proposalId: String(task.proposalId), taskId: String(task.taskId), sequenceNumber: archiveRecords.length + index + 1,
        category: "execution", eventType: "task.execution.snapshot", actor: "system",
        title: `任务已进入 ${String(task.state)} 状态`,
        payload: {
          executorMemberId: task.executorMemberId, state: task.state, phase: task.phase,
          runtimeStatus: task.runtimeStatus, heartbeatAt: task.heartbeatAt, timeoutAt: task.timeoutAt,
          acceptanceState: task.acceptanceState, completedAt: task.completedAt,
        },
        occurredAt: String(task.updatedAt),
      }));
      const eventRecords = rows.filter((row) => proposalIds.has(String(row.proposalId))).map((row, index): EvolutionArchiveRecord => ({
        recordId: String(row.eventId), deliberationId: deliberation?.deliberationId || null, topicId,
        proposalId: String(row.proposalId), taskId: String(row.correlationId), sequenceNumber: archiveRecords.length + taskRecords.length + index + 1,
        category: dossierEventCategory(String(row.eventType), String(row.category)), eventType: String(row.eventType),
        actor: dossierEventActor(String(row.sourceId)), title: String(row.message), payload: parseObject(String(row.payloadJson)), occurredAt: String(row.occurredAt),
      }));
      return [...taskRecords, ...eventRecords];
    });
    return { topic: structuredClone(topic), deliberation: structuredClone(deliberation), proposals: structuredClone(proposals), archiveRecords: structuredClone(archiveRecords), executionRecords };
  }

  syncLinghuState(state: LinghuAutomationState): void {
    const now = state.updatedAt;
    this.#database.withConnection((connection) => connection.prepare(`
      INSERT INTO AiDesktopWorkflowRun (workflowId, topicId, proposalId, origin, title, state, currentStage, currentOwnerId, recoveryPoint, nextLaunchAt, startedAt, completedAt, updatedAt)
      VALUES ($workflowId, NULL, $proposalId, 'linghu', $title, $state, $stage, 'linghu-ancestor', $recoveryPoint, $nextLaunchAt, $startedAt, NULL, $updatedAt)
      ON CONFLICT(workflowId) DO UPDATE SET proposalId=excluded.proposalId, title=excluded.title, state=excluded.state,
        currentStage=excluded.currentStage, recoveryPoint=excluded.recoveryPoint, nextLaunchAt=excluded.nextLaunchAt, updatedAt=excluded.updatedAt
    `).run({
      $workflowId: `linghu:cycle:${state.cycle}`, $proposalId: state.pendingRepairProposalId,
      $title: `令狐老祖第${state.cycle}轮持续保障`, $state: state.enabled ? "running" : "disabled",
      $stage: state.currentModule, $recoveryPoint: state.recoveryCheckpoint,
      $nextLaunchAt: state.enabled ? new Date(Date.parse(now) + state.pollIntervalMs).toISOString() : null,
      $startedAt: state.lastDispatchAt || state.lastCheckedAt || now, $updatedAt: now,
    }));
  }

  detectStalledTasks(now = new Date().toISOString()): StalledTaskDetection[] {
    return this.#database.transaction((connection) => {
      const rows = connection.prepare(`
        SELECT taskId, workflowId, proposalId, executorMemberId, COALESCE(heartbeatAt, updatedAt) AS lastHeartbeatAt,
          timeoutAt, retryCount, maxRetries, blockingKind, blockingReason
        FROM AiDesktopTaskExecution
        WHERE runtimeStatus IN ('running', 'recovering') AND timeoutAt IS NOT NULL AND timeoutAt < $now
      `).all({ $now: now }) as unknown as StalledTaskDetection[];
      for (const row of rows) {
        connection.prepare("UPDATE AiDesktopTaskExecution SET runtimeStatus = 'stalled', updatedAt = $now WHERE taskId = $taskId").run({ $now: now, $taskId: row.taskId });
        this.#insertEvent(connection, {
          eventId: `task-stalled:${row.taskId}:${row.lastHeartbeatAt}`,
          correlationId: row.taskId,
          sourceType: "launcher",
          sourceId: "workflow-supervisor",
          eventType: "task.stalled",
          category: "stalled",
          severity: "error",
          status: "open",
          message: `任务 ${row.taskId} 超过心跳期限，等待令狐老祖安全恢复。`,
          payload: row as unknown as Record<string, unknown>,
          fingerprint: `task-stalled:${row.taskId}:${row.lastHeartbeatAt}`,
          occurredAt: now,
        });
      }
      return rows;
    });
  }

  tableCount(table: "AiDesktopEvent" | "AiDesktopWorkflowRun" | "AiDesktopTaskExecution" | "AiDesktopApprovalRecord" | "AiDesktopApprovalGovernance" | "AiDesktopMemberRuntime" | "AiDesktopRuntimeSession" | "AiDesktopConversationMemory" | "AiDesktopConversationTopic" | "AiDesktopConversationTopicLink" | "AiDesktopConversationArchiveMessage" | "AiDesktopEvolutionDeliberation" | "AiDesktopEvolutionSourceSnapshot" | "AiDesktopEvolutionArchiveRecord" | "AiDesktopEvolutionRound" | "AiDesktopEvolutionRoundTask"): number {
    return this.#database.withConnection((connection) => Number((connection.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number | bigint }).count));
  }

  #insertEvent(connection: DatabaseSync, input: WorkflowEventInput): string {
    const occurredAt = input.occurredAt || new Date().toISOString();
    const eventId = input.eventId || `workflow-event-${randomUUID()}`;
    const category = input.category || "audit";
    const severity = input.severity || defaultSeverity(category);
    const status = input.status || defaultStatus(category);
    connection.prepare(`
      INSERT OR IGNORE INTO AiDesktopEvent (eventId, correlationId, sourceType, sourceId, eventType, category, severity, status, message, payloadJson, fingerprint, occurredAt, recordedAt, resolvedAt)
      VALUES ($eventId, $correlationId, $sourceType, $sourceId, $eventType, $category, $severity, $status, $message, $payloadJson, $fingerprint, $occurredAt, $recordedAt, $resolvedAt)
    `).run({
      $eventId: eventId, $correlationId: input.correlationId || null, $sourceType: input.sourceType || "system",
      $sourceId: input.sourceId || "ai-desktop", $eventType: input.eventType, $category: category,
      $severity: severity, $status: status, $message: input.message || input.eventType,
      $payloadJson: JSON.stringify(input.payload || {}), $fingerprint: input.fingerprint || null,
      $occurredAt: occurredAt, $recordedAt: new Date().toISOString(), $resolvedAt: status === "resolved" ? occurredAt : null,
    });
    return eventId;
  }

  #upsertTask(connection: DatabaseSync, state: CollaborationState, task: CollaborationTask): void {
    const member = state.members.find((item) => item.memberId === task.executorMemberId && item.currentTaskId === task.taskId);
    const heartbeatAt = latestTime(member?.lastHeartbeatAt, member?.lastProtocolProgressAt, task.updatedAt);
    const timeoutAt = TERMINAL_TASK_STATES.has(task.state) ? null : new Date(Date.parse(heartbeatAt) + STALE_AFTER_MS).toISOString();
    const workflowId = task.evolutionProposalId ? `evolution:${task.evolutionProposalId}` : `collaboration:${task.taskId}`;
    if (!task.evolutionProposalId) connection.prepare(`
      INSERT INTO AiDesktopWorkflowRun (workflowId, topicId, proposalId, origin, title, state, currentStage, currentOwnerId, recoveryPoint, nextLaunchAt, startedAt, completedAt, updatedAt)
      VALUES ($workflowId, NULL, NULL, 'collaboration', $title, $state, $stage, $owner, $recoveryPoint, NULL, $startedAt, $completedAt, $updatedAt)
      ON CONFLICT(workflowId) DO UPDATE SET state=excluded.state, currentStage=excluded.currentStage, currentOwnerId=excluded.currentOwnerId,
        recoveryPoint=excluded.recoveryPoint, completedAt=excluded.completedAt, updatedAt=excluded.updatedAt
    `).run({
      $workflowId: workflowId, $title: task.snapshot.title, $state: task.state, $stage: task.phase || task.state,
      $owner: task.currentHandler?.memberId || task.executorMemberId || task.currentReviewerMemberId || task.initiator?.memberId || "collaboration-coordinator",
      $recoveryPoint: task.recoveryTargetState, $startedAt: task.startedAt, $completedAt: task.completedAt, $updatedAt: task.updatedAt,
    });
    const runtimeStatus = taskRuntimeStatus(task.state);
    connection.prepare(`
      INSERT INTO AiDesktopTaskExecution (taskId, workflowId, proposalId, title, initiatorMemberId, executorMemberId, state, phase, runtimeStatus, heartbeatAt, timeoutAt, retryCount, maxRetries, recoveryPoint, blockingKind, blockingReason, acceptanceState, startedAt, completedAt, updatedAt)
      VALUES ($taskId, $workflowId, $proposalId, $title, $initiatorMemberId, $executorMemberId, $state, $phase, $runtimeStatus, $heartbeatAt, $timeoutAt, $retryCount, 3, $recoveryPoint, $blockingKind, $blockingReason, $acceptanceState, $startedAt, $completedAt, $updatedAt)
      ON CONFLICT(taskId) DO UPDATE SET workflowId=excluded.workflowId, proposalId=excluded.proposalId, title=excluded.title,
        executorMemberId=excluded.executorMemberId, state=excluded.state, phase=excluded.phase, runtimeStatus=excluded.runtimeStatus,
        heartbeatAt=excluded.heartbeatAt, timeoutAt=excluded.timeoutAt, retryCount=excluded.retryCount,
        recoveryPoint=excluded.recoveryPoint, blockingKind=excluded.blockingKind, blockingReason=excluded.blockingReason,
        acceptanceState=excluded.acceptanceState, completedAt=excluded.completedAt, updatedAt=excluded.updatedAt
    `).run({
      $taskId: task.taskId, $workflowId: task.evolutionProposalId ? `evolution:${task.evolutionProposalId}` : workflowId,
      $proposalId: task.evolutionProposalId, $title: task.snapshot.title, $initiatorMemberId: task.initiator?.memberId || null,
      $executorMemberId: task.executorMemberId, $state: task.state, $phase: task.phase, $runtimeStatus: runtimeStatus,
      $heartbeatAt: heartbeatAt, $timeoutAt: timeoutAt, $retryCount: Math.min(task.workerGeneration, 3),
      $recoveryPoint: task.recoveryTargetState, $blockingKind: taskBlockingKind(task), $blockingReason: task.blockingReason,
      $acceptanceState: task.state === "integrated" ? "passed" : task.state === "cancelled" ? "cancelled" : task.state === "test-failed" ? "failed" : "pending",
      $startedAt: task.startedAt, $completedAt: task.completedAt, $updatedAt: task.updatedAt,
    });
    for (const event of task.flowEvents) this.#insertEvent(connection, {
      eventId: event.eventId, correlationId: task.taskId, sourceType: event.actor ? "member" : "task",
      sourceId: event.actor?.memberId || task.taskId, eventType: event.type,
      category: event.error ? "technical-error" : event.stage === "review" ? "approval" : event.stage === "execution" || event.stage === "integration" ? "execution" : "state-change",
      severity: event.error ? "error" : "info", status: event.error ? "open" : "observed", message: event.summary,
      payload: { stage: event.stage, status: event.status, actor: event.actor }, occurredAt: event.occurredAt,
    });
    for (const review of task.reviews) this.#upsertGovernance(connection, {
      governanceId: `collaboration-review:${review.reviewId}`,
      domain: "collaboration-review",
      subjectId: task.taskId,
      correlationId: task.evolutionProposalId || task.taskId,
      title: task.snapshot.title,
      requestKind: `plan-v${review.planVersion}`,
      decision: review.decision,
      initiatorId: task.initiator?.memberId || null,
      initiatorDisplayName: task.initiator?.displayName || null,
      approverId: review.reviewerMemberId,
      approverDisplayName: review.reviewerDisplayName,
      source: "collaboration-reviewer",
      reason: review.feedback,
      evidence: { planVersion: review.planVersion, reviewerGeneration: review.reviewerGeneration },
      decidedAt: review.createdAt,
    });
  }

  /** 保存南宫婉收集屏障和每项返回事实，应用重启后直接从同一轮恢复。 */
  #upsertEvolutionRound(connection: DatabaseSync, state: CollaborationState, roundId: string): void {
    const tasks = state.tasks.filter((task) => task.evolutionRoundId === roundId);
    if (!tasks.length) return;
    const returnedStates = new Set(["returned-to-nangong", "ready-for-integration", "queued-integration", "integrating", "unified-testing", "awaiting-restart", "test-failed", "integrated"]);
    const returnedTaskCount = tasks.filter((task) => returnedStates.has(task.state)).length;
    const blocked = tasks.some((task) => ["blocked", "cancelled", "test-failed"].includes(task.state));
    const completed = tasks.every((task) => task.state === "integrated");
    const integrating = tasks.some((task) => ["queued-integration", "integrating", "unified-testing", "awaiting-restart"].includes(task.state));
    const sealed = tasks.every((task) => ["ready-for-integration", "queued-integration", "integrating", "unified-testing", "awaiting-restart", "test-failed", "integrated"].includes(task.state));
    const roundState = completed ? "completed" : blocked ? "blocked" : integrating ? "integrating" : sealed ? "sealed" : "collecting";
    const sealedAt = tasks.flatMap((task) => task.flowEvents).filter((event) => event.type === "evolution.task_collected").map((event) => event.occurredAt).sort()[0] || null;
    const completedAt = completed ? tasks.map((task) => task.completedAt).filter((value): value is string => Boolean(value)).sort().at(-1) || null : null;
    const updatedAt = tasks.map((task) => task.updatedAt).sort().at(-1) || new Date().toISOString();
    connection.prepare(`
      INSERT INTO AiDesktopEvolutionRound (roundId, proposalId, state, expectedTaskCount, returnedTaskCount, sealedAt, submittedToLinghuAt, completedAt, updatedAt)
      VALUES ($roundId, $proposalId, $state, $expectedTaskCount, $returnedTaskCount, $sealedAt, $submittedToLinghuAt, $completedAt, $updatedAt)
      ON CONFLICT(roundId) DO UPDATE SET state=excluded.state, expectedTaskCount=excluded.expectedTaskCount,
        returnedTaskCount=excluded.returnedTaskCount, sealedAt=excluded.sealedAt,
        submittedToLinghuAt=excluded.submittedToLinghuAt, completedAt=excluded.completedAt, updatedAt=excluded.updatedAt
    `).run({
      $roundId: roundId, $proposalId: tasks[0].evolutionProposalId || roundId, $state: roundState,
      $expectedTaskCount: tasks.length, $returnedTaskCount: returnedTaskCount, $sealedAt: sealedAt,
      $submittedToLinghuAt: sealedAt, $completedAt: completedAt, $updatedAt: updatedAt,
    });
    const upsertTask = connection.prepare(`
      INSERT INTO AiDesktopEvolutionRoundTask (roundId, taskId, executorMemberId, collectionState, resultSha, returnedAt, updatedAt)
      VALUES ($roundId, $taskId, $executorMemberId, $collectionState, $resultSha, $returnedAt, $updatedAt)
      ON CONFLICT(roundId, taskId) DO UPDATE SET executorMemberId=excluded.executorMemberId,
        collectionState=excluded.collectionState, resultSha=excluded.resultSha, returnedAt=excluded.returnedAt, updatedAt=excluded.updatedAt
    `);
    for (const task of tasks) upsertTask.run({
      $roundId: roundId, $taskId: task.taskId, $executorMemberId: task.executorMemberId,
      $collectionState: evolutionRoundTaskState(task), $resultSha: task.versionWorkspace?.resultSha || null,
      $returnedAt: task.returnedToNangongAt, $updatedAt: task.updatedAt,
    });
  }

  #upsertApprovals(connection: DatabaseSync, proposal: EvolutionProposal): void {
    for (const approval of proposal.approvals) {
      connection.prepare(`
      INSERT OR IGNORE INTO AiDesktopApprovalRecord (approvalId, proposalId, title, proposalType, submitterId, submitterDisplayName, approverId, approverDisplayName, decision, source, approvalStage, advice, evidenceJson, referencedApprovalIdsJson, createdAt, approvedAt)
      VALUES ($approvalId, $proposalId, $title, $proposalType, $submitterId, $submitterDisplayName, $approverId, $approverDisplayName, $decision, $source, $approvalStage, $advice, $evidenceJson, $referencedApprovalIdsJson, $createdAt, $approvedAt)
    `).run({
      $approvalId: approval.approvalId, $proposalId: proposal.proposalId, $title: proposal.title,
      $proposalType: proposal.type, $submitterId: proposal.submitterMemberId, $submitterDisplayName: proposal.submitterDisplayName,
      $approverId: approval.approverMemberId, $approverDisplayName: approval.approverDisplayName,
      $decision: approval.decision, $source: approval.source, $approvalStage: approval.stage, $advice: approval.advice,
      $evidenceJson: JSON.stringify(proposal.evidence), $referencedApprovalIdsJson: JSON.stringify(approval.referencedApprovalIds),
      $createdAt: proposal.createdAt, $approvedAt: approval.createdAt,
    });
      this.#upsertGovernance(connection, {
        governanceId: `evolution-approval:${approval.approvalId}`,
        domain: "evolution",
        subjectId: proposal.proposalId,
        correlationId: proposal.topicId,
        title: proposal.title,
        requestKind: `${approval.stage}:${proposal.type}`,
        decision: approval.decision,
        initiatorId: proposal.submitterMemberId,
        initiatorDisplayName: proposal.submitterDisplayName,
        approverId: approval.approverMemberId,
        approverDisplayName: approval.approverDisplayName,
        source: approval.source,
        reason: approval.advice,
        evidence: { facts: proposal.evidence, referencedApprovalIds: approval.referencedApprovalIds },
        decidedAt: approval.createdAt,
      });
    }
  }

  #upsertGovernance(connection: DatabaseSync, record: ApprovalGovernanceRecord): void {
    connection.prepare(`
      INSERT INTO AiDesktopApprovalGovernance (governanceId, domain, subjectId, correlationId, title, requestKind, decision, initiatorId, initiatorDisplayName, approverId, approverDisplayName, source, reason, evidenceJson, decidedAt)
      VALUES ($governanceId, $domain, $subjectId, $correlationId, $title, $requestKind, $decision, $initiatorId, $initiatorDisplayName, $approverId, $approverDisplayName, $source, $reason, $evidenceJson, $decidedAt)
      ON CONFLICT(governanceId) DO UPDATE SET decision=excluded.decision, reason=excluded.reason, evidenceJson=excluded.evidenceJson, decidedAt=excluded.decidedAt
    `).run({
      $governanceId: record.governanceId, $domain: record.domain, $subjectId: record.subjectId,
      $correlationId: record.correlationId, $title: record.title, $requestKind: record.requestKind,
      $decision: record.decision, $initiatorId: record.initiatorId, $initiatorDisplayName: record.initiatorDisplayName,
      $approverId: record.approverId, $approverDisplayName: record.approverDisplayName, $source: record.source,
      $reason: record.reason, $evidenceJson: JSON.stringify(record.evidence), $decidedAt: record.decidedAt,
    });
  }
}

function classifyAuditEvent(type: string): { category: WorkflowEventCategory; severity: WorkflowEventSeverity; status: WorkflowEventStatus; sourceType: "member" | "system" | "launcher"; sourceId: string } {
  const sourceId = type.startsWith("han-li.") ? "han-li" : type.startsWith("nangong.") ? "nangong-wan" : type.startsWith("linghu.") ? "linghu-ancestor" : type.startsWith("application.") ? "evolution-launcher" : "ai-desktop";
  const sourceType = sourceId === "evolution-launcher" ? "launcher" : sourceId === "ai-desktop" ? "system" : "member";
  if (/business[._-]exception|validation[._-]failed/u.test(type)) return { category: "business-exception", severity: "warning", status: "open", sourceType, sourceId };
  if (/stalled|timeout|heartbeat[._-]missing/u.test(type)) return { category: "stalled", severity: "error", status: "open", sourceType, sourceId };
  if (/failed|error|exception|crash|interrupted/u.test(type)) return { category: "technical-error", severity: "error", status: "open", sourceType, sourceId };
  if (/approval|decided/u.test(type)) return { category: "approval", severity: "info", status: "observed", sourceType, sourceId };
  if (/task|execution|integration|test/u.test(type)) return { category: "execution", severity: "info", status: "observed", sourceType, sourceId };
  return { category: "state-change", severity: "info", status: "observed", sourceType, sourceId };
}

function defaultSeverity(category: WorkflowEventCategory): WorkflowEventSeverity { return category === "technical-error" || category === "stalled" ? "error" : category === "business-exception" ? "warning" : "info"; }
function defaultStatus(category: WorkflowEventCategory): WorkflowEventStatus { return ["technical-error", "business-exception", "stalled"].includes(category) ? "open" : "observed"; }
function stringValue(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function workflowSourceType(value: unknown): WorkflowEventInput["sourceType"] | null {
  return value === "member" || value === "system" || value === "launcher" || value === "task" ? value : null;
}
function workflowSeverity(value: unknown): WorkflowEventSeverity | null {
  return value === "info" || value === "warning" || value === "error" || value === "critical" ? value : null;
}
function nullableString(value: unknown): string | null { return typeof value === "string" && value ? value : null; }
function parsePayload(value: unknown): Record<string, unknown> { try { const parsed = JSON.parse(String(value)); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; } }
function parseObject(value: string): Record<string, unknown> { return parsePayload(value); }
function dossierEventCategory(eventType: string, category: string): EvolutionArchiveCategory {
  if (/test/iu.test(eventType)) return "test";
  if (/release|publish|restart/iu.test(eventType)) return "release";
  if (/approval|review|decided/iu.test(eventType)) return "approval";
  if (/failed|error|stalled|recover/iu.test(eventType) || ["technical-error", "business-exception", "stalled"].includes(category)) return "recovery";
  return "execution";
}
function dossierEventActor(sourceId: string): EvolutionArchiveActor {
  if (sourceId === "han-li") return "han-li";
  if (sourceId.includes("nangong")) return "nangong-wan";
  if (sourceId.includes("linghu")) return "linghu-ancestor";
  if (sourceId.includes("codex")) return "codex";
  return "system";
}
function latestTime(...values: Array<string | null | undefined>): string { return values.filter((value): value is string => Boolean(value)).sort((left, right) => Date.parse(right) - Date.parse(left))[0] || new Date().toISOString(); }
function taskRuntimeStatus(state: CollaborationTask["state"]): string {
  if (state === "integrated") return "completed";
  if (state === "cancelled") return "cancelled";
  if (state === "test-failed" || state === "review-failed" || state === "blocked") return "failed";
  if (state === "recovering" || state.startsWith("repairing-")) return "recovering";
  if (state.startsWith("queued-") || state === "returned-to-nangong" || state === "ready-for-integration") return "waiting";
  if (state === "preparing-worktree") return "queued";
  return "running";
}
function taskBlockingKind(task: CollaborationTask): string {
  const reason = task.blockingReason || "";
  if (!reason) return "none";
  if (/用户|人工|选择/u.test(reason)) return "business";
  if (/测试|test/iu.test(reason)) return "test";
  if (/数据|缺失|记录/u.test(reason)) return "data";
  if (/代码|编译|类型/u.test(reason)) return "code";
  return "infrastructure";
}
function evolutionStage(status: string): string { return status === "pending-approval" ? "approval" : status === "approved" ? "distribution" : status === "executing" ? "execution" : status === "verifying" ? "verification" : status === "completed" ? "next-evolution" : "investigation"; }
function evolutionOwner(status: string, origin: string): string { return status === "pending-approval" ? "han-li" : status === "approved" || status === "completed" ? origin === "linghu" ? "linghu-ancestor" : "nangong-wan" : status === "executing" || status === "verifying" ? "collaboration-coordinator" : origin === "linghu" ? "linghu-ancestor" : "nangong-wan"; }

function evolutionRoundTaskState(task: CollaborationTask): "executing" | "returned" | "sealed" | "integrating" | "blocked" | "completed" {
  if (task.state === "integrated") return "completed";
  if (["blocked", "cancelled", "test-failed"].includes(task.state)) return "blocked";
  if (["queued-integration", "integrating", "unified-testing", "awaiting-restart"].includes(task.state)) return "integrating";
  if (task.state === "ready-for-integration") return "sealed";
  if (task.state === "returned-to-nangong") return "returned";
  return "executing";
}
