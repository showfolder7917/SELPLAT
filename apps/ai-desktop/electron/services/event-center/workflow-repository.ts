import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import type { ApprovalGovernanceRecord } from "../../../contracts/governance/approval-governance.js";
import type { CollaborationState, CollaborationTask } from "../../../contracts/collaboration/collaboration.js";
import type { LinghuAutomationState } from "../../../contracts/collaboration/linghu-automation.js";
import type { EvolutionArchiveActor, EvolutionArchiveCategory, EvolutionArchiveRecord, EvolutionProposal, EvolutionTopicDossier, EvolutionWorkbenchPage, EvolutionWorkbenchPreference, EvolutionWorkbenchRow, EvolutionWorkbenchView, NangongEvolutionState, QueryEvolutionWorkbenchRequest, SaveEvolutionWorkbenchPreferenceRequest } from "../../../contracts/collaboration/nangong-evolution.js";
import type { StalledTaskDetection, WorkflowEventCategory, WorkflowEventInput, WorkflowEventSeverity, WorkflowEventStatus, WorkflowExceptionRecord } from "../../../contracts/governance/workflow.js";
import type { SqliteDatabase } from "./persistence/sqlite-database.js";

const STALE_AFTER_MS = 120_000;
const TERMINAL_TASK_STATES = new Set(["integrated", "cancelled"]);

/** 把现有协同控制面投影到统一 SQLite；JSON 继续负责恢复对象图，数据库负责跨角色查询、异常和审计。 */
export class WorkflowRepository {
  readonly #database: SqliteDatabase;
  readonly #sessionId = `runtime-session-${randomUUID()}`;
  #evolutionWorkbenchStateVersion = "";

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

  /**
   * 使用 SQLite 事件事实同时承担专题互斥锁和幂等日志；应用异常退出时，既有运行会话恢复会把 processing 还原为 open。
   * 返回 completed 表示同一幂等键已经成功，调用方只返回当前事实，不得再次产生分发副作用。
   */
  beginEvolutionMutation(topicId: string, action: string, request: { expectedStateVersion: string; idempotencyKey: string }, currentStateVersion: string, now = new Date().toISOString()): "started" | "completed" {
    const normalizedTopicId = requiredMutationValue(topicId, "专题", 200);
    const normalizedAction = requiredMutationValue(action, "动作", 80);
    const idempotencyKey = requiredMutationValue(request.idempotencyKey, "幂等键", 200);
    const expectedStateVersion = requiredMutationValue(request.expectedStateVersion, "状态版本", 80);
    const fingerprint = `evolution-mutation:${idempotencyKey}`;
    return this.#database.transaction((connection) => {
      const existing = connection.prepare("SELECT status FROM AiDesktopEvent WHERE fingerprint = $fingerprint").get({ $fingerprint: fingerprint }) as { status: string } | undefined;
      if (existing?.status === "resolved") return "completed";
      if (existing?.status === "processing") throw new Error("当前操作正在处理中，请勿重复提交。");
      if (expectedStateVersion !== currentStateVersion) throw new Error("状态已更新，请重新确认后再执行。");
      const active = connection.prepare(`SELECT eventId FROM AiDesktopEvent
        WHERE eventType = 'evolution.mutation' AND status = 'processing'
          AND json_extract(payloadJson, '$.topicId') = $topicId AND fingerprint <> $fingerprint
        LIMIT 1`).get({ $topicId: normalizedTopicId, $fingerprint: fingerprint });
      if (active) throw new Error("当前专题正在执行其他推进或恢复操作，请等待完成后重试。");
      const payloadJson = JSON.stringify({ topicId: normalizedTopicId, action: normalizedAction, expectedStateVersion });
      if (existing) {
        connection.prepare(`UPDATE AiDesktopEvent SET status='processing', message=$message, payloadJson=$payloadJson,
          occurredAt=$now, recordedAt=$now, resolvedAt=NULL, resolutionSummary=NULL, handlingOwnerId='evolution-workbench', handlingStartedAt=$now
          WHERE fingerprint=$fingerprint`).run({ $message: `专题正在执行：${normalizedAction}`, $payloadJson: payloadJson, $now: now, $fingerprint: fingerprint });
      } else {
        connection.prepare(`INSERT INTO AiDesktopEvent
          (eventId, correlationId, sourceType, sourceId, eventType, category, severity, status, message, payloadJson, fingerprint,
           occurredAt, recordedAt, resolvedAt, handlingOwnerId, handlingStartedAt, resolutionSummary)
          VALUES ($eventId, $topicId, 'system', 'evolution-workbench', 'evolution.mutation', 'execution', 'info', 'processing',
           $message, $payloadJson, $fingerprint, $now, $now, NULL, 'evolution-workbench', $now, NULL)`)
          .run({ $eventId: `evolution-mutation-${randomUUID()}`, $topicId: normalizedTopicId, $message: `专题正在执行：${normalizedAction}`, $payloadJson: payloadJson, $fingerprint: fingerprint, $now: now });
      }
      return "started";
    });
  }

  completeEvolutionMutation(idempotencyKey: string, resultStateVersion: string, now = new Date().toISOString()): void {
    const fingerprint = `evolution-mutation:${requiredMutationValue(idempotencyKey, "幂等键", 200)}`;
    this.#database.withConnection((connection) => connection.prepare(`UPDATE AiDesktopEvent
      SET status='resolved', resolvedAt=$now, resolutionSummary=$resultStateVersion, handlingOwnerId=NULL, handlingStartedAt=NULL
      WHERE fingerprint=$fingerprint AND status='processing'`).run({ $now: now, $resultStateVersion: resultStateVersion, $fingerprint: fingerprint }));
  }

  failEvolutionMutation(idempotencyKey: string, error: unknown, now = new Date().toISOString()): void {
    const fingerprint = `evolution-mutation:${requiredMutationValue(idempotencyKey, "幂等键", 200)}`;
    const summary = (error instanceof Error ? error.message : String(error)).slice(0, 2_000);
    this.#database.withConnection((connection) => connection.prepare(`UPDATE AiDesktopEvent
      SET status='open', resolvedAt=NULL, resolutionSummary=$summary, handlingOwnerId=NULL, handlingStartedAt=NULL, recordedAt=$now
      WHERE fingerprint=$fingerprint AND status='processing'`).run({ $summary: summary, $now: now, $fingerprint: fingerprint }));
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
    if (correlationId && !["technical-error", "business-exception", "stalled"].includes(classified.category) && provesFailureResolved(type, details)) {
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

  /**
   * 工作台列表只查询 SQLite 当前事实投影，并在数据库完成筛选、排序和分页。
   * 例如查询 topics 第 2 页、每页 20 条时最多返回 20 行及独立 total；不读取 JSON 状态文件，也不返回原始 payload。
   */
  queryEvolutionWorkbench(request: QueryEvolutionWorkbenchRequest): EvolutionWorkbenchPage {
    const pageSize = Math.max(10, Math.min(100, Math.floor(Number(request.pageSize) || 20)));
    const page = Math.max(1, Math.floor(Number(request.page) || 1));
    const keyword = String(request.keyword || "").trim().slice(0, 120);
    const status = workbenchStatusFilter(String(request.status || "").trim().slice(0, 80));
    const source = evolutionWorkbenchSource(request.view);
    const sortColumn = ({ createdAt: "createdAt", title: "title", status: "status", updatedAt: "updatedAt" } as const)[request.sortField || "updatedAt"];
    const sortDirection = request.sortDirection === "asc" ? "ASC" : "DESC";
    return this.#database.withConnection((connection) => {
      const where = "WHERE ($keyword = '' OR title LIKE $like OR stage LIKE $like OR owner LIKE $like) AND ($status = '' OR status = $status)";
      const bindings = { $keyword: keyword, $like: `%${keyword}%`, $status: status };
      const totalRow = connection.prepare(`SELECT COUNT(*) AS total, COALESCE(MAX(updatedAt), '') AS latestVisibleUpdate FROM (${source}) workbench ${where}`).get(bindings) as { total: number | bigint; latestVisibleUpdate: string };
      const rows = connection.prepare(`
        SELECT id, topicId, proposalId, taskId, title, status, stage, owner, blockedReason, recoveryPoint, nextStep, createdAt, updatedAt
        FROM (${source}) workbench
        ${where}
        ORDER BY ${sortColumn} ${sortDirection}, id ASC
        LIMIT $limit OFFSET $offset
      `).all({ ...bindings, $limit: pageSize, $offset: (page - 1) * pageSize }) as Array<Record<string, unknown>>;
      return {
        view: request.view,
        page,
        pageSize,
        total: Number(totalRow.total),
        stateVersion: this.#evolutionWorkbenchStateVersion || String(totalRow.latestVisibleUpdate),
        rows: rows.map((row): EvolutionWorkbenchRow => ({
          id: String(row.id), topicId: nullableString(row.topicId), proposalId: nullableString(row.proposalId), taskId: nullableString(row.taskId),
          title: String(row.title), status: String(row.status), stage: String(row.stage), owner: workbenchOwnerLabel(String(row.owner)),
          blockedReason: nullableString(row.blockedReason), recoveryPoint: nullableString(row.recoveryPoint), nextStep: String(row.nextStep), updatedAt: String(row.updatedAt),
        })),
        generatedAt: new Date().toISOString(),
      };
    });
  }

  getEvolutionWorkbenchPreference(perspective: "nangong" | "hanli", nodeId: string): EvolutionWorkbenchPreference | null {
    return this.#database.withConnection((connection) => {
      const row = connection.prepare(`SELECT perspective, nodeId, page, pageSize, keyword, status, selectedRowId, updatedAt
        FROM AiDesktopEvolutionWorkbenchPreference WHERE perspective=$perspective AND nodeId=$nodeId`).get({ $perspective: perspective, $nodeId: nodeId }) as Record<string, unknown> | undefined;
      return row ? { perspective: row.perspective as "nangong" | "hanli", nodeId: String(row.nodeId), page: Number(row.page), pageSize: Number(row.pageSize), keyword: String(row.keyword), status: String(row.status), selectedRowId: nullableString(row.selectedRowId), updatedAt: String(row.updatedAt) } : null;
    });
  }

  saveEvolutionWorkbenchPreference(request: SaveEvolutionWorkbenchPreferenceRequest, now = new Date().toISOString()): EvolutionWorkbenchPreference {
    const value: EvolutionWorkbenchPreference = { ...request, page: Math.max(1, Math.floor(request.page)), pageSize: [20, 50, 100].includes(request.pageSize) ? request.pageSize : 20, keyword: request.keyword.slice(0, 120), status: request.status.slice(0, 80), selectedRowId: request.selectedRowId?.slice(0, 200) || null, updatedAt: now };
    this.#database.withConnection((connection) => connection.prepare(`INSERT INTO AiDesktopEvolutionWorkbenchPreference
      (perspective, nodeId, page, pageSize, keyword, status, selectedRowId, updatedAt)
      VALUES ($perspective, $nodeId, $page, $pageSize, $keyword, $status, $selectedRowId, $updatedAt)
      ON CONFLICT(perspective, nodeId) DO UPDATE SET page=excluded.page, pageSize=excluded.pageSize, keyword=excluded.keyword,
        status=excluded.status, selectedRowId=excluded.selectedRowId, updatedAt=excluded.updatedAt`).run({ $perspective: value.perspective, $nodeId: value.nodeId, $page: value.page, $pageSize: value.pageSize, $keyword: value.keyword, $status: value.status, $selectedRowId: value.selectedRowId, $updatedAt: value.updatedAt }));
    return value;
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
      const insertHanLiTopic = connection.prepare(`
        INSERT INTO AiDesktopTrainingCorpusTopic
          (corpusTopicId, source, sourceConversationId, sourceTurnId, title, topicType, inferredIntent,
           tagsJson, definitionSource, createdAt, updatedAt)
        VALUES ($topicId, 'hanli', $conversationId, $turnId, '待 AI 归类', '待归类', NULL,
          '[]', 'pending', $createdAt, $updatedAt)
        ON CONFLICT(corpusTopicId) DO NOTHING
      `);
      const insertHanLiMessage = connection.prepare(`
        INSERT INTO AiDesktopTrainingCorpusMessage
          (corpusMessageId, corpusTopicId, source, sourceConversationId, sourceTurnId, sourceMessageId,
           sequenceNumber, speakerRole, content, contentRetention, evidenceTier, createdAt, recordedAt)
        VALUES ($corpusMessageId, $topicId, 'hanli', $conversationId, $turnId, $messageId,
          $sequenceNumber, 'hanli', $content, 'preview-300', 'low', $createdAt, $recordedAt)
        ON CONFLICT(corpusMessageId) DO NOTHING
      `);
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
        for (const round of deliberation.rounds) {
          if (!round.question || Array.from(round.question).length > 300) continue;
          const topicId = `corpus-topic:hanli:${round.roundId}`;
          insertHanLiTopic.run({
            $topicId: topicId, $conversationId: deliberation.deliberationId, $turnId: round.roundId,
            $createdAt: round.createdAt, $updatedAt: deliberation.updatedAt,
          });
          insertHanLiMessage.run({
            $corpusMessageId: `corpus:hanli:${round.roundId}:question`, $topicId: topicId,
            $conversationId: deliberation.deliberationId, $turnId: round.roundId,
            $messageId: `${round.roundId}:question`, $sequenceNumber: (round.roundNumber - 1) * 2,
            $content: round.question, $createdAt: round.createdAt, $recordedAt: new Date().toISOString(),
          });
        }
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
    // 查询版本代表整个演化读模型，不随当前筛选结果变化，供增量事件准确识别漏报和乱序。
    this.#evolutionWorkbenchStateVersion = state.updatedAt;
  }

  getEvolutionTopicDossier(topicId: string, state: NangongEvolutionState): EvolutionTopicDossier {
    const topic = state.topics.find((item) => item.topicId === topicId);
    if (!topic) throw new Error("专题池中不存在该专题。 ");
    const stateDeliberation = topic.deliberationId ? state.deliberations.find((item) => item.deliberationId === topic.deliberationId) || null : null;
    const proposals = state.proposals.filter((item) => item.topicId === topicId);
    const proposalIds = new Set(proposals.map((item) => item.proposalId));
    const { deliberation, archiveRecords, executionRecords } = this.#database.withConnection((connection) => {
      const storedDeliberationRow = stateDeliberation ? connection.prepare(`
        SELECT deliberationId, topicId, status, candidateJson, createdAt, updatedAt
        FROM AiDesktopEvolutionDeliberation WHERE deliberationId = $deliberationId
      `).get({ $deliberationId: stateDeliberation.deliberationId }) as Record<string, unknown> | undefined : undefined;
      const storedSourceSnapshots = stateDeliberation ? connection.prepare(`
        SELECT snapshotId, deliberationId, source, conversationId, sourceMessageId, sequenceNumber,
          role, responsePhase, content, originalCreatedAt, capturedAt
        FROM AiDesktopEvolutionSourceSnapshot WHERE deliberationId = $deliberationId
        ORDER BY sequenceNumber, originalCreatedAt, snapshotId
      `).all({ $deliberationId: stateDeliberation.deliberationId }) as Array<Record<string, unknown>> : [];
      const storedDeliberation = stateDeliberation && storedDeliberationRow ? {
        ...stateDeliberation,
        topicId: storedDeliberationRow.topicId ? String(storedDeliberationRow.topicId) : null,
        status: String(storedDeliberationRow.status) as typeof stateDeliberation.status,
        candidate: storedDeliberationRow.candidateJson ? parseObject(String(storedDeliberationRow.candidateJson)) as unknown as typeof stateDeliberation.candidate : null,
        sourceSnapshots: storedSourceSnapshots.map((row) => ({
          snapshotId: String(row.snapshotId), deliberationId: String(row.deliberationId), source: row.source as "nangong" | "codex",
          conversationId: String(row.conversationId), sourceMessageId: String(row.sourceMessageId), sequenceNumber: Number(row.sequenceNumber),
          role: String(row.role), responsePhase: row.responsePhase ? String(row.responsePhase) : null, content: String(row.content),
          originalCreatedAt: String(row.originalCreatedAt), capturedAt: String(row.capturedAt),
        })),
        createdAt: String(storedDeliberationRow.createdAt), updatedAt: String(storedDeliberationRow.updatedAt),
      } : null;
      // 专题执行群与原始档案只读取已经同步到 SQLite 的追加式事实，避免页面重新依赖内存状态或文件展示。
      const storedArchiveRecords = connection.prepare(`
        SELECT recordId, deliberationId, topicId, proposalId, taskId, sequenceNumber,
          category, eventType, actor, title, originalPayloadJson, occurredAt
        FROM AiDesktopEvolutionArchiveRecord
        WHERE topicId = $topicId
          OR ($deliberationId IS NOT NULL AND deliberationId = $deliberationId)
        ORDER BY occurredAt, sequenceNumber, recordId
      `).all({ $topicId: topicId, $deliberationId: storedDeliberation?.deliberationId || null }).map((row: Record<string, unknown>): EvolutionArchiveRecord => ({
        recordId: String(row.recordId), deliberationId: row.deliberationId ? String(row.deliberationId) : null,
        topicId: row.topicId ? String(row.topicId) : null, proposalId: row.proposalId ? String(row.proposalId) : null,
        taskId: row.taskId ? String(row.taskId) : null, sequenceNumber: Number(row.sequenceNumber),
        category: row.category as EvolutionArchiveRecord["category"], eventType: String(row.eventType),
        actor: row.actor as EvolutionArchiveRecord["actor"], title: String(row.title),
        payload: parseObject(String(row.originalPayloadJson)), occurredAt: String(row.occurredAt),
      }));
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
        recordId: `task-snapshot:${String(task.taskId)}`, deliberationId: storedDeliberation?.deliberationId || null, topicId,
        proposalId: String(task.proposalId), taskId: String(task.taskId), sequenceNumber: storedArchiveRecords.length + index + 1,
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
        recordId: String(row.eventId), deliberationId: storedDeliberation?.deliberationId || null, topicId,
        proposalId: String(row.proposalId), taskId: String(row.correlationId), sequenceNumber: storedArchiveRecords.length + taskRecords.length + index + 1,
        category: dossierEventCategory(String(row.eventType), String(row.category)), eventType: String(row.eventType),
        actor: dossierEventActor(String(row.sourceId)), title: String(row.message), payload: parseObject(String(row.payloadJson)), occurredAt: String(row.occurredAt),
      }));
      return { deliberation: storedDeliberation, archiveRecords: storedArchiveRecords, executionRecords: [...taskRecords, ...eventRecords] };
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

  /** 在单个事务内清空 AI Desktop 测试运行投影并保留迁移版本与人物训练语料。示例：共有 12 条运行记录时返回 12；任一删除失败会整体回滚。 */
  clearTestData(): number {
    return this.#database.transaction((connection) => {
      // 固定白名单只包含可重建运行投影；SchemaVersion、人物原文、主题、归档消息与入库检查点永远不进入清理范围。
      const tables = [
        "AiDesktopTaskTimelineStream", "AiDesktopTaskTimelineEvent", "AiDesktopTaskTimelineTopic",
        "AiDesktopTaskCollaborationStream", "AiDesktopTaskCollaborationEvent", "AiDesktopTaskCollaborationTopic",
        "AiDesktopEvolutionRoundTask", "AiDesktopEvolutionRound", "AiDesktopEvolutionSourceSnapshot", "AiDesktopEvolutionArchiveRecord",
        "AiDesktopApprovalGovernance", "AiDesktopApprovalRecord", "AiDesktopTaskExecution", "AiDesktopWorkflowRun",
        "AiDesktopMemberRuntime", "AiDesktopEvent", "AiDesktopRuntimeSession", "AiDesktopEvolutionDeliberation",
      ] as const;
      let clearedRecordCount = 0;
      for (const table of tables) clearedRecordCount += Number(connection.prepare(`DELETE FROM ${table}`).run().changes);
      for (const table of tables) {
        const remaining = Number((connection.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number | bigint }).count);
        if (remaining !== 0) throw new Error(`测试数据清空后仍检测到 ${table} 运行记录。`);
      }
      return clearedRecordCount;
    });
  }

  tableCount(table: "AiDesktopEvent" | "AiDesktopWorkflowRun" | "AiDesktopTaskExecution" | "AiDesktopApprovalRecord" | "AiDesktopApprovalGovernance" | "AiDesktopMemberRuntime" | "AiDesktopRuntimeSession" | "AiDesktopConversationMemory" | "AiDesktopConversationTopic" | "AiDesktopConversationTopicLink" | "AiDesktopTrainingCorpusTopic" | "AiDesktopTrainingCorpusMessage" | "AiDesktopCorpusIngestionCheckpoint" | "AiDesktopEvolutionDeliberation" | "AiDesktopEvolutionSourceSnapshot" | "AiDesktopEvolutionArchiveRecord" | "AiDesktopEvolutionRound" | "AiDesktopEvolutionRoundTask" | "AiDesktopEvolutionWorkbenchPreference" | "AiDesktopTaskTimelineTopic" | "AiDesktopTaskTimelineEvent" | "AiDesktopTaskTimelineStream"): number {
    return this.#database.withConnection((connection) => Number((connection.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number | bigint }).count));
  }

  #insertEvent(connection: DatabaseSync, input: WorkflowEventInput): string {
    const occurredAt = input.occurredAt || new Date().toISOString();
    const eventId = input.eventId || `workflow-event-${randomUUID()}`;
    const category = input.category || "audit";
    const severity = input.severity || defaultSeverity(category);
    const status = input.status || defaultStatus(category);
    if (input.fingerprint) {
      const existing = connection.prepare("SELECT eventId, status FROM AiDesktopEvent WHERE fingerprint = $fingerprint").get({ $fingerprint: input.fingerprint }) as { eventId: string; status: WorkflowEventStatus } | undefined;
      if (existing) {
        const reopenedStatus = existing.status === "processing" && status === "open" ? "processing" : status;
        connection.prepare(`UPDATE AiDesktopEvent SET correlationId=$correlationId, sourceType=$sourceType, sourceId=$sourceId,
          eventType=$eventType, category=$category, severity=$severity, status=$status, message=$message, payloadJson=$payloadJson,
          occurredAt=$occurredAt, recordedAt=$recordedAt,
          resolvedAt=CASE WHEN $status='resolved' THEN $occurredAt ELSE NULL END,
          resolutionSummary=CASE WHEN $status='resolved' THEN resolutionSummary ELSE NULL END,
          handlingOwnerId=CASE WHEN $status='processing' THEN handlingOwnerId ELSE NULL END,
          handlingStartedAt=CASE WHEN $status='processing' THEN handlingStartedAt ELSE NULL END
          WHERE eventId=$eventId`).run({
          $eventId: existing.eventId, $correlationId: input.correlationId || null, $sourceType: input.sourceType || "system",
          $sourceId: input.sourceId || "ai-desktop", $eventType: input.eventType, $category: category,
          $severity: severity, $status: reopenedStatus, $message: input.message || input.eventType,
          $payloadJson: JSON.stringify(input.payload || {}), $occurredAt: occurredAt, $recordedAt: new Date().toISOString(),
        });
        return existing.eventId;
      }
    }
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
      $owner: task.currentHandler?.memberId || task.executorMemberId || task.initiator?.memberId || "collaboration-coordinator",
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
      category: event.error ? "technical-error" : event.stage === "execution" || event.stage === "integration" ? "execution" : "state-change",
      severity: event.error ? "error" : "info", status: event.error ? "open" : "observed", message: event.summary,
      payload: { stage: event.stage, status: event.status, actor: event.actor }, occurredAt: event.occurredAt,
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

/** 各叶节点只选择既有数据库事实并规范成同一读模型，避免 Renderer 自行拼业务含义。 */
function evolutionWorkbenchSource(view: EvolutionWorkbenchView): string {
  const workflow = `
    SELECT workflowId AS id, topicId, proposalId, NULL AS taskId, title, state AS status,
      currentStage AS stage, currentOwnerId AS owner, CASE WHEN state = 'blocked' THEN '流程已阻塞' ELSE NULL END AS blockedReason,
      recoveryPoint, CASE
        WHEN state = 'pending-approval' THEN '等待韩立审批'
        WHEN state = 'approved' THEN '返还南宫婉并分发'
        WHEN state IN ('executing', 'verifying') THEN '查看执行进度'
        WHEN state = 'blocked' THEN '从恢复点继续或交给令狐修复'
        WHEN state = 'completed' THEN '查看验收档案'
        ELSE '继续调查并形成提案' END AS nextStep,
      startedAt AS createdAt, updatedAt
    FROM AiDesktopWorkflowRun
    WHERE origin IN ('nangong', 'linghu')`;
  switch (view) {
    case "topics": return `${workflow} AND topicId IS NOT NULL
      AND workflowId = (SELECT latest.workflowId FROM AiDesktopWorkflowRun latest WHERE latest.topicId = AiDesktopWorkflowRun.topicId ORDER BY latest.updatedAt DESC, latest.workflowId DESC LIMIT 1)`;
    case "proposals": return `${workflow} AND proposalId IS NOT NULL`;
    case "pending-approvals": return `${workflow} AND proposalId IS NOT NULL AND state IN ('pending-approval', 'supplement-required', 'approved', 'pending-acceptance')`;
    case "automation-runs": return workflow;
    case "deliberations": return `
      SELECT deliberationId AS id, topicId, NULL AS proposalId, NULL AS taskId,
        COALESCE(json_extract(candidateJson, '$.title'), '待形成专题') AS title, status,
        '调查与研讨' AS stage, 'han-li' AS owner,
        CASE WHEN status = 'blocked' THEN '研讨已阻塞' ELSE NULL END AS blockedReason,
        deliberationId AS recoveryPoint,
        CASE WHEN status = 'questioning' THEN '推进下一轮研讨' WHEN status = 'ready-to-establish' THEN '确立专题' WHEN status = 'blocked' THEN '检查证据后恢复' ELSE '查看专题' END AS nextStep,
        createdAt, updatedAt
      FROM AiDesktopEvolutionDeliberation`;
    case "approvals": return `
      SELECT approval.approvalId AS id, workflow.topicId, approval.proposalId, NULL AS taskId,
        approval.title, approval.decision AS status, approval.approvalStage AS stage,
        approval.approverDisplayName AS owner, NULL AS blockedReason, workflow.recoveryPoint,
        CASE WHEN approval.decision = 'supplement-required' THEN '按审批意见补充后重新提交' WHEN approval.approvalStage = 'result' THEN '查看验收结果' ELSE '查看提案与审批意见' END AS nextStep,
        approval.createdAt, approval.approvedAt AS updatedAt
      FROM AiDesktopApprovalRecord approval
      LEFT JOIN AiDesktopWorkflowRun workflow ON workflow.proposalId = approval.proposalId`;
    case "tasks": return evolutionTaskWorkbenchSource("1 = 1");
    case "releases": return evolutionTaskWorkbenchSource("task.acceptanceState <> 'pending' OR task.state IN ('unified-testing', 'awaiting-restart', 'integrated')");
    case "recovery": return evolutionTaskWorkbenchSource("task.runtimeStatus IN ('stalled', 'recovering', 'failed') OR task.blockingKind <> 'none'");
    case "archives": return `
      SELECT recordId AS id, topicId, proposalId, taskId, title, eventType AS status, category AS stage,
        actor AS owner, NULL AS blockedReason, NULL AS recoveryPoint, '查看专题完整档案' AS nextStep,
        occurredAt AS createdAt, occurredAt AS updatedAt
      FROM AiDesktopEvolutionArchiveRecord`;
    case "exceptions": return `
      SELECT eventId AS id, workflow.topicId, task.proposalId, event.correlationId AS taskId,
        event.message AS title, event.status, event.category AS stage, COALESCE(event.handlingOwnerId, '待领取') AS owner,
        event.message AS blockedReason, COALESCE(task.recoveryPoint, workflow.recoveryPoint) AS recoveryPoint,
        CASE WHEN event.status = 'processing' THEN '查看令狐修复进度' ELSE '交给令狐修复或人工处理' END AS nextStep,
        event.occurredAt AS createdAt, event.occurredAt AS updatedAt
      FROM AiDesktopEvent event
      LEFT JOIN AiDesktopTaskExecution task ON task.taskId = event.correlationId
      LEFT JOIN AiDesktopWorkflowRun workflow ON workflow.workflowId = task.workflowId
      WHERE event.category IN ('technical-error', 'business-exception', 'stalled')`;
  }
  throw new Error("工作台查询类型无效。");
}

function evolutionTaskWorkbenchSource(condition: string): string {
  return `
    SELECT task.taskId AS id, workflow.topicId, task.proposalId, task.taskId,
      task.title, task.state AS status, COALESCE(task.phase, task.runtimeStatus) AS stage,
      COALESCE(task.executorMemberId, '待分配') AS owner, task.blockingReason AS blockedReason,
      COALESCE(task.recoveryPoint, workflow.recoveryPoint) AS recoveryPoint,
      CASE
        WHEN task.runtimeStatus IN ('stalled', 'failed') THEN '交给令狐修复或从恢复点继续'
        WHEN task.runtimeStatus = 'recovering' THEN '查看修复进度'
        WHEN task.acceptanceState = 'failed' THEN '修正后重新统一测试'
        WHEN task.acceptanceState = 'passed' THEN '查看验收档案'
        ELSE '查看实时执行状态' END AS nextStep,
      task.startedAt AS createdAt, task.updatedAt
    FROM AiDesktopTaskExecution task
    LEFT JOIN AiDesktopWorkflowRun workflow ON workflow.workflowId = task.workflowId
    WHERE task.proposalId IS NOT NULL AND (${condition})`;
}

function workbenchOwnerLabel(owner: string): string {
  return ({ "han-li": "韩立", "nangong-wan": "南宫婉", "linghu-ancestor": "令狐老祖", "collaboration-coordinator": "协同调度", system: "系统", user: "用户" } as Record<string, string>)[owner] || owner;
}

/** 用户可直接输入页面看到的中文状态；未知值仍按机器状态精确查询，避免关键词猜测业务状态。 */
function workbenchStatusFilter(status: string): string {
  return ({
    "未开始": "registered", "调查中": "investigating", "待审批": "pending-approval", "待补充": "supplement-required",
    "已退回": "rejected", "已批准": "approved", "执行中": "executing", "验证中": "verifying",
    "待验收": "pending-acceptance", "已完成": "completed", "已阻塞": "blocked", "失败": "failed",
  } as Record<string, string>)[status] || status;
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

/** 只有明确完成、恢复或通过的事实才能关闭异常；普通状态刷新和“已受理”不构成恢复证据。 */
function provesFailureResolved(type: string, details: Record<string, unknown>): boolean {
  if (details.resolvesFailure === true) return true;
  return /(?:^|[._-])(completed|recovered|revised|passed|integrated|fixed|resolved)(?:$|[._-])/u.test(type);
}

function defaultSeverity(category: WorkflowEventCategory): WorkflowEventSeverity { return category === "technical-error" || category === "stalled" ? "error" : category === "business-exception" ? "warning" : "info"; }
function defaultStatus(category: WorkflowEventCategory): WorkflowEventStatus { return ["technical-error", "business-exception", "stalled"].includes(category) ? "open" : "observed"; }
function requiredMutationValue(value: unknown, label: string, maximum: number): string { const text = typeof value === "string" ? value.trim() : ""; if (!text) throw new Error(`${label}不能为空。`); return text.slice(0, maximum); }
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
  if (state === "test-failed" || state === "blocked") return "failed";
  if (state === "recovering" || state.startsWith("repairing-")) return "recovering";
  if (state.startsWith("queued-") || state === "returned-to-nangong" || state === "ready-for-integration") return "waiting";
  if (state === "preparing-worktree") return "queued";
  return "running";
}
function taskBlockingKind(task: CollaborationTask): string {
  const reason = task.blockingReason || "";
  // 先使用任务状态和结构化失败类型，避免测试日志引用规则正文时被“用户/人工”等词污染分类。
  if (task.state === "test-failed" || task.integrationFailure?.kind === "verification") return "test";
  if (task.integrationFailure?.kind === "merge-conflict") return "code";
  if (task.integrationFailure?.kind === "local-change-ownership") return "infrastructure";
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
