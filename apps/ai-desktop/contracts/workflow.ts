import type { CollaborationState } from "./collaboration.js";
import type { LinghuAutomationState } from "./linghu-automation.js";
import type { NangongEvolutionState } from "./nangong-evolution.js";

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
