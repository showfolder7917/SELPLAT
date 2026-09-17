import { randomUUID } from "node:crypto";
import type { PersonaConversationOutDto, SendPersonaConversationMessageInDto } from "../../../../../../contracts/services/personas/conversation/index.js";
import type { NangongInquiryResultOutDto } from "../../../../../../contracts/services/personas/nangong/index.js";
import type { ConversationRoundTopicDecisionInDto } from "../../../../../../contracts/services/support/capabilities/event-center/index.js";
import type { HanliApplicationServiceOptions, HanliInquiryUnderstanding, HanliInvestigationRequest } from "../application/hanli-application.ports.js";
import { HanliInquiryAggregate, type InquirySnapshot } from "../../domain/hanli-inquiry.aggregate.js";
import { INQUIRY_CHECKPOINT_PREFIX, parseInquiryAssessment, readInquiryCheckpoint } from "./hanli-inquiry-checkpoint.js";

/** 韩立负责调查、证据评估、补查和客户解释；每个外部步骤前后持久化恢复点。 */
export class HanliInquiryService {
  readonly #pending = new Map<string, Promise<PersonaConversationOutDto>>();
  readonly #options: HanliApplicationServiceOptions;

  constructor(options: HanliApplicationServiceOptions) {
    this.#options = options;
  }

  /** 返回真实活动；应用重启后没有执行者的 running 恢复点显示为 interrupted。 */
  project(conversation: PersonaConversationOutDto): PersonaConversationOutDto {
    const state = readInquiryCheckpoint(conversation);
    if (!state) return conversation;
    const latestUser = [...conversation.messages].reverse().find((message) => message.speakerType === "user");
    if (latestUser && latestUser.messageId !== state.requestId) return { ...conversation, activity: undefined };
    let status: NonNullable<PersonaConversationOutDto["activity"]>["status"] = state.status;
    let summary = state.summary;
    if (status === "running" && !this.#pending.has(this.#key(state))) {
      status = "interrupted";
      summary = "上次排查已中断，现有证据已保存，可以从原阶段继续。";
    }
    return {
      ...conversation,
      activity: { kind: "inquiry", requestId: state.requestId, phase: state.phase, status,
        round: state.rounds.length, summary, updatedAt: state.updatedAt },
    };
  }

  /** 同一用户请求优先恢复；不同请求不能并发占用韩立判断会话。 */
  resume(request: SendPersonaConversationMessageInDto, conversation: PersonaConversationOutDto): Promise<PersonaConversationOutDto> | null {
    const pendingKey = `${conversation.conversationId}:${request.clientMessageId}`;
    const active = this.#pending.get(pendingKey);
    if (active) return active;
    const state = request.clientMessageId ? readInquiryCheckpoint(conversation, request.clientMessageId) : null;
    if (!state) {
      if (this.#pending.size) throw new Error("韩立正在处理已有排查，请等待本轮结束。");
      return null;
    }
    // 重试不允许修改原问题或借当前工作区选择扩大已冻结的读取范围。
    if (request.message !== state.request.message
      || JSON.stringify(request.workspaceState) !== JSON.stringify(state.request.workspaceState)
      || JSON.stringify(request.attachmentIds || []) !== JSON.stringify(state.request.attachmentIds || [])) {
      throw new Error("重试必须使用原问题、原截图和原工作区；需要改变范围时请发送新问题。");
    }
    return this.#start(state);
  }

  run(request: SendPersonaConversationMessageInDto, conversationId: string, customerQuestion: string,
    understanding: HanliInquiryUnderstanding, decision: ConversationRoundTopicDecisionInDto): Promise<PersonaConversationOutDto> {
    const stableRequest = { ...request, clientMessageId: request.clientMessageId || randomUUID() };
    const key = `${conversationId}:${stableRequest.clientMessageId}`;
    const active = this.#pending.get(key);
    if (active) return active;
    if (this.#pending.size) throw new Error("韩立正在处理已有排查，请等待本轮结束。");
    // 读取会话现在也经过 Worker；必须在读取前登记 Promise，避免两个同时点击穿过异步读取形成重复调查。
    const next = this.#prepare(stableRequest, conversationId, customerQuestion, understanding, decision)
      .finally(() => this.#pending.delete(key));
    this.#pending.set(key, next);
    return next;
  }

  /** 在已登记运行身份后读取持久状态并开始调查，保证相同请求始终返回同一 Promise。 */
  async #prepare(request: SendPersonaConversationMessageInDto, conversationId: string, customerQuestion: string,
    understanding: HanliInquiryUnderstanding, decision: ConversationRoundTopicDecisionInDto): Promise<PersonaConversationOutDto> {
    const prior = await this.#options.memory!.readPersonaConversation("han-li", conversationId);
    const recovered = request.clientMessageId ? readInquiryCheckpoint(prior, request.clientMessageId) : null;
    if (recovered) {
      if (request.message !== recovered.request.message
        || JSON.stringify(request.workspaceState) !== JSON.stringify(recovered.request.workspaceState)
        || JSON.stringify(request.attachmentIds || []) !== JSON.stringify(recovered.request.attachmentIds || [])) {
        throw new Error("重试必须使用原问题、原截图和原工作区；需要改变范围时请发送新问题。");
      }
      return this.#execute(new HanliInquiryAggregate(recovered));
    }
    if (understanding.status !== "ready" || !understanding.investigationQuestion) {
      throw new Error("韩立尚未形成可派发的核实范围。");
    }
    const state: InquirySnapshot = {
      version: 1, conversationId, requestId: request.clientMessageId!,
      request: structuredClone(request), selectedModel: prior.selectedModel || null,
      goal: { customerQuestion: customerQuestion.trim(), understoodGoal: understanding.understoodGoal,
        verificationTarget: understanding.verificationTarget, expectedAnswer: understanding.expectedAnswer,
        investigationQuestion: understanding.investigationQuestion },
      decision, phase: "queued", status: "running",
      summary: "韩立已明确核实范围，等待南宫婉接收只读调查。",
      updatedAt: new Date().toISOString(), rounds: [{ question: understanding.investigationQuestion }],
    };
    return this.#execute(new HanliInquiryAggregate(state));
  }

  #key(state: InquirySnapshot): string {
    return `${state.conversationId}:${state.requestId}`;
  }

  #start(state: InquirySnapshot): Promise<PersonaConversationOutDto> {
    const key = this.#key(state);
    const pending = this.#pending.get(key);
    if (pending) return pending;
    if (this.#pending.size) throw new Error("韩立正在处理已有排查，请等待本轮结束。");
    // 先登记真实执行者，再开始发通知，避免初始阶段被投影成中断。
    const next = Promise.resolve().then(() => this.#execute(new HanliInquiryAggregate(state)))
      .finally(() => this.#pending.delete(key));
    this.#pending.set(key, next);
    return next;
  }

  async #publishInternalDeliberation(state: InquirySnapshot, messageId: string, speakerPersonaId: "han-li" | "nangong-wan",
    content: string, replyToMessageId?: string, attachmentIds: string[] = [], contentRole: "conversation" | "technical-evidence" = "conversation"): Promise<PersonaConversationOutDto> {
    const next = await this.#options.memory!.appendPersonaInternalMessage({
      ownerPersonaId: "han-li", conversationId: state.conversationId, messageId, speakerPersonaId,
      content, replyToMessageId, attachmentIds, contentRole, createdAt: new Date().toISOString(),
    });
    const projected = this.project(next);
    this.#options.onPersonaConversationChanged?.(projected);
    return projected;
  }

  async #save(state: InquirySnapshot): Promise<PersonaConversationOutDto> {
    const saved = await this.#options.memory!.appendPersonaRecoveryCheckpoint({
      ownerPersonaId: "han-li", conversationId: state.conversationId,
      messageId: `${INQUIRY_CHECKPOINT_PREFIX}${state.requestId}:${randomUUID()}`,
      requestId: state.requestId, content: JSON.stringify(state), createdAt: new Date().toISOString(),
    });
    const projected = this.project(saved);
    this.#options.onPersonaConversationChanged?.(projected);
    return projected;
  }

  async #execute(aggregate: HanliInquiryAggregate): Promise<PersonaConversationOutDto> {
    const state = aggregate.state;
    const memory = this.#options.memory!;
    const resultId = `inquiry:${state.requestId}:result`;
    const prior = await memory.readPersonaConversation("han-li", state.conversationId);
    // 最终消息已持久化而终态保存中断时，只补终态，不重复解释或调查。
    if (prior.messages.some((message) => message.messageId === resultId)) {
      if (state.status !== "completed" && state.status !== "blocked") {
        aggregate.finish();
        return this.#save(state);
      }
      return this.project(prior);
    }
    if (!prior.messages.some((message) => message.messageId === state.requestId)) {
      await memory.registerPersonaRound({
        ownerPersonaId: "han-li", responderPersonaId: "han-li", corpusSource: "hanli",
        conversationId: state.conversationId, userMessageId: state.requestId,
        userContent: state.request.message, attachmentIds: state.request.attachmentIds || [],
        personaMessageId: `inquiry:${state.requestId}:progress`,
        personaContent: "我会核对相关规则、截图和当前实现；调查返回后继续判断证据是否足够，再给你结论和建议。",
        createdAt: state.updatedAt, completedAt: state.updatedAt, decision: state.decision,
      });
    }
    // 技术失败保留 phase；恢复不重置已有 findings 或 assessment。
    state.status = "running";
    await this.#save(state);
    try {
      while (state.phase !== "completed" && state.phase !== "blocked") {
        if (state.phase === "queued" || state.phase === "investigating") {
          await this.#investigate(aggregate);
        } else if (state.phase === "assessing") {
          await this.#assess(aggregate);
        } else if (state.phase === "explaining") {
          const reply = await this.#explain(aggregate);
          await this.#recordDiscussion(state, aggregate.findings(), reply);
          await this.#publishCustomerConclusion(state, resultId, reply, `inquiry:${state.requestId}:progress`);
          aggregate.finish();
          const result = await this.#save(state);
          const completed = result.activity?.status === "completed";
          this.#options.recordEvent(completed ? "hanli.inquiry.completed" : "hanli.inquiry.blocked", {
            correlationId: state.conversationId, conversationId: state.conversationId,
            requestId: state.requestId, rounds: state.rounds.length, status: state.status,
            resolvesFailure: completed,
          });
          return result;
        }
      }
      return this.project(await memory.readPersonaConversation("han-li", state.conversationId));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "排查服务没有返回有效结果";
      this.#options.recordEvent("hanli.inquiry.failed", {
        correlationId: state.conversationId, conversationId: state.conversationId,
        requestId: state.requestId, phase: state.phase, reason, flowImpact: "none",
      });
      aggregate.fail(reason);
      // 失败记录没有 result 身份；用户重试时仍然可以继续相同阶段。
      return this.#save(state);
    }
  }

  async #investigate(aggregate: HanliInquiryAggregate): Promise<void> {
    const state = aggregate.state;
    const round = state.rounds.length;
    const questionId = round === 1 ? `internal:inquiry:${state.requestId}:question`
      : `internal:inquiry:${state.requestId}:round:${round}:question`;
    const answerId = round === 1 ? `internal:inquiry:${state.requestId}:answer`
      : `internal:inquiry:${state.requestId}:round:${round}:answer`;
    const inquiry: HanliInvestigationRequest = {
      ...state.goal, investigationQuestion: aggregate.current.question,
      previousFindings: state.rounds.flatMap((item) => item.findings ? [item.findings] : []),
    };
    await this.#publishInternalDeliberation(state, questionId, "han-li", buildInvestigationHandoff(inquiry), undefined, state.request.attachmentIds || []);
    if (!this.#options.investigateWithNangong) throw new Error("南宫婉只读核实服务尚未接入");
    aggregate.transition("queued", `第 ${round} 轮调查等待南宫婉接收。`);
    await this.#save(state);
    const findings = await this.#options.investigateWithNangong(inquiry, state.request, () => {
      aggregate.transition("investigating", `南宫婉正在进行第 ${round} 轮只读核实：${aggregate.current.question}`);
      void this.#save(state);
    });
    aggregate.receive(findings);
    // 先保留结构化证据，后续显示、评估或解释失败均可恢复。
    await this.#save(state);
    await this.#publishInternalDeliberation(state, answerId, "nangong-wan", buildInvestigationReport(findings), questionId);
    const evidence = buildInvestigationEvidence(findings);
    if (evidence) await this.#publishInternalDeliberation(state, `${answerId}:evidence`, "nangong-wan", evidence, answerId, [], "technical-evidence");
  }

  async #assess(aggregate: HanliInquiryAggregate): Promise<void> {
    const state = aggregate.state;
    const chat = this.#options.conversation;
    if (!chat) throw new Error("韩立证据判断能力尚未接入");
    const prompt = this.#options.prompts.render("hanli.inquiry-assessment", {
      customerQuestion: state.goal.customerQuestion,
      understandingJson: JSON.stringify(state.goal),
      roundsJson: JSON.stringify(state.rounds),

    });
    const response = await chat.send({ ...state.request, attachmentIds: [] }, prompt, state.selectedModel, { workspacePolicy: "request-snapshot" });
    aggregate.assess(parseInquiryAssessment(response, state.goal.customerQuestion));
    await this.#save(state);
  }

  async #explain(aggregate: HanliInquiryAggregate): Promise<string> {
    const state = aggregate.state;
    const chat = this.#options.conversation;
    if (!chat) throw new Error("韩立客户解释能力尚未接入");
    const prompt = this.#options.prompts.render("hanli.inquiry-response", {
      customerQuestion: state.goal.customerQuestion,
      understandingJson: JSON.stringify(state.goal),
      investigationQuestion: aggregate.current.question,
      findingsJson: JSON.stringify(aggregate.findings()),
    });
    const response = await chat.send({ ...state.request, attachmentIds: [] }, prompt, state.selectedModel, { workspacePolicy: "request-snapshot" });
    const reply = response.text.trim();
    if (!reply) throw new Error("韩立没有返回客户解释");
    return reply;
  }

  /** 只登记稳定身份的客户最终结论，通过专用客户写入入口避免与恢复 JSON 混写。 */
  async #publishCustomerConclusion(state: InquirySnapshot, messageId: string, content: string, replyToMessageId: string): Promise<PersonaConversationOutDto> {
    const memory = this.#options.memory!;
    const prior = await memory.readPersonaConversation("han-li", state.conversationId);
    const customerMessage = prior.messages.find((message) => message.messageId === state.requestId);
    if (!customerMessage) throw new Error("客户原问题尚未提交，不能保存排查结论。");
    if (prior.messages.some((message) => message.messageId === messageId)) return this.project(prior);
    const saved = await memory.appendPersonaCustomerMessage({
      ownerPersonaId: "han-li", conversationId: state.conversationId, messageId,
      speakerPersonaId: "han-li", content, replyToMessageId, createdAt: new Date().toISOString(),
    });
    const projected = this.project(saved);
    this.#options.onPersonaConversationChanged?.(projected);
    return projected;
  }

  async #recordDiscussion(state: InquirySnapshot, findings: NangongInquiryResultOutDto, customerReply: string): Promise<void> {
    try {
      await this.#options.memory!.recordRequirementDiscussionContext({
        contextId: state.requestId, ownerPersonaId: "han-li", conversationId: state.conversationId,
        sourceRequestId: state.requestId, ...state.goal,
        findingStatus: findings.status, findingSummary: findings.summary,
        evidence: findings.evidence, unknowns: findings.unknowns,
        customerConclusion: customerReply, createdAt: new Date().toISOString(),
      });
    } catch (error) {
      this.#options.recordEvent("hanli.inquiry.discussion_context_failed", {
        conversationId: state.conversationId, requestId: state.requestId,
        reason: error instanceof Error ? error.message : "需求研讨事实包保存失败",
      });
    }
  }
}

/** 可读交接只说明结论和仍待核实事项；依据进入关联的折叠技术证据消息。 */
function buildInvestigationReport(findings: NangongInquiryResultOutDto): string {
  let heading = "尚未完全核实";
  if (findings.status === "verified") {
    heading = "核实结果";
  }

  let report = `${heading}：${findings.summary}`;
  if (findings.unknowns.length > 0) {
    report += `\n\n尚未核实：${findings.unknowns.join("；")}`;
  }
  return report;
}

/** 技术依据保持可追溯，但绝不与人物可读交接拼成同一正文。 */
function buildInvestigationEvidence(findings: NangongInquiryResultOutDto): string {
  return findings.evidence.map((evidence) => `依据：${evidence.source}\n${evidence.detail}`).join("\n\n");
}

/** 把客户原话和韩立已经形成的结构化理解整理成南宫婉无需猜测上下文的交接说明。 */
function buildInvestigationHandoff(inquiry: HanliInvestigationRequest): string {
  // 每一段保留独立业务含义，避免“修复这个”等短句脱离前文后成为唯一目标。
  return [
    `客户原话：${inquiry.customerQuestion}`,
    `韩立理解的完整目标：${inquiry.understoodGoal}`,
    `需要核实的对象：${inquiry.verificationTarget}`,
    `客户期望得到的结论：${inquiry.expectedAnswer}`,
    `调查范围：${inquiry.investigationQuestion}`,
  ].join("\n\n");
}
