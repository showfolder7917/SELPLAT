/** 韩立自由对话输出；消息正文与派生语义分离，Renderer 只显示真实对话正文。 */
export interface HanliConversationMessageOutDto {
  messageId: string;
  sequenceNumber: number;
  role: "user" | "hanli" | "nangong";
  content: string;
  replyToMessageId: string | null;
  deliveryStatus: "sending" | "completed" | "failed";
  inferredIntent?: string;
  attachmentIds?: string[];
  createdAt: string;
  completedAt: string | null;
}

export interface HanliConversationOutDto {
  conversationId: string | null;
  messages: HanliConversationMessageOutDto[];
  updatedAt: string;
}
