import type { PersonaConversationOutDto, SendPersonaConversationMessageInDto } from "../../../../contracts/services/personas/conversation/index.js";

/** 每个人物只实现这一组公共会话动作；人物特有业务继续留在自己的 Facade。 */
export interface PersonaConversationHandler {
  conversation(): PersonaConversationOutDto;
  sendConversationMessage(request: SendPersonaConversationMessageInDto): Promise<PersonaConversationOutDto>;
  newConversation(): Promise<PersonaConversationOutDto>;
}

/**
 * 人物会话调用注册表。
 *
 * 新手阅读提示：Renderer 只传 personaId，本类找到启动时注册的对应人物处理器。
 * 新人物只需要 register 一次，不需要新增 IPC channel 或修改 if/switch。
 */
export class PersonaConversationFacade {
  readonly #handlers = new Map<string, PersonaConversationHandler>();

  register(personaId: string, handler: PersonaConversationHandler): void {
    const normalized = requiredPersonaId(personaId);
    if (this.#handlers.has(normalized)) throw new Error(`人物会话处理器重复注册：${normalized}`);
    this.#handlers.set(normalized, handler);
  }

  conversation(personaId: string): PersonaConversationOutDto {
    return this.#requireHandler(personaId).conversation();
  }

  send(personaId: string, request: SendPersonaConversationMessageInDto): Promise<PersonaConversationOutDto> {
    return this.#requireHandler(personaId).sendConversationMessage(request);
  }

  newConversation(personaId: string): Promise<PersonaConversationOutDto> {
    return this.#requireHandler(personaId).newConversation();
  }

  #requireHandler(personaId: string): PersonaConversationHandler {
    const normalized = requiredPersonaId(personaId);
    const handler = this.#handlers.get(normalized);
    if (!handler) throw new Error(`人物尚未注册统一会话能力：${normalized}`);
    return handler;
  }
}

function requiredPersonaId(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error("人物 ID 不能为空。");
  return normalized;
}
