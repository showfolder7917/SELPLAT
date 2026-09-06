import type { CollaborationMemoryPort } from "../../../../../contracts/services/support/capabilities/event-center/index.js";
import type { EvolutionMutationInDto, EvolutionProposalOutDto, EvolutionTopicDossierOutDto, EvolutionStateOutDto } from "../../../../../contracts/services/evolution/index.js";
import { randomUUID } from "node:crypto";
import type { HanliComputerAcceptanceInDto, HanliAcceptanceRunOutDto } from "../../../../../contracts/services/personas/hanli/index.js";
import type { CreateNangongTopicInDto } from "../../../../../contracts/services/personas/nangong/index.js";
import type { SendPersonaConversationMessageInDto } from "../../../../../contracts/services/personas/conversation/index.js";
import type { PersonaConversationOutDto } from "../../../../../contracts/services/personas/conversation/index.js";
import type { ConfigurePersonaWorkflowInDto, PersonaWorkflowActionInDto } from "../../../../../contracts/services/workflow/index.js";
import type { SendMessageOutDto } from "../../../../../contracts/services/support/capabilities/conversation/index.js";
import type { EventCenterExceptionInDto } from "../../../../../contracts/services/support/capabilities/event-center/index.js";
import type { CollaborationTimelineBusinessEventOutDto } from "../../../../../contracts/services/workflow/index.js";
import type { CodexStreamEventOutDto } from "../../../../../contracts/services/support/platform/codex/index.js";
import type { CollaborationWorkflowFacade } from "../../index.js";
import type { PromptLibraryPort } from "../../../support/capabilities/prompts/index.js";
// 提案执行聚合统一解释原任务、修复任务和验收状态，Runtime 不再拼装零散布尔值。
import { ProposalExecutionAggregate } from "../../domain/proposal-execution.aggregate.js";
// 单任务聚合统一解释人物是否仍真实占用任务。
import { CollaborationTaskAggregate } from "../../domain/collaboration-task.aggregate.js";
import { EvolutionFlowPolicy } from "../../domain/evolution-flow.policy.js";
import { AcceptanceFailureScopePolicy } from "../../domain/acceptance-failure-scope.policy.js";
import { AcceptanceHandoffService } from "../acceptance/acceptance-handoff.service.js";
import { HanliNangongDeliberationService } from "./hanli-nangong-deliberation.service.js";
import type { HanliWorkflowPort } from "../../../personas/hanli/index.js";
import { createNangongRuntime, createNangongTaskDistribution, type NangongRuntime } from "../../../personas/nangong/index.js";
import {
  createEvolutionMutationCoordinator,
  type EvolutionMutationPort,
  type EvolutionStatePort,
} from "../../../evolution/index.js";

export interface PersonaEvolutionRuntimeOptions {
  /** Evolution 专题、研讨和提案的唯一状态端口。 */
  store: EvolutionStatePort;
  /** 人物提示词读取与渲染端口。 */
  prompts: PromptLibraryPort;
  /** 协作任务执行、恢复、测试和集成公开门面。 */
  collaboration: CollaborationWorkflowFacade;
  /** 韩立审批、会话和结果验收公开端口。 */
  hanli: HanliWorkflowPort;
  /** 南宫婉人物会话所需的最小发送和新会话端口。 */
  conversation: {
    /** 发送一条人物消息并返回官方会话结果。 */
    send(request: SendPersonaConversationMessageInDto, context: string): Promise<SendMessageOutDto>;
    /** 创建新的南宫婉展示会话，不清除业务流程。 */
    newChat(): Promise<void>;
  };
  /** 对韩立退回提案执行只读调查的可选模型端口。 */
  investigateRevision?: (prompt: string, workspaceState: EvolutionStateOutDto["topics"][number]["workspaceState"], locale: EvolutionStateOutDto["topics"][number]["locale"]) => Promise<string>;
  /** 把已批准提案拆成结构化任务计划的可选模型端口。 */
  planDistribution?: (prompt: string, workspaceState: EvolutionStateOutDto["topics"][number]["workspaceState"], locale: EvolutionStateOutDto["topics"][number]["locale"], emit: (event: CodexStreamEventOutDto) => void) => Promise<string>;
  /** 记录普通演化业务事件的统一入口。 */
  recordEvent(type: string, details: Record<string, unknown>, taskId?: string): void;
  /** 记录阻塞或技术异常的统一事件中心入口。 */
  recordFailure?(input: EventCenterExceptionInDto): void;
  /** 发布跨人物类型化时间线事实的可选端口。 */
  recordTimelineEvent?: (event: CollaborationTimelineBusinessEventOutDto) => void;
  /** 发布任务流式进度到确定时间线节点的可选端口。 */
  recordTimelineStream?: (taskId: string, memberId: string, event: CodexStreamEventOutDto) => void;
  /** 人物共享记忆端口；数据库不可用时允许为空。 */
  memory?: CollaborationMemoryPort | null;
  /** 人物消息变化后刷新语义记忆的可选通知。 */
  refreshSemanticMemory?: () => void;
  /** 韩立内部研讨模型调用端口。 */
  askHanliDeliberation?: (prompt: string, state: EvolutionStateOutDto) => Promise<string>;
  /** 南宫婉内部研讨模型调用端口。 */
  askNangongDeliberation?: (prompt: string, state: EvolutionStateOutDto) => Promise<string>;
  /** 读取当前稳定用户标识，供语义记忆隔离。 */
  readStableUserId?: () => string;
  /** 根据 Evolution 工作区读取项目作用域。 */
  readProjectScope?: (state: EvolutionStateOutDto) => string;
  /** 读取当前韩立展示会话标识。 */
  readHanliConversationId?: () => string | null;
  /** 人物会话提交后通知界面刷新。 */
  onPersonaConversationChanged?: (conversation: PersonaConversationOutDto) => void;
  /** 从统一数据库读取专题完整档案的可选端口。 */
  readDossier?: (topicId: string, state: EvolutionStateOutDto) => EvolutionTopicDossierOutDto;
  /** 在 Evolution 写动作前登记幂等事务。 */
  beginMutation?: (topicId: string, action: string, request: EvolutionMutationInDto, currentStateVersion: string) => "started" | "completed";
  /** Evolution 写动作成功后提交新的状态版本。 */
  completeMutation?: (idempotencyKey: string, resultStateVersion: string) => void;
  /** Evolution 写动作失败后释放幂等事务并记录原因。 */
  failMutation?: (idempotencyKey: string, error: unknown) => void;
  /** 新会话建立失败时允许使用的受控重试间隔。 */
  newConversationRetryDelaysMs?: number[];
}

/**
 * 跨人物演化运行时。
 *
 * 业务作用：在迁移后的唯一组合点连接南宫、韩立、Evolution 与协作 Workflow，
 * 对外由各人物 Facade 按职责裁剪方法，不再把这一完整运行对象冒充为南宫人物能力。
 */
export class PersonaEvolutionRuntime {
  /** 验收交接应用服务，只负责时间线和人物消息副作用。 */
  readonly #acceptanceHandoff: AcceptanceHandoffService;
  /** Evolution 唯一状态端口。 */
  readonly #store: EvolutionStatePort;
  /** 协作任务唯一公开门面。 */
  readonly #collaboration: CollaborationWorkflowFacade;
  /** 韩立人物最小公开端口。 */
  readonly #hanli: HanliWorkflowPort;
  /** 南宫婉任务拆分模型端口。 */
  readonly #planDistribution: NonNullable<PersonaEvolutionRuntimeOptions["planDistribution"]>;
  /** 普通业务事件记录入口。 */
  readonly #recordEvent: PersonaEvolutionRuntimeOptions["recordEvent"];
  /** 技术和业务阻塞事件记录入口。 */
  readonly #recordFailure: NonNullable<PersonaEvolutionRuntimeOptions["recordFailure"]>;
  /** 可选共享人物记忆端口。 */
  readonly #memory: CollaborationMemoryPort | null;
  /** 可选专题完整档案读取端口。 */
  readonly #readDossier: PersonaEvolutionRuntimeOptions["readDossier"];
  /** Evolution 写动作幂等协调端口。 */
  readonly #mutations: EvolutionMutationPort;
  /** 韩立—南宫婉研讨应用服务；模型端口未装配时为空。 */
  readonly #deliberation: HanliNangongDeliberationService | null;
  /** 南宫婉公开人物运行时，由 Workflow 组合根统一装配。 */
  readonly nangongRuntime: NangongRuntime;
  /** 流程策略只根据已保存事实决定下一步，不替人物作审批决定。 */
  readonly #flow = new EvolutionFlowPolicy();
  /** 验收失败范围策略只比较原提案条件与本轮真实失败证据。 */
  readonly #acceptanceFailureScope = new AcceptanceFailureScopePolicy();
  /** 三十秒监督轮询计时器；未启动时为 null。 */
  #timer: ReturnType<typeof setInterval> | null = null;
  /** 当前一次性流程的短间隔继续计时器。 */
  #continuationTimer: ReturnType<typeof setTimeout> | null = null;
  /** 当前是否正在执行主推进循环，防止重入。 */
  #running = false;
  /** 当前是否正在执行人工恢复，防止重复继续。 */
  #resuming = false;
  /** Electron 窗口层注入的真实应用验收执行器。 */
  #computerAcceptanceSession: ((goal: HanliComputerAcceptanceInDto) => Promise<HanliAcceptanceRunOutDto>) | null = null;

  /**
   * 组装跨人物演化顺序以及南宫人物入口。
   * 真实传参示例：主进程传入 Evolution 状态、协作 Workflow、HanliWorkflowPort 和南宫会话端口。
   * 真实返回示例：构造完成后可通过 Workflow 推进轮转，并通过 nangongRuntime 取得南宫 Facade。
   * 异常或副作用示例：缺少韩立公开端口会在类型检查或启动装配时阻断，不会回退创建韩立内部服务。
   */
  constructor(options: PersonaEvolutionRuntimeOptions) {
    this.#acceptanceHandoff = new AcceptanceHandoffService(options);
    // Evolution 是专题和提案事实的唯一所有者，南宫只通过端口读写。
    this.#store = options.store;
    // Workflow 负责把通过审批的任务交给真实执行人。
    this.#collaboration = options.collaboration;
    // Workflow 只持有韩立公开门面，不创建或读取韩立 internal 服务。
    this.#hanli = options.hanli;
    // 分发计划是可替换 Port，默认值只负责报告缺失能力。
    this.#planDistribution = options.planDistribution || (async () => { throw new Error("南宫婉任务拆分调查尚未接入。"); });
    // 正常事件与异常事件分开登记，页面才能区分业务等待和技术故障。
    this.#recordEvent = options.recordEvent;
    this.#recordFailure = options.recordFailure || (() => undefined);
    // 记忆和专题档案属于可选读模型；数据库不可用时由公开方法安全降级。
    this.#memory = options.memory || null;
    this.#readDossier = options.readDossier;
    // 所有专题写动作共用同一个幂等和互斥协调器。
    this.#mutations = createEvolutionMutationCoordinator({ begin: options.beginMutation, complete: options.completeMutation, fail: options.failMutation });
    this.#deliberation = options.askHanliDeliberation && options.askNangongDeliberation
      ? new HanliNangongDeliberationService({
        store: this.#store, prompts: options.prompts, memory: this.#memory,
        askHanli: options.askHanliDeliberation, askNangong: options.askNangongDeliberation,
        recordEvent: this.#recordEvent,
        readStableUserId: options.readStableUserId || (() => ""),
        readProjectScope: options.readProjectScope || (() => "global"),
        readHanliConversationId: options.readHanliConversationId || (() => null),
        onPersonaConversationChanged: options.onPersonaConversationChanged,
      })
      : null;
    // 南宫人物在自己的模块内装配业务服务；Workflow 只提供跨人物推进和成员查询端口。
    const taskDistribution = createNangongTaskDistribution({
      store: this.#store,
      mutations: this.#mutations,
      collaboration: this.#collaboration,
      recordEvent: this.#recordEvent,
      timeline: options.recordTimelineEvent,
      timelineStream: options.recordTimelineStream,
      plan: this.#planDistribution,
      prompts: options.prompts,
    });
    this.nangongRuntime = createNangongRuntime({
      store: this.#store,
      prompts: options.prompts,
      mutations: this.#mutations,
      conversation: options.conversation,
      memory: this.#memory,
      refreshSemanticMemory: options.refreshSemanticMemory,
      investigateRevision: options.investigateRevision,
      recordEvent: this.#recordEvent,
      recordFailure: this.#recordFailure,
      proposalReview: {
        requestReview: (proposalId) => this.#hanli.requestProposalReview(proposalId),
      },
      memberDirectory: {
        resolveEnabledDisplayName: (memberId) => this.#collaboration.state().members.find((item) => item.memberId === memberId && item.enabled)?.displayName || null,
      },
      oneShotWorkflow: {
        hasLiveOwner: (state) => this.#oneShotHasLiveOwner(state),
        advance: async () => this.#tick(),
        blockFailure: (kind, operation, error, reason, details) => this.#blockOneShotFailure(kind, operation, error, reason, details),
      },
      taskDistribution,
      newConversationRetryDelaysMs: options.newConversationRetryDelaysMs,
    });
    // 分发由 Workflow 创建，并把 AI 返回值先解析成确定的结构化计划。
  }

  /** 读取当前 Evolution 快照；返回值是副本，调用方不能绕过 Store 直接改状态。 */
  state(): EvolutionStateOutDto { return this.#store.state(); }

  /** 按专题读取来源、研讨、提案和执行档案；数据库读模型不可用时使用当前状态安全降级。 */
  dossier(topicId: string): EvolutionTopicDossierOutDto {
    const state = this.state();
    if (this.#readDossier) return this.#readDossier(topicId, state);
    const topic = state.topics.find((item) => item.topicId === topicId);
    if (!topic) throw new Error("专题池中不存在该专题。 ");
    const deliberation = topic.deliberationId ? state.deliberations.find((item) => item.deliberationId === topic.deliberationId) || null : null;
    return { topic, deliberation, proposals: state.proposals.filter((item) => item.topicId === topicId), archiveRecords: state.archiveRecords.filter((item) => item.topicId === topicId || item.deliberationId === topic.deliberationId), executionRecords: [] };
  }
  /** 订阅已持久化的 Evolution 状态变化，并返回取消订阅函数。 */
  subscribe(listener: Parameters<EvolutionStatePort["subscribe"]>[0]) { return this.#store.subscribe(listener); }

  /** 启动一次立即检查和三十秒周期检查；重复调用不会创建第二个计时器。 */
  start(): void { if (!this.#timer) { void this.#tick(); this.#timer = setInterval(() => void this.#tick(), 30_000); } }

  /** 停止自动检查；已持久化的专题和恢复点不会被清除。 */
  stop(): void {
    if (this.#timer) clearInterval(this.#timer);
    if (this.#continuationTimer) clearTimeout(this.#continuationTimer);
    this.#timer = null;
    this.#continuationTimer = null;
  }
  /** 主进程窗口层登记真实应用验收执行器；业务状态仍由本 Facade 和原结果审批接口推进。 */
  setComputerAcceptanceSession(runner: (goal: HanliComputerAcceptanceInDto) => Promise<HanliAcceptanceRunOutDto>): void { this.#computerAcceptanceSession = runner; }
  /** 协作任务状态变化时立即核对一次性流程，避免等待固定轮询间隔。 */
  notifyWorkflowChanged(): void { void this.#tick(); }
  /** 把用户已确认的范围登记为正式专题，不自动创建提案或执行任务。 */
  createTopic(request: CreateNangongTopicInDto): EvolutionStateOutDto { return this.#store.createTopic(request); }
  /** 保存轮询间隔、最大轮数等受控参数，不立即推进业务状态。 */
  configureAutomation(request: ConfigurePersonaWorkflowInDto): EvolutionStateOutDto { return this.#store.configureAutomation(request); }
  /** 启动、暂停、恢复或停止自动流程，并保留可恢复的当前卡点。 */
  controlAutomation(action: PersonaWorkflowActionInDto): EvolutionStateOutDto {
    const state = this.#store.controlAutomation(action);
    if (action === "start" || action === "resume") this.#scheduleContinuation(0);
    return state;
  }

  /** 用户在韩立会话输入 1 后启动统一自动流程；完成当前专题后继续发现有证据的新问题。 */
  startHanliNangongDeliberation(workspaceState: EvolutionStateOutDto["automationContext"]["workspaceState"], locale: EvolutionStateOutDto["automationContext"]["locale"]): EvolutionStateOutDto {
    if (!this.#deliberation) throw new Error("韩立与南宫婉内部研讨能力尚未接入。");
    let state = this.#store.beginOneShotRun(workspaceState, locale);
    state = this.#store.updateOneShotRun("preparing-topic", "han-li", "韩立", "正在围绕用户已确认需求向南宫婉提出第一项调查问题", null, null);
    this.#recordEvent("hanli.nangong.deliberation_confirmed", { runId: state.oneShotRun?.runId || null, continuous: true });
    this.#scheduleContinuation(0);
    return state;
  }

  /**
   * 把客户对修复说明的确认或纠正交给统一人物研讨服务。
   * 真实传参示例：replyHanliNangongConfirmation("不要按钮，只恢复边缘拖动")。
   * 真实返回示例：返回韩立理解后的客户说明，而不是南宫婉的技术原文。
   * 异常或副作用示例：没有等待确认轮次时抛错；有效纠正会建立下一轮可恢复研讨。
   */
  async replyHanliNangongConfirmation(reply: string): Promise<{ customerReply: string }> {
    if (!this.#deliberation) throw new Error("韩立与南宫婉内部研讨能力尚未接入。");
    const result = await this.#deliberation.replyToConfirmation(reply);
    this.#scheduleContinuation(0);
    return result;
  }

  #scheduleContinuation(delayMs = 1_000): void {
    if (this.#continuationTimer) return;
    this.#continuationTimer = setTimeout(() => {
      this.#continuationTimer = null;
      void this.#tick();
    }, delayMs);
  }
  /** 只有任务与人物运行事实互相吻合时，才允许旧 running 状态阻止新的用户确认。 */
  #oneShotHasLiveOwner(state: EvolutionStateOutDto): boolean {
    const run = state.oneShotRun;
    if (!run || run.status !== "running") return false;
    if (!["executing", "testing"].includes(run.phase)) return true;
    const proposal = run.proposalId ? state.proposals.find((item) => item.proposalId === run.proposalId) : null;
    if (!proposal?.distributedTaskIds.length) return false;
    const collaboration = this.#collaboration.state();
    // 聚合会沿替代链返回当前真正生效的任务，旧失败任务不会持续占用流程。
    const execution = new ProposalExecutionAggregate({ proposal, collaborationTasks: collaboration.tasks }).view();
    // 逐项核对当前有效任务是否仍有真实工作人物。
    for (const task of execution.effectiveTasks) {
      // 已完成或取消的任务不能阻止用户重新启动研讨。
      if (task.state === "integrated" || task.state === "cancelled") {
        // 继续检查其他并行任务。
        continue;
      }
      // 单任务聚合根据权威成员占用事实判断活动所有者。
      const taskAggregate = new CollaborationTaskAggregate({ task });
      // 任一有效任务仍被工作人物持有即可确认流程仍在运行。
      if (taskAggregate.hasLiveOwner(collaboration.members)) {
        // 返回真实活动结论。
        return true;
      }
    }
    // 没有有效任务被工作人物持有时，旧 running 状态不能继续拦截用户。
    return false;
  }

  /** 校验原运行后恢复统一流程；不改变令狐独立巡检开关。 */
  async resumeOneShotRun(expectedRunId?: string): Promise<EvolutionStateOutDto> {
    if (this.#resuming || this.#running) throw new Error("流程正在处理中，请勿重复恢复。");
    const before = this.state();
    const run = before.oneShotRun;
    if (expectedRunId !== undefined && run?.runId !== expectedRunId) throw new Error("当前运行已变化，请刷新后恢复原任务。");
    if (!run || (run.status !== "blocked" && before.automationRuntime.status !== "paused")) throw new Error("当前没有暂停或阻塞的运行。");
    this.#resuming = true;
    try {
      const proposal = run.proposalId ? before.proposals.find((item) => item.proposalId === run.proposalId) : null;
      if (proposal?.status === "blocked") {
        // 只恢复提案聚合解析出的当前有效任务，不重新运行已经被替代的旧任务。
        const collaboration = this.#collaboration.state();
        // 领域聚合统一解析修复替代链。
        const execution = new ProposalExecutionAggregate({ proposal, collaborationTasks: collaboration.tasks }).view();
        // 只有当前有效且可恢复的任务进入恢复入口。
        const blockedTasks = execution.effectiveTasks.filter((task) => ["blocked", "test-failed"].includes(task.state));
        for (const task of blockedTasks) {
          await this.#collaboration.recoverTask(task.taskId, `用户已从一次性演化卡点明确继续：${itemFailureReason(task)}`);
        }
      }
      this.#store.resumeOneShotRun();
      await this.#tick();
      return this.state();
    } finally {
      this.#resuming = false;
    }
  }

  async #dispatch(proposalId: string, request?: EvolutionMutationInDto): Promise<EvolutionStateOutDto> {
    const initialState = this.state();
    const mutation = request || { expectedStateVersion: initialState.updatedAt, idempotencyKey: `automatic-dispatch:${proposalId}:${initialState.updatedAt}` };
    return this.nangongRuntime.facade.distributeProposal(proposalId, mutation);
  }

  /** 一次性托管只调度现有动作；每次推进到需要等待真实任务状态的位置即返回。 */
  async #advanceOneShot(): Promise<EvolutionStateOutDto> {
    const transitionLimit = Math.max(12, this.state().automationSettings.maxCorrectionRounds * 3 + 8);
    for (let transition = 0; transition < transitionLimit; transition += 1) {
      let state = this.state();
      const run = state.oneShotRun;
      if (!run || run.status !== "running" || !run.topicId) return state;
      const topic = state.topics.find((item) => item.topicId === run.topicId);
      if (!topic) return this.#blockOneShotFailure("technical", "load_one_shot_topic", new Error("一次性运行关联的演化课题不存在。"), "一次性运行关联的演化课题不存在。");
      const proposals = state.proposals.filter((item) => item.topicId === topic.topicId).sort((left, right) => left.version - right.version);
      let proposal = proposals.at(-1) || null;

      if (!proposal) {
        state = this.#store.updateOneShotRun("forming-proposal", "nangong-wan", "南宫婉", "正在根据课题事实形成实施提案", topic.topicId, null);
        const content = `课题：${topic.title}\n\n目标：${topic.goal}\n\n调查事实：\n${topic.evidence.map((item) => `- ${item}`).join("\n")}\n\n推荐方向：在已登记范围内实施，并保持排除项不变。`;
        state = this.nangongRuntime.facade.createProposal(topic.topicId, { type: "代码修正", content, risks: ["实施可能影响既有调用方，必须通过原测试和验收门禁确认"], rollbackPlan: "保留课题、提案、任务和版本记录；失败时沿原恢复点返修，不覆盖已完成事实。" });
        proposal = state.proposals.at(-1)!;
        this.#store.updateOneShotRun("approving", "han-li", "韩立", "正在审批南宫婉提交的演化方向", topic.topicId, proposal.proposalId);
        continue;
      }

      const flowAction = this.#flow.next(proposal);
      if (flowAction === "await-approval") {
        this.#store.updateOneShotRun("approving", "han-li", "韩立", `正在审批提案 v${proposal.version}`, topic.topicId, proposal.proposalId);
        try { await this.#hanli.reviewAndDecideProposal(proposal.proposalId); }
        catch (error) {
          const reason = `韩立方向审批结果无法处理：${error instanceof Error ? error.message : String(error)}`;
          return this.#blockOneShotFailure("technical", "review_one_shot_proposal", error, reason);
        }
        continue;
      }

      if (flowAction === "supplement") {
        const correctionRounds = proposals.filter((item) => item.supersedesProposalId !== null).length;
        if (correctionRounds >= state.automationSettings.maxCorrectionRounds) {
          const reason = `提案返修已经达到 ${state.automationSettings.maxCorrectionRounds} 轮，韩立仍未确认方向可执行。`;
          return this.#blockOneShotFailure("business", "revision_budget_exhausted", new Error(reason), reason);
        }
        this.#store.updateOneShotRun("revising", "nangong-wan", "南宫婉", `正在按韩立退回项重新调查提案 v${proposal.version}`, topic.topicId, proposal.proposalId);
        try { await this.nangongRuntime.facade.investigateAndReviseReturnedProposal(proposal.proposalId); }
        catch (error) {
          const reason = `南宫婉重新调查失败：${error instanceof Error ? error.message : String(error)}`;
          return this.#blockOneShotFailure("technical", "investigate_and_revise_proposal", error, reason);
        }
        continue;
      }

      if (flowAction === "dispatch") {
        this.#store.updateOneShotRun("distributing", "nangong-wan", "南宫婉", "审批已通过，正在拆分并分发任务", topic.topicId, proposal.proposalId);
        try { await this.#dispatch(proposal.proposalId); }
        catch (error) {
          const reason = `南宫婉任务拆分或分发失败：${error instanceof Error ? error.message : String(error)}`;
          return this.#blockOneShotFailure("technical", "plan_and_dispatch_one_shot", error, reason);
        }
        continue;
      }

      if (flowAction === "monitor-execution") {
        const collaborationState = this.#collaboration.state();
        // 聚合统一解析原任务和令狐修复任务之间的有效执行链。
        const execution = new ProposalExecutionAggregate({ proposal, collaborationTasks: collaborationState.tasks }).view();
        // 后续人物状态和页面动作只读取当前有效任务。
        const tasks = execution.effectiveTasks;
        // 缺失标识由聚合按稳定身份计算。
        const missingTaskIds = execution.missingTaskIds;
        // 只按当前有效执行链判断阻塞；提案旧状态不能覆盖已经集成的修复事实。
        if (execution.blocked) {
          const blockedTasks = tasks.filter((item) => ["blocked", "cancelled", "test-failed"].includes(item.state));
          const blockedTask = blockedTasks[0];
          const reason = blockedTask
            ? `${taskOwnerName(collaborationState, blockedTask)}负责的“${blockedTask.snapshot.title}”停在${taskStageName(blockedTask)}；发现：${itemFailureReason(blockedTask)}`
            : missingTaskIds.length
              ? `提案“${proposal.title}”关联的任务记录缺失：${missingTaskIds.join("、")}。`
              : `提案“${proposal.title}”已经进入阻塞态，但没有找到对应的阻塞任务记录。`;
          const failureKind = blockedTask?.integrationFailure?.kind || blockedTask?.state || (missingTaskIds.length ? "missing-task-record" : "proposal-task-state-inconsistent");
          const details = {
            taskId: blockedTask?.taskId || null,
            taskTitle: blockedTask?.snapshot.title || null,
            executorMemberId: blockedTask?.executorMemberId || null,
            taskState: blockedTask?.state || null,
            taskPhase: blockedTask?.phase || null,
            integrationFailureKind: blockedTask?.integrationFailure?.kind || null,
            conflictFiles: blockedTask?.integrationFailure?.conflictFiles || [],
            blockedTaskCount: blockedTasks.length,
            missingTaskIds,
          };
          if (!blockedTask || missingTaskIds.length || blockedTask.state === "cancelled" || blockedTask.integrationFailure?.kind === "local-change-ownership") {
            return this.#blockOneShotFailure(
              "technical",
              `one_shot_task_blocked:${failureKind}`,
              new Error(reason),
              `${reason}。本轮已保留在当前卡点；只有本地修改归属事实明确或用户从卡点继续时才会重新执行。`,
              details,
            );
          }
          const run = state.oneShotRun;
          this.#recordFailure({
            kind: "technical",
            sourceType: "system",
            sourceId: "nangong-evolution",
            operation: `one_shot_task_waiting_for_linghu:${failureKind}`,
            error: new Error(reason),
            correlationId: topic.topicId,
            fingerprint: `nangong-one-shot:${run?.runId || "unknown"}:waiting-for-linghu:${blockedTask.taskId}:${failureKind}`,
            details: { runId: run?.runId || null, topicId: topic.topicId, proposalId: proposal.proposalId, ...details },
          });
          this.#store.updateOneShotRun("testing", "linghu-ancestor", "令狐老祖", `${reason}；正在沿统一异常入口修正，取得新的执行或测试事实后本轮会自动继续`, topic.topicId, proposal.proposalId);
          return this.state();
        }
        const testing = proposal.status === "verifying" || tasks.some((item) => item.unifiedTest?.status === "running" || ["unified-testing", "integrating", "queued-integration"].includes(item.state));
        const activity = currentExecutionActivity(collaborationState, tasks, proposal.title);
        this.#store.updateOneShotRun(
          testing ? "testing" : "executing",
          testing ? "linghu-ancestor" : "codex",
          testing ? "令狐老祖" : activity.actorName,
          testing ? "正在执行统一测试、集成和恢复门禁" : activity.action,
          topic.topicId,
          proposal.proposalId,
        );
        return this.state();
      }

      if (flowAction === "accept-result") {
        const attemptId = randomUUID();
        const publishAcceptance = (phase: "received" | "started" | "passed" | "failed", content: string) => this.#acceptanceHandoff.publish(proposal, phase, content, attemptId);
        publishAcceptance("received", `已收到令狐返回的统一测试和重启健康结果。请韩立按本次范围实际操作验收：${proposal.acceptanceCriteria.join("；")}`);
        this.#store.updateOneShotRun("accepting", "han-li", "韩立", "正在观察页面并逐步操作验收", topic.topicId, proposal.proposalId);
        if (!this.#computerAcceptanceSession) return this.#blockOneShotFailure("technical", "run_real_application_acceptance", new Error("韩立交互式验收会话尚未接入。"), "韩立交互式验收会话尚未接入。");
        try {
          const goal: HanliComputerAcceptanceInDto = { topicId: topic.topicId, proposalId: proposal.proposalId, title: proposal.title, criteria: proposal.acceptanceCriteria };
          publishAcceptance("started", "韩立正在观察真实页面并逐步操作验收。");
          const runResult = await this.#computerAcceptanceSession(goal);
          this.#hanli.completeAutomaticAcceptance(runResult, `one-shot-result:${run.runId}:${proposal.proposalId}:${runResult.runId}`);
          if (runResult.status === "blocked") {
            const reason = runResult.stepResults.filter((step) => step.status === "blocked").map((step) => `${step.checkId}：${step.actual}`).join("\n");
            publishAcceptance("failed", `验收受阻，已上报令狐处理：\n${reason}`);
            return this.#blockOneShotFailure("technical", "run_real_application_acceptance", new Error(reason), reason, { evidenceAttachmentIds: runResult.evidenceAttachmentIds, acceptanceRunId: runResult.runId });
          }
          if (runResult.status === "failed") {
            // 先提取本轮真实新缺陷，再决定能否沿原验收范围自动修复。
            const scopeReview = this.#acceptanceFailureScope.review(proposal, runResult);
            // 可见传达点名具体条件、实际结果、期望结果和范围判断。
            const failureMessage = `韩立验收未通过。\n本轮真实新缺陷：\n${scopeReview.summary}\n范围判断：${scopeReview.reason}`;
            publishAcceptance("failed", failureMessage);
            // 范围不明确时保留原验收点等待确认，不能把相邻问题自动写入修复任务。
            if (scopeReview.decision !== "within-original-acceptance") {
              return this.#blockOneShotFailure("business", "review_acceptance_failure_scope", new Error(scopeReview.reason), failureMessage, {
                acceptanceRunId: runResult.runId,
                evidenceAttachmentIds: runResult.evidenceAttachmentIds,
                acceptanceFailureScope: scopeReview,
              });
            }
            // 范围内失败进入统一卡点入口，由令狐建立新的修复任务并在完成后回到韩立复验。
            return this.#blockOneShotFailure("technical", "repair_failed_real_application_acceptance", new Error(scopeReview.summary), failureMessage, {
              acceptanceRunId: runResult.runId,
              evidenceAttachmentIds: runResult.evidenceAttachmentIds,
              acceptanceFailureScope: scopeReview,
            });
          }
          // 通过结果仍完整保留运行记录、逐步结论和截图证据。
          publishAcceptance("passed", `韩立真实界面验收通过。运行记录：${runResult.runId}\n逐步结果：\n${runResult.stepResults.map((step) => `${step.checkId} 第${step.operationIndex + 1}步 ${step.status}：${step.actual}`).join("\n")}\n截图证据：${runResult.evidenceAttachmentIds.join("、")}`);
        } catch (error) {
          const reason = `韩立真实应用验收失败：${error instanceof Error ? error.message : String(error)}`;
          publishAcceptance("failed", reason);
          return this.#blockOneShotFailure("technical", "run_real_application_acceptance", error, reason);
        }
        continue;
      }

      if (flowAction === "complete" || topic.status === "completed") {
        state = this.#store.finishOneShotRun();
        state = this.#store.appendConversation("nangong", `本轮演化已经完整完成：课题“${topic.title}”已通过韩立审批、任务执行、令狐统一测试和韩立真实界面验收，全部记录已归档到专题工作台。`, []);
        if (state.automationRuntime.status === "running") this.#scheduleContinuation(1_000);
        return state;
      }
      return state;
    }
    return this.#blockOneShotFailure("technical", "advance_one_shot_transition_limit", new Error("一次性流程在单次推进中出现过多连续状态变化。"), "一次性流程在单次推进中出现过多连续状态变化，已保留恢复点等待检查。");
  }

  /** 被转换为可恢复暂停态的失败也必须进入统一异常中心，不能因 catch 而丢失。 */
  #blockOneShotFailure(kind: "technical" | "business", operation: string, error: unknown, reason: string, details: Record<string, unknown> = {}): EvolutionStateOutDto {
    const state = this.state();
    const run = state.oneShotRun;
    const topicId = run?.topicId || state.activeTopicId;
    this.#recordFailure({
      kind,
      sourceType: kind === "business" ? "member" : "system",
      sourceId: kind === "business" ? "nangong-wan" : "nangong-evolution",
      operation,
      error,
      correlationId: topicId || run?.runId || null,
      fingerprint: `nangong-one-shot:${run?.runId || "unknown"}:${operation}:${run?.proposalId || "none"}`,
      flowImpact: "blocked",
      details: { runId: run?.runId || null, topicId: topicId || null, proposalId: run?.proposalId || null, phase: run?.phase || null, recoveryPoint: run?.action || null, ...details },
    });
    return this.#store.blockOneShotRun(reason);
  }

  async #tick(): Promise<void> {
    if (this.#running) return;
    this.#running = true;
    try {
      let state = this.state();
      if (state.automationRuntime.status === "running") {
        for (const proposal of state.proposals.filter((item) => ["supplement-required", "rejected"].includes(item.status))) {
          if (state.proposals.some((item) => item.supersedesProposalId === proposal.proposalId)) continue;
          if (!proposal.approvals.at(-1)?.advice.trim()) continue;
          state = await this.nangongRuntime.facade.investigateAndReviseReturnedProposal(proposal.proposalId);
        }
      }
      for (const proposal of state.proposals.filter((item) => item.distributedTaskIds.length && ["executing", "verifying", "blocked"].includes(item.status))) {
        // 每轮只读取一次协作快照，避免同一状态核对跨越两次异步变化。
        let collaborationState = this.#collaboration.state();
        // 提案执行聚合统一给出当前有效任务和下一状态。
        let execution = new ProposalExecutionAggregate({ proposal, collaborationTasks: collaborationState.tasks }).view();
        // 全部交回且没有阻塞时才封存本轮并进入集成。
        if (!execution.blocked && execution.allReturned) {
          this.#collaboration.sealEvolutionRound(proposal.proposalId, proposal.distributedTaskIds);
          // 封存会改变任务状态，因此重新取得一次权威协作快照。
          collaborationState = this.#collaboration.state();
          // 使用新快照重新建立执行视图，禁止沿用封存前的结论。
          execution = new ProposalExecutionAggregate({ proposal, collaborationTasks: collaborationState.tasks }).view();
        }
        // 只有状态真实变化时才写 Evolution，避免轮询产生重复事实。
        if (proposal.status !== execution.nextStatus) {
          // 状态和摘要来自同一聚合视图，不会发生完成状态配阻塞文案。
          state = this.#store.markProgress(proposal.proposalId, execution.nextStatus, execution.summary);
        }
      }
      if (state.oneShotRun?.status === "running") {
        // 暂停、停止和人工接管必须冻结当前专题，恢复后仍沿原卡点继续。
        if (state.automationRuntime.status !== "running") return;
        if (!state.oneShotRun.topicId) {
          if (!this.#deliberation) {
            this.#blockOneShotFailure("technical", "advance_hanli_nangong_deliberation", new Error("人物内部研讨能力尚未接入。"), "人物内部研讨能力尚未接入。");
            return;
          }
          const hasCurrentRunDeliberation = state.deliberations.some((item) => Date.parse(item.createdAt) >= Date.parse(state.oneShotRun!.startedAt));
          const result = await this.#deliberation.advance({ requireProblem: true, forceNew: !hasCurrentRunDeliberation });
          state = result.state;
          const established = [...state.deliberations].reverse().find((item) => item.status === "established" && item.topicId);
          if (!established?.topicId) {
            this.#store.updateOneShotRun("preparing-topic", "han-li", "韩立", "正在判断南宫婉回答；条件不足时继续提出下一问", null, null);
            this.#scheduleContinuation(1_000);
            return;
          }
          state = this.#store.updateOneShotRun("forming-proposal", "nangong-wan", "南宫婉", "内部研讨条件已满足，正在把结论整理为实施提案", established.topicId, null);
        }
        await this.#advanceOneShot();
        return;
      }
      // 运行态代表用户已经确认统一托管；审批与分发固定自动，不再读取人物专用开关。
      if (state.automationRuntime.status !== "running") return;
      for (const proposal of state.proposals.filter((item) => this.#flow.next(item) === "await-approval")) state = this.#hanli.autoApprove(proposal.proposalId);
      for (const proposal of state.proposals.filter((item) => this.#flow.next(item) === "dispatch")) state = await this.#dispatch(proposal.proposalId);
      const hasActiveWork = state.proposals.some((item) => !["completed", "rejected"].includes(item.status))
        || state.topics.some((item) => !["completed", "rejected"].includes(item.status));
      const activeDeliberation = [...state.deliberations].reverse().find((item) => ["questioning", "ready-to-establish"].includes(item.status));
      if (this.#deliberation && (activeDeliberation || (!hasActiveWork && state.automationSettings.automaticCustodyEnabled === true))) {
        const result = await this.#deliberation.advance({ requireProblem: false });
        state = result.state;
        if (result.activity !== "idle") {
          state = this.#store.beginOneShotRun(state.automationContext.workspaceState!, state.automationContext.locale);
          const established = [...state.deliberations].reverse().find((item) => item.status === "established" && item.topicId);
          state = this.#store.updateOneShotRun(
            established?.topicId ? "forming-proposal" : "preparing-topic",
            established?.topicId ? "nangong-wan" : "han-li",
            established?.topicId ? "南宫婉" : "韩立",
            established?.topicId ? "内部研讨条件已满足，正在形成实施提案" : "正在判断南宫婉回答并继续内部研讨",
            established?.topicId || null,
            null,
          );
          this.#scheduleContinuation(1_000);
          return;
        }
      }
      const topic = state.topics.find((item) => ["registered", "investigating"].includes(item.status));
      if (!topic || state.proposals.some((item) => item.topicId === topic.topicId && item.status === "pending-approval")) return;
      const content = `课题：${topic.title}\n\n目标：${topic.goal}\n\n调查事实：\n${topic.evidence.map((item) => `- ${item}`).join("\n")}\n\n推荐方向：在已登记范围内实施，并保持排除项不变。`;
      let next = this.nangongRuntime.facade.createProposal(topic.topicId, { type: "代码修正", content, risks: ["实施结果可能与既有调用方产生兼容影响"], rollbackPlan: "保留提案版本和关联任务，失败时撤销任务分支且不覆盖历史提案。" });
      const proposal = next.proposals.at(-1)!;
      next = this.#hanli.autoApprove(proposal.proposalId);
      const decided = requireProposal(next, proposal.proposalId);
      if (decided.status === "approved") await this.#dispatch(proposal.proposalId);
    } catch (error) {
      const state = this.state();
      if (state.oneShotRun?.status === "running") this.#blockOneShotFailure("technical", "nangong_evolution_tick", error, `南宫婉自动推进失败：${error instanceof Error ? error.message : String(error)}`);
      else this.#recordFailure({ kind: "technical", sourceType: "system", sourceId: "nangong-evolution", operation: "nangong_evolution_tick", error, correlationId: state.activeTopicId, fingerprint: `nangong-evolution-tick:${state.activeTopicId || "no-topic"}` });
    } finally { this.#running = false; }
  }
}

function requireProposal(state: EvolutionStateOutDto, proposalId: string): EvolutionProposalOutDto { const proposal = state.proposals.find((item) => item.proposalId === proposalId); if (!proposal) throw new Error("演化提案不存在。"); return proposal; }

/** 运行中人物以任务当前阶段的权威成员 ID 为准，不能让上一阶段遗留的 currentHandler 覆盖真实执行者。 */
function taskOwnerName(state: ReturnType<CollaborationWorkflowFacade["state"]>, task: ReturnType<CollaborationWorkflowFacade["state"]>["tasks"][number]): string {
  const memberId = task.executorMemberId;
  return state.members.find((member) => member.memberId === memberId)?.displayName
    || (memberId === task.originalExecutor?.memberId ? task.originalExecutor.displayName : null)
    || task.currentHandler?.displayName
    || "未识别负责人";
}

function taskStageName(task: ReturnType<CollaborationWorkflowFacade["state"]>["tasks"][number]): string {
  if (["ready-for-integration", "queued-integration", "integrating"].includes(task.state) || task.integrationFailure) return "版本集成阶段";
  if (["unified-testing", "test-failed"].includes(task.state)) return "统一测试阶段";
  if (task.state === "awaiting-restart") return "应用重启验收阶段";
  return "任务执行阶段";
}

function currentExecutionActivity(
  state: ReturnType<CollaborationWorkflowFacade["state"]>,
  tasks: ReturnType<CollaborationWorkflowFacade["state"]>["tasks"],
  fallbackTitle: string,
): { actorName: string; action: string } {
  const active = tasks
    .filter((task) => !["integrated", "cancelled"].includes(task.state))
    .sort((left, right) => Date.parse(right.updatedAt || right.createdAt) - Date.parse(left.updatedAt || left.createdAt));
  const selected = active.length ? active : tasks.slice(-1);
  const actors = [...new Set(selected.map((task) => taskOwnerName(state, task)))];
  const actorName = actors.join("、") || "执行成员";
  if (selected.length <= 1) return { actorName, action: `正在执行：${selected[0]?.snapshot.title || fallbackTitle}` };
  const titles = selected.slice(0, 3).map((task) => `“${task.snapshot.title}”`).join("、");
  return { actorName, action: `正在并行执行 ${selected.length} 个任务：${titles}${selected.length > 3 ? "等" : ""}` };
}

function itemFailureReason(task: ReturnType<CollaborationWorkflowFacade["state"]>["tasks"][number]): string {
  return task.blockingReason || task.repairFailureReason || task.unifiedTest?.failureReason || `任务 ${task.snapshot.title} 未能继续，交给令狐按原恢复线路处理。`;
}
