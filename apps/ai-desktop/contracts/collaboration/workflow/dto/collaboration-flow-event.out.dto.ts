/**
 * Workflow 协作流程追加事件输出协议。
 * 生产者：Workflow 协调器；消费者：事件中心、时间线投影和 Renderer。
 * 数据方向：Workflow -> 事件消费者。
 * 本文件不改变任务状态，也不推断人物身份。
 */
import type { CollaborationParticipantSnapshot, CollaborationWorkerPhase } from "./collaboration-member.out.dto.js";

export type CollaborationFlowEventType =
  | "task.submitted" | "task.legacy_imported" | "executor.assigned" | "executor.reassigned"
  | "technical_analysis.ready" | "execution.started" | `worker.phase.${Exclude<CollaborationWorkerPhase, null>}`
  | "task.code_verified" | "task.blocked" | "task.cancelled" | "task.interrupted" | "task.recovery_requested"
  | "execution.repair_queued" | "execution.repair_started" | "execution.repair_investigated" | "execution.repair_completed" | "execution.repair_waiting"
  | "integration.local_changes_transferred" | "integration.batch_frozen" | "integration.local_change_ownership_blocked"
  | "integration.merge_conflict" | "integration.candidate_preparation_failed" | "integration.infrastructure_failed" | "integration.conflict_correction_requested"
  | "evolution.task_collected" | "unified_test.started" | "unified_test.passed" | "unified_test.failed" | "unified_test.retry_requested"
  | "unified_test.repair_started" | "unified_test.repair_investigated" | "unified_test.repair_completed" | "unified_test.repair_failed"
  | "release.restart_healthy";

export interface CollaborationFlowEventDetails {
  failureStage?: string;
  failureSummary?: string;
  technicalEvidence?: string[];
  originalExecutor?: CollaborationParticipantSnapshot | null;
  routedBy?: CollaborationParticipantSnapshot | null;
  repairAssignee?: CollaborationParticipantSnapshot | null;
  repairDiagnosis?: string;
  repairResult?: string;
  returnToExecutor?: CollaborationParticipantSnapshot | null;
  waitingForTaskId?: string | null;
}

export interface CollaborationFlowEvent {
  eventId: string;
  type: CollaborationFlowEventType;
  stage: "task" | "analysis" | "execution" | "integration" | "recovery";
  status: "started" | "completed" | "failed" | "waiting" | "cancelled";
  actor: CollaborationParticipantSnapshot | null;
  summary: string;
  occurredAt: string;
  error: boolean;
  details?: CollaborationFlowEventDetails | null;
}
