/** 事件中心对人物与页面公开的记忆查询结果。 */
import type { EvolutionProposalOriginValue, EvolutionProposalTypeValue } from "../../../../evolution/index.js";

export interface CollaborationMemoryMessageOutDto {
  messageId: string;
  conversationId: string;
  sequenceNumber: number;
  role: "user" | "nangong";
  content: string;
  contentPreview: string;
  inferredIntent: string | null;
  createdAt: string;
}

export interface ApprovalMemoryEvidenceOutDto {
  approvalId: string;
  proposalType: EvolutionProposalTypeValue;
  origin: EvolutionProposalOriginValue;
  decision: "approved" | "rejected" | "supplement-required";
  advice: string;
  approvedAt: string;
}

export interface TrainingCorpusTopicSearchResultOutDto {
  corpusTopicId: string;
  /** codex 或稳定人物来源标识；不枚举人物，新增人物无需修改协议。 */
  source: string;
  title: string;
  topicType: string;
  inferredIntent: string | null;
  tags: string[];
  definitionSource: "pending" | "ai-confirmed";
  createdAt: string;
  messages: Array<{ speakerRole: string; content: string; createdAt: string }>;
}
