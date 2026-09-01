/**
 * Event Center 对外提供的审计读取协议。
 *
 * 生产者：BusinessAuditLog。
 * 消费者：DesktopApi 与 Renderer 审计视图。
 * 数据方向：Event Center -> DesktopApi -> Renderer。
 * 本文件只输出脱敏审计摘要，不提供日志写入或文件系统访问能力。
 */
import type { LocaleValue, ManagedExecutionModeValue, SandboxModeValue, WorkspacePermissionValue } from "../../../../../foundation/index.js";

/** Event Center 输出的单条审计原因。 */
export interface AuditReasonOutDto {
  code: string;
  message: string;
}

/**
 * Event Center 输出的任务审计摘要。
 *
 * 生产者：BusinessAuditLog。
 * 消费者：DesktopApi 与 Renderer 审计视图。
 * 数据方向：Event Center -> DesktopApi -> Renderer。
 * 本 DTO 不暴露文件句柄、进程对象或可写审计能力。
 */
export interface AuditTaskSummaryOutDto {
  taskId: string;
  startedAt: string;
  completedAt: string | null;
  status: "running" | "completed" | "partial" | "failed" | "interrupted";
  request: string;
  locale: LocaleValue;
  sandboxMode: SandboxModeValue;
  workspaces: { path: string; permission: WorkspacePermissionValue }[];
  attachmentCount: number;
  turnId: string | null;
  changedFiles: string[];
  commands: { id: string; command: string; phase: string; status: string | null; exitCode: number | null }[];
  reasons: AuditReasonOutDto[];
  managedMode?: ManagedExecutionModeValue;
  managedStatus?: "conversation-ready" | "requirement-ready" | "code-verified" | "test-verified" | "incomplete";
  pendingActions?: string[];
  bundleState: { sourceMtimeMs: number; bundleMtimeMs: number; stale: boolean };
}

/** Event Center 输出的审计日志位置与最新任务摘要；仅供读取，不授予路径写权限。 */
export interface AuditLogInfoOutDto {
  path: string;
  taskCount: number;
  latestTask: AuditTaskSummaryOutDto | null;
}
