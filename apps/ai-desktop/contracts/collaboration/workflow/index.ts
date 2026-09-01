/** Workflow 协议唯一入口，显式公开跨人物流程状态、事件、命令和最小端口。 */
export type {
  CollaborationMember,
  CollaborationMemberKind,
  CollaborationMemberRole,
  CollaborationMemberState,
  CollaborationParticipantSnapshot,
  CollaborationTaskSnapshot,
  CollaborationWorkerPhase,
  DesktopOperatingMode,
} from "./dto/collaboration-member.out.dto.js";
export type { CollaborationFlowEvent, CollaborationFlowEventDetails, CollaborationFlowEventType } from "./dto/collaboration-flow-event.out.dto.js";
export type {
  CollaborationAutomationSource,
  CollaborationExecutionRecord,
  CollaborationExecutionStatus,
  CollaborationIntegrationBatch,
  CollaborationIntegrationFailure,
  CollaborationIntegrationFailureKind,
  CollaborationMergeStrategy,
  CollaborationPlanStatus,
  CollaborationRepairDiagnosis,
  CollaborationRequirementPlan,
  CollaborationResultOutcome,
  CollaborationResultSummary,
  CollaborationTask,
  CollaborationTaskState,
  CollaborationVersionWorkspace,
} from "./dto/collaboration-task.out.dto.js";
export type { CollaborationStateOutDto } from "./dto/collaboration-state.out.dto.js";
export type { CollaborationStateEventOutDto } from "./dto/collaboration-state.event.out.dto.js";
export type { CollaborationStreamEventOutDto } from "./dto/collaboration-stream.event.out.dto.js";
export type { CreateCollaborationMemberInDto } from "./dto/create-collaboration-member.in.dto.js";
export type { SubmitCollaborationTaskInDto } from "./dto/submit-collaboration-task.in.dto.js";
export type { UpdateCollaborationMemberInDto } from "./dto/update-collaboration-member.in.dto.js";
export type { CollaborationTimelineChangedEventOutDto } from "./dto/collaboration-timeline.event.out.dto.js";
export type { CollaborationTimelineContentRole, CollaborationTimelineDetailRole, CollaborationTimelineGroup, CollaborationTimelineNode, CollaborationTimelineSnapshotOutDto } from "./dto/collaboration-timeline.out.dto.js";
export { timelineParticipant } from "./collaboration-timeline-event.js";
export type { CollaborationTimelineBusinessEvent, CollaborationTimelineBusinessEventType } from "./collaboration-timeline-event.js";
export type { ConfigurePersonaWorkflowInDto } from "./dto/configure-persona-workflow.in.dto.js";
export type { PersonaWorkflowActionInDto } from "./dto/persona-workflow-action.in.dto.js";
export type { PersonaCapabilityPort, PersonaRuntimePort } from "./port/persona-capability.port.js";
