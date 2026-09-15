import type { PersonaConversationActivityOutDto } from "./persona-conversation-activity.out.dto.js";

/** 人物会话中的发言主体类型；具体人物由 speakerPersonaId 标识，不再扩充固定角色枚举。 */
export type PersonaConversationSpeakerTypeValue = "user" | "persona" | "system";

/** 消息的持久化业务类别；页面投影只能使用此字段，不能猜测 messageId 的命名含义。 */
export type PersonaConversationMessageTypeValue = "customer-visible" | "internal-recovery" | "internal-deliberation";

/** 所有人物页面共用的消息协议。 */
export interface PersonaConversationMessageOutDto {
  messageId: string;
  /** 写入方声明的可见性类别；恢复 JSON 不得伪装成客户或内部研讨正文。 */
  messageType: PersonaConversationMessageTypeValue;
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
  /** 当前对话显式选定的官方模型；null 表示本轮继续使用设置页默认模型。 */
  selectedModel?: string | null;
  /** 会话建立时刻固定不变，用于隔离新会话之前的其他消息流。 */
  createdAt?: string;
  messages: PersonaConversationMessageOutDto[];
  updatedAt: string;
  /** 人物服务组合的真实活动；数据库消息保持独立，不由页面根据等待气泡推断。 */
  activity?: PersonaConversationActivityOutDto;
  /** 只描述本次发送实际装入提示词的字符数；不写入人物消息，也不参与下一轮学习。 */
  contextReadStats?: {
    methodCharacters: number;
    recentConversationCharacters: number;
    latestUserMessageCharacters: number;
    promptCharacters: number;
  };
}
