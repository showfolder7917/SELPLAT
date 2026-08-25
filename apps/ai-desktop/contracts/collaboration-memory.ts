import type { EvolutionProposalOrigin, EvolutionProposalType, NangongConversation, NangongEvolutionState } from "./nangong-evolution.js";

export interface CollaborationMemoryMessage {
  messageId: string;
  conversationId: string;
  sequenceNumber: number;
  role: "user" | "nangong";
  content: string;
  contentPreview: string;
  inferredIntent: string | null;
  createdAt: string;
}

export interface ConversationRoundTopicDecision {
  title: string;
  type: string;
  switchTopic: boolean;
  userIntent: string;
}

export interface ApprovalMemoryEvidence {
  approvalId: string;
  proposalType: EvolutionProposalType;
  origin: EvolutionProposalOrigin;
  decision: "approved" | "rejected" | "supplement-required";
  advice: string;
  approvedAt: string;
}

export interface CollaborationMemoryPort {
  syncConversation(conversation: NangongConversation): void;
  syncEvolutionState(state: NangongEvolutionState): void;
  buildNangongContext(conversation: NangongConversation): string;
  approvalEvidence(proposalType: EvolutionProposalType, origin: EvolutionProposalOrigin): ApprovalMemoryEvidence[];
  registerRound(conversation: NangongConversation, userMessageId: string, nangongMessageId: string, decision: ConversationRoundTopicDecision): void;
}
