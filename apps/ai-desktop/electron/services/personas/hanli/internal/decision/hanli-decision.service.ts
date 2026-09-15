
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
  async reviewResultAcceptance(proposal: EvolutionProposalOutDto, implementationEvidence: unknown): Promise<"page-experience" | HanliAcceptanceRunOutDto> {
    const state = this.#dependencies.store.state();
    const topic = state.topics.find((item) => item.topicId === proposal.topicId);
    const prompt = this.#dependencies.prompts.render("hanli.result-acceptance", {
      acceptanceContextJson: JSON.stringify({ topic, proposal, implementationEvidence }),
    });
    return this.#askForStructuredResult(prompt, state, (value) => this.#createResultAcceptanceReview(proposal, value));
  }

  /**
   * 将模型计划转换为可执行的验收路由；调用方必须通过 #askForStructuredResult 重试语义错误。
   * 这里同时校验页面条件和代码条件，避免 JSON 合法却无法进入正式窗口验收。
   */
  #createResultAcceptanceReview(proposal: EvolutionProposalOutDto, value: Record<string, unknown>): "page-experience" | HanliAcceptanceRunOutDto {
    if (value.mode === "page-experience") {
      const frozenPlan = proposal.acceptancePlan;
      if (frozenPlan && frozenPlan.conditions.some((item) => item.evidenceType !== "page-experience")) {
        throw new Error("韩立不能在已冻结验收计划后把代码条件改判为页面条件。 ");
      }
      return "page-experience";
    }
    if (value.mode !== "code-conformance" && value.mode !== "mixed") {
      throw new Error("韩立没有返回有效的结果验收类型和逐项结论。");
    }
    const frozenPlan = proposal.acceptancePlan;
    const allCriterionIds = frozenPlan?.conditions.map((item) => item.conditionId) || proposal.acceptanceCriteria.map((_, index) => `criterion-${index + 1}`);
    const pageCriterionIds = frozenPlan
      ? frozenPlan.conditions.filter((item) => item.evidenceType === "page-experience").map((item) => item.conditionId)
      : value.mode === "mixed" ? value.pageCriterionIds : [];
    if (!Array.isArray(pageCriterionIds)
      || pageCriterionIds.some((item) => typeof item !== "string")
      || new Set(pageCriterionIds).size !== pageCriterionIds.length
      || pageCriterionIds.some((item) => !allCriterionIds.includes(item))) {
      throw new Error("韩立混合验收计划缺少有效且不重复的页面条件编号。");
    }
    if (!frozenPlan && value.mode === "mixed" && (pageCriterionIds.length === 0 || pageCriterionIds.length === allCriterionIds.length)) {
      throw new Error("混合验收必须同时包含页面条件和代码符合性条件。");
    }
    // 此分支已排除 page-experience；若冻结计划全是页面条件，模型必须走上方的页面验收入口。
    if (frozenPlan && pageCriterionIds.length === allCriterionIds.length) {
      throw new Error("韩立不能在已冻结验收计划后重新改变页面与代码证据分类。 ");
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
        throw new Error(`韩立代码符合性审查缺少 ${criterionId} 的明确结论或代码/测试依据。`);
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
    const status = steps.some((item) => item.status === "failed") ? "failed"
      : steps.some((item) => item.status === "blocked") ? "blocked" : "passed";
    const now = new Date().toISOString();
    return {
      version: 3,
      mode: value.mode,
      runId: `hanli-code-review-${randomUUID()}`,
      topicId: proposal.topicId,
      proposalId: proposal.proposalId,
      criteria: [...proposal.acceptanceCriteria],
      ...(value.mode === "mixed" ? { pageCriterionIds } : {}),
      status,
      windowTitle: value.mode === "mixed" ? "混合验收代码符合性审查" : "代码符合性审查",
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
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const response = await this.#dependencies.askHanli(request, state);
      try {
        const values = parseJsonObjects(response);
        for (const value of values) {
          try { return validate(value); }
          catch (error) { lastError = error instanceof Error ? error.message : String(error); }
        }
        throw new Error(lastError || "AI 返回的结构化判断不符合结果验收约定。");
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        request = `${prompt}\n\n上一次结果无法处理：${lastError}。请按原始 criterion 编号修正页面与代码条件的完整分区，只返回符合约定的完整 JSON。`;
      }
    }
    throw new Error(`韩立连续 3 次未返回有效的结果验收判断：${lastError}`);
  }

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

/** 提取独立、转义安全的对象候选，允许模型在 JSON 前后补充说明。 */
function extractBalancedJsonObjects(text: string): { candidates: string[]; hasUnclosedObject: boolean } {
  const trimmed = text.trim();
  if (!trimmed) return { candidates: [], hasUnclosedObject: false };
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/iu)?.[1]?.trim();
  const source = fenced || trimmed;
  const candidates: string[] = [];
  let hasUnclosedObject = false;
  for (let start = 0; start < source.length; start += 1) {
    if (source[start] !== "{") continue;
    let depth = 0;
    let quoted = false;
    let escaped = false;
    let closed = false;
    for (let index = start; index < source.length; index += 1) {
      const character = source[index];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') quoted = false;
        continue;
      }
      if (character === '"') quoted = true;
      else if (character === "{") depth += 1;
      else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          candidates.push(source.slice(start, index + 1));
          closed = true;
          break;
        }
      }
    }
    if (!closed) hasUnclosedObject = true;
  }
  return { candidates: [...new Set(candidates)], hasUnclosedObject };
}
