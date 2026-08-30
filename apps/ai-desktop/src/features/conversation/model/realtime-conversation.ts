export type RealtimeConversationStatus = "sending" | "streaming" | "completed" | "failed" | "queued";

export interface RealtimeConversationMessage {
  messageId: string;
  sequenceNumber: number;
  replyToMessageId: string | null;
  status: RealtimeConversationStatus;
  createdAt: string;
}

/**
 * 把运行态消息与尚未收到服务端确认的本地消息投影为一条时间线。
 * 相同 messageId 始终以运行态事实为准；本地消息只能补位，不能被固定追加到回复之后。
 */
export function mergeRealtimeConversationTimeline<T extends RealtimeConversationMessage>(persisted: T[], local: T[]): T[] {
  const byId = new Map<string, T>();
  for (const message of local) byId.set(message.messageId, message);
  for (const message of persisted) byId.set(message.messageId, message);
  return [...byId.values()].sort((left, right) => left.sequenceNumber - right.sequenceNumber
    || left.createdAt.localeCompare(right.createdAt)
    || left.messageId.localeCompare(right.messageId));
}

