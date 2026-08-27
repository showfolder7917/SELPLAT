/**
 * 工作流事件与异常协议，统一承载状态变化、业务阻塞和技术故障的跨进程快照。
 *
 * 生产者：主进程事件中心、协作监督器和 Renderer 异常上报入口。
 * 消费者：主进程恢复流程、Renderer 状态面板和审计模块。
 * 数据方向：renderer -> preload -> main，以及 main -> preload -> renderer。
 * 本文件只描述事件，不决定重试、忽略或恢复策略。
 */
import type { CollaborationState } from "../collaboration/collaboration.js";
import type { LinghuAutomationState } from "../collaboration/linghu-automation.js";
import type { NangongEvolutionState } from "../collaboration/nangong-evolution.js";

export type WorkflowEventCategory = "state-change" | "approval" | "execution" | "technical-error" | "business-exception" | "stalled" | "audit";
export type WorkflowEventSeverity = "info" | "warning" | "error" | "critical";
export type WorkflowEventStatus = "observed" | "open" | "processing" | "resolved" | "ignored";

export interface WorkflowEventInput {
  eventId?: string;
  correlationId?: string | null;
  sourceType?: "member" | "system" | "launcher" | "task";
  sourceId?: string;
  eventType: string;
  category?: WorkflowEventCategory;
  severity?: WorkflowEventSeverity;
  status?: WorkflowEventStatus;
  message?: string;
  payload?: Record<string, unknown>;
  fingerprint?: string | null;
  occurredAt?: string;
}

/** 统一事件中心交给监督器和令狐的可查询异常事实。 */
export interface WorkflowExceptionRecord {
  eventId: string;
  correlationId: string | null;
  sourceType: "member" | "system" | "launcher" | "task";
  sourceId: string;
  eventType: string;
  category: Extract<WorkflowEventCategory, "technical-error" | "business-exception" | "stalled">;
  severity: WorkflowEventSeverity;
  status: Extract<WorkflowEventStatus, "open" | "processing">;
  message: string;
  payload: Record<string, unknown>;
  fingerprint: string | null;
  occurredAt: string;
  handlingOwnerId: string | null;
  handlingStartedAt: string | null;
}

export interface EventCenterExceptionInput {
  kind: "technical" | "business" | "stalled";
  sourceType?: "member" | "system" | "launcher" | "task";
  sourceId: string;
  operation: string;
  error: unknown;
  correlationId?: string | null;
  details?: Record<string, unknown>;
  severity?: WorkflowEventSeverity;
  fingerprint?: string | null;
}

export interface RendererExceptionReport {
  operation: "window.error" | "window.unhandledrejection" | "react.error-boundary";
  message: string;
  stack?: string | null;
  componentStack?: string | null;
  url?: string | null;
}

export interface StalledTaskDetection {
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

export interface WorkflowStateReaders {
  collaboration(): CollaborationState;
  evolution(): NangongEvolutionState;
  linghu(): LinghuAutomationState;
}
