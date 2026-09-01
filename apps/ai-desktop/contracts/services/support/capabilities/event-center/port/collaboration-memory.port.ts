/** 事件中心向人物业务提供的最小记忆行为接口。 */
import type { EvolutionProposalOriginValue, EvolutionProposalTypeValue, EvolutionSourceMessageSnapshotOutDto, EvolutionStateOutDto } from "../../../../evolution/index.js";
import type { NangongConversationOutDto } from "../../../../personas/nangong/index.js";
import type { ApprovalMemoryEvidenceOutDto, TrainingCorpusTopicSearchResultOutDto } from "../dto/collaboration-memory.out.dto.js";
import type { ConversationRoundTopicDecisionInDto } from "../dto/conversation-round-topic-decision.in.dto.js";

export interface CollaborationMemoryPort {
  syncConversation(conversation: NangongConversationOutDto): void;
  syncEvolutionState(state: EvolutionStateOutDto): void;
  buildNangongContext(conversation: NangongConversationOutDto): string;
  approvalEvidence(proposalType: EvolutionProposalTypeValue, origin: EvolutionProposalOriginValue): ApprovalMemoryEvidenceOutDto[];
  searchTrainingCorpusTopics(query: string, limit?: number): TrainingCorpusTopicSearchResultOutDto[];
  readHanLiEvolutionCorpus(deliberationId: string): EvolutionSourceMessageSnapshotOutDto[];
  registerRound(conversation: NangongConversationOutDto, userMessageId: string, nangongMessageId: string, decision: ConversationRoundTopicDecisionInDto): void;
}
