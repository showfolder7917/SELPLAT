import type { CollaborationFlowEventTypeValue } from "../value/collaboration-flow-event.value.js";
/**
 * Workflow 协作流程追加事件输出协议。
 * 生产者：Workflow 协调器；消费者：事件中心、时间线投影和 Renderer。
 * 数据方向：Workflow -> 事件消费者。
 * 本文件不改变任务状态，也不推断人物身份。
 */
import type { CollaborationParticipantSnapshotOutDto } from "./collaboration-member.out.dto.js";
import type { CollaborationWorkerPhaseValue } from "../value/collaboration-member.value.js";


export interface CollaborationFlowEventDetailsOutDto {
  /** 同一执行租约中的验证/自修序号，用于稳定关联开始与结束事实。 */
  validationRound?: number;
  assignmentId?: string;
  failureStage?: string;
  failureSummary?: string;
  technicalEvidence?: string[];
  originalExecutor?: CollaborationParticipantSnapshotOutDto | null;
  routedBy?: CollaborationParticipantSnapshotOutDto | null;
  repairAssignee?: CollaborationParticipantSnapshotOutDto | null;
  repairDiagnosis?: string;
  repairResult?: string;
  returnToExecutor?: CollaborationParticipantSnapshotOutDto | null;
  waitingForTaskId?: string | null;
}

export interface CollaborationFlowEventOutDto {
  eventId: string;
  type: CollaborationFlowEventTypeValue;
  stage: "task" | "analysis" | "execution" | "integration" | "recovery";
  status: "started" | "completed" | "failed" | "waiting" | "cancelled";
  actor: CollaborationParticipantSnapshotOutDto | null;
  summary: string;
  occurredAt: string;
  error: boolean;
  details?: CollaborationFlowEventDetailsOutDto | null;
}
