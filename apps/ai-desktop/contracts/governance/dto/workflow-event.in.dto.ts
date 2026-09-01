import type { WorkflowEventCategoryValue, WorkflowEventSeverityValue, WorkflowEventStatusValue } from "../value/workflow-event.value.js";

export interface WorkflowEventInDto {
  eventId?: string; correlationId?: string | null; sourceType?: "member" | "system" | "launcher" | "task";
  sourceId?: string; eventType: string; category?: WorkflowEventCategoryValue; severity?: WorkflowEventSeverityValue;
  status?: WorkflowEventStatusValue; message?: string; payload?: Record<string, unknown>; fingerprint?: string | null; occurredAt?: string;
}

export interface EventCenterExceptionInDto {
  kind: "technical" | "business" | "stalled"; sourceType?: "member" | "system" | "launcher" | "task";
  sourceId: string; operation: string; error: unknown; correlationId?: string | null; details?: Record<string, unknown>;
  severity?: WorkflowEventSeverityValue; fingerprint?: string | null;
}

export interface RendererExceptionInDto {
  operation: "window.error" | "window.unhandledrejection" | "react.error-boundary"; message: string;
  stack?: string | null; componentStack?: string | null; url?: string | null;
}
