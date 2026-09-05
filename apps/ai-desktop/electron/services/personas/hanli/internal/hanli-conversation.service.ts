import { randomUUID } from "node:crypto";

import type { PersonaConversationOutDto, SendPersonaConversationMessageInDto } from "../../../../../contracts/services/personas/conversation/index.js";
import type { HanliApplicationServiceOptions } from "./hanli-application.ports.js";
import { parseHanliConversationResponse } from "./hanli-conversation.parser.js";
import { buildHanliMethodContext, buildHanliRecentConversation } from "./hanli-method-context.js";
import { HanliInquiryService } from "./hanli-inquiry.service.js";

const HANLI_INTERNAL_DELIBERATION_INVITATION = "若确认由韩立与南宫婉开始内部研讨并持续自动演化，请回复 1。";

/** 韩立自由对话只做用户代理分析；完整对话持久化后再异步刷新派生语义。 */
export class HanliConversationService {
  readonly #inquiry: HanliInquiryService;
  constructor(private readonly options: HanliApplicationServiceOptions) { this.#inquiry = new HanliInquiryService(options); }

  conversation(): PersonaConversationOutDto {
    return this.options.memory?.readPersonaConversation("han-li")
      || { ownerPersonaId: "han-li", conversationId: null, messages: [], updatedAt: new Date(0).toISOString() };
  }

  async send(request: SendPersonaConversationMessageInDto): Promise<PersonaConversationOutDto> {
    const chat = this.options.conversation;
    const memory = this.options.memory;
    if (!chat || !memory) throw new Error("韩立自由对话或 AI Memory 尚未就绪。");
    const userContent = request.message.trim();
    if (!userContent) throw new Error("发送给韩立的消息不能为空。");
    if (userContent.length > 20_000) throw new Error("发送给韩立的消息不能超过 20000 个字符。");
    if (!request.workspaceState?.roots?.length) throw new Error("韩立自由对话必须使用已登记工作区。");
    // 业务会话 ID 与 Codex threadId 分离；第一次发送时先建立统一人物会话头。
    const current = this.conversation();
    const existing = current.conversationId ? current : memory.newPersonaConversation("han-li");
    const waiting = [...this.options.store.state().deliberations].reverse().find((item) => item.status === "ready-to-establish" && item.rounds.at(-1)?.confirmation && !item.rounds.at(-1)?.confirmation?.reply);
    const waitingRound = waiting?.rounds.at(-1);
    // 只有当前会话已展示的那份调查说明可被确认，旧会话或后台草稿不能取得用户授权。
    if (waiting && waitingRound && existing.messages.some((message) => message.messageId === `hanli-confirmation:${waitingRound.roundId}`)) {
      if (!this.options.replyInternalDeliberationConfirmation) throw new Error("韩立与南宫婉的确认研讨入口尚未接入。");
      // 用户纠正必须先经过韩立的需求理解，再由 Workflow 保存为新的研讨问题；人物会话不再直接改写共享演化状态。
      const confirmation = await this.options.replyInternalDeliberationConfirmation(userContent);
      const createdAt = new Date().toISOString();
      return memory.registerPersonaRound({ ownerPersonaId: "han-li", responderPersonaId: "han-li", corpusSource: "hanli", conversationId: existing.conversationId!, userMessageId: request.clientMessageId || `hanli-user-${randomUUID()}`, userContent, attachmentIds: request.attachmentIds || [], personaMessageId: `hanli-message-${randomUUID()}`, personaContent: confirmation.customerReply, createdAt, completedAt: createdAt, decision: { title: "调查范围确认", type: "用户确认", switchTopic: false, userIntent: userContent, tags: ["调查确认"], summary: "用户对本轮调查范围作出确认或纠正。" } });
    }
    const latestHanli = [...existing.messages].reverse().find((message) => !message.messageId.startsWith("internal:") && message.speakerType === "persona" && message.speakerPersonaId === "han-li");
    if (userContent === "1" && latestHanli?.content.includes(HANLI_INTERNAL_DELIBERATION_INVITATION)) {
      if (!existing.conversationId || !this.options.startInternalDeliberation) throw new Error("韩立与南宫婉内部研讨能力尚未就绪。");
      const started = await this.options.startInternalDeliberation(request);
      const createdAt = new Date().toISOString();
      const reply = this.options.store.state().automationSettings.automaticCustodyEnabled === true ? "已启动韩立与南宫婉的内部研讨。自动托管已开启，我会代表你判断新发现应并入当前专题还是留到后续专题，并持续推进。" : "已启动韩立与南宫婉的内部研讨。南宫婉查清事实后，我会把修复范围和影响带回来请你确认，再进入实施。";
      const next = memory.registerPersonaRound({
        ownerPersonaId: "han-li",
        responderPersonaId: "han-li",
        corpusSource: "hanli",
        conversationId: existing.conversationId,
        userMessageId: request.clientMessageId || `hanli-user-${randomUUID()}`,
        userContent,
        attachmentIds: request.attachmentIds || [],
        personaMessageId: `hanli-message-${randomUUID()}`,
        personaContent: reply,
        createdAt,
        completedAt: new Date().toISOString(),
        decision: { title: "启动人物内部研讨", type: "用户确认", switchTopic: false, userIntent: "确认韩立与南宫婉围绕当前需求开始内部研讨", tags: ["韩立", "南宫婉", "内部研讨"], summary: "用户确认启动韩立与南宫婉的内部研讨。" },
      });
      this.options.recordEvent("hanli.conversation.internal_deliberation_started", { conversationId: existing.conversationId, continuous: started.continuous });
      this.options.refreshSemanticMemory?.();
      return next;
    }
    const semanticContext = memory.readHanliSemanticContext(
      this.options.readStableUserId?.() || "",
      this.options.readProjectScope?.() || "global",
      "",
      20,
    );
    // 历史资料只转换成提问、调查和扩展的方法样本，不把客户目标、旧答案或证据原文交给韩立模仿。
    const methodContext = buildHanliMethodContext(semanticContext);
    const recentConversation = buildHanliRecentConversation(existing.messages);
    const pendingCustomerQuestion = clarificationCustomerQuestion(existing.messages);
    const prompt = this.options.prompts.render("hanli.conversation", {
      methodContextJson: methodContext,
      recentConversation,
      customerQuestionAnchor: pendingCustomerQuestion || userContent,
      userMessage: userContent,
    });
    const createdAt = new Date().toISOString();
    const response = await chat.send(request, prompt);
    if (!(response.threadId || chat.activeConversationId())) throw new Error("韩立会话没有返回稳定 Codex 线程标识。");
    const conversationId = existing.conversationId!;
    const parsed = parseHanliConversationResponse(response.text);
    const customerQuestion = parsed.topic.switchTopic ? userContent : pendingCustomerQuestion || userContent;
    if (parsed.inquiry?.status === "ready") {
      const next = await this.#inquiry.run(request, conversationId, customerQuestion, parsed.inquiry, parsed.topic);
      const contextReadStats = { methodCharacters: methodContext.length, recentConversationCharacters: recentConversation.length, latestUserMessageCharacters: userContent.length, promptCharacters: prompt.length };
      this.options.recordEvent("hanli.conversation.round_archived", { conversationId, messageCount: next.messages.length, topicTitle: parsed.topic.title, contextReadStats });
      this.options.refreshSemanticMemory?.();
      return { ...next, contextReadStats };
    }
    if (parsed.inquiry?.status === "clarification-required") {
      this.options.recordEvent("hanli.inquiry.clarification_requested", {
        conversationId, requestId: request.clientMessageId || null, ambiguities: parsed.inquiry.ambiguities,
      });
    }
    const completedAt = new Date().toISOString();
    const personaMessageId = parsed.inquiry?.status === "clarification-required" ? `hanli-clarification:${randomUUID()}` : `hanli-message-${randomUUID()}`;
    let next = memory.registerPersonaRound({
      ownerPersonaId: "han-li",
      responderPersonaId: "han-li",
      corpusSource: "hanli",
      conversationId,
      userMessageId: request.clientMessageId || `hanli-user-${randomUUID()}`,
      userContent,
      attachmentIds: request.attachmentIds || [],
      personaMessageId,
      personaContent: parsed.reply,
      createdAt,
      completedAt,
      decision: parsed.topic,
    });
    if (parsed.reply.includes(HANLI_INTERNAL_DELIBERATION_INVITATION)) {
      try {
        const investigated = parsed.topic.switchTopic ? null : memory.readLatestRequirementDiscussionContext?.("han-li", conversationId) || null;
        // 邀请只发布本次研讨事实入口；它不调用 Workflow，也不因缺少既往调查而阻止自由讨论。
        memory.recordRequirementDiscussionContext?.({
          contextId: `activation-${personaMessageId}`, ownerPersonaId: "han-li", conversationId,
          sourceRequestId: request.clientMessageId || personaMessageId,
          customerQuestion: investigated?.customerQuestion || userContent,
          understoodGoal: parsed.topic.userIntent || investigated?.understoodGoal || userContent,
          verificationTarget: investigated?.verificationTarget || userContent,
          expectedAnswer: investigated?.expectedAnswer || "形成解决真实需求且可验证的修正方案",
          investigationQuestion: investigated?.investigationQuestion || "围绕本次客户需求调查事实、影响和可行修正",
          findingStatus: investigated?.findingStatus || "unknown", findingSummary: investigated?.findingSummary || "尚未形成独立只读调查结论",
          evidence: investigated?.evidence || [], unknowns: investigated?.unknowns || ["需要在内部研讨中继续核实事实"],
          customerConclusion: parsed.reply, createdAt: completedAt,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "需求研讨入口保存失败";
        this.options.recordEvent("hanli.conversation.discussion_context_failed", { conversationId, requestId: request.clientMessageId || null, reason });
      }
    }
    if (parsed.inquiry?.status === "clarification-required") {
      next = memory.appendPersonaInternalMessage({
        ownerPersonaId: "han-li", conversationId,
        messageId: `internal:hanli-inquiry-anchor:${request.clientMessageId || randomUUID()}`,
        speakerPersonaId: "han-li", replyToMessageId: personaMessageId,
        content: JSON.stringify({ version: 1, customerQuestion, clarificationMessageId: personaMessageId }),
        createdAt: completedAt,
      });
    }
    const contextReadStats = {
      methodCharacters: methodContext.length,
      recentConversationCharacters: recentConversation.length,
      latestUserMessageCharacters: userContent.length,
      promptCharacters: prompt.length,
    };
    // 统计既随本轮会话返回给用户，也进入统一事件，后续可以按真实读入规模调优预算。
    this.options.recordEvent("hanli.conversation.round_archived", {
      conversationId, messageCount: next.messages.length, topicTitle: parsed.topic.title, contextReadStats,
    });
    this.options.refreshSemanticMemory?.();
    return { ...next, contextReadStats };
  }

  async newConversation(): Promise<PersonaConversationOutDto> {
    const chat = this.options.conversation;
    const memory = this.options.memory;
    if (!chat || !memory) throw new Error("韩立自由对话或 AI Memory 尚未接入。");
    await chat.newChat();
    return memory.newPersonaConversation("han-li");
  }
}

/** 只有最新可见回复仍是韩立的澄清问题时才延续原问题；调查完成或后续新话题不会误复用旧锚点。 */
function clarificationCustomerQuestion(messages: PersonaConversationOutDto["messages"]): string | null {
  const latestDirect = [...messages].reverse().find((message) => !message.messageId.startsWith("internal:"));
  const marker = [...messages].reverse().find((message) => message.messageId.startsWith("internal:hanli-inquiry-anchor:"));
  if (!latestDirect || !marker) return null;
  try {
    const value = JSON.parse(marker.content) as { customerQuestion?: unknown; clarificationMessageId?: unknown };
    return value.clarificationMessageId === latestDirect.messageId && typeof value.customerQuestion === "string" && value.customerQuestion.trim()
      ? value.customerQuestion.trim() : null;
  } catch { return null; }
}
