/** 韩立语义提取写入协议；由受控 AI 分析器生产，事件记忆服务校验后持久化。 */
import type { HanliConcernStatusValue, HanliRequirementNodeStatusValue } from "./hanli-semantic-memory.out.dto.js";

export interface HanliSemanticExtractionInDto {
  concerns: Array<{
    semanticKey: string;
    name: string;
    description: string;
    category: string;
    scopeType: "global" | "system-type" | "project" | "module" | "page";
    scopeId: string | null;
    status: HanliConcernStatusValue;
    confidence: number;
    weight: number;
    evidence: Array<{
      sourceMessageId: string;
      evidenceType: "explicit" | "correction" | "rejection" | "choice" | "acceptance" | "inference";
      stance: "supporting" | "counterexample" | "changed";
      evidenceExcerpt: string;
    }>;
  }>;
  trajectory: {
    customerGoal: string;
    confirmedFacts: string[];
    assumptions: string[];
    conflicts: string[];
    informationGaps: string[];
    implicitRequirements: string[];
    selectedAction: "answer" | "investigate" | "ask" | "offer-options" | "execute" | "accept-and-correct";
    questionAsked: string | null;
    questionReason: string | null;
    customerAnswer: string | null;
    resultSummary: string | null;
    evolutionDirection: string | null;
    acceptanceEvidence: string[];
    maturityScore: number;
    nodes: Array<{
      nodeKey: string;
      parentNodeKey: string | null;
      title: string;
      category: string;
      status: HanliRequirementNodeStatusValue;
      statement: string;
      critical: boolean;
      evidenceMessageIds: string[];
    }>;
  };
}
