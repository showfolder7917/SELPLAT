import { randomUUID } from "node:crypto";

import type { CollaborationMemoryPort, ConversationRoundTopicDecision } from "../../../../contracts/capabilities/event-center/index.js";
import type { CreateLinghuRepairProposalOutDto } from "../../../../contracts/collaboration/linghu/index.js";
import type { ConfigureEvolutionAutomationRequest, ConvertNangongConversationToTopicRequest, CreateEvolutionProposalRequest, CreateEvolutionTopicRequest, DecideEvolutionProposalRequest, DecideEvolutionResultRequest, EvolutionAutomationAction, EvolutionDistributionPlan, EvolutionDistributionUnit, EvolutionMutationRequest, EvolutionProposal, EvolutionTopicDossier, EvolutionWorkbenchPage, EvolutionWorkbenchPreference, GenerateNangongTopicDraftRequest, HanLiAcceptancePlan, HanLiAcceptanceRun, EvolutionState, NangongTopicDraft, QueryEvolutionWorkbenchRequest, ReviseEvolutionProposalRequest, SaveEvolutionWorkbenchPreferenceRequest, SendNangongConversationMessageRequest, UpdateEvolutionTopicRequest } from "../../../../contracts/collaboration/evolution/index.js";
import type { SendMessageResponse } from "../../../../contracts/capabilities/conversation/index.js";
import type { EventCenterExceptionInput } from "../../../../contracts/governance/workflow.js";
import type { CollaborationTimelineBusinessEvent } from "../../../../contracts/collaboration/workflow/index.js";
import type { CodexStreamEvent } from "../../../../contracts/platform/codex/index.js";
import type { CollaborationWorkflowFacade } from "../index.js";
import { EvolutionFlowOrchestrator } from "./evolution-flow.orchestrator.js";
import { EvolutionTaskDistributionService } from "./evolution-task-distribution.service.js";
import { createEvolutionApprovalService, createHanliDeliberationPort, type EvolutionApprovalPort, type HanliDeliberationPort } from "../../personas/hanli/index.js";
import {
  createEvolutionMutationCoordinator,
  type EvolutionMutationPort,
  type EvolutionStatePort,
} from "../../evolution/index.js";

/** 南宫婉语义判断成熟后必须在可见正文中使用该句，Store 据此建立可恢复的等待确认事实。 */
const NANGONG_ONE_SHOT_INVITATION = "若确认启动本轮完整演化，请回复 1。";

export interface PersonaEvolutionRuntimeOptions {
  store: EvolutionStatePort;
  collaboration: CollaborationWorkflowFacade;
  conversation: {
    send(request: SendNangongConversationMessageRequest, context: string): Promise<SendMessageResponse>;
    newChat(): Promise<void>;
  };
  hanLi?: {
    send(prompt: string, state: EvolutionState): Promise<string>;
  };
  nangongDeliberation?: {
    send(question: string, context: string, state: EvolutionState): Promise<string>;
  };
  investigateRevision?: (prompt: string, workspaceState: EvolutionState["topics"][number]["workspaceState"], locale: EvolutionState["topics"][number]["locale"]) => Promise<string>;
  planDistribution?: (prompt: string, workspaceState: EvolutionState["topics"][number]["workspaceState"], locale: EvolutionState["topics"][number]["locale"], emit: (event: CodexStreamEvent) => void) => Promise<string>;
  planAcceptance?: (prompt: string, workspaceState: EvolutionState["topics"][number]["workspaceState"], locale: EvolutionState["topics"][number]["locale"]) => Promise<string>;
  recordEvent(type: string, details: Record<string, unknown>, taskId?: string): void;
  recordFailure?(input: EventCenterExceptionInput): void;
  recordTimelineEvent?: (event: CollaborationTimelineBusinessEvent) => void;
  recordTimelineStream?: (taskId: string, memberId: string, event: CodexStreamEvent) => void;
  memory?: CollaborationMemoryPort | null;
  readDossier?: (topicId: string, state: EvolutionState) => EvolutionTopicDossier;
  queryWorkbench?: (request: QueryEvolutionWorkbenchRequest) => EvolutionWorkbenchPage;
  getWorkbenchPreference?: (perspective: "nangong" | "hanli", nodeId: string) => EvolutionWorkbenchPreference | null;
  saveWorkbenchPreference?: (request: SaveEvolutionWorkbenchPreferenceRequest) => EvolutionWorkbenchPreference;
  beginMutation?: (topicId: string, action: string, request: EvolutionMutationRequest, currentStateVersion: string) => "started" | "completed";
  completeMutation?: (idempotencyKey: string, resultStateVersion: string) => void;
  failMutation?: (idempotencyKey: string, error: unknown) => void;
  newConversationRetryDelaysMs?: number[];
}

/** 保持自动演化、自动审批和自动执行三道独立开关，并只在审批通过后调用协同分发。 */
/**
 * 跨人物演化运行时。
 *
 * 业务作用：在迁移后的唯一组合点连接南宫、韩立、Evolution 与协作 Workflow，
 * 对外由各人物 Facade 按职责裁剪方法，不再把这一完整运行对象冒充为南宫人物能力。
 */
export class PersonaEvolutionRuntime {
  readonly #store: EvolutionStatePort;
  readonly #collaboration: CollaborationWorkflowFacade;
  readonly #conversation: PersonaEvolutionRuntimeOptions["conversation"];
  readonly #hanLi: NonNullable<PersonaEvolutionRuntimeOptions["hanLi"]>;
  readonly #nangongDeliberation: NonNullable<PersonaEvolutionRuntimeOptions["nangongDeliberation"]>;
  readonly #investigateRevision: NonNullable<PersonaEvolutionRuntimeOptions["investigateRevision"]>;
  readonly #planDistribution: NonNullable<PersonaEvolutionRuntimeOptions["planDistribution"]>;
  readonly #planAcceptance: NonNullable<PersonaEvolutionRuntimeOptions["planAcceptance"]>;
  readonly #recordEvent: PersonaEvolutionRuntimeOptions["recordEvent"];
  readonly #recordFailure: NonNullable<PersonaEvolutionRuntimeOptions["recordFailure"]>;
  readonly #memory: CollaborationMemoryPort | null;
  readonly #readDossier: PersonaEvolutionRuntimeOptions["readDossier"];
  readonly #queryWorkbench: PersonaEvolutionRuntimeOptions["queryWorkbench"];
  readonly #getWorkbenchPreference: PersonaEvolutionRuntimeOptions["getWorkbenchPreference"];
  readonly #saveWorkbenchPreference: PersonaEvolutionRuntimeOptions["saveWorkbenchPreference"];
  readonly #mutations: EvolutionMutationPort;
  readonly #approvals: EvolutionApprovalPort;
  readonly #hanliDecisions: HanliDeliberationPort;
  readonly #distribution: EvolutionTaskDistributionService;
  // 流程判断器只根据已保存事实决定下一步，不替人物作审批决定。
  readonly #flow = new EvolutionFlowOrchestrator();
  readonly #newConversationRetryDelaysMs: number[];
  #timer: ReturnType<typeof setInterval> | null = null;
  #running = false;
  #oneShotAcceptanceRunner: ((plan: HanLiAcceptancePlan) => Promise<HanLiAcceptanceRun>) | null = null;

  /**
   * 组装南宫婉唯一业务入口。
   * 真实传参示例：主进程传入 Evolution 状态端口、Workflow 门面、人物会话和事件记录器。
   * 真实返回示例：构造完成后可读取专题状态、创建提案并推进一次性演化。
   * 异常或副作用示例：未接入的可选 AI 能力会在真正调用时给出中文错误，不会在启动时伪造成功。
   */
  constructor(options: PersonaEvolutionRuntimeOptions) {
    // Evolution 是专题和提案事实的唯一所有者，南宫只通过端口读写。
    this.#store = options.store;
    // Workflow 负责把通过审批的任务交给真实执行人。
    this.#collaboration = options.collaboration;
    // conversation 保存南宫与用户的个人调查会话。
    this.#conversation = options.conversation;
    // 韩立研讨未接入时保留明确失败函数，避免自动流程静默跳过审批人。
    this.#hanLi = options.hanLi || { send: async () => { throw new Error("韩立研讨会话尚未接入。 "); } };
    // 南宫的独立调查会话同样必须由组合根显式提供。
    this.#nangongDeliberation = options.nangongDeliberation || { send: async () => { throw new Error("南宫婉研讨会话尚未接入。 "); } };
    // 返修、分发和验收计划都是可替换 Port，默认值只负责报告缺失能力。
    this.#investigateRevision = options.investigateRevision || (async () => { throw new Error("南宫婉返修调查能力尚未接入。"); });
    this.#planDistribution = options.planDistribution || (async () => { throw new Error("南宫婉任务拆分调查尚未接入。"); });
    this.#planAcceptance = options.planAcceptance || (async () => { throw new Error("韩立界面验收计划能力尚未接入。"); });
    // 正常事件与异常事件分开登记，页面才能区分业务等待和技术故障。
    this.#recordEvent = options.recordEvent;
    this.#recordFailure = options.recordFailure || (() => undefined);
    // 记忆和工作台查询属于可选读模型；数据库不可用时由公开方法给出明确说明。
    this.#memory = options.memory || null;
    this.#readDossier = options.readDossier;
    this.#queryWorkbench = options.queryWorkbench;
    this.#getWorkbenchPreference = options.getWorkbenchPreference;
    this.#saveWorkbenchPreference = options.saveWorkbenchPreference;
    // 所有专题写动作共用同一个幂等和互斥协调器。
    this.#mutations = createEvolutionMutationCoordinator({ begin: options.beginMutation, complete: options.completeMutation, fail: options.failMutation });
    // 审批由韩立模块创建，南宫不能直接修改审批事实。
    this.#approvals = createEvolutionApprovalService(this.#store, options.recordTimelineEvent || null);
    // Workflow 只调用韩立判断端口；研讨提示、证据权重和审批解析均留在韩立模块内部。
    this.#hanliDecisions = createHanliDeliberationPort({
      store: this.#store,
      memory: this.#memory,
      askHanli: (prompt, state) => this.#hanLi.send(prompt, state),
      askNangong: (question, context, state) => this.#nangongDeliberation.send(question, context, state),
      recordEvent: this.#recordEvent,
    });
    // 分发由 Workflow 创建，并把 AI 返回值先解析成确定的结构化计划。
    this.#distribution = new EvolutionTaskDistributionService({
      store: this.#store,
      collaboration: this.#collaboration,
      recordEvent: this.#recordEvent,
      timeline: options.recordTimelineEvent,
      timelineStream: options.recordTimelineStream,
      plan: async (proposal, topic, feedback, emit) => parseDistributionPlan(await this.#planDistribution(
        distributionPlanningPrompt(proposal, topic, feedback),
        topic.workspaceState,
        topic.locale,
        emit,
      )),
    });
    // 新建官方会话失败时按短间隔有限重试，禁止无限循环冻结页面。
    this.#newConversationRetryDelaysMs = options.newConversationRetryDelaysMs || [0, 500, 1_500, 3_000];
  }

  /** 读取当前 Evolution 快照；返回值是副本，调用方不能绕过 Store 直接改状态。 */
  state(): EvolutionState { return this.#store.state(); }

  /** 按专题读取来源、研讨、提案和执行档案；数据库读模型不可用时使用当前状态安全降级。 */
  dossier(topicId: string): EvolutionTopicDossier {
    const state = this.state();
    if (this.#readDossier) return this.#readDossier(topicId, state);
    const topic = state.topics.find((item) => item.topicId === topicId);
    if (!topic) throw new Error("专题池中不存在该专题。 ");
    const deliberation = topic.deliberationId ? state.deliberations.find((item) => item.deliberationId === topic.deliberationId) || null : null;
    return { topic, deliberation, proposals: state.proposals.filter((item) => item.topicId === topicId), archiveRecords: state.archiveRecords.filter((item) => item.topicId === topicId || item.deliberationId === topic.deliberationId), executionRecords: [] };
  }
  /** 查询演化工作台一页数据；数据库不可用时阻止返回不完整的伪结果。 */
  queryWorkbench(request: QueryEvolutionWorkbenchRequest): EvolutionWorkbenchPage {
    if (!this.#queryWorkbench) throw new Error("专题演化数据库读模型不可用，请检查数据库初始化状态。");
    return this.#queryWorkbench(request);
  }
  /** 读取指定人物和树节点的显示偏好；未保存时返回 null。 */
  getWorkbenchPreference(perspective: "nangong" | "hanli", nodeId: string): EvolutionWorkbenchPreference | null { return this.#getWorkbenchPreference?.(perspective, nodeId) || null; }

  /** 保存分页或展开偏好；持久化不可用时明确失败，不只更新当前页面内存。 */
  saveWorkbenchPreference(request: SaveEvolutionWorkbenchPreferenceRequest): EvolutionWorkbenchPreference {
    if (!this.#saveWorkbenchPreference) throw new Error("专题演化视图偏好数据库不可用。");
    return this.#saveWorkbenchPreference(request);
  }
  /** 订阅已持久化的 Evolution 状态变化，并返回取消订阅函数。 */
  subscribe(listener: Parameters<EvolutionStatePort["subscribe"]>[0]) { return this.#store.subscribe(listener); }

  /** 启动一次立即检查和三十秒周期检查；重复调用不会创建第二个计时器。 */
  start(): void { if (!this.#timer) { void this.#tick(); this.#timer = setInterval(() => void this.#tick(), 30_000); } }

  /** 停止自动检查；已持久化的专题和恢复点不会被清除。 */
  stop(): void { if (this.#timer) clearInterval(this.#timer); this.#timer = null; }
  /** 主进程窗口层登记真实应用验收执行器；业务状态仍由本 Facade 和原结果审批接口推进。 */
  setOneShotAcceptanceRunner(runner: (plan: HanLiAcceptancePlan) => Promise<HanLiAcceptanceRun>): void { this.#oneShotAcceptanceRunner = runner; }
  /** 协作任务状态变化时立即核对一次性流程，避免等待固定轮询间隔。 */
  notifyWorkflowChanged(): void { void this.#tick(); }
  /** 把用户已确认的范围登记为正式专题，不自动创建提案或执行任务。 */
  createTopic(request: CreateEvolutionTopicRequest): EvolutionState { return this.#store.createTopic(request); }
  /** 独立开关一个自动化环节，其他审批或执行开关保持原值。 */
  setAutomation(kind: "evolution" | "nangong-approval" | "linghu-approval" | "execution", enabled: boolean): EvolutionState { return this.#store.setAutomation(kind, enabled); }
  /** 保存轮询间隔、最大轮数等受控参数，不立即推进业务状态。 */
  configureAutomation(request: ConfigureEvolutionAutomationRequest): EvolutionState { return this.#store.configureAutomation(request); }
  /** 启动、暂停、恢复或停止自动流程，并保留可恢复的当前卡点。 */
  controlAutomation(action: EvolutionAutomationAction): EvolutionState { return this.#store.controlAutomation(action); }
  async sendConversationMessage(request: SendNangongConversationMessageRequest): Promise<EvolutionState> {
    const current = this.state();
    const confirmation = current.oneShotConfirmation;
    const ready = confirmation?.status === "awaiting-user-confirmation" && confirmation.conversationId === current.conversation.conversationId;
    if (request.message.trim() === "1") return this.#startOneShotFromConversation(request, ready);
    const userMessageId = request.clientMessageId || `evolution-message-${randomUUID()}`;
    let state = this.#store.appendConversation("user", request.message, request.attachmentIds || [], { messageId: userMessageId, deliveryStatus: "sending" });
    const userMessage = state.conversation.messages.at(-1)!;
    let turnCompleted = false;
    try {
      const context = this.#memory?.buildNangongContext(state.conversation)
        || state.conversation.messages.slice(-12).map((item) => `${item.role === "user" ? "用户" : "南宫婉"}：${item.content}`).join("\n\n");
      const response = await this.#conversation.send(request, context);
      const parsed = parseConversationResponse(response.text);
      state = this.#store.completeConversationTurn(userMessage.messageId, parsed.reply);
      turnCompleted = true;
      if (parsed.topic.userIntent) state = this.#store.recordConversationIntent(userMessage.messageId, parsed.topic.userIntent);
      const nangongMessage = state.conversation.messages.at(-1)!;
      state = this.#store.setOneShotConfirmation(!request.topicId && parsed.invitesOneShot ? nangongMessage.messageId : null);
      if (request.topicId) state = this.#store.recordTopicConversation(request.topicId, userMessage.messageId, nangongMessage.messageId);
      this.#archiveConversationRound(state, userMessage.messageId, nangongMessage.messageId, parsed.topic.userIntent ? parsed.topic : null);
      this.#recordEvent("nangong.evolution.conversation_replied", {
        conversationId: state.conversation.conversationId,
        messageCount: state.conversation.messages.length,
        conversationTopicTitle: parsed.topic.title,
        conversationTopicType: parsed.topic.type,
        switchedTopic: parsed.topic.switchTopic,
        topicId: request.topicId || null,
      });
      return state;
    } catch (error) {
      if (!turnCompleted) this.#store.failConversationTurn(userMessage.messageId);
      throw error;
    }
  }

  /** 训练归档是完整人物回合后的旁路；失败写统一异常中心并保留运行态原文供后续重试。 */
  #archiveConversationRound(state: EvolutionState, userMessageId: string, nangongMessageId: string, decision: ConversationRoundTopicDecision | null): void {
    if (!this.#memory) return;
    queueMicrotask(() => {
      try {
        if (decision) this.#memory?.registerRound(state.conversation, userMessageId, nangongMessageId, decision);
        else this.#memory?.syncConversation(state.conversation);
        this.#recordEvent("training_corpus.conversation_round_archived", { conversationId: state.conversation.conversationId, userMessageId, nangongMessageId, source: "nangong" });
      } catch (error) {
        this.#recordFailure({
          kind: "technical", sourceType: "system", sourceId: "nangong-training-archive",
          operation: "archive_completed_conversation_round", error, correlationId: state.conversation.conversationId,
          details: { userMessageId, nangongMessageId, source: "nangong" },
        });
      }
    });
  }

  /**
   * 作用：把南宫婉已经明确提出的一次确认转换为当前课题的单轮全流程托管。
   * 真实传参示例：界面已显示可恢复的“等待用户确认”状态，用户回复“1”后使用当前 SELPLAT 工作区开始整理课题。
   * 真实返回示例：返回已保存的课题和 oneShotRun；后续审批、分发、执行、测试与验收由原状态机继续。
   * 异常或副作用示例：没有南宫婉明确邀请时只保存解释回复；生成失败会持久化阻塞原因，不把已保存消息伪装成发送失败。
   */
  async #startOneShotFromConversation(request: SendNangongConversationMessageRequest, ready: boolean): Promise<EvolutionState> {
    const userMessageId = request.clientMessageId || `evolution-message-${randomUUID()}`;
    let state = this.#store.appendConversation("user", request.message, request.attachmentIds || [], { messageId: userMessageId, deliveryStatus: "sending" });
    const userMessage = state.conversation.messages.at(-1)!;
    if (!ready) {
      state = this.#store.completeConversationTurn(userMessage.messageId, "当前没有等待确认的一次性演化。请继续补充事实，或点击“整理为演化课题”检查内容；南宫婉明确显示本轮已可启动后，再回复 1。");
      this.#archiveConversationRound(state, userMessage.messageId, state.conversation.messages.at(-1)!.messageId, null);
      return state;
    }
    const previousRun = state.oneShotRun;
    if (previousRun?.status === "running") {
      if (this.#oneShotHasLiveOwner(state)) {
        const topic = state.topics.find((item) => item.topicId === previousRun.topicId);
        state = this.#store.completeConversationTurn(userMessage.messageId, `上一轮${topic ? `专题“${topic.title}”` : "演化任务"}仍在处理，当前环节是“${previousRun.action}”。无需重复启动，请到任务协作群查看当前节点和后续交接。`);
        this.#archiveConversationRound(state, userMessage.messageId, state.conversation.messages.at(-1)!.messageId, null);
        return state;
      }
      state = this.#store.retireOrphanedOneShotRun("数据库中保留了运行标记，但协作任务中没有对应的实际执行人物；系统已结束该遗留状态并继续本次确认。");
      this.#recordEvent("nangong.evolution.orphan_run_retired", { runId: previousRun.runId, topicId: previousRun.topicId, proposalId: previousRun.proposalId, phase: previousRun.phase });
    }
    state = this.#store.recordConversationIntent(userMessage.messageId, "确认将当前南宫婉调查对话整理为演化课题，并自动完成本轮既有审批、分发、测试与验收流程");
    state = this.#store.beginOneShotRun(request.workspaceState, request.locale);
    state = this.#store.completeConversationTurn(userMessage.messageId, "已确认启动本轮一次性演化。我正在整理课题；后续韩立审批、南宫婉分发、执行、令狐测试和韩立验收会沿现有流程连续推进，当前人物和动作会实时显示。");
    const confirmationMessage = state.conversation.messages.at(-1)!;
    this.#archiveConversationRound(state, userMessage.messageId, confirmationMessage.messageId, null);
    try {
      const draft = await this.generateTopicDraft({ workspaceState: request.workspaceState, locale: request.locale });
      state = this.#store.convertConversationToTopic({ confirmedByUser: true, ...draft, workspaceState: request.workspaceState, locale: request.locale });
      const topicId = state.activeTopicId!;
      state = this.#store.updateOneShotRun("forming-proposal", "nangong-wan", "南宫婉", "正在根据已确认课题形成实施提案", topicId, null);
      state = this.#store.recordTopicConversation(topicId, userMessage.messageId, confirmationMessage.messageId);
      await this.#tick();
      return this.state();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      state = this.#blockOneShotFailure("technical", "form_topic_from_conversation", error, reason);
      return this.#store.appendConversation("nangong", `本轮一次性演化已保留当前进度，但遇到无法自动继续的阻塞：${reason}`, []);
    }
  }

  /** 只有任务与人物运行事实互相吻合时，才允许旧 running 状态阻止新的用户确认。 */
  #oneShotHasLiveOwner(state: EvolutionState): boolean {
    const run = state.oneShotRun;
    if (!run || run.status !== "running") return false;
    if (!["executing", "testing"].includes(run.phase)) return true;
    const proposal = run.proposalId ? state.proposals.find((item) => item.proposalId === run.proposalId) : null;
    if (!proposal?.distributedTaskIds.length) return false;
    const collaboration = this.#collaboration.state();
    return collaboration.tasks
      .filter((task) => proposal.distributedTaskIds.includes(task.taskId) && !["integrated", "cancelled"].includes(task.state))
      .some((task) => collaboration.members.some((member) => member.currentTaskId === task.taskId && !["idle", "offline"].includes(member.state)));
  }
  async newConversation(): Promise<EvolutionState> {
    for (const [index, retryDelay] of this.#newConversationRetryDelaysMs.entries()) {
      if (retryDelay) await new Promise((resolve) => setTimeout(resolve, retryDelay));
      try {
        await this.#conversation.newChat();
        return this.#store.newConversation();
      } catch (error) {
        // Codex 取消当前回合后可能短暂保留写入租约；只对该明确竞争做有限等待，其他删除错误立即回显。
        if (!String(error).toLowerCase().includes("active writer") || index === this.#newConversationRetryDelaysMs.length - 1) throw error;
      }
    }
    throw new Error("无法重新建立南宫婉对话。");
  }
  async generateTopicDraft(request: GenerateNangongTopicDraftRequest): Promise<NangongTopicDraft> {
    const messages = this.state().conversation.messages.slice(-20);
    if (!messages.length) throw new Error("当前没有可整理为课题的南宫婉对话。");
    const context = this.#memory?.buildNangongContext(this.state().conversation)
      || messages.map((item) => `${item.role === "user" ? "用户" : "南宫婉"}：${item.content}`).join("\n\n");
    // 草稿仅供用户编辑，不写入对话或课题持久化状态，避免绕过显式保存确认。
    const response = await this.#conversation.send({
      message: "请根据上述对话生成课题草稿。仅返回 JSON：{\"title\":\"\",\"goal\":\"\",\"scope\":[\"\"],\"evidence\":[\"\"],\"acceptanceCriteria\":[\"\"]}。事实证据必须说明来自用户陈述或南宫婉调查，不要把推断写成已证实事实；每个数组至少一项。",
      workspaceState: request.workspaceState,
      locale: request.locale,
    }, context);
    return parseTopicDraft(response.text);
  }
  convertConversationToTopic(request: ConvertNangongConversationToTopicRequest): EvolutionState { return this.#store.convertConversationToTopic(request); }
  createProposal(topicId: string, request: CreateEvolutionProposalRequest): EvolutionState { const next = this.#store.createProposal(topicId, request); return this.#approvals.recordApplication(next.proposals.at(-1)!.proposalId); }
  updateTopic(topicId: string, request: UpdateEvolutionTopicRequest): EvolutionState { return this.#store.updateTopic(topicId, request); }
  createLinghuRepairProposal(request: CreateLinghuRepairProposalOutDto): EvolutionState { const next = this.#store.createLinghuRepairProposal(request); return this.#approvals.recordApplication(next.proposals.at(-1)!.proposalId); }
  decideProposal(proposalId: string, request: DecideEvolutionProposalRequest): EvolutionState {
    const proposal = requireProposal(this.state(), proposalId);
    return this.#mutations.run(proposal.topicId, "人工审批", request.mutation, () => this.state().updatedAt, () => this.state(), () => this.#approvals.decide(proposalId, request.decision, request.advice || "", "manual-user", [], request.feedbackTarget || "proposal-content", request.capabilityScope || ""));
  }
  decideResult(proposalId: string, request: DecideEvolutionResultRequest): EvolutionState {
    return this.#decideResult(proposalId, request, "manual-user");
  }

  #decideResult(proposalId: string, request: DecideEvolutionResultRequest, source: "manual-user" | "automatic-han-li"): EvolutionState {
    const proposal = requireProposal(this.state(), proposalId);
    return this.#mutations.run(proposal.topicId, "结果验收", request.mutation, () => this.state().updatedAt, () => this.state(), () => this.#store.decideResult(proposalId, request.decision, request.advice || "", source));
  }

  /** 只让韩立根据当前专题语义生成检查计划；生成动作不会自动判定通过或改变审批线路。 */
  async generateAcceptancePlan(proposalId: string): Promise<HanLiAcceptancePlan> {
    const state = this.state();
    const proposal = requireProposal(state, proposalId);
    if (proposal.status !== "pending-acceptance") throw new Error("只有等待结果验收的提案才能生成韩立界面验收计划。 ");
    const topic = state.topics.find((item) => item.topicId === proposal.topicId);
    if (!topic) throw new Error("验收计划对应的专题不存在。 ");
    const priorFindings = state.archiveRecords.filter((item) => item.eventType === "acceptance.experience_promoted").slice(-10).map((item) => item.payload);
    const plan = await this.#hanliDecisions.createAcceptancePlan(topic, proposal, priorFindings, this.#planAcceptance);
    this.#store.recordAcceptancePlan(plan);
    this.#recordEvent("hanli.acceptance.plan_generated", { topicId: topic.topicId, proposalId, planId: plan.planId, checkCount: plan.checks.length });
    return plan;
  }
  acceptancePlan(planId: string): HanLiAcceptancePlan {
    for (const record of [...this.state().archiveRecords].reverse()) {
      const value = record.eventType === "acceptance.plan_generated" ? record.payload.acceptancePlan : null;
      if (value && typeof value === "object" && (value as HanLiAcceptancePlan).planId === planId) return structuredClone(value as HanLiAcceptancePlan);
    }
    throw new Error("韩立验收计划不存在或已清理。 ");
  }
  recordAcceptanceRun(run: HanLiAcceptanceRun): EvolutionState {
    const plan = this.acceptancePlan(run.planId);
    if (plan.topicId !== run.topicId || plan.proposalId !== run.proposalId) throw new Error("真实验收记录与计划关联不一致。 ");
    return this.#store.recordAcceptanceRun(run);
  }

  reviseProposal(proposalId: string, request: ReviseEvolutionProposalRequest): EvolutionState {
    const proposal = requireProposal(this.state(), proposalId);
    const member = this.#collaboration.state().members.find((item) => item.memberId === request.submitterMemberId && item.enabled);
    if (!member) throw new Error("重新提交人不是当前已启用的协同人物。");
    return this.#mutations.run(proposal.topicId, "返修重提", request.mutation, () => this.state().updatedAt, () => this.state(), () => {
      const next = this.#store.revise(proposalId, request, member.displayName);
      return this.#approvals.recordApplication(next.proposals.at(-1)!.proposalId);
    });
  }
  /** 驳回后先由南宫婉只读核查工作区；只有形成新的可验证事实才创建不可覆盖的新版本。 */
  async investigateAndReviseReturnedProposal(proposalId: string): Promise<EvolutionState> {
    const state = this.state();
    const proposal = requireProposal(state, proposalId);
    if (state.proposals.some((item) => item.supersedesProposalId === proposal.proposalId)) return state;
    const feedback = proposal.approvals.at(-1);
    const topic = state.topics.find((item) => item.topicId === proposal.topicId);
    if (!feedback?.advice.trim() || !topic) throw new Error("返修调查缺少课题或明确审批意见。");
    const response = await this.#investigateRevision(revisionInvestigationPrompt(topic, proposal, feedback.advice, feedback.feedbackTarget, feedback.capabilityScope), topic.workspaceState, topic.locale);
    const investigation = parseRevisionInvestigation(response);
    if (!hasMaterialRevisionEvidence(proposal, investigation, feedback.advice)) {
      const reason = `南宫婉只读调查没有产生可核验的新事实，未创建提案 v${proposal.version + 1}；请补充实际组件、状态或复现证据后从当前卡点继续。`;
      if (state.oneShotRun?.status === "running") return this.#blockOneShotFailure("business", "revise_proposal_without_new_evidence", new Error(reason), reason, { feedbackApprovalId: feedback.approvalId });
      this.#recordFailure({ kind: "business", sourceType: "member", sourceId: "nangong-wan", operation: "revise_proposal_without_new_evidence", error: new Error(reason), correlationId: topic.topicId, fingerprint: `nangong-revision:${proposal.proposalId}:no-material-evidence`, details: { topicId: topic.topicId, proposalId, feedbackApprovalId: feedback.approvalId } });
      return this.state();
    }
    const revised = this.reviseProposal(proposal.proposalId, {
      mutation: { expectedStateVersion: state.updatedAt, idempotencyKey: `automatic-revise:${proposal.proposalId}:${state.updatedAt}` },
      submitterMemberId: proposal.submitterMemberId,
      content: investigation.content,
      evidence: investigation.evidence,
      impactScope: investigation.impactScope,
      exclusions: investigation.exclusions,
      risks: investigation.risks,
      rollbackPlan: investigation.rollbackPlan,
      acceptanceCriteria: investigation.acceptanceCriteria,
    });
    this.#recordEvent("member.evolution.proposal_revised_after_investigation", { proposalId: proposal.proposalId, submitterMemberId: proposal.submitterMemberId, feedbackApprovalId: feedback.approvalId, evidenceCount: investigation.evidence.length, correlationId: topic.topicId, resolvesFailure: true });
    return revised;
  }

  /** 从当前持久化卡点恢复同一轮；恢复后立即沿原状态机推进，不触碰长期自动开关。 */
  async resumeOneShotRun(): Promise<EvolutionState> {
    const before = this.state();
    const run = before.oneShotRun;
    const proposal = run?.proposalId ? before.proposals.find((item) => item.proposalId === run.proposalId) : null;
    if (proposal?.status === "blocked") {
      const blockedTasks = this.#collaboration.state().tasks.filter((task) => proposal.distributedTaskIds.includes(task.taskId) && ["blocked", "test-failed"].includes(task.state));
      for (const task of blockedTasks) {
        await this.#collaboration.recoverTask(task.taskId, `用户已从一次性演化卡点明确继续：${itemFailureReason(task)}`);
      }
    }
    this.#store.resumeOneShotRun();
    await this.#tick();
    return this.state();
  }

  autoApprove(proposalId: string, request?: EvolutionMutationRequest): EvolutionState {
    const state = this.state();
    const proposal = requireProposal(state, proposalId);
    const mutation = request || { expectedStateVersion: state.updatedAt, idempotencyKey: `automatic-approve:${proposalId}:${state.updatedAt}` };
    return this.#mutations.run(proposal.topicId, "韩立审批", mutation, () => this.state().updatedAt, () => this.state(), () => this.#autoApproveOnce(proposalId));
  }

  #autoApproveOnce(proposalId: string): EvolutionState {
    const state = this.state();
    const proposal = requireProposal(state, proposalId);
    const manualHistory = state.proposals.flatMap((item) => item.approvals.map((approval) => ({ item, approval })))
      .filter(({ item, approval }) => item.type === proposal.type && item.origin === proposal.origin && approval.source === "manual-user");
    if (!proposal.content || !proposal.evidence.length || !proposal.impactScope.length || !proposal.risks.length || !proposal.rollbackPlan || !proposal.acceptanceCriteria.length) {
      return this.#approvals.decide(proposalId, "supplement-required", `事实、范围、风险、回退或验收条件不完整，请${proposal.submitterDisplayName}补充调查。`, "automatic-han-li", []);
    }
    const databaseHistory = this.#memory?.approvalEvidence(proposal.type, proposal.origin) || [];
    if (!manualHistory.length && !databaseHistory.length) return this.#approvals.decide(proposalId, "supplement-required", "没有同类型人工审批记录，不能以低置信度猜测通过。", "automatic-han-li", []);
    const latestState = manualHistory.at(-1);
    const latestDatabase = databaseHistory[0];
    const latest = latestState && (!latestDatabase || Date.parse(latestState.approval.createdAt) >= Date.parse(latestDatabase.approvedAt))
      ? { approvalId: latestState.approval.approvalId, decision: latestState.approval.decision, advice: latestState.approval.advice }
      : latestDatabase!;
    const decision = latest.decision === "approved" ? "approved" : latest.decision;
    const adviceContext = latest.advice.trim() ? `；历史建议：${latest.advice.trim().slice(0, 300)}` : "";
    return this.#approvals.decide(proposalId, decision, `参考同类型人工审批 ${latest.approvalId}，按用户历史关注点和审批习惯作出决定${adviceContext}。`, "automatic-han-li", [latest.approvalId]);
  }

  async dispatch(proposalId: string, request?: EvolutionMutationRequest): Promise<EvolutionState> {
    const initialState = this.state();
    const initialProposal = requireProposal(initialState, proposalId);
    const mutation = request || { expectedStateVersion: initialState.updatedAt, idempotencyKey: `automatic-dispatch:${proposalId}:${initialState.updatedAt}` };
    return this.#mutations.runAsync(initialProposal.topicId, "南宫婉任务分发", mutation, () => this.state().updatedAt, () => this.state(), () => this.#distribution.dispatch(proposalId));
  }

  /** Workflow 请求韩立推进一轮，但不接触韩立的提示、解析或判断规则。 */
  async advanceHanLiDeliberation(): Promise<EvolutionState> { return this.#hanliDecisions.advance(); }

  /** 一次性托管只调度现有动作；每次推进到需要等待真实任务状态的位置即返回。 */
  async #advanceOneShot(): Promise<EvolutionState> {
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
        state = this.createProposal(topic.topicId, { type: "代码修正", content, risks: ["实施可能影响既有调用方，必须通过原测试和验收门禁确认"], rollbackPlan: "保留课题、提案、任务和版本记录；失败时沿原恢复点返修，不覆盖已完成事实。" });
        proposal = state.proposals.at(-1)!;
        this.#store.updateOneShotRun("approving", "han-li", "韩立", "正在审批南宫婉提交的演化方向", topic.topicId, proposal.proposalId);
        continue;
      }

      const flowAction = this.#flow.next(proposal);
      if (flowAction === "await-approval") {
        this.#store.updateOneShotRun("approving", "han-li", "韩立", `正在审批提案 v${proposal.version}`, topic.topicId, proposal.proposalId);
        let decision: { decision: "approved" | "rejected" | "supplement-required"; advice: string };
        try { decision = await this.#reviewOneShotProposal(proposal); }
        catch (error) {
          const reason = `韩立方向审批结果无法处理：${error instanceof Error ? error.message : String(error)}`;
          return this.#blockOneShotFailure("technical", "review_one_shot_proposal", error, reason);
        }
        this.#approvals.decide(proposal.proposalId, decision.decision, decision.advice, "automatic-han-li", []);
        continue;
      }

      if (flowAction === "supplement") {
        const correctionRounds = proposals.filter((item) => item.supersedesProposalId !== null).length;
        if (correctionRounds >= state.automationSettings.maxCorrectionRounds) {
          const reason = `提案返修已经达到 ${state.automationSettings.maxCorrectionRounds} 轮，韩立仍未确认方向可执行。`;
          return this.#blockOneShotFailure("business", "revision_budget_exhausted", new Error(reason), reason);
        }
        this.#store.updateOneShotRun("revising", "nangong-wan", "南宫婉", `正在按韩立退回项重新调查提案 v${proposal.version}`, topic.topicId, proposal.proposalId);
        try { await this.investigateAndReviseReturnedProposal(proposal.proposalId); }
        catch (error) {
          const reason = `南宫婉重新调查失败：${error instanceof Error ? error.message : String(error)}`;
          return this.#blockOneShotFailure("technical", "investigate_and_revise_proposal", error, reason);
        }
        continue;
      }

      if (flowAction === "dispatch") {
        this.#store.updateOneShotRun("distributing", "nangong-wan", "南宫婉", "审批已通过，正在拆分并分发任务", topic.topicId, proposal.proposalId);
        try { await this.dispatch(proposal.proposalId); }
        catch (error) {
          const reason = `南宫婉任务拆分或分发失败：${error instanceof Error ? error.message : String(error)}`;
          return this.#blockOneShotFailure("technical", "plan_and_dispatch_one_shot", error, reason);
        }
        continue;
      }

      if (flowAction === "monitor-execution") {
        const collaborationState = this.#collaboration.state();
        const tasks = collaborationState.tasks.filter((task) => proposal!.distributedTaskIds.includes(task.taskId));
        if (proposal.status === "blocked") {
          const blockedTasks = tasks.filter((item) => ["blocked", "test-failed"].includes(item.state));
          const blockedTask = blockedTasks[0];
          const reason = blockedTask
            ? `${taskOwnerName(collaborationState, blockedTask)}负责的“${blockedTask.snapshot.title}”停在${taskStageName(blockedTask)}；发现：${itemFailureReason(blockedTask)}`
            : `提案“${proposal.title}”已经进入阻塞态，但没有找到对应的阻塞任务记录。`;
          const failureKind = blockedTask?.integrationFailure?.kind || blockedTask?.state || "unknown";
          const details = {
            taskId: blockedTask?.taskId || null,
            taskTitle: blockedTask?.snapshot.title || null,
            executorMemberId: blockedTask?.executorMemberId || null,
            taskState: blockedTask?.state || null,
            taskPhase: blockedTask?.phase || null,
            integrationFailureKind: blockedTask?.integrationFailure?.kind || null,
            conflictFiles: blockedTask?.integrationFailure?.conflictFiles || [],
            blockedTaskCount: blockedTasks.length,
          };
          if (!blockedTask || blockedTask.integrationFailure?.kind === "local-change-ownership") {
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
        this.#store.updateOneShotRun("accepting", "han-li", "韩立", "正在生成检查计划并验收真实应用界面", topic.topicId, proposal.proposalId);
        if (!this.#oneShotAcceptanceRunner) return this.#blockOneShotFailure("technical", "run_real_application_acceptance", new Error("韩立真实应用验收执行器尚未接入。"), "韩立真实应用验收执行器尚未接入。");
        try {
          const existingPlan = [...state.archiveRecords].reverse().find((record) => record.proposalId === proposal!.proposalId && record.eventType === "acceptance.plan_generated")?.payload.acceptancePlan as HanLiAcceptancePlan | undefined;
          const plan = existingPlan || await this.generateAcceptancePlan(proposal.proposalId);
          const runResult = await this.#oneShotAcceptanceRunner(plan);
          this.recordAcceptanceRun(runResult);
          state = this.state();
          this.#decideResult(proposal.proposalId, {
            mutation: { expectedStateVersion: state.updatedAt, idempotencyKey: `one-shot-result:${run.runId}:${proposal.proposalId}:${runResult.runId}` },
            decision: runResult.status === "passed" ? "approved" : "supplement-required",
            advice: runResult.status === "passed" ? "韩立已按真实用户路径完成检查，全部适用项目通过。" : "真实应用检查未通过，已携带复现步骤、实际结果、期望结果和截图证据返还南宫婉修订。",
          }, "automatic-han-li");
        } catch (error) {
          const reason = `韩立真实应用验收失败：${error instanceof Error ? error.message : String(error)}`;
          return this.#blockOneShotFailure("technical", "run_real_application_acceptance", error, reason);
        }
        continue;
      }

      if (flowAction === "complete" || topic.status === "completed") {
        state = this.#store.finishOneShotRun();
        return this.#store.appendConversation("nangong", `本轮演化已经完整完成：课题“${topic.title}”已通过韩立审批、任务执行、令狐统一测试和韩立真实界面验收，全部记录已归档到专题工作台。`, []);
      }
      return state;
    }
    return this.#blockOneShotFailure("technical", "advance_one_shot_transition_limit", new Error("一次性流程在单次推进中出现过多连续状态变化。"), "一次性流程在单次推进中出现过多连续状态变化，已保留恢复点等待检查。");
  }

  /** 被转换为可恢复暂停态的失败也必须进入统一异常中心，不能因 catch 而丢失。 */
  #blockOneShotFailure(kind: "technical" | "business", operation: string, error: unknown, reason: string, details: Record<string, unknown> = {}): EvolutionState {
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
      details: { runId: run?.runId || null, topicId: topicId || null, proposalId: run?.proposalId || null, phase: run?.phase || null, recoveryPoint: run?.action || null, ...details },
    });
    return this.#store.blockOneShotRun(reason);
  }

  /** 一次性流程只向韩立端口请求正式方向判断。 */
  async #reviewOneShotProposal(proposal: EvolutionProposal) { return this.#hanliDecisions.reviewOneShotProposal(proposal); }

  async #tick(): Promise<void> {
    if (this.#running) return;
    this.#running = true;
    try {
      let state = this.state();
      if (state.automaticEvolutionEnabled) {
        for (const proposal of state.proposals.filter((item) => ["supplement-required", "rejected"].includes(item.status))) {
          if (state.proposals.some((item) => item.supersedesProposalId === proposal.proposalId)) continue;
          if (!proposal.approvals.at(-1)?.advice.trim()) continue;
          state = await this.investigateAndReviseReturnedProposal(proposal.proposalId);
        }
      }
      for (const proposal of state.proposals.filter((item) => item.distributedTaskIds.length && ["executing", "verifying", "blocked"].includes(item.status))) {
        let tasks = this.#collaboration.state().tasks.filter((task) => proposal.distributedTaskIds.includes(task.taskId));
        if (tasks.length !== proposal.distributedTaskIds.length) continue;
        const blocked = tasks.some((task) => ["blocked", "cancelled", "test-failed"].includes(task.state));
        const allReturned = tasks.every((task) => task.state === "returned-to-nangong");
        if (!blocked && allReturned) {
          this.#collaboration.sealEvolutionRound(proposal.proposalId, proposal.distributedTaskIds);
          tasks = this.#collaboration.state().tasks.filter((task) => proposal.distributedTaskIds.includes(task.taskId));
        }
        const completed = tasks.every((task) => task.state === "integrated");
        const verifying = tasks.some((task) => ["returned-to-nangong", "ready-for-integration", "queued-integration", "integrating", "unified-testing", "awaiting-restart"].includes(task.state));
        const status = blocked ? "blocked" : completed ? "pending-acceptance" : verifying ? "verifying" : "executing";
        if (proposal.status !== status) state = this.#store.markProgress(proposal.proposalId, status, completed ? "全部关联任务已经完成，等待韩立按真实用户路径验收结果。" : blocked ? "至少一个关联任务阻塞，等待恢复条件。" : "关联任务正在执行或验证。" );
      }
      if (state.oneShotRun?.status === "running") {
        await this.#advanceOneShot();
        return;
      }
      // 一个专题完成后重新进入韩立读库与发问流程；禁止复制旧专题标题伪造下一专题。
      for (const proposal of this.#flow.automaticApprovalQueue(state)) state = this.autoApprove(proposal.proposalId);
      for (const proposal of this.#flow.automaticDistributionQueue(state)) state = await this.dispatch(proposal.proposalId);
      if (!state.automaticEvolutionEnabled) return;
      const hasOpenTopicFlow = state.topics.some((item) => !["completed", "rejected"].includes(item.status));
      if (!hasOpenTopicFlow) state = await this.advanceHanLiDeliberation();
      const topic = state.topics.find((item) => ["registered", "investigating"].includes(item.status));
      if (!topic || state.proposals.some((item) => item.topicId === topic.topicId && item.status === "pending-approval")) return;
      const content = `课题：${topic.title}\n\n目标：${topic.goal}\n\n调查事实：\n${topic.evidence.map((item) => `- ${item}`).join("\n")}\n\n推荐方向：在已登记范围内实施，并保持排除项不变。`;
      let next = this.createProposal(topic.topicId, { type: "代码修正", content, risks: ["实施结果可能与既有调用方产生兼容影响"], rollbackPlan: "保留提案版本和关联任务，失败时撤销任务分支且不覆盖历史提案。" });
      const proposal = next.proposals.at(-1)!;
      if (next.automaticNangongApprovalEnabled) next = this.autoApprove(proposal.proposalId);
      const decided = requireProposal(next, proposal.proposalId);
      if (next.automaticExecutionEnabled && decided.status === "approved") await this.dispatch(proposal.proposalId);
    } catch (error) {
      const state = this.state();
      if (state.oneShotRun?.status === "running") this.#blockOneShotFailure("technical", "nangong_evolution_tick", error, `南宫婉自动推进失败：${error instanceof Error ? error.message : String(error)}`);
      else this.#recordFailure({ kind: "technical", sourceType: "system", sourceId: "nangong-evolution", operation: "nangong_evolution_tick", error, correlationId: state.activeTopicId, fingerprint: `nangong-evolution-tick:${state.activeTopicId || "no-topic"}` });
    } finally { this.#running = false; }
  }
}

function requireProposal(state: EvolutionState, proposalId: string): EvolutionProposal { const proposal = state.proposals.find((item) => item.proposalId === proposalId); if (!proposal) throw new Error("演化提案不存在。"); return proposal; }

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

function distributionPlanningPrompt(proposal: EvolutionProposal, topic: EvolutionState["topics"][number], feedback: string): string {
  return [
    "你是南宫婉，负责在真实工程中调查后形成最小、可独立合并的执行任务。现在只读调查，不修改源码。",
    "影响范围只是调查边界，不等于任务数量。单个按钮、单个页面、同一组件、预计修改文件重叠或必须一起验收的内容必须合并为一个任务。约束、风险、保持功能不变和测试要求不能单独成为任务。只有可以独立修改、独立回退、独立验收且预计文件不重叠时才允许并行。",
    "请读取工作区相关实现，列出预计修改文件。返回 JSON：{\"summary\":\"为什么采用这个任务数量\",\"units\":[{\"title\":\"任务标题\",\"scope\":\"完整职责边界\",\"acceptanceCriteria\":[\"独立验收条件\"],\"expectedFiles\":[\"工程相对路径\"],\"independentReason\":\"为什么能独立执行；只有一个任务时说明为什么不拆分\"}]}。不要返回 Markdown。",
    `课题：${topic.title}\n目标：${topic.goal}`,
    `提案：${proposal.content}`,
    `影响范围：${proposal.impactScope.join("；")}`,
    `验收条件：${proposal.acceptanceCriteria.join("；")}`,
    `排除范围：${proposal.exclusions.join("；") || "无"}`,
    feedback ? `程序上一轮核对到的确定性冲突：${feedback}` : "这是首次拆分。",
  ].join("\n\n");
}


interface RevisionInvestigation {
  content: string;
  evidence: string[];
  impactScope: string[];
  exclusions: string[];
  risks: string[];
  rollbackPlan: string;
  acceptanceCriteria: string[];
}

function revisionInvestigationPrompt(topic: EvolutionState["topics"][number], proposal: EvolutionProposal, advice: string, feedbackTarget: string, capabilityScope: string | null): string {
  return [
    "你是南宫婉。韩立已经退回当前提案；先只读检查实际工作区，再决定是否存在足以重新提交的新事实。不得修改文件、启动构建或把审批意见改写成事实。",
    "重点核对韩立指出的实际组件、选择器或文件位置，当前可用、悬停、忙碌或禁用状态，明确影响范围与排除项，具体风险与回退边界，以及能在真实应用中观察的验收条件。",
    "只写亲自从源码、配置或可重复读取结果中核实的内容；每条 evidence 必须带可定位对象和观察结果。若没有新事实，evidence 返回空数组，程序不会创建新版本。",
    `反馈目标：${feedbackTarget}${capabilityScope ? `；能力范围：${capabilityScope}` : ""}`,
    `韩立退回意见：${advice}`,
    `课题：${JSON.stringify({ title: topic.title, goal: topic.goal, scope: topic.scope, exclusions: topic.exclusions, evidence: topic.evidence, acceptanceCriteria: topic.acceptanceCriteria })}`,
    `当前提案：${JSON.stringify({ version: proposal.version, content: proposal.content, evidence: proposal.evidence, impactScope: proposal.impactScope, exclusions: proposal.exclusions, risks: proposal.risks, rollbackPlan: proposal.rollbackPlan, acceptanceCriteria: proposal.acceptanceCriteria })}`,
    "仅返回 JSON：{\"content\":\"基于本次实查形成的完整修订方案\",\"evidence\":[\"文件/组件/状态 + 实际观察\"],\"impactScope\":[\"明确影响范围\"],\"exclusions\":[\"明确不改内容\"],\"risks\":[\"具体风险和缓解方式\"],\"rollbackPlan\":\"限定到本次改动的回退方案\",\"acceptanceCriteria\":[\"可在真实应用观察的结果\"]}。不要返回 Markdown。",
  ].join("\n\n");
}

function parseRevisionInvestigation(text: string): RevisionInvestigation {
  const value = parseJsonObject(text);
  const content = typeof value.content === "string" ? value.content.trim().slice(0, 30_000) : "";
  const evidence = normalizeDraftList(value.evidence);
  const impactScope = normalizeDraftList(value.impactScope);
  const exclusions = normalizeDraftList(value.exclusions);
  const risks = normalizeDraftList(value.risks);
  const rollbackPlan = typeof value.rollbackPlan === "string" ? value.rollbackPlan.trim().slice(0, 8_000) : "";
  const acceptanceCriteria = normalizeDraftList(value.acceptanceCriteria);
  if (!content || !impactScope.length || !risks.length || !rollbackPlan || !acceptanceCriteria.length) throw new Error("南宫婉返修调查没有形成完整的范围、风险、回退和验收结构。");
  return { content, evidence, impactScope, exclusions, risks, rollbackPlan, acceptanceCriteria };
}

function hasMaterialRevisionEvidence(proposal: EvolutionProposal, investigation: RevisionInvestigation, advice: string): boolean {
  const oldEvidence = new Set(proposal.evidence.map(normalizedComparisonText));
  const approvalText = normalizedComparisonText(advice);
  const hasNewEvidence = investigation.evidence.some((item) => {
    const normalized = normalizedComparisonText(item);
    return normalized.length >= 12 && !oldEvidence.has(normalized) && normalized !== approvalText && !normalized.startsWith("人工审批事实");
  });
  if (!hasNewEvidence) return false;
  const nextStructure = normalizedComparisonText(JSON.stringify({ content: investigation.content, impactScope: investigation.impactScope, exclusions: investigation.exclusions, risks: investigation.risks, rollbackPlan: investigation.rollbackPlan, acceptanceCriteria: investigation.acceptanceCriteria }));
  const previousStructure = normalizedComparisonText(JSON.stringify({ content: proposal.content, impactScope: proposal.impactScope, exclusions: proposal.exclusions, risks: proposal.risks, rollbackPlan: proposal.rollbackPlan, acceptanceCriteria: proposal.acceptanceCriteria }));
  return nextStructure !== previousStructure;
}

function normalizedComparisonText(value: string): string { return value.normalize("NFKC").replaceAll(/\s+/gu, "").toLowerCase(); }

function parseDistributionPlan(text: string): Pick<EvolutionDistributionPlan, "summary" | "units"> {
  const value = parseJsonObject(text);
  const summary = typeof value.summary === "string" ? value.summary.trim().slice(0, 4_000) : "";
  const rawUnits = Array.isArray(value.units) ? value.units : [];
  const units = rawUnits.flatMap((raw): EvolutionDistributionUnit[] => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const title = typeof item.title === "string" ? item.title.trim().slice(0, 200) : "";
    const scope = typeof item.scope === "string" ? item.scope.trim().slice(0, 8_000) : "";
    const acceptanceCriteria = normalizeDraftList(item.acceptanceCriteria);
    const expectedFiles = normalizeDraftList(item.expectedFiles).map((file) => file.replaceAll("\\", "/").replace(/^\.\//u, "")).filter((file) => !file.startsWith("/") && !file.split("/").includes(".."));
    const independentReason = typeof item.independentReason === "string" ? item.independentReason.trim().slice(0, 4_000) : "";
    return title && scope && acceptanceCriteria.length && expectedFiles.length && independentReason ? [{ title, scope, acceptanceCriteria, expectedFiles, independentReason }] : [];
  });
  if (!summary || !units.length) throw new Error("南宫婉没有形成包含文件边界和独立验收条件的有效任务拆分计划。");
  return { summary, units };
}

function parseTopicDraft(text: string): NangongTopicDraft {
  const candidate = text.match(/\{[\s\S]*\}/)?.[0];
  if (!candidate) throw new Error("南宫婉未返回可编辑的课题草稿，请重试。");
  try {
    const value = JSON.parse(candidate) as Partial<NangongTopicDraft>;
    const title = typeof value.title === "string" ? value.title.trim() : "";
    const goal = typeof value.goal === "string" ? value.goal.trim() : "";
    const scope = normalizeDraftList(value.scope);
    const evidence = normalizeDraftList(value.evidence);
    const acceptanceCriteria = normalizeDraftList(value.acceptanceCriteria);
    if (!title || !goal || !scope.length || !evidence.length || !acceptanceCriteria.length) throw new Error();
    return { title, goal, scope, evidence, acceptanceCriteria };
  } catch {
    throw new Error("南宫婉生成的课题草稿不完整，请重试。");
  }
}

const CONVERSATION_TOPIC_META_PREFIX = "NANGONG_TOPIC_META=";

/** 南宫婉正文保持自然语言；最后一行只提供机器可读主题坐标，解析失败也不丢失正文。 */
function parseConversationResponse(text: string): { reply: string; topic: ConversationRoundTopicDecision; invitesOneShot: boolean } {
  const lines = text.trim().split(/\r?\n/);
  let markerIndex = -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].trim().startsWith(CONVERSATION_TOPIC_META_PREFIX)) { markerIndex = index; break; }
  }
  if (markerIndex < 0) {
    const corpus = parseCorpusMetadata(text);
    const reply = text.trim();
    return { reply, topic: corpus || { title: "待 AI 归类", type: "待归类", switchTopic: false, userIntent: "", tags: [], summary: "" }, invitesOneShot: reply.includes(NANGONG_ONE_SHOT_INVITATION) };
  }
  const marker = lines[markerIndex].trim().slice(CONVERSATION_TOPIC_META_PREFIX.length);
  try {
    const value = JSON.parse(marker) as Partial<ConversationRoundTopicDecision>;
    const title = typeof value.title === "string" ? value.title.trim().slice(0, 120) : "";
    const type = typeof value.type === "string" ? value.type.trim().slice(0, 120) : "";
    const userIntent = typeof value.userIntent === "string" ? value.userIntent.trim().slice(0, 2_000) : "";
    const tags = Array.isArray(value.tags) ? [...new Set(value.tags.filter((item): item is string => typeof item === "string").map((item) => item.replaceAll(/\s+/g, " ").trim()).filter(Boolean))].slice(0, 12) : [];
    const summary = typeof value.summary === "string" && Array.from(value.summary.trim()).length <= 300 ? value.summary.trim() : "";
    const reply = lines.filter((_line, index) => index !== markerIndex).join("\n").trim();
    if (!reply || !title || !type || !userIntent || !tags.length || !summary) throw new Error("incomplete conversation topic metadata");
    return { reply, topic: { title, type, switchTopic: value.switchTopic === true, userIntent, tags, summary }, invitesOneShot: reply.includes(NANGONG_ONE_SHOT_INVITATION) };
  } catch {
    const reply = lines.filter((_line, index) => index !== markerIndex).join("\n").trim() || text.trim();
    return { reply, topic: { title: "待 AI 归类", type: "待归类", switchTopic: false, userIntent: "", tags: [], summary: "" }, invitesOneShot: reply.includes(NANGONG_ONE_SHOT_INVITATION) };
  }
}

/** Codex 最终回答可能只带工程语料元数据；该元数据同样来自 AI 语义判断，可用于避免保存后误报整轮失败。 */
function parseCorpusMetadata(text: string): ConversationRoundTopicDecision | null {
  const match = text.match(/<!--\s*SELPLAT_CORPUS_META\s+(\{[\s\S]*?\})\s*-->/);
  if (!match) return null;
  try {
    const value = JSON.parse(match[1]) as Record<string, unknown>;
    const title = typeof value.title === "string" ? value.title.trim().slice(0, 120) : "";
    const type = typeof value.type === "string" ? value.type.trim().slice(0, 120) : "";
    const userIntent = typeof value.intent === "string" ? value.intent.trim().slice(0, 2_000) : "";
    const tags = normalizeDraftList(value.tags).slice(0, 12);
    const summary = typeof value.summary === "string" && Array.from(value.summary.trim()).length <= 300 ? value.summary.trim() : "";
    return title && type && userIntent && tags.length && summary ? { title, type, switchTopic: false, userIntent, tags, summary } : null;
  } catch { return null; }
}

function normalizeDraftList(value: unknown): string[] { return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 100) : []; }

function parseJsonObject(text: string): Record<string, unknown> {
  const candidate = text.match(/\{[\s\S]*\}/)?.[0];
  if (!candidate) throw new Error("AI 没有返回可解析的结构化判断。 ");
  try { return JSON.parse(candidate) as Record<string, unknown>; } catch { throw new Error("AI 返回的结构化判断不是有效 JSON。 "); }
}

function itemFailureReason(task: ReturnType<CollaborationWorkflowFacade["state"]>["tasks"][number]): string {
  return task.blockingReason || task.repairFailureReason || task.unifiedTest?.failureReason || `任务 ${task.snapshot.title} 未能继续，交给令狐按原恢复线路处理。`;
}
