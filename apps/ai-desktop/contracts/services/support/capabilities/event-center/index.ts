/** 事件中心协议唯一入口，为人物、流程和 DesktopApi 提供事件、异常、审计与只读记忆协议。 */
export type { AuditLogInfoOutDto, AuditReasonOutDto, AuditTaskSummaryOutDto } from "./dto/audit.out.dto.js";
export type { ApprovalMemoryEvidenceOutDto, CollaborationMemoryMessageOutDto, TrainingCorpusTopicSearchResultOutDto } from "./dto/collaboration-memory.out.dto.js";
export type { ConversationRoundTopicDecisionInDto } from "./dto/conversation-round-topic-decision.in.dto.js";
export type { EventCenterExceptionInDto } from "./dto/event-center-exception.in.dto.js";
export type { RendererExceptionInDto } from "./dto/renderer-exception.in.dto.js";
export type { CollaborationMemoryPort } from "./port/collaboration-memory.port.js";
