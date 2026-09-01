import type { LocaleValue, ManagedExecutionModeValue, SandboxModeValue, WorkspacePermissionValue } from "../../foundation/index.js";

export interface AuditReasonOutDto { code: string; message: string; }

export interface AuditTaskSummaryOutDto {
  taskId: string; startedAt: string; completedAt: string | null;
  status: "running" | "completed" | "partial" | "failed" | "interrupted";
  request: string; locale: LocaleValue; sandboxMode: SandboxModeValue;
  workspaces: { path: string; permission: WorkspacePermissionValue }[]; attachmentCount: number;
  turnId: string | null; changedFiles: string[];
  commands: { id: string; command: string; phase: string; status: string | null; exitCode: number | null }[];
  reasons: AuditReasonOutDto[]; managedMode?: ManagedExecutionModeValue;
  managedStatus?: "conversation-ready" | "requirement-ready" | "code-verified" | "test-verified" | "incomplete";
  pendingActions?: string[]; bundleState: { sourceMtimeMs: number; bundleMtimeMs: number; stale: boolean };
}

export interface AuditLogInfoOutDto { path: string; taskCount: number; latestTask: AuditTaskSummaryOutDto | null; }
