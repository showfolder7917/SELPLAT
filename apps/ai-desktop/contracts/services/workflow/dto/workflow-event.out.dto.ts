import type { EventSeverityValue } from "../../../foundation/index.js";
import type { WorkflowEventCategoryValue, WorkflowEventStatusValue, WorkflowFlowImpactValue } from "../value/workflow-event.value.js";

/**
 * Workflow 输出给异常接手流程的未处理事件记录。
 *
 * 生产者：Workflow Repository。
 * 消费者：Workflow Supervisor 与令狐自动保障流程。
 * 数据方向：Workflow -> 监督与恢复调用方。
 * 本 DTO 只描述已持久化事实，不决定接手人或状态迁移。
 */
export interface WorkflowExceptionRecordOutDto {
  eventId: string;
  correlationId: string | null;
  sourceType: "member" | "system" | "launcher" | "task";
  sourceId: string;
  eventType: string;
  category: Extract<WorkflowEventCategoryValue, "technical-error" | "business-exception" | "stalled">;
  severity: EventSeverityValue;
  status: Extract<WorkflowEventStatusValue, "open" | "processing">;
  flowImpact: WorkflowFlowImpactValue;
  message: string;
  payload: Record<string, unknown>;
  fingerprint: string | null;
  occurredAt: string;
  handlingOwnerId: string | null;
  handlingStartedAt: string | null;
}

/**
 * Workflow 停滞检测输出；由监督流程消费，不能替代任务状态或直接执行恢复。
 */
export interface StalledTaskDetectionOutDto {
  taskId: string;
  workflowId: string | null;
  proposalId: string | null;
  executorMemberId: string | null;
  lastHeartbeatAt: string;
  timeoutAt: string;
  retryCount: number;
  maxRetries: number;
  blockingKind: string;
  blockingReason: string | null;
}
