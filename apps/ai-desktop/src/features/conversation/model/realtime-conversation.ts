export type RealtimeConversationStatus = "sending" | "streaming" | "completed" | "failed" | "queued";

export interface RealtimeConversationMessage {
  messageId: string;
  sequenceNumber: number;
  replyToMessageId: string | null;
  status: RealtimeConversationStatus;
  createdAt: string;
}

/**
 * 把人物会话的内部传递状态转换为客户可读文字。
 *
 * sending 表示消息已经交给人物服务、人物回复仍在处理中；它不是“尚未发送”。
 * completed 表示同一条消息已经由持久快照接管。两种成功状态对客户都显示“已发送”。
 */
export function personaConversationDeliveryLabel(status: "sending" | "completed" | "failed"): "已发送" | "发送失败" {
  // 只有服务明确返回失败时才显示失败；处理中和已持久化都已经完成客户侧发送动作。
  if (status === "failed") return "发送失败";
  // 人物是否仍在思考由按钮和活动区表达，不能继续占用消息传递文案。
  return "已发送";
}

/**
 * 为尚未持久化的新消息分配当前可见时间线的末尾顺序号。
 *
 * 客户显示窗口会过滤内部消息，因此可见条数不等于数据库 sequenceNumber；
 * 这里必须从实际可见顺序号取最大值，避免临时消息短暂插到旧回复上方。
 */
export function nextRealtimeConversationSequence(messages: ReadonlyArray<Pick<RealtimeConversationMessage, "sequenceNumber">>): number {
  return messages.reduce((next, message) => Number.isSafeInteger(message.sequenceNumber)
    ? Math.max(next, message.sequenceNumber + 1)
    : next, 0);
}

/** 统一人物会话按持久化业务类型投影；不读取 Renderer 临时正文或 messageId 命名。 */
export function projectPersonaConversation<T extends {
  messageId: string;
  messageType: "customer-visible" | "internal-recovery" | "internal-deliberation";
  contentRole: "conversation" | "technical-evidence";
  sequenceNumber: number;
  replyToMessageId: string | null;
  speakerType: "user" | "persona" | "system";
  speakerPersonaId: string | null;
  deliveryStatus: "sending" | "completed" | "failed";
}>(messages: T[]): { direct: T[]; internal: T[] } {
  return {
    direct: messages.filter((message) => message.messageType === "customer-visible"),
    internal: messages.filter((message) => message.messageType === "internal-deliberation"),
  };
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
