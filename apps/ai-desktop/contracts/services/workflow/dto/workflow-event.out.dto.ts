// EventSeverityValue 表示事件对系统和用户的严重程度。
import type { EventSeverityValue } from "../../../foundation/index.js";
// WorkflowEventCategoryValue 提供 Workflow 事件的标准业务类别。
import type { WorkflowEventCategoryValue } from "../value/workflow-event.value.js";
// WorkflowEventStatusValue 提供异常事件的标准处理状态。
import type { WorkflowEventStatusValue } from "../value/workflow-event.value.js";
// WorkflowFlowImpactValue 说明事件是否阻断原业务流程。
import type { WorkflowFlowImpactValue } from "../value/workflow-event.value.js";

/**
 * Workflow 输出给异常接手流程的未处理事件记录。
 *
 * 生产者：Workflow Repository。
 * 消费者：Workflow Supervisor 与令狐自动保障流程。
 * 数据方向：Workflow -> 监督与恢复调用方。
 * 本 DTO 只描述已持久化事实，不决定接手人或状态迁移。
 */
/** 已持久化并等待监督或恢复流程处理的异常事件。 */
export interface WorkflowExceptionRecordOutDto {
  /** 事件的稳定唯一标识。 */
  eventId: string;
  /** 串联同一业务流程的关联标识。 */
  correlationId: string | null;
  /** 产生事件的来源对象类别。 */
  sourceType: "member" | "system" | "launcher" | "task";
  /** 产生事件的具体对象标识。 */
  sourceId: string;
  /** 生产者定义的具体事件名称。 */
  eventType: string;
  /** 这里只返回需要监督处理的异常类事件。 */
  category: Extract<WorkflowEventCategoryValue, "technical-error" | "business-exception" | "stalled">;
  /** 事件严重程度。 */
  severity: EventSeverityValue;
  /** 未处理事件只能处于待处理或处理中。 */
  status: Extract<WorkflowEventStatusValue, "open" | "processing">;
  /** 该事件对原业务流程的影响。 */
  flowImpact: WorkflowFlowImpactValue;
  /** 面向监督者阅读的事件说明。 */
  message: string;
  /** 调查和恢复所需的结构化补充事实。 */
  payload: Record<string, unknown>;
  /** 用于识别重复事件的内容指纹。 */
  fingerprint: string | null;
  /** 事件真实发生时间。 */
  occurredAt: string;
  /** 当前接手处理的人物标识；尚未接手时为 null。 */
  handlingOwnerId: string | null;
  /** 当前处理开始时间；尚未接手时为 null。 */
  handlingStartedAt: string | null;
}

/**
 * Workflow 停滞检测输出；由监督流程消费，不能替代任务状态或直接执行恢复。
 */
export interface StalledTaskDetectionOutDto {
  /** 被检测为停滞的任务标识。 */
  taskId: string;
  /** 任务所属的 Workflow 实例；无法关联时为 null。 */
  workflowId: string | null;
  /** 产生任务的提案；普通任务为 null。 */
  proposalId: string | null;
  /** 停滞发生时的执行者；尚未分配时为 null。 */
  executorMemberId: string | null;
  /** 最近一次收到执行者心跳的时间。 */
  lastHeartbeatAt: string;
  /** 超过该时间仍无进展时应判定停滞。 */
  timeoutAt: string;
  /** 当前已经自动重试的次数。 */
  retryCount: number;
  /** 允许自动重试的最大次数。 */
  maxRetries: number;
  /** 当前卡点的标准业务类别。 */
  blockingKind: string;
  /** 面向监督者阅读的卡点原因。 */
  blockingReason: string | null;
}
