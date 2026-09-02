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
export type { WorkspaceEntryOutDto, WorkspaceRootOutDto, WorkspaceStateOutDto } from "../../services/support/platform/workspace/index.js";

export type { CodexSessionInfoOutDto, ConversationDispatchStateOutDto, ConversationQueueItemOutDto, EnqueueMessageInDto, SendMessageInDto, SendMessageOutDto } from "../../services/support/capabilities/conversation/index.js";
export type { ApprovalMemoryEvidenceOutDto, CollaborationMemoryMessageOutDto, CollaborationMemoryPort, ConversationRoundTopicDecisionInDto, TrainingCorpusTopicSearchResultOutDto } from "../../services/support/capabilities/event-center/index.js";
export type { IntegrationReleaseEventTypeValue, IntegrationReleaseHolderOutDto, IntegrationReleaseInDto, ReleaseBatchDocumentOutDto, ReleaseBatchTaskSnapshotOutDto } from "../../services/support/capabilities/release/index.js";
export type { AutomaticTestPreflightCheckOutDto, AutomaticTestPreflightResultOutDto, TestResourceCoordinatorStateOutDto, TestResourceEventTypeValue, TestResourceHolderOutDto, TestResourceInDto, TestResourceWaiterOutDto } from "../../services/support/capabilities/testing/index.js";
export type { ResolvedRuntimeRuleOutDto, RuleBundleStatusOutDto, RuntimeRuleOutDto, RuntimeRuleSourceValue } from "../../services/support/capabilities/rules/index.js";

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
  CreateCollaborationMemberInDto,
  DesktopOperatingModeValue,
  PersonaCapabilityValue,
  PersonaRuntimePort,
  PersonaWorkflowActionInDto,
  StalledTaskDetectionOutDto,
  SubmitCollaborationTaskInDto,
  UpdateCollaborationMemberInDto,
  WorkflowEventCategoryValue,
  WorkflowEventInDto,
  WorkflowEventStatusValue,
  WorkflowExceptionRecordOutDto,
  WorkflowStateReaderPort,
} from "../../services/workflow/index.js";

export type {
  CreateLinghuRepairProposalOutDto,
  CreateLinghuStartupPromptInDto,
  LinghuAutomaticFlowSnapshotOutDto,
  LinghuAutomationFeedbackOutDto,
  LinghuAutomationModuleValue,
  LinghuAutomationStateEventOutDto,
  LinghuAutomationStateOutDto,
  LinghuBlockingKindValue,
  LinghuFlowHealthValue,
  LinghuModuleCompletionReportOutDto,
  LinghuStartupPromptOutDto,
  UpdateLinghuStartupPromptInDto,
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
  EvolutionWorkbenchChangeEventOutDto,
  EvolutionWorkbenchPageOutDto,
  EvolutionWorkbenchPreferenceOutDto,
  EvolutionWorkbenchRowOutDto,
  EvolutionWorkbenchViewValue,
  EvolutionWorkspaceLocationOutDto,
  QueryEvolutionWorkbenchInDto,
  SaveEvolutionWorkbenchPreferenceInDto,
} from "../../services/evolution/index.js";

export type {
  ConvertNangongConversationToTopicInDto,
  CreateNangongProposalInDto,
  CreateNangongTopicInDto,
  GenerateNangongTopicDraftInDto,
  NangongConversationMessageOutDto,
  NangongConversationOutDto,
  NangongTopicDraftOutDto,
  ReviseNangongProposalInDto,
  SendNangongConversationMessageInDto,
  UpdateNangongTopicInDto,
} from "../../services/personas/nangong/index.js";

export type {
  DecideHanliProposalInDto,
  DecideHanliResultInDto,
  HanliAcceptanceCheckOutDto,
  HanliAcceptanceExperienceCandidateOutDto,
  HanliAcceptanceFailureEvidenceOutDto,
  HanliAcceptanceOperationValue,
  HanliAcceptancePlanOutDto,
  HanliAcceptanceRunOutDto,
  HanliAcceptanceStepResultOutDto,
  HanliDeliberationRoundOutDto,
  HanliDeliberationStatusValue,
  HanliEvolutionDeliberationOutDto,
  HanliTopicCandidateOutDto,
} from "../../services/personas/hanli/index.js";

export type { DesktopApi } from "./api/desktop.api.js";
export { DESKTOP_CAPABILITY_DOMAINS } from "./value/desktop-capability-registry.value.js";
export type { DesktopCapabilityDefinitionValue, DesktopCapabilityRegistryValue } from "./value/desktop-capability-registry.value.js";
