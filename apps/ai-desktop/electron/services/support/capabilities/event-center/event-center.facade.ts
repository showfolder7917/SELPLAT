import type { CodexStreamEventOutDto } from "../../../../../contracts/services/support/platform/codex/index.js";
import type { EventCenterExceptionInDto, RendererExceptionInDto } from "../../../../../contracts/services/support/capabilities/event-center/index.js";
import { BusinessAuditLog } from "./internal/audit/business-audit-log.js";
// Event Center 只要求审计事实写入口，不反向依赖 Workflow 的 Repository 实现。
export interface EventProjectionPort {
  // 事务提交后的事件事实由 Workflow 自己决定怎样投影到 SQLite。
  recordAuditEvent(type: string, details: Record<string, unknown>, taskId?: string, occurredAt?: string): unknown;
}

type StartTaskRequest = Parameters<BusinessAuditLog["startTask"]>[0];
type FinishTaskArguments = Parameters<BusinessAuditLog["finishTask"]>;

/** 应用唯一事件门面：业务只提交事实，不认识 JSONL、SQLite、令狐或异常分发实现。 */
export class EventCenterFacade {
  readonly #archive: BusinessAuditLog;
  #repository: EventProjectionPort | null = null;
  #processHandlersInstalled = false;

  constructor(archive: BusinessAuditLog) {
    this.#archive = archive;
  }

  attachRepository(repository: EventProjectionPort | null): void {
    this.#repository = repository;
    this.#archive.setEventSink(repository
      ? ({ occurredAt, type, taskId, details }) => repository.recordAuditEvent(type, details, taskId || undefined, occurredAt)
      : null);
  }

  installProcessExceptionBoundary(): void {
    if (this.#processHandlersInstalled) return;
    this.#processHandlersInstalled = true;
    process.on("uncaughtExceptionMonitor", (error, origin) => this.recordException({
      kind: "technical", sourceType: "launcher", sourceId: "electron-main", operation: "uncaught_exception",
      error, severity: "critical", details: { origin },
    }));
    process.on("unhandledRejection", (reason) => this.recordException({
      kind: "technical", sourceType: "launcher", sourceId: "electron-main", operation: "unhandled_rejection",
      error: reason, severity: "critical",
    }));
  }

  recordApplicationStart(details: Record<string, unknown>): void { this.#archive.recordApplicationStart(details); }
  recordEvent(type: string, details: Record<string, unknown> = {}, taskId?: string): void { this.#archive.recordEvent(type, details, taskId); }

  recordException(input: EventCenterExceptionInDto): void {
    const error = normalizeError(input.error);
    const category = input.kind === "business" ? "business.exception" : input.kind === "stalled" ? "workflow.stalled" : "technical.exception";
    this.recordEvent(category, {
      operation: input.operation,
      sourceType: input.sourceType || "system",
      sourceId: input.sourceId,
      message: error.message,
      errorName: error.name,
      stack: error.stack,
      severity: input.severity || (input.kind === "business" ? "warning" : "error"),
      fingerprint: input.fingerprint || null,
      ...input.details,
      flowImpact: input.flowImpact || "none",
    }, input.correlationId || undefined);
  }

  recordIpcException(channel: string, error: unknown, boundary: "business" | "technical" | "auto" = "auto"): void {
    const kind = boundary === "auto" ? (isBusinessException(error) ? "business" : "technical") : boundary;
    this.recordException({
      kind,
      sourceType: "system",
      sourceId: "electron-ipc",
      operation: channel,
      error,
      details: { channel },
    });
  }

  recordRendererException(input: RendererExceptionInDto): void {
    const error = new Error(input.message.slice(0, 4_000));
    if (input.stack) error.stack = input.stack.slice(0, 12_000);
    this.recordException({
      kind: "technical",
      sourceType: "system",
      sourceId: "electron-renderer",
      operation: input.operation.slice(0, 160),
      error,
      details: { componentStack: input.componentStack?.slice(0, 8_000) || null, url: input.url?.slice(0, 1_000) || null },
    });
  }

  startTask(request: StartTaskRequest): string { return this.#archive.startTask(request); }
  recordStreamEvent(taskId: string, event: CodexStreamEventOutDto): void { this.#archive.recordStreamEvent(taskId, event); }
  recordApproval(taskId: string | undefined, requestId: number, decision: "accept" | "decline", trusted = false): void { this.#archive.recordApproval(taskId, requestId, decision, trusted); }
  finishTask(...args: FinishTaskArguments): void { this.#archive.finishTask(...args); }
  ensure(): string { return this.#archive.ensure(); }
  info(): ReturnType<BusinessAuditLog["info"]> { return this.#archive.info(); }
  repository(): EventProjectionPort | null { return this.#repository; }
}

function normalizeError(error: unknown): { name: string; message: string; stack: string | null } {
  if (error instanceof Error) return { name: error.name || "Error", message: error.message || String(error), stack: error.stack || null };
  return { name: "NonError", message: typeof error === "string" ? error : safeJson(error), stack: null };
}

function safeJson(value: unknown): string {
  try { return JSON.stringify(value); } catch { return String(value); }
}

function isBusinessException(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /invalid|不能为空|不存在|至少|不能|只有|必须|需要人工|不符合|不在可|缺少真实|无效/u.test(message);
}
