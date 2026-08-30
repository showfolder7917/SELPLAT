import { createHash, randomUUID } from "node:crypto";

import type {
  CollaborationMember,
  CollaborationParticipantSnapshot,
  CollaborationFlowEventDetails,
  CollaborationRepairDiagnosis,
  CollaborationRequirementPlan,
  CollaborationState,
  CollaborationTask,
  CollaborationWorkerPhase,
  CreateCollaborationMemberRequest,
  DesktopOperatingMode,
  SubmitCollaborationTaskRequest,
  UpdateCollaborationMemberRequest,
} from "../../../contracts/collaboration/collaboration.js";
import type { CodexStreamEvent } from "../../../contracts/desktop/desktop.js";
import { CollaborationDurationLog } from "./collaboration-duration-log.js";
import { CollaborationStore } from "./collaboration-store.js";
import { VersionWorkspaceManager } from "./version-workspace-manager.js";
import { VersionIntegrationPipeline } from "./version-integration-pipeline.js";
import { createCollaborationResultSummary } from "./result/result-summary.js";

const LINGHU_MEMBER_ID = "linghu-ancestor";
const ORCHESTRATOR_MEMBER_IDS = new Set(["nangong-wan", LINGHU_MEMBER_ID]);

export interface CollaborationExecutionResult {
  status: "code-verified" | "incomplete";
  text: string;
  pendingActions: string[];
  changedFiles: string[];
  successfulCommands: string[];
}

export interface CollaborationExecutorSession {
  isAlive(): boolean;
  analyze(task: CollaborationTask, emit: (event: CodexStreamEvent) => void): Promise<string>;
  optimize(task: CollaborationTask, feedback: string, emit: (event: CodexStreamEvent) => void): Promise<string>;
  execute(task: CollaborationTask, plan: CollaborationRequirementPlan, emit: (event: CodexStreamEvent) => void): Promise<CollaborationExecutionResult>;
  investigateRepair(task: CollaborationTask, failure: string, emit: (event: CodexStreamEvent) => void): Promise<string>;
  executeRepair(task: CollaborationTask, diagnosis: CollaborationRepairDiagnosis, emit: (event: CodexStreamEvent) => void): Promise<CollaborationExecutionResult>;
  dispose(): Promise<void> | void;
}

export interface CollaborationSessionFactory {
  createExecutor(task: CollaborationTask, member: CollaborationMember): Promise<CollaborationExecutorSession>;
}

export interface CollaborationCoordinatorOptions {
  store: CollaborationStore;
  durations: CollaborationDurationLog;
  workspaces: VersionWorkspaceManager;
  sessions: CollaborationSessionFactory;
  integrationPipeline: VersionIntegrationPipeline;
  emitState(state: CollaborationState, reason: string, taskIds: string[]): void;
  emitStream(taskId: string, memberId: string, event: CodexStreamEvent): void;
}

/** 编排执行人的技术分析、实施、令狐验证和集成，业务方向审批由韩立专题线路负责。 */
export class CollaborationCoordinator {
  readonly #store: CollaborationStore;
  readonly #durations: CollaborationDurationLog;
  readonly #workspaces: VersionWorkspaceManager;
  readonly #sessions: CollaborationSessionFactory;
  readonly #integrationPipeline: VersionIntegrationPipeline;
  readonly #emitStream: CollaborationCoordinatorOptions["emitStream"];
  readonly #executorSessions = new Map<string, CollaborationExecutorSession>();
  readonly #activeTaskRuns = new Set<string>();
  readonly #unifiedTestRepairRuns = new Map<string, Promise<boolean>>();
  readonly #waitSpans = new Map<string, string>();
  readonly #heartbeatTimers = new Map<string, ReturnType<typeof setInterval>>();
  readonly #lastProgressWriteMs = new Map<string, number>();
  readonly #unsubscribeStore: () => void;
  #disposed = false;

  constructor(options: CollaborationCoordinatorOptions) {
    this.#store = options.store;
    this.#durations = options.durations;
    this.#workspaces = options.workspaces;
    this.#sessions = options.sessions;
    this.#integrationPipeline = options.integrationPipeline;
    this.#emitStream = options.emitStream;
    this.#unsubscribeStore = this.#store.subscribe((state, reason, taskIds) => {
      options.emitState(state, reason, taskIds);
      // 在途任务的统一测试失败属于协作主流程安全兜底，不依赖令狐“主动巡检”总开关。
      this.#scheduleUnifiedTestRepairs(state);
    });
    this.#scheduleUnifiedTestRepairs(this.#store.state());
  }

  state(): CollaborationState { return this.#store.state(); }
  setMode(mode: DesktopOperatingMode): CollaborationState { return this.#store.setMode(mode); }
  selectMember(memberId: string): CollaborationState { return this.#store.selectMember(memberId); }
  createMember(request: CreateCollaborationMemberRequest): CollaborationState { return this.#store.createMember(request); }
  updateMember(memberId: string, request: UpdateCollaborationMemberRequest): CollaborationState { return this.#store.updateMember(memberId, request); }
  deleteMember(memberId: string): CollaborationState { return this.#store.deleteMember(memberId); }

  submitTask(request: SubmitCollaborationTaskRequest): CollaborationState {
    const enabledWorkers = this.state().members.filter((member) => member.kind === "worker" && member.enabled).length;
    if (enabledWorkers < 1) throw new Error("协同执行至少需要一名已启用的执行人物。");
    const task = this.#store.submitTask(request);
    this.#waitSpans.set(task.taskId, this.#durations.startWait(task.taskId, "executor-queue", "system-wait", "no-idle-executor", "executor-capacity", null));
    this.#schedule();
    return this.state();
  }

  continueTask(taskId: string, recoveryActor?: Pick<CollaborationMember, "memberId" | "displayName">): CollaborationState {
    const state = this.#store.continueTask(taskId, recoveryActor);
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

  /**
   * 统一测试已经提供了确定失败证据时，由令狐在原任务工作树内完成最小修正并生成新的结果版本。
   * 该入口接受 verification 与已结构化的 infrastructure 失败；不处理人工选择、工作区归属或 Git 冲突。
   */
  async repairFailedUnifiedTest(taskId: string): Promise<boolean> {
    const existing = this.#unifiedTestRepairRuns.get(taskId);
    if (existing) return existing;
    const run = this.#repairFailedUnifiedTest(taskId).finally(() => this.#unifiedTestRepairRuns.delete(taskId));
    this.#unifiedTestRepairRuns.set(taskId, run);
    return run;
  }

  async #repairFailedUnifiedTest(taskId: string): Promise<boolean> {
    const failedTask = this.#store.task(taskId);
    const repairableFailure = failedTask.integrationFailure?.kind === "verification" || failedTask.integrationFailure?.kind === "infrastructure";
    if (!repairableFailure || !["test-failed", "blocked"].includes(failedTask.state)) return false;
    const originalFailureKind = failedTask.integrationFailure!.kind;
    const linghu = requireMember(this.state(), LINGHU_MEMBER_ID);
    if (linghu.state !== "idle") return false;

    const originalReason = failedTask.blockingReason || failedTask.integrationFailure.detail;
    let repairSession: CollaborationExecutorSession | null = null;
    try {
      this.#store.updateTask(taskId, "unified_test.repair_started", (current, state) => {
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
        current.blockingReason = `${handler.displayName}正在依据${originalFailureKind === "infrastructure" ? "发布基础设施" : "统一测试"}失败证据调查并修复真实故障`;
        appendFlow(current, "unified_test.repair_started", "recovery", "started", current.blockingReason, handler, false, {
          failureStage: current.integrationFailure?.phase || "verification", failureSummary: originalReason,
          technicalEvidence: [current.integrationFailure?.detail || originalReason], originalExecutor: current.originalExecutor,
          routedBy: current.initiator, repairAssignee: participantSnapshot(handler),
        });
      });

      const task = this.#store.task(taskId);
      repairSession = await this.#sessions.createExecutor(task, requireMember(this.state(), LINGHU_MEMBER_ID));
      const diagnosisText = await repairSession.investigateRepair(task, task.integrationFailure?.detail || originalReason, (event) => this.#emitStream(taskId, LINGHU_MEMBER_ID, event));
      const diagnosis = repairDiagnosis(task, diagnosisText, originalReason, participantSnapshot(requireMember(this.state(), LINGHU_MEMBER_ID)));
      this.#store.updateTask(taskId, "unified_test.repair_investigated", (current, state) => {
        current.repairDiagnosis = diagnosis;
        current.phase = "implementing";
        requireMember(state, LINGHU_MEMBER_ID).phase = "implementing";
        current.blockingReason = "令狐老祖已完成失败候选只读调查，正在按调查结论修复";
        appendFlow(current, "unified_test.repair_investigated", "recovery", "completed", current.blockingReason, requireMember(state, LINGHU_MEMBER_ID), false, flowRepairDetails(current, diagnosis));
      });
      const repaired = await repairSession.executeRepair(this.#store.task(taskId), diagnosis, (event) => this.#emitStream(taskId, LINGHU_MEMBER_ID, event));
      if (repaired.status !== "code-verified") throw new Error(repaired.pendingActions.join("；") || "统一测试修复未完成代码级验证");
      const resultSha = await this.#workspaces.commitTaskResult(this.#store.task(taskId), linghu.displayName);
      this.#store.updateTask(taskId, "unified_test.repair_completed", (current, state) => {
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
        appendFlow(current, "unified_test.repair_completed", "recovery", "completed", "令狐老祖已完成失败项修复并生成新结果版本，等待重新统一测试", requireMember(state, LINGHU_MEMBER_ID), false, flowRepairDetails(current, diagnosis, repaired.text));
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
      // 修复失败保留原始测试故障指纹，让自动保障的三次上限能够真实限制重复副作用。
      this.#store.updateTask(taskId, "unified_test.repair_failed", (current, state) => {
        current.state = originalFailureKind === "infrastructure" ? "blocked" : "test-failed";
        current.phase = null;
        current.repairKind = null;
        current.repairFailureReason = errorMessage(error);
        current.blockingReason = originalReason;
        appendFlow(current, "unified_test.repair_failed", "recovery", "failed", `令狐老祖修复统一测试失败：${errorMessage(error)}`, participantSnapshot(requireMember(state, LINGHU_MEMBER_ID)), true);
        releaseMemberFromState(state, LINGHU_MEMBER_ID);
      });
      return true;
    } finally {
      await repairSession?.dispose();
      this.#schedule();
    }
  }

  /** 把已由自动保障确认的停点转换为可审计恢复态，并立即建立新的执行或集成租约。 */
  async recoverTask(taskId: string, reason: string): Promise<CollaborationState> {
    const task = this.#store.task(taskId);
    if (task.state !== "blocked" && task.state !== "recovering") await this.#blockTask(taskId, reason);
    return this.continueTask(taskId);
  }

  async cancelTask(taskId: string): Promise<CollaborationState> {
    const task = this.#store.task(taskId);
    const session = this.#executorSessions.get(taskId);
    this.#executorSessions.delete(taskId);
    this.#stopHeartbeat(`executor:${taskId}`);
    if (task.executorMemberId) this.#lastProgressWriteMs.delete(`${taskId}:${task.executorMemberId}`);
    const state = this.#store.cancelTask(taskId);
    await session?.dispose();
    const waitSpan = this.#waitSpans.get(taskId);
    if (waitSpan) this.#durations.finish(waitSpan, "interrupted", { releaseEvent: "task.cancelled" });
    this.#waitSpans.delete(taskId);
    this.#integrationPipeline.finishWaitingTask(taskId, "interrupted", { releaseEvent: "task.cancelled" });
    return state;
  }

  resumePendingWork(): void {
    this.#schedule();
  }

  confirmPublishedRestart(): number[] { return this.#integrationPipeline.confirmPublishedRestart(); }

  /** 南宫婉确认同一演化轮全部结果已返回后，才把不可拆分的完整批次交给令狐。 */
  sealEvolutionRound(proposalId: string, taskIds: string[]): CollaborationState {
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
    await Promise.allSettled([...this.#executorSessions.values()].map((session) => session.dispose()));
    this.#executorSessions.clear();
    for (const timer of this.#heartbeatTimers.values()) clearInterval(timer);
    this.#heartbeatTimers.clear();
  }

  /** 只为已有确定验证失败的在途任务排队修复；容量释放后的任意状态更新都会再次尝试。 */
  #scheduleUnifiedTestRepairs(state: CollaborationState): void {
    if (this.#disposed || state.mode !== "collaboration") return;
    const linghu = state.members.find((member) => member.memberId === LINGHU_MEMBER_ID);
    if (!linghu || linghu.state !== "idle") return;
    const task = state.tasks.find((candidate) => candidate.state === "test-failed" && candidate.integrationFailure?.kind === "verification");
    if (!task || this.#unifiedTestRepairRuns.has(task.taskId)) return;
    queueMicrotask(() => {
      if (!this.#disposed) void this.repairFailedUnifiedTest(task.taskId);
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

  #scheduleExecutors(): void {
    const state = this.state();
    const allWorkers = state.members.filter((member) => member.kind === "worker" && member.enabled && member.state !== "draining" && member.state !== "offline");
    const workers = allWorkers.filter((member) => !ORCHESTRATOR_MEMBER_IDS.has(member.memberId));
    const activeExecutors = workers.filter((member) => member.role === "executor" && member.currentTaskId).length;
    const executorCapacity = Math.max(0, workers.length - activeExecutors);
    if (executorCapacity === 0) return;
    const queued = state.tasks.filter((task) => task.state === "queued-executor").slice(0, executorCapacity);
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
    this.#activeTaskRuns.add(taskId);
    const queueSpan = this.#waitSpans.get(taskId);
    if (queueSpan) this.#durations.finish(queueSpan, "completed", { releaseEvent: "executor.assigned", memberId });
    this.#waitSpans.delete(taskId);
    let startupSpan: string | null = null;
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
      const worktreeSpan = this.#durations.start(taskId, "worktree-prepare", { memberId });
      try {
        const workspace = assignedTask.versionWorkspace
          ? await this.#workspaces.resumeTask(assignedTask)
          : await this.#workspaces.prepareTask(assignedTask, memberId);
        this.#store.updateTask(taskId, assignedTask.versionWorkspace ? "version_workspace.resumed" : "version_workspace.ready", (task) => { task.versionWorkspace = workspace; });
        this.#durations.finish(worktreeSpan, "completed", { branchName: workspace.branchName, resumed: Boolean(assignedTask.versionWorkspace) });
      } catch (error) {
        this.#durations.finish(worktreeSpan, "failed", { error: errorMessage(error) });
        throw error;
      }
      const task = this.#store.task(taskId);
      const member = requireMember(this.state(), memberId);
      startupSpan = this.#durations.start(taskId, "codex-startup", { memberId, role: "executor", generation: member.generation });
      const session = await this.#sessions.createExecutor(task, member);
      this.#executorSessions.set(taskId, session);
      this.#startHeartbeat(`executor:${taskId}`, taskId, memberId, session);
      this.#durations.finish(startupSpan, "completed", { releaseEvent: "executor.codex.ready" });
      startupSpan = null;
      await this.#resumeOrAnalyze(taskId, session);
    } catch (error) {
      if (startupSpan) this.#durations.finish(startupSpan, "failed", { error: errorMessage(error) });
      if (this.#store.task(taskId).state === "cancelled") return;
      await this.#blockTask(taskId, `执行人初始化失败：${errorMessage(error)}`);
    } finally {
      this.#activeTaskRuns.delete(taskId);
      this.#schedule();
    }
  }

  async #analyze(taskId: string, session: CollaborationExecutorSession): Promise<void> {
    const task = this.#store.task(taskId);
    const memberId = task.executorMemberId;
    if (!memberId) throw new Error("任务缺少执行人。");
    const assignmentId = task.assignmentId;
    const workerGeneration = task.workerGeneration;
    const segment = "analysis";
    const span = this.#durations.start(taskId, segment, { memberId, planVersion: task.currentPlanVersion + 1 });
    this.#setTaskAndMemberPhase(taskId, "analyzing", "analyzing");
    try {
      const emit = (event: CodexStreamEvent) => {
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
      const text = await session.analyze(task, emit);
      this.#assertExecutorLease(taskId, memberId, assignmentId, workerGeneration);
      const plan: CollaborationRequirementPlan = {
        version: task.currentPlanVersion + 1,
        ownerMemberId: memberId,
        ownerDisplayName: requireMember(this.state(), memberId).displayName,
        status: "ready-for-execution",
        text,
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

  async #resumeOrAnalyze(taskId: string, session: CollaborationExecutorSession): Promise<void> {
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
    await this.#analyze(taskId, session);
  }

  async #execute(taskId: string): Promise<void> {
    const task = this.#store.task(taskId);
    const memberId = task.executorMemberId;
    const session = this.#executorSessions.get(taskId);
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
      const result = await session.execute(task, plan, (event) => {
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
        const phase = phaseFromStreamEvent(event);
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
        return this.#repairFailedExecution(taskId, result.pendingActions.join("；") || "任务托管未完成代码验证");
      }
      if (changeSpan) this.#durations.finish(changeSpan, "completed", { releaseEvent: "task.code_verified" });
      if (verificationSpan) this.#durations.finish(verificationSpan, "completed", { releaseEvent: "task.code_verified" });
      changeSpan = null;
      verificationSpan = null;
      this.#setTaskAndMemberPhase(taskId, "executing", "finalizing");
      const resultSha = await this.#workspaces.commitTaskResult(this.#store.task(taskId), requireMember(this.state(), memberId).displayName);
      this.#store.updateTask(taskId, "task.integration_ready", (current, state) => {
        if (!current.versionWorkspace) throw new Error("任务缺少版本工作区。");
        current.versionWorkspace.resultSha = resultSha;
        const returnsToNangong = Boolean(current.evolutionProposalId && current.evolutionRoundId);
        current.state = returnsToNangong ? "returned-to-nangong" : "ready-for-integration";
        current.phase = "ready";
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
        appendFlow(current, "task.code_verified", "execution", "completed", returnsToNangong ? "执行修改已完成代码级验证，结果已返回南宫婉收集" : "执行修改已完成代码级验证，等待集成", execution?.executor || null);
      });
      this.#durations.instant(taskId, "task.integration_ready", { memberId, resultSha });
      await this.#retireExecutor(taskId, memberId, session);
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
    } catch (error) {
      if (changeSpan) this.#durations.finish(changeSpan, "failed", { error: errorMessage(error) });
      if (verificationSpan) this.#durations.finish(verificationSpan, "failed", { error: errorMessage(error) });
      if (this.#store.task(taskId).state === "cancelled") return;
      await this.#repairFailedExecution(taskId, `执行失败：${errorMessage(error)}`);
    }
  }

  async #repairFailedExecution(taskId: string, reason: string): Promise<void> {
    const failedTask = this.#store.task(taskId);
    const originalId = failedTask.executorMemberId;
    const originalSession = this.#executorSessions.get(taskId);
    this.#executorSessions.delete(taskId);
    await originalSession?.dispose();
    let repairSession: CollaborationExecutorSession | null = null;
    try {
      this.#store.updateTask(taskId, "execution.repair_started", (current, state) => {
        if (originalId) current.originalExecutor ??= participantSnapshot(requireMember(state, originalId));
        if (originalId) releaseMemberFromState(state, originalId);
        const linghu = requireMember(state, LINGHU_MEMBER_ID);
        if (linghu.state !== "idle") throw new Error("令狐老祖当前正在处理其他任务。");
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
        current.currentHandler = participantSnapshot(linghu);
        current.blockingReason = `执行失败：${reason}；令狐老祖正在修复`;
        appendFlow(current, "execution.repair_started", "recovery", "started", current.blockingReason, linghu, false, {
          failureStage: "execution", failureSummary: reason, technicalEvidence: [reason], originalExecutor: current.originalExecutor,
          routedBy: current.initiator, repairAssignee: participantSnapshot(linghu),
        });
      });
      const task = this.#store.task(taskId);
      repairSession = await this.#sessions.createExecutor(task, requireMember(this.state(), LINGHU_MEMBER_ID));
      const diagnosisText = await repairSession.investigateRepair(task, reason, (event) => this.#emitStream(taskId, LINGHU_MEMBER_ID, event));
      const diagnosis = repairDiagnosis(task, diagnosisText, reason, participantSnapshot(requireMember(this.state(), LINGHU_MEMBER_ID)));
      this.#store.updateTask(taskId, "execution.repair_investigated", (current, state) => {
        current.repairDiagnosis = diagnosis;
        current.phase = "implementing";
        requireMember(state, LINGHU_MEMBER_ID).phase = "implementing";
        current.blockingReason = "令狐老祖已完成失败现场只读调查，正在按调查结论修复";
        appendFlow(current, "execution.repair_investigated", "recovery", "completed", current.blockingReason, requireMember(state, LINGHU_MEMBER_ID), false, flowRepairDetails(current, diagnosis));
      });
      const repaired = await repairSession.executeRepair(this.#store.task(taskId), diagnosis, (event) => this.#emitStream(taskId, LINGHU_MEMBER_ID, event));
      if (repaired.status !== "code-verified") throw new Error(repaired.pendingActions.join("；") || "修复未完成代码验证");
      this.#store.updateTask(taskId, "execution.repair_completed", (current, state) => {
        const original = current.originalExecutor;
        current.state = "queued-executor";
        current.executorMemberId = original?.memberId || originalId;
        current.preferredExecutorMemberId = original?.memberId || originalId;
        current.assignmentId = null;
        current.recoveryTargetState = "executing";
        current.repairKind = null;
        current.repairResult = repaired.text;
        current.currentHandler = original || null;
        current.blockingReason = original ? `令狐老祖修复完成，等待${original.displayName}重新执行` : "令狐老祖修复完成，等待原执行人重新执行";
        appendFlow(current, "execution.repair_completed", "recovery", "completed", current.blockingReason, participantSnapshot(requireMember(state, LINGHU_MEMBER_ID)), false, flowRepairDetails(current, diagnosis, repaired.text));
        releaseMemberFromState(state, LINGHU_MEMBER_ID);
      });
    } catch (error) {
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

  #setTaskAndMemberPhase(taskId: string, stateValue: CollaborationTask["state"], phase: Exclude<CollaborationWorkerPhase, null>): void {
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

  async #retireExecutor(taskId: string, memberId: string, session: CollaborationExecutorSession): Promise<void> {
    this.#stopHeartbeat(`executor:${taskId}`);
    this.#lastProgressWriteMs.delete(`${taskId}:${memberId}`);
    this.#executorSessions.delete(taskId);
    markMemberRetiring(this.#store, memberId);
    try { await session.dispose(); }
    catch (error) { this.#durations.instant(taskId, "executor.retirement_failed", { memberId, error: errorMessage(error) }); }
    finally { releaseMember(this.#store, memberId); }
  }

  async #blockTask(taskId: string, reason: string): Promise<void> {
    const task = this.#store.task(taskId);
    const session = this.#executorSessions.get(taskId);
    this.#executorSessions.delete(taskId);
    this.#stopHeartbeat(`executor:${taskId}`);
    try { await session?.dispose(); }
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
    const current = this.#store.task(taskId);
    const member = requireMember(this.state(), memberId);
    if (!assignmentId || current.assignmentId !== assignmentId || current.workerGeneration !== workerGeneration || current.executorMemberId !== memberId || member.generation !== workerGeneration || member.currentTaskId !== taskId) {
      throw new Error("执行结果来自已经过期的任务租约，已拒绝写入。");
    }
  }
}

function fairIdleMembers(members: CollaborationMember[]): CollaborationMember[] {
  return members.map((member) => ({ member, tieBreaker: Math.random() })).sort((left, right) => {
    const leftTime = left.member.lastAssignedAt ? Date.parse(left.member.lastAssignedAt) : 0;
    const rightTime = right.member.lastAssignedAt ? Date.parse(right.member.lastAssignedAt) : 0;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.tieBreaker - right.tieBreaker;
  }).map((entry) => entry.member);
}

function requireMember(state: CollaborationState, memberId: string): CollaborationMember {
  const member = state.members.find((candidate) => candidate.memberId === memberId);
  if (!member) throw new Error("协同人物不存在。");
  return member;
}

function participantSnapshot(member: Pick<CollaborationMember, "memberId" | "displayName">): { memberId: string; displayName: string } {
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

/** 流程事件只记录可审计业务事实，不复制原始推理或认证信息。 */
function appendFlow(
  task: CollaborationTask,
  type: CollaborationTask["flowEvents"][number]["type"],
  stage: CollaborationTask["flowEvents"][number]["stage"],
  status: CollaborationTask["flowEvents"][number]["status"],
  summary: string,
  actor: Pick<CollaborationMember, "memberId" | "displayName"> | { memberId: string; displayName: string } | null,
  error = false,
  details: CollaborationFlowEventDetails | null = null,
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
  task: CollaborationTask,
  repairInstruction: string,
  failureSummary: string,
  diagnosedBy: CollaborationParticipantSnapshot,
): CollaborationRepairDiagnosis {
  return {
    diagnosedAt: new Date().toISOString(), diagnosedBy, failureStage: task.integrationFailure?.phase || task.phase || "execution",
    failureSummary, technicalEvidence: [task.integrationFailure?.detail, task.repairFailureReason, task.blockingReason].filter((value): value is string => Boolean(value)),
    repairInstruction, originalExecutor: task.originalExecutor || null,
  };
}

function flowRepairDetails(task: CollaborationTask, diagnosis: CollaborationRepairDiagnosis, repairResult?: string): CollaborationFlowEventDetails {
  return {
    failureStage: diagnosis.failureStage, failureSummary: diagnosis.failureSummary, technicalEvidence: diagnosis.technicalEvidence,
    originalExecutor: diagnosis.originalExecutor, routedBy: task.initiator, repairAssignee: diagnosis.diagnosedBy,
    repairDiagnosis: diagnosis.repairInstruction, repairResult, returnToExecutor: repairResult ? diagnosis.originalExecutor : null,
  };
}

function phaseLabel(phase: Exclude<CollaborationWorkerPhase, null>): string {
  const labels: Record<Exclude<CollaborationWorkerPhase, null>, string> = {
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
    const shouldDelete = target.state === "draining" || !target.enabled;
    if (shouldDelete && !target.protected) {
      state.members = state.members.filter((candidate) => candidate.memberId !== memberId);
      if (state.selectedMemberId === memberId) state.selectedMemberId = "han-li";
      return;
    }
    target.state = "idle";
    target.role = null;
    target.phase = null;
    target.currentTaskId = null;
    target.blockingReason = null;
    target.updatedAt = new Date().toISOString();
  });
}

/** 同一原子状态变更内释放人物，避免嵌套提交覆盖当前任务刚写入的恢复事实。 */
function releaseMemberFromState(state: CollaborationState, memberId: string): void {
  const target = state.members.find((candidate) => candidate.memberId === memberId);
  if (!target) return;
  const shouldDelete = target.state === "draining" || !target.enabled;
  if (shouldDelete && !target.protected) {
    state.members = state.members.filter((candidate) => candidate.memberId !== memberId);
    if (state.selectedMemberId === memberId) state.selectedMemberId = "han-li";
    return;
  }
  target.state = "idle";
  target.role = null;
  target.phase = null;
  target.currentTaskId = null;
  target.blockingReason = null;
  target.updatedAt = new Date().toISOString();
}

function phaseFromStreamEvent(event: CodexStreamEvent): Exclude<CollaborationWorkerPhase, null> | null {
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

/** 权限类失败必须等待真实用户授权，禁止自动循环反复弹出同一审批框。 */
function requiresHumanAuthorization(detail: string): boolean {
  return /(?:等待|需要|请求).{0,12}(?:用户|人工).{0,8}(?:授权|批准)|command execution|approval|permission|operation not permitted|\bEPERM\b/iu.test(detail);
}
