import { randomUUID } from "node:crypto";

import type { CollaborationMemoryPort } from "../../../../../contracts/capabilities/event-center/index.js";
import type { EvolutionProposal, EvolutionSourceMessageSnapshot, EvolutionState, HanLiEvolutionDeliberation, HanLiTopicCandidate } from "../../../../../contracts/collaboration/evolution/index.js";
import type { EvolutionStatePort } from "../../../evolution/index.js";

/** 韩立研讨所需的外部能力；南宫回答和韩立判断都由明确人物端口提供。 */
export interface HanliDeliberationDependencies {
  store: EvolutionStatePort;
  memory: CollaborationMemoryPort | null;
  askHanli(prompt: string, state: EvolutionState): Promise<string>;
  askNangong(question: string, context: string, state: EvolutionState): Promise<string>;
  recordEvent(type: string, details: Record<string, unknown>): void;
}

/**
 * 韩立研讨服务：拥有发问、证据判断、专题确立和一次性方向审批语义。
 *
 * 真实传参示例：Evolution 当前状态、AI Memory 会话证据，以及韩立/南宫各自的会话端口。
 * 真实返回示例：推进一轮后返回已保存回答与韩立判断的 EvolutionState，或返回正式审批决定。
 * 异常或副作用示例：证据缺失或 AI JSON 无效时明确抛错；成功判断会通过 EvolutionStatePort 原子保存。
 */
export class HanliDeliberationService {
  constructor(private readonly dependencies: HanliDeliberationDependencies) {}

  /** 每次只推进一轮研讨，让页面可以逐条看到问题、回答和判断依据。 */
  async advance(): Promise<EvolutionState> {
    const { store, memory, askHanli, askNangong, recordEvent } = this.dependencies;
    let state = store.state();
    if (!state.automationContext.workspaceState?.roots?.length) throw new Error("请先为自动演化保存实施工作区。 ");
    let deliberation = [...state.deliberations].reverse().find((item) => ["questioning", "ready-to-establish"].includes(item.status));
    if (!deliberation) {
      if (!memory) throw new Error("AI Memory 数据库不可用，韩立不能读取对话库。 ");
      const deliberationId = `han-li-deliberation-${randomUUID()}`;
      const snapshots = memory.readHanLiEvolutionCorpus(deliberationId);
      const first = parseHanliQuestion(await askHanli([
        "你是韩立，是自动演化专题研讨的发问方和最终确立者。",
        "请综合下面按完整会话分组保存的南宫婉与 Codex 原始对话。现在不能直接生成专题，也不能替南宫婉拆任务。",
        "取材优先级：近期 Codex 用户原话与南宫婉会话是主要事实；Codex 最终答复短预览只用于理解执行结果；你自己的既有问答和判断不是主要训练来源。越早期的记录成熟度越低，只用于观察演变，不能覆盖近期明确要求。",
        "找出最值得进一步问清、又不能仅靠原记录下结论的一个问题。返回 JSON：{\"question\":\"向南宫婉提出的具体问题\",\"reason\":\"为什么必须先问清\"}。",
        formatEvolutionCorpus(snapshots),
      ].join("\n\n"), state));
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
      const judgment = parseHanliJudgment(await askHanli([
        "你是韩立。请根据对话库证据和本次与南宫婉的逐轮交流判断是否足以确立一个可实施、可验收的演进专项。",
        "不能按固定分数判断；必须指出事实、未确认内容和本轮回答对方向的影响。",
        mustConclude ? `当前已到配置的第 ${maximum} 轮。证据足够时确立专题；仍不足时返回继续追问，但必须明确唯一缺口。` : "证据不足就继续追问，不能为了自动化而提前确立专题。",
        "继续时返回 JSON：{\"decision\":\"continue\",\"assessment\":\"判断\",\"nextQuestion\":\"下一问\",\"questionReason\":\"下一问依据\"}。",
        "确立时返回 JSON：{\"decision\":\"establish-topic\",\"assessment\":\"判断\",\"topic\":{\"title\":\"\",\"goal\":\"\",\"scope\":[\"\"],\"exclusions\":[\"\"],\"evidence\":[\"\"],\"acceptanceCriteria\":[\"\"],\"establishmentReason\":\"\"}}。",
        formatDeliberationContext(refreshed),
      ].join("\n\n"), state));
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
  async reviewOneShotProposal(proposal: EvolutionProposal): Promise<{ decision: "approved" | "rejected" | "supplement-required"; advice: string }> {
    const state = this.dependencies.store.state();
    const response = await this.dependencies.askHanli([
      "你是韩立，正在执行现有演化方向审批。用户只授权这一轮连续托管，没有授权跳过审批。",
      "请审查事实证据、影响范围、排除项、风险、回退方案和验收条件。材料足够且方向可执行时通过；缺少事实时退回补充；方向明显不成立时驳回。",
      "审批意见直接面向普通用户：先用自然语言说明哪里不完整或为什么可以通过，再明确需要补充什么或通过依据。不得把 disabled、aria-disabled、选择器、状态字段等代码术语直接堆在摘要中；确有必要时先解释其业务含义。只能引用提案、专题或源码调查中已经存在的事实，不得自行发明数量上限、页面规则或验收要求。",
      "仅返回 JSON：{\"decision\":\"approved|supplement-required|rejected\",\"advice\":\"具体审批依据或需要补充的内容\"}。",
      JSON.stringify({ proposal, topic: state.topics.find((item) => item.topicId === proposal.topicId) }),
    ].join("\n\n"), state);
    const value = parseJsonObject(response);
    const decision = value.decision;
    const advice = typeof value.advice === "string" ? value.advice.trim().slice(0, 8_000) : "";
    if (!("approved,rejected,supplement-required".split(",") as unknown[]).includes(decision) || !advice) throw new Error("韩立一次性方向审批缺少有效决定或具体意见。");
    return { decision: decision as "approved" | "rejected" | "supplement-required", advice };
  }

  /** 根据专题事实形成真实应用验收计划；只制定检查，不声称已经操作或通过。 */
  async createAcceptancePlan(
    topic: EvolutionState["topics"][number],
    proposal: EvolutionProposal,
    priorFindings: Record<string, unknown>[],
    requestPlan: (prompt: string, workspaceState: typeof topic.workspaceState, locale: typeof topic.locale) => Promise<string>,
  ): Promise<import("../../../../../contracts/collaboration/evolution/index.js").HanLiAcceptancePlan> {
    const response = await requestPlan(acceptancePlanningPrompt(topic, proposal, priorFindings), topic.workspaceState, topic.locale);
    return parseAcceptancePlan(response, topic.topicId, proposal.proposalId);
  }
}

function parseJsonObject(text: string): Record<string, unknown> { const candidate = text.match(/\{[\s\S]*\}/)?.[0]; if (!candidate) throw new Error("AI 没有返回可解析的结构化判断。 "); try { return JSON.parse(candidate) as Record<string, unknown>; } catch { throw new Error("AI 返回的结构化判断不是有效 JSON。 "); } }
function normalizeList(value: unknown): string[] { return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 100) : []; }
function parseHanliQuestion(text: string) { const value = parseJsonObject(text); const question = typeof value.question === "string" ? value.question.trim() : ""; const reason = typeof value.reason === "string" ? value.reason.trim() : ""; if (!question || !reason) throw new Error("韩立首轮问题缺少问题正文或发问依据。 "); return { question, reason }; }
function parseHanliJudgment(text: string): { assessment: string; nextQuestion: { question: string; reason: string } | null; candidate: HanLiTopicCandidate | null } { const value = parseJsonObject(text); const assessment = typeof value.assessment === "string" ? value.assessment.trim() : ""; if (!assessment) throw new Error("韩立研讨判断缺少事实说明。 "); if (value.decision === "establish-topic") { const topic = value.topic as Partial<HanLiTopicCandidate> | undefined; const candidate = topic && { title: typeof topic.title === "string" ? topic.title : "", goal: typeof topic.goal === "string" ? topic.goal : "", scope: normalizeList(topic.scope), exclusions: normalizeList(topic.exclusions), evidence: normalizeList(topic.evidence), acceptanceCriteria: normalizeList(topic.acceptanceCriteria), establishmentReason: typeof topic.establishmentReason === "string" ? topic.establishmentReason : assessment }; if (!candidate?.title || !candidate.goal || !candidate.scope.length || !candidate.evidence.length || !candidate.acceptanceCriteria.length) throw new Error("韩立确立的专题缺少范围、证据或验收条件。 "); return { assessment, nextQuestion: null, candidate }; } const question = typeof value.nextQuestion === "string" ? value.nextQuestion.trim() : ""; const reason = typeof value.questionReason === "string" ? value.questionReason.trim() : ""; if (!question || !reason) throw new Error("韩立决定继续研讨，但没有给出下一问和依据。 "); return { assessment, nextQuestion: { question, reason }, candidate: null }; }
function formatEvolutionCorpus(snapshots: EvolutionSourceMessageSnapshot[]): string { const groups = new Map<string, EvolutionSourceMessageSnapshot[]>(); for (const snapshot of snapshots) { const key = `${snapshot.source}:${snapshot.conversationId}`; groups.set(key, [...(groups.get(key) || []), snapshot]); } const newest = Math.max(...snapshots.map((item) => Date.parse(item.originalCreatedAt)).filter(Number.isFinite), 0); return [...groups.entries()].sort(([, left], [, right]) => latest(right) - latest(left)).map(([key, messages]) => [`会话组 ${key}（${maturity(newest, latest(messages))}）`, ...messages.sort((left, right) => left.sequenceNumber - right.sequenceNumber).map((item) => `[${item.originalCreatedAt}] ${item.role}${item.responsePhase ? `/${item.responsePhase}` : ""}：${item.content}`)].join("\n")).join("\n\n---\n\n"); }
function latest(messages: EvolutionSourceMessageSnapshot[]): number { return Math.max(...messages.map((item) => Date.parse(item.originalCreatedAt)).filter(Number.isFinite), 0); }
function maturity(newest: number, group: number): string { const days = Math.max(0, newest - group) / 86_400_000; return days <= 30 ? "近期高权重" : days <= 180 ? "中期参考" : "早期低权重，仅用于演变追溯"; }
function formatDeliberationContext(deliberation: HanLiEvolutionDeliberation): string { return [`研讨编号：${deliberation.deliberationId}`, ...deliberation.rounds.map((round) => [`第 ${round.roundNumber} 轮韩立问题：${round.question}`, `发问依据：${round.questionReason}`, round.answer ? `南宫婉原回答：${round.answer}` : "南宫婉尚未回答", round.assessment ? `韩立判断：${round.assessment}` : ""].filter(Boolean).join("\n"))].join("\n\n"); }

function acceptancePlanningPrompt(topic: EvolutionState["topics"][number], proposal: EvolutionProposal, priorFindings: Record<string, unknown>[]): string {
  return [
    "你是韩立，负责在令狐门禁完成后制定真实应用界面验收计划。只制定计划，不声称已打开应用或已经通过。",
    "必须从本次专题事实中理解用户关注点，并主动覆盖容易遗漏的交互细节：入口可达、按钮响应、状态切换、表格分页与滚动、弹窗或侧栏溢出、窗口缩放、键盘操作、加载/空态/错误态、数据写入与刷新一致性。不要机械复制固定清单；只保留与本专题有关的检查，并补充你根据界面影响合理推断的隐含检查。",
    "每项必须能在真实应用里执行并留下证据，不得用源码、构建成功或测试报告替代操作检查。若项目经验为空，不得编造历史经验。",
    `专题：${JSON.stringify({ title: topic.title, goal: topic.goal, scope: topic.scope, exclusions: topic.exclusions, evidence: topic.evidence, acceptanceCriteria: topic.acceptanceCriteria })}`,
    `提案：${JSON.stringify({ title: proposal.title, content: proposal.content, impactScope: proposal.impactScope, risks: proposal.risks, resultSummary: proposal.resultSummary })}`,
    `已验证项目经验：${JSON.stringify(priorFindings)}`,
    "operations 只能使用 focus-window、resize-window、click、scroll、press-key、inspect-text、capture；click 禁止删除、清空、提交审批、分发或验收通过等写动作。",
    "仅返回 JSON：{\"summary\":\"本次验收重点\",\"concerns\":[\"用户关注点\"],\"checks\":[{\"category\":\"类别\",\"target\":\"页面或控件\",\"action\":\"真实操作步骤\",\"expected\":\"可观察预期\",\"evidenceRequired\":\"证据\",\"operations\":[{\"type\":\"capture\",\"label\":\"初始状态\"}]}]}。checks 至少 2 项、最多 30 项。",
  ].join("\n\n");
}

function parseAcceptancePlan(text: string, topicId: string, proposalId: string): import("../../../../../contracts/collaboration/evolution/index.js").HanLiAcceptancePlan {
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

function parseAcceptanceOperation(raw: unknown): import("../../../../../contracts/collaboration/evolution/index.js").HanLiAcceptanceOperation[] {
  if (!raw || typeof raw !== "object") return [];
  const item = raw as Record<string, unknown>;
  if (item.type === "focus-window") return [{ type: "focus-window" }];
  if (item.type === "resize-window" && Number.isInteger(item.width) && Number.isInteger(item.height)) return [{ type: "resize-window", width: Number(item.width), height: Number(item.height) }];
  if (item.type === "click" && typeof item.target === "string" && item.target.trim()) return [{ type: "click", target: item.target.trim().slice(0, 200) }];
  if (item.type === "scroll" && typeof item.target === "string" && (item.direction === "up" || item.direction === "down") && Number.isFinite(item.amount)) return [{ type: "scroll", target: item.target.trim().slice(0, 200), direction: item.direction, amount: Math.max(40, Math.min(2_000, Math.round(Number(item.amount)))) }];
  if (item.type === "press-key" && ["Tab", "Enter", "Escape", "ArrowDown", "ArrowUp", "PageDown", "PageUp"].includes(String(item.key))) return [{ type: "press-key", target: typeof item.target === "string" ? item.target.trim().slice(0, 200) : undefined, key: item.key as "Tab" | "Enter" | "Escape" | "ArrowDown" | "ArrowUp" | "PageDown" | "PageUp" }];
  if (item.type === "inspect-text" && typeof item.text === "string" && item.text.trim()) return [{ type: "inspect-text", text: item.text.trim().slice(0, 500) }];
  if (item.type === "capture" && typeof item.label === "string" && item.label.trim()) return [{ type: "capture", label: item.label.trim().slice(0, 160) }];
  return [];
}
