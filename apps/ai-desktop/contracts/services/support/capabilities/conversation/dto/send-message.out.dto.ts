/** 对话能力返回的消息结果；不包含 Codex 子进程或会话实现。 */
export interface SendMessageOutDto {
  text: string;
  /** 本轮按发生顺序保存的独立人物消息；机器结果消费者不得再从拼接后的 text 猜测边界。 */
  agentMessages?: string[];
  itemCount: number;
  threadId?: string;
  managedStatus?: "conversation-ready" | "requirement-ready" | "code-verified" | "test-verified" | "incomplete";
  pendingActions?: string[];
  disposition?: "completed" | "queued";
  queueItemId?: string;
}
