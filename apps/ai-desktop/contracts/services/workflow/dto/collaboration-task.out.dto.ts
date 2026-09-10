/**
 * Workflow 协作任务当前状态输出协议。
 *
 * 生产者：Workflow 协作存储。
 * 消费者：Renderer、人物执行流程和版本发布能力。
 * 数据方向：Workflow -> 协作消费者。
 * 本文件只组合任务当前状态；计划、执行、修复和集成细节分别由独立 DTO 定义。
 */

// CollaborationAutomationSourceValue 说明任务是否由已登记的自动保障流程发起。
import type { CollaborationAutomationSourceValue } from "../value/collaboration-task.value.js";
// CollaborationMergeStrategyValue 决定任务结果进入版本集成时采用的组合方式。
import type { CollaborationMergeStrategyValue } from "../value/collaboration-task.value.js";
// CollaborationTaskStateValue 是任务从排队到结束的权威状态集合。
import type { CollaborationTaskStateValue } from "../value/collaboration-task.value.js";
// CollaborationWorkerPhaseValue 是任务执行期间面向界面展示的细分进度。
import type { CollaborationWorkerPhaseValue } from "../value/collaboration-member.value.js";
// CollaborationCustomerActionGuidanceOutDto 描述必须由客户解除的真实卡点。
import type { CollaborationCustomerActionGuidanceOutDto } from "./collaboration-customer-action-guidance.out.dto.js";
// CollaborationExecutionRecordOutDto 保存每一次任务分配的完整执行历史。
import type { CollaborationExecutionRecordOutDto } from "./collaboration-execution.out.dto.js";
// CollaborationUnifiedTestOutDto 保存令狐统一测试的当前结果。
import type { CollaborationUnifiedTestOutDto } from "./collaboration-execution.out.dto.js";
// CollaborationFlowEventOutDto 保存任务生命周期中已经发生的流程事实。
import type { CollaborationFlowEventOutDto } from "./collaboration-flow-event.out.dto.js";
// CollaborationIntegrationFailureOutDto 保存任务无法集成时的定位证据。
import type { CollaborationIntegrationFailureOutDto } from "./collaboration-integration.out.dto.js";
// CollaborationParticipantSnapshotOutDto 固定历史记录中的人物身份和显示名称。
import type { CollaborationParticipantSnapshotOutDto } from "./collaboration-member.out.dto.js";
// CollaborationRequirementPlanOutDto 保存经过分析确认的计划版本。
import type { CollaborationRequirementPlanOutDto } from "./collaboration-plan.out.dto.js";
// CollaborationRepairDiagnosisOutDto 保存令狐对执行失败的调查结论。
import type { CollaborationRepairDiagnosisOutDto } from "./collaboration-repair.out.dto.js";
// CollaborationResultSummaryOutDto 提供任务完成后面向用户的结构化说明。
import type { CollaborationResultSummaryOutDto } from "./collaboration-result.out.dto.js";
// CollaborationTaskSnapshotOutDto 保存任务提交时不可改变的原始需求。
import type { CollaborationTaskSnapshotOutDto } from "./collaboration-task-snapshot.out.dto.js";
// CollaborationVersionWorkspaceOutDto 描述任务专用的隔离 Git 工作区。
import type { CollaborationVersionWorkspaceOutDto } from "./collaboration-version-workspace.out.dto.js";

/** 一项协作任务从提交到结束的完整当前快照。 */
export interface CollaborationTaskOutDto {
  /** 任务的稳定唯一标识。 */
  taskId: string;
  /** 每次任务发生有效状态变化时递增的修订号。 */
  taskRevision: number;
  /** 当前生效的任务分配标识；尚未分配时为 null。 */
  assignmentId: string | null;
  /** 当前执行者实例的代次，用来识别执行者重启。 */
  workerGeneration: number;
  /** 任务当前所处的权威生命周期状态。 */
  state: CollaborationTaskStateValue;
  /** 当前状态在界面上对应的细分执行阶段。 */
  phase: CollaborationWorkerPhaseValue;
  /** 当前执行者标识；尚未分配执行者时为 null。 */
  executorMemberId: string | null;
  /** 发起方希望优先分配的执行者；未指定或旧任务中可能不存在。 */
  preferredExecutorMemberId?: string | null;
  /** 任务首次失败前的原执行者；普通任务或旧任务可能没有该字段。 */
  originalExecutor?: CollaborationParticipantSnapshotOutDto | null;
  /** 当前实际接手任务的人物；尚未进入处理流程时可能为 null。 */
  currentHandler?: CollaborationParticipantSnapshotOutDto | null;
  /** 当前修复针对执行阶段；不在修复流程时为 null。 */
  repairKind?: "execution" | null;
  /** 触发本次修复流程的失败原因。 */
  repairFailureReason?: string | null;
  /** true 表示文件范围需要客户重新确认，程序必须等待用户继续。 */
  repairRequiresUserConfirmation?: boolean;
  /** 令狐已经完成的修复诊断；尚未诊断时为 null。 */
  repairDiagnosis?: CollaborationRepairDiagnosisOutDto | null;
  /** 原执行者返回的修复结果；尚未修复时为 null。 */
  repairResult?: string | null;
  /** 当前任务的统一测试结果；尚未进入统一测试时为 null。 */
  unifiedTest?: CollaborationUnifiedTestOutDto | null;
  /** 当前被 Workflow 选中执行的计划版本号。 */
  currentPlanVersion: number;
  /** 同一任务已连续发生的基础设施失败次数。 */
  infrastructureFailureCount: number;
  /** 任务完成后采用的版本合并策略。 */
  mergeStrategy: CollaborationMergeStrategyValue;
  /** 必须作为一个整体集成的任务组标识；独立任务为 null。 */
  atomicGroupId: string | null;
  /** 当前任务开始集成前必须完成的其他任务标识。 */
  dependencyTaskIds: string[];
  /** 当前任务所属的集成批次代次；尚未进入批次时为 null。 */
  integrationGeneration: number | null;
  /** 发起这项任务的人物快照；旧任务无法恢复时为 null。 */
  initiator: CollaborationParticipantSnapshotOutDto | null;
  /** 发起任务的已登记自动化来源；人工任务为 null。 */
  automationSource: CollaborationAutomationSourceValue | null;
  /** 产生本任务的人物演化提案；普通任务为 null。 */
  evolutionProposalId: string | null;
  /** 产生本任务的人物演化轮次；普通任务为 null。 */
  evolutionRoundId: string | null;
  /** 本任务明确替代的失败任务；普通任务或旧任务可能没有该字段。 */
  replacementForTaskId?: string | null;
  /** 任务退回南宫婉重新处理的时间；从未退回时为 null。 */
  returnedToNangongAt: string | null;
  /** 自升级任务要修改能力的目标成员；普通任务为 null。 */
  selfUpgradeTargetMemberId: string | null;
  /** 自升级任务被授权修改的能力范围；普通任务为 null。 */
  selfUpgradeCapabilityScope: string | null;
  /** 允许创建本任务的演化审批记录；普通任务为 null。 */
  sourceEvolutionApprovalId: string | null;
  /** complete 表示历史完整，legacy-partial 表示旧数据只能恢复部分历史。 */
  historyCompleteness: "complete" | "legacy-partial";
  /** 任务提交时冻结且后续不能改变的原始需求。 */
  snapshot: CollaborationTaskSnapshotOutDto;
  /** 按版本保存的需求分析计划。 */
  plans: CollaborationRequirementPlanOutDto[];
  /** 按分配顺序保存的执行历史。 */
  executionRecords: CollaborationExecutionRecordOutDto[];
  /** 按发生顺序保存的任务流程事件。 */
  flowEvents: CollaborationFlowEventOutDto[];
  /** 为任务创建的隔离版本工作区；尚未准备时为 null。 */
  versionWorkspace: CollaborationVersionWorkspaceOutDto | null;
  /** 当前集成失败的定位信息；没有集成失败时为 null。 */
  integrationFailure?: CollaborationIntegrationFailureOutDto | null;
  /** 必须由客户解除卡点时显示的行动指导。 */
  customerActionGuidance?: CollaborationCustomerActionGuidanceOutDto | null;
  /** 执行者返回的原始最终结果；尚未结束时为 null。 */
  finalResult: string | null;
  /** 面向用户整理后的结构化结果；尚未汇总时为 null。 */
  resultSummary: CollaborationResultSummaryOutDto | null;
  /** 当前任务无法继续的原因；未阻塞时为 null。 */
  blockingReason: string | null;
  /** 恢复成功后应回到的任务状态；不在恢复流程时为 null。 */
  recoveryTargetState: CollaborationTaskStateValue | null;
  /** Workflow 开始处理任务的时间。 */
  startedAt: string;
  /** 执行者完成代码级验证的时间；尚未验证时为 null。 */
  codeVerifiedAt: string | null;
  /** 任务记录创建时间。 */
  createdAt: string;
  /** 任务记录最后更新时间。 */
  updatedAt: string;
  /** 任务进入终态的时间；仍在处理中为 null。 */
  completedAt: string | null;
}
