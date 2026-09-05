import type { EventSeverityValue } from "../../../foundation/index.js";
import type { WorkflowEventCategoryValue, WorkflowEventStatusValue, WorkflowFlowImpactValue } from "../value/workflow-event.value.js";

/**
 * 进入 Workflow 持久化和监督边界的事件事实。
 *
 * 生产者：Workflow 调用方和 Event Center 投影端口。
 * 消费者：Workflow Repository。
 * 数据方向：调用方 -> Workflow。
 * 本 DTO 不负责异常规范化，也不触发 Renderer 展示行为。
 */
export interface WorkflowEventInDto {
  eventId?: string;
  correlationId?: string | null;
  sourceType?: "member" | "system" | "launcher" | "task";
  sourceId?: string;
  eventType: string;
  category?: WorkflowEventCategoryValue;
  severity?: EventSeverityValue;
  status?: WorkflowEventStatusValue;
  /** 只有明确阻断原流程且具备恢复上下文的事件才能设为 blocked。 */
  flowImpact?: WorkflowFlowImpactValue;
  message?: string;
  payload?: Record<string, unknown>;
  fingerprint?: string | null;
  occurredAt?: string;
}
