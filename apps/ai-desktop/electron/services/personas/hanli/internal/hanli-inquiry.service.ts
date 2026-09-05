import { randomUUID } from "node:crypto";
import type { PersonaConversationOutDto, SendPersonaConversationMessageInDto } from "../../../../../contracts/services/personas/conversation/index.js";
import type { ConversationRoundTopicDecisionInDto } from "../../../../../contracts/services/support/capabilities/event-center/index.js";
import type { HanliApplicationServiceOptions } from "./hanli-application.ports.js";

/** 真实只读核实：消息展示是交接事实的投影，不用于模拟调查或授权。 */
export class HanliInquiryService {
  readonly #pending = new Map<string, Promise<PersonaConversationOutDto>>();
  constructor(private readonly options: HanliApplicationServiceOptions) {}

  /** 固定原会话和请求标识；同一已完成请求重试只读结果，不重复调查。 */
  run(request: SendPersonaConversationMessageInDto, conversationId: string, question: string, decision: ConversationRoundTopicDecisionInDto): Promise<PersonaConversationOutDto> {
    const stableRequest = { ...request, clientMessageId: request.clientMessageId || randomUUID() };
    const key = `${conversationId}:${stableRequest.clientMessageId}`;
    const pending = this.#pending.get(key);
    if (pending) return pending;
    const next = this.#run(stableRequest, conversationId, question, decision).finally(() => this.#pending.delete(key));
    this.#pending.set(key, next);
    return next;
  }

  async #run(request: SendPersonaConversationMessageInDto, conversationId: string, question: string, decision: ConversationRoundTopicDecisionInDto): Promise<PersonaConversationOutDto> {
    const memory = this.options.memory!;
    const id = request.clientMessageId || randomUUID();
    const resultId = `inquiry:${id}:result`;
    const prior = memory.readPersonaConversation("han-li", conversationId);
    if (prior.messages.some((message) => message.messageId === resultId)) return prior;
    const questionId = `internal:inquiry:${id}:question`;
    const publish = (messageId: string, speakerPersonaId: "han-li" | "nangong-wan", content: string, replyToMessageId?: string) => {
      const next = memory.appendPersonaInternalMessage({ ownerPersonaId: "han-li", conversationId, messageId, speakerPersonaId, content, replyToMessageId, createdAt: new Date().toISOString() });
      this.options.onPersonaConversationChanged?.(next);
      return next;
    };
    const createdAt = new Date().toISOString();
    const registered = memory.registerPersonaRound({ ownerPersonaId: "han-li", responderPersonaId: "han-li", corpusSource: "hanli", conversationId, userMessageId: id, userContent: request.message, attachmentIds: request.attachmentIds || [], personaMessageId: `inquiry:${id}:received`, personaContent: "收到，正在准备只读核实请求。", createdAt, completedAt: createdAt, decision });
    this.options.onPersonaConversationChanged?.(registered);
    publish(questionId, "han-li", question);
    try {
      if (!this.options.investigateWithNangong) throw new Error("南宫婉只读核实服务尚未接入");
      // 先真实调用端口，再发布等待提示；立即接住拒绝，避免未处理异步错误。
      const pending = this.options.investigateWithNangong(question, request).then((text) => ({ text }), (error: unknown) => ({ error }));
      publish(`inquiry:${id}:waiting`, "han-li", "正在请南宫婉核实，请稍等。");
      const response = await pending;
      if ("error" in response) throw response.error;
      const findings = parseInquiryFindings(response.text);
      const report = `${findings.status === "verified" ? "核实结果" : "尚未完全核实"}：${findings.summary}\n\n${findings.evidence.map((item) => `依据：${item.source}\n${item.detail}`).join("\n\n")}${findings.unknowns.length ? `\n\n尚未核实：${findings.unknowns.join("；")}` : ""}`;
      publish(`internal:inquiry:${id}:answer`, "nangong-wan", report, questionId);
      // 原始技术依据只作为内部交接保存；韩立必须基于同一份证据向客户解释影响并给出下一步方案。
      const customerReply = await this.#explainForCustomer(request, question, findings);
      this.options.recordEvent("hanli.inquiry.completed", { conversationId, requestId: id, status: findings.status });
      return publish(resultId, "han-li", customerReply, `inquiry:${id}:waiting`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "调查服务没有返回有效结果";
      this.options.recordEvent("hanli.inquiry.failed", { conversationId, requestId: id, reason });
      publish(`internal:inquiry:${id}:failure`, "han-li", `本次核实未完成：${reason}`, questionId);
      return publish(resultId, "han-li", `本次向南宫婉核实未完成：${reason}。目前没有足够事实判断进度，不能据此认定已完成。`);
    }
  }

  async #explainForCustomer(request: SendPersonaConversationMessageInDto, question: string, findings: ReturnType<typeof parseInquiryFindings>): Promise<string> {
    try {
      const conversation = this.options.conversation;
      if (!conversation) throw new Error("韩立客户解释能力尚未接入");
      const prompt = this.options.prompts.render("hanli.inquiry-response", {
        userMessage: request.message,
        question,
        findingsJson: JSON.stringify(findings),
      });
      // 调查截图已经由南宫婉核实；二次解释只消费结构化事实，避免韩立绕过调查自行猜测。
      const response = await conversation.send({ ...request, attachmentIds: [] }, prompt);
      const reply = response.text.trim();
      if (!reply) throw new Error("韩立没有返回客户解释");
      return reply;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "韩立没有返回客户解释";
      this.options.recordEvent("hanli.inquiry.explanation_failed", { requestId: request.clientMessageId || null, reason });
      return "南宫婉已经完成调查，原始依据也已保存，但我这次没有成功把技术结果整理成清楚的解决方案。请稍后重试；我不会把难懂的技术报告直接丢给你，也不会在解释完成前擅自开始修改。";
    }
  }
}

/** 调查回包必须结构完整且带依据；格式错误不得降级成成功正文。 */
export function parseInquiryFindings(text: string): { status: "verified" | "unknown"; summary: string; evidence: { source: string; detail: string }[]; unknowns: string[] } {
  const value = JSON.parse(text.trim().replace(/^```(?:json)?\s*/u, "").replace(/\s*```$/u, ""));
  if (!value || !["verified", "unknown"].includes(value.status) || typeof value.summary !== "string" || !value.summary.trim() || !Array.isArray(value.evidence) || !Array.isArray(value.unknowns)) throw new Error("南宫婉调查结果格式不完整");
  if (value.evidence.some((item: { source?: unknown; detail?: unknown }) => !item || typeof item.source !== "string" || !item.source.trim() || typeof item.detail !== "string" || !item.detail.trim()) || value.unknowns.some((item: unknown) => typeof item !== "string")) throw new Error("南宫婉调查依据格式不完整");
  if (value.status === "verified" && !value.evidence.length) throw new Error("南宫婉未提供可定位的核实依据");
  return value;
}
