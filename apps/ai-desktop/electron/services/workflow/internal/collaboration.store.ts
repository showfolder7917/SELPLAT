import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import type {
  CollaborationMemberOutDto,
  CollaborationStateOutDto,
  CollaborationTaskOutDto,
  DesktopOperatingModeValue,
  SubmitCollaborationTaskInDto,
  CollaborationTaskRuleContextOutDto,
} from "../../../../contracts/services/workflow/index.js";

type StateListener = (state: CollaborationStateOutDto, reason: string, taskIds: string[]) => void;

const LINGHU_MEMBER_ID = "linghu-ancestor";

const DEFAULT_MEMBERS: ReadonlyArray<{ memberId: string; displayName: string; kind: CollaborationMemberOutDto["kind"] }> = [
  { memberId: "han-li", displayName: "韩立", kind: "conversation-owner" },
  { memberId: "nangong-wan", displayName: "南宫婉", kind: "worker" },
  { memberId: "linghu-ancestor", displayName: "令狐老祖", kind: "worker" },
  { memberId: "zi-ling", displayName: "紫灵", kind: "worker" },
  { memberId: "yuan-yao", displayName: "元瑶", kind: "worker" },
  { memberId: "song-yu", displayName: "宋玉", kind: "worker" },
  { memberId: "ice-soul", displayName: "冰魄仙子", kind: "worker" },
  { memberId: "mo-caihuan", displayName: "墨彩环", kind: "worker" },
  { memberId: "doctor-mo", displayName: "墨大夫", kind: "worker" },
  { memberId: "li-feiyu", displayName: "厉飞雨", kind: "worker" },
  { memberId: "zhang-tie", displayName: "张铁", kind: "worker" },
  { memberId: "li-huayuan", displayName: "李化元", kind: "worker" },
];

const TERMINAL_TASK_STATES = new Set<CollaborationTaskOutDto["state"]>(["integrated", "cancelled"]);

/** 持久保存协同人物、任务和恢复点；所有修改都在 Electron 主进程内原子提交。 */
export class CollaborationStore {
  readonly #filePath: string;
  readonly #listeners = new Set<StateListener>();
  #state: CollaborationStateOutDto;

  constructor(filePath: string) {
    this.#filePath = filePath;
    this.#state = this.#load();
  }

  state(): CollaborationStateOutDto {
    return structuredClone(this.#state);
  }

  subscribe(listener: StateListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** 清除测试任务与运行态，保留用户维护的人物、启用状态、选择和桌面模式；返回实际移除的任务与批次数。示例：2 个任务和 1 个批次返回 3；写入失败时抛错且内存状态不变。 */
  clearTestData(): number {
    const clearedCount = this.#state.tasks.length + this.#state.integrationBatches.length;
    const taskIds = this.#state.tasks.map((task) => task.taskId);
    this.#commit("test-data.cleared", (state) => {
      state.tasks = [];
      state.integrationBatches = [];
      state.nextIntegrationGeneration = 1;
      for (const member of state.members) {
        const owner = member.kind === "conversation-owner";
        member.state = owner ? "conversation" : "idle";
        member.role = owner ? "conversation" : null;
        member.phase = null;
        member.currentTaskId = null;
        member.blockingReason = null;
        member.lastHeartbeatAt = null;
        member.lastProtocolProgressAt = null;
        member.lastAssignedAt = null;
        member.generation = owner ? 1 : 0;
        member.updatedAt = new Date().toISOString();
      }
    }, taskIds);
    return clearedCount;
  }

  /** 确认文件状态与内存状态都已移除任务运行记录，避免页面重启后重新读回旧任务。 */
  assertTestDataCleared(): void {
    const persisted = this.#loadPersistedState();
    if (this.#state.tasks.length > 0 || this.#state.integrationBatches.length > 0
      || persisted.tasks.length > 0 || persisted.integrationBatches.length > 0
      || [...this.#state.members, ...persisted.members].some((member) => member.currentTaskId !== null)) {
      throw new Error("测试数据清空后仍检测到协作任务运行记录，已阻止按成功结果重启。");
    }
  }

  setMode(mode: DesktopOperatingModeValue): CollaborationStateOutDto {
    if (mode !== "single-conversation" && mode !== "collaboration") throw new Error("无效的桌面运行模式。");
    return this.#commit("mode.changed", (state) => { state.mode = mode; });
  }

  selectMember(memberId: string): CollaborationStateOutDto {
    this.#member(memberId);
    return this.#commit("member.selected", (state) => { state.selectedMemberId = memberId; });
  }

  submitTask(request: SubmitCollaborationTaskInDto & { ruleContext?: CollaborationTaskRuleContextOutDto }): CollaborationTaskOutDto {
    if (!request || typeof request.confirmedIntent !== "string" || !request.confirmedIntent.trim()) {
      throw new Error("必须提供韩立已经确认的完整任务意图。");
    }
    if (!request.workspaceState?.roots?.length) throw new Error("协同任务至少需要一个已登记工作区。");
    const now = new Date().toISOString();
    const taskId = `collab-${now.replaceAll(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
    const normalizedIntent = request.confirmedIntent.trim().slice(0, 20_000);
    const initiatorMember = request.initiatorMemberId
      ? this.#member(request.initiatorMemberId)
      : this.#state.members.find((member) => member.kind === "conversation-owner");
    if (!initiatorMember) throw new Error("协同任务缺少真实发起人。");
    const preferredExecutor = request.preferredExecutorMemberId ? this.#member(request.preferredExecutorMemberId) : null;
    if (preferredExecutor && (preferredExecutor.kind !== "worker" || !preferredExecutor.enabled)) {
      throw new Error("指定执行人必须是已启用的协同执行人物。");
    }
    const task: CollaborationTaskOutDto = {
      taskId,
      taskRevision: 1,
      assignmentId: null,
      workerGeneration: 0,
      state: "queued-executor",
      phase: null,
      executorMemberId: preferredExecutor?.memberId || null,
      preferredExecutorMemberId: preferredExecutor?.memberId || null,
      originalExecutor: null,
      currentHandler: participantSnapshot(initiatorMember),
      repairKind: null,
      repairFailureReason: null,
      unifiedTest: null,
      currentPlanVersion: 0,
      infrastructureFailureCount: 0,
      mergeStrategy: request.mergeStrategy || "INDEPENDENT",
      atomicGroupId: request.atomicGroupId?.trim() || null,
      dependencyTaskIds: [...new Set(request.dependencyTaskIds || [])],
      integrationGeneration: null,
      initiator: participantSnapshot(initiatorMember),
      automationSource: request.automationSource || null,
      evolutionProposalId: request.evolutionProposalId?.trim() || null,
      evolutionRoundId: request.evolutionRoundId?.trim() || null,
      returnedToNangongAt: null,
      selfUpgradeTargetMemberId: request.selfUpgradeTargetMemberId?.trim() || null,
      selfUpgradeCapabilityScope: request.selfUpgradeCapabilityScope?.trim() || null,
      sourceEvolutionApprovalId: request.sourceEvolutionApprovalId?.trim() || null,
      historyCompleteness: "complete",
      snapshot: {
        title: request.title.trim().slice(0, 160) || normalizedIntent.slice(0, 80),
        problemStatement: request.problemStatement.trim().slice(0, 8_000),
        confirmedIntent: normalizedIntent,
        constraints: (request.constraints || []).map((item) => item.trim()).filter(Boolean),
        acceptanceCriteria: (request.acceptanceCriteria || []).map((item) => item.trim()).filter(Boolean),
        sourceMessageIds: [...new Set(request.sourceMessageIds || [])],
        attachmentIds: [...new Set(request.attachmentIds || [])],
        workspaceState: structuredClone(request.workspaceState),
        locale: request.locale,
        contentHash: sha256(normalizedIntent),
        ruleContext: request.ruleContext ? structuredClone(request.ruleContext) : null,
      },
      plans: [],
      executionRecords: [],
      flowEvents: [{
        eventId: randomUUID(),
        type: "task.submitted",
        stage: "task",
        status: "started",
        actor: participantSnapshot(initiatorMember),
        summary: "任务已提交并进入协同执行队列",
        occurredAt: now,
        error: false,
      }],
      versionWorkspace: null,
      finalResult: null,
      resultSummary: null,
      blockingReason: null,
      recoveryTargetState: null,
      startedAt: now,
      codeVerifiedAt: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    this.#commit("task.submitted", (state) => { state.tasks.push(task); }, [taskId]);
    return structuredClone(task);
  }

  task(taskId: string): CollaborationTaskOutDto {
    const task = this.#state.tasks.find((candidate) => candidate.taskId === taskId);
    if (!task) throw new Error("协同任务不存在。");
    return structuredClone(task);
  }

  updateTask(taskId: string, reason: string, update: (task: CollaborationTaskOutDto, state: CollaborationStateOutDto) => void): CollaborationStateOutDto {
    this.task(taskId);
    return this.#commit(reason, (state) => {
      const task = state.tasks.find((candidate) => candidate.taskId === taskId);
      if (!task) throw new Error("协同任务不存在。");
      update(task, state);
      task.updatedAt = new Date().toISOString();
    });
  }

  cancelTask(taskId: string): CollaborationStateOutDto {
    return this.updateTask(taskId, "task.cancelled", (task, state) => {
      const now = new Date().toISOString();
      task.state = "cancelled";
      task.phase = null;
      task.blockingReason = "用户取消任务";
      task.recoveryTargetState = null;
      task.completedAt = now;
      task.resultSummary = {
        outcome: "cancelled",
        finalResult: task.finalResult || "任务已取消，未完成协同集成。",
        originalProblem: task.snapshot.problemStatement,
        solvedProblem: task.resultSummary?.solvedProblem || "任务取消前未形成可确认的完整解决结果。",
        changes: task.resultSummary?.changes || "没有可确认的最终集成改动。",
        remaining: task.blockingReason || "任务已由用户取消。",
        success: false,
        generatedAt: now,
      };
      task.flowEvents.push({ eventId: randomUUID(), type: "task.cancelled", stage: "task", status: "cancelled", actor: task.initiator, summary: "用户取消任务", occurredAt: now, error: true });
      for (const record of task.executionRecords.filter((item) => item.completedAt === null)) {
        record.status = "cancelled";
        record.completedAt = now;
        record.blockingReason = "用户取消任务";
      }
      releaseTaskMembers(state, taskId);
    });
  }

  continueTask(taskId: string, recoveryActor?: Pick<CollaborationMemberOutDto, "memberId" | "displayName">): CollaborationStateOutDto {
    return this.updateTask(taskId, "task.recovery_requested", (task, state) => {
      if (!["recovering", "blocked", "test-failed"].includes(task.state)) throw new Error("当前任务不需要恢复。");
      if (task.state === "test-failed") {
        task.state = "ready-for-integration";
        task.blockingReason = null;
        task.flowEvents.push({ eventId: randomUUID(), type: "unified_test.retry_requested", stage: "recovery", status: "started", actor: task.initiator, summary: "已请求令狐老祖重新统一测试", occurredAt: new Date().toISOString(), error: false });
        return;
      }
      releaseTaskMembers(state, taskId);
      if (task.integrationFailure?.kind === "merge-conflict") {
        const files = task.integrationFailure.conflictFiles.join("、") || "未识别文件";
        task.taskRevision += 1;
        task.workerGeneration += 1;
        task.state = "queued-executor";
        task.assignmentId = null;
        // 冲突修正版必须由令狐在当前主线签发的新工作区内完成，禁止重新落回原执行人或复用旧结果。
        task.executorMemberId = null;
        task.preferredExecutorMemberId = LINGHU_MEMBER_ID;
        task.currentHandler = participantSnapshot(requireMember(state, LINGHU_MEMBER_ID));
        task.versionWorkspace = null;
        task.recoveryTargetState = "executing";
        task.phase = null;
        task.blockingReason = `等待令狐老祖基于当前主线重新修正冲突文件：${files}`;
        const actor = recoveryActor ? participantSnapshot(recoveryActor) : task.initiator;
        task.flowEvents.push({ eventId: randomUUID(), type: "integration.conflict_correction_requested", stage: "recovery", status: "started", actor, summary: `禁止重复集成旧 resultSha；已签发 r${task.taskRevision} 新修正版处理：${files}`, occurredAt: new Date().toISOString(), error: false });
        return;
      }
      if (task.versionWorkspace?.resultSha) {
        task.state = "ready-for-integration";
        task.recoveryTargetState = null;
      } else {
        task.state = "queued-executor";
        task.assignmentId = null;
      }
      task.phase = null;
      task.blockingReason = null;
      const actor = recoveryActor ? participantSnapshot(recoveryActor) : task.initiator;
      const summary = recoveryActor ? `${recoveryActor.displayName}正在处理流程中断，随后将任务退回原负责人重试` : "用户请求继续执行任务";
      task.flowEvents.push({ eventId: randomUUID(), type: "task.recovery_requested", stage: "recovery", status: "started", actor, summary, occurredAt: new Date().toISOString(), error: false });
    });
  }

  #member(memberId: string): CollaborationMemberOutDto {
    return structuredClone(requireMember(this.#state, memberId));
  }

  #commit(reason: string, mutate: (state: CollaborationStateOutDto) => void, explicitTaskIds: string[] = []): CollaborationStateOutDto {
    const next = structuredClone(this.#state);
    mutate(next);
    // 状态广播携带真实变更任务集合，使流程日志和错误日志能够稳定反查具体任务。
    const taskIds = explicitTaskIds.length > 0 ? explicitTaskIds : changedTaskIds(this.#state, next);
    next.updatedAt = new Date().toISOString();
    this.#write(next);
    this.#state = next;
    const snapshot = this.state();
    for (const listener of this.#listeners) listener(snapshot, reason, taskIds);
    return snapshot;
  }

  #load(): CollaborationStateOutDto {
    let loaded: CollaborationStateOutDto | null = null;
    try {
      const value = JSON.parse(readFileSync(this.#filePath, "utf8")) as CollaborationStateOutDto;
      if (value.version === 1 && Array.isArray(value.members) && Array.isArray(value.tasks)) loaded = value;
    } catch {
      // 首次启动或损坏状态都从稳定默认人物集合恢复，后续写入仍采用原子替换。
    }
    const state = loaded || createInitialState();
    // 每次启动进入协同模式；仅重置展示模式，不改变任务、人物或恢复点。
    state.mode = "collaboration";
    mergeDefaultMembers(state);
    recoverInterruptedState(state);
    this.#write(state);
    return state;
  }

  #loadPersistedState(): CollaborationStateOutDto {
    const value = JSON.parse(readFileSync(this.#filePath, "utf8")) as CollaborationStateOutDto;
    if (value.version !== 1 || !Array.isArray(value.members) || !Array.isArray(value.tasks) || !Array.isArray(value.integrationBatches)) {
      throw new Error("协作任务状态文件格式无效，无法确认测试数据已清空。");
    }
    return value;
  }

  #write(state: CollaborationStateOutDto): void {
    mkdirSync(path.dirname(this.#filePath), { recursive: true });
    const temporary = `${this.#filePath}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    renameSync(temporary, this.#filePath);
  }
}

function createInitialState(): CollaborationStateOutDto {
  const now = new Date().toISOString();
  return {
    version: 1,
    mode: "collaboration",
    selectedMemberId: "han-li",
    members: DEFAULT_MEMBERS.map((member) => createDefaultMember(member, now)),
    tasks: [],
    integrationBatches: [],
    nextIntegrationGeneration: 1,
    updatedAt: now,
  };
}

function createDefaultMember(member: (typeof DEFAULT_MEMBERS)[number], now: string): CollaborationMemberOutDto {
  const owner = member.kind === "conversation-owner";
  const protectedMember = owner || member.memberId === "linghu-ancestor";
  return {
    ...member,
    protected: protectedMember,
    enabled: true,
    state: owner ? "conversation" : "idle",
    role: owner ? "conversation" : null,
    phase: null,
    generation: owner ? 1 : 0,
    currentTaskId: null,
    blockingReason: null,
    lastHeartbeatAt: null,
    lastProtocolProgressAt: null,
    lastAssignedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function mergeDefaultMembers(state: CollaborationStateOutDto): void {
  const now = new Date().toISOString();
  for (const item of DEFAULT_MEMBERS) {
    if (!state.members.some((member) => member.memberId === item.memberId)) state.members.push(createDefaultMember(item, now));
  }
  // 稳定人物始终按产品定义排序；用户新增人物保持原相对顺序并排在稳定人物之后。
  const stableOrder = new Map(DEFAULT_MEMBERS.map((member, index) => [member.memberId, index]));
  state.members = state.members.map((member, originalIndex) => ({ member, originalIndex })).sort((left, right) => {
    const leftOrder = stableOrder.get(left.member.memberId);
    const rightOrder = stableOrder.get(right.member.memberId);
    if (leftOrder !== undefined && rightOrder !== undefined) return leftOrder - rightOrder;
    if (leftOrder !== undefined) return -1;
    if (rightOrder !== undefined) return 1;
    return left.originalIndex - right.originalIndex;
  }).map((entry) => entry.member);
  for (const member of state.members) {
    if (member.memberId === "linghu-ancestor") member.protected = true;
    member.lastHeartbeatAt ??= null;
    member.lastProtocolProgressAt ??= null;
  }
  for (const task of state.tasks) {
    const obsolete = task as CollaborationTaskOutDto & Record<string, unknown>;
    if (["queued-reviewer", "reviewing", "review-failed", "repairing-review", "optimizing", "approved", "forced-after-review-limit"].includes(String(task.state))) {
      task.state = "blocked";
      task.phase = "blocked";
      task.blockingReason = "旧执行人内部审批线路已删除；保留任务事实，需从南宫婉按当前流程重新分发。";
      task.recoveryTargetState = null;
    }
    delete obsolete.currentReviewerMemberId;
    delete obsolete.preferredReviewerMemberId;
    delete obsolete.originalReviewer;
    delete obsolete.explicitRejectionCount;
    delete obsolete.reviews;
    delete obsolete.reviewAttempts;
    task.preferredExecutorMemberId ??= null;
    task.evolutionProposalId ??= null;
    task.selfUpgradeTargetMemberId ??= null;
    task.selfUpgradeCapabilityScope ??= null;
    task.sourceEvolutionApprovalId ??= null;
    task.recoveryTargetState ??= null;
    migrateTaskHistory(task, state);
  }
  if (!state.members.some((member) => member.memberId === state.selectedMemberId)) state.selectedMemberId = "han-li";
}

function recoverInterruptedState(state: CollaborationStateOutDto): void {
  const interruptedTaskIds = new Set<string>();
  for (const task of state.tasks) {
    // 已在恢复态的任务保持原恢复点；重复启动不能再次追加相同的中断事实。
    if (TERMINAL_TASK_STATES.has(task.state) || task.state === "queued-executor" || task.state === "returned-to-nangong" || task.state === "ready-for-integration" || task.state === "awaiting-restart" || task.state === "recovering") continue;
    task.recoveryTargetState ??= task.state;
    task.state = "recovering";
    task.phase = null;
    task.blockingReason = "应用重建后等待继续执行";
    task.updatedAt = new Date().toISOString();
    task.flowEvents.push({ eventId: randomUUID(), type: "task.interrupted", stage: "recovery", status: "waiting", actor: null, summary: "应用重建中断原连接，等待用户继续", occurredAt: task.updatedAt, error: true });
    for (const record of task.executionRecords.filter((item) => item.completedAt === null)) {
      record.status = "blocked";
      record.blockingReason = task.blockingReason;
    }
    interruptedTaskIds.add(task.taskId);
  }
  for (const batch of state.integrationBatches) {
    // 已验证批次正在等待新进程确认，不是异常中断；保留发布检查点。
    if (batch.state === "frozen" || batch.state === "integrating") {
      batch.state = "failed";
      batch.completedAt = new Date().toISOString();
      batch.failureReason = "应用重建中断集成，等待用户恢复";
    }
  }
  for (const member of state.members) {
    if (member.protected) continue;
    if (member.currentTaskId && interruptedTaskIds.has(member.currentTaskId)) {
      member.state = "recovering";
      member.phase = null;
      member.blockingReason = "原 Codex 已关闭，等待恢复任务";
      member.lastHeartbeatAt = null;
      member.lastProtocolProgressAt = null;
    } else if (member.state !== "draining") {
      member.state = "idle";
      member.role = null;
      member.phase = null;
      member.currentTaskId = null;
      member.blockingReason = null;
      member.lastHeartbeatAt = null;
      member.lastProtocolProgressAt = null;
    }
    member.updatedAt = new Date().toISOString();
  }
}

function releaseTaskMembers(state: CollaborationStateOutDto, taskId: string): void {
  for (const member of state.members.filter((candidate) => candidate.currentTaskId === taskId)) {
    member.currentTaskId = null;
    member.role = null;
    member.phase = null;
    member.blockingReason = null;
    member.lastHeartbeatAt = null;
    member.lastProtocolProgressAt = null;
    member.state = member.state === "draining" ? "draining" : "idle";
    member.updatedAt = new Date().toISOString();
  }
}

function requireMember(state: CollaborationStateOutDto, memberId: string): CollaborationMemberOutDto {
  const member = state.members.find((candidate) => candidate.memberId === memberId);
  if (!member) throw new Error("协同人物不存在。");
  return member;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function participantSnapshot(member: Pick<CollaborationMemberOutDto, "memberId" | "displayName">): { memberId: string; displayName: string } {
  return { memberId: member.memberId, displayName: member.displayName };
}

/** 旧状态只能恢复当时实际落盘的事实；无法证明的早期参与者明确标为历史不完整，禁止按当前名单猜测。 */
function migrateTaskHistory(task: CollaborationTaskOutDto, state: CollaborationStateOutDto): void {
  const members = state.members;
  const memberName = (memberId: string | null): string => members.find((member) => member.memberId === memberId)?.displayName || "历史成员（名称未记录）";
  const legacy = !Array.isArray(task.flowEvents) || !Array.isArray(task.executionRecords);
  task.historyCompleteness ??= legacy ? "legacy-partial" : "complete";
  task.initiator ??= null;
  task.automationSource ??= null;
  task.startedAt ??= task.createdAt;
  task.codeVerifiedAt ??= task.finalResult ? task.completedAt : null;
  task.originalExecutor ??= task.executionRecords?.[0]?.executor || null;
  task.currentHandler ??= null;
  task.repairKind ??= null;
  task.repairFailureReason ??= null;
  task.repairDiagnosis ??= null;
  task.repairResult ??= null;
  task.unifiedTest ??= null;
  if (task.state === "integrated" && task.integrationGeneration !== null) {
    task.completedAt = state.integrationBatches.find((batch) => batch.generation === task.integrationGeneration)?.completedAt || task.completedAt;
  }
  task.executionRecords ??= task.executorMemberId ? [{
    assignmentId: task.assignmentId || `legacy-${task.taskId}`,
    executor: { memberId: task.executorMemberId, displayName: memberName(task.executorMemberId) },
    workerGeneration: task.workerGeneration,
    status: task.state === "integrated" ? "code-verified" : task.state === "cancelled" ? "cancelled" : "blocked",
    assignedAt: task.createdAt,
    executionStartedAt: null,
    completedAt: task.codeVerifiedAt || task.completedAt,
    transferFromAssignmentId: null,
    handoffType: "initial",
    result: task.finalResult,
    blockingReason: task.blockingReason,
  }] : [];
  for (const [index, record] of task.executionRecords.entries()) {
    record.handoffType ??= index === 0 ? "initial" : task.executionRecords[index - 1]?.executor.memberId === record.executor.memberId ? "resume" : "transfer";
    record.changedFiles ??= [];
  }
  task.flowEvents ??= [{
    eventId: randomUUID(),
    type: "task.legacy_imported",
    stage: "task",
    status: task.state === "integrated" ? "completed" : task.state === "cancelled" ? "cancelled" : "waiting",
    actor: null,
    summary: "旧版本任务已迁移；原版本未记录完整参与者与流转事件",
    occurredAt: task.createdAt,
    error: false,
  }];
  for (const plan of task.plans) plan.ownerDisplayName ??= memberName(plan.ownerMemberId);
  task.resultSummary ??= task.finalResult || task.state === "integrated" ? {
    outcome: task.state === "integrated" ? "succeeded" : task.state === "cancelled" ? "cancelled" : "pending-integration",
    finalResult: task.finalResult || "历史任务已完成协同集成；旧版本未保存结果摘要。",
    originalProblem: task.snapshot.problemStatement,
    solvedProblem: task.finalResult || "旧版本未保存独立的已解决问题摘要。",
    changes: task.finalResult || "旧版本未保存独立的具体改动摘要。",
    remaining: task.state === "integrated" ? "无已知遗留内容。" : task.blockingReason || "等待后续处理。",
    success: task.state === "integrated",
    generatedAt: task.completedAt || task.updatedAt,
  } : null;
}

function changedTaskIds(previous: CollaborationStateOutDto, next: CollaborationStateOutDto): string[] {
  const previousById = new Map(previous.tasks.map((task) => [task.taskId, JSON.stringify(task)]));
  return next.tasks.filter((task) => previousById.get(task.taskId) !== JSON.stringify(task)).map((task) => task.taskId);
}
