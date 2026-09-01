import type { EventSeverityValue } from "../../../../../foundation/index.js";

/**
 * 进入 Event Center 的统一异常事实。
 *
 * 生产者：Electron 业务模块、IPC 边界和进程异常边界。
 * 消费者：EventCenterFacade。
 * 数据方向：业务或系统边界 -> Event Center。
 * 本 DTO 只描述待规范化异常，不负责 Workflow 持久化或恢复决策。
 */
export interface EventCenterExceptionInDto {
  kind: "technical" | "business" | "stalled";
  sourceType?: "member" | "system" | "launcher" | "task";
  sourceId: string;
  operation: string;
  error: unknown;
  correlationId?: string | null;
  details?: Record<string, unknown>;
  severity?: EventSeverityValue;
  fingerprint?: string | null;
}
