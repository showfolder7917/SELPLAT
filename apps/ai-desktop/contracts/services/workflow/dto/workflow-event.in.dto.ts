// EventSeverityValue 表示事件对系统和用户的严重程度。
import type { EventSeverityValue } from "../../../foundation/index.js";
// WorkflowEventCategoryValue 把事件归入稳定的业务类别。
import type { WorkflowEventCategoryValue } from "../value/workflow-event.value.js";
// WorkflowEventStatusValue 表示异常事件当前是否仍需处理。
import type { WorkflowEventStatusValue } from "../value/workflow-event.value.js";
// WorkflowFlowImpactValue 说明事件是否阻断原业务流程。
import type { WorkflowFlowImpactValue } from "../value/workflow-event.value.js";

/**
 * 进入 Workflow 持久化和监督边界的事件事实。
 *
 * 生产者：Workflow 调用方和 Event Center 投影端口。
 * 消费者：Workflow Repository。
 * 数据方向：调用方 -> Workflow。
 * 本 DTO 不负责异常规范化，也不触发 Renderer 展示行为。
 */
/** 调用方准备写入 Workflow 事件存储的一项事实。 */
export interface WorkflowEventInDto {
  /** 调用方预先生成的事件标识；省略时由 Workflow 创建。 */
  eventId?: string;
  /** 串联同一业务流程的关联标识。 */
  correlationId?: string | null;
  /** 产生事件的来源对象类别。 */
  sourceType?: "member" | "system" | "launcher" | "task";
  /** 产生事件的具体对象标识。 */
  sourceId?: string;
  /** 调用方定义的具体事件名称。 */
  eventType: string;
  /** 标准业务类别；省略时由 Workflow 规范化。 */
  category?: WorkflowEventCategoryValue;
  /** 严重程度；省略时由 Workflow 规范化。 */
  severity?: EventSeverityValue;
  /** 初始处理状态；省略时由 Workflow 选择默认值。 */
  status?: WorkflowEventStatusValue;
  /** 只有明确阻断原流程且具备恢复上下文的事件才能设为 blocked。 */
  flowImpact?: WorkflowFlowImpactValue;
  /** 面向监督者阅读的事件说明。 */
  message?: string;
  /** 调查和恢复所需的结构化补充事实。 */
  payload?: Record<string, unknown>;
  /** 用于识别重复事件的内容指纹。 */
  fingerprint?: string | null;
  /** 事件真实发生时间；省略时使用接收时间。 */
  occurredAt?: string;
}
