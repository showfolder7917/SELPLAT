/** 主进程输出真实活动与恢复入口，供人物页面展示。 */
export type { PersonaConversationActivityOutDto } from "./dto/persona-conversation-activity.out.dto.js";
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
