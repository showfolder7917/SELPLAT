
import { reviewDesignCoverage } from "../../domain/hanli-design-review.policy.js";
import { randomUUID } from "node:crypto";
import type { CollaborationMemoryPort } from "../../../../../../contracts/services/support/capabilities/event-center/index.js";
import type { EvolutionProposalOutDto, EvolutionStateOutDto } from "../../../../../../contracts/services/evolution/index.js";
import type { EvolutionStatePort } from "../../../../evolution/index.js";
import type { PromptLibraryPort } from "../../../../support/capabilities/prompts/index.js";
import type { HanliAcceptanceRunOutDto } from "../../../../../../contracts/services/personas/hanli/index.js";

export interface HanliDecisionDependencies {
  /** Evolution 权威状态读取端口。 */
  store: EvolutionStatePort;
  /** 受版本管理的提示词渲染端口。 */
  prompts: PromptLibraryPort;
  /** 韩立客户语义记忆；尚未接入时允许为空。 */
  memory: CollaborationMemoryPort | null;
  /** 调用韩立模型完成结构化提案判断。 */
  askHanli(prompt: string, state: EvolutionStateOutDto): Promise<string>;
  /** 调用隔离短会话完成结果验收，避免复用客户对话线程。 */
  askHanliResultAcceptance(prompt: string, state: EvolutionStateOutDto): Promise<string>;
  /** 返回当前稳定用户标识，隔离不同客户资料。 */
  readStableUserId(): string;
  /** 返回当前提案所属的工程语义范围。 */
  readProjectScope(state: EvolutionStateOutDto): string;
}

/** 韩立只保留提案判断与验收规划；旧的原始会话研讨状态机已经退役。 */
export class HanliDecisionService {
  /** 提案判断所需的全部只读状态与模型端口。 */
  readonly #dependencies: HanliDecisionDependencies;

  constructor(dependencies: HanliDecisionDependencies) {
    this.#dependencies = dependencies;
  }

  async reviewOneShotProposal(proposal: EvolutionProposalOutDto): Promise<{ decision: "approved" | "rejected" | "supplement-required"; advice: string }> {
    const state = this.#dependencies.store.state();
    let semanticContext: unknown = null;
    if (this.#dependencies.memory) {
      semanticContext = this.#dependencies.memory.readHanliSemanticContext(
        this.#dependencies.readStableUserId(),
        this.#dependencies.readProjectScope(state),
        proposal.title,
        12,
      );
    }
    const topic = state.topics.find((item) => item.topicId === proposal.topicId);
    const prompt = this.#dependencies.prompts.render("hanli.proposal-review", {
      proposalContextJson: JSON.stringify({ proposal, topic }),
      semanticContextJson: JSON.stringify(semanticContext),
    });
    const value = await this.#askForStructuredDecision(prompt, state);
    const decision = value.decision;
    let advice = "";
    if (typeof value.advice === "string") {
      advice = value.advice.trim().slice(0, 8_000);
    }
    const validDecisions: unknown[] = ["approved", "rejected", "supplement-required"];
    if (!validDecisions.includes(decision) || !advice) {
      throw new Error("韩立一次性方向审批缺少有效决定或具体意见。");
    }
    // 设计缺项属于方案补充，沿南宫婉原返修链处理，不能冒充模型故障交给令狐。
    const design = reviewDesignCoverage(value.designReview, {
      evidence: [...proposal.evidence, ...(topic?.evidence || [])],
      acceptanceCriteria: proposal.acceptanceCriteria,
    });
    if (decision === "approved" && !design.complete) {
      return { decision: "supplement-required", advice: `设计检查尚未完成，暂不指派执行。\n${design.notes}` };
    }
    return {
      decision: decision as "approved" | "rejected" | "supplement-required",
      advice: `${advice}\n\n韩立设计检查：\n${design.notes}`,
    };
  }

  /** 先按客户可感知页面判断验收类型；非页面任务由韩立只读核对代码是否满足原要求。 */
  async reviewResultAcceptance(proposal: EvolutionProposalOutDto, implementationEvidence: unknown): Promise<HanliAcceptanceRunOutDto> {
    const state = this.#dependencies.store.state();
    const topic = state.topics.find((item) => item.topicId === proposal.topicId);
    const criterionCatalog = proposal.acceptancePlan?.conditions.map(({ conditionId, criterion }) => ({ criterionId: conditionId, criterion }))
      || proposal.acceptanceCriteria.map((criterion, index) => ({ criterionId: `criterion-${index + 1}`, criterion }));
    const prompt = this.#dependencies.prompts.render("hanli.result-acceptance", {
      acceptanceContextJson: JSON.stringify({ topic, proposal, criterionCatalog, implementationEvidence }),
    });
    return this.#askForStructuredResult(prompt, state, (value) => this.#createResultAcceptanceReview(proposal, value));
  }

  /**
   * 将模型计划转换为可执行的验收路由；调用方必须通过 #askForStructuredResult 重试语义错误。
   * 这里同时校验页面条件和代码条件，避免 JSON 合法却无法进入正式窗口验收。
   */
  #createResultAcceptanceReview(proposal: EvolutionProposalOutDto, value: Record<string, unknown>): HanliAcceptanceRunOutDto {
    if (value.mode !== "code-conformance" && value.mode !== "mixed") {
      throw new Error("韩立没有返回有效的结果验收类型和逐项结论。");
    }
    const frozenPlan = proposal.acceptancePlan;
    const allCriterionIds = frozenPlan?.conditions.map((item) => item.conditionId) || proposal.acceptanceCriteria.map((_, index) => `criterion-${index + 1}`);
    // v2 已按正式页面只读边界冻结，后续复验继续消费同一分区，避免普通重试改写验收语义。
    // v1 冻结计划必须由应用层先行退役，禁止在这里恢复、升级或消费。
    if (frozenPlan?.version === 1) throw new Error("冻结的旧验收计划已退役，禁止恢复或继续消费。");
    const pageCriterionIdsValue = frozenPlan
      ? frozenPlan.conditions.filter((item) => item.evidenceType === "page-experience").map((item) => item.conditionId)
      : value.mode === "mixed" ? value.pageCriterionIds : [];
    const pageCriterionIdsResult = pageCriterionIdsValidationResult(pageCriterionIdsValue, allCriterionIds);
    if (!pageCriterionIdsResult.ok) {
      throw new Error(`韩立混合验收计划页面条件编号${pageCriterionIdsResult.error}。`);
    }
    // 只在通过类型和范围校验后向验收计划传递页面条件编号。
    const pageCriterionIds = pageCriterionIdsResult.pageCriterionIds;
    if (!frozenPlan && value.mode === "mixed" && pageCriterionIds.length === 0) {
      throw new Error("页面与源码审查必须至少包含一条可在正式页面检查的条件。");
    }
    if (!Array.isArray(value.findings)) {
      throw new Error("韩立代码符合性审查缺少逐项结论。");
    }
    const findings = value.findings as Array<Record<string, unknown>>;
    const codeCriterionIds = allCriterionIds.filter((criterionId) => !pageCriterionIds.includes(criterionId));
    if (findings.length !== codeCriterionIds.length) {
      throw new Error("韩立代码符合性审查没有与混合计划的剩余条件逐项对应。");
    }
    const steps = codeCriterionIds.map((criterionId, operationIndex) => {
      const index = allCriterionIds.indexOf(criterionId);
      const criterion = frozenPlan?.conditions[index]?.criterion || proposal.acceptanceCriteria[index];
      const finding = findings.find((item) => item.criterionId === criterionId);
      const status = finding?.status;
      const actual = typeof finding?.actual === "string" ? finding.actual.trim() : "";
      const references = Array.isArray(finding?.evidenceReferences)
        ? finding.evidenceReferences.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
        : [];
      if (!["passed", "failed", "blocked"].includes(String(status)) || !actual || references.length === 0) {
        throw new Error(`韩立源码审查缺少 ${criterionId} 的明确结论或源码依据。`);
      }
      return {
        checkId: criterionId,
        evidenceMode: "code-conformance" as const,
        operationIndex,
        operation: { type: "judgement" as const, criterionId },
        status: status as "passed" | "failed" | "blocked",
        actual: `${criterion}\n${actual}`,
        layoutStatus: "not-applicable" as const,
        layoutActual: "非页面任务，不执行布局验收。",
        layoutScreenshotAttachmentId: null,
        screenshotAttachmentId: null,
        evidenceReferences: references,
        occurredAt: new Date().toISOString(),
      };
    });
    const sourceReviewValue = value.sourceReview;
    if (!sourceReviewValue || typeof sourceReviewValue !== "object" || Array.isArray(sourceReviewValue)) {
      throw new Error("韩立缺少独立的源码结构与新手可读性审查结论。");
    }
    const sourceReviewRecord = sourceReviewValue as Record<string, unknown>;
    const sourceReviewStatus = sourceReviewRecord.status;
    const sourceReviewActual = typeof sourceReviewRecord.actual === "string" ? sourceReviewRecord.actual.trim() : "";
    const sourceReviewReferences = Array.isArray(sourceReviewRecord.evidenceReferences)
      ? sourceReviewRecord.evidenceReferences.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
      : [];
    if (!["passed", "failed", "blocked"].includes(String(sourceReviewStatus)) || !sourceReviewActual || !sourceReviewReferences.length) {
      throw new Error("韩立源码审查必须明确判断高内聚、低耦合和新手可读性，并引用实际源码位置。");
    }
    const status = steps.some((item) => item.status === "failed") || sourceReviewStatus === "failed" ? "failed"
      : steps.some((item) => item.status === "blocked") || sourceReviewStatus === "blocked" ? "blocked" : "passed";
    const now = new Date().toISOString();
    return {
      version: 3,
      mode: value.mode,
      runId: `hanli-code-review-${randomUUID()}`,
      topicId: proposal.topicId,
      proposalId: proposal.proposalId,
      criteria: [...proposal.acceptanceCriteria],
      ...(value.mode === "mixed" ? { pageCriterionIds } : {}),
      sourceReview: {
        status: sourceReviewStatus as "passed" | "failed" | "blocked",
        actual: sourceReviewActual,
        evidenceReferences: sourceReviewReferences,
      },
      status,
      windowTitle: value.mode === "mixed" ? "正式页面与源码审查" : "源码审查",
      initialBounds: { x: 0, y: 0, width: 0, height: 0 },
      finalBounds: { x: 0, y: 0, width: 0, height: 0 },
      interactionSteps: [],
      stepResults: steps,
      evidenceAttachmentIds: [],
      startedAt: now,
      completedAt: new Date().toISOString(),
    };
  }

  /** 韩立自己修正偶发的结构化输出错误；三次仍无效才交回统一异常中心。 */
  async #askForStructuredDecision(prompt: string, state: EvolutionStateOutDto): Promise<Record<string, unknown>> {
    let request = prompt;
    let lastError = "";
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const response = await this.#dependencies.askHanli(request, state);
      try {
        return parseJsonObject(response);
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        request = `${prompt}\n\n上一次回答无法处理：${lastError}\n请重新返回一个完整 JSON 对象，不要附加 Markdown。必须包含 decision、advice 和 designReview；decision 只能是 approved、rejected 或 supplement-required。`;
      }
    }
    throw new Error(`韩立连续 3 次未返回有效的结构化判断：${lastError}`);
  }

  /** 将 JSON 语法与调用方提供的语义校验放进同一轮重试，向模型返回可纠正的具体错误。 */
  async #askForStructuredResult<T>(prompt: string, state: EvolutionStateOutDto, validate: (value: Record<string, unknown>) => T): Promise<T> {
    let request = prompt;
    let lastError = "";
    let lastCandidateSummary = "";
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      lastCandidateSummary = "";
      const response = await this.#dependencies.askHanliResultAcceptance(request, state);
      try {
        const values = parseJsonObjects(response);
        // 仅保留协议形状，避免把模型原文或客户事实写入异常记录。
        lastCandidateSummary = summarizeResultAcceptanceCandidates(values);
        for (const value of values) {
          try { return validate(value); }
          catch (error) { lastError = error instanceof Error ? error.message : String(error); }
        }
        throw new Error(lastError || "AI 返回的结构化判断不符合结果验收约定。");
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        request = `${prompt}\n\n上一次结果无法处理：${lastError}。请按原始 criterion 编号修正页面与代码条件的完整分区。${resultAcceptanceRetryHint(lastError)}只返回符合约定的完整 JSON。`;
      }
    }
    const diagnostic = lastCandidateSummary ? `；${lastCandidateSummary}` : "";
    throw new Error(`韩立连续 3 次未返回有效的结果验收判断：${lastError}${diagnostic}`);
  }

}

/** 仅补足结果验收的歧义分类提示；语义校验仍是唯一允许放行的边界。 */
function resultAcceptanceRetryHint(lastError: string): string {
  if (lastError === "韩立代码符合性审查没有与混合计划的剩余条件逐项对应。") {
    return " acceptancePlan 已存在时必须保持其 evidenceType 分区；findings 逐项覆盖计划内全部 code-conformance 条件，不得用新 pageCriterionIds 排除冻结的代码条件。";
  }
  if (lastError === "页面与源码审查必须至少包含一条可在正式页面检查的条件。") {
    return " mixed 的 pageCriterionIds 必须列出至少一条正式页面条件；纯源码任务改为 code-conformance。";
  }
  if (lastError.startsWith("韩立混合验收计划页面条件编号")) {
    return " mixed 的 pageCriterionIds 必须是非空数组；移除非字符串项、重复项和当前条件外编号；findings 只覆盖其余条件。";
  }
  if (lastError === "韩立没有返回有效的结果验收类型和逐项结论。") {
    return " mode 只能是 code-conformance 或 mixed：页面相关任务返回 mixed 和页面编号；纯源码任务返回 code-conformance。两种方式都必须返回 sourceReview。";
  }
  return "";
}

/** 只输出固定状态和计数，让运行故障可定位且不泄露模型原文或客户证据。 */
function summarizeResultAcceptanceCandidates(values: Record<string, unknown>[]): string {
  const candidates = values.slice(0, 3).map((value) => {
    const mode = value.mode === "page-experience" || value.mode === "code-conformance" || value.mode === "mixed"
      ? "supported"
      : typeof value.mode === "string" ? "unsupported" : "missing";
    const findings = Array.isArray(value.findings)
      ? `array:${value.findings.length}`
      : value.findings === undefined ? "missing" : "invalid";
    // 只记录页面编号字段的形状，帮助区分混合分区错误且不泄露条件内容。
    const pageCriterionIds = Array.isArray(value.pageCriterionIds)
      ? pageCriterionIdsSummary(value.pageCriterionIds)
      : value.pageCriterionIds === undefined ? "missing" : "invalid";
    return `mode=${mode},pageCriterionIds=${pageCriterionIds},findings=${findings}`;
  });
  return `结构化候选摘要：count=${values.length}; ${candidates.join("|")}`;
}

/** 校验混合验收页面编号，成功时返回已收窄的数组，失败时只返回脱敏原因。 */
function pageCriterionIdsValidationResult(value: unknown, allCriterionIds: string[])
  : { ok: true; pageCriterionIds: string[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) return { ok: false, error: "必须是数组" };
  if (value.some((item) => typeof item !== "string")) return { ok: false, error: "包含非字符串项" };
  const pageCriterionIds = value as string[];
  if (new Set(pageCriterionIds).size !== pageCriterionIds.length) return { ok: false, error: "存在重复项" };
  if (pageCriterionIds.some((item) => !allCriterionIds.includes(item))) return { ok: false, error: "包含当前条件外编号" };
  return { ok: true, pageCriterionIds };
}

/** 汇总数组形状而不记录实际编号，便于定位模型格式偏差。 */
function pageCriterionIdsSummary(value: unknown[]): string {
  const stringIds = value.filter((item): item is string => typeof item === "string");
  const duplicate = new Set(stringIds).size !== stringIds.length ? "yes" : "no";
  const nonString = stringIds.length !== value.length ? "yes" : "no";
  return `array:${value.length},duplicate=${duplicate},nonString=${nonString}`;
}

function parseJsonObject(text: string): Record<string, unknown> {
  return parseJsonObjects(text)[0];
}

/** 分别解析模型回答中的完整对象，避免首尾贪婪匹配把说明文字和相邻对象拼成无效 JSON。 */
function parseJsonObjects(text: string): Record<string, unknown>[] {
  const { candidates, hasUnclosedObject } = extractBalancedJsonObjects(text);
  const values = candidates.flatMap((candidate): Record<string, unknown>[] => {
    try {
      const value = JSON.parse(candidate);
      return value && typeof value === "object" && !Array.isArray(value) ? [value as Record<string, unknown>] : [];
    } catch { return []; }
  });
  if (!values.length) {
    if (!candidates.length && !hasUnclosedObject) throw new Error("AI 没有返回可解析的结构化判断。");
    throw new Error("AI 返回的结构化判断不是有效 JSON。");
  }
  return values;
}

/** 提取顶层、转义安全的对象候选，允许模型在 JSON 前后补充说明。 */
function extractBalancedJsonObjects(text: string): { candidates: string[]; hasUnclosedObject: boolean } {
  const trimmed = text.trim();
  if (!trimmed) return { candidates: [], hasUnclosedObject: false };
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/iu)?.[1]?.trim();
  const source = fenced || trimmed;
  const candidates: string[] = [];
  let start = -1;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') {
      quoted = true;
      continue;
    }
    if (character === "{") {
      // 只从顶层对象起点开始，避免 findings 等嵌套对象覆盖外层验收结论。
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }
    if (character === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(source.slice(start, index + 1));
        start = -1;
      }
    }
  }
  return { candidates: [...new Set(candidates)], hasUnclosedObject: depth !== 0 };
}
