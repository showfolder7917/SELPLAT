/**
 * Workflow 协作流程追加事件输出协议。
 *
 * 生产者：Workflow 协调器。
 * 消费者：事件中心、时间线投影和 Renderer。
 * 数据方向：Workflow -> 事件消费者。
 * 本文件只描述已经发生的事件，不改变任务状态或推断人物身份。
 */

// CollaborationFlowEventTypeValue 列出 Workflow 当前允许发布的流程事件名称。
import type { CollaborationFlowEventTypeValue } from "../value/collaboration-flow-event.value.js";
// CollaborationCustomerActionGuidanceOutDto 为客户介入事件提供可执行的处理说明。
import type { CollaborationCustomerActionGuidanceOutDto } from "./collaboration-customer-action-guidance.out.dto.js";
// CollaborationParticipantSnapshotOutDto 固定事件发生时参与人物的身份。
import type { CollaborationParticipantSnapshotOutDto } from "./collaboration-member.out.dto.js";

/** 流程事件可能携带的补充事实；没有对应事实的字段保持未定义。 */
export interface CollaborationFlowEventDetailsOutDto {
  /** 同一执行租约中的验证或自修序号，用于关联开始与结束事件。 */
  validationRound?: number;
  /** 与该事件关联的任务分配标识。 */
  assignmentId?: string;
  /** 失败发生的业务阶段。 */
  failureStage?: string;
  /** 面向人员阅读的失败摘要。 */
  failureSummary?: string;
  /** 支持失败或修复结论的技术事实。 */
  technicalEvidence?: string[];
  /** 失败发生时的原执行者。 */
  originalExecutor?: CollaborationParticipantSnapshotOutDto | null;
  /** 决定把任务交给其他人物处理的路由者。 */
  routedBy?: CollaborationParticipantSnapshotOutDto | null;
  /** 被分配调查或修复任务的人物。 */
  repairAssignee?: CollaborationParticipantSnapshotOutDto | null;
  /** 修复人物给出的诊断结论。 */
  repairDiagnosis?: string;
  /** 原执行者完成修复后返回的结果。 */
  repairResult?: string;
  /** 修复流程结束后应重新接手任务的原执行者。 */
  returnToExecutor?: CollaborationParticipantSnapshotOutDto | null;
  /** 当前流程正在等待的后续任务；没有依赖任务时为 null。 */
  waitingForTaskId?: string | null;
  /** 只有客户能够解除卡点时生成的处理指导。 */
  customerActionGuidance?: CollaborationCustomerActionGuidanceOutDto;
}

/** 追加到任务历史中的一个不可变流程事实。 */
export interface CollaborationFlowEventOutDto {
  /** 事件的稳定唯一标识。 */
  eventId: string;
  /** 事件的标准业务名称。 */
  type: CollaborationFlowEventTypeValue;
  /** 事件发生在任务生命周期的哪个阶段。 */
  stage: "task" | "analysis" | "execution" | "integration" | "recovery";
  /** 该事件所描述动作的执行结果。 */
  status: "started" | "completed" | "failed" | "waiting" | "cancelled";
  /** 触发该事件的人物；系统事件为 null。 */
  actor: CollaborationParticipantSnapshotOutDto | null;
  /** 面向任务卡显示的一行摘要。 */
  summary: string;
  /** 事件真实发生的时间。 */
  occurredAt: string;
  /** 是否应按错误事件突出显示。 */
  error: boolean;
  /** 当前事件特有的补充事实；没有补充信息时为 null 或省略。 */
  details?: CollaborationFlowEventDetailsOutDto | null;
}
