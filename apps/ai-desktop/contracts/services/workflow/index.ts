/**
 * Workflow 协议唯一公开入口。
 *
 * 业务代码只从这里导入 Workflow 类型，不需要了解 DTO、Value 和 Port 的物理目录。
 * 每项导出分别说明它描述的业务对象，方便新手从使用处反查真实定义。
 */

// ApprovalGovernanceRecordOutDto 是审批完成后提供给治理视图的审计记录。
export type { ApprovalGovernanceRecordOutDto } from "./dto/approval-governance-record.out.dto.js";
// WorkflowEventInDto 是调用方写入 Workflow 事件中心的原始事件事实。
export type { WorkflowEventInDto } from "./dto/workflow-event.in.dto.js";
// StalledTaskDetectionOutDto 是监督流程识别出的停滞任务。
export type { StalledTaskDetectionOutDto } from "./dto/workflow-event.out.dto.js";
// WorkflowExceptionRecordOutDto 是等待监督或恢复流程处理的异常事件。
export type { WorkflowExceptionRecordOutDto } from "./dto/workflow-event.out.dto.js";

// CollaborationMemberOutDto 是一个协作成员的当前运行状态。
export type { CollaborationMemberOutDto } from "./dto/collaboration-member.out.dto.js";
// CollaborationParticipantSnapshotOutDto 是写入历史事实时冻结的人物身份。
export type { CollaborationParticipantSnapshotOutDto } from "./dto/collaboration-member.out.dto.js";
// CollaborationTaskRuleContextOutDto 是任务提交时实际加载的规则上下文。
export type { CollaborationTaskRuleContextOutDto } from "./dto/collaboration-task-snapshot.out.dto.js";
// CollaborationTaskSnapshotOutDto 是任务提交时冻结的原始需求。
export type { CollaborationTaskSnapshotOutDto } from "./dto/collaboration-task-snapshot.out.dto.js";

// CollaborationMemberKindValue 区分会话负责人和执行成员。
export type { CollaborationMemberKindValue } from "./value/collaboration-member.value.js";
// CollaborationMemberRoleValue 表示成员当前承担的协作角色。
export type { CollaborationMemberRoleValue } from "./value/collaboration-member.value.js";
// CollaborationMemberStateValue 表示成员空闲、工作、恢复或离线等总体状态。
export type { CollaborationMemberStateValue } from "./value/collaboration-member.value.js";
// CollaborationWorkerPhaseValue 表示成员在单个任务内的细分执行进度。
export type { CollaborationWorkerPhaseValue } from "./value/collaboration-member.value.js";
// DesktopOperatingModeValue 区分单会话和多人协作桌面模式。
export type { DesktopOperatingModeValue } from "./value/collaboration-member.value.js";

// CollaborationFlowEventDetailsOutDto 是流程事件可携带的补充事实。
export type { CollaborationFlowEventDetailsOutDto } from "./dto/collaboration-flow-event.out.dto.js";
// CollaborationFlowEventOutDto 是追加到任务历史中的不可变流程事件。
export type { CollaborationFlowEventOutDto } from "./dto/collaboration-flow-event.out.dto.js";
// CollaborationFlowEventTypeValue 是 Workflow 允许发布的流程事件名称集合。
export type { CollaborationFlowEventTypeValue } from "./value/collaboration-flow-event.value.js";

// CollaborationExecutionRecordOutDto 是一次任务分配的完整执行历史。
export type { CollaborationExecutionRecordOutDto } from "./dto/collaboration-execution.out.dto.js";
// CollaborationUnifiedTestOutDto 是令狐对当前任务执行统一测试的结果。
export type { CollaborationUnifiedTestOutDto } from "./dto/collaboration-execution.out.dto.js";
// CollaborationIntegrationBatchOutDto 是一批共同集成和验证的任务。
export type { CollaborationIntegrationBatchOutDto } from "./dto/collaboration-integration.out.dto.js";
// CollaborationIntegrationFailureOutDto 是任务集成失败时的定位信息。
export type { CollaborationIntegrationFailureOutDto } from "./dto/collaboration-integration.out.dto.js";
// CollaborationCustomerActionGuidanceOutDto 是必须由客户解除卡点时的处理指导。
export type { CollaborationCustomerActionGuidanceOutDto } from "./dto/collaboration-customer-action-guidance.out.dto.js";
// CollaborationRepairDiagnosisOutDto 是令狐对执行失败的调查结论。
export type { CollaborationRepairDiagnosisOutDto } from "./dto/collaboration-repair.out.dto.js";
// CollaborationRequirementPlanOutDto 是任务分析阶段产生的可执行计划。
export type { CollaborationRequirementPlanOutDto } from "./dto/collaboration-plan.out.dto.js";
// CollaborationResultSummaryOutDto 是任务结束后面向用户的结构化结果。
export type { CollaborationResultSummaryOutDto } from "./dto/collaboration-result.out.dto.js";
// CollaborationTaskOutDto 是一项协作任务的完整当前快照。
export type { CollaborationTaskOutDto } from "./dto/collaboration-task.out.dto.js";
// CollaborationVersionWorkspaceOutDto 是任务独占的隔离 Git 工作区。
export type { CollaborationVersionWorkspaceOutDto } from "./dto/collaboration-version-workspace.out.dto.js";

// CollaborationAutomationSourceValue 表示任务由哪个已登记自动化流程发起。
export type { CollaborationAutomationSourceValue } from "./value/collaboration-task.value.js";
// CollaborationExecutionStatusValue 表示一次任务分配的执行状态。
export type { CollaborationExecutionStatusValue } from "./value/collaboration-task.value.js";
// CollaborationIntegrationFailureKindValue 是集成失败的标准分类。
export type { CollaborationIntegrationFailureKindValue } from "./value/collaboration-task.value.js";
// CollaborationMergeStrategyValue 决定多个任务结果如何进入版本集成。
export type { CollaborationMergeStrategyValue } from "./value/collaboration-task.value.js";
// CollaborationPlanStatusValue 表示需求计划是否可以进入执行阶段。
export type { CollaborationPlanStatusValue } from "./value/collaboration-task.value.js";
// CollaborationResultOutcomeValue 是任务结果的标准结论。
export type { CollaborationResultOutcomeValue } from "./value/collaboration-task.value.js";
// CollaborationTaskStateValue 是协作任务完整生命周期的权威状态集合。
export type { CollaborationTaskStateValue } from "./value/collaboration-task.value.js";

// CollaborationStateOutDto 是全部成员、任务和集成批次的当前快照。
export type { CollaborationStateOutDto } from "./dto/collaboration-state.out.dto.js";
// CollaborationStateEventOutDto 是主进程主动通知状态变化的事件。
export type { CollaborationStateEventOutDto } from "./dto/collaboration-state.event.out.dto.js";
// CollaborationStreamEventOutDto 是人物执行期间产生的 Codex 流式事件。
export type { CollaborationStreamEventOutDto } from "./dto/collaboration-stream.event.out.dto.js";
// SubmitCollaborationTaskInDto 是向 Workflow 提交新任务的输入。
export type { SubmitCollaborationTaskInDto } from "./dto/submit-collaboration-task.in.dto.js";

// CollaborationTimelineChangedEventOutDto 通知 Renderer 哪些专题时间线已经更新。
export type { CollaborationTimelineChangedEventOutDto } from "./dto/collaboration-timeline.event.out.dto.js";
// CollaborationTimelineGroupOutDto 是协作群页面上的一张专题任务卡。
export type { CollaborationTimelineGroupOutDto } from "./dto/collaboration-timeline.out.dto.js";
// CollaborationTimelineNodeOutDto 是专题任务卡中的一个已发生业务节点。
export type { CollaborationTimelineNodeOutDto } from "./dto/collaboration-timeline.out.dto.js";
// CollaborationTimelineSnapshotOutDto 是主进程返回的完整专题时间线投影。
export type { CollaborationTimelineSnapshotOutDto } from "./dto/collaboration-timeline.out.dto.js";
// CollaborationTimelineContentRoleValue 说明时间线正文应以哪种内容角色显示。
export type { CollaborationTimelineContentRoleValue } from "./value/collaboration-timeline.value.js";
// CollaborationTimelineDetailRoleValue 说明时间线详情承担的业务用途。
export type { CollaborationTimelineDetailRoleValue } from "./value/collaboration-timeline.value.js";
// CollaborationTimelineBusinessEventOutDto 是事件中心接收的不可变专题业务事实。
export type { CollaborationTimelineBusinessEventOutDto } from "./dto/collaboration-timeline-business.event.out.dto.js";
// CollaborationTimelineBusinessEventTypeValue 是允许写入专题时间线的事件名称集合。
export type { CollaborationTimelineBusinessEventTypeValue } from "./value/collaboration-timeline-business-event.value.js";

// ConfigurePersonaWorkflowInDto 是 Renderer 提交的自动演化运行配置。
export type { ConfigurePersonaWorkflowInDto } from "./dto/configure-persona-workflow.in.dto.js";
// PersonaWorkflowActionInDto 是启动、暂停、恢复、停止或交接自动演化的命令。
export type { PersonaWorkflowActionInDto } from "./dto/persona-workflow-action.in.dto.js";
// PersonaRuntimePort 是 Workflow 可以调用的人物运行时最小接口。
export type { PersonaRuntimePort } from "./port/persona-runtime.port.js";
// WorkflowStateReaderPort 是其他领域读取 Workflow 状态的只读接口。
export type { WorkflowStateReaderPort } from "./port/workflow-state-reader.port.js";

// ApprovalGovernanceDomainValue 标识审批记录所属的治理领域。
export type { ApprovalGovernanceDomainValue } from "./value/approval-governance-domain.value.js";
// PersonaCapabilityValue 是人物可以登记和调用的能力名称集合。
export type { PersonaCapabilityValue } from "./value/persona-capability.value.js";
// WorkflowEventCategoryValue 是 Workflow 事件的业务分类。
export type { WorkflowEventCategoryValue } from "./value/workflow-event.value.js";
// WorkflowEventStatusValue 是异常事件在监督处理中的状态。
export type { WorkflowEventStatusValue } from "./value/workflow-event.value.js";
// WorkflowFlowImpactValue 说明一个事件对原流程的阻断程度。
export type { WorkflowFlowImpactValue } from "./value/workflow-event.value.js";
