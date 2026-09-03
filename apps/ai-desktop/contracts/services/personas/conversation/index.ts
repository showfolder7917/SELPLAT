/** 人物会话公共契约唯一出口；具体人物契约不得重复定义消息结构。 */
export type {
  PersonaConversationMessageOutDto,
  PersonaConversationOutDto,
  PersonaConversationSpeakerTypeValue,
} from "./dto/persona-conversation.out.dto.js";
export type {
  PersonaConversationSubjectInDto,
  SendPersonaConversationMessageInDto,
} from "./dto/send-persona-conversation-message.in.dto.js";
