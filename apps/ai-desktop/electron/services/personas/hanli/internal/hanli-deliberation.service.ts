import { randomUUID } from "node:crypto";

import type { CollaborationMemoryPort } from "../../../../../contracts/services/support/capabilities/event-center/index.js";
import type { EvolutionProposalOutDto, EvolutionSourceMessageSnapshotOutDto, EvolutionStateOutDto } from "../../../../../contracts/services/evolution/index.js";
import type { HanliAcceptanceOperationValue, HanliAcceptancePlanOutDto, HanliEvolutionDeliberationOutDto, HanliTopicCandidateOutDto } from "../../../../../contracts/services/personas/hanli/index.js";
import type { EvolutionStatePort } from "../../../evolution/index.js";
import type { PromptLibraryPort } from "../../../support/capabilities/prompts/index.js";

/** 韩立研讨所需的外部能力；南宫回答和韩立判断都由明确人物端口提供。 */
export interface HanliDeliberationDependencies {
  store: EvolutionStatePort;
  prompts: PromptLibraryPort;
  memory: CollaborationMemoryPort | null;
  askHanli(prompt: string, state: EvolutionStateOutDto): Promise<string>;
  askNangong(question: string, context: string, state: EvolutionStateOutDto): Promise<string>;
  recordEvent(type: string, details: Record<string, unknown>): void;
  readStableUserId(): string;
  readProjectScope(state: EvolutionStateOutDto): string;
}

/**
 * 韩立研讨服务：拥有发问、证据判断、专题确立和一次性方向审批语义。
 *
 * 真实传参示例：Evolution 当前状态、AI Memory 会话证据，以及韩立/南宫各自的会话端口。
 * 真实返回示例：推进一轮后返回已保存回答与韩立判断的 EvolutionStateOutDto，或返回正式审批决定。
 * 异常或副作用示例：证据缺失或 AI JSON 无效时明确抛错；成功判断会通过 EvolutionStatePort 原子保存。
 */
export class HanliDeliberationService {
  constructor(private readonly dependencies: HanliDeliberationDependencies) {}

  /** 每次只推进一轮研讨，让页面可以逐条看到问题、回答和判断依据。 */
  async advance(): Promise<EvolutionStateOutDto> {
    const { store, memory, askHanli, askNangong, recordEvent } = this.dependencies;
    let state = store.state();
    if (!state.automationContext.workspaceState?.roots?.length) throw new Error("请先为自动演化保存实施工作区。 ");
    let deliberation = [...state.deliberations].reverse().find((item) => ["questioning", "ready-to-establish"].includes(item.status));
    if (!deliberation) {
      if (!memory) throw new Error("AI Memory 数据库不可用，韩立不能读取对话库。 ");
      const deliberationId = `han-li-deliberation-${randomUUID()}`;
      const snapshots = memory.readHanLiEvolutionCorpus(deliberationId);
      const semanticContext = memory.readHanliSemanticContext(this.dependencies.readStableUserId(), this.dependencies.readProjectScope(state), "", 20);
      const first = parseHanliQuestion(await askHanli(this.dependencies.prompts.render("hanli.first-question", {
        corpus: formatEvolutionCorpus(snapshots),
        semanticContextJson: JSON.stringify(semanticContext),
      }), state));
      state = store.beginDeliberation(deliberationId, snapshots, first.question, first.reason);
      deliberation = state.deliberations.find((item) => item.deliberationId === deliberationId)!;
      recordEvent("han-li.evolution.deliberation_started", { deliberationId, sourceMessageCount: snapshots.length, sourceConversationCount: new Set(snapshots.map((item) => `${item.source}:${item.conversationId}`)).size, question: first.question });
    }
    if (deliberation.status === "ready-to-establish") return store.establishDeliberationTopic(deliberation.deliberationId);
    const round = deliberation.rounds.at(-1)!;
    const context = formatDeliberationContext(deliberation);
    if (!round.answer) {
      const answer = await askNangong(round.question, context, state);
      state = store.recordDeliberationAnswer(deliberation.deliberationId, round.roundId, answer);
      recordEvent("nangong.evolution.deliberation_answered", { deliberationId: deliberation.deliberationId, roundId: round.roundId, roundNumber: round.roundNumber, question: round.question, answer });
    }
    const refreshed = state.deliberations.find((item) => item.deliberationId === deliberation!.deliberationId)!;
    const answeredRound = refreshed.rounds.find((item) => item.roundId === round.roundId)!;
    if (!answeredRound.assessment) {
      const maximum = state.automationSettings.maxRoundsPerTopic;
      const mustConclude = maximum !== null && answeredRound.roundNumber >= maximum;
      const judgment = parseHanliJudgment(await askHanli(this.dependencies.prompts.render("hanli.topic-judgment", {
        roundConstraint: mustConclude
          ? `当前已到配置的第 ${maximum} 轮。证据足够时确立专题；仍不足时返回继续追问，但必须明确唯一缺口。`
          : "证据不足就继续追问，不能为了自动化而提前确立专题。",
        deliberationContext: formatDeliberationContext(refreshed),
        semanticContextJson: JSON.stringify(memory?.readHanliSemanticContext(this.dependencies.readStableUserId(), this.dependencies.readProjectScope(state), answeredRound.question, 12) || null),
      }), state));
      if (mustConclude && !judgment.candidate) {
        state = store.blockDeliberation(refreshed.deliberationId, answeredRound.roundId, judgment.assessment, `韩立完成 ${maximum} 轮研讨后仍确认存在证据缺口：${judgment.nextQuestion?.reason || judgment.assessment}`);
        recordEvent("han-li.evolution.deliberation_blocked", { deliberationId: refreshed.deliberationId, roundId: answeredRound.roundId, roundNumber: answeredRound.roundNumber, assessment: judgment.assessment, missingEvidence: judgment.nextQuestion?.reason || null });
        return state;
      }
      state = store.assessDeliberation(refreshed.deliberationId, answeredRound.roundId, judgment.assessment, judgment.nextQuestion, judgment.candidate);
      recordEvent("han-li.evolution.deliberation_assessed", { deliberationId: refreshed.deliberationId, roundId: answeredRound.roundId, roundNumber: answeredRound.roundNumber, decision: judgment.candidate ? "establish-topic" : "continue", assessment: judgment.assessment, nextQuestion: judgment.nextQuestion?.question || null });
    }
    const assessed = state.deliberations.find((item) => item.deliberationId === refreshed.deliberationId)!;
    if (assessed.status === "ready-to-establish") {
      state = store.establishDeliberationTopic(assessed.deliberationId);
      recordEvent("han-li.evolution.topic_established", { deliberationId: assessed.deliberationId, topicId: state.activeTopicId, candidate: assessed.candidate });
    }
    return state;
  }

  /** 一次性流程仍由韩立形成正式方向判断，Workflow 只能请求判断并使用结果。 */
  async reviewOneShotProposal(proposal: EvolutionProposalOutDto): Promise<{ decision: "approved" | "rejected" | "supplement-required"; advice: string }> {
    const state = this.dependencies.store.state();
    const semanticContext = this.dependencies.memory?.readHanliSemanticContext(this.dependencies.readStableUserId(), this.dependencies.readProjectScope(state), proposal.title, 12) || null;
    const response = await this.dependencies.askHanli(this.dependencies.prompts.render("hanli.proposal-review", {
      proposalContextJson: JSON.stringify({ proposal, topic: state.topics.find((item) => item.topicId === proposal.topicId) }),
      semanticContextJson: JSON.stringify(semanticContext),
    }), state);
    const value = parseJsonObject(response);
    const decision = value.decision;
    const advice = typeof value.advice === "string" ? value.advice.trim().slice(0, 8_000) : "";
    if (!("approved,rejected,supplement-required".split(",") as unknown[]).includes(decision) || !advice) throw new Error("韩立一次性方向审批缺少有效决定或具体意见。");
    return { decision: decision as "approved" | "rejected" | "supplement-required", advice };
  }

  /** 根据专题事实形成真实应用验收计划；只制定检查，不声称已经操作或通过。 */
  async createAcceptancePlan(
    topic: EvolutionStateOutDto["topics"][number],
    proposal: EvolutionProposalOutDto,
    priorFindings: Record<string, unknown>[],
    semanticContext: Record<string, unknown>,
    requestPlan: (prompt: string, workspaceState: typeof topic.workspaceState, locale: typeof topic.locale) => Promise<string>,
  ): Promise<HanliAcceptancePlanOutDto> {
    const response = await requestPlan(this.dependencies.prompts.render("hanli.acceptance-plan", {
      topicJson: JSON.stringify({ title: topic.title, goal: topic.goal, scope: topic.scope, exclusions: topic.exclusions, evidence: topic.evidence, acceptanceCriteria: topic.acceptanceCriteria }),
      proposalJson: JSON.stringify({ title: proposal.title, content: proposal.content, impactScope: proposal.impactScope, risks: proposal.risks, resultSummary: proposal.resultSummary }),
      priorFindingsJson: JSON.stringify(priorFindings),
      semanticContextJson: JSON.stringify(semanticContext),
    }), topic.workspaceState, topic.locale);
    return parseAcceptancePlan(response, topic.topicId, proposal.proposalId);
  }
}

function parseJsonObject(text: string): Record<string, unknown> { const candidate = text.match(/\{[\s\S]*\}/)?.[0]; if (!candidate) throw new Error("AI 没有返回可解析的结构化判断。 "); try { return JSON.parse(candidate) as Record<string, unknown>; } catch { throw new Error("AI 返回的结构化判断不是有效 JSON。 "); } }
function normalizeList(value: unknown): string[] { return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 100) : []; }
function parseHanliQuestion(text: string) { const value = parseJsonObject(text); const question = typeof value.question === "string" ? value.question.trim() : ""; const reason = typeof value.reason === "string" ? value.reason.trim() : ""; if (!question || !reason) throw new Error("韩立首轮问题缺少问题正文或发问依据。 "); return { question, reason }; }
function parseHanliJudgment(text: string): { assessment: string; nextQuestion: { question: string; reason: string } | null; candidate: HanliTopicCandidateOutDto | null } { const value = parseJsonObject(text); const assessment = typeof value.assessment === "string" ? value.assessment.trim() : ""; if (!assessment) throw new Error("韩立研讨判断缺少事实说明。 "); if (value.decision === "establish-topic") { const topic = value.topic as Partial<HanliTopicCandidateOutDto> | undefined; const candidate = topic && { title: typeof topic.title === "string" ? topic.title : "", goal: typeof topic.goal === "string" ? topic.goal : "", scope: normalizeList(topic.scope), exclusions: normalizeList(topic.exclusions), evidence: normalizeList(topic.evidence), acceptanceCriteria: normalizeList(topic.acceptanceCriteria), establishmentReason: typeof topic.establishmentReason === "string" ? topic.establishmentReason : assessment }; if (!candidate?.title || !candidate.goal || !candidate.scope.length || !candidate.evidence.length || !candidate.acceptanceCriteria.length) throw new Error("韩立确立的专题缺少范围、证据或验收条件。 "); return { assessment, nextQuestion: null, candidate }; } const question = typeof value.nextQuestion === "string" ? value.nextQuestion.trim() : ""; const reason = typeof value.questionReason === "string" ? value.questionReason.trim() : ""; if (!question || !reason) throw new Error("韩立决定继续研讨，但没有给出下一问和依据。 "); return { assessment, nextQuestion: { question, reason }, candidate: null }; }
function formatEvolutionCorpus(snapshots: EvolutionSourceMessageSnapshotOutDto[]): string { const groups = new Map<string, EvolutionSourceMessageSnapshotOutDto[]>(); for (const snapshot of snapshots) { const key = `${snapshot.source}:${snapshot.conversationId}`; groups.set(key, [...(groups.get(key) || []), snapshot]); } const newest = Math.max(...snapshots.map((item) => Date.parse(item.originalCreatedAt)).filter(Number.isFinite), 0); return [...groups.entries()].sort(([, left], [, right]) => latest(right) - latest(left)).map(([key, messages]) => [`会话组 ${key}（${maturity(newest, latest(messages))}）`, ...messages.sort((left, right) => left.sequenceNumber - right.sequenceNumber).map((item) => `[${item.originalCreatedAt}] ${item.role}${item.responsePhase ? `/${item.responsePhase}` : ""}：${item.content}`)].join("\n")).join("\n\n---\n\n"); }
function latest(messages: EvolutionSourceMessageSnapshotOutDto[]): number { return Math.max(...messages.map((item) => Date.parse(item.originalCreatedAt)).filter(Number.isFinite), 0); }
function maturity(newest: number, group: number): string { const days = Math.max(0, newest - group) / 86_400_000; return days <= 30 ? "近期高权重" : days <= 180 ? "中期参考" : "早期低权重，仅用于演变追溯"; }
function formatDeliberationContext(deliberation: HanliEvolutionDeliberationOutDto): string { return [`研讨编号：${deliberation.deliberationId}`, ...deliberation.rounds.map((round) => [`第 ${round.roundNumber} 轮韩立问题：${round.question}`, `发问依据：${round.questionReason}`, round.answer ? `南宫婉原回答：${round.answer}` : "南宫婉尚未回答", round.assessment ? `韩立判断：${round.assessment}` : ""].filter(Boolean).join("\n"))].join("\n\n"); }

function parseAcceptancePlan(text: string, topicId: string, proposalId: string): HanliAcceptancePlanOutDto {
  const value = parseJsonObject(text);
  const summary = typeof value.summary === "string" ? value.summary.trim().slice(0, 2_000) : "";
  const concerns = normalizeList(value.concerns).slice(0, 20);
  const checks = (Array.isArray(value.checks) ? value.checks.slice(0, 30) : []).flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const category = typeof item.category === "string" ? item.category.trim().slice(0, 120) : "";
    const target = typeof item.target === "string" ? item.target.trim().slice(0, 300) : "";
    const action = typeof item.action === "string" ? item.action.trim().slice(0, 2_000) : "";
    const expected = typeof item.expected === "string" ? item.expected.trim().slice(0, 2_000) : "";
    const evidenceRequired = typeof item.evidenceRequired === "string" ? item.evidenceRequired.trim().slice(0, 1_000) : "";
    const operations = Array.isArray(item.operations) ? item.operations.slice(0, 20).flatMap(parseAcceptanceOperation) : [];
    return category && target && action && expected && evidenceRequired && operations.length ? [{ checkId: `check-${index + 1}`, category, target, action, expected, evidenceRequired, operations }] : [];
  });
  if (!summary || !concerns.length || checks.length < 2) throw new Error("韩立没有形成包含用户关注点和真实操作证据的有效验收计划。 ");
  return { version: 1, planId: `hanli-acceptance-plan-${randomUUID()}`, topicId, proposalId, summary, concerns, checks, generatedAt: new Date().toISOString() };
}

function parseAcceptanceOperation(raw: unknown): HanliAcceptanceOperationValue[] {
  if (!raw || typeof raw !== "object") return [];
  const item = raw as Record<string, unknown>;
  if (item.type === "focus-window") return [{ type: "focus-window" }];
  if (item.type === "resize-window" && Number.isInteger(item.width) && Number.isInteger(item.height)) return [{ type: "resize-window", width: Number(item.width), height: Number(item.height) }];
  if (item.type === "click" && typeof item.target === "string" && item.target.trim()) return [{ type: "click", target: item.target.trim().slice(0, 200) }];
  if (item.type === "scroll" && typeof item.target === "string" && (item.direction === "up" || item.direction === "down") && Number.isFinite(item.amount)) return [{ type: "scroll", target: item.target.trim().slice(0, 200), direction: item.direction, amount: Math.max(40, Math.min(2_000, Math.round(Number(item.amount)))) }];
  if (item.type === "press-key" && ["Tab", "Enter", "Escape", "ArrowDown", "ArrowUp", "PageDown", "PageUp"].includes(String(item.key))) return [{ type: "press-key", target: typeof item.target === "string" ? item.target.trim().slice(0, 200) : undefined, key: item.key as "Tab" | "Enter" | "Escape" | "ArrowDown" | "ArrowUp" | "PageDown" | "PageUp" }];
  if (item.type === "inspect-text" && typeof item.text === "string" && item.text.trim()) return [{ type: "inspect-text", text: item.text.trim().slice(0, 500) }];
  if (item.type === "inspect-layout" && typeof item.target === "string" && item.target.trim()) return [{ type: "inspect-layout", target: item.target.trim().slice(0, 200) }];
  if (item.type === "capture" && typeof item.label === "string" && item.label.trim()) return [{ type: "capture", label: item.label.trim().slice(0, 160) }];
  return [];
}
