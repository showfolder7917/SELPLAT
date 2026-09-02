import type {
  CollaborationMemoryPort,
  HanliCorpusExtractionCandidateOutDto,
  HanliSemanticExtractionInDto,
} from "../../../../../contracts/services/support/capabilities/event-center/index.js";
import type { PromptLibraryPort } from "../../../support/capabilities/prompts/index.js";

const EXTRACTOR_VERSION = "hanli-autonomous-analysis-v1";
const PERIODIC_REFRESH_MILLISECONDS = 5 * 60_000;

export interface HanliSemanticExtractionRunnerOptions {
  memory: CollaborationMemoryPort | null;
  prompts: PromptLibraryPort;
  analyze(prompt: string): Promise<string>;
  readStableUserId(): string;
  readProjectScope(): string;
  recordEvent(type: string, details: Record<string, unknown>): void;
}

/** 后台增量整理训练语料；启动和每轮触发均立即返回，不阻塞人物对话。 */
export class HanliSemanticExtractionRunner {
  #running: Promise<void> | null = null;
  #requested = false;
  #timer: NodeJS.Timeout | null = null;
  #stopped = true;
  #claimedCandidates: HanliCorpusExtractionCandidateOutDto[] = [];

  constructor(private readonly options: HanliSemanticExtractionRunnerOptions) {}

  /** 启动时异步整理一次，并以低频兜底扫描处理应用关闭期间积累的语料。 */
  start(): void {
    if (this.#timer) return;
    this.#stopped = false;
    this.trigger("startup");
    this.#timer = setInterval(() => this.trigger("periodic"), PERIODIC_REFRESH_MILLISECONDS);
    this.#timer.unref();
  }

  /** 停止后不再领取新语料；已经进入数据库事务的当前写入保持原子完成。 */
  stop(): void {
    this.#stopped = true;
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
    this.#requested = false;
    this.#releaseClaims(new Error("应用正在关闭，韩立语义提取将在下次启动继续。"));
  }

  /** 合并并发触发，只保留一次补跑，避免同一进程建立多个模型分析循环。 */
  trigger(reason: "startup" | "corpus-ingested" | "periodic"): void {
    if (!this.options.memory) return;
    if (this.#running) {
      this.#requested = true;
      return;
    }
    this.#running = this.#run(reason).catch((error) => {
      this.#releaseClaims(error);
      this.options.recordEvent("hanli.semantic_extraction.failed", { reason, message: error instanceof Error ? error.message : String(error) });
    }).finally(() => {
      this.#running = null;
      if (this.#requested) {
        this.#requested = false;
        this.trigger("corpus-ingested");
      }
    });
  }

  async #run(reason: string): Promise<void> {
    const memory = this.options.memory;
    if (!memory) return;
    let stableUserId: string;
    let projectScope: string;
    try {
      stableUserId = this.options.readStableUserId();
      projectScope = this.options.readProjectScope();
    } catch (error) {
      this.options.recordEvent("hanli.semantic_extraction.skipped", { reason, message: error instanceof Error ? error.message : String(error) });
      return;
    }
    const candidates = memory.claimHanliCorpusExtractions(stableUserId, projectScope, EXTRACTOR_VERSION, 4);
    this.#claimedCandidates = candidates;
    for (const candidate of candidates) {
      if (this.#stopped) return;
      try {
        const prompt = this.options.prompts.render("support.hanli-semantic-extraction", {
          payloadJson: JSON.stringify(candidateForAnalysis(candidate)),
        });
        const analyzed = await this.options.analyze(prompt);
        if (this.#stopped) return;
        const result = parseHanliSemanticExtraction(analyzed, candidate);
        memory.completeHanliCorpusExtraction(candidate, result);
        this.#forgetClaim(candidate.extractionId);
        this.options.recordEvent("hanli.semantic_extraction.completed", {
          reason, extractionId: candidate.extractionId, corpusTopicId: candidate.corpusTopicId,
          concernCount: result.concerns.length, requirementNodeCount: result.trajectory.nodes.length,
        });
      } catch (error) {
        if (this.#stopped) return;
        memory.failHanliCorpusExtraction(candidate, error);
        this.#forgetClaim(candidate.extractionId);
        this.options.recordEvent("hanli.semantic_extraction.failed", {
          reason, extractionId: candidate.extractionId, corpusTopicId: candidate.corpusTopicId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  #forgetClaim(extractionId: string): void {
    this.#claimedCandidates = this.#claimedCandidates.filter((candidate) => candidate.extractionId !== extractionId);
  }

  #releaseClaims(error: unknown): void {
    const memory = this.options.memory;
    const candidates = this.#claimedCandidates;
    this.#claimedCandidates = [];
    if (!memory) return;
    for (const candidate of candidates) {
      try { memory.failHanliCorpusExtraction(candidate, error); } catch { /* SQLite 已关闭时由下次启动的租约恢复。 */ }
    }
  }
}

/** 严格解析派生认知；任何无证据消息 ID、未知状态或越界分数都会使本轮进入可重试失败。 */
export function parseHanliSemanticExtraction(text: string, candidate: HanliCorpusExtractionCandidateOutDto): HanliSemanticExtractionInDto {
  const normalized = text.trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "");
  const root = asObject(JSON.parse(normalized));
  const messageIds = new Set(candidate.messages.map((message) => message.sourceMessageId));
  const concerns = array(root.concerns, "concerns").slice(0, 20).map((entry) => {
    const item = asObject(entry);
    const scopeType = enumValue(item.scopeType, ["global", "system-type", "project", "module", "page"] as const, "scopeType");
    return {
      semanticKey: requiredText(item.semanticKey, "semanticKey", 160),
      name: requiredText(item.name, "name", 160), description: requiredText(item.description, "description", 2_000),
      category: requiredText(item.category, "category", 120), scopeType,
      scopeId: scopeType === "global" ? null : optionalText(item.scopeId, 1_000) || candidate.projectScope,
      status: enumValue(item.status, ["candidate", "confirmed", "conflicted", "changed", "invalid"] as const, "status"),
      confidence: score(item.confidence, "confidence"), weight: score(item.weight, "weight"),
      evidence: array(item.evidence, "evidence").slice(0, 20).map((raw) => {
        const evidence = asObject(raw);
        const sourceMessageId = requiredText(evidence.sourceMessageId, "sourceMessageId", 300);
        if (!messageIds.has(sourceMessageId)) throw new Error(`关注点引用了当前语料之外的消息：${sourceMessageId}`);
        return {
          sourceMessageId,
          evidenceType: enumValue(evidence.evidenceType, ["explicit", "correction", "rejection", "choice", "acceptance", "inference"] as const, "evidenceType"),
          stance: enumValue(evidence.stance, ["supporting", "counterexample", "changed"] as const, "stance"),
          evidenceExcerpt: requiredText(evidence.evidenceExcerpt, "evidenceExcerpt", 600),
        };
      }),
    };
  });
  const trajectory = asObject(root.trajectory);
  const nodes = array(trajectory.nodes, "trajectory.nodes").slice(0, 80).map((raw) => {
    const node = asObject(raw);
    const evidenceMessageIds = stringArray(node.evidenceMessageIds, "evidenceMessageIds", 40, 300);
    for (const messageId of evidenceMessageIds) if (!messageIds.has(messageId)) throw new Error(`需求节点引用了当前语料之外的消息：${messageId}`);
    return {
      nodeKey: requiredText(node.nodeKey, "nodeKey", 160), parentNodeKey: optionalText(node.parentNodeKey, 160),
      title: requiredText(node.title, "title", 240), category: requiredText(node.category, "category", 120),
      status: enumValue(node.status, ["confirmed", "investigate", "inferred", "conflicted", "waiting-customer", "implemented-pending-acceptance", "accepted"] as const, "node.status"),
      statement: requiredText(node.statement, "statement", 3_000), critical: Boolean(node.critical), evidenceMessageIds,
    };
  });
  return {
    concerns,
    trajectory: {
      customerGoal: requiredText(trajectory.customerGoal, "customerGoal", 2_000),
      confirmedFacts: stringArray(trajectory.confirmedFacts, "confirmedFacts"), assumptions: stringArray(trajectory.assumptions, "assumptions"),
      conflicts: stringArray(trajectory.conflicts, "conflicts"), informationGaps: stringArray(trajectory.informationGaps, "informationGaps"),
      implicitRequirements: stringArray(trajectory.implicitRequirements, "implicitRequirements"),
      selectedAction: enumValue(trajectory.selectedAction, ["answer", "investigate", "ask", "offer-options", "execute", "accept-and-correct"] as const, "selectedAction"),
      questionAsked: optionalText(trajectory.questionAsked, 1_000), questionReason: optionalText(trajectory.questionReason, 2_000),
      customerAnswer: optionalText(trajectory.customerAnswer, 4_000), resultSummary: optionalText(trajectory.resultSummary, 4_000),
      evolutionDirection: optionalText(trajectory.evolutionDirection, 2_000), acceptanceEvidence: stringArray(trajectory.acceptanceEvidence, "acceptanceEvidence"),
      maturityScore: score(trajectory.maturityScore, "maturityScore"), nodes,
    },
  };
}

function candidateForAnalysis(candidate: HanliCorpusExtractionCandidateOutDto) {
  return {
    corpusTopicId: candidate.corpusTopicId, projectScope: candidate.projectScope, source: candidate.source,
    title: candidate.title, topicType: candidate.topicType, inferredIntent: candidate.inferredIntent, tags: candidate.tags,
    messages: candidate.messages, existingConcerns: candidate.existingConcerns.map((concern) => ({
      concernId: concern.concernId, semanticKey: concern.semanticKey, name: concern.name, description: concern.description,
      scopeType: concern.scopeType, scopeId: concern.scopeId, status: concern.status,
    })),
  };
}

function asObject(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("韩立语义提取返回值必须是 JSON 对象。"); return value as Record<string, unknown>; }
function array(value: unknown, field: string): unknown[] { if (!Array.isArray(value)) throw new Error(`韩立语义提取缺少数组字段 ${field}。`); return value; }
function requiredText(value: unknown, field: string, maximum = 2_000): string { const text = typeof value === "string" ? value.trim() : ""; if (!text || Array.from(text).length > maximum) throw new Error(`韩立语义提取字段 ${field} 为空或超长。`); return text; }
function optionalText(value: unknown, maximum: number): string | null { if (value === null || value === undefined || value === "") return null; return requiredText(value, "optional", maximum); }
function score(value: unknown, field: string): number { const number = Number(value); if (!Number.isFinite(number) || number < 0 || number > 1) throw new Error(`韩立语义提取字段 ${field} 必须在 0 到 1。`); return number; }
function enumValue<const Values extends readonly string[]>(value: unknown, values: Values, field: string): Values[number] { if (typeof value !== "string" || !values.includes(value)) throw new Error(`韩立语义提取字段 ${field} 含未知值。`); return value as Values[number]; }
function stringArray(value: unknown, field: string, maximumItems = 100, maximumText = 2_000): string[] { return array(value, field).slice(0, maximumItems).map((item) => requiredText(item, field, maximumText)); }
