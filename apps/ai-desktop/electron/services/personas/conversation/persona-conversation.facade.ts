import type { PersonaConversationOutDto, PersonaConversationWindowOutDto, ReadPersonaConversationWindowInDto, SendPersonaConversationMessageInDto } from "../../../../contracts/services/personas/conversation/index.js";

/** 每个人物只实现这一组公共会话动作；人物特有业务继续留在自己的 Facade。 */
export interface PersonaConversationHandler {
  conversation(): Promise<PersonaConversationOutDto>;
  sendConversationMessage(request: SendPersonaConversationMessageInDto): Promise<PersonaConversationOutDto>;
  newConversation(): Promise<PersonaConversationOutDto>;
  selectConversationModel(selectedModel: string | null): Promise<PersonaConversationOutDto>;
}

/**
 * 人物会话调用注册表。
 *
 * 新手阅读提示：Renderer 只传 personaId，本类找到启动时注册的对应人物处理器。
 * 新人物只需要 register 一次，不需要新增 IPC channel 或修改 if/switch。
 */
export class PersonaConversationFacade {
  readonly #handlers = new Map<string, PersonaConversationHandler>();
  #windowReader: ((personaId: string, request: ReadPersonaConversationWindowInDto) => Promise<PersonaConversationWindowOutDto>) | null = null;
  #customerDisplayRetry: ((personaId: string, conversationId: string, sourceMessageId: string) => Promise<PersonaConversationWindowOutDto>) | null = null;

  /** 组合根注册统一 SQLite 窗口读取器；人物 Facade 不自行持有数据库实现。 */
  registerWindowReader(reader: (personaId: string, request: ReadPersonaConversationWindowInDto) => Promise<PersonaConversationWindowOutDto>): void {
    this.#windowReader = reader;
  }

  /** 组合根注册客户显示派生重读器；失败位置重试仍经过同一持久化端口。 */
  registerCustomerDisplayRetry(reader: (personaId: string, conversationId: string, sourceMessageId: string) => Promise<PersonaConversationWindowOutDto>): void {
    this.#customerDisplayRetry = reader;
  }

  register(personaId: string, handler: PersonaConversationHandler): void {
    const normalized = requiredPersonaId(personaId);
    if (this.#handlers.has(normalized)) throw new Error(`人物会话处理器重复注册：${normalized}`);
    this.#handlers.set(normalized, handler);
  }

  conversation(personaId: string): Promise<PersonaConversationOutDto> {
    return this.#requireHandler(personaId).conversation();
  }

  /** 读取当前人物会话的有限窗口；缺少受控读取器时明确阻断，禁止回退全量快照。 */
  conversationWindow(personaId: string, request: ReadPersonaConversationWindowInDto): Promise<PersonaConversationWindowOutDto> {
    const reader = this.#windowReader;
    if (!reader) throw new Error("人物会话窗口读取器尚未就绪。");
    return reader(requiredPersonaId(personaId), request);
  }

  /** 重新派生指定原消息的客户显示正文，并返回该会话的新窗口。 */
  retryCustomerDisplayMessage(personaId: string, conversationId: string, sourceMessageId: string): Promise<PersonaConversationWindowOutDto> {
    const retry = this.#customerDisplayRetry;
    if (!retry) throw new Error("客户显示消息重读器尚未就绪。");
    return retry(requiredPersonaId(personaId), conversationId, sourceMessageId);
  }

  send(personaId: string, request: SendPersonaConversationMessageInDto): Promise<PersonaConversationOutDto> {
    return this.#requireHandler(personaId).sendConversationMessage(request);
  }

  newConversation(personaId: string): Promise<PersonaConversationOutDto> {
    return this.#requireHandler(personaId).newConversation();
  }

  selectModel(personaId: string, selectedModel: string | null): Promise<PersonaConversationOutDto> {
    return this.#requireHandler(personaId).selectConversationModel(selectedModel);
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
