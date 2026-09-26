import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { resolveArchiveMonth } from "@selplat/node-common-core/path";
import { validateSafeIdentifier } from "@selplat/node-common-core/validation";

export type CollaborationDurationSegment =
  | "executor-queue"
  | "analysis"
  | "reviewer-wait"
  | "review"
  | "rework"
  | "codex-startup"
  | "worktree-prepare"
  | "source-change"
  | "verification"
  | "preflight"
  | "integration"
  | "release"
  | "integration-wait"
  | "conflict-resolution"
  | "combination-test"
  | "restart-health"
  | "result-acceptance"
  | "approval-wait"
  | "user-wait"
  | "dependency-wait"
  | "recovery";

export type CollaborationWaitType = "system-wait" | "dependency-wait" | "approval-wait" | "user-wait" | "intent-wait" | "recovery-wait";

interface ActiveSpan {
  spanId: string;
  taskId: string;
  segment: CollaborationDurationSegment;
  startedAt: string;
  startedMonotonicMs: number;
  details: Record<string, unknown>;
}

interface CompletedSpanEvent {
  type: "collaboration.duration.completed";
  spanId: string;
  taskId: string;
  segment: CollaborationDurationSegment;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  outcome: "completed" | "failed" | "interrupted";
  details: Record<string, unknown>;
}

export interface CollaborationBottleneckReport {
  generation: number;
  taskIds: string[];
  generatedAt: string;
  totalObservedDurationMs: number;
  segmentDurationMs: Partial<Record<CollaborationDurationSegment, number>>;
  waitDurationMs: Partial<Record<CollaborationWaitType, number>>;
  longestWait: { taskId: string; segment: CollaborationDurationSegment; durationMs: number; reasonCode: string | null } | null;
  primaryBottleneck: string | null;
  evidence: string[];
}

export interface CollaborationTaskDurationEvidence {
  taskId: string;
  candidateSha: string | null;
  resultSha: string | null;
  bindingStatus: "available" | "candidate-missing" | "result-missing" | "execution-attempt-missing";
  completedSegments: CollaborationDurationSegment[];
  missingSegments: CollaborationDurationSegment[];
  events: Array<Pick<CompletedSpanEvent, "segment" | "startedAt" | "endedAt" | "durationMs" | "outcome">>;
}

type DurationEvidenceTask = {
  taskId: string;
  assignmentId?: string | null;
  executionRecords?: Array<{ assignmentId?: string | null }>;
  versionWorkspace?: { resultSha?: string | null } | null;
  flowEvents?: Array<{ details?: { candidateSha?: string | null } | null }>;
};

/** 把协同阶段耗时和等待归因写入日志文件，人物页面不读取或展示这些明细。 */
export class CollaborationDurationLog {
  readonly #root: string;
  readonly #active = new Map<string, ActiveSpan>();

  constructor(collaborationArchiveRoot: string) {
    this.#root = path.resolve(collaborationArchiveRoot);
  }

  start(taskId: string, segment: CollaborationDurationSegment, details: Record<string, unknown> = {}): string {
    const spanId = randomUUID();
    const span: ActiveSpan = {
      spanId,
      taskId,
      segment,
      startedAt: new Date().toISOString(),
      startedMonotonicMs: performance.now(),
      details: sanitizeDetails(details),
    };
    this.#active.set(spanId, span);
    this.#append({
      type: "collaboration.duration.started",
      spanId,
      taskId,
      segment,
      startedAt: span.startedAt,
      details: span.details,
    });
    return spanId;
  }

  startWait(
    taskId: string,
    segment: CollaborationDurationSegment,
    waitType: CollaborationWaitType,
    reasonCode: string,
    resource: string,
    resourceOwner: string | null,
  ): string {
    return this.start(taskId, segment, { waitType, reasonCode, resource, resourceOwner });
  }

  finish(spanId: string, outcome: CompletedSpanEvent["outcome"] = "completed", details: Record<string, unknown> = {}): void {
    const span = this.#active.get(spanId);
    if (!span) return;
    this.#active.delete(spanId);
    const event: CompletedSpanEvent = {
      type: "collaboration.duration.completed",
      spanId,
      taskId: span.taskId,
      segment: span.segment,
      startedAt: span.startedAt,
      endedAt: new Date().toISOString(),
      durationMs: Math.max(0, Math.round(performance.now() - span.startedMonotonicMs)),
      outcome,
      details: { ...span.details, ...sanitizeDetails(details) },
    };
    this.#append(event);
  }

  instant(taskId: string, event: string, details: Record<string, unknown> = {}): void {
    this.#append({
      type: "collaboration.event",
      event,
      taskId,
      occurredAt: new Date().toISOString(),
      details: sanitizeDetails(details),
    });
  }

  writeGenerationReport(generation: number, taskIds: string[]): CollaborationBottleneckReport {
    const taskSet = new Set(taskIds);
    const events = this.#readEvents()
      .map(parseCompletedSpanEvent)
      .filter((event): event is CompletedSpanEvent => event !== null)
      .filter((event) => taskSet.has(event.taskId));
    const segmentDurationMs: CollaborationBottleneckReport["segmentDurationMs"] = {};
    const waitDurationMs: CollaborationBottleneckReport["waitDurationMs"] = {};
    let longestWait: CollaborationBottleneckReport["longestWait"] = null;
    for (const event of events) {
      segmentDurationMs[event.segment] = (segmentDurationMs[event.segment] || 0) + event.durationMs;
      const waitType = event.details.waitType;
      if (isWaitType(waitType)) {
        waitDurationMs[waitType] = (waitDurationMs[waitType] || 0) + event.durationMs;
        if (!longestWait || event.durationMs > longestWait.durationMs) {
          longestWait = {
            taskId: event.taskId,
            segment: event.segment,
            durationMs: event.durationMs,
            reasonCode: typeof event.details.reasonCode === "string" ? event.details.reasonCode : null,
          };
        }
      }
    }
    const ranked = Object.entries(segmentDurationMs).sort((left, right) => right[1] - left[1]);
    const primaryBottleneck = ranked[0]?.[0] || null;
    const report: CollaborationBottleneckReport = {
      generation,
      taskIds: [...taskSet],
      generatedAt: new Date().toISOString(),
      totalObservedDurationMs: events.reduce((total, event) => total + event.durationMs, 0),
      segmentDurationMs,
      waitDurationMs,
      longestWait,
      primaryBottleneck,
      evidence: ranked.slice(0, 3).map(([segment, durationMs]) => `${segment}:${durationMs}ms`),
    };
    const reportRoot = this.#reportRoot(report.generatedAt);
    this.#writeJson(path.join(reportRoot, `integration-generation-${generation}.json`), report);
    this.#writeTrend();
    return report;
  }

  readTaskEvidence(task: DurationEvidenceTask, requiredSegments: readonly CollaborationDurationSegment[]): CollaborationTaskDurationEvidence {
    const candidateSha = [...(task.flowEvents || [])].reverse()
      .map((event) => event.details?.candidateSha || null)
      .find((value): value is string => typeof value === "string" && /^[a-f0-9]{40,64}$/iu.test(value)) || null;
    const resultSha = task.versionWorkspace?.resultSha && /^[a-f0-9]{40,64}$/iu.test(task.versionWorkspace.resultSha)
      ? task.versionWorkspace.resultSha : null;
    const executionAttemptId = task.assignmentId || [...(task.executionRecords || [])].reverse()
      .map((record) => record.assignmentId || null)
      .find((value): value is string => typeof value === "string" && value.length > 0) || null;
    const bindingStatus = !candidateSha ? "candidate-missing"
      : !resultSha ? "result-missing"
        : !executionAttemptId ? "execution-attempt-missing"
          : "available";
    const candidateBoundSegments = new Set<CollaborationDurationSegment>(["preflight", "combination-test", "release", "restart-health", "result-acceptance"]);
    const events = this.#readEvents().map(parseCompletedSpanEvent)
      .filter((event): event is CompletedSpanEvent => event !== null && event.taskId === task.taskId)
      .filter((event) => candidateBoundSegments.has(event.segment)
        ? event.details.candidateSha === candidateSha
        : event.details.executionAttemptId === executionAttemptId);
    const completedSegments = [...new Set(events.filter((event) => event.outcome === "completed").map((event) => event.segment))];
    return {
      taskId: task.taskId, candidateSha, resultSha, bindingStatus, completedSegments,
      missingSegments: bindingStatus === "available" ? requiredSegments.filter((segment) => !completedSegments.includes(segment)) : [...requiredSegments],
      events: events.map(({ segment, startedAt, endedAt, durationMs, outcome }) => ({ segment, startedAt, endedAt, durationMs, outcome })),
    };
  }

  interruptOpenSpans(reason: string): void {
    for (const spanId of [...this.#active.keys()]) this.finish(spanId, "interrupted", { releaseEvent: reason });
  }

  #writeTrend(): void {
    const reportRoot = this.#reportRoot(new Date().toISOString());
    this.#ensure(reportRoot);
    const reports = readdirSync(reportRoot)
      .filter((name) => /^integration-generation-\d+\.json$/.test(name))
      .flatMap((name) => {
        try { return [JSON.parse(readFileSync(path.join(reportRoot, name), "utf8")) as CollaborationBottleneckReport]; }
        catch { return []; }
      });
    const bottleneckCounts: Record<string, number> = {};
    for (const report of reports) if (report.primaryBottleneck) bottleneckCounts[report.primaryBottleneck] = (bottleneckCounts[report.primaryBottleneck] || 0) + 1;
    this.#writeJson(path.join(reportRoot, "trend.json"), {
      generatedAt: new Date().toISOString(),
      generationCount: reports.length,
      bottleneckCounts,
      stableBottlenecks: Object.entries(bottleneckCounts).filter(([, count]) => count >= 3).map(([segment]) => segment),
    });
  }

  #readEvents(): Array<Record<string, unknown>> {
    this.#ensure(this.#root);
    return listFilesRecursively(this.#root, "流程事件.jsonl")
      .flatMap((filePath) => readFileSync(filePath, "utf8").split("\n").filter(Boolean).flatMap((line) => {
        try { return [JSON.parse(line) as Record<string, unknown>]; }
        catch { return []; }
      }));
  }

  #append(event: object): void {
    const value = event as { taskId?: unknown; startedAt?: unknown; occurredAt?: unknown };
    const taskId = validateSafeIdentifier(String(value.taskId || "system"), "taskId");
    const occurredAt = typeof value.startedAt === "string" ? value.startedAt : typeof value.occurredAt === "string" ? value.occurredAt : new Date().toISOString();
    const taskRoot = path.join(this.#root, resolveArchiveMonth(occurredAt), taskId);
    this.#ensure(taskRoot);
    appendFileSync(path.join(taskRoot, "流程事件.jsonl"), `${JSON.stringify(event)}\n`, "utf8");
  }

  #writeJson(filePath: string, value: unknown): void {
    this.#ensure(path.dirname(filePath));
    const temporary = `${filePath}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    renameSync(temporary, filePath);
  }

  #ensure(target: string): void {
    mkdirSync(target, { recursive: true });
  }

  #reportRoot(occurredAt: string): string {
    return path.join(this.#root, resolveArchiveMonth(occurredAt), "system", "集成报告");
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

function parseCompletedSpanEvent(value: Record<string, unknown>): CompletedSpanEvent | null {
  if (
    value.type !== "collaboration.duration.completed"
    || typeof value.spanId !== "string"
    || typeof value.taskId !== "string"
    || !isDurationSegment(value.segment)
    || typeof value.startedAt !== "string"
    || typeof value.endedAt !== "string"
    || typeof value.durationMs !== "number"
    || !isDurationOutcome(value.outcome)
    || !isPlainRecord(value.details)
  ) return null;
  return {
    type: value.type,
    spanId: value.spanId,
    taskId: value.taskId,
    segment: value.segment,
    startedAt: value.startedAt,
    endedAt: value.endedAt,
    durationMs: value.durationMs,
    outcome: value.outcome,
    details: value.details,
  };
}

function isDurationSegment(value: unknown): value is CollaborationDurationSegment {
  return typeof value === "string" && [
    "executor-queue", "analysis", "reviewer-wait", "review", "rework", "codex-startup",
    "worktree-prepare", "source-change", "verification", "preflight", "integration", "release", "integration-wait", "conflict-resolution",
    "combination-test", "restart-health", "result-acceptance", "approval-wait", "user-wait", "dependency-wait", "recovery",
  ].includes(value);
}

function isDurationOutcome(value: unknown): value is CompletedSpanEvent["outcome"] {
  return value === "completed" || value === "failed" || value === "interrupted";
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isWaitType(value: unknown): value is CollaborationWaitType {
  return value === "system-wait" || value === "dependency-wait" || value === "approval-wait" || value === "user-wait" || value === "intent-wait" || value === "recovery-wait";
}

function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (/token|secret|password|reasoning|screen|pixel/i.test(key)) continue;
    if (typeof value === "string") safe[key] = value.slice(0, 2_000);
    else if (typeof value === "number" || typeof value === "boolean" || value === null) safe[key] = value;
  }
  return safe;
}
