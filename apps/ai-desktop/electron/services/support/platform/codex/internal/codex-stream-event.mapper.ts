import type { CodexStreamActivityOutDto, CodexStreamEventOutDto, CodexStreamPlanStepOutDto } from "../../../../../../contracts/services/support/platform/codex/index.js";

type JsonObject = Record<string, unknown>;

/** 把官方 app-server 通知收敛成渲染层允许消费的稳定、最小化实时事件。 */
export function toCodexStreamEvent(method: string, params: JsonObject, turnId: string): CodexStreamEventOutDto | null {
  if (method === "turn/started") return { type: "turn-started", turnId, segmentId: `${turnId}:turn`, status: "inProgress" };
  if (method === "item/agentMessage/delta") {
    const itemId = stringValue(params.itemId) || "agent";
    return { type: "message-delta", turnId, segmentId: `${turnId}:${itemId}`, itemId, delta: stringValue(params.delta) || "" };
  }
  if (method === "item/reasoning/summaryTextDelta") return { type: "reasoning-summary-delta", turnId, itemId: stringValue(params.itemId) || undefined, delta: stringValue(params.delta) || "" };
  // 原始 reasoning textDelta 不进入 UI，只显示官方单独提供的可读 summaryTextDelta。
  if (method === "item/reasoning/textDelta") return null;
  if (method === "item/commandExecution/outputDelta") {
    return { type: "activity", turnId, activity: { id: stringValue(params.itemId) || "command-output", itemType: "commandExecution", phase: "output", status: "inProgress", summary: null, detail: truncate(stringValue(params.delta), 2_000) } };
  }
  if (method === "turn/plan/updated") {
    const plan = Array.isArray(params.plan)
      ? params.plan.map(asObject).map((entry): CodexStreamPlanStepOutDto => ({ step: stringValue(entry.step) || "", status: normalizePlanStatus(entry.status) })).filter((entry) => entry.step)
      : [];
    return { type: "plan-updated", turnId, plan };
  }
  if (method === "turn/diff/updated") return { type: "diff-updated", turnId, changedFiles: changedFilesFromDiff(stringValue(params.diff) || "") };
  if (method === "item/started" || method === "item/completed") {
    const item = asObject(params.item);
    const itemId = stringValue(item.id) || "unknown-item";
    if (item.type === "userMessage") return null;
    if (method === "item/completed" && item.type === "agentMessage") return { type: "message-completed", turnId, segmentId: `${turnId}:${itemId}`, itemId, text: stringValue(item.text) || "" };
    return { type: "activity", turnId, activity: createStreamActivity(item, itemId, method === "item/started" ? "started" : "completed") };
  }
  if (method === "turn/completed") {
    const turn = asObject(params.turn);
    const error = stringValue(asObject(turn.error).message) || undefined;
    return { type: "turn-completed", turnId, segmentId: `${turnId}:turn`, status: stringValue(turn.status) || "completed", error };
  }
  if (method === "error") return { type: "error", turnId, error: stringValue(asObject(params.error).message) || "Codex stream failed." };
  return null;
}

function createStreamActivity(item: JsonObject, itemId: string, phase: "started" | "completed"): CodexStreamActivityOutDto {
  const itemType = stringValue(item.type) || "unknown";
  return {
    id: itemId,
    itemType,
    phase,
    status: stringValue(item.status),
    summary: summarizeStreamItem(itemType, item),
    detail: phase === "completed" && itemType === "commandExecution" ? truncate(stringValue(item.aggregatedOutput), 2_000) : null,
    exitCode: numberValue(item.exitCode) ?? undefined,
  };
}

function summarizeStreamItem(itemType: string, item: JsonObject): string | null {
  if (itemType === "commandExecution") return truncate(displayValue(item.command), 800);
  if (itemType === "fileChange") {
    const paths = Array.isArray(item.changes) ? item.changes.map(asObject).map((change) => stringValue(change.path)).filter((value): value is string => Boolean(value)) : [];
    return paths.join("\n") || null;
  }
  if (itemType === "mcpToolCall") return [stringValue(item.server), stringValue(item.tool)].filter(Boolean).join(" / ") || null;
  if (itemType === "dynamicToolCall" || itemType === "collabToolCall") return stringValue(item.tool);
  if (itemType === "webSearch") return stringValue(item.query);
  if (itemType === "imageView") return stringValue(item.path);
  if (itemType === "enteredReviewMode" || itemType === "exitedReviewMode") return stringValue(item.review);
  return null;
}

function normalizePlanStatus(value: unknown): CodexStreamPlanStepOutDto["status"] {
  return value === "inProgress" || value === "completed" ? value : "pending";
}

function changedFilesFromDiff(diff: string): string[] {
  const paths = new Set<string>();
  for (const line of diff.split("\n")) {
    const path = /^diff --git a\/.+ b\/(.+)$/.exec(line)?.[1] || /^\+\+\+ b\/(.+)$/.exec(line)?.[1];
    if (path && path !== "/dev/null") paths.add(path);
  }
  return [...paths];
}

function truncate(value: string | null, maximum: number): string | null {
  if (!value) return null;
  return value.length <= maximum ? value : `${value.slice(0, maximum)}…`;
}

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function displayValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return null;
  return JSON.stringify(value, null, 2);
}
