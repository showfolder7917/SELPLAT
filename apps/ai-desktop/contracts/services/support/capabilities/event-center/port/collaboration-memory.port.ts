/** 事件中心向人物业务提供的最小记忆行为接口。 */
import type { EvolutionProposalOriginValue, EvolutionProposalTypeValue, EvolutionSourceMessageSnapshotOutDto, EvolutionStateOutDto } from "../../../../evolution/index.js";
import type { NangongConversationOutDto } from "../../../../personas/nangong/index.js";
import type { ApprovalMemoryEvidenceOutDto, TrainingCorpusTopicSearchResultOutDto } from "../dto/collaboration-memory.out.dto.js";
import type { ConversationRoundTopicDecisionInDto } from "../dto/conversation-round-topic-decision.in.dto.js";
import type { HanliSemanticExtractionInDto } from "../dto/hanli-semantic-extraction.in.dto.js";
import type { HanliCorpusExtractionCandidateOutDto, HanliSemanticContextOutDto } from "../dto/hanli-semantic-memory.out.dto.js";
import type { HanliAcceptanceExperienceCandidateOutDto, HanliConversationOutDto } from "../../../../personas/hanli/index.js";

export interface CollaborationMemoryPort {
  syncConversation(conversation: NangongConversationOutDto): void;
  syncEvolutionState(state: EvolutionStateOutDto): void;
  buildNangongContext(conversation: NangongConversationOutDto): string;
  approvalEvidence(proposalType: EvolutionProposalTypeValue, origin: EvolutionProposalOriginValue): ApprovalMemoryEvidenceOutDto[];
  searchTrainingCorpusTopics(query: string, limit?: number): TrainingCorpusTopicSearchResultOutDto[];
  readHanLiEvolutionCorpus(deliberationId: string, anchorHanliConversationId?: string | null): EvolutionSourceMessageSnapshotOutDto[];
  registerRound(conversation: NangongConversationOutDto, userMessageId: string, nangongMessageId: string, decision: ConversationRoundTopicDecisionInDto): void;
  claimHanliCorpusExtractions(stableUserId: string, projectScope: string, extractorVersion: string, limit?: number): HanliCorpusExtractionCandidateOutDto[];
  completeHanliCorpusExtraction(candidate: HanliCorpusExtractionCandidateOutDto, result: HanliSemanticExtractionInDto): void;
  failHanliCorpusExtraction(candidate: HanliCorpusExtractionCandidateOutDto, error: unknown): void;
  readHanliSemanticContext(stableUserId: string, projectScope: string, query?: string, limit?: number): HanliSemanticContextOutDto;
  recordVerifiedInspectionExperience(stableUserId: string, projectScope: string, candidate: HanliAcceptanceExperienceCandidateOutDto): void;
  readHanliConversation(conversationId: string | null): HanliConversationOutDto;
  appendHanliInternalMessage(input: {
    conversationId: string;
    messageId: string;
    role: "hanli" | "nangong";
    content: string;
    replyToMessageId?: string | null;
    createdAt: string;
  }): HanliConversationOutDto;
  registerHanliRound(input: {
    conversationId: string;
    userMessageId: string;
    userContent: string;
    attachmentIds: string[];
    hanliMessageId: string;
    hanliContent: string;
    createdAt: string;
    completedAt: string;
    decision: ConversationRoundTopicDecisionInDto;
  }): HanliConversationOutDto;
}
