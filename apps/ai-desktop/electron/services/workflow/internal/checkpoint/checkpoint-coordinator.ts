import type { CollaborationStateOutDto, WorkflowExceptionRecordOutDto, SubmitCollaborationTaskInDto } from "../../../../../contracts/services/workflow/index.js";
import type { EvolutionStateOutDto } from "../../../../../contracts/services/evolution/index.js";
import { WorkflowCheckpointAggregate, type WorkflowCheckpointState } from "../../domain/workflow-checkpoint.aggregate.js";
import type { CheckpointHandoffService } from "./checkpoint-handoff.service.js";

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
  /** 创建一条受范围限制的真实修复任务。 */
  submitRepair(request: SubmitCollaborationTaskInDto): CollaborationStateOutDto;
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

  #state(event: WorkflowExceptionRecordOutDto): WorkflowCheckpointState {
    // 读取 Evolution 和协作事实，为旧事件恢复完整的领域卡点快照。
    const evolution = this.options.evolution();
    // 先按异常关联标识寻找真实原任务。
    const task = this.options.collaboration().tasks.find((item) => item.taskId === event.correlationId || item.taskId === event.payload.taskId);
    // 再按异常提案标识或任务关系寻找原提案。
    const proposal = evolution.proposals.find((item) => item.proposalId === event.payload.proposalId || item.proposalId === task?.evolutionProposalId);
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
    if (event.payload.phase === "accepting" || isAcceptanceOperation(event.payload.operation)) {
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

  #phase(event: WorkflowExceptionRecordOutDto, state: WorkflowCheckpointState, phase: WorkflowCheckpointState["phase"], content: string): void {
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
      return;
    }
    // 新阶段先发布真实人物交接事实。
    this.options.handoff.publish(event, state, phase, content);
    // 聚合已经同步更新 phase，此处只保存完整快照。
    this.options.save(event.eventId, state);
    // 同步当前内存异常对象，保证本批次后续读取同一快照。
    event.payload.checkpoint = structuredClone(state);
  }

  async #advance(event: WorkflowExceptionRecordOutDto): Promise<void> {
    const state = this.#state(event);
    if (!state.phase) {
      // 首次处理先保留原步骤上报事实。
      this.#phase(event, state, "reported", event.message);
    }
    if (state.phase === "reported") {
      // 令狐接收不代表问题已经修复。
      this.#phase(event, state, "received", "令狐已接收原因和原流程标识；接收不代表修复完成。");
    }
    const evolution = this.options.evolution();
    const task = this.options.collaboration().tasks.find((item) => item.taskId === state.taskId);
    const run = evolution.oneShotRun;
    const proposal = evolution.proposals.find((item) => item.proposalId === state.proposalId);
    // 直接关联 taskId 的异常属于任务自身；只有真实应用验收或没有任务直连的验收阶段才归韩立复验。
    const directlyTargetsTask = Boolean(task && (event.correlationId === task.taskId || event.payload.taskId === task.taskId));
    // 韩立验收发生在开发任务集成之后；此时 integrated 只能说明代码已交付，不能说明真实界面复验通过。
    const isAcceptanceCheckpoint = isAcceptanceOperation(event.payload.operation) || (state.sourcePhase === "accepting" && !directlyTargetsTask);
    // 一次性原流程明确 completed，才是验收卡点已经通过复验的权威事实。
    const originalRunCompleted = Boolean(state.runId && run?.runId === state.runId && run.status === "completed");
    // 非验收任务仍沿用原规则：任务完成集成即可确认对应执行卡点已经解除。
    const originalTaskCompleted = !isAcceptanceCheckpoint && task?.state === "integrated";
    if (originalTaskCompleted || originalRunCompleted) {
      this.#phase(event, state, "resolved", "原任务已完成验证，确认此卡点解除；历史轮次保留。");
      this.options.resolve(event.eventId, "原任务完成事实已确认");
      return;
    }
    // 明确暂停、取消及业务授权问题不能因统一受理而变成自动放权。
    if ((state.runId === run?.runId && ["paused", "stopped"].includes(evolution.automationRuntime.status)) || task?.state === "cancelled" || event.category === "business-exception") {
      this.#phase(event, state, "waiting", "已保留卡点，当前为人工暂停或业务选择，需用户明确后继续，不自动改写授权。");
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
    if (state.exhausted) {
      // 已耗尽卡点只能等待新增事实或人工处理。
      return;
    }
    // 同一原运行的重复异常共享最早的持久处理记录；不同事件不能各派一份修复。
    const relatedEvents = this.options.pending().filter((item) => item.payload.runId === state.runId);
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
      aggregate.startNextRound();
      Object.assign(state, aggregate.snapshot());
      if (aggregate.isExhausted()) {
        // 达到上限后发布一次稳定耗尽事实。
        this.#phase(event, state, "exhausted", "三轮修复后的原点复验仍受阻，停止重复派发，等待新增事实。");
        // 禁止进入后续派发逻辑。
        return;
      }
      this.#phase(event, state, "received", `原点复验再次受阻：${run.blockingReason || event.message}。进入下一轮调查。`);
    }
    // 用持久任务标记查重，覆盖创建任务后、保存关联前崩溃的窗口。
    const marker = `卡点标识：${state.runId}:round:${state.round}`;
    const repair = this.options.collaboration().tasks.find((item) => item.taskId === state.repairTaskId || item.snapshot.constraints.includes(marker));
    if (repair) {
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
          blockedAggregate.startNextRound();
          Object.assign(state, blockedAggregate.snapshot());
          if (blockedAggregate.isExhausted()) {
            // 三轮原点复验都失败后结束自动修复。
            this.#phase(event, state, "exhausted", "同一卡点三轮修复后仍受阻，停止重复派发，等待新增事实或人工处理。");
            // 禁止继续进入新一轮。
            return;
          }
          this.#phase(event, state, "received", `原点复验仍受阻：${resumed.oneShotRun.blockingReason || "尚未解除"}。开始下一轮调查。`);
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
    // 提交包含原任务关系和完整边界的新修复任务。
    const result = this.options.submitRepair({
      // 标题明确这是流程卡点修复而不是原专题重新实施。
      title: `修复流程卡点：${topic.title}`,
      // 原异常正文作为问题事实。
      problemStatement: `原专题“${topic.title}”在韩立真实界面验收中未通过。\n${event.message}`,
      // 修复目标必须返回原提案步骤，不代替韩立验收。
      confirmedIntent: `令狐根据韩立本轮真实失败证据，调查并修复仍属于原验收范围的具体缺陷。代码测试、统一测试、运行版本更新和重启健康检查完成后，必须回到提案“${proposal.title}”的韩立真实界面验收步骤；令狐的完成说明不能代替韩立验收。\n故障事实：${JSON.stringify(event.payload, omitCheckpointSnapshot)}`,
      // 限制修复只能处理已经确认的技术故障。
      constraints: [marker, "仅修复 acceptanceFailureScope 中已经判定属于原验收范围的真实新缺陷；先调查再修改，保留原任务历史和恢复点。", "每次交接必须点名原专题、具体验收条件、实际结果、期望结果、当前负责人和下一步动作；禁止使用无明确指向的简称。", "不得修改生产数据库、跳过代码测试或统一测试、扩大业务范围、关闭权限门禁；需要用户授权时明确报告具体受阻事项。"],
      // 验收条件要求原因、修复和验证证据全部存在。
      acceptanceCriteria: ["逐项复现并解释 acceptanceFailureScope 中的具体失败条件、实际结果和期望结果", "完成针对性代码测试且不绕过权限和原验收条件", "完成统一测试、运行版本更新和重启健康检查", "提交真实修复与验证证据，并自动返回同一提案的韩立真实界面验收"],
      // 复用原专题已经授权的工作区。
      workspaceState: topic.workspaceState,
      // 复用原专题语言环境。
      locale: topic.locale,
      // 原步骤人物是本修复事实的发起人。
      initiatorMemberId: state.sourceMemberId,
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
    });
    const repairTaskId = result.tasks.find((item) => item.snapshot.constraints.includes(marker))?.taskId || null;
    if (!repairTaskId) throw new Error("未获得真实修复任务标识，不能报告派发完成");
    const aggregate = new WorkflowCheckpointAggregate(state);
    aggregate.registerRepairTask(repairTaskId);
    Object.assign(state, aggregate.snapshot());
    this.#phase(event, state, "repairing", `令狐已接收第 ${state.round} 轮真实调查修复任务 ${state.repairTaskId}。`);
  }
}

/** 比较同一原流程的卡点优先级，已有修复任务的记录优先，其次按发生顺序稳定排序。 */
function compareCheckpointPriority(left: WorkflowExceptionRecordOutDto, right: WorkflowExceptionRecordOutDto): number {
  // 读取左侧卡点快照。
  const leftCheckpoint = left.payload.checkpoint as WorkflowCheckpointState | undefined;
  // 读取右侧卡点快照。
  const rightCheckpoint = right.payload.checkpoint as WorkflowCheckpointState | undefined;
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

/** 判断异常是否来自韩立真实界面验收或验收失败范围处理。 */
function isAcceptanceOperation(value: unknown): boolean {
  // 只有字符串操作名可以参与稳定判断。
  if (typeof value !== "string") return false;
  // 工具受阻、范围内产品失败和范围不明确都必须回到同一韩立验收点。
  return [
    "run_real_application_acceptance",
    "repair_failed_real_application_acceptance",
    "review_acceptance_failure_scope",
  ].includes(value);
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
