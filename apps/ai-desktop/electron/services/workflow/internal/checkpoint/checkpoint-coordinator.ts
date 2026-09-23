import type { CollaborationStateOutDto, WorkflowExceptionRecordOutDto, SubmitCollaborationTaskInDto } from "../../../../../contracts/services/workflow/index.js";
import type { EvolutionStateOutDto, EvolutionTechnicalRecoveryOutDto } from "../../../../../contracts/services/evolution/index.js";
import { WorkflowCheckpointAggregate, type WorkflowCheckpointState } from "../../domain/workflow-checkpoint.aggregate.js";
import { ProposalRevisionChain } from "../../domain/proposal-revision-chain.js";
import { createTechnicalRecoveryIssueId, isAcceptanceFailureOperation } from "../evolution/one-shot-failure-identity.js";
import type { CheckpointHandoffService } from "./checkpoint-handoff.service.js";
import { selectCurrentAcceptanceFailure, selectRepeatedAcceptanceFailures } from "./checkpoint-failure-selection.js";
import { checkpointResolutionIdentity, type CheckpointResolvedRoundEvent } from "./checkpoint-resolution-identity.js";

export interface CheckpointCoordinatorOptions {
  /** 读取当前 Evolution 专题、提案和一次性运行快照。 */
  evolution(): EvolutionStateOutDto;
  /** 读取当前协作人物和任务快照。 */
  collaboration(): CollaborationStateOutDto;
  /** 读取尚未解除的 Workflow 异常事实。 */
  pending(): WorkflowExceptionRecordOutDto[];
  /** 保存卡点聚合完整快照。 */
  save(eventId: string, state: WorkflowCheckpointState): void;
  /** 原流程复验通过后解除对应异常。 */
  resolve(eventId: string, reason: string): void;
  /** 从持久恢复点继续指定一次性运行。 */
  resume(runId: string): Promise<EvolutionStateOutDto>;
  /** 把已有任务交给令狐恢复能力处理。 */
  handleTask(taskId: string, stalled?: boolean): Promise<void>;
  /** 新增验收证据接续到确切原任务，保留未解除的客户等待。 */
  refreshRepair(taskId: string, request: SubmitCollaborationTaskInDto): Promise<unknown>;
  /** 创建一条受范围限制的真实修复任务。 */
  submitRepair(request: SubmitCollaborationTaskInDto): CollaborationStateOutDto;
  /** 唯一 Evolution 状态写入端；异常 payload 不再拥有页面恢复状态。 */
  recordTechnicalRecovery(input: Omit<EvolutionTechnicalRecoveryOutDto, "updatedAt">): void;
  /** 所有引用的卡点事件均有持久 resolved 事实时才解除页面恢复状态。 */
  areTechnicalRecoveryEventsResolved(eventIds: string[]): boolean;
  /** 发布卡点人物交接与时间线事实。 */
  handoff: Pick<CheckpointHandoffService, "publish">;
}

/** 统一卡点分流只持有原事实与恢复关系；调查和改代码由令狐真实任务完成。 */
export class CheckpointCoordinator {
  /** 当前是否已有卡点批次运行，避免监督轮询并发重入。 */
  #busy = false;
  /** 使用状态、恢复、任务和交接端口创建 Coordinator。 */
  constructor(private readonly options: CheckpointCoordinatorOptions) {}

  async process(events: WorkflowExceptionRecordOutDto[]): Promise<void> {
    // 同一 Coordinator 同时只能处理一批卡点，避免重复派发修复任务。
    if (this.#busy) {
      // 已有批次运行时等待下一次监督轮询。
      return;
    }
    // 标记当前批次已经取得处理权。
    this.#busy = true;
    try {
      this.#reconcileResolvedTechnicalRecovery();
      // 只处理明确影响流程继续执行的异常。
      for (const event of events.filter((item) => item.flowImpact === "blocked")) {
        try {
          // 单条异常沿自身聚合状态推进，不影响其他异常。
          await this.#advance(event);
        } catch (error) {
          // 失败时重新读取当前持久卡点，保留已完成阶段。
          const state = this.#state(event);
          // 把异常转为可恢复等待事实，不吞掉真实失败原因。
          let errorMessage = String(error);
          // Error 对象优先使用稳定 message，避免把堆栈写入业务正文。
          if (error instanceof Error) {
            // 保存可读错误消息。
            errorMessage = error.message;
          }
          // 把真实错误原因写入等待节点。
          this.#phase(event, state, "waiting", `处理未完成：${errorMessage}。保留原卡点，后续检查继续核对。`);
        }
      }
    } finally {
      // 无论单条异常是否失败都释放批次锁。
      this.#busy = false;
    }
  }

  /** 重启后从持久事件状态核对旧卡点是否已解除，保留问题次数与证据。 */
  #reconcileResolvedTechnicalRecovery(): void {
    const recovery = this.options.evolution().technicalRecovery;
    if (!recovery?.active || !recovery.evidenceReferences.length
      || !this.options.areTechnicalRecoveryEventsResolved(recovery.evidenceReferences)) return;
    this.#recordTechnicalRecovery({ ...recovery, active: false, nextAction: "卡点已解除，继续当前专题验收。" });
  }

  /** 相同卡点投影在监督轮询中保持幂等，避免只刷新 updatedAt 形成事件风暴。 */
  #recordTechnicalRecovery(input: Omit<EvolutionTechnicalRecoveryOutDto, "updatedAt">): void {
    const current = this.options.evolution().technicalRecovery;
    if (current && technicalRecoveryProjection(current) === technicalRecoveryProjection(input)) return;
    this.options.recordTechnicalRecovery(input);
  }

  /** 单一页面投影只允许更新事实接替旧事实；历史卡点重放不能反复抢回当前状态。 */
  #isOlderThanCurrentRecovery(issueId: string, event: WorkflowExceptionRecordOutDto): boolean {
    const current = this.options.evolution().technicalRecovery;
    if (!current?.active || current.issueId === issueId) return false;
    const currentOccurrence = [...current.occurrences]
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)
        || (right.occurrenceId || "").localeCompare(left.occurrenceId || ""))[0];
    if (!currentOccurrence) return false;
    return currentOccurrence.occurredAt > event.occurredAt
      || (currentOccurrence.occurredAt === event.occurredAt && (currentOccurrence.occurrenceId || "") >= event.eventId);
  }

  #state(event: WorkflowExceptionRecordOutDto): WorkflowCheckpointState {
    // 读取 Evolution 和协作事实，为旧事件恢复完整的领域卡点快照。
    const evolution = this.options.evolution();
    // 先按异常关联标识寻找真实原任务。
    const task = this.options.collaboration().tasks.find((item) => item.taskId === event.correlationId || item.taskId === event.payload.taskId);
    // 再按异常提案标识或任务关系寻找原提案。
    const referencedProposal = evolution.proposals.find((item) => item.proposalId === event.payload.proposalId || item.proposalId === task?.evolutionProposalId);
    // 卡点事件可能早于客户范围修订。恢复时沿不可变的替代链选择当前
    // 提案版本，避免把旧验收条件重新写进新的修复任务。
    const proposal = referencedProposal
      ? new ProposalRevisionChain(evolution.proposals).currentFrom(referencedProposal.proposalId)
      : undefined;
    // 单任务提案即使原任务记录缺失，也能使用持久分发标识建立明确替代关系。
    let proposalTaskId: string | null = null;
    // 只有唯一分发任务时才能从提案确定原任务身份。
    if (proposal?.distributedTaskIds?.length === 1) {
      // 保存唯一原任务标识，禁止在多任务提案中猜测替代对象。
      proposalTaskId = proposal.distributedTaskIds[0] || null;
    }
    // 原阶段优先使用异常事实，其次使用任务阶段。
    const sourcePhase = text(event.payload.phase) || task?.phase || "未知节点";
    // 恢复点优先使用异常事实，没有时保留明确等待说明。
    const recoveryPoint = text(event.payload.recoveryPoint) || "等待恢复原步骤";
    // 由领域聚合统一校验旧快照或创建第一轮卡点状态。
    let runId: string | null = null;
    // 只接受字符串类型的一次性运行标识。
    if (typeof event.payload.runId === "string") {
      // 保存经过类型核对的运行标识。
      runId = event.payload.runId;
    }
    let sourceMemberId = task?.executorMemberId || "nangong-wan";
    // 验收阶段卡点必须归回韩立而不是当前执行人。
    if (event.payload.phase === "accepting" || isAcceptanceFailureOperation(event.payload.operation)) {
      // 保存韩立稳定人物标识。
      sourceMemberId = "han-li";
    }
    const aggregate = WorkflowCheckpointAggregate.restore(event.payload.checkpoint, {
      // 保留完整异常记录供聚合生成问题与影响说明。
      event,
      // 只接受字符串类型的一次性运行标识。
      runId,
      // 保存已核对的提案标识。
      proposalId: proposal?.proposalId || null,
      // 保存已核对的专题标识。
      topicId: proposal?.topicId || null,
      // 优先使用真实任务，记录缺失时使用唯一原分发任务标识。
      taskId: task?.taskId || proposalTaskId,
      // 验收卡点属于韩立，其他卡点属于真实执行人或南宫婉。
      sourceMemberId,
      // 保存原流程业务阶段。
      sourcePhase,
      // 保存修复完成后的返回位置。
      recoveryPoint,
    });
    // Coordinator 只拿副本执行外部动作，状态规则仍由聚合维护。
    return aggregate.snapshot();
  }

  #phase(
    event: WorkflowExceptionRecordOutDto,
    state: WorkflowCheckpointState,
    phase: WorkflowCheckpointState["phase"],
    content: string,
    resolvedRoundEvents: readonly CheckpointResolvedRoundEvent[] = [],
  ): void {
    // 先保存原阶段，领域状态更新后仍能判断是否需要追加新的时间线事实。
    const previousPhase = state.phase;
    // 使用聚合保证阶段与最新进展在同一次业务操作中变化。
    const aggregate = new WorkflowCheckpointAggregate(state);
    // 空阶段只在初始化快照中存在，发布动作必须使用真实阶段。
    if (!phase) throw new Error("卡点阶段不能为空。");
    // 推进聚合到目标阶段。
    aggregate.moveTo(phase, content);
    // 取得新的完整卡点快照。
    const next = aggregate.snapshot();
    // 保持当前调用链引用稳定，同时收回零散字段修改。
    Object.assign(state, next);
    if (previousPhase === phase) {
      this.options.save(event.eventId, state);
      this.#publishTechnicalRecovery(event, state);
      return;
    }
    // 新阶段先发布真实人物交接事实。
    this.options.handoff.publish(event, state, phase, content, resolvedRoundEvents);
    // 聚合已经同步更新 phase，此处只保存完整快照。
    this.options.save(event.eventId, state);
    // 同步当前内存异常对象，保证本批次后续读取同一快照。
    event.payload.checkpoint = structuredClone(state);
    this.#publishTechnicalRecovery(event, state);
  }

  /** 将已验证的协调器事实投影回唯一 Evolution 状态；缺少验收条件时只报告不可计数。 */
  #publishTechnicalRecovery(event: WorkflowExceptionRecordOutDto, state: WorkflowCheckpointState): void {
    if (!state.topicId || !state.proposalId) return;
    const evolution = this.options.evolution();
    const proposal = evolution.proposals.find((item) => item.proposalId === state.proposalId);
    const scope = event.payload.acceptanceFailureScope as { defects?: unknown } | undefined;
    const scopedConditionIds = Array.isArray(scope?.defects)
      ? scope.defects.map((item) => (item as { checkId?: unknown }).checkId).filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
      : [];
    // 执行链卡点没有逐项验收缺陷时，只有冻结提案的条件集合可作为同一问题的可核验依据。
    const proposalConditionIds = Array.isArray(proposal?.acceptancePlan?.conditions)
      ? proposal.acceptancePlan.conditions.map((item) => item.conditionId).filter(Boolean)
      : Array.isArray(proposal?.acceptanceCriteria)
        ? proposal.acceptanceCriteria.map((_item, index) => `criterion-${index + 1}`)
        : [];
    // 旧专题快照可能早于验收条件字段；缺少依据只能降级为未核验，不能中断卡点恢复。
    const conditionIds = scopedConditionIds.length ? scopedConditionIds : proposalConditionIds;
    const failureCategory = typeof event.payload.acceptanceFailureKind === "string" ? event.payload.acceptanceFailureKind : String(event.payload.operation || "technical-runtime");
    const previous = this.options.evolution().technicalRecovery;
    const now = new Date().toISOString();
    if (state.phase === "resolved") return;
    if (!conditionIds.length) {
      const issueId = `unverified:${state.topicId}:${state.proposalId}`;
      if (this.#isOlderThanCurrentRecovery(issueId, event)) return;
      const previousOccurrence = previous?.occurrences.find((item) => item.occurrenceId === event.eventId);
      this.#recordTechnicalRecovery({ issueId, faultFingerprint: event.fingerprint || null, topicId: state.topicId, proposalId: state.proposalId, acceptanceConditionIds: [], failureCategory, evidenceReferences: [event.eventId], occurrences: [{ runId: state.runId, taskId: state.taskId, occurrenceId: event.eventId, reason: event.message, occurredAt: previousOccurrence?.occurredAt || event.occurredAt || now }], attemptCount: previous?.attemptCount || 0, handler: "system", handoffStatus: "basis-unverified", failureReason: "缺少可核验的原验收条件，未改变技术问题次数。", nextAction: "系统重新读取原验收条件与失败依据。", active: true });
      return;
    }
    const issueId = createTechnicalRecoveryIssueId({ topicId: state.topicId, proposalId: state.proposalId, acceptanceConditionIds: conditionIds, failureCategory });
    if (this.#isOlderThanCurrentRecovery(issueId, event)) return;
    const sameRecovery = previous?.issueId === issueId ? previous : null;
    const attemptCount = sameRecovery ? Math.max(sameRecovery.attemptCount, state.round) : state.round;
    // 次数只是调查历史，不是自动托管的停止条件；只有聚合已确认外部等待或取消导致耗尽时才交给监控。
    const monitoring = state.phase === "exhausted";
    const newestPreviousOccurrence = sameRecovery ? [...sameRecovery.occurrences]
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)
        || (right.occurrenceId || "").localeCompare(left.occurrenceId || ""))[0] : undefined;
    // 同一问题可能聚合多个卡点事件；重放较旧事件时只合并其证据，不能用旧阶段覆盖较新的页面状态。
    const preservesNewerProjection = Boolean(newestPreviousOccurrence
      && (newestPreviousOccurrence.occurredAt > event.occurredAt
        || (newestPreviousOccurrence.occurredAt === event.occurredAt
          && (newestPreviousOccurrence.occurrenceId || "") > event.eventId)));
    const derivedHandoffStatus: EvolutionTechnicalRecoveryOutDto["handoffStatus"] = monitoring ? "monitoring" : state.repairTaskId ? "handed-off" : state.phase === "waiting" ? "failed" : "pending";
    const handoffStatus = preservesNewerProjection ? sameRecovery!.handoffStatus : derivedHandoffStatus;
    const previousOccurrence = sameRecovery?.occurrences.find((item) => item.occurrenceId === event.eventId);
    const occurrences = [
      ...(sameRecovery ? sameRecovery.occurrences.filter((item) => item.occurrenceId !== event.eventId) : []),
      { runId: state.runId, taskId: state.repairTaskId || state.taskId, occurrenceId: event.eventId, reason: state.latestProgress || event.message, occurredAt: previousOccurrence?.occurredAt || event.occurredAt || now },
    ].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt)
      || (left.occurrenceId || "").localeCompare(right.occurrenceId || "")).slice(-3);
    this.#recordTechnicalRecovery({ issueId, faultFingerprint: preservesNewerProjection ? sameRecovery!.faultFingerprint || null : event.fingerprint || null, topicId: state.topicId, proposalId: state.proposalId, acceptanceConditionIds: conditionIds, failureCategory, evidenceReferences: [...new Set([...(sameRecovery ? sameRecovery.evidenceReferences : []), event.eventId])], occurrences, attemptCount, handler: preservesNewerProjection ? sameRecovery!.handler : monitoring ? "monitor" : state.repairTaskId ? "linghu-ancestor" : "system", handoffStatus, failureReason: preservesNewerProjection ? sameRecovery!.failureReason : handoffStatus === "failed" ? state.latestProgress || event.message : null, nextAction: preservesNewerProjection ? sameRecovery!.nextAction : monitoring ? "监控接管复验，并保留本轮依据。" : handoffStatus === "handed-off" ? "等待令狐沿原验收范围调查、修复并复验。" : "系统重试写入令狐交接。", active: true });
  }

  /** 未分类的验收受阻只保留可恢复事实，不能猜测为产品或验收能力缺陷。 */
  #holdAcceptanceWithoutLinghu(
    event: WorkflowExceptionRecordOutDto,
    state: WorkflowCheckpointState,
    failureEvent: WorkflowExceptionRecordOutDto,
  ): void {
    // 缺少结构化分类时只保存恢复状态，不能额外伪造令狐参与。
    const aggregate = new WorkflowCheckpointAggregate(state);
    aggregate.moveTo("waiting", `验收能力或运行环境受阻：${failureEvent.message}。保留原条件，等待可恢复重跑。`);
    Object.assign(state, aggregate.snapshot());
    // 不经 #phase，避免 CheckpointHandoffService 把等待投影为令狐卡点。
    this.options.save(event.eventId, state);
    event.payload.checkpoint = structuredClone(state);
  }

  /** 收集同一原任务、同一恢复轮次已解除的异常，供唯一完成事实保留完整审计详情。 */
  #resolvedRoundEvents(event: WorkflowExceptionRecordOutDto, state: WorkflowCheckpointState): CheckpointResolvedRoundEvent[] {
    // 当前事实的稳定身份是同轮异常是否应共用完成节点的唯一判断依据。
    const identity = checkpointResolutionIdentity(event, state);
    // pending 保留每条异常的关闭审计；这里只汇集详情，不改变其解除归属。
    const related: CheckpointResolvedRoundEvent[] = [];
    for (const candidate of this.options.pending()) {
      // 非阻塞事件没有解除语义，不能混入同轮完成详情。
      if (candidate.flowImpact !== "blocked") continue;
      try {
        // 每条候选独立恢复；损坏的其他异常不能阻断当前已验证的解除事实。
        const candidateCheckpoint = this.#state(candidate);
        if (checkpointResolutionIdentity(candidate, candidateCheckpoint) === identity) {
          related.push({ event: candidate, checkpoint: candidateCheckpoint });
        }
      } catch {
        // 损坏事实仍由自身处理分支保留等待，不以详情汇集改变当前卡点结果。
      }
    }
    // 详情顺序只依赖持久发生时间和事件标识，重放保持相同正文。
    return related.sort((left, right) => left.event.occurredAt.localeCompare(right.event.occurredAt)
      || left.event.eventId.localeCompare(right.event.eventId));
  }

  async #advance(event: WorkflowExceptionRecordOutDto): Promise<void> {
    const state = this.#state(event);
    const evolution = this.options.evolution();
    const task = this.options.collaboration().tasks.find((item) => item.taskId === state.taskId);
    const run = evolution.oneShotRun;
    const proposal = evolution.proposals.find((item) => item.proposalId === state.proposalId);
    // 故障事实独立于保存恢复关系的主卡点；旧技术事件也必须消费最新验收结果。
    const relatedEvents = this.options.pending().filter((item) => item.payload.runId === state.runId
      && item.payload.proposalId === state.proposalId);
    const failureEvent = selectCurrentAcceptanceFailure(event, relatedEvents, state.proposalId || "");
    const repeatedAcceptanceFailures = selectRepeatedAcceptanceFailures(relatedEvents, state.proposalId || "");

    // 直接关联 taskId 的异常属于任务自身；只有韩立结果验收或没有任务直连的验收阶段才归韩立复验。
    const directlyTargetsTask = Boolean(task && (event.correlationId === task.taskId || event.payload.taskId === task.taskId));
    // 韩立验收发生在开发任务集成之后；此时 integrated 只能说明代码已交付，不能说明客户要求已经通过。
    const isAcceptanceCheckpoint = isAcceptanceFailureOperation(failureEvent.payload.operation) || (state.sourcePhase === "accepting" && !directlyTargetsTask);
    // 一次性原流程明确 completed，才是验收卡点已经通过复验的权威事实。
    const originalRunCompleted = Boolean(state.runId && run?.runId === state.runId && run.proposalId === state.proposalId && run.status === "completed");
    // 原流程已经产生真实完成事实时直接解除，不再补写令狐接收或修复节点。
    if (isAcceptanceCheckpoint && originalRunCompleted) {
      this.options.resolve(event.eventId, "验收受阻已由原流程完成事实解除");
      this.#reconcileResolvedTechnicalRecovery();
      return;
    }
    // 验收分类是唯一的令狐派发依据：产品缺陷和既有验收能力故障都进入真实修复链；缺少分类不能猜测。
    if (isAcceptanceCheckpoint && failureEvent.payload.acceptanceFailureKind !== "product-defect"
      && failureEvent.payload.acceptanceFailureKind !== "acceptance-capability-blocked") {
      this.#holdAcceptanceWithoutLinghu(event, state, failureEvent);
      return;
    }
    if (!state.phase) {
      // 只有真实产品或安全失败才进入令狐卡点交接。
      this.#phase(event, state, "reported", event.message);
    }
    if (state.phase === "reported") {
      // 令狐接收不代表问题已经修复。
      this.#phase(event, state, "received", "令狐已接收原因和原流程标识；接收不代表修复完成。");
    }
    // 非验收任务仍沿用原规则：任务完成集成即可确认对应执行卡点已经解除。
    const originalTaskCompleted = !isAcceptanceCheckpoint && task?.state === "integrated";
    if (originalTaskCompleted || originalRunCompleted) {
      this.#phase(event, state, "resolved", "原任务已完成验证，确认此卡点解除；历史轮次保留。", this.#resolvedRoundEvents(event, state));
      this.options.resolve(event.eventId, "原任务完成事实已确认");
      this.#reconcileResolvedTechnicalRecovery();
      return;
    }
    // 明确暂停、取消及业务授权问题不能因统一受理而变成自动放权。
    if ((state.runId === run?.runId && ["paused", "stopped"].includes(evolution.automationRuntime.status)) || task?.state === "cancelled" || event.category === "business-exception" || failureEvent.category === "business-exception") {
      this.#phase(event, state, "waiting", "已保留卡点，当前为人工暂停或业务选择，需用户明确后继续，不自动改写授权。");
      return;
    }
    // 审批尚未形成执行任务时，模型结构化输出异常只能保留给韩立和南宫婉重新处理，不能伪装成实施失败派发令狐。
    if (event.payload.operation === "review_one_shot_proposal") {
      this.#phase(event, state, "waiting", "韩立审批尚未形成执行任务，已保留运行时异常等待重新审批或提案调查；不创建令狐修复任务。");
      return;
    }
    // 验收卡点中的 task 只是已经集成的原开发任务；它不能代替令狐调查当前真实界面阻塞。
    if (task && !isAcceptanceCheckpoint) {
      const member = this.options.collaboration().members.find((item) => item.memberId === task.executorMemberId);
      const heartbeat = [member?.lastHeartbeatAt, member?.lastProtocolProgressAt, task.updatedAt].filter((value): value is string => Boolean(value)).sort().at(-1);
      const stalled = event.category === "stalled" && heartbeat === event.payload.lastHeartbeatAt;
      // 原执行人的自修复和正常测试不抢占；只把真正停住的任务送给既有令狐恢复能力。
      if (["blocked", "recovering"].includes(task.state) || stalled) {
        this.#phase(event, state, "repairing", "已交给令狐核对原任务恢复条件，沿既有任务修复链处理。");
        await this.options.handleTask(task.taskId, stalled);
      } else this.#phase(event, state, "resuming", `原任务正在${task.phase}，继续观察，不抢占执行人自修复。`);
      return;
    }
    const topic = evolution.topics.find((item) => item.topicId === state.topicId);
    if (!topic || !proposal || !state.runId || run?.runId !== state.runId || run.proposalId !== proposal.proposalId) {
      this.#phase(event, state, "waiting", "无法确认原任务或授权工作区，已交令狐留痕等待核实；不猜测目标、不派发无范围修复。");
      return;
    }
    if (run.status === "running") {
      this.#phase(event, state, "resuming", "已回到原流程继续验证；尚未认定整个任务通过。");
      return;
    }
    if (run.status !== "blocked") {
      this.#phase(event, state, "waiting", "原运行并非可自动恢复的受阻状态，保留事实等待明确恢复条件。");
      return;
    }
    // 同一提案已有后续令狐修复任务时，旧卡点不能再把新验收事实写回已交付的旧任务。
    // 退出旧主卡点后，后续事件才能成为主记录并沿自己的恢复关系推进。
    if (state.repairTaskId && !state.exhausted) {
      const tasks = this.options.collaboration().tasks;
      const previousRepairIndex = tasks.findIndex((item) => item.taskId === state.repairTaskId);
      const newerRepair = previousRepairIndex < 0 ? undefined : tasks.slice(previousRepairIndex + 1).find((item) =>
        item.automationSource === "linghu-safeguard"
        && item.evolutionProposalId === state.proposalId
        && item.state !== "cancelled");
      if (newerRepair) {
        const aggregate = new WorkflowCheckpointAggregate(state);
        aggregate.exhaust();
        Object.assign(state, aggregate.snapshot());
        this.#phase(event, state, "exhausted", `后续修复任务 ${newerRepair.taskId} 已接管同一提案；旧卡点停止重开原修复任务。`);
        return;
      }
    }
    if (state.exhausted) {
      // 已耗尽卡点只能等待新增事实或人工处理。
      return;
    }
    // 同一运行可以承载用户后来确认的新提案；只有同一提案的卡点才能共享修复记录。

    // 使用命名比较器选择已经建立修复任务或最早出现的主卡点。
    relatedEvents.sort(compareCheckpointPriority);
    // 第一条记录是同一原运行的唯一主卡点。
    const primary = relatedEvents[0];
    if (primary && primary.eventId !== event.eventId) {
      this.#phase(event, state, "waiting", `同一原流程已有卡点 ${primary.eventId} 正在处理，本条保留关联，不重复派发。`);
      return;
    }
    // 上轮恢复异步返回running后仍可能再次受阻，必须开新修复轮，不能无限重放旧成果。
    if (state.resumedRound === state.round) {
      const aggregate = new WorkflowCheckpointAggregate(state);
      aggregate.startNextRound(evolution.automationSettings.automaticCustodyEnabled === true);
      Object.assign(state, aggregate.snapshot());
      if (aggregate.isExhausted()) {
        // 达到上限后发布一次稳定耗尽事实。
        this.#phase(event, state, "exhausted", "三轮修复后的原点复验仍受阻，停止重复派发，等待新增事实。");
        // 禁止进入后续派发逻辑。
        return;
      }
      this.#phase(event, state, "received", `原点复验再次受阻：${run.blockingReason || event.message}。上一轮没有解除原故障，进入新的根因调查，禁止重复原修复方向。`);
    }
    // 用持久任务标记查重，覆盖创建任务后、保存关联前崩溃的窗口。
    const marker = checkpointRepairMarker(event, state, relatedEvents);
    const collaborationTasks = this.options.collaboration().tasks;
    // 持久关联优先于兼容性标记回查；新卡点的旧轮次标记可能与历史任务相同。
    const repair = collaborationTasks.find((item) => item.taskId === state.repairTaskId)
      || collaborationTasks.find((item) => item.snapshot.constraints.includes(marker));
    if (repair) {
      const request = buildCheckpointRepairRequest(state, topic, proposal, failureEvent, repeatedAcceptanceFailures, marker);
      const evidenceMarker = `卡点故障事实：${failureEvent.eventId}`;
      if (repair.state !== "cancelled" && isAcceptanceFailureOperation(failureEvent.payload.operation)
        && !repair.snapshot.constraints.includes(evidenceMarker)) {
        await this.options.refreshRepair(repair.taskId, request);
        this.#phase(event, state, "received", "最新验收证据已写回原修复任务；旧结果不再代表本轮修复，原等待条件继续有效。");
        return;
      }

      // 用真实任务标识修复创建任务后、保存关系前崩溃的窗口。
      const aggregate = new WorkflowCheckpointAggregate(state);
      // 登记当前轮唯一修复任务。
      aggregate.registerRepairTask(repair.taskId);
      // 从结构化失败调查中形成可展示调查证据。
      let investigation: string | undefined;
      // 结构化调查存在时保存失败摘要和修复指令。
      if (repair.repairDiagnosis) {
        // 两项事实共同组成可展示调查结论。
        investigation = `${repair.repairDiagnosis.failureSummary}\n修复方案：${repair.repairDiagnosis.repairInstruction}`;
      }
      // 优先使用结构化结果摘要，旧任务再退回原始 repairResult。
      let repairResult = repair.repairResult || undefined;
      // 新任务存在结构化结果时使用完整问题、改变和遗留项。
      if (repair.resultSummary) {
        // 结构化摘要优先于旧自由文本。
        repairResult = `${repair.resultSummary.solvedProblem}\n具体改变：${repair.resultSummary.changes}\n遗留：${repair.resultSummary.remaining || "无"}`;
      }
      // 统一测试存在时保留状态和真实失败原因。
      let testResult: string | undefined;
      // 只有已经建立统一测试记录时生成测试说明。
      if (repair.unifiedTest) {
        // 默认先记录测试状态。
        testResult = `统一测试：${repair.unifiedTest.status}`;
        // 测试失败原因存在时追加原始原因。
        if (repair.unifiedTest.failureReason) {
          // 失败正文不能被状态名称覆盖。
          testResult += `；${repair.unifiedTest.failureReason}`;
        }
      }
      // 调查、修改和测试证据通过同一个聚合动作保存。
      aggregate.recordRepairEvidence(investigation, repairResult, testResult);
      // 用聚合快照替换当前调用链状态。
      Object.assign(state, aggregate.snapshot());
      if (repair.state === "integrated") {
        this.#phase(event, state, "returned", `令狐修复任务 ${repair.taskId} 已完成测试与集成，交回原步骤重新验证。`);
        // 先持久化返回点；失败或重启仍会重试恢复，不把返回当作解除。
        const resumed = await this.options.resume(state.runId);
        const aggregate = new WorkflowCheckpointAggregate(state);
        aggregate.markResumed();
        Object.assign(state, aggregate.snapshot());
        if (resumed.oneShotRun?.status === "blocked") {
          const blockedAggregate = new WorkflowCheckpointAggregate(state);
          blockedAggregate.startNextRound(resumed.automationSettings.automaticCustodyEnabled === true);
          Object.assign(state, blockedAggregate.snapshot());
          if (blockedAggregate.isExhausted()) {
            // 三轮原点复验都失败后结束自动修复。
            this.#phase(event, state, "exhausted", "同一卡点三轮修复后仍受阻，停止重复派发，等待新增事实或人工处理。");
            // 禁止继续进入新一轮。
            return;
          }
          this.#phase(event, state, "received", `原点复验仍受阻：${resumed.oneShotRun.blockingReason || "尚未解除"}。本轮修复方向未解除原故障，开始新的根因调查并禁止重复原方案。`);
        } else {
          // 恢复成功只表示回到原流程，最终通过仍由原验收链判断。
          this.#phase(event, state, "resuming", "修复已交回，原流程正在重新验证；未直接标记验收通过。");
        }
      } else if (repair.state === "cancelled") {
        // 取消修复任务后由聚合关闭自动派发。
        const cancelledAggregate = new WorkflowCheckpointAggregate(state);
        // 记录不可继续的耗尽事实。
        cancelledAggregate.exhaust();
        // 用聚合快照更新当前调用链。
        Object.assign(state, cancelledAggregate.snapshot());
        this.#phase(event, state, "exhausted", "修复任务已取消，保留原卡点，不自动重新派发。");
      } else if (["blocked", "recovering"].includes(repair.state)) {
        this.#phase(event, state, "waiting", `令狐修复任务仍受阻：${repair.blockingReason || repair.state}；沿此修复任务处理，不重复创建。`);
        await this.options.handleTask(repair.taskId);
      } else {
        // 默认阶段是调查修复。
        let repairPhase: WorkflowCheckpointState["phase"] = "repairing";
        // 进入测试、集成或重启验证后切换为 testing。
        if (["unified-testing", "awaiting-restart", "integrating", "queued-integration"].includes(repair.state)) {
          // 使用明确验证阶段。
          repairPhase = "testing";
        }
        // 发布与真实任务状态对应的进展。
        this.#phase(event, state, repairPhase, `令狐修复任务 ${repair.taskId}：${repair.state}。${repair.blockingReason || "正在沿调查、执行、自检和统一测试流程处理。"}`);
      }
      return;
    }
    // 令狐已有真实任务时等待其完成，不能再创建第二个修复任务。
    if (this.options.collaboration().members.find((member) => member.memberId === "linghu-ancestor")?.currentTaskId) {
      // 下一次监督轮询会继续核对当前任务。
      return;
    }
    const result = this.options.submitRepair(buildCheckpointRepairRequest(state, topic, proposal, failureEvent, repeatedAcceptanceFailures, marker));
    const repairTaskId = result.tasks.find((item) => item.snapshot.constraints.includes(marker))?.taskId || null;
    if (!repairTaskId) throw new Error("未获得真实修复任务标识，不能报告派发完成");
    const aggregate = new WorkflowCheckpointAggregate(state);
    aggregate.registerRepairTask(repairTaskId);
    Object.assign(state, aggregate.snapshot());
    this.#phase(event, state, "repairing", `令狐已接收第 ${state.round} 轮真实调查修复任务 ${state.repairTaskId}。`);
  }
}


/** 新建与接续共用原批准范围和本轮故障事实，不维护第二套修复指令。 */
function buildCheckpointRepairRequest(
  state: WorkflowCheckpointState,
  topic: EvolutionStateOutDto["topics"][number],
  proposal: EvolutionStateOutDto["proposals"][number],
  failureEvent: WorkflowExceptionRecordOutDto,
  repeatedAcceptanceFailures: WorkflowExceptionRecordOutDto[],
  marker: string,
): SubmitCollaborationTaskInDto {
  const acceptanceFailureKind = failureEvent.payload.acceptanceFailureKind === "product-defect"
    ? "product-defect"
    : failureEvent.payload.acceptanceFailureKind === "acceptance-capability-blocked" ? "acceptance-capability-blocked" : "technical-runtime";
  const repairBoundary = acceptanceFailureKind === "product-defect"
    ? "本轮属于真实产品缺陷：必须先复现实际产品结果，再修改产品实现；不得仅修改韩立验收工具、提示词或测试数据来制造通过。"
    : acceptanceFailureKind === "acceptance-capability-blocked"
      ? "本轮属于验收能力受阻：只能在已批准范围内修复现有验收能力；安全性不代表已获授权。原专题或提案排除的工具扩展必须先报告范围冲突，等待明确授权；不得修改产品页面来迎合截图或定位工具。"
      : "本轮属于运行或测试基础设施故障：先修复对应基础设施，不得无证据改动产品业务。";
  // 混合结果中的未验证条件仅授予调查责任；实际修复仍须逐项核对原确认范围与排除项。
  const blockedStepInstructions = Array.isArray(failureEvent.payload.acceptanceBlockedSteps) && failureEvent.payload.acceptanceBlockedSteps.length
    ? ["同时逐项调查 acceptanceBlockedSteps 中的能力或环境阻塞，区分尚未验证与真实产品失败；仅在原已确认范围内修复，原排除项继续生效，缺少授权则返回具体原因。不得仅修产品后遗漏这些条件，也不得为满足测试工具反向修改产品。"]
    : [];
  const repeatedAcceptanceInstruction = repeatedAcceptanceFailures.length === 2
    ? `韩立已有两次不同验收运行未通过。令狐必须并列核对原验收条件、两次原始结果、正式页面或源码事实、验收计划、分类与范围判断，独立调查韩立验收能力是否造成误判。若证据证明验收实现或提示词错误，在原授权范围内修复韩立验收能力并保留两次失败证据；若真实产品仍不符合原条件，则修复产品。不得改写原条件、删除失败记录、伪造通过或以测试替身代替正式复验。两次依据：\n${repeatedAcceptanceFailures.map((item) => `事件 ${item.eventId}；验收运行 ${item.payload.acceptanceRunId}；分类 ${item.payload.acceptanceFailureKind}；实际失败：${item.message}`).join("\n")}`
    : null;
  // 提交包含原任务关系、故障所有者和完整边界的新修复任务。
  return {
    // 标题明确这是流程卡点修复而不是原专题重新实施。
    title: `修复流程卡点：${topic.title}`,
    // 原异常正文作为问题事实。
    problemStatement: `原专题“${topic.title}”在韩立结果验收中未通过。\n${failureEvent.message}`,
    // 修复目标必须返回原提案步骤，不代替韩立验收。
    confirmedIntent: `令狐根据韩立本轮真实失败证据，调查并修复仍属于原验收范围的具体缺陷。故障分类：${acceptanceFailureKind}。${repairBoundary} 修复前必须复现原实际结果；修复后必须用相同条件证明原现象已经改变，若未改变应判定本轮修复方向错误并重新调查，不能进入打包或声称完成。${repeatedAcceptanceInstruction ? `${repeatedAcceptanceInstruction}\n` : ""}代码测试、统一测试、运行版本更新和重启健康检查完成后，必须回到提案“${proposal.title}”的韩立结果验收步骤；令狐的完成说明不能代替韩立验收。\n故障事实：${JSON.stringify(failureEvent.payload, omitCheckpointSnapshot)}`,
    // 限制修复只能处理已经确认的技术故障。
    constraints: [marker, `卡点故障事实：${failureEvent.eventId}`, repairBoundary, ...blockedStepInstructions, ...(repeatedAcceptanceInstruction ? ["两次真实验收未通过时同时调查韩立验收能力和产品实现；只有真实证据证明误判，才可在原授权范围内修改验收能力，原条件与门禁保持不变。"] : []), ...[...new Set([...(topic.exclusions || []), ...(proposal.exclusions || [])])].map((exclusion) => `原确认范围排除项：${exclusion}`), "仅修复已分类且属于原验收范围的真实产品缺陷（以 acceptanceFailureScope 为据）或既有验收能力故障；先调查再修改，保留原任务历史和恢复点。", "前一轮结果未改变原故障时必须明确标记修复方向错误，读取新的运行证据后更换根因假设；禁止重复相同修改或用测试替身代替真实复现。", "每次交接必须点名原专题、具体验收条件、实际结果、期望结果、当前负责人和下一步动作；禁止使用无明确指向的简称。", "不得修改生产数据库、跳过代码测试或统一测试、扩大业务范围、关闭权限门禁；需要用户授权时明确报告具体受阻事项。"],
    // 验收条件要求原因、修复和验证证据全部存在。
    acceptanceCriteria: [...blockedStepInstructions, ...(repeatedAcceptanceInstruction ? ["并列解释韩立两次验收失败的真实依据；若属于验收误判，提供验收能力修复与回归证据；若属于产品缺陷，提供产品修复与原条件复验依据"] : []), "逐项复现并解释 acceptanceFailureScope 中的具体失败条件、实际结果、期望结果及故障所有者", "生产修改必须对应故障分类，且相同复现条件下原现象已经改变；只改验收工具、提示词或假测试不能证明产品缺陷修复", "完成针对性代码测试且不绕过权限和原验收条件", "完成统一测试、运行版本更新和重启健康检查", "提交真实修复与验证证据，并自动返回同一提案的韩立结果验收"],
    // 产品缺陷使用结构化门禁，不能依靠提示词阻止执行人用测试文件冒充产品修复。
    requiredChangeKind: acceptanceFailureKind === "product-defect" ? "production-source" : "any-source",
    // 复用原专题已经授权的工作区。
    workspaceState: topic.workspaceState,
    // 复用原专题语言环境。
    locale: topic.locale,
    // 原步骤人物是本修复事实的发起人。
    initiatorMemberId: isAcceptanceFailureOperation(failureEvent.payload.operation) ? "han-li" : state.sourceMemberId,
    // 卡点调查固定交给令狐。
    preferredExecutorMemberId: "linghu-ancestor",
    // 标记统一异常恢复来源。
    automationSource: "linghu-safeguard",
    // 保存所属提案关系。
    evolutionProposalId: proposal.proposalId,
    // 当前提案标识同时作为演化轮次关联。
    evolutionRoundId: proposal.proposalId,
    // 显式保存修复任务替代的原任务，提案聚合在重启后据此选择当前有效任务。
    replacementForTaskId: state.taskId || undefined,
  };
}

/** 比较同一原流程的卡点优先级，已有修复任务的记录优先，其次按发生顺序稳定排序。 */
function compareCheckpointPriority(left: WorkflowExceptionRecordOutDto, right: WorkflowExceptionRecordOutDto): number {
  // 读取左侧卡点快照。
  const leftCheckpoint = left.payload.checkpoint as WorkflowCheckpointState | undefined;
  // 读取右侧卡点快照。
  const rightCheckpoint = right.payload.checkpoint as WorkflowCheckpointState | undefined;
  // 已明确耗尽的旧卡点只保留历史，不得永久抢占后来出现的新故障事实。
  const exhaustedPriority = Number(leftCheckpoint?.exhausted === true) - Number(rightCheckpoint?.exhausted === true);
  // 新故障优先于已经停止派发的旧卡点，才能建立新的独立修复任务。
  if (exhaustedPriority !== 0) {
    // 保证同一输入得到稳定顺序。
    return exhaustedPriority;
  }
  // 已建立修复任务的卡点优先成为主记录。
  const repairPriority = Number(Boolean(rightCheckpoint?.repairTaskId)) - Number(Boolean(leftCheckpoint?.repairTaskId));
  // 修复任务优先级不同就直接返回。
  if (repairPriority !== 0) {
    // 保证同一输入得到稳定顺序。
    return repairPriority;
  }
  // 没有修复任务差异时按真实发生时间排序。
  const occurredPriority = left.occurredAt.localeCompare(right.occurredAt);
  // 发生时间不同就返回时间顺序。
  if (occurredPriority !== 0) {
    // 最早卡点优先。
    return occurredPriority;
  }
  // 同一时间使用稳定事件标识消除排序不确定性。
  return left.eventId.localeCompare(right.eventId);
}

/** 新事实接替已耗尽卡点时使用独立任务标识；普通恢复轮次继续兼容原标识。 */
function checkpointRepairMarker(
  event: WorkflowExceptionRecordOutDto,
  state: WorkflowCheckpointState,
  relatedEvents: WorkflowExceptionRecordOutDto[],
): string {
  // 原轮次标识继续承担重启后查回既有修复任务的职责。
  const base = `卡点标识：${state.runId}:proposal:${state.proposalId}:round:${state.round}`;
  // 已经登记任务的事件必须继续使用旧标识，不能因其他事件后来耗尽而失去关联。
  if (state.repairTaskId) return base;
  // 只有新事件接替同一流程已耗尽的旧主卡点时才建立新的任务身份。
  const replacesExhaustedCheckpoint = relatedEvents.some((candidate) => candidate.eventId !== event.eventId
    && (candidate.payload.checkpoint as WorkflowCheckpointState | undefined)?.exhausted === true);
  // 事件标识来自持久异常事实，重启和重复轮询都会保持稳定。
  return replacesExhaustedCheckpoint ? `${base}:event:${event.eventId}` : base;
}

/** 序列化修复任务事实时移除嵌套卡点快照，避免任务意图无限递归膨胀。 */
function omitCheckpointSnapshot(key: string, value: unknown): unknown {
  // checkpoint 已由聚合独立持久化，不重复写入修复任务正文。
  if (key === "checkpoint") {
    // 返回 undefined 让 JSON 序列化器忽略该字段。
    return undefined;
  }
  // 其他异常事实保持原值。
  return value;
}

/** 比较技术恢复的业务投影；updatedAt 只是提交结果，不能制造新的业务变化。 */
function technicalRecoveryProjection(value: Omit<EvolutionTechnicalRecoveryOutDto, "updatedAt"> | EvolutionTechnicalRecoveryOutDto): string {
  const { updatedAt: _updatedAt, ...projection } = value as EvolutionTechnicalRecoveryOutDto;
  return JSON.stringify(projection);
}

/** 把未知异常字段安全转换为非空文本。 */
function text(value: unknown): string | null {
  // 只有字符串可能成为业务说明。
  if (typeof value !== "string") {
    // 其他类型明确返回空值。
    return null;
  }
  // 去除持久化或模型输出附带的首尾空白。
  const normalized = value.trim();
  // 空字符串不能作为恢复点。
  if (!normalized) {
    // 返回空值让调用方使用明确默认说明。
    return null;
  }
  // 返回已经规范化的文本。
  return normalized;
}
