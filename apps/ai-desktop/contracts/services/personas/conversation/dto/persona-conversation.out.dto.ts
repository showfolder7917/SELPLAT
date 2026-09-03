/** 人物会话中的发言主体类型；具体人物由 speakerPersonaId 标识，不再扩充固定角色枚举。 */
export type PersonaConversationSpeakerTypeValue = "user" | "persona" | "system";

/** 所有人物页面共用的消息协议。 */
export interface PersonaConversationMessageOutDto {
  messageId: string;
  sequenceNumber: number;
  speakerType: PersonaConversationSpeakerTypeValue;
  /** 用户和系统消息为 null；人物消息填写稳定 personaId。 */
  speakerPersonaId: string | null;
  content: string;
  replyToMessageId: string | null;
  deliveryStatus: "sending" | "completed" | "failed";
  inferredIntent?: string;
  attachmentIds?: string[];
  createdAt: string;
  completedAt: string | null;
}

/** 统一人物会话快照；ownerPersonaId 决定页面所属人物，发言人由每条消息单独记录。 */
export interface PersonaConversationOutDto {
  ownerPersonaId: string;
  conversationId: string | null;
  messages: PersonaConversationMessageOutDto[];
  updatedAt: string;
}
