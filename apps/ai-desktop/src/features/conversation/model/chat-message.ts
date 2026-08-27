import type { CodexStreamActivity, CodexStreamEvent, CodexStreamPlanStep, ManagedExecutionMode, ManagedExecutionUpdate, ScreenshotAttachment } from "../../../../contracts/desktop/desktop";

export type ComposerAttachment = ScreenshotAttachment & { dataUrl: string };

export type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  attachments?: ComposerAttachment[];
  streaming?: boolean;
  streamStatus?: string;
  streamError?: string;
  reasoningSummary?: string;
  activities?: CodexStreamActivity[];
  plan?: CodexStreamPlanStep[];
  changedFiles?: string[];
  managedExecution?: ManagedExecutionUpdate;
  managedMode?: ManagedExecutionMode;
  actionTriggered?: boolean;
  turnOrder?: string[];
  turnSegments?: Record<string, string>;
  streamTerminal?: boolean;
  collaborationTaskId?: string;
};

const ACTIVE_CHAT_STORAGE_KEY = "ai-desktop.active-chat.v1";

/** 每个真实 Harness 回合使用一张独立回复卡，禁止后续回合复用并覆盖已有文字。 */
export function createAssistantMessage(id: number, managedMode: ManagedExecutionMode): Message {
  return { id, role: "assistant", text: "", streaming: true, streamStatus: "starting", activities: [], plan: [], changedFiles: [], managedMode };
}

export function applyCodexStreamEvent(message: Message, event: CodexStreamEvent): Message {
  if (message.streamTerminal && event.type !== "error") return message;
  if (event.type === "message-delta") return updateTurnSegment(message, event.segmentId || event.turnId, (current) => `${current}${event.delta || ""}`, "responding");
  if (event.type === "message-completed") return updateTurnSegment(message, event.segmentId || event.turnId, (current) => event.text ?? current, "responding");
  if (event.type === "reasoning-summary-delta") return { ...message, reasoningSummary: `${message.reasoningSummary || ""}${event.delta || ""}`, streamStatus: "reasoning" };
  if (event.type === "activity" && event.activity) return { ...message, activities: upsertStreamActivity(message.activities || [], event.activity), streamStatus: event.activity.itemType };
  if (event.type === "plan-updated") return { ...message, plan: event.plan || [], streamStatus: "planning" };
  if (event.type === "diff-updated") return { ...message, changedFiles: event.changedFiles || [], streamStatus: "fileChange" };
  if (event.type === "turn-completed") return { ...message, streaming: false, streamStatus: event.status || "completed", streamError: event.error };
  if (event.type === "managed-execution" && event.managedExecution) {
    const terminal = event.managedExecution.stage === "completed" || event.managedExecution.status === "blocked";
    return { ...message, streaming: !terminal, streamTerminal: terminal, streamStatus: terminal ? (event.managedExecution.status === "blocked" ? "failed" : "completed") : event.managedExecution.stage, managedExecution: event.managedExecution };
  }
  if (event.type === "error") return { ...message, streaming: false, streamTerminal: true, streamStatus: "failed", streamError: event.error };
  if (event.type === "turn-started") return updateTurnSegment(message, event.turnId, (current) => current, "inProgress", true);
  return message;
}

function updateTurnSegment(message: Message, turnId: string, update: (current: string) => string, streamStatus: string, streaming = message.streaming): Message {
  const order = message.turnOrder?.includes(turnId) ? message.turnOrder : [...(message.turnOrder || []), turnId];
  const segments = { ...(message.turnSegments || {}), [turnId]: update(message.turnSegments?.[turnId] || "") };
  const text = order.map((id) => segments[id] || "").filter((segment, index) => segment.length > 0 || index === order.length - 1).join("\n\n");
  return { ...message, text, turnOrder: order, turnSegments: segments, streaming, streamStatus };
}

export function readStoredChat(threadId: string): { executionMode: ManagedExecutionMode; messages: Message[] } | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(ACTIVE_CHAT_STORAGE_KEY) || "null") as { version?: number; threadId?: string; executionMode?: ManagedExecutionMode; messages?: unknown[] } | null;
    if (!value || value.version !== 1 || value.threadId !== threadId || !isManagedExecutionModeValue(value.executionMode)) return null;
    const messages = (value.messages || []).flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as Partial<Message>;
      if (!Number.isSafeInteger(candidate.id) || (candidate.role !== "user" && candidate.role !== "assistant") || typeof candidate.text !== "string") return [];
      return [{ ...candidate, id: candidate.id as number, role: candidate.role, text: candidate.text, streaming: false } as Message];
    }).slice(-200);
    return { executionMode: value.executionMode, messages };
  } catch {
    return null;
  }
}

export function writeStoredChat(threadId: string, executionMode: ManagedExecutionMode, messages: Message[]): void {
  window.localStorage.setItem(ACTIVE_CHAT_STORAGE_KEY, JSON.stringify({ version: 1, threadId, executionMode, messages }));
}

export function clearStoredChat(): void {
  window.localStorage.removeItem(ACTIVE_CHAT_STORAGE_KEY);
}

function isManagedExecutionModeValue(value: unknown): value is ManagedExecutionMode {
  return value === "conversation-managed" || value === "requirement-managed" || value === "task-managed" || value === "test-managed";
}

export function managedModeForCommand(command: string, current: ManagedExecutionMode): ManagedExecutionMode | null {
  const normalized = command.trim();
  if (normalized === "1") return nextManagedMode(current);
  if (current === "conversation-managed" && normalized === "就是这意思") return "requirement-managed";
  if (current === "requirement-managed" && normalized === "按这个方案执行") return "task-managed";
  if ((current === "task-managed" || current === "test-managed") && normalized === "测试一下") return "test-managed";
  return null;
}

export function nextManagedMode(current: ManagedExecutionMode): ManagedExecutionMode {
  if (current === "conversation-managed") return "requirement-managed";
  if (current === "requirement-managed") return "task-managed";
  return "test-managed";
}

function upsertStreamActivity(current: CodexStreamActivity[], incoming: CodexStreamActivity): CodexStreamActivity[] {
  const index = current.findIndex((activity) => activity.id === incoming.id);
  if (index < 0) return [...current, incoming].slice(-12);
  const next = [...current];
  const previous = next[index];
  next[index] = { ...previous, ...incoming, summary: incoming.summary || previous.summary, detail: incoming.phase === "output" ? `${previous.detail || ""}${incoming.detail || ""}`.slice(-2_000) : incoming.detail || previous.detail };
  return next;
}
