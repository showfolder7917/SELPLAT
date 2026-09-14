
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
    const value = await this.#askForStructuredResult(prompt, state);
    if (value.mode === "page-experience") return "page-experience";
    if (value.mode !== "code-conformance" || !Array.isArray(value.findings)) {
      throw new Error("韩立没有返回有效的结果验收类型和逐项结论。");
    }
    const findings = value.findings as Array<Record<string, unknown>>;
    const steps = proposal.acceptanceCriteria.map((criterion, index) => {
      const finding = findings.find((item) => item.criterionId === `criterion-${index + 1}`);
      const status = finding?.status;
      const actual = typeof finding?.actual === "string" ? finding.actual.trim() : "";
      const references = Array.isArray(finding?.evidenceReferences)
        ? finding.evidenceReferences.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
        : [];
      if (!["passed", "failed", "blocked"].includes(String(status)) || !actual || references.length === 0) {
        throw new Error(`韩立代码符合性审查缺少 criterion-${index + 1} 的明确结论或代码/测试依据。`);
      }
      return {
        checkId: `criterion-${index + 1}`,
        operationIndex: index,
        operation: { type: "judgement" as const, criterionId: `criterion-${index + 1}` },
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
      mode: "code-conformance",
      runId: `hanli-code-review-${randomUUID()}`,
      topicId: proposal.topicId,
      proposalId: proposal.proposalId,
      criteria: [...proposal.acceptanceCriteria],
      status,
      windowTitle: "代码符合性审查",
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

  async #askForStructuredResult(prompt: string, state: EvolutionStateOutDto): Promise<Record<string, unknown>> {
    let request = prompt;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const response = await this.#dependencies.askHanli(request, state);
      try { return parseJsonObject(response); }
      catch (error) {
        request = `${prompt}\n\n上一次结果无法处理：${error instanceof Error ? error.message : String(error)}。请只返回符合约定的完整 JSON。`;
      }
    }
    throw new Error("韩立连续 3 次未返回有效的结果验收判断。");
  }

}

function parseJsonObject(text: string): Record<string, unknown> {
  const candidate = text.match(/\{[\s\S]*\}/u)?.[0];
  if (!candidate) {
    throw new Error("AI 没有返回可解析的结构化判断。");
  }
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    throw new Error("AI 返回的结构化判断不是有效 JSON。");
  }
}
