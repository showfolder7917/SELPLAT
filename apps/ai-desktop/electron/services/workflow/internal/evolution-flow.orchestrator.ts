import type { EvolutionProposalOutDto, EvolutionStateOutDto } from "../../../../contracts/services/evolution/index.js";

export type EvolutionFlowAction = "await-approval" | "supplement" | "dispatch" | "monitor-execution" | "accept-result" | "complete" | "idle";

/** 流程编排只根据已保存事实产生下一条命令，不自己审批、分发或写时间线。 */
export class EvolutionFlowOrchestrator {
  next(proposal: EvolutionProposalOutDto): EvolutionFlowAction {
    if (proposal.status === "pending-approval") return "await-approval";
    if (proposal.status === "supplement-required" || proposal.status === "rejected") return "supplement";
    if (proposal.status === "approved" && proposal.distributedTaskIds.length === 0) return "dispatch";
    if (["executing", "verifying", "blocked"].includes(proposal.status)) return "monitor-execution";
    if (proposal.status === "pending-acceptance") return "accept-result";
    if (proposal.status === "completed") return "complete";
    return "idle";
  }

  automaticApprovalQueue(state: EvolutionStateOutDto): EvolutionProposalOutDto[] {
    return state.proposals.filter((proposal) => this.next(proposal) === "await-approval" && (proposal.origin === "nangong" ? state.automaticNangongApprovalEnabled : state.automaticLinghuApprovalEnabled));
  }

  automaticDistributionQueue(state: EvolutionStateOutDto): EvolutionProposalOutDto[] {
    return state.proposals.filter((proposal) => this.next(proposal) === "dispatch" && (proposal.origin === "linghu" || state.automaticExecutionEnabled));
  }
}
