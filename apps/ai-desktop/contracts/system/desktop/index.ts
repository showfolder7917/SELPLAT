/**
 * AI Desktop Renderer 唯一协议聚合出口。
 * 生产者：各 contracts 领域公开 index；消费者：preload 与 Renderer。
 * 数据方向：main/preload <-> Renderer。
 * 本文件只显式组合公开符号，不定义业务模型、不提供兼容别名，也不隐藏物理来源。
 */
export { APP_VARIANTS, LOCALES, MANAGED_EXECUTION_MODES, MODEL_SERVICE_TIERS, REASONING_EFFORTS, SANDBOX_MODES, WINDOW_ACTIONS, WORKSPACE_PERMISSIONS } from "../../foundation/index.js";
export type { AppVariantValue, EventSeverityValue, LocaleValue, ManagedExecutionModeValue, ModelServiceTierValue, ReasoningEffortValue, SandboxModeValue, WindowActionValue, WorkspacePermissionValue } from "../../foundation/index.js";
export type { DesktopEnvironmentOutDto } from "./dto/desktop-environment.out.dto.js";

export type { AuditLogInfoOutDto, AuditReasonOutDto, AuditTaskSummaryOutDto, EventCenterExceptionInDto, RendererExceptionInDto } from "../../services/support/capabilities/event-center/index.js";

export type { CodexAccountOutDto, CodexApprovalOutDto, CodexHarnessStatusOutDto, CodexLoginResponseOutDto, CodexModelCatalogOutDto, CodexModelOptionOutDto, CodexRuntimeInfoOutDto, CodexStreamActivityOutDto, CodexStreamEventOutDto, CodexStreamPlanStepOutDto, CodexUserInputOptionOutDto, CodexUserInputQuestionOutDto, CodexUserInputRequestOutDto, ManagedExecutionUpdateEventOutDto, ResolveCodexApprovalOutDto, ResolveCodexUserInputInDto } from "../../services/support/platform/codex/index.js";
export type { TrustedCommandInfoOutDto } from "../../services/support/platform/security/index.js";
export type { TestDataResetResultOutDto } from "../../services/support/application/index.js";
export type { AiMemoryDatabaseStateValue, AiMemoryDatabaseStatusOutDto, CorpusSemanticBackfillStateValue, CorpusSemanticBackfillStatusOutDto } from "../../services/support/platform/persistence/index.js";
export type { ScreenCaptureOutDto, ScreenCaptureFrameInDto, ScreenCaptureFrameOutDto, ScreenCapturePreparationOutDto, ScreenCaptureInDto, ScreenshotAnnotationWindowInDto, ScreenshotAttachmentOutDto, ScreenshotCompletedEventOutDto, ScreenshotSaveInDto, TempDirectoryInfoOutDto } from "../../services/support/platform/attachments/index.js";
export type { DesktopSettingsOutDto, UpdateDesktopSettingsInDto } from "../../services/support/platform/settings/index.js";
export type { WorkspaceRootOutDto, WorkspaceStateOutDto } from "../../services/support/platform/workspace/index.js";

export type { CodexSessionInfoOutDto, ConversationDispatchStateOutDto, ConversationQueueItemOutDto, EnqueueMessageInDto, SendMessageInDto, SendMessageOutDto } from "../../services/support/capabilities/conversation/index.js";
export type { ApprovalMemoryEvidenceOutDto, CollaborationMemoryMessageOutDto, CollaborationMemoryPort, ConversationRoundTopicDecisionInDto, TrainingCorpusTopicSearchResultOutDto } from "../../services/support/capabilities/event-center/index.js";
export type { IntegrationReleaseEventTypeValue, IntegrationReleaseHolderOutDto, IntegrationReleaseInDto, ReleaseBatchDocumentOutDto, ReleaseBatchTaskSnapshotOutDto } from "../../services/support/capabilities/release/index.js";
export type { AutomaticTestPreflightCheckOutDto, AutomaticTestPreflightResultOutDto, TestResourceCoordinatorStateOutDto, TestResourceEventTypeValue, TestResourceHolderOutDto, TestResourceInDto, TestResourceWaiterOutDto } from "../../services/support/capabilities/testing/index.js";
export type { ResolvedRuntimeRuleOutDto, RuleBundleStatusOutDto, RuntimeRuleOutDto, RuntimeRuleSourceValue } from "../../services/support/capabilities/rules/index.js";
export type { PersonaConversationMessageOutDto, PersonaConversationOutDto, SendPersonaConversationMessageInDto } from "../../services/personas/conversation/index.js";

export type {
  ApprovalGovernanceDomainValue,
  ApprovalGovernanceRecordOutDto,
  CollaborationAutomationSourceValue,
  CollaborationExecutionRecordOutDto,
  CollaborationExecutionStatusValue,
  CollaborationFlowEventOutDto,
  CollaborationFlowEventDetailsOutDto,
  CollaborationFlowEventTypeValue,
  CollaborationIntegrationBatchOutDto,
  CollaborationIntegrationFailureOutDto,
  CollaborationIntegrationFailureKindValue,
  CollaborationMemberOutDto,
  CollaborationMemberKindValue,
  CollaborationMemberRoleValue,
  CollaborationMemberStateValue,
  CollaborationMergeStrategyValue,
  CollaborationParticipantSnapshotOutDto,
  CollaborationPlanStatusValue,
  CollaborationRepairDiagnosisOutDto,
  CollaborationRequirementPlanOutDto,
  CollaborationResultOutcomeValue,
  CollaborationResultSummaryOutDto,
  CollaborationStateOutDto,
  CollaborationStateEventOutDto,
  CollaborationStreamEventOutDto,
  CollaborationTaskOutDto,
  CollaborationTaskRuleContextOutDto,
  CollaborationTaskSnapshotOutDto,
  CollaborationTaskStateValue,
  CollaborationTimelineBusinessEventOutDto,
  CollaborationTimelineBusinessEventTypeValue,
  CollaborationTimelineChangedEventOutDto,
  CollaborationTimelineContentRoleValue,
  CollaborationTimelineDetailRoleValue,
  CollaborationTimelineGroupOutDto,
  CollaborationTimelineNodeOutDto,
  CollaborationTimelineSnapshotOutDto,
  CollaborationVersionWorkspaceOutDto,
  CollaborationWorkerPhaseValue,
  ConfigurePersonaWorkflowInDto,
  DesktopOperatingModeValue,
  PersonaCapabilityValue,
  PersonaRuntimePort,
  PersonaWorkflowActionInDto,
  StalledTaskDetectionOutDto,
  SubmitCollaborationTaskInDto,
  WorkflowEventCategoryValue,
  WorkflowEventInDto,
  WorkflowEventStatusValue,
  WorkflowExceptionRecordOutDto,
  WorkflowStateReaderPort,
} from "../../services/workflow/index.js";

export type {
  LinghuAutomaticFlowSnapshotOutDto,
  LinghuAutomationFeedbackOutDto,
  LinghuAutomationModuleValue,
  LinghuAutomationStateEventOutDto,
  LinghuAutomationStateOutDto,
  LinghuBlockingKindValue,
  LinghuFlowHealthValue,
  LinghuModuleCompletionReportOutDto,
} from "../../services/personas/linghu/index.js";

export type {
  EvolutionApprovalOutDto,
  EvolutionApprovalDecisionValue,
  EvolutionApprovalSourceValue,
  EvolutionApprovalStageValue,
  EvolutionArchiveActorValue,
  EvolutionArchiveCategoryValue,
  EvolutionArchiveRecordOutDto,
  EvolutionAutomationRuntimeOutDto,
  EvolutionAutomationSettingsOutDto,
  EvolutionDistributionPlanOutDto,
  EvolutionDistributionUnitOutDto,
  EvolutionDistributionValidationOutDto,
  EvolutionFeedbackTargetValue,
  EvolutionMutationInDto,
  EvolutionOneShotConfirmationOutDto,
  EvolutionOneShotPhaseValue,
  EvolutionOneShotRunOutDto,
  EvolutionProposalOutDto,
  EvolutionProposalOriginValue,
  EvolutionProposalPurposeValue,
  EvolutionProposalTypeValue,
  EvolutionSourceMessageSnapshotOutDto,
  EvolutionStateEventOutDto,
  EvolutionStateOutDto,
  EvolutionTopicOutDto,
  EvolutionTopicDossierOutDto,
  EvolutionTopicStatusValue,
} from "../../services/evolution/index.js";

export type {
  ConvertNangongConversationToTopicInDto,
  CreateNangongProposalInDto,
  CreateNangongTopicInDto,
  GenerateNangongTopicDraftInDto,
  NangongTopicDraftOutDto,
  ReviseNangongProposalInDto,
  UpdateNangongTopicInDto,
} from "../../services/personas/nangong/index.js";

export type {
  DecideHanliProposalInDto,
  DecideHanliResultInDto,
  HanliAcceptanceExperienceCandidateOutDto,
  HanliAcceptanceFailureEvidenceOutDto,
  HanliAcceptanceOperationValue,
  HanliAcceptanceRunOutDto,
  HanliAcceptanceStepResultOutDto,
  HanliDeliberationRoundOutDto,
  HanliDeliberationStatusValue,
  HanliEvolutionDeliberationOutDto,
  HanliTopicCandidateOutDto,
} from "../../services/personas/hanli/index.js";

export type { DesktopApi } from "./api/desktop.api.js";
/** Codex 领域跨进程方法的权威清单。 */
export { CODEX_DESKTOP_API_METHODS } from "./api/domains/codex.desktop-api.js";
/** Codex Renderer 只能访问的类型化 API 视图。 */
export type { CodexDesktopApi } from "./api/domains/codex.desktop-api.js";
/** 协同领域跨进程方法的权威清单。 */
export { COLLABORATION_DESKTOP_API_METHODS } from "./api/domains/collaboration.desktop-api.js";
/** 协同 Renderer 只能访问的类型化 API 视图。 */
export type { CollaborationDesktopApi } from "./api/domains/collaboration.desktop-api.js";
/** 主会话领域跨进程方法的权威清单。 */
export { CONVERSATION_DESKTOP_API_METHODS } from "./api/domains/conversation.desktop-api.js";
/** 主会话 Renderer 只能访问的类型化 API 视图。 */
export type { ConversationDesktopApi } from "./api/domains/conversation.desktop-api.js";
/** 规则领域跨进程方法的权威清单。 */
export { RULES_DESKTOP_API_METHODS } from "./api/domains/rules.desktop-api.js";
/** 规则 Renderer 只能访问的类型化 API 视图。 */
export type { RulesDesktopApi } from "./api/domains/rules.desktop-api.js";
/** 截图领域跨进程方法的权威清单。 */
export { SCREENSHOT_DESKTOP_API_METHODS } from "./api/domains/screenshot.desktop-api.js";
/** 截图 Renderer 只能访问的类型化 API 视图。 */
export type { ScreenshotDesktopApi } from "./api/domains/screenshot.desktop-api.js";
/** 系统领域跨进程方法的权威清单。 */
export { SYSTEM_DESKTOP_API_METHODS } from "./api/domains/system.desktop-api.js";
/** 系统 Renderer 只能访问的类型化 API 视图。 */
export type { SystemDesktopApi } from "./api/domains/system.desktop-api.js";
export { DESKTOP_CAPABILITY_DOMAINS } from "./value/desktop-capability-registry.value.js";
export type { DesktopCapabilityDefinitionValue, DesktopCapabilityRegistryValue } from "./value/desktop-capability-registry.value.js";
