/** 事件中心协议唯一入口，为人物、流程和 DesktopApi 提供事件、异常、审计与只读记忆协议。 */
export type { AuditLogInfoOutDto, AuditReasonOutDto, AuditTaskSummaryOutDto } from "./dto/audit.out.dto.js";
export type { ApprovalMemoryEvidenceOutDto, CollaborationMemoryMessageOutDto, TrainingCorpusTopicSearchResultOutDto } from "./dto/collaboration-memory.out.dto.js";
export type { ConversationRoundTopicDecisionInDto } from "./dto/conversation-round-topic-decision.in.dto.js";
export type {
  RequirementDiscoveryOutDto,
  RequirementDiscoveryRelationValue,
  RequirementDiscussionContextOutDto,
} from "./dto/requirement-discussion-context.out.dto.js";
export type { HanliSemanticExtractionInDto } from "./dto/hanli-semantic-extraction.in.dto.js";
export type {
  HanliConcernStatusValue,
  HanliCorpusExtractionCandidateOutDto,
  HanliCustomerConcernOutDto,
  HanliInspectionExperienceOutDto,
  HanliRequirementNodeOutDto,
  HanliRequirementNodeStatusValue,
  HanliRequirementTrajectoryOutDto,
  HanliSemanticContextOutDto,
} from "./dto/hanli-semantic-memory.out.dto.js";
export type { EventCenterExceptionInDto } from "./dto/event-center-exception.in.dto.js";
export type { RendererExceptionInDto } from "./dto/renderer-exception.in.dto.js";
export type { CollaborationMemoryPort } from "./port/collaboration-memory.port.js";
