/** 事件中心向人物业务提供的最小记忆行为接口。 */
import type { EvolutionProposalOriginValue, EvolutionProposalTypeValue, EvolutionSourceMessageSnapshotOutDto, EvolutionStateOutDto } from "../../../../evolution/index.js";
import type { PersonaConversationContentRoleValue, PersonaConversationOutDto, PersonaConversationRecoveryStatusValue, PersonaConversationWindowOutDto, ReadPersonaConversationWindowInDto } from "../../../../personas/conversation/index.js";
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
  readRequirementDiscussionContext(ownerPersonaId: string, conversationId: string, sourceRequestId: string): RequirementDiscussionContextOutDto | null;
  registerNangongRound(conversation: PersonaConversationOutDto, userMessageId: string, nangongMessageId: string, decision: ConversationRoundTopicDecisionInDto): void;
  claimHanliCorpusExtractions(stableUserId: string, projectScope: string, extractorVersion: string, limit?: number): HanliCorpusExtractionCandidateOutDto[];
  completeHanliCorpusExtraction(candidate: HanliCorpusExtractionCandidateOutDto, result: HanliSemanticExtractionInDto): void;
  failHanliCorpusExtraction(candidate: HanliCorpusExtractionCandidateOutDto, error: unknown): void;
  readHanliSemanticContext(stableUserId: string, projectScope: string, query?: string, limit?: number): HanliSemanticContextOutDto;
  recordVerifiedInspectionExperience(stableUserId: string, projectScope: string, candidate: HanliAcceptanceExperienceCandidateOutDto): void;
  readPersonaConversation(ownerPersonaId: string, conversationId?: string | null): PersonaConversationOutDto;
  /** 只读取指定业务会话的 Codex 线程关联；绝不回退人物级当前线程。 */
  readPersonaConversationCodexThread(ownerPersonaId: string, conversationId: string): { threadId: string; workspaceSignature: string } | null;
  /** 成功启动或恢复后将真实 Codex 线程绑定到同一业务会话。 */
  linkPersonaConversationCodexThread(input: { ownerPersonaId: string; conversationId: string; threadId: string; workspaceSignature: string; occurredAt: string }): void;
  /** 仅当活动会话尚未绑定线程时认领本次新建线程；返回 false 时调用方必须读取获胜绑定。 */
  claimPersonaConversationCodexThread(input: { ownerPersonaId: string; conversationId: string; threadId: string; workspaceSignature: string; occurredAt: string }): boolean;
  /** 仅解除仍指向本次线程的关联，避免失败补偿误删后续请求的获胜绑定。 */
  unlinkPersonaConversationCodexThread(input: { ownerPersonaId: string; conversationId: string; threadId: string }): boolean;
  /** 客户正文读取只能经过该投影端口；原始会话仍只用于审计、提取和内部事实。 */
  readPersonaCustomerDisplayConversation(ownerPersonaId: string, conversationId?: string | null): PersonaConversationOutDto;
  readPersonaCustomerDisplayWindow(ownerPersonaId: string, request: ReadPersonaConversationWindowInDto): PersonaConversationWindowOutDto;
  retryPersonaCustomerDisplayMessage(ownerPersonaId: string, conversationId: string, sourceMessageId: string): void;
  /** 记录 Codex 线程恢复结论；原消息和客户显示派生均不被改写。 */
  recordPersonaConversationRecovery(input: {
    ownerPersonaId: string;
    conversationId: string;
    status: PersonaConversationRecoveryStatusValue;
    sourceThreadId?: string | null;
    successorThreadId?: string | null;
    affectedTurnId?: string | null;
    affectedItemId?: string | null;
    affectedMessageId?: string | null;
    summary: string;
    retryable: boolean;
    occurredAt: string;
  }): PersonaConversationOutDto;
  newPersonaConversation(ownerPersonaId: string): PersonaConversationOutDto;
  selectPersonaConversationModel(ownerPersonaId: string, conversationId: string, selectedModel: string | null): PersonaConversationOutDto;
  appendPersonaInternalMessage(input: {
    ownerPersonaId: string;
    conversationId: string;
    messageId: string;
    speakerPersonaId: string;
    content: string;
    /** 内部消息需要展示的原始截图身份；未提供时保持为空。 */
    attachmentIds?: string[];
    replyToMessageId?: string | null;
    /** 技术依据与人物可读研讨共用消息链，但由内容职责决定页面展示方式。 */
    contentRole?: PersonaConversationContentRoleValue;
    createdAt: string;
  }): PersonaConversationOutDto;
  /** 已发布进展只能在原消息位置更新，不能创建新消息或改变历史顺序。 */
  updatePersonaInternalProgress(input: {
    ownerPersonaId: string;
    conversationId: string;
    messageId: string;
    content: string;
    updatedAt: string;
  }): PersonaConversationOutDto;
  appendPersonaRecoveryCheckpoint(input: {
    ownerPersonaId: string;
    conversationId: string;
    messageId: string;
    requestId: string;
    content: string;
    createdAt: string;
  }): PersonaConversationOutDto;
  appendPersonaCustomerMessage(input: {
    ownerPersonaId: string;
    conversationId: string;
    messageId: string;
    speakerPersonaId: string;
    content: string;
    replyToMessageId: string;
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

/** 主进程只持有异步人物记忆端口；同步实现被限制在后台持久化 Worker 内。 */
export type AsyncCollaborationMemoryPort = {
  [Method in keyof CollaborationMemoryPort]: CollaborationMemoryPort[Method] extends (...args: infer Args) => infer Result
    ? (...args: Args) => Promise<Awaited<Result>>
    : never;
};
