/**
 * 业务审计查询协议，描述一次受管任务的请求上下文、执行结果和失败原因。
 *
 * 生产者：主进程 BusinessAuditLog。
 * 消费者：Renderer 审计视图和诊断导出流程。
 * 数据方向：main -> preload -> renderer。
 * 本文件不得记录令牌、完整环境变量或未经裁剪的敏感命令输出。
 */
import type { Locale, ManagedExecutionMode, SandboxMode, WorkspacePermission } from "../foundation/base.js";

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
