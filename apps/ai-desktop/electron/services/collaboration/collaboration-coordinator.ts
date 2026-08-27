import { createHash, randomUUID } from "node:crypto";

import type {
  CollaborationMember,
  CollaborationRequirementPlan,
  CollaborationReview,
  CollaborationReviewAttempt,
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
}

export interface CollaborationExecutorSession {
  isAlive(): boolean;
  analyze(task: CollaborationTask, emit: (event: CodexStreamEvent) => void): Promise<string>;
  optimize(task: CollaborationTask, feedback: string, emit: (event: CodexStreamEvent) => void): Promise<string>;
  execute(task: CollaborationTask, plan: CollaborationRequirementPlan, emit: (event: CodexStreamEvent) => void): Promise<CollaborationExecutionResult>;
  dispose(): Promise<void> | void;
}

export interface CollaborationReviewerSession {
  isAlive(): boolean;
  review(task: CollaborationTask, plan: CollaborationRequirementPlan, emit: (event: CodexStreamEvent) => void): Promise<
    | {
      outcome: "decided";
      decision: "passed" | "rejected";
      decisionSource: "tag" | "legacy-marker" | "explicit-chinese" | "clarification";
      feedback: string;
      rawOutput: string;
      clarificationOutput: string | null;
    }
    | {
      outcome: "decision-unrecognized";
      feedback: string;
      rawOutput: string;
      clarificationOutput: string;
      error: string;
    }
  >;
  dispose(): Promise<void> | void;
}

export interface CollaborationSessionFactory {
  createExecutor(task: CollaborationTask, member: CollaborationMember): Promise<CollaborationExecutorSession>;
  createReviewer(task: CollaborationTask, member: CollaborationMember): Promise<CollaborationReviewerSession>;
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

/** 编排对等人物之间的分析、异人审核、执行和集成，单会话发送链路不依赖本类。 */
export class CollaborationCoordinator {
  readonly #store: CollaborationStore;
  readonly #durations: CollaborationDurationLog;
  readonly #workspaces: VersionWorkspaceManager;
  readonly #sessions: CollaborationSessionFactory;
  readonly #integrationPipeline: VersionIntegrationPipeline;
  readonly #emitStream: CollaborationCoordinatorOptions["emitStream"];
  readonly #executorSessions = new Map<string, CollaborationExecutorSession>();
  readonly #reviewerSessions = new Map<string, CollaborationReviewerSession>();
  readonly #activeTaskRuns = new Set<string>();
  readonly #waitSpans = new Map<string, string>();
  readonly #heartbeatTimers = new Map<string, ReturnType<typeof setInterval>>();
  readonly #lastProgressWriteMs = new Map<string, number>();
  #disposed = false;

  constructor(options: CollaborationCoordinatorOptions) {
    this.#store = options.store;
    this.#durations = options.durations;
    this.#workspaces = options.workspaces;
    this.#sessions = options.sessions;
    this.#integrationPipeline = options.integrationPipeline;
    this.#emitStream = options.emitStream;
    this.#store.subscribe(options.emitState);
  }

  state(): CollaborationState { return this.#store.state(); }
  setMode(mode: DesktopOperatingMode): CollaborationState { return this.#store.setMode(mode); }
  selectMember(memberId: string): CollaborationState { return this.#store.selectMember(memberId); }
  createMember(request: CreateCollaborationMemberRequest): CollaborationState { return this.#store.createMember(request); }
  updateMember(memberId: string, request: UpdateCollaborationMemberRequest): CollaborationState { return this.#store.updateMember(memberId, request); }
  deleteMember(memberId: string): CollaborationState { return this.#store.deleteMember(memberId); }

  submitTask(request: SubmitCollaborationTaskRequest): CollaborationState {
    const enabledWorkers = this.state().members.filter((member) => member.kind === "worker" && member.enabled).length;
    if (enabledWorkers < 2) throw new Error("协同执行至少需要两名已启用人物，才能保证执行人与审核员不同。");
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
    if (task?.state === "repairing-review") void this.#repairRejectedReview(taskId);
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
   * 该入口只接受 verification 失败，不处理需要人工选择、工作区归属或 Git 冲突问题。
   */
  async repairFailedUnifiedTest(taskId: string): Promise<boolean> {
    const failedTask = this.#store.task(taskId);
    if (failedTask.state !== "test-failed" || failedTask.integrationFailure?.kind !== "verification") return false;
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
        handler.phase = "implementing";
        handler.currentTaskId = taskId;
        handler.updatedAt = new Date().toISOString();
        current.taskRevision += 1;
        current.state = "repairing-execution";
        current.phase = "implementing";
        current.repairKind = "execution";
        current.repairFailureReason = originalReason;
        current.currentHandler = participantSnapshot(handler);
        current.blockingReason = `${handler.displayName}正在依据统一测试失败证据修复源码与测试契约`;
        appendFlow(current, "unified_test.repair_started", "recovery", "started", current.blockingReason, handler);
      });

      const task = this.#store.task(taskId);
      const approvedPlan = task.plans.find((candidate) => candidate.version === task.currentPlanVersion);
      if (!approvedPlan) throw new Error("统一测试修复找不到已批准的执行方案。");
      const repairPlan: CollaborationRequirementPlan = {
        ...approvedPlan,
        text: [
          approvedPlan.text,
          "令狐统一测试修复要求：只处理下述失败证据所证明的源码、测试契约或配置问题，不扩大原任务范围。完成最小修正后执行代码级验证。",
          task.integrationFailure?.detail || originalReason,
        ].join("\n\n"),
      };
      repairSession = await this.#sessions.createExecutor(task, requireMember(this.state(), LINGHU_MEMBER_ID));
      const repaired = await repairSession.execute(task, repairPlan, (event) => this.#emitStream(taskId, LINGHU_MEMBER_ID, event));
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
        current.blockingReason = null;
        current.codeVerifiedAt = new Date().toISOString();
        current.finalResult = repaired.text;
        current.resultSummary = createCollaborationResultSummary(current, repaired.text, repaired.pendingActions);
        current.unifiedTest = { status: "pending", owner: participantSnapshot(requireMember(state, LINGHU_MEMBER_ID)), failureReason: null, startedAt: null, completedAt: null };
        appendFlow(current, "unified_test.repair_completed", "recovery", "completed", "令狐老祖已完成最小修正并生成新结果版本，等待重新统一测试", requireMember(state, LINGHU_MEMBER_ID));
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
        current.state = "test-failed";
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

  async #repairRejectedReview(taskId: string): Promise<void> {
    let repairSession: CollaborationExecutorSession | null = null;
    try {
      const task = this.#store.task(taskId);
      const linghu = requireMember(this.state(), LINGHU_MEMBER_ID);
      if (linghu.state !== "idle") throw new Error("令狐老祖当前正在处理其他任务。");
      this.#store.updateTask(taskId, "review.repair_started", (current, state) => {
        const handler = requireMember(state, LINGHU_MEMBER_ID);
        handler.generation += 1;
        handler.state = "working";
        handler.role = "executor";
        handler.phase = "planning";
        handler.currentTaskId = taskId;
        handler.updatedAt = new Date().toISOString();
        current.currentHandler = participantSnapshot(handler);
        current.blockingReason = `${handler.displayName}正在处理审核未通过的问题`;
        appendFlow(current, "review.repair_started", "recovery", "started", current.blockingReason, handler);
      });
      repairSession = await this.#sessions.createExecutor(this.#store.task(taskId), requireMember(this.state(), LINGHU_MEMBER_ID));
      const feedback = task.repairFailureReason || task.reviews.at(-1)?.feedback || "处理最近一次审核未通过的问题。";
      const text = await repairSession.optimize(this.#store.task(taskId), feedback, (event) => this.#emitStream(taskId, LINGHU_MEMBER_ID, event));
      const plan: CollaborationRequirementPlan = {
        version: task.currentPlanVersion + 1,
        ownerMemberId: LINGHU_MEMBER_ID,
        ownerDisplayName: requireMember(this.state(), LINGHU_MEMBER_ID).displayName,
        status: "awaiting-review",
        text,
        contentHash: sha256(text),
        createdAt: new Date().toISOString(),
      };
      this.#store.updateTask(taskId, "review.repair_completed", (current, state) => {
        current.plans.push(plan);
        current.currentPlanVersion = plan.version;
        current.state = "queued-reviewer";
        current.preferredReviewerMemberId = current.originalReviewer?.memberId || null;
        current.currentHandler = current.originalReviewer || null;
        current.repairKind = null;
        current.blockingReason = current.originalReviewer ? `令狐老祖处理完成，等待${current.originalReviewer.displayName}重新审批` : "令狐老祖处理完成，等待重新审批";
        appendFlow(current, "review.repair_completed", "recovery", "completed", current.blockingReason, requireMember(state, LINGHU_MEMBER_ID));
        releaseMemberFromState(state, LINGHU_MEMBER_ID);
      });
      this.#waitSpans.set(taskId, this.#durations.startWait(taskId, "reviewer-wait", "recovery-wait", "original-reviewer-return", task.originalReviewer?.memberId || "reviewer-capacity", task.originalReviewer?.memberId || null));
    } catch (error) {
      this.#store.updateTask(taskId, "review.repair_failed", (current, state) => {
        current.state = "review-failed";
        current.blockingReason = `令狐老祖处理审核问题失败：${errorMessage(error)}`;
        current.repairFailureReason = current.blockingReason;
        appendFlow(current, "review.repair_failed", "recovery", "failed", current.blockingReason, participantSnapshot(requireMember(state, LINGHU_MEMBER_ID)), true);
        releaseMemberFromState(state, LINGHU_MEMBER_ID);
      });
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
    const reviewer = this.#reviewerSessions.get(taskId);
    this.#executorSessions.delete(taskId);
    this.#reviewerSessions.delete(taskId);
    this.#stopHeartbeat(`executor:${taskId}`);
    this.#stopHeartbeat(`reviewer:${taskId}`);
    if (task.executorMemberId) this.#lastProgressWriteMs.delete(`${taskId}:${task.executorMemberId}`);
    if (task.currentReviewerMemberId) this.#lastProgressWriteMs.delete(`${taskId}:${task.currentReviewerMemberId}`);
    const state = this.#store.cancelTask(taskId);
    await Promise.allSettled([session?.dispose(), reviewer?.dispose()].filter((candidate): candidate is Promise<void> => candidate instanceof Promise));
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
    this.#integrationPipeline.dispose();
    this.#durations.interruptOpenSpans("application.before-quit");
    await Promise.allSettled([...this.#executorSessions.values()].map((session) => session.dispose()));
    await Promise.allSettled([...this.#reviewerSessions.values()].map((session) => session.dispose()));
    this.#executorSessions.clear();
    this.#reviewerSessions.clear();
    for (const timer of this.#heartbeatTimers.values()) clearInterval(timer);
    this.#heartbeatTimers.clear();
  }

  #schedule(): void {
    if (this.#disposed || this.state().mode !== "collaboration") return;
    queueMicrotask(() => {
      if (this.#disposed) return;
      this.#scheduleReviewers();
      this.#scheduleExecutors();
      this.#integrationPipeline.schedule();
    });
  }

  #scheduleExecutors(): void {
    const state = this.state();
    const allWorkers = state.members.filter((member) => member.kind === "worker" && member.enabled && member.state !== "draining" && member.state !== "offline");
    const workers = allWorkers.filter((member) => !ORCHESTRATOR_MEMBER_IDS.has(member.memberId));
    const waitingReviews = state.tasks.filter((task) => task.state === "queued-reviewer").length;
    const reviewerReserve = Math.min(3, Math.max(1, Math.ceil(waitingReviews / 2)));
    const activeExecutors = workers.filter((member) => member.role === "executor" && member.currentTaskId).length;
    const executorCapacity = Math.max(0, workers.length - reviewerReserve - activeExecutors);
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
        appendFlow(task, previousAssignment ? "executor.reassigned" : "executor.assigned", "analysis", "started", assignmentSummary, member);
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

  async #analyze(taskId: string, session: CollaborationExecutorSession, optimization: boolean, feedback = "", executeAfterOptimization = false): Promise<void> {
    const task = this.#store.task(taskId);
    const memberId = task.executorMemberId;
    if (!memberId) throw new Error("任务缺少执行人。");
    const assignmentId = task.assignmentId;
    const workerGeneration = task.workerGeneration;
    const segment = optimization ? "rework" : "analysis";
    const span = this.#durations.start(taskId, segment, { memberId, planVersion: task.currentPlanVersion + 1 });
    this.#setTaskAndMemberPhase(taskId, optimization ? "optimizing" : "analyzing", optimization ? "planning" : "analyzing");
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
      const text = optimization ? await session.optimize(task, feedback, emit) : await session.analyze(task, emit);
      this.#assertExecutorLease(taskId, memberId, assignmentId, workerGeneration);
      const plan: CollaborationRequirementPlan = {
        version: task.currentPlanVersion + 1,
        ownerMemberId: memberId,
        ownerDisplayName: requireMember(this.state(), memberId).displayName,
        status: executeAfterOptimization ? "forced" : "awaiting-review",
        text,
        contentHash: sha256(text),
        createdAt: new Date().toISOString(),
      };
      this.#store.updateTask(taskId, executeAfterOptimization ? "plan.final_after_review_limit" : "plan.ready", (current, state) => {
        current.plans.push(plan);
        current.currentPlanVersion = plan.version;
        current.state = executeAfterOptimization ? "forced-after-review-limit" : "queued-reviewer";
        current.phase = null;
        const executor = requireMember(state, memberId);
        executor.state = executeAfterOptimization ? "working" : "waiting-review";
        executor.phase = null;
        executor.blockingReason = executeAfterOptimization ? "第三次驳回后的最终必要修正已完成，强制执行" : "等待空闲审核员";
        executor.updatedAt = new Date().toISOString();
        const execution = current.executionRecords.find((item) => item.assignmentId === current.assignmentId);
        if (execution) execution.status = executeAfterOptimization ? "executing" : "waiting-review";
        appendFlow(current, optimization ? "plan.optimized" : "plan.ready", "analysis", "completed", `${executor.displayName}已完成分析方案 v${plan.version}`, executor);
      });
      this.#durations.finish(span, "completed", {
        releaseEvent: executeAfterOptimization ? "plan.final_after_review_limit" : "plan.ready",
        planVersion: plan.version,
      });
      if (executeAfterOptimization) {
        await this.#execute(taskId);
      } else {
        this.#waitSpans.set(taskId, this.#durations.startWait(taskId, "reviewer-wait", "system-wait", "no-idle-reviewer", "reviewer-capacity", null));
      }
    } catch (error) {
      this.#durations.finish(span, "failed", { error: errorMessage(error) });
      throw error;
    }
  }

  async #resumeOrAnalyze(taskId: string, session: CollaborationExecutorSession): Promise<void> {
    const task = this.#store.task(taskId);
    const target = task.recoveryTargetState;
    if ((target === "queued-reviewer" || target === "reviewing") && task.currentPlanVersion > 0) {
      const memberId = task.executorMemberId;
      if (!memberId) throw new Error("恢复审核队列时缺少执行人。");
      this.#store.updateTask(taskId, "task.review_queue_recovered", (current, state) => {
        current.state = "queued-reviewer";
        current.phase = null;
        current.currentReviewerMemberId = null;
        current.recoveryTargetState = null;
        const member = requireMember(state, memberId);
        member.state = "waiting-review";
        member.phase = null;
        member.blockingReason = "等待空闲审核员";
      });
      this.#waitSpans.set(taskId, this.#durations.startWait(taskId, "reviewer-wait", "recovery-wait", "review-queue-recovered", "reviewer-capacity", null));
      return;
    }
    if ((target === "approved" || target === "forced-after-review-limit" || target === "executing") && task.currentPlanVersion > 0) {
      this.#store.updateTask(taskId, "task.execution_recovered", (current) => {
        current.state = target === "forced-after-review-limit" ? target : "approved";
        current.recoveryTargetState = null;
      });
      await this.#execute(taskId);
      return;
    }
    if (target === "optimizing" && task.currentPlanVersion > 0) {
      const feedback = [...task.reviews].reverse().find((review) => review.decision === "rejected")?.feedback || "恢复后继续优化最近方案。";
      this.#store.updateTask(taskId, "task.optimization_recovered", (current) => { current.recoveryTargetState = null; });
      await this.#analyze(taskId, session, true, feedback, task.explicitRejectionCount >= 3);
      return;
    }
    this.#store.updateTask(taskId, "task.analysis_recovered", (current) => { current.recoveryTargetState = null; });
    await this.#analyze(taskId, session, false);
  }

  #scheduleReviewers(): void {
    const state = this.state();
    const queued = state.tasks.filter((task) => task.state === "queued-reviewer" && !task.currentReviewerMemberId);
    const idle = fairIdleMembers(state.members.filter((member) => member.kind === "worker" && member.enabled && member.state === "idle" && !ORCHESTRATOR_MEMBER_IDS.has(member.memberId)));
    for (const task of queued) {
      const reviewerIndex = task.preferredReviewerMemberId
        ? idle.findIndex((member) => member.memberId === task.preferredReviewerMemberId && member.memberId !== task.executorMemberId)
        : idle.findIndex((member) => member.memberId !== task.executorMemberId);
      if (reviewerIndex < 0) break;
      const [reviewer] = idle.splice(reviewerIndex, 1);
      void this.#beginReview(task.taskId, reviewer.memberId);
    }
  }

  async #beginReview(taskId: string, reviewerId: string): Promise<void> {
    const task = this.#store.task(taskId);
    const plan = task.plans.find((candidate) => candidate.version === task.currentPlanVersion);
    if (!plan) return this.#blockTask(taskId, "审核前找不到当前方案版本。");
    const waitSpan = this.#waitSpans.get(taskId);
    if (waitSpan) this.#durations.finish(waitSpan, "completed", { releaseEvent: "reviewer.assigned", reviewerId });
    this.#waitSpans.delete(taskId);
    let reviewerSession: CollaborationReviewerSession | null = null;
    let reviewerGeneration = 0;
    let reviewPersisted = false;
    const reviewStartedAt = new Date().toISOString();
    const reviewSpan = this.#durations.start(taskId, "review", { reviewerId, planVersion: plan.version });
    try {
      this.#store.updateTask(taskId, "reviewer.assigned", (current, state) => {
        const reviewer = requireMember(state, reviewerId);
        if (reviewer.state !== "idle") throw new Error("审核员不再空闲。");
        reviewer.generation += 1;
        reviewer.state = "reviewing";
        reviewer.role = "reviewer";
        reviewer.phase = "analyzing";
        reviewer.currentTaskId = taskId;
        reviewer.lastAssignedAt = new Date().toISOString();
        reviewer.updatedAt = reviewer.lastAssignedAt;
        current.currentReviewerMemberId = reviewerId;
        current.originalReviewer ??= participantSnapshot(reviewer);
        current.currentHandler = participantSnapshot(reviewer);
        current.state = "reviewing";
        current.blockingReason = null;
        const executor = current.executorMemberId ? requireMember(state, current.executorMemberId) : null;
        if (executor) executor.blockingReason = `${reviewer.displayName}正在审核`;
        appendFlow(current, "reviewer.assigned", "review", "started", `${reviewer.displayName}开始审核方案 v${plan.version}`, reviewer);
      });
      reviewerGeneration = requireMember(this.state(), reviewerId).generation;
      reviewerSession = await this.#sessions.createReviewer(this.#store.task(taskId), requireMember(this.state(), reviewerId));
      this.#reviewerSessions.set(taskId, reviewerSession);
      this.#startHeartbeat(`reviewer:${taskId}`, taskId, reviewerId, reviewerSession);
      const result = await reviewerSession.review(this.#store.task(taskId), plan, () => this.#touchProtocolProgress(taskId, reviewerId));
      const currentTask = this.#store.task(taskId);
      const currentReviewer = requireMember(this.state(), reviewerId);
      if (currentTask.currentReviewerMemberId !== reviewerId || currentTask.currentPlanVersion !== plan.version || currentReviewer.generation !== reviewerGeneration || currentReviewer.currentTaskId !== taskId) {
        throw new Error("审核结果来自已经过期的审核租约，已拒绝写入。");
      }
      const completedAt = new Date().toISOString();
      if (result.outcome === "decision-unrecognized") {
        const attempt: CollaborationReviewAttempt = {
          attemptId: randomUUID(),
          planVersion: plan.version,
          reviewerMemberId: reviewerId,
          reviewerDisplayName: currentReviewer.displayName,
          reviewerGeneration,
          outcome: result.outcome,
          decision: null,
          decisionSource: null,
          rawOutput: result.rawOutput,
          clarificationOutput: result.clarificationOutput,
          error: result.error,
          startedAt: reviewStartedAt,
          completedAt,
        };
        this.#store.updateTask(taskId, "review.decision_unrecognized", (current, state) => {
          current.reviewAttempts.push(attempt);
          current.currentReviewerMemberId = null;
          current.state = "queued-reviewer";
          current.blockingReason = `${currentReviewer.displayName}审核正文已保存，但结论无法识别，等待其他审核员确认`;
          const executor = current.executorMemberId ? requireMember(state, current.executorMemberId) : null;
          if (executor) executor.blockingReason = current.blockingReason;
          appendFlow(current, "review.decision_unrecognized", "review", "failed", `${currentReviewer.displayName}的审核正文已保存，但结论无法识别`, currentReviewer, true);
        });
        this.#durations.finish(reviewSpan, "completed", {
          outcome: result.outcome,
          reviewerId,
          releaseEvent: "review-output.persisted",
          error: result.error,
        });
        await this.#retireReviewer(reviewerId, reviewerSession);
        reviewerSession = null;
        this.#waitSpans.set(taskId, this.#durations.startWait(taskId, "reviewer-wait", "recovery-wait", "review-decision-unrecognized", "reviewer-capacity", null));
        return;
      }
      const review: CollaborationReview = {
        reviewId: randomUUID(),
        planVersion: plan.version,
        reviewerMemberId: reviewerId,
        reviewerDisplayName: currentReviewer.displayName,
        reviewerGeneration,
        decision: result.decision,
        feedback: result.feedback,
        createdAt: new Date().toISOString(),
      };
      const attempt: CollaborationReviewAttempt = {
        attemptId: randomUUID(),
        planVersion: plan.version,
        reviewerMemberId: reviewerId,
        reviewerDisplayName: currentReviewer.displayName,
        reviewerGeneration,
        outcome: result.outcome,
        decision: result.decision,
        decisionSource: result.decisionSource,
        rawOutput: result.rawOutput,
        clarificationOutput: result.clarificationOutput,
        error: null,
        startedAt: reviewStartedAt,
        completedAt,
      };
      this.#store.updateTask(taskId, "review.completed", (current) => {
        if (current.currentPlanVersion !== review.planVersion) throw new Error("审核结果对应的方案版本已经过期。");
        current.reviewAttempts.push(attempt);
        current.reviews.push(review);
        current.currentReviewerMemberId = null;
        current.infrastructureFailureCount = 0;
        current.blockingReason = null;
        if (review.decision === "rejected") current.explicitRejectionCount += 1;
        const reviewedPlan = current.plans.find((candidate) => candidate.version === review.planVersion);
        if (reviewedPlan) reviewedPlan.status = review.decision === "passed" ? "approved" : "rejected";
        appendFlow(current, "review.completed", "review", "completed", `${currentReviewer.displayName}审核${review.decision === "passed" ? "通过" : "未通过"}方案 v${plan.version}`, currentReviewer);
      });
      reviewPersisted = true;
      this.#durations.finish(reviewSpan, "completed", { decision: result.decision, releaseEvent: "review.persisted" });
      await this.#retireReviewer(reviewerId, reviewerSession);
      reviewerSession = null;
      const reviewAction = nextReviewAction(result.decision, this.#store.task(taskId).explicitRejectionCount);
      if (result.decision === "rejected") {
        this.#store.updateTask(taskId, "review.failed_waiting_repair", (current) => {
          current.state = "review-failed";
          current.repairKind = "review";
          current.repairFailureReason = result.feedback;
          current.blockingReason = result.feedback || `${currentReviewer.displayName}审批未通过`;
          current.currentHandler = null;
          appendFlow(current, "review.failed_waiting_repair", "review", "failed", current.blockingReason, currentReviewer, true);
        });
        return;
      }
      if (reviewAction === "execute") {
        this.#store.updateTask(taskId, "review.passed", (current) => { current.state = "approved"; });
        await this.#execute(taskId);
      } else if (reviewAction === "optimize-and-execute") {
        const executorSession = this.#executorSessions.get(taskId);
        if (!executorSession) throw new Error("执行人 Codex 已失联，无法完成第三次驳回后的最终必要修正。");
        this.#store.updateTask(taskId, "review.limit_reached", (current) => {
          current.state = "optimizing";
          current.blockingReason = "第三次驳回，正在完成最后一次必要修正，修正后不再复审";
        });
        await this.#analyze(taskId, executorSession, true, result.feedback, true);
      } else {
        const executorSession = this.#executorSessions.get(taskId);
        if (!executorSession) throw new Error("执行人 Codex 已失联，无法依据审核意见优化。");
        await this.#analyze(taskId, executorSession, true, result.feedback);
      }
    } catch (error) {
      const failureEvidence = reviewFailureEvidence(error);
      this.#durations.finish(reviewSpan, "failed", { error: errorMessage(error) });
      if (reviewerSession) await this.#retireReviewer(reviewerId, reviewerSession);
      if (this.#store.task(taskId).state === "cancelled") return;
      if (reviewPersisted) {
        await this.#blockTask(taskId, `审核结果已保存，但后续处理失败：${errorMessage(error)}`);
        return;
      }
      this.#store.updateTask(taskId, "review.infrastructure_failed", (current, state) => {
        current.reviewAttempts.push({
          attemptId: randomUUID(),
          planVersion: plan.version,
          reviewerMemberId: reviewerId,
          reviewerDisplayName: requireMember(state, reviewerId).displayName,
          reviewerGeneration,
          outcome: "infrastructure-failed",
          decision: null,
          decisionSource: null,
          rawOutput: failureEvidence.rawOutput,
          clarificationOutput: failureEvidence.clarificationOutput,
          error: errorMessage(error),
          startedAt: reviewStartedAt,
          completedAt: new Date().toISOString(),
        });
        current.infrastructureFailureCount += 1;
        current.currentReviewerMemberId = null;
        current.state = current.infrastructureFailureCount >= 3 ? "recovering" : "queued-reviewer";
        current.blockingReason = current.infrastructureFailureCount >= 3
          ? "审核基础设施连续失败，等待恢复"
          : `${requireMember(state, reviewerId).displayName}连接异常，等待其他审核员`;
        current.recoveryTargetState = current.infrastructureFailureCount >= 3 ? "queued-reviewer" : null;
        const executor = current.executorMemberId ? requireMember(state, current.executorMemberId) : null;
        if (executor) executor.blockingReason = current.blockingReason;
        appendFlow(current, "review.infrastructure_failed", "review", "failed", current.blockingReason || "审核连接异常", requireMember(state, reviewerId), true);
      });
      if (this.#store.task(taskId).state === "queued-reviewer") {
        this.#waitSpans.set(taskId, this.#durations.startWait(taskId, "reviewer-wait", "recovery-wait", "reviewer-infrastructure-retry", "reviewer-capacity", null));
      }
    } finally {
      this.#schedule();
    }
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
        linghu.phase = "implementing";
        linghu.currentTaskId = taskId;
        current.state = "repairing-execution";
        current.repairKind = "execution";
        current.repairFailureReason = reason;
        current.currentHandler = participantSnapshot(linghu);
        current.blockingReason = `执行失败：${reason}；令狐老祖正在修复`;
        appendFlow(current, "execution.repair_started", "recovery", "started", current.blockingReason, linghu);
      });
      const task = this.#store.task(taskId);
      const plan = task.plans.find((candidate) => candidate.version === task.currentPlanVersion);
      if (!plan) throw new Error("令狐老祖修复时找不到当前执行方案。");
      repairSession = await this.#sessions.createExecutor(task, requireMember(this.state(), LINGHU_MEMBER_ID));
      const repaired = await repairSession.execute(task, plan, (event) => this.#emitStream(taskId, LINGHU_MEMBER_ID, event));
      if (repaired.status !== "code-verified") throw new Error(repaired.pendingActions.join("；") || "修复未完成代码验证");
      this.#store.updateTask(taskId, "execution.repair_completed", (current, state) => {
        const original = current.originalExecutor;
        current.state = "queued-executor";
        current.executorMemberId = original?.memberId || originalId;
        current.preferredExecutorMemberId = original?.memberId || originalId;
        current.assignmentId = null;
        current.recoveryTargetState = "approved";
        current.repairKind = null;
        current.currentHandler = original || null;
        current.blockingReason = original ? `令狐老祖修复完成，等待${original.displayName}重新执行` : "令狐老祖修复完成，等待原执行人重新执行";
        appendFlow(current, "execution.repair_completed", "recovery", "completed", current.blockingReason, participantSnapshot(requireMember(state, LINGHU_MEMBER_ID)));
        releaseMemberFromState(state, LINGHU_MEMBER_ID);
      });
    } catch (error) {
      await this.#blockTask(taskId, `令狐老祖修复执行问题失败：${errorMessage(error)}`);
    } finally {
      await repairSession?.dispose();
      this.#schedule();
    }
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

  async #retireReviewer(memberId: string, session: CollaborationReviewerSession): Promise<void> {
    const taskId = this.state().members.find((candidate) => candidate.memberId === memberId)?.currentTaskId;
    if (taskId) {
      this.#stopHeartbeat(`reviewer:${taskId}`);
      this.#reviewerSessions.delete(taskId);
      this.#lastProgressWriteMs.delete(`${taskId}:${memberId}`);
    }
    markMemberRetiring(this.#store, memberId);
    try { await session.dispose(); }
    catch (error) { if (taskId) this.#durations.instant(taskId, "reviewer.retirement_failed", { memberId, error: errorMessage(error) }); }
    finally { releaseMember(this.#store, memberId); }
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
    this.#stopHeartbeat(`reviewer:${taskId}`);
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
      appendFlow(current, "task.blocked", "recovery", "failed", current.blockingReason, execution?.executor || null, true);
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

/** 审核只允许两轮普通返工；第三次明确驳回必须先做最终必要修正，再跳过第四轮审核进入执行。 */
export function nextReviewAction(
  decision: "passed" | "rejected",
  explicitRejectionCount: number,
): "execute" | "optimize-and-review" | "optimize-and-execute" {
  if (decision === "passed") return "execute";
  return explicitRejectionCount >= 3 ? "optimize-and-execute" : "optimize-and-review";
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
  type: string,
  stage: CollaborationTask["flowEvents"][number]["stage"],
  status: CollaborationTask["flowEvents"][number]["status"],
  summary: string,
  actor: Pick<CollaborationMember, "memberId" | "displayName"> | { memberId: string; displayName: string } | null,
  error = false,
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
  });
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

/** 连接在结论补取阶段失败时，仍从受控错误对象取回已经完成的审核正文。 */
function reviewFailureEvidence(error: unknown): { rawOutput: string | null; clarificationOutput: string | null } {
  if (!error || typeof error !== "object") return { rawOutput: null, clarificationOutput: null };
  const value = error as { rawOutput?: unknown; clarificationOutput?: unknown };
  return {
    rawOutput: typeof value.rawOutput === "string" ? value.rawOutput : null,
    clarificationOutput: typeof value.clarificationOutput === "string" ? value.clarificationOutput : null,
  };
}
