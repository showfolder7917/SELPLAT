import type { CodexStreamActivityOutDto, CodexStreamEventOutDto, CodexStreamPlanStepOutDto, ManagedExecutionModeValue, ManagedExecutionUpdateEventOutDto, ScreenshotAttachmentOutDto } from "../../../../contracts/system/desktop/desktop";
import type { RealtimeConversationMessage } from "./realtime-conversation";

export type ComposerAttachment = ScreenshotAttachmentOutDto & { dataUrl: string };

export type Message = RealtimeConversationMessage & {
  id: number;
  role: "user" | "assistant";
  text: string;
  attachments?: ComposerAttachment[];
  streaming?: boolean;
  streamStatus?: string;
  streamError?: string;
  reasoningSummary?: string;
  activities?: CodexStreamActivityOutDto[];
  plan?: CodexStreamPlanStepOutDto[];
  changedFiles?: string[];
  managedExecution?: ManagedExecutionUpdateEventOutDto;
  managedMode?: ManagedExecutionModeValue;
  actionTriggered?: boolean;
  turnOrder?: string[];
  turnSegments?: Record<string, string>;
  streamTerminal?: boolean;
  collaborationTaskId?: string;
};

const ACTIVE_CHAT_STORAGE_KEY = "ai-desktop.active-chat.v2";
const RETIRED_CHAT_STORAGE_KEYS = ["ai-desktop.active-chat.v1"];

export function createUserMessage(id: number, text: string, attachments: ComposerAttachment[]): Message {
  return {
    id, messageId: `codex-message-${id}`, sequenceNumber: id, replyToMessageId: null,
    status: "sending", createdAt: new Date().toISOString(), role: "user", text, attachments,
  };
}

/** 每个真实 Harness 回合使用一张独立回复卡，禁止后续回合复用并覆盖已有文字。 */
export function createAssistantMessage(id: number, managedMode: ManagedExecutionModeValue, replyToMessageId: string | null = null): Message {
  return {
    id, messageId: `codex-message-${id}`, sequenceNumber: id, replyToMessageId,
    status: "streaming", createdAt: new Date().toISOString(), role: "assistant", text: "", streaming: true,
    streamStatus: "starting", activities: [], plan: [], changedFiles: [], managedMode,
  };
}

export function applyCodexStreamEvent(message: Message, event: CodexStreamEventOutDto): Message {
  if (message.streamTerminal && event.type !== "error") return message;
  if (event.type === "message-delta") return updateTurnSegment(message, streamItemKey(event), (current) => `${current}${event.delta || ""}`, "responding");
  if (event.type === "message-completed") return updateTurnSegment(message, streamItemKey(event), (current) => event.text ?? current, "responding");
  if (event.type === "reasoning-summary-delta") return { ...message, reasoningSummary: `${message.reasoningSummary || ""}${event.delta || ""}`, streamStatus: "reasoning" };
  if (event.type === "activity" && event.activity) return { ...message, activities: upsertStreamActivity(message.activities || [], event.activity), streamStatus: event.activity.itemType };
  if (event.type === "plan-updated") return { ...message, plan: event.plan || [], streamStatus: "planning" };
  if (event.type === "diff-updated") return { ...message, changedFiles: event.changedFiles || [], streamStatus: "fileChange" };
  if (event.type === "turn-completed") return { ...message, status: event.error ? "failed" : "completed", streaming: false, streamStatus: event.status || "completed", streamError: event.error };
  if (event.type === "managed-execution" && event.managedExecution) {
    const terminal = event.managedExecution.stage === "completed" || event.managedExecution.status === "blocked";
    return { ...message, status: terminal ? (event.managedExecution.status === "blocked" ? "failed" : "completed") : "streaming", streaming: !terminal, streamTerminal: terminal, streamStatus: terminal ? (event.managedExecution.status === "blocked" ? "failed" : "completed") : event.managedExecution.stage, managedExecution: event.managedExecution };
  }
  if (event.type === "error") return { ...message, status: "failed", streaming: false, streamTerminal: true, streamStatus: "failed", streamError: event.error };
  if (event.type === "turn-started") return updateTurnSegment(message, event.turnId, (current) => current, "inProgress", true);
  return message;
}

function streamItemKey(event: CodexStreamEventOutDto): string {
  return [event.turnId, event.itemId || event.segmentId || "default"].join(":");
}

function updateTurnSegment(message: Message, turnId: string, update: (current: string) => string, streamStatus: string, streaming = message.streaming): Message {
  const order = message.turnOrder?.includes(turnId) ? message.turnOrder : [...(message.turnOrder || []), turnId];
  const segments = { ...(message.turnSegments || {}), [turnId]: update(message.turnSegments?.[turnId] || "") };
  const text = order.map((id) => segments[id] || "").filter((segment, index) => segment.length > 0 || index === order.length - 1).join("\n\n");
  return { ...message, text, turnOrder: order, turnSegments: segments, streaming, streamStatus };
}

export function readStoredChat(threadId: string): { executionMode: ManagedExecutionModeValue; messages: Message[] } | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(ACTIVE_CHAT_STORAGE_KEY) || "null") as { version?: number; threadId?: string; executionMode?: ManagedExecutionModeValue; messages?: unknown[] } | null;
    if (!value || value.version !== 2 || value.threadId !== threadId || !isManagedExecutionModeValue(value.executionMode)) return null;
    const messages = (value.messages || []).flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as Partial<Message>;
      if (!Number.isSafeInteger(candidate.id) || (candidate.role !== "user" && candidate.role !== "assistant") || typeof candidate.text !== "string"
        || typeof candidate.messageId !== "string" || !Number.isSafeInteger(candidate.sequenceNumber) || typeof candidate.createdAt !== "string") return [];
      return [{ ...candidate, id: candidate.id as number, role: candidate.role, text: candidate.text, streaming: false, status: candidate.status === "failed" ? "failed" : "completed" } as Message];
    }).slice(-200);
    return { executionMode: value.executionMode, messages };
  } catch {
    return null;
  }
}

export function writeStoredChat(threadId: string, executionMode: ManagedExecutionModeValue, messages: Message[]): void {
  window.localStorage.setItem(ACTIVE_CHAT_STORAGE_KEY, JSON.stringify({ version: 2, threadId, executionMode, messages }));
}

export function clearStoredChat(): void {
  window.localStorage.removeItem(ACTIVE_CHAT_STORAGE_KEY);
  RETIRED_CHAT_STORAGE_KEYS.forEach((storageKey) => window.localStorage.removeItem(storageKey));
}

function isManagedExecutionModeValue(value: unknown): value is ManagedExecutionModeValue {
  return value === "conversation-managed" || value === "requirement-managed" || value === "task-managed" || value === "test-managed";
}

export function managedModeForCommand(command: string, current: ManagedExecutionModeValue): ManagedExecutionModeValue | null {
  const normalized = command.trim();
  if (normalized === "1") return nextManagedMode(current);
  if (current === "conversation-managed" && normalized === "就是这意思") return "requirement-managed";
  if (current === "requirement-managed" && normalized === "按这个方案执行") return "task-managed";
  if ((current === "task-managed" || current === "test-managed") && normalized === "测试一下") return "test-managed";
  return null;
}

export function nextManagedMode(current: ManagedExecutionModeValue): ManagedExecutionModeValue {
  if (current === "conversation-managed") return "requirement-managed";
  if (current === "requirement-managed") return "task-managed";
  return "test-managed";
}

function upsertStreamActivity(current: CodexStreamActivityOutDto[], incoming: CodexStreamActivityOutDto): CodexStreamActivityOutDto[] {
  const index = current.findIndex((activity) => activity.id === incoming.id);
  if (index < 0) return [...current, incoming].slice(-12);
  const next = [...current];
  const previous = next[index];
  next[index] = { ...previous, ...incoming, summary: incoming.summary || previous.summary, detail: incoming.phase === "output" ? `${previous.detail || ""}${incoming.detail || ""}`.slice(-2_000) : incoming.detail || previous.detail };
  return next;
}
