import type { PersonaConversationActivityOutDto } from "./persona-conversation-activity.out.dto.js";
import type { PersonaConversationMessageOutDto, PersonaConversationRecoveryOutDto } from "./persona-conversation.out.dto.js";

/** Renderer 请求人物会话窗口时使用的稳定游标；只允许向更早的序号补载。 */
export interface ReadPersonaConversationWindowInDto {
  /** null 表示读取当前活动会话。 */
  conversationId?: string | null;
  /** null 表示读取最新窗口；非空时只读取该序号之前的消息。 */
  beforeSequenceNumber?: number | null;
  /** 页面一次最多呈现的消息数，由主进程限制为安全范围。 */
  limit?: number;
}

/** 人物会话的一个可阅读窗口；完整历史仍只保留在 SQLite。 */
export interface PersonaConversationWindowOutDto {
  ownerPersonaId: string;
  conversationId: string | null;
  createdAt?: string;
  updatedAt: string;
  selectedModel?: string | null;
  messages: PersonaConversationMessageOutDto[];
  /** 人物运行时已有的可见活动投影；消息窗口读取不会根据内容自行推断。 */
  activity?: PersonaConversationActivityOutDto;
  /** 当前业务会话最近一次 Codex 恢复结论，不从客户正文或事件审计推断。 */
  recovery?: PersonaConversationRecoveryOutDto;
  /** 当前窗口前是否仍有更早历史。 */
  hasEarlier: boolean;
}
