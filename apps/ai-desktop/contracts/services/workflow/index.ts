/** Workflow 协议唯一入口，显式公开跨人物流程状态、事件、命令和最小端口。 */
export type { ApprovalGovernanceRecordOutDto } from "./dto/approval-governance-record.out.dto.js";
export type { WorkflowEventInDto } from "./dto/workflow-event.in.dto.js";
export type { StalledTaskDetectionOutDto, WorkflowExceptionRecordOutDto } from "./dto/workflow-event.out.dto.js";
export type {
  CollaborationMemberOutDto,
  CollaborationParticipantSnapshotOutDto,
  CollaborationTaskSnapshotOutDto,
} from "./dto/collaboration-member.out.dto.js";
export type { CollaborationMemberKindValue, CollaborationMemberRoleValue, CollaborationMemberStateValue, CollaborationWorkerPhaseValue, DesktopOperatingModeValue } from "./value/collaboration-member.value.js";
export type { CollaborationFlowEventOutDto, CollaborationFlowEventDetailsOutDto } from "./dto/collaboration-flow-event.out.dto.js";
export type { CollaborationFlowEventTypeValue } from "./value/collaboration-flow-event.value.js";
export type {
  CollaborationExecutionRecordOutDto,
  CollaborationIntegrationBatchOutDto,
  CollaborationIntegrationFailureOutDto,
  CollaborationRepairDiagnosisOutDto,
  CollaborationRequirementPlanOutDto,
  CollaborationResultSummaryOutDto,
  CollaborationTaskOutDto,
  CollaborationVersionWorkspaceOutDto,
} from "./dto/collaboration-task.out.dto.js";
export type { CollaborationAutomationSourceValue, CollaborationExecutionStatusValue, CollaborationIntegrationFailureKindValue, CollaborationMergeStrategyValue, CollaborationPlanStatusValue, CollaborationResultOutcomeValue, CollaborationTaskStateValue } from "./value/collaboration-task.value.js";
export type { CollaborationStateOutDto } from "./dto/collaboration-state.out.dto.js";
export type { CollaborationStateEventOutDto } from "./dto/collaboration-state.event.out.dto.js";
export type { CollaborationStreamEventOutDto } from "./dto/collaboration-stream.event.out.dto.js";
export type { CreateCollaborationMemberInDto } from "./dto/create-collaboration-member.in.dto.js";
export type { SubmitCollaborationTaskInDto } from "./dto/submit-collaboration-task.in.dto.js";
export type { UpdateCollaborationMemberInDto } from "./dto/update-collaboration-member.in.dto.js";
export type { CollaborationTimelineChangedEventOutDto } from "./dto/collaboration-timeline.event.out.dto.js";
export type { CollaborationTimelineGroupOutDto, CollaborationTimelineNodeOutDto, CollaborationTimelineSnapshotOutDto } from "./dto/collaboration-timeline.out.dto.js";
export type { CollaborationTimelineContentRoleValue, CollaborationTimelineDetailRoleValue } from "./value/collaboration-timeline.value.js";
export type { CollaborationTimelineBusinessEventOutDto } from "./dto/collaboration-timeline-business.event.out.dto.js";
export type { CollaborationTimelineBusinessEventTypeValue } from "./value/collaboration-timeline-business-event.value.js";
export type { ConfigurePersonaWorkflowInDto } from "./dto/configure-persona-workflow.in.dto.js";
export type { PersonaWorkflowActionInDto } from "./dto/persona-workflow-action.in.dto.js";
export type { PersonaRuntimePort } from "./port/persona-runtime.port.js";
export type { WorkflowStateReaderPort } from "./port/workflow-state-reader.port.js";
export type { ApprovalGovernanceDomainValue } from "./value/approval-governance-domain.value.js";
export type { PersonaCapabilityValue } from "./value/persona-capability.value.js";
export type { WorkflowEventCategoryValue, WorkflowEventStatusValue } from "./value/workflow-event.value.js";
