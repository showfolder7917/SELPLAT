import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { resolveArchiveMonth } from "@selplat/node-common-core/path";

import type {
  AuditLogInfo,
  AuditReason,
  AuditTaskSummary,
  CodexStreamEvent,
  Locale,
  ManagedExecutionMode,
  SandboxMode,
  WorkspaceState,
} from "../../contracts/desktop.js";

interface ActiveAuditTask extends AuditTaskSummary {
  commandIds: Set<string>;
  completedCommandIds: Set<string>;
  successfulCommands: string[];
  latestTurnStatus: string | null;
}

interface StartAuditTaskRequest {
  message: string;
  locale: Locale;
  sandboxMode: SandboxMode;
  workspaces: WorkspaceState;
  attachmentCount: number;
  managedMode: ManagedExecutionMode;
}

type BusinessEventSink = (event: { occurredAt: string; type: string; taskId: string | null; details: Record<string, unknown> }) => void;

/** 把每轮任务事实写入工程统一归档目录，供用户追查“改到哪一步、为什么未完整生效”。 */
export class BusinessAuditLog {
  readonly #sourceRoot: string;
  readonly #buildRoot: string;
  readonly #logRoot: string;
  readonly #taskRoot: string;
  readonly #diagnosticRoot: string;
  readonly #activeTasks = new Map<string, ActiveAuditTask>();
  #eventSink: BusinessEventSink | null = null;

  constructor(sourceRoot: string, buildRoot: string, logRoot: string) {
    this.#sourceRoot = path.resolve(sourceRoot);
    this.#buildRoot = path.resolve(buildRoot);
    this.#logRoot = path.resolve(logRoot);
    this.#taskRoot = path.join(this.#logRoot, "执行归档");
    this.#diagnosticRoot = path.join(this.#logRoot, "诊断归档");
  }

  ensure(): string {
    mkdirSync(this.#taskRoot, { recursive: true });
    mkdirSync(this.#diagnosticRoot, { recursive: true });
    return this.#logRoot;
  }

  /** 将既有文件审计入口同时投影到统一数据库；数据库失败不会吞掉原始 JSONL 事实。 */
  setEventSink(eventSink: BusinessEventSink | null): void {
    this.#eventSink = eventSink;
  }

  recordApplicationStart(details: Record<string, unknown>): void {
    this.recordEvent("application.started", {
      ...details,
      processId: process.pid,
      bundleState: this.#bundleState(),
    });
  }

  recordEvent(type: string, details: Record<string, unknown> = {}, taskId?: string): void {
    this.ensure();
    const occurredAt = new Date().toISOString();
    const event = { occurredAt, type, taskId: taskId || null, ...details };
    const dailyLogPath = this.#dailyLogPath();
    appendFileSync(dailyLogPath, `${JSON.stringify(event)}\n`, "utf8");
    try {
      this.#eventSink?.({ occurredAt, type, taskId: taskId || null, details });
    } catch (error) {
      appendFileSync(dailyLogPath, `${JSON.stringify({
        occurredAt: new Date().toISOString(),
        type: "event-center.persistence_failed",
        taskId: taskId || null,
        sourceEventType: type,
        message: error instanceof Error ? error.message : String(error),
      })}\n`, "utf8");
    }
  }

  startTask(request: StartAuditTaskRequest): string {
    const taskId = `${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
    const startedAt = new Date().toISOString();
    const task: ActiveAuditTask = {
      taskId,
      startedAt,
      completedAt: null,
      status: "running",
      request: request.message.slice(0, 4_000),
      locale: request.locale,
      sandboxMode: request.sandboxMode,
      workspaces: request.workspaces.roots.map((root) => ({ path: root.path, permission: root.permission })),
      attachmentCount: request.attachmentCount,
      managedMode: request.managedMode,
      managedStatus: undefined,
      pendingActions: [],
      turnId: null,
      changedFiles: [],
      commands: [],
      reasons: [],
      bundleState: this.#bundleState(),
      commandIds: new Set(),
      completedCommandIds: new Set(),
      successfulCommands: [],
      latestTurnStatus: null,
    };
    this.#activeTasks.set(taskId, task);
    this.#writeTask(task);
    this.recordEvent("task.started", {
      request: task.request,
      sandboxMode: task.sandboxMode,
      workspaces: task.workspaces,
      attachmentCount: task.attachmentCount,
      managedMode: task.managedMode,
    }, taskId);
    return taskId;
  }

  recordStreamEvent(taskId: string, event: CodexStreamEvent): void {
    const task = this.#activeTasks.get(taskId);
    if (!task) return;
    task.turnId ||= event.turnId;
    if (event.type === "diff-updated") {
      task.changedFiles = [...new Set([...task.changedFiles, ...(event.changedFiles || [])])];
    }
    if (event.type === "turn-completed") task.latestTurnStatus = event.status || "completed";
    if (event.type === "activity" && event.activity) {
      const activity = event.activity;
      if (activity.itemType === "fileChange" && activity.summary) {
        task.changedFiles = [...new Set([...task.changedFiles, ...activity.summary.split("\n").filter(Boolean)])];
      }
      if (activity.itemType === "commandExecution" && activity.phase !== "output") {
        if (activity.phase === "started") task.commandIds.add(activity.id);
        if (activity.phase === "completed") task.completedCommandIds.add(activity.id);
        const command = activity.summary || "(command unavailable)";
        const existing = task.commands.findIndex((entry) => entry.id === activity.id);
        const entry = {
          id: activity.id,
          command,
          phase: activity.phase,
          status: activity.status,
          exitCode: activity.exitCode ?? null,
        };
        if (existing >= 0) task.commands[existing] = entry;
        else task.commands.push(entry);
        if (activity.phase === "completed" && (activity.exitCode === 0 || activity.status === "completed")) {
          task.successfulCommands.push(command);
        }
      }
    }
    this.recordEvent(`harness.${event.type}`, this.#safeStreamDetails(event), taskId);
    this.#writeTask(task);
  }

  recordApproval(taskId: string | undefined, requestId: number, decision: "accept" | "decline", trusted = false): void {
    this.recordEvent("approval.resolved", { requestId, decision, trusted }, taskId);
    const approvalRoot = path.join(this.#logRoot, "审批归档", resolveArchiveMonth(new Date().toISOString()));
    mkdirSync(approvalRoot, { recursive: true });
    const target = path.join(approvalRoot, `${taskId || "system"}-${requestId}.json`);
    writeFileSync(target, `${JSON.stringify({ taskId: taskId || null, requestId, decision, trusted, resolvedAt: new Date().toISOString() }, null, 2)}\n`, "utf8");
  }

  finishTask(
    taskId: string,
    outcome: "completed" | "failed" | "interrupted",
    error?: string,
    managedStatus?: "conversation-ready" | "requirement-ready" | "code-verified" | "test-verified" | "incomplete",
    pendingActions: string[] = [],
  ): void {
    const task = this.#activeTasks.get(taskId);
    if (!task) return;
    task.completedAt = new Date().toISOString();
    task.bundleState = this.#bundleState();
    task.managedStatus = managedStatus;
    task.pendingActions = pendingActions;
    const effectiveOutcome = task.latestTurnStatus === "interrupted" ? "interrupted" : task.latestTurnStatus === "failed" ? "failed" : outcome;
    task.reasons = this.#diagnose(task, effectiveOutcome, error);
    task.status = managedStatus === "incomplete"
      ? "partial"
      : effectiveOutcome === "completed" && task.reasons.length === 0 ? "completed" : effectiveOutcome === "failed" ? "failed" : effectiveOutcome === "interrupted" ? "interrupted" : "partial";
    this.recordEvent("task.finished", {
      status: task.status,
      changedFiles: task.changedFiles,
      commandCount: task.commands.length,
      reasons: task.reasons,
      managedMode: task.managedMode,
      managedStatus: task.managedStatus,
      pendingActions: task.pendingActions,
      bundleState: task.bundleState,
    }, taskId);
    this.#writeTask(task);
    this.#activeTasks.delete(taskId);
  }

  info(): AuditLogInfo {
    this.ensure();
    const files = listFilesRecursively(this.#taskRoot, "摘要.json").sort().reverse();
    let latestTask: AuditTaskSummary | null = null;
    for (const name of files) {
      try {
        latestTask = JSON.parse(readFileSync(name, "utf8")) as AuditTaskSummary;
        break;
      } catch {
        // 单个损坏摘要不阻断其余日志查询，原始 JSONL 仍保留完整事件。
      }
    }
    return { path: this.#logRoot, taskCount: files.length, latestTask };
  }

  #diagnose(task: ActiveAuditTask, outcome: string, error?: string): AuditReason[] {
    const reasons: AuditReason[] = [];
    const successful = task.successfulCommands.join("\n");
    if (outcome === "failed") reasons.push({ code: "harness_failed", message: error || "Codex Harness 报告本轮失败。" });
    if (outcome === "interrupted") reasons.push({ code: "turn_interrupted", message: "本轮在完成前被取消。" });
    if (task.commandIds.size > task.completedCommandIds.size) reasons.push({ code: "command_not_completed", message: "存在已开始但没有完成记录的命令。" });
    if (task.managedStatus !== "code-verified" && task.managedStatus !== "test-verified" && task.commands.some((command) => command.phase === "completed" && (command.status === "failed" || (command.exitCode !== null && command.exitCode !== 0)))) {
      reasons.push({ code: "command_failed", message: "至少一个命令以失败状态结束。" });
    }
    if (task.managedMode === "task-managed" && task.changedFiles.length > 0 && task.managedStatus !== "code-verified") {
      if (!/(typecheck|tsc|lint|check)/i.test(successful)) reasons.push({ code: "static_check_not_observed", message: "最后一次源码修改后未观察到成功的静态检查。" });
      if (!/(test|vitest|jest|pytest|unittest)/i.test(successful)) reasons.push({ code: "targeted_test_not_observed", message: "最后一次源码修改后未观察到成功的针对性快速测试。" });
      if (!/(test:interaction|playwright\s+test)/i.test(successful)) reasons.push({ code: "isolated_interaction_test_not_observed", message: "最后一次源码修改后未观察到成功的后台隔离 Electron 交互测试。" });
    }
    return reasons;
  }

  #safeStreamDetails(event: CodexStreamEvent): Record<string, unknown> {
    if (event.type === "message-delta" || event.type === "reasoning-summary-delta" || event.type === "message-completed") {
      return { turnId: event.turnId, itemId: event.itemId || null };
    }
    return {
      turnId: event.turnId,
      activity: event.activity || null,
      plan: event.plan || null,
      changedFiles: event.changedFiles || null,
      status: event.status || null,
      error: event.error || null,
      managedExecution: event.managedExecution || null,
    };
  }

  #bundleState(): AuditTaskSummary["bundleState"] {
    const sourceMtimeMs = latestMtime(path.join(this.#sourceRoot, "src"), path.join(this.#sourceRoot, "electron"), path.join(this.#sourceRoot, "shared"), path.join(this.#sourceRoot, "package.json"));
    const bundleMtimeMs = latestMtime(path.join(this.#buildRoot, "renderer", "developer"), path.join(this.#buildRoot, "electron"));
    return { sourceMtimeMs, bundleMtimeMs, stale: sourceMtimeMs > bundleMtimeMs };
  }

  #writeTask(task: ActiveAuditTask): void {
    this.ensure();
    const serializable: AuditTaskSummary = {
      taskId: task.taskId,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      status: task.status,
      request: task.request,
      locale: task.locale,
      sandboxMode: task.sandboxMode,
      workspaces: task.workspaces,
      attachmentCount: task.attachmentCount,
      turnId: task.turnId,
      changedFiles: task.changedFiles,
      commands: task.commands,
      reasons: task.reasons,
      managedMode: task.managedMode,
      managedStatus: task.managedStatus,
      pendingActions: task.pendingActions,
      bundleState: task.bundleState,
    };
    const taskDirectory = path.join(this.#taskRoot, resolveArchiveMonth(task.startedAt), task.taskId);
    mkdirSync(taskDirectory, { recursive: true });
    const target = path.join(taskDirectory, "摘要.json");
    const temporary = `${target}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(serializable, null, 2)}\n`, "utf8");
    renameSync(temporary, target);
  }

  #dailyLogPath(): string {
    const monthlyRoot = path.join(this.#diagnosticRoot, resolveArchiveMonth(new Date().toISOString()));
    mkdirSync(monthlyRoot, { recursive: true });
    return path.join(monthlyRoot, "运行诊断.jsonl");
  }
}

function listFilesRecursively(root: string, fileName: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) return listFilesRecursively(target, fileName);
    return entry.isFile() && entry.name === fileName ? [target] : [];
  });
}

function latestMtime(...targets: string[]): number {
  let latest = 0;
  const visit = (target: string): void => {
    if (!existsSync(target)) return;
    const stat = statSync(target);
    latest = Math.max(latest, stat.mtimeMs);
    if (!stat.isDirectory()) return;
    for (const name of readdirSync(target)) visit(path.join(target, name));
  };
  for (const target of targets) visit(target);
  return latest;
}
