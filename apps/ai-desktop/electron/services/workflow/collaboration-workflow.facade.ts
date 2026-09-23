import { createHash, randomUUID } from "node:crypto";

import type {
  CollaborationCustomerActionGuidanceEvidence,
  CollaborationMemberOutDto,
  CollaborationParticipantSnapshotOutDto,
  CollaborationFlowEventDetailsOutDto,
  CollaborationCustomerActionGuidanceOutDto,
  CollaborationRepairDiagnosisOutDto,
  CollaborationRequirementPlanOutDto,
  CollaborationStateOutDto,
  CollaborationTaskOutDto,
  CollaborationWorkerPhaseValue,
  DesktopOperatingModeValue,
  SubmitCollaborationTaskInDto,
  SubmitCollaborationTaskOutDto,
} from "../../../contracts/services/workflow/index.js";
import { isCompleteCustomerActionGuidance } from "../../../contracts/services/workflow/index.js";
import type { CodexStreamEventOutDto } from "../../../contracts/services/support/platform/codex/index.js";
import type { ExecutorSessionPort } from "../../../contracts/services/personas/executor/index.js";
import { CollaborationDurationLog } from "./internal/collaboration/collaboration-duration.log.js";
import { CollaborationStore } from "./internal/collaboration/collaboration.store.js";
import type {
  VersionIntegrationPort as VersionIntegrationPipeline,
  VersionWorkspacePort as VersionWorkspaceManager,
} from "../support/capabilities/release/index.js";
import { createCollaborationResultSummary } from "./internal/result/result-summary.js";
import type { ExecutorFacade } from "../personas/executor/index.js";
import type { ExecutorFailureRoutingOutDto } from "../../../contracts/services/personas/executor/index.js";

const LINGHU_MEMBER_ID = "linghu-ancestor";
const ORCHESTRATOR_MEMBER_IDS = new Set(["nangong-wan", LINGHU_MEMBER_ID]);
type CollaborationStateListener = (state: CollaborationStateOutDto, reason: string, taskIds: string[]) => void;
type TaskOperationGuard = (task: CollaborationTaskOutDto, state: CollaborationStateOutDto) => { allowed: boolean; message: string };
type ProposalOperationGuard = (proposalId: string, state: CollaborationStateOutDto) => { allowed: boolean; message: string };

export interface CollaborationCoordinatorOptions {
  store: CollaborationStore;
  durations: CollaborationDurationLog;
  workspaces: VersionWorkspaceManager;
  executor: ExecutorFacade;
  integrationPipeline: VersionIntegrationPipeline;
  emitState(state: CollaborationStateOutDto, reason: string, taskIds: string[]): void;
  emitStream(taskId: string, memberId: string, event: CodexStreamEventOutDto): void;
  createTaskRuleContext?(taskRuleIds: string[]): NonNullable<CollaborationTaskOutDto["snapshot"]["ruleContext"]>;
}

export interface ActiveRepairScopeRevisionResult {
  updated: boolean;
  taskId: string | null;
  taskRevision: number | null;
  message: string;
}

/** 编排执行人的技术分析、实施、令狐验证和集成，业务方向审批由韩立专题线路负责。 */
export class CollaborationCoordinator {
  readonly #store: CollaborationStore;
  readonly #durations: CollaborationDurationLog;
  readonly #workspaces: VersionWorkspaceManager;
  readonly #executor: ExecutorFacade;
  readonly #integrationPipeline: VersionIntegrationPipeline;
  readonly #emitStream: CollaborationCoordinatorOptions["emitStream"];
  readonly #createTaskRuleContext: CollaborationCoordinatorOptions["createTaskRuleContext"];
  readonly #activeTaskRuns = new Set<string>();
  readonly #technicalRepairRuns = new Map<string, Promise<boolean>>();
  readonly #mergeConflictCorrectionRuns = new Set<string>();
  readonly #waitSpans = new Map<string, string>();
  readonly #heartbeatTimers = new Map<string, ReturnType<typeof setInterval>>();
  readonly #lastProgressWriteMs = new Map<string, number>();
  readonly #unsubscribeStore: () => void;
  #taskOperationGuard: TaskOperationGuard | null = null;
  #proposalOperationGuard: ProposalOperationGuard | null = null;
  #disposed = false;

  constructor(options: CollaborationCoordinatorOptions) {
    this.#store = options.store;
    this.#durations = options.durations;
    this.#workspaces = options.workspaces;
    this.#executor = options.executor;
    this.#integrationPipeline = options.integrationPipeline;
    this.#emitStream = options.emitStream;
    this.#createTaskRuleContext = options.createTaskRuleContext;
    this.#unsubscribeStore = this.#store.subscribe((state, reason, taskIds) => {
      options.emitState(state, reason, taskIds);
      // 在途任务的统一测试失败属于协作主流程安全兜底，不依赖令狐“主动巡检”总开关。
      this.#scheduleUnifiedTestRepairs(state);
      this.#scheduleMergeConflictCorrections(state);
      this.#scheduleExecutionRepairs(state);
    });
    this.#scheduleUnifiedTestRepairs(this.#store.state());
    this.#scheduleMergeConflictCorrections(this.#store.state());
  }

  state(): CollaborationStateOutDto { return this.#store.state(); }
  /** 组合根注入当前专题判定，协调器据此阻止已取消关联进入恢复或调度。 */
  setTaskOperationGuard(guard: TaskOperationGuard, proposalGuard?: ProposalOperationGuard): void {
    this.#taskOperationGuard = guard;
    this.#proposalOperationGuard = proposalGuard || null;
  }
  /** 订阅协作事实提交；交付投影使用它刷新只读结论，不能反向写入协作状态。 */
  subscribe(listener: CollaborationStateListener): () => void { return this.#store.subscribe(listener); }
  setMode(mode: DesktopOperatingModeValue): CollaborationStateOutDto { return this.#store.setMode(mode); }

  /**
   * 监控者交付正式版本后，以一次受控调用封存旧修复任务并退役其工作树。
   * 只有工作树无未提交证据时才执行；任一步失败都不写入“已封存”事实。
   */
  async archiveMonitorTakeover(proposalId: string, takeoverSha: string | null, reason: string): Promise<string | null> {
    const task = [...this.state().tasks].reverse().find((candidate) =>
      candidate.evolutionProposalId === proposalId
      && !["integrated", "cancelled"].includes(candidate.state));
    if (!task) return null;
    return this.#archiveRetiredTask(task, takeoverSha, reason);
  }

  /** 旧卡兜底退役覆盖该专题的任意非终态执行，不把普通人物任务遗留在历史活动链。 */
  async archiveStaleTopicTask(proposalId: string, reason: string): Promise<string | null> {
    const task = [...this.state().tasks].reverse().find((candidate) =>
      candidate.evolutionProposalId === proposalId
      && !["integrated", "cancelled"].includes(candidate.state));
    if (!task) return null;
    return this.#archiveRetiredTask(task, null, reason);
  }

  /** 完成外部执行与工作树退役后，统一写入任务取消和人物释放事实。 */
  async #archiveRetiredTask(task: CollaborationTaskOutDto, takeoverSha: string | null, reason: string): Promise<string> {
    const changedFiles = task.versionWorkspace ? await this.#workspaces.readTaskUncommittedFiles(task) : [];
    if (changedFiles.length) throw new Error(`旧任务工作树仍有未提交证据，禁止封存：${changedFiles.join("、")}`);
    await this.#executor.close(task.taskId);
    if (task.versionWorkspace && !task.versionWorkspace.retiredAt) await this.#workspaces.retireWorkspace(task.versionWorkspace);
    this.#stopHeartbeat(`executor:${task.taskId}`);
    this.#lastProgressWriteMs.delete(`${task.taskId}:${task.executorMemberId || ""}`);
    this.#activeTaskRuns.delete(task.taskId);
    this.#store.updateTask(task.taskId, "task.monitor_takeover_archived", (current, state) => {
      const now = new Date().toISOString();
      current.state = "cancelled";
      current.phase = null;
      current.assignmentId = null;
      current.executorMemberId = null;
      current.recoveryTargetState = null;
      current.blockingReason = reason.slice(0, 2_000);
      current.customerActionGuidance = null;
      if (current.versionWorkspace) current.versionWorkspace.retiredAt = now;
      for (const member of state.members.filter((candidate) => candidate.currentTaskId === current.taskId)) {
        member.state = "idle";
        member.role = null;
        member.phase = null;
        member.currentTaskId = null;
        member.blockingReason = null;
        member.updatedAt = now;
      }
      current.flowEvents.push({
        eventId: randomUUID(),
        type: "task.cancelled",
        stage: "task",
        status: "cancelled",
        actor: null,
        summary: `旧任务已由监控者接管并封存；正式版本${takeoverSha ? `提交 ${takeoverSha.slice(0, 12)}` : "发布包"}已生效，旧工作树已退役。`,
        occurredAt: now,
        error: false,
      });
    });
    return task.taskId;
  }

  /**
   * 把客户在韩立会话中的最新纠正写回当前演化修复任务。
   * 保留同一 taskId 和历史记录，同时废止旧执行租约，避免旧范围的迟到结果继续进入集成。
   */
  async reviseActiveRepairScope(request: {
    runId: string;
    proposalId: string;
    instruction: string;
    confirmedIntent: string;
    acceptanceCriteria: string[];
    currentProposalId?: string;
  }): Promise<ActiveRepairScopeRevisionResult> {
    const instruction = request.instruction.trim().slice(0, 8_000);
    if (!instruction) return { updated: false, taskId: null, taskRevision: null, message: "没有可写入的范围修订。" };
    const task = [...this.state().tasks].reverse().find((candidate) =>
      candidate.automationSource === "linghu-safeguard"
      && candidate.evolutionProposalId === request.proposalId
      // 活动的一次性运行已经固定 proposalId；运行标识只用于审计，旧数据可能使用全角冒号。
      && candidate.state !== "cancelled"
      && this.#canOperateTask(candidate, this.state()));
    if (!task) return { updated: false, taskId: null, taskRevision: null, message: "当前没有可更新的令狐修复任务。" };

    return this.#reviseRepairTask(task, request);
  }

  /** 将主进程核实的新故障写回确切修复任务；不改变原任务授权或客户等待。 */
  async refreshCheckpointRepair(taskId: string, request: SubmitCollaborationTaskInDto): Promise<ActiveRepairScopeRevisionResult> {
    const task = this.state().tasks.find((candidate) => candidate.taskId === taskId);
    if (!task || task.state === "cancelled" || task.automationSource !== "linghu-safeguard"
      || task.evolutionProposalId !== request.evolutionProposalId) {
      throw new Error("无法确认原修复任务与新故障归属，禁止修改任务。");
    }
    this.#assertTaskOperationAllowed(task);
    const recoveryMarker = request.constraints?.find((value) => value.startsWith("卡点标识："));
    if (!recoveryMarker || !task.snapshot.constraints.includes(recoveryMarker)) {
      throw new Error("新故障不属于该任务保存的原运行恢复点，禁止更新。");
    }
    const evidenceMarker = request.constraints?.find((value) => value.startsWith("卡点故障事实："));
    if (!evidenceMarker) throw new Error("新故障缺少持久事件身份，禁止重复调查。");
    if (task.snapshot.constraints.includes(evidenceMarker)) {
      return { updated: false, taskId, taskRevision: task.taskRevision, message: "当前故障已经登记，继续原调查。" };
    }
    return this.#reviseRepairTask(task, {
      instruction: evidenceMarker + "\n原故障：" + task.snapshot.problemStatement + "\n新故障：" + request.problemStatement,
      confirmedIntent: request.confirmedIntent, acceptanceCriteria: request.acceptanceCriteria || [],
    }, request);
  }

  /** 范围修订和新增故障共用失效旧结果、退出旧执行及恢复排队的生命周期。 */
  async #reviseRepairTask(task: CollaborationTaskOutDto, request: {
    instruction: string; confirmedIntent: string;
    acceptanceCriteria: string[]; currentProposalId?: string;
  }, failure?: SubmitCollaborationTaskInDto): Promise<ActiveRepairScopeRevisionResult> {
    const instruction = request.instruction.trim().slice(0, 8_000);
    // 新事实通常不是客户完成前置条件的证明；但本地归属等待必须复查当前 Git 事实，
    // 已经干净的工作区不能继续沿用历史脏文件快照阻塞同一修复任务。
    const ownershipWaitActive = task.integrationFailure?.kind === "local-change-ownership";
    const localUncommittedFiles = ownershipWaitActive
      ? await this.#workspaces.readLocalUncommittedFiles().catch(() => null)
      : null;
    const ownershipWaitSatisfied = ownershipWaitActive && localUncommittedFiles?.length === 0;
    const preserveCustomerWait = task.repairRequiresUserConfirmation === true
      || (ownershipWaitActive && !ownershipWaitSatisfied);
    const eventType = failure ? "task.failure_evidence_updated" : "task.scope_revised";
    const previousExecutorMemberId = task.executorMemberId;
    const previousAssignmentId = task.assignmentId;
    const previousRevision = task.taskRevision;
    const now = new Date().toISOString();
    const revisionConstraintPrefix = "客户最新范围修订：";
    this.#integrationPipeline.invalidateTask(task.taskId);
    this.#store.updateTask(task.taskId, eventType, (current, state) => {
      current.taskRevision += 1;
      current.workerGeneration += 1;
      current.snapshot.confirmedIntent = request.confirmedIntent.trim().slice(0, 20_000);
      current.snapshot.acceptanceCriteria = [...request.acceptanceCriteria];
      current.snapshot.constraints = [
        ...current.snapshot.constraints.filter((item) => !item.startsWith(revisionConstraintPrefix)),
        `${revisionConstraintPrefix}${instruction}`,
      ];
      if (failure) {
        current.snapshot.problemStatement = failure.problemStatement;
        current.snapshot.constraints = [...(failure.constraints || [])];
      }
      current.snapshot.contentHash = sha256(current.snapshot.confirmedIntent);
      for (const record of current.executionRecords.filter((item) => item.completedAt === null)) {
        record.status = "transferred";
        record.completedAt = now;
        record.blockingReason = "任务依据已更新，旧执行代次已经失效";
      }
      current.assignmentId = null;
      current.state = preserveCustomerWait ? "blocked" : "queued-executor";
      current.phase = null;
      current.recoveryTargetState = null;
      current.blockingReason = preserveCustomerWait ? task.blockingReason : "已收到新证据，正在重新调查同一任务";
      current.integrationGeneration = null;
      current.unifiedTest = null;
      current.codeVerifiedAt = null;
      current.completedAt = null;
      current.finalResult = null;
      current.resultSummary = null;
      current.repairDiagnosis = null;
      current.repairResult = null;
      current.repairFailureReason = null;
      if (!preserveCustomerWait) {
        current.repairRequiresUserConfirmation = false;
        current.customerActionGuidance = null;
        current.integrationFailure = null;
      }
      if (request.currentProposalId) {
        current.evolutionProposalId = request.currentProposalId;
        current.evolutionRoundId = request.currentProposalId;
      }
      // 已完成任务的工作树可能已经退休；同一 taskId 用新修订重新签发，不复用已删除目录。
      if (current.versionWorkspace?.retiredAt) current.versionWorkspace = null;
      else if (current.versionWorkspace) current.versionWorkspace.resultSha = null;
      if (previousExecutorMemberId) current.preferredExecutorMemberId = previousExecutorMemberId;
      current.executorMemberId = previousExecutorMemberId;
      for (const member of state.members) {
        if (member.currentTaskId !== current.taskId) continue;
        member.state = "idle";
        member.role = null;
        member.phase = null;
        member.currentTaskId = null;
        member.blockingReason = null;
        member.updatedAt = now;
      }
      const revisionSummary = preserveCustomerWait
        ? "仍需完成原等待事项"
        : ownershipWaitSatisfied ? "本地修改归属等待已由干净工作区证据解除，正在重新调查" : "正在重新调查";
      current.flowEvents.push({
        eventId: randomUUID(), type: eventType, stage: "recovery", status: "completed",
        actor: current.initiator, summary: `新证据已写入原任务，旧执行结果已失效（第 ${current.taskRevision} 版）；${revisionSummary}`,
        occurredAt: now, error: false,
        details: { previousRevision, taskRevision: current.taskRevision, assignmentId: previousAssignmentId || undefined, instruction },
      });
    });
    if (previousExecutorMemberId) {
      this.#stopHeartbeat(`executor:${task.taskId}`);
      try { await this.#executor.close(task.taskId); }
      catch (error) { this.#durations.instant(task.taskId, "task.scope_revision_executor_close_failed", { error: errorMessage(error) }); }
    }
    this.#schedule();
    return {
      updated: true,
      taskId: task.taskId,
      taskRevision: previousRevision + 1,
      message: preserveCustomerWait ? "新证据已登记，原客户等待继续有效。" : "任务依据已更新，正在重新调查原任务。",
    };
  }

  submitTask(request: SubmitCollaborationTaskInDto): SubmitCollaborationTaskOutDto {
    if (request.evolutionProposalId) this.#assertProposalOperationAllowed(request.evolutionProposalId);
    const enabledWorkers = this.state().members.filter((member) => member.kind === "worker" && member.enabled).length;
    if (enabledWorkers < 1) throw new Error("协同执行至少需要一名已启用的执行人物。");
    const task = this.#store.submitTask({
      ...request,
      ruleContext: this.#createTaskRuleContext?.(request.taskRuleIds || []),
    });
    this.#waitSpans.set(task.taskId, this.#durations.startWait(task.taskId, "executor-queue", "system-wait", "no-idle-executor", "executor-capacity", null));
    this.#schedule();
    return { taskId: task.taskId, state: this.state() };
  }

  continueTask(taskId: string, recoveryActor?: Pick<CollaborationMemberOutDto, "memberId" | "displayName">): CollaborationStateOutDto {
    // 活跃修复拥有原任务，监督器晚到的恢复请求不能把旧 resultSha 重新送去集成。
    if (this.#technicalRepairRuns.has(taskId)) return this.state();
    const current = this.#store.task(taskId);
    this.#assertTaskOperationAllowed(current);
    const guidanceActor = current.customerActionGuidance
      ? this.state().members.find((member) => member.memberId === LINGHU_MEMBER_ID)
      : undefined;
    const state = this.#store.continueTask(taskId, recoveryActor || guidanceActor);
    const previousWait = this.#waitSpans.get(taskId);
    if (previousWait) this.#durations.finish(previousWait, "interrupted", { releaseEvent: "task.recovery_requested" });
    this.#waitSpans.delete(taskId);
    this.#integrationPipeline.finishWaitingTask(taskId, "interrupted", { releaseEvent: "task.recovery_requested" });
    const task = state.tasks.find((candidate) => candidate.taskId === taskId);
    if (task?.state === "queued-executor") {
      this.#waitSpans.set(taskId, this.#durations.startWait(taskId, "recovery", "recovery-wait", "task-resume-queued", "executor-capacity", task.executorMemberId));
    } else if (task?.state === "ready-for-integration") {
      this.#integrationPipeline.trackWaitingTask(taskId, {
        segment: "integration-wait",
        waitType: "recovery-wait",
        reasonCode: "integration-resume-queued",
        resource: "integration-coordinator",
        resourceOwner: null,
      });
    }
    this.#schedule();
    return state;
  }

  /** 保存令狐已经完成的客户行动分析；相同故障指纹只保留一份指导。 */
  recordCustomerActionGuidance(taskId: string, guidance: CollaborationCustomerActionGuidanceOutDto): CollaborationStateOutDto {
    const current = this.#store.task(taskId);
    if (!current.integrationFailure && current.state !== "blocked") throw new Error("当前任务没有可登记的客户处理卡点。");
    if (current.customerActionGuidance?.sourceFingerprint === guidance.sourceFingerprint) return this.state();
    if (!isCompleteCustomerActionGuidance(guidance, guidance.sourceFingerprint, customerActionGuidanceEvidence(current))) {
      throw new Error("客户操作指导与当前持久化卡点事实不一致，不能保存继续入口。");
    }
    return this.#store.updateTask(taskId, "customer.action_required", (task) => {
      task.customerActionGuidance = structuredClone(guidance);
      appendFlow(task, "customer.action_required", "recovery", "waiting", guidance.title, guidance.generatedBy, false, { customerActionGuidance: structuredClone(guidance) });
    });
  }

  /** 已有结构化技术失败时，令狐先只读调查，再在原任务工作树内完成最小修正并生成新结果。 */
  async repairFailedUnifiedTest(taskId: string): Promise<boolean> {
    return this.repairTechnicalFailure(taskId);
  }

  /** 统一处理可由当前任务工作树修复的验证与发布基础设施故障。 */
  async repairTechnicalFailure(taskId: string): Promise<boolean> {
    if (!this.#canOperateTask(this.#store.task(taskId), this.state())) return false;
    const existing = this.#technicalRepairRuns.get(taskId);
    if (existing) return existing;
    const run = this.#repairTechnicalFailure(taskId).finally(() => this.#technicalRepairRuns.delete(taskId));
    this.#technicalRepairRuns.set(taskId, run);
    return run;
  }

  async #repairTechnicalFailure(taskId: string): Promise<boolean> {
    const failedTask = this.#store.task(taskId);
    // 冻结本轮统一测试失败事实，避免后续状态更新使可空字段与本次修复依据脱节。
    const integrationFailure = failedTask.integrationFailure;
    const repairableFailure = integrationFailure?.kind === "verification"
      || integrationFailure?.kind === "infrastructure";
    // 容量与归属等客户前置条件只能等待确认，任何直接调用也不得绕过自动恢复的等待边界。
    if (failedTask.repairRequiresUserConfirmation) return false;
    if (!repairableFailure || !["test-failed", "blocked"].includes(failedTask.state)) return false;
    const originalFailureKind = integrationFailure.kind;
    const repairStartedEvent = "unified_test.repair_started";
    const repairInvestigatedEvent = "unified_test.repair_investigated";
    const repairCompletedEvent = "unified_test.repair_completed";
    const repairFailedEvent = "unified_test.repair_failed";
    const linghu = requireMember(this.state(), LINGHU_MEMBER_ID);
    if (linghu.state !== "idle") return false;

    const originalReason = failedTask.blockingReason || integrationFailure.detail;
    const failureEvidence = [
      integrationFailure.detail,
      integrationFailure.workspaceRoot ? `发生目录：${integrationFailure.workspaceRoot}` : "",
      integrationFailure.conflictFiles.length ? `涉及文件：${integrationFailure.conflictFiles.join("、")}` : "",
    ].filter(Boolean).join("\n");
    let repairSession: ExecutorSessionPort | null = null;
    try {
      this.#store.updateTask(taskId, repairStartedEvent, (current, state) => {
        const handler = requireMember(state, LINGHU_MEMBER_ID);
        handler.generation += 1;
        handler.state = "working";
        handler.role = "executor";
        handler.phase = "analyzing";
        handler.currentTaskId = taskId;
        handler.updatedAt = new Date().toISOString();
        current.taskRevision += 1;
        current.state = "repairing-execution";
        current.phase = "analyzing";
        current.repairKind = "execution";
        current.repairFailureReason = originalReason;
        current.currentHandler = participantSnapshot(handler);
        const failureSource = originalFailureKind === "infrastructure" ? "发布基础设施" : "统一测试";
        current.blockingReason = `${handler.displayName}正在依据${failureSource}证据调查根本原因`;
        appendFlow(current, repairStartedEvent, "recovery", "started", current.blockingReason, handler, false, {
          failureStage: current.integrationFailure?.phase || "verification", failureSummary: originalReason,
          technicalEvidence: [failureEvidence || originalReason], originalExecutor: current.originalExecutor,
          routedBy: current.initiator, repairAssignee: participantSnapshot(handler),
        });
      });

      const task = this.#store.task(taskId);
      repairSession = await this.#executor.createTransient(task, requireMember(this.state(), LINGHU_MEMBER_ID));
      const diagnosisText = await repairSession.investigateRepair(task, failureEvidence || originalReason, (event) => this.#emitRepairProgress(taskId, event));
      const diagnosis = repairDiagnosis(task, diagnosisText, originalReason, participantSnapshot(requireMember(this.state(), LINGHU_MEMBER_ID)));
      this.#store.updateTask(taskId, repairInvestigatedEvent, (current, state) => {
        current.repairDiagnosis = diagnosis;
        current.phase = "implementing";
        requireMember(state, LINGHU_MEMBER_ID).phase = "implementing";
        current.blockingReason = "令狐老祖已完成失败候选只读调查，正在按调查结论修复";
        appendFlow(current, repairInvestigatedEvent, "recovery", "completed", current.blockingReason, requireMember(state, LINGHU_MEMBER_ID), false, flowRepairDetails(current, diagnosis));
      });
      const repaired = await repairSession.executeRepair(this.#store.task(taskId), diagnosis, (event) => this.#emitRepairProgress(taskId, event));
      if (repaired.status !== "code-verified") throw new Error(repaired.pendingActions.join("；")
        || "统一测试修复未完成代码级验证");
      const resultSha = await this.#workspaces.commitTaskResult(
        this.#store.task(taskId),
        linghu.displayName,
        repaired.authorizedFiles,
      );
      this.#store.updateTask(taskId, repairCompletedEvent, (current, state) => {
        if (!current.versionWorkspace) throw new Error("统一测试修复后缺少版本工作区。");
        current.versionWorkspace.resultSha = resultSha;
        current.state = "ready-for-integration";
        current.phase = "ready";
        current.integrationGeneration = null;
        current.integrationFailure = null;
        current.recoveryTargetState = "ready-for-integration";
        current.repairKind = null;
        current.repairFailureReason = null;
        current.repairResult = repaired.text;
        current.blockingReason = null;
        current.codeVerifiedAt = new Date().toISOString();
        current.finalResult = repaired.text;
        current.resultSummary = createCollaborationResultSummary(current, repaired.text, repaired.pendingActions);
        current.unifiedTest = { status: "pending", owner: participantSnapshot(requireMember(state, LINGHU_MEMBER_ID)), failureReason: null, startedAt: null, completedAt: null };
        appendFlow(current, repairCompletedEvent, "recovery", "completed", "令狐老祖已完成失败项修复并生成新结果版本，等待重新统一测试", requireMember(state, LINGHU_MEMBER_ID), false, flowRepairDetails(current, diagnosis, repaired.text));
        releaseMemberFromState(state, LINGHU_MEMBER_ID);
      });
      this.#integrationPipeline.trackWaitingTask(taskId, {
        segment: "integration-wait",
        waitType: "recovery-wait",
        reasonCode: "unified-test-repair-completed",
        resource: "integration-coordinator",
        resourceOwner: null,
      });
      this.#integrationPipeline.schedule();
      return true;
    } catch (error) {
      // 调查修复未解除时保留原始证据，后续由统一测试失败路径继续处理。
      this.#store.updateTask(taskId, repairFailedEvent, (current, state) => {
        current.state = originalFailureKind === "verification" ? "test-failed" : "blocked";
        current.phase = null;
        current.repairKind = null;
        current.repairFailureReason = errorMessage(error);
        current.blockingReason = originalReason;
        appendFlow(current, repairFailedEvent, "recovery", "failed", `令狐老祖修复统一测试失败：${errorMessage(error)}`, participantSnapshot(requireMember(state, LINGHU_MEMBER_ID)), true);
        releaseMemberFromState(state, LINGHU_MEMBER_ID);
      });
      return true;
    } finally {
      await repairSession?.dispose();
      this.#schedule();
    }
  }

  /** 把已由自动保障确认的停点转换为可审计恢复态，并立即建立新的执行或集成租约。 */
  async recoverTask(taskId: string, reason: string): Promise<CollaborationStateOutDto> {
    // 先保护在途修复，再处理可能已经过期的超时通知。
    if (this.#technicalRepairRuns.has(taskId)) return this.state();
    const task = this.#store.task(taskId);
    if (!this.#canOperateTask(task, this.state())) return this.state();
    // 已验证版本只能由真实新进程确认；旧超时通知不得重新集成或访问已回收的工作树。
    if (task.state === "awaiting-restart" || task.state === "integrated" || task.state === "cancelled") return this.state();
    if (task.state !== "blocked" && task.state !== "recovering") await this.#blockTask(taskId, reason);
    return this.continueTask(taskId);
  }

  async cancelTask(taskId: string): Promise<CollaborationStateOutDto> {
    const task = this.#store.task(taskId);
    this.#stopHeartbeat(`executor:${taskId}`);
    if (task.executorMemberId) this.#lastProgressWriteMs.delete(`${taskId}:${task.executorMemberId}`);
    const state = this.#store.cancelTask(taskId);
    await this.#executor.close(taskId);
    const waitSpan = this.#waitSpans.get(taskId);
    if (waitSpan) this.#durations.finish(waitSpan, "interrupted", { releaseEvent: "task.cancelled" });
    this.#waitSpans.delete(taskId);
    this.#integrationPipeline.finishWaitingTask(taskId, "interrupted", { releaseEvent: "task.cancelled" });
    return state;
  }

  resumePendingWork(resumeInterruptedExecution = false): void {
    // 旧版曾把本地归属等待误写为源码修复；恢复时先还原为客户处理卡点，避免重启后继续执行无权处理的修改。
    this.#restoreLegacyLocalChangeOwnershipWaits();
    // 应用重建后的统一恢复入口先接续全部可修复失败，再恢复普通执行和集成队列。
    const state = this.state();
    this.#scheduleUnifiedTestRepairs(state);
    this.#scheduleMergeConflictCorrections(state);
    this.#scheduleExecutionRepairs(state);
    // 正在运行的一次性专题在应用重建后沿原任务、原工作树接续普通执行。
    // 技术失败和客户前置条件仍由各自的恢复路径处理，不能借启动绕过门禁。
    if (resumeInterruptedExecution) {
      for (const task of state.tasks.filter((candidate) => candidate.state === "recovering"
        && candidate.recoveryTargetState === "executing"
        && !candidate.repairKind && !candidate.integrationFailure
        && !candidate.repairRequiresUserConfirmation && !candidate.customerActionGuidance
        && this.#canOperateTask(candidate, state))) {
        this.continueTask(task.taskId);
      }
    }
    this.#schedule();
  }

  /** 保留任务结果和原始归属证据，退役旧版错误创建的源码修复状态。 */
  #restoreLegacyLocalChangeOwnershipWaits(): void {
    const taskIds = this.state().tasks
      .filter((task) => task.state === "repairing-execution" && task.integrationFailure?.kind === "local-change-ownership")
      .map((task) => task.taskId);
    for (const taskId of taskIds) {
      this.#store.updateTask(taskId, "integration.local_change_ownership_wait_restored", (current, state) => {
        if (current.state !== "repairing-execution" || current.integrationFailure?.kind !== "local-change-ownership") return;
        current.state = "blocked";
        current.phase = null;
        current.repairKind = null;
        current.repairFailureReason = null;
        current.currentHandler = null;
        current.blockingReason = current.integrationFailure.summary || "合并前无法确认本地修改归属";
        for (const member of state.members.filter((candidate) => candidate.currentTaskId === current.taskId)) {
          releaseMemberFromState(state, member.memberId);
        }
        appendFlow(current, "integration.local_change_ownership_wait_restored", "recovery", "waiting", "已保留未登记本地修改证据，等待客户确认文件归属", null, false);
      });
    }
  }

  confirmPublishedRestart(): number[] { return this.#integrationPipeline.confirmPublishedRestart(); }

  /** 南宫婉确认同一演化轮全部结果已返回后，才把不可拆分的完整批次交给令狐。 */
  sealEvolutionRound(proposalId: string, taskIds: string[]): CollaborationStateOutDto {
    this.#assertProposalOperationAllowed(proposalId);
    const uniqueTaskIds = [...new Set(taskIds)];
    if (!uniqueTaskIds.length) throw new Error("演化轮没有可封存的任务。");
    const current = this.state();
    const tasks = uniqueTaskIds.map((taskId) => current.tasks.find((task) => task.taskId === taskId));
    if (tasks.some((task) => !task || task.evolutionProposalId !== proposalId || task.evolutionRoundId !== proposalId)) {
      throw new Error("演化轮任务与南宫婉收集清单不一致。");
    }
    if (tasks.some((task) => task?.state !== "returned-to-nangong" || !task.versionWorkspace?.resultSha)) {
      throw new Error("本轮任务尚未全部完成并返回南宫婉。");
    }
    const nangong = current.members.find((member) => member.memberId === "nangong-wan");
    this.#store.updateTask(uniqueTaskIds[0], "evolution.round_sealed", (_first, mutable) => {
      for (const task of mutable.tasks.filter((candidate) => uniqueTaskIds.includes(candidate.taskId))) {
        task.state = "ready-for-integration";
        task.phase = "ready";
        task.mergeStrategy = "ATOMIC_GROUP";
        task.atomicGroupId = proposalId;
        task.dependencyTaskIds = [];
        task.currentHandler = nangong ? participantSnapshot(nangong) : task.initiator;
        appendFlow(task, "evolution.task_collected", "integration", "completed", "南宫婉已收齐本轮任务并封存，统一交给令狐老祖", task.currentHandler);
      }
    });
    for (const taskId of uniqueTaskIds) {
      this.#integrationPipeline.trackWaitingTask(taskId, {
        segment: "integration-wait",
        waitType: "system-wait",
        reasonCode: "nangong-round-sealed",
        resource: proposalId,
        resourceOwner: "nangong-wan",
      });
    }
    this.#integrationPipeline.schedule();
    return this.state();
  }

  async dispose(): Promise<void> {
    this.#disposed = true;
    this.#unsubscribeStore();
    this.#integrationPipeline.dispose();
    this.#durations.interruptOpenSpans("application.before-quit");
    await this.#executor.closeAll();
    for (const timer of this.#heartbeatTimers.values()) clearInterval(timer);
    this.#heartbeatTimers.clear();
  }

  /** 只为已有确定验证失败的在途任务排队修复；容量释放后的任意状态更新都会再次尝试。 */
  #scheduleUnifiedTestRepairs(state: CollaborationStateOutDto): void {
    if (this.#disposed || state.mode !== "collaboration") return;
    const linghu = state.members.find((member) => member.memberId === LINGHU_MEMBER_ID);
    if (!linghu || linghu.state !== "idle") return;
    const task = state.tasks.find((candidate) => candidate.state === "test-failed" && candidate.integrationFailure?.kind === "verification" && this.#canOperateTask(candidate, state));
    if (!task || this.#technicalRepairRuns.has(task.taskId)) return;
    queueMicrotask(() => {
      if (!this.#disposed) void this.repairFailedUnifiedTest(task.taskId);
    });
  }

  /** Git 合并冲突是确定的代码修正停点；无需等待主动巡检或人工点击，直接签发令狐修正版。 */
  #scheduleMergeConflictCorrections(state: CollaborationStateOutDto): void {
    if (this.#disposed || state.mode !== "collaboration") return;
    const task = state.tasks.find((candidate) => ["blocked", "recovering"].includes(candidate.state) && candidate.integrationFailure?.kind === "merge-conflict" && this.#canOperateTask(candidate, state));
    if (!task || this.#mergeConflictCorrectionRuns.has(task.taskId)) return;
    this.#mergeConflictCorrectionRuns.add(task.taskId);
    queueMicrotask(() => {
      try {
        if (this.#disposed) return;
        const current = this.state().tasks.find((candidate) => candidate.taskId === task.taskId);
        if (!current || !["blocked", "recovering"].includes(current.state) || current.integrationFailure?.kind !== "merge-conflict") return;
        const linghu = requireMember(this.state(), LINGHU_MEMBER_ID);
        this.continueTask(task.taskId, linghu);
      } finally {
        this.#mergeConflictCorrectionRuns.delete(task.taskId);
      }
    });
  }

  /** 令狐释放后自动接续最早进入恢复队列的执行故障；等待期间不占用人物状态，也不记为修复失败。 */
  #scheduleExecutionRepairs(state: CollaborationStateOutDto): void {
    if (this.#disposed || state.mode !== "collaboration") return;
    const linghu = state.members.find((member) => member.memberId === LINGHU_MEMBER_ID);
    if (!linghu || linghu.state !== "idle") return;
    const task = state.tasks.find((candidate) => candidate.state === "recovering"
      // 普通技术失败可以自动接续。
      && candidate.repairKind === "execution"
      // 必须保留原始失败事实才能发起调查。
      && candidate.repairFailureReason
      // 文件范围确认属于用户决策，令狐释放后也不能自动越权继续。
      && !candidate.repairRequiresUserConfirmation
      && this.#canOperateTask(candidate, state));
    if (!task) return;
    queueMicrotask(() => {
      if (!this.#disposed) void this.#repairFailedExecution(task.taskId, task.repairFailureReason || "执行故障等待恢复", false, task.taskRevision);
    });
  }

  #schedule(): void {
    if (this.#disposed || this.state().mode !== "collaboration") return;
    queueMicrotask(() => {
      if (this.#disposed) return;
      this.#scheduleExecutors();
      this.#integrationPipeline.schedule();
    });
  }

  #canOperateTask(task: CollaborationTaskOutDto, state: CollaborationStateOutDto): boolean {
    return this.#taskOperationGuard?.(task, state).allowed ?? true;
  }

  #assertTaskOperationAllowed(task: CollaborationTaskOutDto): void {
    const decision = this.#taskOperationGuard?.(task, this.state());
    if (decision && !decision.allowed) throw new Error(decision.message);
  }

  #assertProposalOperationAllowed(proposalId: string): void {
    const decision = this.#proposalOperationGuard?.(proposalId, this.state());
    if (decision && !decision.allowed) throw new Error(decision.message);
  }

  #scheduleExecutors(): void {
    const state = this.state();
    const allWorkers = state.members.filter((member) => member.kind === "worker" && member.enabled && member.state !== "draining" && member.state !== "offline");
    const workers = allWorkers.filter((member) => !ORCHESTRATOR_MEMBER_IDS.has(member.memberId));
    // 受保护人物只接收显式严格指派的保障任务，且不消耗普通执行人的容量槽位。
    const protectedTask = state.tasks.find((task) => task.state === "queued-executor" && task.preferredExecutorMemberId && ORCHESTRATOR_MEMBER_IDS.has(task.preferredExecutorMemberId) && this.#canOperateTask(task, state));
    const protectedExecutor = protectedTask ? allWorkers.find((member) => member.memberId === protectedTask.preferredExecutorMemberId && member.state === "idle") : null;
    if (protectedTask && protectedExecutor) void this.#beginExecutor(protectedTask.taskId, protectedExecutor.memberId);
    const activeExecutors = workers.filter((member) => member.role === "executor" && member.currentTaskId).length;
    const executorCapacity = Math.max(0, workers.length - activeExecutors);
    if (executorCapacity === 0) return;
    const queued = state.tasks.filter((task) => task.state === "queued-executor" && !ORCHESTRATOR_MEMBER_IDS.has(task.preferredExecutorMemberId || "") && this.#canOperateTask(task, state)).slice(0, executorCapacity);
    const idle = fairIdleMembers(workers);
    for (const task of queued) {
      const strictPreferredId = task.preferredExecutorMemberId || null;
      const strictPreferred = strictPreferredId ? allWorkers.find((member) => member.memberId === strictPreferredId && member.state === "idle") : null;
      if (strictPreferredId && !strictPreferred) continue;
      const preferredIndex = task.executorMemberId ? idle.findIndex((member) => member.memberId === task.executorMemberId) : -1;
      const [executor] = strictPreferred ? [strictPreferred] : preferredIndex >= 0 ? idle.splice(preferredIndex, 1) : idle.splice(0, 1);
      if (!executor) break;
      void this.#beginExecutor(task.taskId, executor.memberId);
    }
  }

  async #beginExecutor(taskId: string, memberId: string): Promise<void> {
    if (this.#activeTaskRuns.has(taskId)) return;
    const current = this.#store.task(taskId);
    if (!this.#canOperateTask(current, this.state())) return;
    this.#activeTaskRuns.add(taskId);
    const queueSpan = this.#waitSpans.get(taskId);
    if (queueSpan) this.#durations.finish(queueSpan, "completed", { releaseEvent: "executor.assigned", memberId });
    this.#waitSpans.delete(taskId);
    let startupSpan: string | null = null;
    let startupLease: { assignmentId: string | null; workerGeneration: number } | null = null;
    try {
      this.#store.updateTask(taskId, "executor.assigned", (task, state) => {
        const member = requireMember(state, memberId);
        if (member.state !== "idle") throw new Error("执行人不再空闲。");
        member.generation += 1;
        member.state = "assigned";
        member.role = "executor";
        member.phase = "planning";
        member.currentTaskId = taskId;
        member.lastAssignedAt = new Date().toISOString();
        member.updatedAt = member.lastAssignedAt;
        const now = new Date().toISOString();
        const previousAssignment = task.executionRecords.at(-1);
        if (previousAssignment && previousAssignment.completedAt === null) {
          previousAssignment.status = previousAssignment.executor.memberId === memberId ? "blocked" : "transferred";
          previousAssignment.completedAt = now;
          previousAssignment.blockingReason = previousAssignment.executor.memberId === memberId ? "恢复后重新建立执行租约" : `任务转交给${member.displayName}`;
        }
        task.assignmentId = randomUUID();
        task.workerGeneration = member.generation;
        task.executorMemberId = memberId;
        task.originalExecutor ??= participantSnapshot(member);
        task.currentHandler = participantSnapshot(member);
        task.state = "preparing-worktree";
        task.phase = "planning";
        task.executionRecords.push({
          assignmentId: task.assignmentId,
          executor: participantSnapshot(member),
          workerGeneration: member.generation,
          status: "assigned",
          assignedAt: now,
          executionStartedAt: null,
          completedAt: null,
          transferFromAssignmentId: previousAssignment?.assignmentId || null,
          handoffType: !previousAssignment ? "initial" : previousAssignment.executor.memberId === memberId ? "resume" : "transfer",
          result: null,
          blockingReason: null,
          changedFiles: [],
        });
        const assignmentSummary = !previousAssignment
          ? `${member.displayName}已接收任务并准备独立版本`
          : previousAssignment.executor.memberId === memberId
            ? `${member.displayName}通过新的执行租约恢复同一任务`
            : `任务由${previousAssignment.executor.displayName}转交给${member.displayName}`;
        appendFlow(task, previousAssignment ? "executor.reassigned" : "executor.assigned", "analysis", "started", assignmentSummary, member, false,
          previousAssignment ? { repairResult: task.repairResult || undefined, returnToExecutor: participantSnapshot(member), routedBy: task.initiator } : null);
      });
      const assignedTask = this.#store.task(taskId);
      // 初始化可能跨越客户范围修订；记录本轮租约，避免旧工作树或旧会话晚到后污染新范围。
      startupLease = { assignmentId: assignedTask.assignmentId, workerGeneration: assignedTask.workerGeneration };
      const worktreeSpan = this.#durations.start(taskId, "worktree-prepare", { memberId });
      try {
        const workspace = assignedTask.versionWorkspace
          ? await this.#workspaces.resumeTask(assignedTask)
          : await this.#workspaces.prepareTask(assignedTask, memberId);
        this.#assertExecutorLease(taskId, memberId, startupLease.assignmentId, startupLease.workerGeneration);
        this.#store.updateTask(taskId, assignedTask.versionWorkspace ? "version_workspace.resumed" : "version_workspace.ready", (task) => { task.versionWorkspace = workspace; });
        this.#durations.finish(worktreeSpan, "completed", { branchName: workspace.branchName, resumed: Boolean(assignedTask.versionWorkspace) });
      } catch (error) {
        this.#durations.finish(worktreeSpan, "failed", { error: errorMessage(error) });
        throw error;
      }
      const task = this.#store.task(taskId);
      const member = requireMember(this.state(), memberId);
      startupSpan = this.#durations.start(taskId, "codex-startup", { memberId, role: "executor", generation: member.generation });
      await this.#executor.open(task, member);
      this.#assertExecutorLease(taskId, memberId, startupLease.assignmentId, startupLease.workerGeneration);
      this.#startHeartbeat(`executor:${taskId}`, taskId, memberId, { isAlive: () => this.#executor.isAlive(taskId) });
      this.#durations.finish(startupSpan, "completed", { releaseEvent: "executor.codex.ready" });
      startupSpan = null;
      await this.#resumeOrAnalyze(taskId);
    } catch (error) {
      if (startupSpan) this.#durations.finish(startupSpan, "failed", { error: errorMessage(error) });
      // 客户修正范围会主动废止旧租约；工作树或会话初始化的迟到结果只关闭自身，不能阻塞新范围。
      if (error instanceof StaleExecutorLeaseError || (startupLease && !this.#hasExecutorLease(taskId, memberId, startupLease.assignmentId, startupLease.workerGeneration))) {
        await this.#executor.close(taskId);
        return;
      }
      if (this.#store.task(taskId).state === "cancelled") return;
      await this.#blockTask(taskId, `执行人初始化失败：${errorMessage(error)}`);
    } finally {
      this.#activeTaskRuns.delete(taskId);
      this.#schedule();
    }
  }

  async #analyze(taskId: string): Promise<void> {
    const task = this.#store.task(taskId);
    const memberId = task.executorMemberId;
    if (!memberId) throw new Error("任务缺少执行人。");
    const assignmentId = task.assignmentId;
    const workerGeneration = task.workerGeneration;
    const segment = "analysis";
    const span = this.#durations.start(taskId, segment, { memberId, planVersion: task.currentPlanVersion + 1 });
    this.#setTaskAndMemberPhase(taskId, "analyzing", "analyzing");
    try {
      const emit = (event: CodexStreamEventOutDto) => {
        try { this.#assertExecutorLease(taskId, memberId, assignmentId, workerGeneration); }
        catch { return; }
        this.#touchProtocolProgress(taskId, memberId);
        if (event.type === "diff-updated") {
          const changedFiles = normalizeChangedFiles(event.changedFiles || []);
          this.#store.updateTask(taskId, "execution.diff_updated", (current) => {
            const execution = current.executionRecords.find((item) => item.assignmentId === assignmentId);
            if (execution) execution.changedFiles = changedFiles;
          });
        }
        this.#emitStream(taskId, memberId, event);
      };
      const text = await this.#executor.analyze(task, emit);
      this.#assertExecutorLease(taskId, memberId, assignmentId, workerGeneration);
      const plan: CollaborationRequirementPlanOutDto = {
        version: task.currentPlanVersion + 1,
        ownerMemberId: memberId,
        ownerDisplayName: requireMember(this.state(), memberId).displayName,
        status: "ready-for-execution",
        text,
        executionBrief: parseExecutionBrief(text, task),
        contentHash: sha256(text),
        createdAt: new Date().toISOString(),
      };
      this.#store.updateTask(taskId, "technical_analysis.ready", (current, state) => {
        current.plans.push(plan);
        current.currentPlanVersion = plan.version;
        current.state = "executing";
        current.phase = "implementing";
        const executor = requireMember(state, memberId);
        executor.state = "working";
        executor.phase = "implementing";
        executor.blockingReason = null;
        executor.updatedAt = new Date().toISOString();
        const execution = current.executionRecords.find((item) => item.assignmentId === current.assignmentId);
        if (execution) execution.status = "executing";
        appendFlow(current, "technical_analysis.ready", "analysis", "completed", `${executor.displayName}已完成技术分析，开始按方案 v${plan.version} 实施`, executor);
      });
      this.#durations.finish(span, "completed", {
        releaseEvent: "technical_analysis.ready",
        planVersion: plan.version,
      });
      await this.#execute(taskId);
    } catch (error) {
      this.#durations.finish(span, "failed", { error: errorMessage(error) });
      throw error;
    }
  }

  async #resumeOrAnalyze(taskId: string): Promise<void> {
    const task = this.#store.task(taskId);
    const target = task.recoveryTargetState;
    if (target === "executing" && task.currentPlanVersion > 0) {
      this.#store.updateTask(taskId, "task.execution_recovered", (current) => {
        current.state = "executing";
        current.recoveryTargetState = null;
      });
      await this.#execute(taskId);
      return;
    }
    this.#store.updateTask(taskId, "task.analysis_recovered", (current) => { current.recoveryTargetState = null; });
    await this.#analyze(taskId);
  }

  async #execute(taskId: string): Promise<void> {
    const task = this.#store.task(taskId);
    const taskRevision = task.taskRevision;
    const memberId = task.executorMemberId;
    const session = this.#executor.session(taskId);
    const plan = task.plans.find((candidate) => candidate.version === task.currentPlanVersion);
    if (!memberId || !session || !plan) return this.#blockTask(taskId, "执行阶段缺少执行人、Codex 或当前方案。");
    const assignmentId = task.assignmentId;
    const workerGeneration = task.workerGeneration;
    let changeSpan: string | null = this.#durations.start(taskId, "source-change", { memberId, planVersion: plan.version });
    let verificationSpan: string | null = null;
    this.#setTaskAndMemberPhase(taskId, "executing", "implementing");
    this.#store.updateTask(taskId, "execution.started", (current, state) => {
      const executor = requireMember(state, memberId);
      const execution = current.executionRecords.find((item) => item.assignmentId === assignmentId);
      if (execution) {
        execution.status = "executing";
        execution.executionStartedAt ??= new Date().toISOString();
      }
      appendFlow(current, "execution.started", "execution", "started", `${executor.displayName}开始执行已审核方案`, executor);
    });
    try {
      const result = await this.#executor.execute(task, plan, (event) => {
        try { this.#assertExecutorLease(taskId, memberId, assignmentId, workerGeneration); }
        catch { return; }
        this.#touchProtocolProgress(taskId, memberId);
        if (event.type === "diff-updated") {
          const changedFiles = normalizeChangedFiles(event.changedFiles || []);
          this.#store.updateTask(taskId, "execution.diff_updated", (current) => {
            const execution = current.executionRecords.find((item) => item.assignmentId === assignmentId);
            if (execution) execution.changedFiles = changedFiles;
          });
        }
        // 验证/修复每轮先落业务事实，流式内容才可绑定到该轮节点，不能只更新人物阶段。
        const update = event.type === "managed-execution" ? event.managedExecution : undefined;
        if (update && (update.stage === "code-validation" || update.selfRepair)) {
          const repair = Boolean(update.selfRepair);
          const status = update.status === "blocked" ? "failed" : update.status === "completed" ? "completed" : "started";
          this.#store.updateTask(taskId, "executor.validation_round", (current, state) => {
            const type = repair
              ? status === "started" ? "executor.self_repair_started" : status === "failed" ? "executor.self_repair_failed" : "executor.self_repair_completed"
              : status === "started" ? "executor.self_test_started" : status === "failed" ? "executor.self_test_failed" : "executor.self_test_passed";
            if (current.flowEvents.some(item => item.type === type && item.details?.assignmentId === assignmentId && item.details?.validationRound === update.round)) return;
            // 只有主进程受控测试执行器提供的结构化结论才能进入任务快照；执行人消息和任意日志仍仅是展示文本。
            const verificationEvidence = update.verificationEvidence?.filter((evidence) => evidence.source === "task-worktree-test-runner") || [];
            appendFlow(current, type, "execution", status, update.message, requireMember(state, memberId), status === "failed", {
              assignmentId: assignmentId || undefined,
              validationRound: update.round,
              ...(verificationEvidence.length ? {
                verificationEvidence,
                technicalEvidence: verificationEvidence.map((evidence) => `${evidence.scenario}：${evidence.command}（${evidence.status}）`),
              } : {}),
            });
          });
        }
        this.#emitStream(taskId, memberId, event);
        const phase = update?.selfRepair ? "implementing" : phaseFromStreamEvent(event);
        if (phase) {
          this.#setTaskAndMemberPhase(taskId, "executing", phase);
          if (phase === "verifying" && !verificationSpan) {
            if (changeSpan) this.#durations.finish(changeSpan, "completed", { releaseEvent: "verification.started" });
            changeSpan = null;
            verificationSpan = this.#durations.start(taskId, "verification", { memberId, planVersion: plan.version });
          }
        }
      });
      this.#assertExecutorLease(taskId, memberId, assignmentId, workerGeneration);
      if (result.status !== "code-verified") {
        if (changeSpan) this.#durations.finish(changeSpan, "failed", { pendingActions: result.pendingActions.join("；") });
        if (verificationSpan) this.#durations.finish(verificationSpan, "failed", { pendingActions: result.pendingActions.join("；") });
        // 唯一分流结果决定后续：未带分类的旧结果按门禁失败停止，禁止再把 incomplete 泛化派给令狐。
        const routing = result.failureRouting;
        if (!routing) return this.#holdForUnclassifiedFailure(taskId, result.pendingActions.join("；") || "执行结果缺少结构化失败分类", taskRevision);
        if (routing.kind === "diagnostic-correction") return this.#continueDiagnosticCorrection(taskId, memberId, assignmentId, routing, taskRevision);
        return this.#repairFailedExecution(
          // 原任务标识保持不变，恢复过程继续沿同一任务历史记录。
          taskId,
          // 执行结果必须保留具体失败正文，不能只显示“失败”。
          result.pendingActions.join("；") || "当前修改尚未完成代码验证",
          // 结构化失败类别决定是否需要等待用户重新确认文件范围。
          routing.kind === "gate-failure" || result.failureKind === "scope-confirmation",
          taskRevision,
        );
      }
      if (changeSpan) this.#durations.finish(changeSpan, "completed", { releaseEvent: "task.code_verified" });
      if (verificationSpan) this.#durations.finish(verificationSpan, "completed", { releaseEvent: "task.code_verified" });
      changeSpan = null;
      verificationSpan = null;
      await this.#completeVerifiedExecution(taskId, memberId, assignmentId, result);

    } catch (error) {
      if (changeSpan) this.#durations.finish(changeSpan, "failed", { error: errorMessage(error) });
      if (verificationSpan) this.#durations.finish(verificationSpan, "failed", { error: errorMessage(error) });
      // 范围修订后的旧执行结果已被租约门拒绝，这不是需要令狐再次修复的故障。
      if (error instanceof StaleExecutorLeaseError) return;
      if (this.#store.task(taskId).state === "cancelled") return;
      await this.#repairFailedExecution(taskId, `执行失败：${errorMessage(error)}`, false, taskRevision);
    }
  }

  /** 诊断纠正仍在原执行人与原会话内完成，不能制造恢复、审批或令狐接管状态。 */
  async #continueDiagnosticCorrection(
    taskId: string,
    memberId: string,
    assignmentId: string | null,
    routing: ExecutorFailureRoutingOutDto,
    expectedTaskRevision: number,
  ): Promise<void> {
    this.#store.updateTask(taskId, "execution.diagnostic_correction", (current, state) => {
      if (current.taskRevision !== expectedTaskRevision) return;
      current.state = "executing";
      current.phase = "analyzing";
      current.blockingReason = null;
      current.repairKind = null;
      current.repairFailureReason = null;
      current.repairRequiresUserConfirmation = false;
      current.currentHandler = participantSnapshot(requireMember(state, memberId));
      appendFlow(current, "execution.diagnostic_correction", "execution", "started",
        `正在核对：${routing.diagnosticContext}；保留原始失败，下一步：${routing.nextRetryAction}`,
        requireMember(state, memberId), false, { assignmentId: assignmentId || undefined, failureRouting: routing, technicalEvidence: routing.rawCommandResults });
    });
    // 同一任务的会话和分配保持有效，只重新进入原执行步骤。
    queueMicrotask(() => { if (this.#store.task(taskId).taskRevision === expectedTaskRevision) void this.#execute(taskId); });
  }

  /** 旧结果缺少唯一分流事实时只阻断，不再猜测为令狐可修复故障。 */
  #holdForUnclassifiedFailure(taskId: string, reason: string, expectedTaskRevision: number): void {
    this.#store.updateTask(taskId, "task.blocked", (current) => {
      if (current.taskRevision !== expectedTaskRevision) return;
      current.state = "blocked";
      current.phase = "blocked";
      current.blockingReason = `执行结果缺少结构化失败分类，已停止自动派发：${reason}`;
      current.recoveryTargetState = "executing";
      appendFlow(current, "task.blocked", "recovery", "failed", current.blockingReason, current.currentHandler || null, true);
    });
  }

  /** 普通实施和令狐完整修复共享结果提交门，避免修复成功后重新执行整个任务。 */
  async #completeVerifiedExecution(
    taskId: string,
    memberId: string,
    assignmentId: string | null,
    result: { text: string; pendingActions: string[]; authorizedFiles: string[] },
  ): Promise<void> {
      this.#setTaskAndMemberPhase(taskId, "executing", "finalizing");
      // 提交前再次读取真实 Git 状态，避免最后一次复测后出现未上报的范围外文件。
      const resultSha = await this.#workspaces.commitTaskResult(
        this.#store.task(taskId),
        requireMember(this.state(), memberId).displayName,
        result.authorizedFiles,
      );
      this.#store.updateTask(taskId, "task.integration_ready", (current, state) => {
        if (!current.versionWorkspace) throw new Error("任务缺少版本工作区。");
        current.versionWorkspace.resultSha = resultSha;
        // 令狐卡点修复虽然保留原专题/提案关联，但不是南宫婉分发的业务实施任务。
        // 代码验证完成后必须直接进入集成，集成完成再由卡点协调器交回原处理人。
        const returnsToNangong = Boolean(
          current.evolutionProposalId
          && current.evolutionRoundId
          && current.automationSource !== "linghu-safeguard",
        );
        current.state = returnsToNangong ? "returned-to-nangong" : "ready-for-integration";
        current.phase = "ready";
        // 新工作区已经形成新结果后，旧候选的冲突证据完成职责，避免下一轮仍把已修正版识别为失败任务。
        if (current.integrationFailure?.kind === "merge-conflict") current.integrationFailure = null;
        current.finalResult = result.text;
        current.codeVerifiedAt = new Date().toISOString();
        current.completedAt = null;
        current.resultSummary = createCollaborationResultSummary(current, result.text, result.pendingActions);
        const execution = current.executionRecords.find((item) => item.assignmentId === assignmentId);
        if (execution) {
          execution.status = "code-verified";
          execution.completedAt = current.codeVerifiedAt;
          execution.result = result.text;
        }
        if (returnsToNangong) {
          current.returnedToNangongAt = current.codeVerifiedAt;
          current.currentHandler = participantSnapshot(requireMember(state, "nangong-wan"));
        }
        appendFlow(current, "task.code_verified", "execution", "completed", returnsToNangong ? "执行修改已完成代码级验证，结果已返回南宫婉收集" : "执行修改已完成代码级验证，等待集成", execution?.executor || participantSnapshot(requireMember(state, memberId)));
      });
      this.#durations.instant(taskId, "task.integration_ready", { memberId, resultSha });
      await this.#retireExecutor(taskId, memberId);
      const readyTask = this.#store.task(taskId);
      if (readyTask.state === "returned-to-nangong") return;
      const unsatisfiedDependencies = readyTask.dependencyTaskIds.filter((dependencyId) => this.state().tasks.find((candidate) => candidate.taskId === dependencyId)?.state !== "integrated");
      this.#integrationPipeline.trackWaitingTask(taskId, unsatisfiedDependencies.length > 0
        ? {
          segment: "dependency-wait",
          waitType: "dependency-wait",
          reasonCode: "integration-dependencies",
          resource: unsatisfiedDependencies.join(","),
          resourceOwner: null,
        }
        : {
          segment: "integration-wait",
          waitType: "system-wait",
          reasonCode: readyTask.mergeStrategy === "ATOMIC_GROUP" ? "atomic-group-members" : "integration-batch",
          resource: "integration-coordinator",
          resourceOwner: null,
        });
  }

  async #repairFailedExecution(taskId: string, reason: string, requiresScopeConfirmation = false, expectedTaskRevision?: number): Promise<void> {
    // 每次处理都重新读取任务，避免使用失败发生前的旧状态。
    const failedTask = this.#store.task(taskId);
    const failureRevision = expectedTaskRevision ?? failedTask.taskRevision;
    // 排队恢复可能与客户范围修订同时发生；旧修订只能自行收口，不能关闭新会话或再次派发令狐。
    if (failedTask.taskRevision !== failureRevision) return;
    // 保存本次真实执行人，后续恢复仍能回到正确负责人。
    const originalId = failedTask.executorMemberId;
    // 失败会话已经结束，先释放底层连接，避免下一次恢复复用坏会话。
    await this.#executor.close(taskId);
    if (this.#store.task(taskId).taskRevision !== failureRevision) return;
    // 文件范围不足是授权边界，不属于能够自动尝试解决的代码错误。
    if (requiresScopeConfirmation) {
      // 把任务放入稳定等待节点；用户继续后会按真实 Git 重新冻结范围。
      this.#holdForScopeConfirmation(taskId, reason);
      // 终止当前恢复分支，禁止继续派给令狐。
      return;
    }
    // 获取令狐的实时占用状态，判断是否需要排队。
    const currentLinghu = requireMember(this.state(), LINGHU_MEMBER_ID);
    // 令狐就是当前任务执行人时不能生成“等待自己完成自己”的循环依赖。
    if (originalId === LINGHU_MEMBER_ID && currentLinghu.currentTaskId === taskId) {
      // 保留同一任务恢复点，交给跨会话故障预算决定后续最多恢复次数。
      this.#holdForLinghuRecovery(taskId, reason);
      // 当前任务已经进入稳定恢复态，不再创建自等待队列节点。
      return;
    }
    // 只有令狐确实在处理另一项任务时，当前任务才进入容量等待队列。
    if (currentLinghu.state !== "idle") {
      this.#store.updateTask(taskId, "execution.repair_queued", (current, state) => {
        if (originalId && originalId !== LINGHU_MEMBER_ID) current.originalExecutor ??= participantSnapshot(requireMember(state, originalId));
        if (originalId && originalId !== LINGHU_MEMBER_ID) releaseMemberFromState(state, originalId);
        current.assignmentId = null;
        current.executorMemberId = null;
        current.taskRevision += 1;
        current.state = "recovering";
        current.phase = "blocked";
        current.repairKind = "execution";
        current.repairFailureReason = reason;
        // 普通技术失败不需要用户重新确认范围。
        current.repairRequiresUserConfirmation = false;
        current.currentHandler = null;
        current.blockingReason = `等待令狐老祖完成当前任务 ${currentLinghu.currentTaskId || "后续故障"} 后接续修复：${reason}`;
        appendFlow(current, "execution.repair_queued", "recovery", "waiting", current.blockingReason, current.initiator, true, {
          failureStage: "execution", failureSummary: reason, technicalEvidence: [reason], originalExecutor: current.originalExecutor,
          routedBy: current.initiator, repairAssignee: participantSnapshot(currentLinghu), waitingForTaskId: currentLinghu.currentTaskId,
        });
      });
      return;
    }
    let repairSession: ExecutorSessionPort | null = null;
    try {
      this.#store.updateTask(taskId, "execution.repair_started", (current, state) => {
        if (originalId) current.originalExecutor ??= participantSnapshot(requireMember(state, originalId));
        if (originalId) releaseMemberFromState(state, originalId);
        const linghu = requireMember(state, LINGHU_MEMBER_ID);
        if (linghu.state !== "idle") throw new Error("令狐老祖人物会话写入状态发生变化，任务将重新排队。");
        linghu.generation += 1;
        linghu.state = "working";
        linghu.role = "executor";
        linghu.phase = "analyzing";
        linghu.currentTaskId = taskId;
        const previousExecution = current.executionRecords.find((item) => item.assignmentId === current.assignmentId);
        if (previousExecution && !previousExecution.completedAt) {
          previousExecution.status = "blocked";
          previousExecution.completedAt = new Date().toISOString();
          previousExecution.blockingReason = reason;
        }
        current.assignmentId = null;
        current.executorMemberId = LINGHU_MEMBER_ID;
        current.taskRevision += 1;
        current.state = "repairing-execution";
        current.phase = "analyzing";
        current.repairKind = "execution";
        current.repairFailureReason = reason;
        // 进入自动调查说明当前失败属于可自动处理的技术问题。
        current.repairRequiresUserConfirmation = false;
        current.currentHandler = participantSnapshot(linghu);
        current.blockingReason = `执行失败：${reason}；令狐老祖正在修复`;
        appendFlow(current, "execution.repair_started", "recovery", "started", current.blockingReason, linghu, false, {
          failureStage: "execution", failureSummary: reason, technicalEvidence: [reason], originalExecutor: current.originalExecutor,
          routedBy: current.initiator, repairAssignee: participantSnapshot(linghu),
        });
      });
      const task = this.#store.task(taskId);
      const repairRevision = task.taskRevision;
      const emitRepairProgress = (event: CodexStreamEventOutDto) => {
        try { this.#assertTaskRevision(taskId, repairRevision); }
        catch { return; }
        this.#emitRepairProgress(taskId, event);
      };
      repairSession = await this.#executor.createTransient(task, requireMember(this.state(), LINGHU_MEMBER_ID));
      this.#assertTaskRevision(taskId, repairRevision);
      const diagnosisText = await repairSession.investigateRepair(task, reason, emitRepairProgress);
      this.#assertTaskRevision(taskId, repairRevision);
      const diagnosis = repairDiagnosis(task, diagnosisText, reason, participantSnapshot(requireMember(this.state(), LINGHU_MEMBER_ID)));
      this.#store.updateTask(taskId, "execution.repair_investigated", (current, state) => {
        current.repairDiagnosis = diagnosis;
        current.phase = "implementing";
        requireMember(state, LINGHU_MEMBER_ID).phase = "implementing";
        current.blockingReason = "令狐老祖已完成失败现场只读调查，正在按调查结论修复";
        appendFlow(current, "execution.repair_investigated", "recovery", "completed", current.blockingReason, requireMember(state, LINGHU_MEMBER_ID), false, flowRepairDetails(current, diagnosis));
      });
      const repaired = await repairSession.executeRepair(this.#store.task(taskId), diagnosis, emitRepairProgress);
      this.#assertTaskRevision(taskId, repairRevision);
      if (repaired.status !== "code-verified") throw new Error(repaired.pendingActions.join("；") || "修复未完成代码验证");
      // 修复通过代码验证仍不等于原需求完成；只读核对当前源码与原验收条件。
      const completionContextJson = JSON.stringify({
        taskRevision: task.taskRevision,
        acceptanceCriteria: task.snapshot.acceptanceCriteria.map((criterion, index) => ({ criterionId: `criterion-${index + 1}`, criterion })),
        diagnosis: {
          failureStage: diagnosis.failureStage,
          failureSummary: diagnosis.failureSummary,
          technicalEvidence: diagnosis.technicalEvidence,
          repairInstruction: diagnosis.repairInstruction,
        },
        repairResult: repaired.text,
        changedFiles: repaired.changedFiles,
        successfulCommands: repaired.successfulCommands,
        pendingActions: repaired.pendingActions,
      });
      const completionText = await repairSession.verifyRepairCompletion(this.#store.task(taskId), completionContextJson, emitRepairProgress);
      this.#assertTaskRevision(taskId, repairRevision);
      const completionLine = completionText.split("\n").find((line) => line.trim().startsWith("REPAIR_COMPLETION="));
      let completion: { complete?: boolean; remaining?: string; evidence?: string } = {};
      try { if (completionLine) completion = JSON.parse(completionLine.trim().slice("REPAIR_COMPLETION=".length)); }
      catch { throw new Error("修复后完成核对结果无法解析，保留恢复点"); }
      if (!completionLine || typeof completion.complete !== "boolean" || !completion.evidence?.trim()
        || typeof completion.remaining !== "string" || completion.complete !== !completion.remaining.trim()) throw new Error("修复后缺少明确完成证据，保留恢复点");
      const remainingWork = completion.remaining;
      if (completion.complete && !completion.remaining.trim()) {
        this.#store.updateTask(taskId, "execution.repair_completed", (current, state) => {
          current.repairResult = repaired.text;
          current.repairKind = null;
          // 修复成功后清除等待确认标记。
          current.repairRequiresUserConfirmation = false;
          current.recoveryTargetState = null;
          current.blockingReason = null;
          appendFlow(current, "execution.repair_completed", "recovery", "completed",
            "令狐修复并核对原任务已完成，提交结果后继续统一测试", requireMember(state, LINGHU_MEMBER_ID),
            false, flowRepairDetails(current, diagnosis, repaired.text));
        });
        await this.#completeVerifiedExecution(taskId, LINGHU_MEMBER_ID, null, repaired);
        return;
      }
      this.#store.updateTask(taskId, "execution.repair_completed", (current, state) => {
        const original = current.originalExecutor;
        current.state = "queued-executor";
        current.executorMemberId = original?.memberId || originalId;
        current.preferredExecutorMemberId = original?.memberId || originalId;
        current.assignmentId = null;
        current.recoveryTargetState = "executing";
        current.repairKind = null;
        // 修复已经完成，后续剩余工作不再继承旧范围等待标记。
        current.repairRequiresUserConfirmation = false;
        current.repairResult = `${repaired.text}\n剩余工作：${completion.remaining}\n核对证据：${completion.evidence}`;
        // 已完成工作不重新派发；续接方案只承载核对确认的剩余工作。
        const resumeText = `仅完成以下尚未完成的工作，不重复已验证修改：\n${completion.remaining}\n核对证据：${completion.evidence}`;
        current.currentPlanVersion += 1;
        current.plans.push({ version: current.currentPlanVersion, ownerMemberId: current.executorMemberId!,
          ownerDisplayName: original?.displayName || "原执行人", status: "ready-for-execution",
          text: resumeText,
          executionBrief: {
            files: repaired.changedFiles,
            steps: [remainingWork],
            verification: current.snapshot.acceptanceCriteria,
            risks: [],
          },
          contentHash: sha256(resumeText), createdAt: new Date().toISOString() });
        current.currentHandler = original || null;
        current.blockingReason = original ? `令狐老祖修复完成，等待${original.displayName}继续剩余工作` : "令狐老祖修复完成，等待原执行人继续剩余工作";
        appendFlow(current, "execution.repair_completed", "recovery", "completed", current.blockingReason, participantSnapshot(requireMember(state, LINGHU_MEMBER_ID)), false, flowRepairDetails(current, diagnosis, repaired.text));
        releaseMemberFromState(state, LINGHU_MEMBER_ID);
      });
    } catch (error) {
      if (error instanceof StaleExecutorLeaseError) return;
      this.#holdForLinghuRecovery(taskId, errorMessage(error));
    } finally {
      await repairSession?.dispose();
      this.#schedule();
    }
  }

  /** 令狐单次修复未完成时保留任务与恢复点；只有用户取消才能结束持续保障。 */
  #holdForLinghuRecovery(taskId: string, detail: string): void {
    this.#store.updateTask(taskId, "execution.repair_waiting", (current, state) => {
      const linghu = requireMember(state, LINGHU_MEMBER_ID);
      const waitingForPermission = requiresHumanAuthorization(detail);
      current.state = "recovering";
      current.phase = "blocked";
      current.executorMemberId = LINGHU_MEMBER_ID;
      current.preferredExecutorMemberId = LINGHU_MEMBER_ID;
      current.assignmentId = null;
      current.recoveryTargetState = "executing";
      current.repairKind = "execution";
      current.repairFailureReason = detail;
      // 本入口只保存普通修复失败；范围确认使用独立入口。
      current.repairRequiresUserConfirmation = false;
      current.currentHandler = participantSnapshot(linghu);
      current.blockingReason = waitingForPermission
        ? `等待用户授权后由令狐老祖从恢复点继续：${detail}`
        : `令狐老祖本次恢复未完成，持续保障仍在运行并等待下一次安全恢复：${detail}`;
      linghu.state = "recovering";
      linghu.role = "executor";
      linghu.phase = "blocked";
      linghu.currentTaskId = taskId;
      linghu.blockingReason = current.blockingReason;
      linghu.updatedAt = new Date().toISOString();
      appendFlow(current, "execution.repair_waiting", "recovery", "waiting", current.blockingReason, linghu, true);
    });
  }

  /** 文件范围不足时停止自动修复，等待用户从同一任务节点确认后继续。 */
  #holdForScopeConfirmation(taskId: string, detail: string): void {
    // 用任务 Store 一次完成任务与人物状态变更，避免出现半更新状态。
    this.#store.updateTask(taskId, "execution.scope_confirmation_required", (current, state) => {
      // 当前执行人已经结束失败会话，可以释放人物去处理其他任务。
      if (current.executorMemberId) releaseMemberFromState(state, current.executorMemberId);
      // 任务进入可恢复状态，已有工作区和代码修改全部保留。
      current.state = "recovering";
      // blocked 阶段让页面明确显示当前不能自动继续。
      current.phase = "blocked";
      // 恢复后仍回到执行步骤，不跳过代码验证。
      current.recoveryTargetState = "executing";
      // 令狐是确认范围后的首选修复人。
      current.executorMemberId = LINGHU_MEMBER_ID;
      // 调度器恢复时继续选择令狐，不随机改派其他人物。
      current.preferredExecutorMemberId = LINGHU_MEMBER_ID;
      // 当前没有人物正在处理，避免界面显示虚假的活动负责人。
      current.currentHandler = null;
      // 保留执行修复类型，用户继续后仍沿原任务恢复。
      current.repairKind = "execution";
      // 保存原始范围冲突，恢复预算和页面都引用同一事实。
      current.repairFailureReason = detail;
      // 结构化标记阻止自动调度器和令狐巡检自行恢复。
      current.repairRequiresUserConfirmation = true;
      // 给用户说明为什么停止，以及继续后会发生什么。
      current.blockingReason = `需要用户重新确认本次真实文件范围后继续：${detail}`;
      // 时间线复用既有等待事件，界面无需认识新的临时状态类型。
      appendFlow(current, "execution.repair_waiting", "recovery", "waiting", current.blockingReason, current.initiator, true, {
        // 失败阶段明确为执行范围核对。
        failureStage: "scope-confirmation",
        // 完整保留原始范围冲突。
        failureSummary: detail,
        // 技术证据至少包含同一条确定性门禁结果。
        technicalEvidence: [detail],
        // 保存原执行人，方便用户继续后审计负责人变化。
        originalExecutor: current.originalExecutor,
        // 发起人物负责把等待事实展示给客户。
        routedBy: current.initiator,
        // 用户确认后仍由令狐完成本次修复。
        repairAssignee: participantSnapshot(requireMember(state, LINGHU_MEMBER_ID)),
      });
    });
  }

  #setTaskAndMemberPhase(taskId: string, stateValue: CollaborationTaskOutDto["state"], phase: Exclude<CollaborationWorkerPhaseValue, null>): void {
    this.#store.updateTask(taskId, "worker.phase_changed", (task, state) => {
      const phaseChanged = task.phase !== phase;
      task.state = stateValue;
      task.phase = phase;
      if (task.executorMemberId) {
        const member = requireMember(state, task.executorMemberId);
        member.state = "working";
        member.phase = phase;
        member.blockingReason = null;
        member.updatedAt = new Date().toISOString();
        const execution = task.executionRecords.find((item) => item.assignmentId === task.assignmentId);
        if (execution) execution.status = phase === "analyzing" || phase === "planning" ? "analyzing" : "executing";
        if (phaseChanged) appendFlow(task, `worker.phase.${phase}`, phase === "analyzing" || phase === "planning" ? "analysis" : "execution", "started", `${member.displayName}${phaseLabel(phase)}`, member);
      }
    });
  }

  async #retireExecutor(taskId: string, memberId: string): Promise<void> {
    this.#stopHeartbeat(`executor:${taskId}`);
    this.#lastProgressWriteMs.delete(`${taskId}:${memberId}`);
    markMemberRetiring(this.#store, memberId);
    try { await this.#executor.close(taskId); }
    catch (error) { this.#durations.instant(taskId, "executor.retirement_failed", { memberId, error: errorMessage(error) }); }
    finally { releaseMember(this.#store, memberId); }
  }

  async #blockTask(taskId: string, reason: string): Promise<void> {
    const task = this.#store.task(taskId);
    this.#stopHeartbeat(`executor:${taskId}`);
    try { await this.#executor.close(taskId); }
    catch (error) { this.#durations.instant(taskId, "blocked_executor.retirement_failed", { error: errorMessage(error) }); }
    if (["cancelled", "integrated"].includes(this.#store.task(taskId).state)) return;
    this.#store.updateTask(taskId, "task.blocked", (current, state) => {
      current.state = "blocked";
      current.phase = "blocked";
      current.blockingReason = reason.slice(0, 2_000);
      current.recoveryTargetState = task.state;
      for (const member of state.members.filter((candidate) => candidate.currentTaskId === taskId)) {
        member.state = member.state === "draining" ? "draining" : "idle";
        member.role = null;
        member.phase = null;
        member.currentTaskId = null;
        member.blockingReason = null;
      }
      const execution = current.executionRecords.find((item) => item.assignmentId === current.assignmentId);
      if (execution) {
        execution.status = "blocked";
        execution.completedAt = new Date().toISOString();
        execution.blockingReason = current.blockingReason;
      }
      current.resultSummary = current.resultSummary || createCollaborationResultSummary(current, current.finalResult || "任务尚未完成。", [current.blockingReason]);
      current.resultSummary.outcome = "incomplete";
      current.resultSummary.success = false;
      current.resultSummary.remaining = current.blockingReason;
      appendFlow(current, "task.blocked", "recovery", "failed", current.blockingReason, current.currentHandler || execution?.executor || null, true);
    });
    this.#durations.instant(taskId, "task.blocked", { reason, executorMemberId: task.executorMemberId });
  }

  #startHeartbeat(key: string, taskId: string, memberId: string, session: { isAlive(): boolean }): void {
    this.#stopHeartbeat(key);
    const beat = () => {
      if (!session.isAlive()) return;
      if (this.state().members.find((member) => member.memberId === memberId)?.currentTaskId !== taskId) return;
      this.#store.updateTask(taskId, "member.heartbeat", (_task, state) => {
        const member = requireMember(state, memberId);
        member.lastHeartbeatAt = new Date().toISOString();
        member.updatedAt = member.lastHeartbeatAt;
      });
    };
    beat();
    this.#heartbeatTimers.set(key, setInterval(beat, 15_000));
  }

  #stopHeartbeat(key: string): void {
    const timer = this.#heartbeatTimers.get(key);
    if (timer) clearInterval(timer);
    this.#heartbeatTimers.delete(key);
  }

  /** 调查与修复都把真实模型活动写回当前处理人，避免仍使用原执行人的旧心跳。 */
  #emitRepairProgress(taskId: string, event: CodexStreamEventOutDto): void {
    this.#touchProtocolProgress(taskId, LINGHU_MEMBER_ID);
    this.#emitStream(taskId, LINGHU_MEMBER_ID, event);
  }

  #touchProtocolProgress(taskId: string, memberId: string): void {
    if (this.state().members.find((member) => member.memberId === memberId)?.currentTaskId !== taskId) return;
    const key = `${taskId}:${memberId}`;
    const nowMs = Date.now();
    if (nowMs - (this.#lastProgressWriteMs.get(key) || 0) < 2_000) return;
    this.#lastProgressWriteMs.set(key, nowMs);
    this.#store.updateTask(taskId, "member.protocol_progress", (_task, state) => {
      const member = requireMember(state, memberId);
      member.lastProtocolProgressAt = new Date(nowMs).toISOString();
      member.updatedAt = member.lastProtocolProgressAt;
    });
  }

  #assertExecutorLease(taskId: string, memberId: string, assignmentId: string | null, workerGeneration: number): void {
    if (!this.#hasExecutorLease(taskId, memberId, assignmentId, workerGeneration)) {
      throw new StaleExecutorLeaseError();
    }
  }

  /** 初始化、分析与实施共用同一租约事实，任何阶段都不得把旧代次结果写回当前任务。 */
  #hasExecutorLease(taskId: string, memberId: string, assignmentId: string | null, workerGeneration: number): boolean {
    const current = this.#store.task(taskId);
    const member = requireMember(this.state(), memberId);
    return Boolean(assignmentId)
      && current.assignmentId === assignmentId
      && current.workerGeneration === workerGeneration
      && current.executorMemberId === memberId
      && member.generation === workerGeneration
      && member.currentTaskId === taskId;
  }

  #assertTaskRevision(taskId: string, taskRevision: number): void {
    if (this.#store.task(taskId).taskRevision !== taskRevision) throw new StaleExecutorLeaseError();
  }
}

/** 范围修订或重新分配后，迟到的旧执行只结束自身，不进入故障修复。 */
class StaleExecutorLeaseError extends Error {
  constructor() {
    super("执行结果来自已经过期的任务租约，已拒绝写入。");
    this.name = "StaleExecutorLeaseError";
  }
}

function fairIdleMembers(members: CollaborationMemberOutDto[]): CollaborationMemberOutDto[] {
  return members.map((member) => ({ member, tieBreaker: Math.random() })).sort((left, right) => {
    const leftTime = left.member.lastAssignedAt ? Date.parse(left.member.lastAssignedAt) : 0;
    const rightTime = right.member.lastAssignedAt ? Date.parse(right.member.lastAssignedAt) : 0;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.tieBreaker - right.tieBreaker;
  }).map((entry) => entry.member);
}

function requireMember(state: CollaborationStateOutDto, memberId: string): CollaborationMemberOutDto {
  const member = state.members.find((candidate) => candidate.memberId === memberId);
  if (!member) throw new Error("协同人物不存在。");
  return member;
}

function participantSnapshot(member: Pick<CollaborationMemberOutDto, "memberId" | "displayName">): { memberId: string; displayName: string } {
  return { memberId: member.memberId, displayName: member.displayName };
}

/** 执行记录只保留可展示的源码相对路径快照，缓存、构建、归档和依赖目录不进入长期业务记录。 */
function normalizeChangedFiles(files: string[]): string[] {
  const excluded = /^(?:node_modules|cache|build|log|OPTION\/temp)(?:\/|$)/i;
  return [...new Set(files
    .map((file) => String(file).trim().replaceAll("\\", "/").replace(/^\.\//, ""))
    .filter((file) => file && file.length <= 500 && !file.includes("../") && !excluded.test(file)))]
    .slice(0, 500);
}

/** 从技术分析末尾提取执行包；带南宫婉交接的任务缺失结构化结果时必须停止，避免靠长正文猜测。 */
function parseExecutionBrief(text: string, task: CollaborationTaskOutDto): CollaborationRequirementPlanOutDto["executionBrief"] {
  const marker = text.split("\n").find((line) => line.trim().startsWith("EXECUTION_BRIEF="));
  if (marker) {
    try {
      const value = JSON.parse(marker.trim().slice("EXECUTION_BRIEF=".length)) as Record<string, unknown>;
      const files = normalizeStringList(value.files);
      const steps = normalizeStringList(value.steps);
      const verification = normalizeStringList(value.verification);
      const risks = normalizeStringList(value.risks);
      if (steps.length > 0 && verification.length > 0) return { files, steps, verification, risks };
    } catch {
      // 统一走下面的结构化错误，不能把格式错误降级成长正文重复传输。
    }
  }
  if (task.snapshot.investigationHandoff) throw new Error("执行人物技术分析缺少有效 EXECUTION_BRIEF，已停止进入执行阶段。");
  return {
    files: [],
    steps: ["执行当前会话中已经完成并冻结的技术分析；无法定位时停止并报告。"],
    verification: task.snapshot.acceptanceCriteria.length > 0 ? task.snapshot.acceptanceCriteria : ["完成已确认任务并报告验证事实"],
    risks: [],
  };
}

/** 结构化模型数组只接收非空短文本，防止异常对象或超长正文进入后续提示。 */
function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].map((item) => item.slice(0, 2_000)).slice(0, 100)
    : [];
}

/** 流程事件只记录可审计业务事实，不复制原始推理或认证信息。 */
function appendFlow(
  task: CollaborationTaskOutDto,
  type: CollaborationTaskOutDto["flowEvents"][number]["type"],
  stage: CollaborationTaskOutDto["flowEvents"][number]["stage"],
  status: CollaborationTaskOutDto["flowEvents"][number]["status"],
  summary: string,
  actor: Pick<CollaborationMemberOutDto, "memberId" | "displayName"> | { memberId: string; displayName: string } | null,
  error = false,
  details: CollaborationFlowEventDetailsOutDto | null = null,
): void {
  task.flowEvents.push({
    eventId: randomUUID(),
    type,
    stage,
    status,
    actor: actor ? participantSnapshot(actor) : null,
    summary: summary.slice(0, 2_000),
    occurredAt: new Date().toISOString(),
    error,
    details,
  });
}

function repairDiagnosis(
  task: CollaborationTaskOutDto,
  repairInstruction: string,
  failureSummary: string,
  diagnosedBy: CollaborationParticipantSnapshotOutDto,
): CollaborationRepairDiagnosisOutDto {
  return {
    diagnosedAt: new Date().toISOString(), diagnosedBy, failureStage: task.integrationFailure?.phase || task.phase || "execution",
    failureSummary, technicalEvidence: [task.integrationFailure?.detail, task.repairFailureReason, task.blockingReason].filter((value): value is string => Boolean(value)),
    repairInstruction, originalExecutor: task.originalExecutor || null,
  };
}

function flowRepairDetails(task: CollaborationTaskOutDto, diagnosis: CollaborationRepairDiagnosisOutDto, repairResult?: string): CollaborationFlowEventDetailsOutDto {
  return {
    failureStage: diagnosis.failureStage, failureSummary: diagnosis.failureSummary, technicalEvidence: diagnosis.technicalEvidence,
    originalExecutor: diagnosis.originalExecutor, routedBy: task.initiator, repairAssignee: diagnosis.diagnosedBy,
    repairDiagnosis: diagnosis.repairInstruction, repairResult, returnToExecutor: repairResult ? diagnosis.originalExecutor : null,
  };
}

function phaseLabel(phase: Exclude<CollaborationWorkerPhaseValue, null>): string {
  const labels: Record<Exclude<CollaborationWorkerPhaseValue, null>, string> = {
    analyzing: "正在分析需求",
    planning: "正在整理方案",
    implementing: "正在执行修改",
    verifying: "正在验证修改",
    finalizing: "正在整理结果",
    ready: "已准备集成",
    blocked: "执行被阻塞",
    failed: "执行失败",
  };
  return labels[phase];
}

function markMemberRetiring(store: CollaborationStore, memberId: string): void {
  const member = store.state().members.find((candidate) => candidate.memberId === memberId);
  if (!member?.currentTaskId) return;
  store.updateTask(member.currentTaskId, "member.retiring", (_task, state) => {
    const target = requireMember(state, memberId);
    target.state = "retiring";
    target.phase = null;
    target.blockingReason = "正在保存结果并关闭临时 Codex";
  });
}

function releaseMember(store: CollaborationStore, memberId: string): void {
  const member = store.state().members.find((candidate) => candidate.memberId === memberId);
  if (!member?.currentTaskId) return;
  store.updateTask(member.currentTaskId, "member.released", (_task, state) => {
    const target = requireMember(state, memberId);
    target.state = "idle";
    target.role = null;
    target.phase = null;
    target.currentTaskId = null;
    target.blockingReason = null;
    target.updatedAt = new Date().toISOString();
  });
}

/** 同一原子状态变更内释放人物，避免嵌套提交覆盖当前任务刚写入的恢复事实。 */
function releaseMemberFromState(state: CollaborationStateOutDto, memberId: string): void {
  const target = state.members.find((candidate) => candidate.memberId === memberId);
  if (!target) return;
  target.state = "idle";
  target.role = null;
  target.phase = null;
  target.currentTaskId = null;
  target.blockingReason = null;
  target.updatedAt = new Date().toISOString();
}

function phaseFromStreamEvent(event: CodexStreamEventOutDto): Exclude<CollaborationWorkerPhaseValue, null> | null {
  if (event.type === "managed-execution" && event.managedExecution?.stage === "code-validation") return "verifying";
  if (event.type === "managed-execution" && event.managedExecution?.stage === "interaction-validation") return "verifying";
  if (event.type === "activity" && event.activity?.itemType === "fileChange") return "implementing";
  return null;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 保存前重建指导证据，避免调用方在分析完成后写入与当前卡点无关的入口。 */
function customerActionGuidanceEvidence(task: CollaborationTaskOutDto): CollaborationCustomerActionGuidanceEvidence {
  const failure = task.integrationFailure;
  return {
    affectedFiles: failure?.conflictFiles || [],
    nonFileRecovery: failure?.capacity
      ? {
        capacity: failure.capacity,
        recoveryAction: failure.recoveryAction || null,
        detail: failure.detail || null,
        summary: failure.summary || null,
      }
      : null,
  };
}

/** 权限类失败必须等待真实用户授权，禁止自动循环反复弹出同一审批框。 */
function requiresHumanAuthorization(detail: string): boolean {
  return /(?:等待|需要|请求).{0,12}(?:用户|人工).{0,8}(?:授权|批准)|command execution|approval|permission|operation not permitted|\bEPERM\b/iu.test(detail);
}
