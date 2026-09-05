
import type { CollaborationMemoryPort } from "../../../../../../contracts/services/support/capabilities/event-center/index.js";
import type { EvolutionProposalOutDto, EvolutionStateOutDto } from "../../../../../../contracts/services/evolution/index.js";
import type { EvolutionStatePort } from "../../../../evolution/index.js";
import type { PromptLibraryPort } from "../../../../support/capabilities/prompts/index.js";

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
    const response = await this.#dependencies.askHanli(prompt, state);
    const value = parseJsonObject(response);
    const decision = value.decision;
    let advice = "";
    if (typeof value.advice === "string") {
      advice = value.advice.trim().slice(0, 8_000);
    }
    const validDecisions: unknown[] = ["approved", "rejected", "supplement-required"];
    if (!validDecisions.includes(decision) || !advice) {
      throw new Error("韩立一次性方向审批缺少有效决定或具体意见。");
    }
    return { decision: decision as "approved" | "rejected" | "supplement-required", advice };
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
