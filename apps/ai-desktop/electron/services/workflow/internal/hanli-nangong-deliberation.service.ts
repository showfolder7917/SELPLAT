import { randomUUID } from "node:crypto";

import type { EvolutionSourceMessageSnapshotOutDto, EvolutionStateOutDto } from "../../../../contracts/services/evolution/index.js";
import type { HanliEvolutionDeliberationOutDto, HanliTopicCandidateOutDto } from "../../../../contracts/services/personas/hanli/index.js";
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
      state = store.recordDeliberationAnswer(deliberation.deliberationId, round.roundId, answer);
      const answered = requireDeliberation(state, deliberation.deliberationId).rounds.find((item) => item.roundId === round.roundId)!;
      this.#appendInternalMessage(round.roundId, "answer", "nangong", answer, `internal:${round.roundId}:question`, answered.answeredAt!);
      this.dependencies.recordEvent("hanli.nangong.deliberation_answered", { deliberationId: deliberation.deliberationId, roundId: round.roundId, roundNumber: round.roundNumber });
    }

    const refreshed = requireDeliberation(state, deliberation.deliberationId);
    const answeredRound = refreshed.rounds.find((item) => item.roundId === round.roundId)!;
    if (!answeredRound.assessment) {
      // 连续开关表示持续发现与修正：它保留人工设置，但当前连续运行不因轮数上限自行停机。
      const maximum = state.automaticEvolutionEnabled ? null : state.automationSettings.maxRoundsPerTopic;
      const mustConclude = maximum !== null && answeredRound.roundNumber >= maximum;
      const judgment = parseJudgment(await this.dependencies.askHanli(this.dependencies.prompts.render("hanli.internal-assessment", {
        roundConstraint: mustConclude
          ? `当前已到第 ${maximum} 轮；证据仍不足时必须阻断，不能虚构专题。`
          : "证据不足就给出唯一下一问；事实、范围和验收条件齐备时确立专题。",
        deliberationContext: formatDeliberationContext(refreshed),
        semanticContextJson: JSON.stringify(memory?.readHanliSemanticContext(this.dependencies.readStableUserId(), this.dependencies.readProjectScope(state), answeredRound.question, 12) || null),
      }), state));
      if (mustConclude && !judgment.candidate) {
        state = store.blockDeliberation(refreshed.deliberationId, answeredRound.roundId, judgment.assessment, `完成 ${maximum} 轮内部研讨后仍存在证据缺口：${judgment.nextQuestion?.reason || judgment.assessment}`);
        this.#appendInternalMessage(answeredRound.roundId, "assessment", "hanli", `判断：${judgment.assessment}`, `internal:${answeredRound.roundId}:answer`, new Date().toISOString());
        return { state, activity: "idle" };
      }
      state = store.assessDeliberation(refreshed.deliberationId, answeredRound.roundId, judgment.assessment, judgment.nextQuestion, judgment.candidate);
      const assessed = requireDeliberation(state, refreshed.deliberationId);
      const savedRound = assessed.rounds.find((item) => item.roundId === answeredRound.roundId)!;
      this.#appendInternalMessage(answeredRound.roundId, "assessment", "hanli", `判断：${judgment.assessment}`, `internal:${answeredRound.roundId}:answer`, savedRound.assessedAt!);
      const nextRound = assessed.rounds.at(-1)!;
      if (!judgment.candidate && nextRound.roundId !== answeredRound.roundId) {
        this.#appendInternalMessage(nextRound.roundId, "question", "hanli", nextRound.question, `internal:${answeredRound.roundId}:assessment`, nextRound.createdAt);
      }
      this.dependencies.recordEvent("hanli.nangong.deliberation_assessed", { deliberationId: refreshed.deliberationId, roundId: answeredRound.roundId, decision: judgment.candidate ? "establish-topic" : "continue", assessment: judgment.assessment });
    }
    const assessed = requireDeliberation(state, refreshed.deliberationId);
    return assessed.status === "ready-to-establish" ? this.#establish(assessed) : { state, activity: "questioning" };
  }

  #establish(deliberation: HanliEvolutionDeliberationOutDto): HanliNangongDeliberationAdvanceResult {
    const state = this.dependencies.store.establishDeliberationTopic(deliberation.deliberationId);
    this.dependencies.recordEvent("hanli.nangong.topic_established", { deliberationId: deliberation.deliberationId, topicId: state.activeTopicId, candidate: deliberation.candidate });
    return { state, activity: "topic-established" };
  }

  #appendInternalMessage(roundId: string, phase: "question" | "answer" | "assessment", role: "hanli" | "nangong", content: string, replyToMessageId: string | null, createdAt: string): void {
    const conversationId = this.dependencies.readHanliConversationId();
    if (!conversationId || !this.dependencies.memory) return;
    this.dependencies.memory.appendHanliInternalMessage({ conversationId, messageId: `internal:${roundId}:${phase}`, role, content, replyToMessageId, createdAt });
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

function parseJudgment(text: string): { assessment: string; nextQuestion: { question: string; reason: string } | null; candidate: HanliTopicCandidateOutDto | null } {
  const value = parseObject(text);
  const assessment = typeof value.assessment === "string" ? value.assessment.trim() : "";
  if (!assessment) throw new Error("韩立内部研讨判断缺少事实说明。");
  if (value.decision === "establish-topic") {
    const topic = value.topic as Partial<HanliTopicCandidateOutDto> | undefined;
    const candidate = topic && {
      title: textValue(topic.title), goal: textValue(topic.goal), scope: listValue(topic.scope), exclusions: listValue(topic.exclusions),
      evidence: listValue(topic.evidence), acceptanceCriteria: listValue(topic.acceptanceCriteria), establishmentReason: textValue(topic.establishmentReason) || assessment,
    };
    if (!candidate?.title || !candidate.goal || !candidate.scope.length || !candidate.evidence.length || !candidate.acceptanceCriteria.length) throw new Error("韩立确立的专题缺少范围、证据或验收条件。");
    return { assessment, nextQuestion: null, candidate };
  }
  const question = textValue(value.nextQuestion);
  const reason = textValue(value.questionReason);
  if (value.decision !== "continue" || !question || !reason) throw new Error("韩立决定继续研讨，但没有给出下一问和依据。");
  return { assessment, nextQuestion: { question, reason }, candidate: null };
}

function textValue(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function listValue(value: unknown): string[] { return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 100) : []; }
function requireDeliberation(state: EvolutionStateOutDto, deliberationId: string): HanliEvolutionDeliberationOutDto { const value = state.deliberations.find((item) => item.deliberationId === deliberationId); if (!value) throw new Error("人物内部研讨记录不存在。"); return value; }
function formatDeliberationContext(deliberation: HanliEvolutionDeliberationOutDto): string { return [`研讨编号：${deliberation.deliberationId}`, ...deliberation.rounds.map((round) => [`第 ${round.roundNumber} 轮韩立问题：${round.question}`, `发问依据：${round.questionReason}`, round.answer ? `南宫婉回答：${round.answer}` : "南宫婉尚未回答", round.assessment ? `韩立判断：${round.assessment}` : ""].filter(Boolean).join("\n"))].join("\n\n"); }
function formatEvolutionCorpus(snapshots: EvolutionSourceMessageSnapshotOutDto[]): string { return snapshots.slice().sort((left, right) => Date.parse(left.originalCreatedAt) - Date.parse(right.originalCreatedAt)).map((item) => `[${item.originalCreatedAt}] ${item.source}/${item.role}：${item.content}`).join("\n"); }
