/**
 * 对话发送、排队和会话恢复协议。
 *
 * 生产者：Renderer 对话输入和主进程 ConversationDispatchStore。
 * 消费者：CodexService、preload 白名单和 Renderer 队列状态视图。
 * 数据方向：renderer <-> preload <-> main。
 * 本文件不持久化对话正文，也不决定队列调度策略。
 */
import type { Locale, ManagedExecutionMode, SandboxMode } from "../foundation/base.js";

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
