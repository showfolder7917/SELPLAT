/** 事件中心向人物业务提供的最小记忆行为接口。 */
import type { EvolutionProposalOriginValue, EvolutionProposalTypeValue, EvolutionSourceMessageSnapshotOutDto, EvolutionStateOutDto } from "../../../../evolution/index.js";
import type { PersonaConversationOutDto } from "../../../../personas/conversation/index.js";
import type { ApprovalMemoryEvidenceOutDto, TrainingCorpusTopicSearchResultOutDto } from "../dto/collaboration-memory.out.dto.js";
import type { ConversationRoundTopicDecisionInDto } from "../dto/conversation-round-topic-decision.in.dto.js";
import type { HanliSemanticExtractionInDto } from "../dto/hanli-semantic-extraction.in.dto.js";
import type { HanliCorpusExtractionCandidateOutDto, HanliSemanticContextOutDto } from "../dto/hanli-semantic-memory.out.dto.js";
import type { RequirementDiscussionContextOutDto } from "../dto/requirement-discussion-context.out.dto.js";
import type { HanliAcceptanceExperienceCandidateOutDto } from "../../../../personas/hanli/index.js";

export interface CollaborationMemoryPort {
  savePersonaConversation(conversation: PersonaConversationOutDto): void;
  syncEvolutionState(state: EvolutionStateOutDto): void;
  buildNangongContext(conversation: PersonaConversationOutDto): string;
  approvalEvidence(proposalType: EvolutionProposalTypeValue, origin: EvolutionProposalOriginValue): ApprovalMemoryEvidenceOutDto[];
  searchTrainingCorpusTopics(query: string, limit?: number): TrainingCorpusTopicSearchResultOutDto[];
  readHanLiEvolutionCorpus(deliberationId: string, anchorHanliConversationId?: string | null): EvolutionSourceMessageSnapshotOutDto[];
  recordRequirementDiscussionContext(context: RequirementDiscussionContextOutDto): void;
  readLatestRequirementDiscussionContext(ownerPersonaId: string, conversationId: string): RequirementDiscussionContextOutDto | null;
  registerNangongRound(conversation: PersonaConversationOutDto, userMessageId: string, nangongMessageId: string, decision: ConversationRoundTopicDecisionInDto): void;
  claimHanliCorpusExtractions(stableUserId: string, projectScope: string, extractorVersion: string, limit?: number): HanliCorpusExtractionCandidateOutDto[];
  completeHanliCorpusExtraction(candidate: HanliCorpusExtractionCandidateOutDto, result: HanliSemanticExtractionInDto): void;
  failHanliCorpusExtraction(candidate: HanliCorpusExtractionCandidateOutDto, error: unknown): void;
  readHanliSemanticContext(stableUserId: string, projectScope: string, query?: string, limit?: number): HanliSemanticContextOutDto;
  recordVerifiedInspectionExperience(stableUserId: string, projectScope: string, candidate: HanliAcceptanceExperienceCandidateOutDto): void;
  readPersonaConversation(ownerPersonaId: string, conversationId?: string | null): PersonaConversationOutDto;
  newPersonaConversation(ownerPersonaId: string): PersonaConversationOutDto;
  appendPersonaInternalMessage(input: {
    ownerPersonaId: string;
    conversationId: string;
    messageId: string;
    speakerPersonaId: string;
    content: string;
    /** 内部消息需要展示的原始截图身份；未提供时保持为空。 */
    attachmentIds?: string[];
    replyToMessageId?: string | null;
    createdAt: string;
  }): PersonaConversationOutDto;
  registerPersonaRound(input: {
    ownerPersonaId: string;
    responderPersonaId: string;
    corpusSource: string;
    conversationId: string;
    userMessageId: string;
    userContent: string;
    attachmentIds: string[];
    personaMessageId: string;
    personaContent: string;
    createdAt: string;
    completedAt: string;
    decision: ConversationRoundTopicDecisionInDto;
  }): PersonaConversationOutDto;
}
