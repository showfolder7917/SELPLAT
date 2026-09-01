import { randomUUID } from "node:crypto";

import type { ConversationRoundTopicDecision } from "../../../../../contracts/capabilities/event-center/index.js";
import type { EvolutionStateOutDto } from "../../../../../contracts/collaboration/evolution/index.js";
import type { GenerateNangongTopicDraftInDto, NangongTopicDraftOutDto, SendNangongConversationMessageInDto } from "../../../../../contracts/collaboration/nangong/index.js";
import type { NangongApplicationServiceOptions } from "./nangong-application.ports.js";
import { parseNangongConversationResponse, parseNangongTopicDraft } from "./nangong-conversation.parser.js";

type NangongConversationServiceOptions = Pick<NangongApplicationServiceOptions,
  "store" | "conversation" | "memory" | "recordEvent" | "recordFailure" | "oneShotWorkflow" | "newConversationRetryDelaysMs">;

/** 处理南宫人物会话、草稿判断和用户一次性确认，不实现后续跨人物状态机。 */
export class NangongConversationService {
  readonly #store: NangongConversationServiceOptions["store"];
  readonly #conversation: NangongConversationServiceOptions["conversation"];
  readonly #memory: NonNullable<NangongConversationServiceOptions["memory"]> | null;
  readonly #recordEvent: NangongConversationServiceOptions["recordEvent"];
  readonly #recordFailure: NonNullable<NangongConversationServiceOptions["recordFailure"]>;
  readonly #oneShotWorkflow: NangongConversationServiceOptions["oneShotWorkflow"];
  readonly #newConversationRetryDelaysMs: number[];

  /** 装配人物会话所需端口；构造时不发送消息或启动流程。 */
  constructor(options: NangongConversationServiceOptions) {
    this.#store = options.store;
    this.#conversation = options.conversation;
    this.#memory = options.memory || null;
    this.#recordEvent = options.recordEvent;
    this.#recordFailure = options.recordFailure || (() => undefined);
    this.#oneShotWorkflow = options.oneShotWorkflow;
    this.#newConversationRetryDelaysMs = options.newConversationRetryDelaysMs || [0, 500, 1_500, 3_000];
  }

  /** 保存用户消息并生成南宫回复；独立“1”只在存在可恢复邀请时启动一次性演化。 */
  async sendConversationMessage(request: SendNangongConversationMessageInDto): Promise<EvolutionStateOutDto> {
    const current = this.#store.state();
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
      const parsed = parseNangongConversationResponse(response.text);
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

  /** 删除官方人物线程成功后建立新对话；活动写入竞争只进行有限重试。 */
  async newConversation(): Promise<EvolutionStateOutDto> {
    for (const [index, retryDelay] of this.#newConversationRetryDelaysMs.entries()) {
      if (retryDelay) await new Promise((resolve) => setTimeout(resolve, retryDelay));
      try {
        await this.#conversation.newChat();
        return this.#store.newConversation();
      } catch (error) {
        if (!String(error).toLowerCase().includes("active writer") || index === this.#newConversationRetryDelaysMs.length - 1) throw error;
      }
    }
    throw new Error("无法重新建立南宫婉对话。");
  }

  /** 根据当前南宫对话生成可编辑草稿；生成动作不会直接保存专题。 */
  async generateTopicDraft(request: GenerateNangongTopicDraftInDto): Promise<NangongTopicDraftOutDto> {
    const messages = this.#store.state().conversation.messages.slice(-20);
    if (!messages.length) throw new Error("当前没有可整理为课题的南宫婉对话。");
    const context = this.#memory?.buildNangongContext(this.#store.state().conversation)
      || messages.map((item) => `${item.role === "user" ? "用户" : "南宫婉"}：${item.content}`).join("\n\n");
    const response = await this.#conversation.send({
      message: "请根据上述对话生成课题草稿。仅返回 JSON：{\"title\":\"\",\"goal\":\"\",\"scope\":[\"\"],\"evidence\":[\"\"],\"acceptanceCriteria\":[\"\"]}。事实证据必须说明来自用户陈述或南宫婉调查，不要把推断写成已证实事实；每个数组至少一项。",
      workspaceState: request.workspaceState,
      locale: request.locale,
    }, context);
    return parseNangongTopicDraft(response.text);
  }

  /** 把一次性确认转换为人物课题事实，再请求 Workflow 从已保存卡点继续。 */
  async #startOneShotFromConversation(request: SendNangongConversationMessageInDto, ready: boolean): Promise<EvolutionStateOutDto> {
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
      if (this.#oneShotWorkflow.hasLiveOwner(state)) {
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
      await this.#oneShotWorkflow.advance();
      return this.#store.state();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.#oneShotWorkflow.blockFailure("technical", "form_topic_from_conversation", error, reason);
      return this.#store.appendConversation("nangong", `本轮一次性演化已保留当前进度，但遇到无法自动继续的阻塞：${reason}`, []);
    }
  }

  /** 完整人物回合异步进入训练归档；归档失败不改写已经成功的对话。 */
  #archiveConversationRound(state: EvolutionStateOutDto, userMessageId: string, nangongMessageId: string, decision: ConversationRoundTopicDecision | null): void {
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
}
