/**
 * 跨领域事件严重级别。
 *
 * 生产者：Workflow 事件记录与 Event Center 异常规范化入口。
 * 消费者：Workflow Repository、监督流程和 Event Center。
 * 数据方向：作为稳定值随事件或异常协议跨领域传递。
 * 本文件只定义严重程度，不定义事件分类、处理状态或异常处理行为。
 */
export type EventSeverityValue = "info" | "warning" | "error" | "critical";
