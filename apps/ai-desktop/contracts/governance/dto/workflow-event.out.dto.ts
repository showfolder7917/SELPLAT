import type { WorkflowEventCategoryValue, WorkflowEventSeverityValue, WorkflowEventStatusValue } from "../value/workflow-event.value.js";

export interface WorkflowExceptionRecordOutDto {
  eventId: string; correlationId: string | null; sourceType: "member" | "system" | "launcher" | "task";
  sourceId: string; eventType: string; category: Extract<WorkflowEventCategoryValue, "technical-error" | "business-exception" | "stalled">;
  severity: WorkflowEventSeverityValue; status: Extract<WorkflowEventStatusValue, "open" | "processing">;
  message: string; payload: Record<string, unknown>; fingerprint: string | null; occurredAt: string;
  handlingOwnerId: string | null; handlingStartedAt: string | null;
}

export interface StalledTaskDetectionOutDto {
  taskId: string; workflowId: string | null; proposalId: string | null; executorMemberId: string | null;
  lastHeartbeatAt: string; timeoutAt: string; retryCount: number; maxRetries: number; blockingKind: string; blockingReason: string | null;
}
