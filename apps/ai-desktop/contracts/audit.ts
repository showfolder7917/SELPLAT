import type { Locale, ManagedExecutionMode, SandboxMode, WorkspacePermission } from "./base.js";

export interface AuditReason {
  code: string;
  message: string;
}

export interface AuditTaskSummary {
  taskId: string;
  startedAt: string;
  completedAt: string | null;
  status: "running" | "completed" | "partial" | "failed" | "interrupted";
  request: string;
  locale: Locale;
  sandboxMode: SandboxMode;
  workspaces: { path: string; permission: WorkspacePermission }[];
  attachmentCount: number;
  turnId: string | null;
  changedFiles: string[];
  commands: { id: string; command: string; phase: string; status: string | null; exitCode: number | null }[];
  reasons: AuditReason[];
  managedMode?: ManagedExecutionMode;
  managedStatus?: "conversation-ready" | "requirement-ready" | "code-verified" | "test-verified" | "incomplete";
  pendingActions?: string[];
  bundleState: { sourceMtimeMs: number; bundleMtimeMs: number; stale: boolean };
}

export interface AuditLogInfo {
  path: string;
  taskCount: number;
  latestTask: AuditTaskSummary | null;
}
