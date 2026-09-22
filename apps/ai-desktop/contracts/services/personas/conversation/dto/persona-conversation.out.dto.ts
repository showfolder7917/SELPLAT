import type { PersonaConversationActivityOutDto } from "./persona-conversation-activity.out.dto.js";

/** 人物会话中的发言主体类型；具体人物由 speakerPersonaId 标识，不再扩充固定角色枚举。 */
export type PersonaConversationSpeakerTypeValue = "user" | "persona" | "system";

/** 消息的持久化业务类别；页面投影只能使用此字段，不能猜测 messageId 的命名含义。 */
export type PersonaConversationMessageTypeValue = "customer-visible" | "internal-recovery" | "internal-deliberation";

/** 内部消息的显示职责；技术证据保留在同一稳定消息链中，但不能混入人物正文。 */
export type PersonaConversationContentRoleValue = "conversation" | "technical-evidence";

/** 客户显示投影的读取状态；非 ready 状态绝不允许使用原始正文回退。 */
export type PersonaCustomerDisplayStateValue = "ready" | "excluded" | "missing" | "failed";

/** Codex 线程恢复的持久化结论；它与客户正文派生状态互不替代。 */
export type PersonaConversationRecoveryStatusValue = "verified" | "unknown-turn" | "thread-unavailable" | "retryable" | "verification-incomplete";

/** 一条恢复记录始终关联原业务会话，避免新线程伪装成旧线程已完整恢复。 */
export interface PersonaConversationRecoveryOutDto {
  recoveryId: string;
  status: PersonaConversationRecoveryStatusValue;
  sourceThreadId: string | null;
  successorThreadId: string | null;
  affectedTurnId: string | null;
  affectedItemId: string | null;
  summary: string;
  retryable: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 所有人物页面共用的消息协议。 */
export interface PersonaConversationMessageOutDto {
  messageId: string;
  /** 写入方声明的可见性类别；恢复 JSON 不得伪装成客户或内部研讨正文。 */
  messageType: PersonaConversationMessageTypeValue;
  /** 正文直接显示；技术证据由南宫婉页面关联到对应研讨消息并折叠展示。 */
  contentRole: PersonaConversationContentRoleValue;
  sequenceNumber: number;
  speakerType: PersonaConversationSpeakerTypeValue;
  /** 用户和系统消息为 null；人物消息填写稳定 personaId。 */
  speakerPersonaId: string | null;
  content: string;
  /** 仅由客户显示消息端口填写；失败或缺失时页面保留原位置并提供重新读取。 */
  customerDisplayState?: PersonaCustomerDisplayStateValue;
  /** 客户显示派生失败的可读原因；不包含原始消息正文。 */
  customerDisplayFailureReason?: string | null;
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
  /** 当前会话最近一次 Codex 恢复结论；没有恢复事实时保持为空。 */
  recovery?: PersonaConversationRecoveryOutDto;
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
