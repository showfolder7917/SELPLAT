/** 对话能力返回的消息结果；不包含 Codex 子进程或会话实现。 */
export interface SendMessageOutDto {
  text: string;
  itemCount: number;
  threadId?: string;
  managedStatus?: "conversation-ready" | "requirement-ready" | "code-verified" | "test-verified" | "incomplete";
  pendingActions?: string[];
  disposition?: "completed" | "queued";
  queueItemId?: string;
}
