/**
 * AI Desktop Renderer 唯一协议聚合出口。
 * 生产者：各 contracts 领域公开 index；消费者：preload 与 Renderer。
 * 数据方向：main/preload <-> Renderer。
 * 本文件只显式组合公开符号，不定义业务模型、不提供兼容别名，也不隐藏物理来源。
 */
export { APP_VARIANTS, LOCALES, MODEL_SERVICE_TIERS, REASONING_EFFORTS, SANDBOX_MODES, WORKSPACE_PERMISSIONS } from "../foundation/base.js";
export type { AppVariant, DesktopEnvironment, Locale, ManagedExecutionMode, ModelServiceTier, ReasoningEffort, SandboxMode, WindowAction, WorkspacePermission } from "../foundation/base.js";

export type { ApprovalGovernanceDomain, ApprovalGovernanceRecord } from "../governance/approval-governance.js";
export type { AuditLogInfo, AuditReason, AuditTaskSummary } from "../governance/audit.js";
export type { EventCenterExceptionInput, RendererExceptionReport, StalledTaskDetection, WorkflowEventCategory, WorkflowEventInput, WorkflowEventSeverity, WorkflowEventStatus, WorkflowExceptionRecord, WorkflowStateReaders } from "../governance/workflow.js";

export type { CodexAccount, CodexApproval, CodexHarnessStatus, CodexLoginResponse, CodexModelCatalog, CodexModelOption, CodexRuntimeInfo, CodexStreamActivity, CodexStreamEvent, CodexStreamPlanStep, CodexUserInputOption, CodexUserInputQuestion, CodexUserInputRequest, ManagedExecutionUpdate, ResolveCodexApprovalResult, ResolveCodexUserInputRequest } from "../platform/codex/index.js";
export type { TrustedCommandInfo } from "../platform/security/index.js";
export type { AiMemoryDatabaseState, AiMemoryDatabaseStatus, CorpusSemanticBackfillState, CorpusSemanticBackfillStatus, TestDataResetResult } from "../platform/persistence/index.js";
export type { ScreenCapture, ScreenCaptureFrameRequest, ScreenCaptureFrameResult, ScreenCapturePreparationResult, ScreenCaptureRequest, ScreenshotAnnotationWindowRequest, ScreenshotAttachment, ScreenshotCompletedEvent, ScreenshotSaveRequest, TempDirectoryInfo } from "../platform/attachments/index.js";
export type { DesktopSettings } from "../platform/settings/index.js";
export type { WorkspaceEntry, WorkspaceRoot, WorkspaceState } from "../platform/workspace/index.js";

export type { CodexSessionInfo, ConversationDispatchState, ConversationQueueItem, EnqueueMessageRequest, SendMessageRequest, SendMessageResponse } from "../capabilities/conversation/index.js";
export type { ApprovalMemoryEvidence, CollaborationMemoryMessage, CollaborationMemoryPort, ConversationRoundTopicDecision, TrainingCorpusTopicSearchResult } from "../capabilities/event-center/index.js";
export type { IntegrationReleaseEventType, IntegrationReleaseHolder, IntegrationReleaseRequest, ReleaseBatchDocument, ReleaseBatchTaskSnapshot } from "../capabilities/release/index.js";
export type { AutomaticTestPreflightCheck, AutomaticTestPreflightResult, TestResourceCoordinatorState, TestResourceEventType, TestResourceHolder, TestResourceRequest, TestResourceWaiter } from "../capabilities/testing/index.js";
export type { ResolvedRuntimeRule, RuleBundleStatus, RuntimeRule, RuntimeRuleSource } from "../capabilities/rules/index.js";

export { timelineParticipant } from "../collaboration/workflow/index.js";
export type {
  CollaborationAutomationSource,
  CollaborationExecutionRecord,
  CollaborationExecutionStatus,
  CollaborationFlowEvent,
  CollaborationFlowEventDetails,
  CollaborationFlowEventType,
  CollaborationIntegrationBatch,
  CollaborationIntegrationFailure,
  CollaborationIntegrationFailureKind,
  CollaborationMember,
  CollaborationMemberKind,
  CollaborationMemberRole,
  CollaborationMemberState,
  CollaborationMergeStrategy,
  CollaborationParticipantSnapshot,
  CollaborationPlanStatus,
  CollaborationRepairDiagnosis,
  CollaborationRequirementPlan,
  CollaborationResultOutcome,
  CollaborationResultSummary,
  CollaborationStateOutDto,
  CollaborationStateEventOutDto,
  CollaborationStreamEventOutDto,
  CollaborationTask,
  CollaborationTaskSnapshot,
  CollaborationTaskState,
  CollaborationTimelineBusinessEvent,
  CollaborationTimelineBusinessEventType,
  CollaborationTimelineChangedEventOutDto,
  CollaborationTimelineContentRole,
  CollaborationTimelineDetailRole,
  CollaborationTimelineGroup,
  CollaborationTimelineNode,
  CollaborationTimelineSnapshotOutDto,
  CollaborationVersionWorkspace,
  CollaborationWorkerPhase,
  ConfigurePersonaWorkflowInDto,
  CreateCollaborationMemberInDto,
  DesktopOperatingMode,
  PersonaCapabilityPort,
  PersonaRuntimePort,
  PersonaWorkflowActionInDto,
  SubmitCollaborationTaskInDto,
  UpdateCollaborationMemberInDto,
} from "../collaboration/workflow/index.js";

export type {
  CreateLinghuRepairProposalOutDto,
  CreateLinghuStartupPromptInDto,
  LinghuAutomaticFlowSnapshotOutDto,
  LinghuAutomationFeedbackOutDto,
  LinghuAutomationModuleOutDto,
  LinghuAutomationStateEventOutDto,
  LinghuAutomationStateOutDto,
  LinghuBlockingKindOutDto,
  LinghuFlowHealthOutDto,
  LinghuModuleCompletionReportOutDto,
  LinghuStartupPromptOutDto,
  UpdateLinghuStartupPromptInDto,
} from "../collaboration/linghu/index.js";

export type {
  EvolutionApproval,
  EvolutionApprovalDecision,
  EvolutionApprovalSource,
  EvolutionApprovalStage,
  EvolutionArchiveActor,
  EvolutionArchiveCategory,
  EvolutionArchiveRecord,
  EvolutionAutomationRuntime,
  EvolutionAutomationSettings,
  EvolutionDistributionPlan,
  EvolutionDistributionUnit,
  EvolutionDistributionValidation,
  EvolutionFeedbackTarget,
  EvolutionMutationInDto,
  EvolutionOneShotConfirmation,
  EvolutionOneShotPhase,
  EvolutionOneShotRun,
  EvolutionProposal,
  EvolutionProposalOrigin,
  EvolutionProposalPurpose,
  EvolutionProposalType,
  EvolutionSourceMessageSnapshot,
  EvolutionStateEventOutDto,
  EvolutionStateOutDto,
  EvolutionTopic,
  EvolutionTopicDossier,
  EvolutionTopicStatus,
  EvolutionWorkbenchChangeEvent,
  EvolutionWorkbenchPage,
  EvolutionWorkbenchPreference,
  EvolutionWorkbenchRow,
  EvolutionWorkbenchView,
  EvolutionWorkspaceLocation,
  QueryEvolutionWorkbenchRequest,
  SaveEvolutionWorkbenchPreferenceRequest,
} from "../collaboration/evolution/index.js";

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
} from "../collaboration/nangong/index.js";

export type {
  DecideHanliProposalInDto,
  DecideHanliResultInDto,
  HanliAcceptanceCheckOutDto,
  HanliAcceptanceExperienceCandidateOutDto,
  HanliAcceptanceFailureEvidenceOutDto,
  HanliAcceptanceOperation,
  HanliAcceptancePlanOutDto,
  HanliAcceptanceRunOutDto,
  HanliAcceptanceStepResultOutDto,
  HanliDeliberationRoundOutDto,
  HanliDeliberationStatus,
  HanliEvolutionDeliberationOutDto,
  HanliTopicCandidateOutDto,
} from "../collaboration/hanli/index.js";

export type { DesktopApi } from "./desktop-api.js";
export { DESKTOP_CAPABILITY_DOMAINS } from "./capability-registry.js";
export type { DesktopCapabilityDefinition, DesktopCapabilityRegistry } from "./capability-registry.js";
