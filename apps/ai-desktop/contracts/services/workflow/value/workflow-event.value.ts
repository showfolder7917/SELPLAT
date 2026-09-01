/**
 * Workflow 事件表维护的分类与处理状态。
 *
 * 生产者：Workflow Repository 与监督流程。
 * 消费者：Workflow 事件输入、异常输出和恢复查询。
 * 数据方向：Workflow 内部持久化边界 -> 监督与恢复调用方。
 * 本文件不定义跨域严重级别，也不负责 Event Center 的异常规范化。
 */

/** Workflow 事件表维护的业务分类。 */
export type WorkflowEventCategoryValue = "state-change" | "approval" | "execution" | "technical-error" | "business-exception" | "stalled" | "audit";

/** Workflow 监督和恢复流程维护的处理状态。 */
export type WorkflowEventStatusValue = "observed" | "open" | "processing" | "resolved" | "ignored";
