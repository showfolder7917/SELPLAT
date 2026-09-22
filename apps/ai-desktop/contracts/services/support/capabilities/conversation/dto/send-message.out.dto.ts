/** 对话能力返回的消息结果；不包含 Codex 子进程或会话实现。 */
export interface SendMessageOutDto {
  text: string;
  /** 本轮按发生顺序保存的独立人物消息；机器结果消费者不得再从拼接后的 text 猜测边界。 */
  agentMessages?: string[];
  itemCount: number;
  threadId?: string;
  /** 本轮实际发生的线程恢复结果；普通连续发送不生成该字段。 */
  threadRecovery?: {
    status: "verified" | "unknown-turn" | "thread-unavailable" | "retryable" | "verification-incomplete";
    sourceThreadId: string | null;
    successorThreadId: string | null;
    /** 协议提供时保留异常回合与条目定位，不把告警直接解释为内容丢失。 */
    affectedTurnId?: string | null;
    affectedItemId?: string | null;
    summary: string;
  };
  managedStatus?: "conversation-ready" | "requirement-ready" | "code-verified" | "test-verified" | "incomplete";
  pendingActions?: string[];
  disposition?: "completed" | "queued";
  queueItemId?: string;
}
