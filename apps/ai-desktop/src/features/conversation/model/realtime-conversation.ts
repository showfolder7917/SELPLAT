export type RealtimeConversationStatus = "sending" | "streaming" | "completed" | "failed" | "queued";

export interface RealtimeConversationMessage {
  messageId: string;
  sequenceNumber: number;
  replyToMessageId: string | null;
  status: RealtimeConversationStatus;
  createdAt: string;
}

/** 统一人物会话按页面用途投影；内部消息依据持久 ID 与关系字段，不读取 Renderer 临时正文。 */
export function projectPersonaConversation<T extends {
  messageId: string;
  sequenceNumber: number;
  replyToMessageId: string | null;
  speakerType: "user" | "persona" | "system";
  speakerPersonaId: string | null;
  deliveryStatus: "sending" | "completed" | "failed";
}>(messages: T[]): { direct: T[]; internal: T[] } {
  const byId = new Map(messages.map((message) => [message.messageId, message]));
  const internal = messages.filter((message) => isInternalDeliberationMessage(message, byId));
  // internal: 历史 assessment 是保留的业务事实，但不属于任何人物页面可见对话。
  return { direct: messages.filter((message) => !message.messageId.startsWith("internal:")), internal };
}

/** 兼容既有 internal: 历史 ID；内部答复与追问还需指向同一份已持久化消息关系。 */
function isInternalDeliberationMessage<T extends {
  messageId: string;
  sequenceNumber: number;
  replyToMessageId: string | null;
  speakerType: "user" | "persona" | "system";
  speakerPersonaId: string | null;
}>(message: T, byId: ReadonlyMap<string, T>): boolean {
  if (!message.messageId.startsWith("internal:") || message.messageId.endsWith(":assessment")) return false;
  if (message.speakerType !== "persona" || !["han-li", "nangong-wan"].includes(message.speakerPersonaId || "")) return false;
  // 首问既兼容旧记录的 null，也兼容引用触发本轮研讨的直接用户消息。
  if (message.messageId.endsWith(":question")) {
    if (!message.replyToMessageId) return true;
    const trigger = byId.get(message.replyToMessageId);
    return Boolean(trigger && trigger.sequenceNumber < message.sequenceNumber);
  }
  if (!message.replyToMessageId) return false;
  const parent = byId.get(message.replyToMessageId);
  return Boolean(parent && parent.messageId.startsWith("internal:") && parent.sequenceNumber < message.sequenceNumber);
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
