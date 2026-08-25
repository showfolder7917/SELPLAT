import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import type { CollaborationState, CollaborationTask } from "../../../contracts/collaboration.js";
import type { LinghuAutomationState } from "../../../contracts/linghu-automation.js";
import type { EvolutionProposal, NangongEvolutionState } from "../../../contracts/nangong-evolution.js";
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
    const eventId = this.recordEvent({
      correlationId,
      sourceType: taskId ? "task" : classified.sourceType,
      sourceId: classified.sourceId,
      eventType: type,
      category: classified.category,
      severity: classified.severity,
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

  listUnhandledExceptions(limit = 50): WorkflowExceptionRecord[] {
    return this.#database.withConnection((connection) => {
      const rows = connection.prepare(`
        SELECT eventId, correlationId, sourceType, sourceId, eventType, category, severity, status,
          message, payloadJson, fingerprint, occurredAt, handlingOwnerId, handlingStartedAt
        FROM AiDesktopEvent
        WHERE category IN ('technical-error', 'business-exception', 'stalled') AND status IN ('open', 'processing')
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
    });
  }

  syncEvolutionState(state: NangongEvolutionState): void {
    this.#database.transaction((connection) => {
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

  tableCount(table: "AiDesktopEvent" | "AiDesktopWorkflowRun" | "AiDesktopTaskExecution" | "AiDesktopApprovalRecord" | "AiDesktopMemberRuntime" | "AiDesktopRuntimeSession" | "AiDesktopConversationMemory" | "AiDesktopConversationTopic" | "AiDesktopConversationTopicLink"): number {
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
  }

  #upsertApprovals(connection: DatabaseSync, proposal: EvolutionProposal): void {
    for (const approval of proposal.approvals) connection.prepare(`
      INSERT OR IGNORE INTO AiDesktopApprovalRecord (approvalId, proposalId, title, proposalType, submitterId, submitterDisplayName, approverId, approverDisplayName, decision, source, advice, evidenceJson, referencedApprovalIdsJson, createdAt, approvedAt)
      VALUES ($approvalId, $proposalId, $title, $proposalType, $submitterId, $submitterDisplayName, $approverId, $approverDisplayName, $decision, $source, $advice, $evidenceJson, $referencedApprovalIdsJson, $createdAt, $approvedAt)
    `).run({
      $approvalId: approval.approvalId, $proposalId: proposal.proposalId, $title: proposal.title,
      $proposalType: proposal.type, $submitterId: proposal.submitterMemberId, $submitterDisplayName: proposal.submitterDisplayName,
      $approverId: approval.approverMemberId, $approverDisplayName: approval.approverDisplayName,
      $decision: approval.decision, $source: approval.source, $advice: approval.advice,
      $evidenceJson: JSON.stringify(proposal.evidence), $referencedApprovalIdsJson: JSON.stringify(approval.referencedApprovalIds),
      $createdAt: proposal.createdAt, $approvedAt: approval.createdAt,
    });
  }
}

function classifyAuditEvent(type: string): { category: WorkflowEventCategory; severity: WorkflowEventSeverity; status: WorkflowEventStatus; sourceType: "member" | "system" | "launcher"; sourceId: string } {
  const sourceId = type.startsWith("nangong.") ? "nangong-wan" : type.startsWith("linghu.") ? "linghu-ancestor" : type.startsWith("application.") ? "evolution-launcher" : "ai-desktop";
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
function nullableString(value: unknown): string | null { return typeof value === "string" && value ? value : null; }
function parsePayload(value: unknown): Record<string, unknown> { try { const parsed = JSON.parse(String(value)); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; } }
function latestTime(...values: Array<string | null | undefined>): string { return values.filter((value): value is string => Boolean(value)).sort((left, right) => Date.parse(right) - Date.parse(left))[0] || new Date().toISOString(); }
function taskRuntimeStatus(state: CollaborationTask["state"]): string {
  if (state === "integrated") return "completed";
  if (state === "cancelled") return "cancelled";
  if (state === "test-failed" || state === "review-failed" || state === "blocked") return "failed";
  if (state === "recovering" || state.startsWith("repairing-")) return "recovering";
  if (state.startsWith("queued-") || state === "ready-for-integration") return "waiting";
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
