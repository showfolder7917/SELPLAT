import { randomUUID } from "node:crypto";

import type { EvolutionSourceMessageSnapshotOutDto, EvolutionStateOutDto } from "../../../../contracts/services/evolution/index.js";
import type { HanliEvolutionDeliberationOutDto, HanliTopicCandidateOutDto } from "../../../../contracts/services/personas/hanli/index.js";
import type { PersonaConversationOutDto } from "../../../../contracts/services/personas/conversation/index.js";
import type { CollaborationMemoryPort } from "../../../../contracts/services/support/capabilities/event-center/index.js";
import type { EvolutionStatePort } from "../../evolution/index.js";
import type { PromptLibraryPort } from "../../support/capabilities/prompts/index.js";

export interface HanliNangongDeliberationDependencies {
  store: EvolutionStatePort;
  prompts: PromptLibraryPort;
  memory: CollaborationMemoryPort | null;
  askHanli(prompt: string, state: EvolutionStateOutDto): Promise<string>;
  askNangong(prompt: string, state: EvolutionStateOutDto): Promise<string>;
  recordEvent(type: string, details: Record<string, unknown>): void;
  readStableUserId(): string;
  readProjectScope(state: EvolutionStateOutDto): string;
  readHanliConversationId(): string | null;
  onPersonaConversationChanged?(conversation: PersonaConversationOutDto): void;
}

export interface HanliNangongDeliberationAdvanceResult {
  state: EvolutionStateOutDto;
  activity: "idle" | "questioning" | "topic-established";
}

/** 用户确认后推进韩立与南宫婉的一轮内部研讨；轮次进入业务档案，但不进入用户训练语料。 */
export class HanliNangongDeliberationService {
  constructor(private readonly dependencies: HanliNangongDeliberationDependencies) {}

  async advance(options: { requireProblem?: boolean; forceNew?: boolean } = {}): Promise<HanliNangongDeliberationAdvanceResult> {
    const { store, memory } = this.dependencies;
    let state = store.state();
    if (["paused", "stopped", "blocked"].includes(state.automationRuntime.status)) return { state, activity: "idle" };
    if (!state.automationContext.workspaceState?.roots?.length) throw new Error("请先为自动研讨登记实施工作区。");
    let deliberation = options.forceNew ? undefined : [...state.deliberations].reverse().find((item) => ["questioning", "ready-to-establish"].includes(item.status));
    if (!deliberation) {
      if (!memory) throw new Error("AI Memory 数据库不可用，韩立无法读取用户确认的需求资料。");
      const deliberationId = `hanli-nangong-deliberation-${randomUUID()}`;
      const conversationId = this.dependencies.readHanliConversationId();
      const snapshots = memory.readHanLiEvolutionCorpus(deliberationId, conversationId);
      if (!snapshots.length) {
        if (!options.requireProblem) return { state, activity: "idle" };
        throw new Error("当前韩立会话尚未形成可供内部研讨的用户需求资料。");
      }
      const discovery = parseQuestion(await this.dependencies.askHanli(this.dependencies.prompts.render("hanli.internal-question", {
        discoveryMode: options.requireProblem ? "用户已经输入 1，必须围绕本次确认需求提出第一问。" : "持续自动模式：只有发现尚未处理且有用户证据的问题才发问；没有新问题时返回 wait。",
        corpus: formatEvolutionCorpus(snapshots),
        semanticContextJson: JSON.stringify(memory.readHanliSemanticContext(this.dependencies.readStableUserId(), this.dependencies.readProjectScope(state), "", 20)),
        establishedTopicsJson: JSON.stringify(state.topics.map((topic) => ({ title: topic.title, goal: topic.goal, status: topic.status }))),
      }), state));
      if (!discovery.question) {
        if (options.requireProblem) throw new Error(`韩立没有从已确认需求中形成有效问题：${discovery.reason}`);
        this.dependencies.recordEvent("hanli.nangong.deliberation_waiting_for_new_problem", { reason: discovery.reason });
        return { state, activity: "idle" };
      }
      state = store.beginDeliberation(deliberationId, snapshots, discovery.question, discovery.reason);
      deliberation = state.deliberations.find((item) => item.deliberationId === deliberationId)!;
      this.#appendInternalMessage(deliberation.rounds[0].roundId, "question", "hanli", discovery.question, null, deliberation.rounds[0].createdAt);
      this.dependencies.recordEvent("hanli.nangong.deliberation_started", { deliberationId, question: discovery.question, sourceMessageCount: snapshots.length });
    }
    if (deliberation.status === "ready-to-establish") return this.#establish(deliberation);

    const round = deliberation.rounds.at(-1)!;
    if (!round.answer) {
      const answer = (await this.dependencies.askNangong(this.dependencies.prompts.render("nangong.internal-answer", {
        question: round.question,
        questionReason: round.questionReason,
        deliberationContext: formatDeliberationContext(deliberation),
        sourceCorpus: formatEvolutionCorpus(deliberation.sourceSnapshots),
      }), state)).trim();
      if (!answer) throw new Error("南宫婉没有返回内部研讨回答。");
      if (["paused", "stopped", "blocked"].includes(store.state().automationRuntime.status)) return { state: store.state(), activity: "idle" };
      state = store.recordDeliberationAnswer(deliberation.deliberationId, round.roundId, answer);
      const answered = requireDeliberation(state, deliberation.deliberationId).rounds.find((item) => item.roundId === round.roundId)!;
      this.#appendInternalMessage(round.roundId, "answer", "nangong", answer, `internal:${round.roundId}:question`, answered.answeredAt!);
      this.dependencies.recordEvent("hanli.nangong.deliberation_answered", { deliberationId: deliberation.deliberationId, roundId: round.roundId, roundNumber: round.roundNumber });
    }

    const refreshed = requireDeliberation(state, deliberation.deliberationId);
    const answeredRound = refreshed.rounds.find((item) => item.roundId === round.roundId)!;
    if (!answeredRound.assessment) {
      // 用户确认后的统一自动流程持续追问，只有人工暂停或阻塞才停止，不再依赖独立开关。
      const maximum = state.automationRuntime.status === "running" ? null : state.automationSettings.maxRoundsPerTopic;
      const mustConclude = maximum !== null && answeredRound.roundNumber >= maximum;
      const judgment = parseJudgment(await this.dependencies.askHanli(this.dependencies.prompts.render("hanli.internal-assessment", {
        roundConstraint: mustConclude
          ? `当前已到第 ${maximum} 轮；证据仍不足时必须阻断，不能虚构专题。`
          : "证据不足就给出唯一下一问；事实、范围和验收条件齐备时确立专题。",
        deliberationContext: formatDeliberationContext(refreshed),
        semanticContextJson: JSON.stringify(memory?.readHanliSemanticContext(this.dependencies.readStableUserId(), this.dependencies.readProjectScope(state), answeredRound.question, 12) || null),
      }), state));
      if (["paused", "stopped", "blocked"].includes(store.state().automationRuntime.status)) return { state: store.state(), activity: "idle" };
      if (mustConclude && !judgment.candidate) {
        state = store.blockDeliberation(refreshed.deliberationId, answeredRound.roundId, judgment.assessment, `完成 ${maximum} 轮内部研讨后仍存在证据缺口：${judgment.nextQuestion?.reason || judgment.assessment}`);
        // 阻断原因属于后台业务状态，不冒充韩立对南宫婉说过的话。
        return { state, activity: "idle" };
      }
      state = store.assessDeliberation(refreshed.deliberationId, answeredRound.roundId, judgment.assessment, judgment.nextQuestion, judgment.candidate);
      const assessed = requireDeliberation(state, refreshed.deliberationId);
      const savedRound = assessed.rounds.find((item) => item.roundId === answeredRound.roundId)!;
      // 后台判断继续保存，但页面只收到模型生成的自然回复，不再插入一条判断报告。
      if (judgment.candidate) this.#appendInternalMessage(answeredRound.roundId, "reply", "hanli", judgment.reply, `internal:${answeredRound.roundId}:answer`, savedRound.assessedAt!);
      const nextRound = assessed.rounds.at(-1)!;
      if (!judgment.candidate && nextRound.roundId !== answeredRound.roundId) {
        this.#appendInternalMessage(nextRound.roundId, "question", "hanli", nextRound.question, `internal:${answeredRound.roundId}:answer`, nextRound.createdAt);
      }
      this.dependencies.recordEvent("hanli.nangong.deliberation_assessed", { deliberationId: refreshed.deliberationId, roundId: answeredRound.roundId, decision: judgment.candidate ? "establish-topic" : "continue", assessment: judgment.assessment });
    }
    const assessed = requireDeliberation(state, refreshed.deliberationId);
    return assessed.status === "ready-to-establish" ? this.#establish(assessed) : { state, activity: "questioning" };
  }

  async #establish(deliberation: HanliEvolutionDeliberationOutDto): Promise<HanliNangongDeliberationAdvanceResult> {
    const { store, prompts } = this.dependencies;
    const interrupted = () => ["paused", "stopped", "blocked"].includes(store.state().automationRuntime.status);
    if (interrupted()) return { state: store.state(), activity: "idle" };
    if (!this.dependencies.memory || !this.dependencies.readHanliConversationId()) throw new Error("无法保存内部确认消息，已阻止开始执行。请先恢复会话数据库。");
    const roundId = deliberation.rounds.at(-1)!.roundId;
    let confirmation = deliberation.rounds.at(-1)!.confirmation;
    if (!confirmation) {
      const offer = (await this.dependencies.askNangong(prompts.render("nangong.internal-confirmation", {
        candidateJson: JSON.stringify(deliberation.candidate), deliberationContext: formatDeliberationContext(deliberation),
      }), store.state())).trim();
      if (!offer) throw new Error("南宫婉尚未说明准备修复的内容。");
      if (interrupted()) return { state: store.state(), activity: "idle" };
      const saved = store.offerDeliberationConfirmation(deliberation.deliberationId, offer);
      confirmation = requireDeliberation(saved, deliberation.deliberationId).rounds.at(-1)!.confirmation!;
    }
    this.#appendInternalMessage(roundId, "offer", "nangong", confirmation.offer, `internal:${roundId}:reply`, confirmation.offeredAt);
    if (!confirmation.reply) {
      const reply = (await this.dependencies.askHanli(prompts.render("hanli.internal-confirmation", {
        candidateJson: JSON.stringify(deliberation.candidate), offer: confirmation.offer, sourceCorpus: formatEvolutionCorpus(deliberation.sourceSnapshots),
      }), store.state())).trim();
      if (!reply) throw new Error("韩立尚未回复南宫婉的修复说明。");
      if (interrupted()) return { state: store.state(), activity: "idle" };
      const saved = store.replyDeliberationConfirmation(deliberation.deliberationId, reply);
      const current = requireDeliberation(saved, deliberation.deliberationId);
      confirmation = current.rounds.find((item) => item.roundId === roundId)!.confirmation!;
      if (reply !== "1") {
        const followup = current.rounds.at(-1)!;
        this.#appendInternalMessage(followup.roundId, "question", "hanli", reply, `internal:${roundId}:offer`, followup.createdAt);
        return { state: saved, activity: "questioning" };
      }
    }
    this.#appendInternalMessage(roundId, "confirm", "hanli", confirmation.reply!, `internal:${roundId}:offer`, confirmation.repliedAt!);
    if (interrupted()) return { state: store.state(), activity: "idle" };
    const state = this.dependencies.store.establishDeliberationTopic(deliberation.deliberationId);
    this.#appendInternalMessage(roundId, "started", "nangong", `收到 1。我现在开始整理“${deliberation.candidate!.title}”的实施提案，随后进入审批、分发、执行和验证。具体进度会在任务协作群显示。`, `internal:${roundId}:confirm`, new Date().toISOString());
    this.dependencies.recordEvent("hanli.nangong.topic_established", { deliberationId: deliberation.deliberationId, topicId: state.activeTopicId, candidate: deliberation.candidate });
    return { state, activity: "topic-established" };
  }

  #appendInternalMessage(roundId: string, phase: "question" | "answer" | "reply" | "offer" | "confirm" | "started", role: "hanli" | "nangong", content: string, replyToMessageId: string | null, createdAt: string): void {
    const conversationId = this.dependencies.readHanliConversationId();
    if (!conversationId || !this.dependencies.memory) return;
    const conversation = this.dependencies.memory.appendPersonaInternalMessage({
      ownerPersonaId: "han-li",
      conversationId,
      messageId: `internal:${roundId}:${phase}`,
      speakerPersonaId: role === "nangong" ? "nangong-wan" : "han-li",
      content,
      replyToMessageId,
      createdAt,
    });
    // 内部研讨仍只保存一份权威消息；南宫婉页面展示内部对话，韩立页面过滤内部消息。
    this.dependencies.onPersonaConversationChanged?.(conversation);
  }
}

function parseObject(text: string): Record<string, unknown> {
  const candidate = text.match(/\{[\s\S]*\}/u)?.[0];
  if (!candidate) throw new Error("人物内部研讨没有返回可解析的结构化判断。");
  try { return JSON.parse(candidate) as Record<string, unknown>; }
  catch { throw new Error("人物内部研讨返回的结构化判断不是有效 JSON。"); }
}

function parseQuestion(text: string): { question: string | null; reason: string } {
  const value = parseObject(text);
  const reason = typeof value.reason === "string" ? value.reason.trim() : "";
  if (value.action === "wait" && reason) return { question: null, reason };
  const question = typeof value.question === "string" ? value.question.trim() : "";
  if (value.action !== "ask" || !question || !reason) throw new Error("韩立内部研讨缺少问题正文或发问依据。");
  return { question, reason };
}

function parseJudgment(text: string): { assessment: string; reply: string; nextQuestion: { question: string; reason: string } | null; candidate: HanliTopicCandidateOutDto | null } {
  const value = parseObject(text);
  const assessment = typeof value.assessment === "string" ? value.assessment.trim() : "";
  if (!assessment) throw new Error("韩立内部研讨判断缺少事实说明。");
  if (value.decision === "establish-topic") {
    const reply = textValue(value.reply);
    if (!reply) throw new Error("韩立完成研讨时缺少对南宫婉的回复正文。");
    const topic = value.topic as Partial<HanliTopicCandidateOutDto> | undefined;
    const candidate = topic && {
      title: textValue(topic.title), goal: textValue(topic.goal), scope: listValue(topic.scope), exclusions: listValue(topic.exclusions),
      evidence: listValue(topic.evidence), acceptanceCriteria: listValue(topic.acceptanceCriteria), establishmentReason: textValue(topic.establishmentReason) || assessment,
    };
    if (!candidate?.title || !candidate.goal || !candidate.scope.length || !candidate.evidence.length || !candidate.acceptanceCriteria.length) throw new Error("韩立确立的专题缺少范围、证据或验收条件。");
    return { assessment, reply, nextQuestion: null, candidate };
  }
  const question = textValue(value.nextQuestion);
  const reason = textValue(value.questionReason);
  if (value.decision !== "continue" || !question || !reason) throw new Error("韩立决定继续研讨，但没有给出下一问和依据。");
  return { assessment, reply: "", nextQuestion: { question, reason }, candidate: null };
}

function textValue(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function listValue(value: unknown): string[] { return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 100) : []; }
function requireDeliberation(state: EvolutionStateOutDto, deliberationId: string): HanliEvolutionDeliberationOutDto { const value = state.deliberations.find((item) => item.deliberationId === deliberationId); if (!value) throw new Error("人物内部研讨记录不存在。"); return value; }
// 提供真实交谈顺序，不把后台判断及发问依据混成已经说出的聊天历史。
function formatDeliberationContext(deliberation: HanliEvolutionDeliberationOutDto): string { return deliberation.rounds.map((round) => [`韩立：${round.question}`, round.answer ? `南宫婉：${round.answer}` : ""].filter(Boolean).join("\n")).join("\n\n"); }
function formatEvolutionCorpus(snapshots: EvolutionSourceMessageSnapshotOutDto[]): string { return snapshots.slice().sort((left, right) => Date.parse(left.originalCreatedAt) - Date.parse(right.originalCreatedAt)).map((item) => `[${item.originalCreatedAt}] ${item.source}/${item.role}：${item.content}`).join("\n"); }
