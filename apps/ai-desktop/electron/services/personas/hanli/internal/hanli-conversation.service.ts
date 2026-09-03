import { randomUUID } from "node:crypto";

import type { PersonaConversationOutDto, SendPersonaConversationMessageInDto } from "../../../../../contracts/services/personas/conversation/index.js";
import type { HanliApplicationServiceOptions } from "./hanli-application.ports.js";
import { parseHanliConversationResponse } from "./hanli-conversation.parser.js";

const HANLI_INTERNAL_DELIBERATION_INVITATION = "若确认由韩立与南宫婉开始内部研讨，请回复 1。";

/** 韩立自由对话只做用户代理分析；完整对话持久化后再异步刷新派生语义。 */
export class HanliConversationService {
  constructor(private readonly options: HanliApplicationServiceOptions) {}

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
    if (!request.workspaceState?.roots?.length) throw new Error("韩立自由对话必须使用已登记工作区。");
    // 业务会话 ID 与 Codex threadId 分离；第一次发送时先建立统一人物会话头。
    const current = this.conversation();
    const existing = current.conversationId ? current : memory.newPersonaConversation("han-li");
    const latestHanli = [...existing.messages].reverse().find((message) => message.speakerType === "persona" && message.speakerPersonaId === "han-li");
    if (userContent === "1" && latestHanli?.content.includes(HANLI_INTERNAL_DELIBERATION_INVITATION)) {
      if (!existing.conversationId || !this.options.startInternalDeliberation) throw new Error("韩立与南宫婉内部研讨能力尚未就绪。");
      const started = await this.options.startInternalDeliberation(request);
      const createdAt = new Date().toISOString();
      const reply = started.continuous
        ? "已启动韩立与南宫婉的内部研讨。当前问题满足整理条件后会自动进入下一步；持续自动开关已开启，本轮完成后还会继续寻找新的、有用户证据的问题。"
        : "已启动韩立与南宫婉的内部研讨。韩立会逐项提问，南宫婉完成调查回答；满足整理条件后自动进入下一步。本轮结束后是否继续发现新问题由持续自动开关决定。";
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
      userContent,
      20,
    );
    const recentConversation = existing.messages.slice(-16)
      .map((message) => `${message.speakerType === "user" ? "用户" : message.speakerPersonaId === "nangong-wan" ? "南宫婉" : "韩立"}：${message.content}`)
      .join("\n\n");
    const prompt = this.options.prompts.render("hanli.conversation", {
      semanticContextJson: JSON.stringify(semanticContext),
      recentConversation,
      userMessage: userContent,
    });
    const createdAt = new Date().toISOString();
    const response = await chat.send(request, prompt);
    if (!(response.threadId || chat.activeConversationId())) throw new Error("韩立会话没有返回稳定 Codex 线程标识。");
    const conversationId = existing.conversationId!;
    const parsed = parseHanliConversationResponse(response.text);
    const completedAt = new Date().toISOString();
    const next = memory.registerPersonaRound({
      ownerPersonaId: "han-li",
      responderPersonaId: "han-li",
      corpusSource: "hanli",
      conversationId,
      userMessageId: request.clientMessageId || `hanli-user-${randomUUID()}`,
      userContent,
      attachmentIds: request.attachmentIds || [],
      personaMessageId: `hanli-message-${randomUUID()}`,
      personaContent: parsed.reply,
      createdAt,
      completedAt,
      decision: parsed.topic,
    });
    this.options.recordEvent("hanli.conversation.round_archived", {
      conversationId, messageCount: next.messages.length, topicTitle: parsed.topic.title,
    });
    this.options.refreshSemanticMemory?.();
    return next;
  }

  async newConversation(): Promise<PersonaConversationOutDto> {
    const chat = this.options.conversation;
    const memory = this.options.memory;
    if (!chat || !memory) throw new Error("韩立自由对话或 AI Memory 尚未接入。");
    await chat.newChat();
    return memory.newPersonaConversation("han-li");
  }
}
