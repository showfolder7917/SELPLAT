/**
 * 南宫婉对话输出协议。
 * 生产者：南宫婉对话应用服务；消费者：Evolution 状态聚合与 Renderer 南宫婉页面。
 * 数据方向：南宫婉 -> Evolution/Renderer。
 * 本文件不定义用户输入、专题审批或持久化实现。
 */
export interface NangongConversationMessageOutDto {
  messageId: string;
  sequenceNumber: number;
  role: "user" | "nangong";
  content: string;
  replyToMessageId: string | null;
  deliveryStatus: "sending" | "completed" | "failed";
  inferredIntent?: string;
  attachmentIds?: string[];
  createdAt: string;
  completedAt: string | null;
}

export interface NangongConversationOutDto {
  conversationId: string;
  messages: NangongConversationMessageOutDto[];
  updatedAt: string;
}
