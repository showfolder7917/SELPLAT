
import type { CollaborationMemoryPort } from "../../../../../contracts/services/support/capabilities/event-center/index.js";
import type { EvolutionProposalOutDto, EvolutionStateOutDto } from "../../../../../contracts/services/evolution/index.js";
import type { EvolutionStatePort } from "../../../evolution/index.js";
import type { PromptLibraryPort } from "../../../support/capabilities/prompts/index.js";

export interface HanliDecisionDependencies {
  store: EvolutionStatePort;
  prompts: PromptLibraryPort;
  memory: CollaborationMemoryPort | null;
  askHanli(prompt: string, state: EvolutionStateOutDto): Promise<string>;
  readStableUserId(): string;
  readProjectScope(state: EvolutionStateOutDto): string;
}

/** 韩立只保留提案判断与验收规划；旧的原始会话研讨状态机已经退役。 */
export class HanliDecisionService {
  constructor(private readonly dependencies: HanliDecisionDependencies) {}

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

}

function parseJsonObject(text: string): Record<string, unknown> {
  const candidate = text.match(/\{[\s\S]*\}/u)?.[0];
  if (!candidate) throw new Error("AI 没有返回可解析的结构化判断。");
  try { return JSON.parse(candidate) as Record<string, unknown>; }
  catch { throw new Error("AI 返回的结构化判断不是有效 JSON。"); }
}
