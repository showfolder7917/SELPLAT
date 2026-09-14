import type { EvolutionProposalOutDto } from "../../../../contracts/services/evolution/index.js";

/**
 * 专题提案修订链的唯一解释器。
 *
 * 每个版本只保存它替代的直接前一版；流程恢复和异常归属都通过这里读取完整链，
 * 避免调用方只检查当前 proposalId 后丢失旧版本留下的真实卡点。
 */
export class ProposalRevisionChain {
  readonly #proposals: EvolutionProposalOutDto[];

  constructor(proposals: EvolutionProposalOutDto[]) {
    this.#proposals = proposals;
  }

  /** 返回指定版本及全部祖先，顺序从当前版本到最早版本；损坏的循环链会安全终止。 */
  lineageFrom(proposalId: string): EvolutionProposalOutDto[] {
    const lineage: EvolutionProposalOutDto[] = [];
    const visited = new Set<string>();
    let current = this.#proposals.find((proposal) => proposal.proposalId === proposalId);
    while (current && !visited.has(current.proposalId)) {
      lineage.push(current);
      visited.add(current.proposalId);
      current = current.supersedesProposalId
        ? this.#proposals.find((proposal) => proposal.proposalId === current!.supersedesProposalId)
        : undefined;
    }
    return lineage;
  }

  /** 返回同一修订链的末端版本；分叉时以最高版本为当前版本。 */
  currentFrom(proposalId: string): EvolutionProposalOutDto | undefined {
    let current = this.#proposals.find((proposal) => proposal.proposalId === proposalId);
    const visited = new Set<string>();
    while (current && !visited.has(current.proposalId)) {
      visited.add(current.proposalId);
      const successor = this.#proposals
        .filter((proposal) => proposal.supersedesProposalId === current!.proposalId)
        .sort((left, right) => left.version - right.version)
        .at(-1);
      if (!successor) return current;
      current = successor;
    }
    return undefined;
  }
}
