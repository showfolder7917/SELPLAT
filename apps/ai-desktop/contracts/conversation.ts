import type { Locale, ManagedExecutionMode, SandboxMode } from "./base.js";

export interface SendMessageRequest {
  message: string;
  locale: Locale;
  sandboxMode: SandboxMode;
  attachmentIds: string[];
  executionMode: ManagedExecutionMode;
  queueItemId?: string;
}

export interface SendMessageResponse {
  text: string;
  itemCount: number;
  threadId?: string;
  managedStatus?: "conversation-ready" | "requirement-ready" | "code-verified" | "test-verified" | "incomplete";
  pendingActions?: string[];
  disposition?: "completed" | "queued";
  queueItemId?: string;
}

export interface ConversationQueueItem {
  id: string;
  request: SendMessageRequest;
  displayText: string;
  createdAt: string;
  automatic: boolean;
}

export interface ConversationDispatchState {
  activeTask: {
    id: string;
    request: SendMessageRequest;
    startedAt: string;
    status: "running" | "recoverable";
  } | null;
  queue: ConversationQueueItem[];
}

export interface EnqueueMessageRequest {
  request: SendMessageRequest;
  displayText?: string;
  automatic?: boolean;
}

export interface CodexSessionInfo {
  threadId: string | null;
}
