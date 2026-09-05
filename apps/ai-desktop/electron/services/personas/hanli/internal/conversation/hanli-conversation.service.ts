// 使用稳定随机标识登记用户消息、韩立回复和内部锚点，保证重试能够按消息身份去重。
import { randomUUID } from "node:crypto";

// 读取 Evolution 状态类型，只用于判断当前是否已有活动研讨或待确认轮次。
import type { EvolutionStateOutDto } from "../../../../../../contracts/services/evolution/index.js";
// 读取人物会话输入输出契约，使韩立服务继续兼容统一人物会话 IPC。
import type {
  PersonaConversationOutDto,
  SendPersonaConversationMessageInDto,
} from "../../../../../../contracts/services/personas/conversation/index.js";
// 读取韩立观点值对象，使研讨启动始终携带可追溯的观点快照。
import type { HanliConversationViewpointValue } from "../../../../../../contracts/services/personas/hanli/index.js";
// 读取训练主题决定契约，使普通会话仍按统一事件中心格式归档。
import type { ConversationRoundTopicDecisionInDto } from "../../../../../../contracts/services/support/capabilities/event-center/index.js";
// 会话 Aggregate 是状态判断的唯一入口，Service 不再检查固定中文邀请文案。
import { HanliConversationAggregate } from "../../domain/hanli-conversation.aggregate.js";
// 应用装配端口提供模型、数据库、南宫婉调查和 Workflow 研讨能力。
import type { HanliApplicationServiceOptions } from "../application/hanli-application.ports.js";
// 解析器只负责把韩立模型正文和结构化主题元数据分离。
import { parseHanliConversationResponse } from "./hanli-conversation.parser.js";
// 方法上下文构造器只提供提问方法和当前会话摘要，不参与流程路由。
import { buildHanliMethodContext, buildHanliRecentConversation } from "./hanli-method-context.js";
// 调查服务负责韩立向南宫婉发起一次只读事实核实并将结果返回人物会话。
import { HanliInquiryService } from "./hanli-inquiry.service.js";

/** 用户输入 1 后保存到人物会话中的固定业务决定。 */
const START_DELIBERATION_DECISION: ConversationRoundTopicDecisionInDto = {
  // 主题标题说明本轮不是普通聊天，而是用户确认启动人物研讨。
  title: "启动人物内部研讨",
  // 类型用于训练归档区分用户确认和模型自由判断。
  type: "用户确认",
  // 独立 1 延续当前观点，不把它错误识别成一个全新客户话题。
  switchTopic: false,
  // 用户意图说明本轮确认的是当前观点进入韩立与南宫婉研讨。
  userIntent: "确认以韩立当前观点启动与南宫婉的内部研讨",
  // 标签只描述当前真实业务动作，便于后续审计检索。
  tags: ["韩立", "南宫婉", "内部研讨"],
  // 摘要记录程序实际执行的动作，不声称工程修改已经完成。
  summary: "用户确认以韩立当前观点启动内部研讨。",
};

/** 没有观点时保存到人物会话中的固定业务决定。 */
const EMPTY_VIEWPOINT_DECISION: ConversationRoundTopicDecisionInDto = {
  // 主题标题说明本轮是启动前置条件检查，而不是新的需求分析。
  title: "研讨启动条件检查",
  // 类型说明程序拒绝了无目标研讨，不是韩立模型作出的范围判断。
  type: "流程反馈",
  // 空观点反馈仍属于当前会话，不切换客户话题。
  switchTopic: false,
  // 用户意图保留用户希望启动研讨的真实目的。
  userIntent: "启动韩立与南宫婉的内部研讨",
  // 标签帮助事件中心定位没有观点的启动请求。
  tags: ["韩立", "内部研讨", "缺少观点"],
  // 摘要明确没有创建空研讨，避免界面误判流程已经开始。
  summary: "当前没有可供研讨的韩立观点，因此没有创建空研讨。",
};

/** 韩立自由对话应用服务；Aggregate 判断状态，Service 只执行受控外部调用。 */
export class HanliConversationService {
  /** 应用装配提供的全部外部能力；字段在构造后保持同一组依赖。 */
  readonly #options: HanliApplicationServiceOptions;
  /** 南宫婉只读调查服务；同一请求的并发与重试由它统一去重。 */
  readonly #inquiry: HanliInquiryService;

  /** 装配会话外部能力；构造过程不读取数据库，也不启动任何研讨。 */
  constructor(options: HanliApplicationServiceOptions) {
    // 保存依赖对象，让每个业务方法通过同一装配边界访问外部能力。
    this.#options = options;
    // 创建唯一调查服务，避免每轮消息重新创建并丢失正在进行的请求映射。
    this.#inquiry = new HanliInquiryService(options);
  }

  /** 读取当前韩立业务会话；数据库不可用时返回结构稳定的空快照。 */
  conversation(): PersonaConversationOutDto {
    // memory 是统一人物会话的权威数据库端口。
    const memory = this.#options.memory;
    // 已接入数据库时直接读取 ownerPersonaId=han-li 的当前会话。
    if (memory) {
      // 返回数据库快照，不在读取方法中创建新会话或写入状态。
      return memory.readPersonaConversation("han-li");
    }
    // 没有数据库时返回空结构，让界面能够显示明确的未就绪状态。
    return {
      // ownerPersonaId 固定标识当前页面属于韩立。
      ownerPersonaId: "han-li",
      // null 表示尚未建立可持久化的业务会话。
      conversationId: null,
      // 空数组表示当前没有可展示的持久消息。
      messages: [],
      // 纪元时间避免把空快照误判成刚发生的业务更新。
      updatedAt: new Date(0).toISOString(),
    };
  }

  /** 接收用户消息，并按 Aggregate 返回的唯一动作推进会话或内部研讨。 */
  async send(request: SendPersonaConversationMessageInDto): Promise<PersonaConversationOutDto> {
    // 在读取或写入状态前统一校验消息和工作区，避免分支各自遗漏门禁。
    this.#validateRequest(request);
    // 模型会话负责普通韩立回答，不能被 Domain 直接调用。
    const chat = this.#options.conversation;
    // 人物记忆负责会话消息和研讨事实包的原子持久化。
    const memory = this.#options.memory;
    // 任一外部能力缺失都无法形成完整人物回合。
    if (!chat || !memory) {
      // 抛出明确错误，让原发送气泡显示失败而不是长期停留在发送中。
      throw new Error("韩立自由对话或 AI Memory 尚未就绪。");
    }
    // 当前快照可能还是未建会话的空结构。
    const currentConversation = this.conversation();
    // 第一条消息到来时由统一 memory 端口建立业务会话头。
    let conversation = currentConversation;
    // conversationId 为空表示需要为本轮创建新的稳定业务会话。
    if (!conversation.conversationId) {
      // 新会话只由统一人物记忆创建，禁止使用 Codex threadId 代替业务标识。
      conversation = memory.newPersonaConversation("han-li");
    }
    // Workflow 快照提供待确认轮次和活动研讨事实。
    const workflowState = this.#options.store.state();
    // 创建纯 Domain Aggregate，集中解释本轮消息应该触发的动作。
    const aggregate = new HanliConversationAggregate({
      // 传入当前稳定会话，Aggregate 从真实消息恢复观点与澄清锚点。
      conversation,
      // 传入界面已经展示的待确认轮次，优先完成当前研讨。
      pendingConfirmationRoundId: this.#pendingConfirmationRoundId(workflowState, conversation),
      // 传入活动研讨标识，保证重复输入 1 不会创建第二条流程。
      activeDeliberationId: this.#activeDeliberationId(workflowState),
    });
    // Domain 决定不依赖提示词文案，因此不会因模型少写一句邀请而断线。
    const action = aggregate.decideUserMessage(request.message);
    // 已进入范围确认时，任何用户回复都只交给当前内部研讨处理。
    if (action.kind === "confirm-deliberation-scope") {
      // 调用确认端口并把韩立整理后的反馈保存回同一人物会话。
      return this.#confirmDeliberationScope(request, conversation);
    }
    // 当前已有活动研讨时，重复输入 1 只返回原流程状态。
    if (action.kind === "return-existing-deliberation") {
      // 保存可见反馈，避免用户误以为点击没有响应或连接已经断开。
      return this.#recordControlReply(
        request,
        conversation,
        "当前观点已经进入内部研讨，无需重复启动。请在任务协作群查看当前节点和后续交接。",
        START_DELIBERATION_DECISION,
      );
    }
    // 当前没有韩立观点时，独立 1 不能创建没有业务目标的研讨。
    if (action.kind === "reject-empty-viewpoint") {
      // 保存明确原因，让用户先与韩立形成观点后再启动研讨。
      return this.#recordControlReply(
        request,
        conversation,
        "当前会话还没有形成可供研讨的韩立观点。请先说明需要解决的问题；韩立形成观点后，独立输入 1 即可进入内部研讨。",
        EMPTY_VIEWPOINT_DECISION,
      );
    }
    // 独立 1 且已有观点时，直接启动韩立与南宫婉的内部研讨。
    if (action.kind === "start-deliberation") {
      // action.viewpoint 在 Domain 中已校验存在，这里保留运行时防御以阻止空研讨。
      if (!action.viewpoint) {
        // 该异常表示 Domain 契约被破坏，必须显式阻断而不是继续调用 Workflow。
        throw new Error("韩立会话没有返回可供内部研讨的观点快照。");
      }
      // 使用被冻结的观点保存事实并启动一次性研讨流程。
      return this.#startDeliberation(request, conversation, action.viewpoint);
    }
    // 除上述结构化控制动作外，消息只进入普通韩立对话。
    return this.#continueConversation(request, conversation, aggregate);
  }

  /** 重置模型线程并创建新的空白业务会话，旧会话保留在数据库历史中。 */
  async newConversation(): Promise<PersonaConversationOutDto> {
    // 模型会话和人物记忆必须同时可用，避免只重置一侧造成身份错位。
    const chat = this.#options.conversation;
    // memory 负责创建新的稳定业务会话头。
    const memory = this.#options.memory;
    // 缺少任一能力都无法安全建立新会话。
    if (!chat || !memory) {
      // 抛出明确错误，界面继续保留当前会话而不是显示假成功。
      throw new Error("韩立自由对话或 AI Memory 尚未接入。");
    }
    // 先重置韩立模型线程，确保下一轮不会继续使用旧模型上下文。
    await chat.newChat();
    // 再建立新的业务会话，旧消息只归档不删除。
    return memory.newPersonaConversation("han-li");
  }

  /** 普通韩立对话：构造上下文、调用模型、保存结果并更新当前观点事实。 */
  async #continueConversation(
    request: SendPersonaConversationMessageInDto,
    conversation: PersonaConversationOutDto,
    aggregate: HanliConversationAggregate,
  ): Promise<PersonaConversationOutDto> {
    // chat 已在 send 入口校验存在，这里以局部常量表达本方法的外部依赖。
    const chat = this.#options.conversation!;
    // memory 已在 send 入口校验存在，这里负责保存完整人物回合。
    const memory = this.#options.memory!;
    // 业务会话在 send 入口已经创建，后续消息必须使用同一个稳定标识。
    const conversationId = conversation.conversationId!;
    // 当前稳定用户决定语义资料隔离边界。
    const stableUserId = this.#options.readStableUserId?.() || "";
    // 当前工程范围决定韩立只能读取哪一组客户语义资料。
    const projectScope = this.#options.readProjectScope?.() || "global";
    // 方法资料只包含提问与调查方法，不复制历史客户答案。
    const semanticContext = memory.readHanliSemanticContext(stableUserId, projectScope, "", 20);
    // 把语义资料压缩成受预算约束的方法上下文。
    const methodContext = buildHanliMethodContext(semanticContext);
    // 当前会话上下文保留用户原文，并限制历史 AI 长回答的预览长度。
    const recentConversation = buildHanliRecentConversation(conversation.messages);
    // 澄清锚点存在时继续围绕原问题处理用户补充。
    const pendingCustomerQuestion = aggregate.pendingCustomerQuestion();
    // 没有澄清锚点时，本轮用户原话就是当前问题。
    const customerQuestion = pendingCustomerQuestion || request.message.trim();
    // 提示词只生成内容和结构化理解，不再控制输入 1 的流程路由。
    const prompt = this.#options.prompts.render("hanli.conversation", {
      // 方法资料帮助韩立学习如何调查，不提供旧问题结论。
      methodContextJson: methodContext,
      // 当前会话帮助韩立理解用户正在回答哪一个问题。
      recentConversation,
      // 原问题锚点防止简短澄清回答替换客户真实目标。
      customerQuestionAnchor: customerQuestion,
      // 最新用户原话仍单独提供，模型不得把它伪装成历史消息。
      userMessage: request.message.trim(),
    });
    // 创建时间记录本轮用户消息真实进入模型调用的时刻。
    const createdAt = new Date().toISOString();
    // 普通韩立模型运行在只读工作区，但可以返回调查请求和观点。
    const response = await chat.send(request, prompt);
    // 没有稳定 provider 会话标识时不能把模型输出当成完整人物回合。
    if (!response.threadId && !chat.activeConversationId()) {
      // 明确失败使用户原消息进入失败状态，而不是保存无法续接的回复。
      throw new Error("韩立会话没有返回稳定 Codex 线程标识。");
    }
    // 解析可见回复、主题判断和可选调查理解。
    const parsed = parseHanliConversationResponse(response.text);
    // 模型明确切换话题时，本轮原话成为新的客户问题。
    let effectiveCustomerQuestion = customerQuestion;
    // switchTopic 表示用户已经明确放弃旧问题并提出新目标。
    if (parsed.topic.switchTopic) {
      // 使用本轮用户原话替换旧澄清锚点。
      effectiveCustomerQuestion = request.message.trim();
    }
    // 理解充分时由韩立真实调用南宫婉完成一次只读调查。
    if (parsed.inquiry?.status === "ready") {
      // 调查服务负责进度消息、内部问答、事实包和最终客户解释。
      const investigatedConversation = await this.#inquiry.run(
        request,
        conversationId,
        effectiveCustomerQuestion,
        parsed.inquiry,
        parsed.topic,
      );
      // 记录本轮实际装入模型的字符数，帮助后续调整上下文预算。
      const contextReadStats = this.#contextReadStats(request, prompt, methodContext, recentConversation);
      // 完整回合归档事件只在调查结果已经返回后写入。
      this.#recordArchivedRound(investigatedConversation, parsed.topic, contextReadStats);
      // 调查形成了新的真实会话事实，异步唤醒韩立语义整理。
      this.#options.refreshSemanticMemory?.();
      // 返回调查完成后的会话，并附带本轮上下文统计。
      return { ...investigatedConversation, contextReadStats };
    }
    // 理解不足时记录需要用户确认的真实歧义。
    if (parsed.inquiry?.status === "clarification-required") {
      // 事件只保存结构化歧义，不把提示词或内部推理写入审计。
      this.#options.recordEvent("hanli.inquiry.clarification_requested", {
        // conversationId 关联当前人物业务会话。
        conversationId,
        // requestId 关联前端原始用户消息，历史调用缺失时允许为空。
        requestId: request.clientMessageId || null,
        // ambiguities 是必须由用户回答且会改变调查方向的问题。
        ambiguities: parsed.inquiry.ambiguities,
      });
    }
    // completedAt 记录韩立模型回复已经完整返回的时刻。
    const completedAt = new Date().toISOString();
    // 澄清回复使用可识别前缀，普通观点使用通用韩立消息标识。
    let personaMessageId = `hanli-message-${randomUUID()}`;
    // 只有真正需要用户澄清时才创建澄清消息标识。
    if (parsed.inquiry?.status === "clarification-required") {
      // 独立标识让 Aggregate 能恢复仍然有效的原问题锚点。
      personaMessageId = `hanli-clarification:${randomUUID()}`;
    }
    // 将用户原话和韩立完整回复作为一个原子人物回合保存。
    let nextConversation = memory.registerPersonaRound({
      // ownerPersonaId 固定表示消息属于韩立业务会话。
      ownerPersonaId: "han-li",
      // responderPersonaId 记录本轮可见回复由韩立产生。
      responderPersonaId: "han-li",
      // corpusSource 指示完整回合可以进入韩立训练语料旁路。
      corpusSource: "hanli",
      // conversationId 使用入口冻结的业务会话标识。
      conversationId,
      // 优先使用前端稳定消息标识，缺失时再生成后端标识。
      userMessageId: request.clientMessageId || `hanli-user-${randomUUID()}`,
      // userContent 只保存用户原文，不使用模型推断替换。
      userContent: request.message.trim(),
      // attachmentIds 保存本轮用户真实提交的截图引用。
      attachmentIds: request.attachmentIds || [],
      // personaMessageId 标识本轮韩立回复或澄清问题。
      personaMessageId,
      // personaContent 保存去除内部元数据后的可见回复正文。
      personaContent: parsed.reply,
      // createdAt 表示用户消息进入本轮处理的时刻。
      createdAt,
      // completedAt 表示韩立回复完整返回的时刻。
      completedAt,
      // decision 保存模型生成并通过解析校验的主题语义。
      decision: parsed.topic,
    });
    // 澄清问题需要保存原问题锚点，后续简短回答才能继续原目标。
    if (parsed.inquiry?.status === "clarification-required") {
      // 把锚点作为内部消息追加，不在韩立可见对话中展示 JSON。
      nextConversation = memory.appendPersonaInternalMessage({
        // 锚点属于韩立业务会话。
        ownerPersonaId: "han-li",
        // conversationId 保证新会话不会读取旧会话的澄清锚点。
        conversationId,
        // messageId 使用前端请求标识保持同一轮幂等。
        messageId: `internal:hanli-inquiry-anchor:${request.clientMessageId || randomUUID()}`,
        // speakerPersonaId 标识锚点由韩立会话逻辑生成。
        speakerPersonaId: "han-li",
        // replyToMessageId 指向界面上真实展示的澄清问题。
        replyToMessageId: personaMessageId,
        // content 保存最小结构化原问题和澄清消息关联。
        content: JSON.stringify({
          // version 为未来锚点兼容升级保留稳定版本。
          version: 1,
          // customerQuestion 保存当前权威客户原问题。
          customerQuestion: effectiveCustomerQuestion,
          // clarificationMessageId 标识锚点当前仍指向哪条可见回复。
          clarificationMessageId: personaMessageId,
        }),
        // createdAt 与可见澄清回复完成时间保持一致。
        createdAt: completedAt,
      });
    } else {
      // 非澄清回复就是韩立当前观点，保存为后续独立 1 的研讨依据。
      this.#recordViewpointContext(
        conversationId,
        request,
        parsed.reply,
        parsed.topic,
        completedAt,
      );
    }
    // 记录本轮实际上下文规模，不把统计文本混入人物消息。
    const contextReadStats = this.#contextReadStats(request, prompt, methodContext, recentConversation);
    // 保存完整普通回合的归档事件。
    this.#recordArchivedRound(nextConversation, parsed.topic, contextReadStats);
    // 新回合完成后异步刷新派生语义，不阻塞当前回复返回界面。
    this.#options.refreshSemanticMemory?.();
    // 返回数据库权威会话和本轮上下文统计。
    return { ...nextConversation, contextReadStats };
  }

  /** 把用户对南宫婉范围说明的确认或纠正交回当前内部研讨。 */
  async #confirmDeliberationScope(
    request: SendPersonaConversationMessageInDto,
    conversation: PersonaConversationOutDto,
  ): Promise<PersonaConversationOutDto> {
    // 确认端口由 Workflow 提供，负责保存回复并调度原研讨继续。
    const confirm = this.#options.replyInternalDeliberationConfirmation;
    // 没有确认端口时禁止把回复退回普通聊天而造成状态分叉。
    if (!confirm) {
      // 明确报告装配问题，保留原待确认状态供修复后重试。
      throw new Error("韩立与南宫婉的确认研讨入口尚未接入。");
    }
    // 将用户原文交给当前研讨服务理解并保存。
    const confirmation = await confirm(request.message.trim());
    // 使用一个时间点保存用户回复和韩立反馈，保持完整人物回合原子性。
    const completedAt = new Date().toISOString();
    // 保存确认回合并返回数据库权威快照。
    return this.#options.memory!.registerPersonaRound({
      // 当前确认仍属于韩立人物会话。
      ownerPersonaId: "han-li",
      // 可见反馈由韩立向用户表达。
      responderPersonaId: "han-li",
      // 完整用户参与回合允许进入韩立训练语料。
      corpusSource: "hanli",
      // conversationId 已在入口确保存在。
      conversationId: conversation.conversationId!,
      // 使用前端消息标识保证确认重试不会重复入库。
      userMessageId: request.clientMessageId || `hanli-user-${randomUUID()}`,
      // 保存用户真实确认或纠正正文。
      userContent: request.message.trim(),
      // 保存用户本轮真实提交的附件引用。
      attachmentIds: request.attachmentIds || [],
      // 韩立反馈使用新的稳定消息标识。
      personaMessageId: `hanli-control:${randomUUID()}`,
      // 保存研讨服务返回的客户可读反馈。
      personaContent: confirmation.customerReply,
      // 用户确认进入处理的时间与完成时间使用同一原子写入时刻。
      createdAt: completedAt,
      // 当前调用完成后范围确认已经保存。
      completedAt,
      // 主题说明本轮只处理现有研讨范围确认。
      decision: {
        // 标题帮助语料和审计定位范围确认回合。
        title: "调查范围确认",
        // 类型明确这是一轮用户确认。
        type: "用户确认",
        // 范围确认继续当前专题，不创建新话题。
        switchTopic: false,
        // 用户意图保留真实确认或纠正正文。
        userIntent: request.message.trim(),
        // 标签用于检索研讨范围确认回合。
        tags: ["调查确认"],
        // 摘要说明程序实际保存了本轮范围反馈。
        summary: "用户对本轮调查范围作出确认或纠正。",
      },
    });
  }

  /** 以 Aggregate 冻结的观点直接启动一次内部研讨。 */
  async #startDeliberation(
    request: SendPersonaConversationMessageInDto,
    conversation: PersonaConversationOutDto,
    viewpoint: HanliConversationViewpointValue,
  ): Promise<PersonaConversationOutDto> {
    // startInternalDeliberation 是唯一允许创建一次性研讨流程的 Workflow 端口。
    const start = this.#options.startInternalDeliberation;
    // 缺少端口时禁止仅用聊天回复伪装研讨已经开始。
    if (!start) {
      // 明确失败使用户可以在装配恢复后重试同一条独立 1。
      throw new Error("韩立与南宫婉内部研讨能力尚未就绪。");
    }
    // 在异步调度前保存观点事实包，保证 Workflow 总能读取本次确认方向。
    this.#recordViewpointContext(
      conversation.conversationId!,
      request,
      viewpoint.content,
      START_DELIBERATION_DECISION,
      new Date().toISOString(),
      viewpoint,
      true,
    );
    // Workflow 先持久化一次性运行态，再异步调度韩立向南宫婉提出第一问。
    const started = await start(request);
    // 根据真实托管设置生成启动回执，不从模型自由文案推断流程状态。
    let reply = "已启动韩立与南宫婉的内部研讨。南宫婉查清事实后，我会把修复范围和影响带回来请你确认，再进入实施。";
    // 自动托管开启时，韩立可以在已授权范围内继续作业务范围判断。
    if (this.#options.store.state().automationSettings.automaticCustodyEnabled === true) {
      // 回执明确说明后续会持续推进，但不提前声称代码已经修改。
      reply = "已启动韩立与南宫婉的内部研讨。自动托管已开启，我会代表你判断新发现应并入当前专题还是留到后续专题，并持续推进。";
    }
    // 保存独立 1 和启动回执，界面立即离开发送中状态。
    const nextConversation = this.#recordControlReply(
      request,
      conversation,
      reply,
      START_DELIBERATION_DECISION,
    );
    // 记录真实 Workflow 启动事件，供任务协作群和异常中心关联。
    this.#options.recordEvent("hanli.conversation.internal_deliberation_started", {
      // conversationId 关联用户当前韩立业务会话。
      conversationId: conversation.conversationId,
      // viewpointMessageId 关联用户实际确认的韩立观点。
      viewpointMessageId: viewpoint.sourceMessageId,
      // continuous 来自 Workflow 已保存的真实运行状态。
      continuous: started.continuous,
    });
    // 启动回合属于新的用户参与事实，异步刷新派生语义。
    this.#options.refreshSemanticMemory?.();
    // 返回已保存启动回执的权威会话。
    return nextConversation;
  }

  /** 保存不需要再次调用模型的确定性流程反馈。 */
  #recordControlReply(
    request: SendPersonaConversationMessageInDto,
    conversation: PersonaConversationOutDto,
    reply: string,
    decision: ConversationRoundTopicDecisionInDto,
  ): PersonaConversationOutDto {
    // 使用同一时间保存用户控制消息和程序确定性回复。
    const completedAt = new Date().toISOString();
    // 通过统一人物记忆原子登记完整回合。
    return this.#options.memory!.registerPersonaRound({
      // 控制回合仍属于韩立人物会话。
      ownerPersonaId: "han-li",
      // 可见流程反馈使用韩立身份表达。
      responderPersonaId: "han-li",
      // 用户真实参与的控制回合允许进入训练语料旁路。
      corpusSource: "hanli",
      // 复用入口冻结的业务会话标识。
      conversationId: conversation.conversationId!,
      // 使用前端消息标识保证重复提交幂等。
      userMessageId: request.clientMessageId || `hanli-user-${randomUUID()}`,
      // 保存用户原始控制输入，例如独立数字 1。
      userContent: request.message.trim(),
      // 保存控制消息携带的真实附件引用。
      attachmentIds: request.attachmentIds || [],
      // 控制反馈使用专用前缀，Aggregate 不会把流程状态误认成新的韩立观点。
      personaMessageId: `hanli-control:${randomUUID()}`,
      // 保存程序根据真实状态生成的可见反馈。
      personaContent: reply,
      // createdAt 表示控制消息进入应用服务的完成时刻。
      createdAt: completedAt,
      // completedAt 表示反馈已同步生成并保存。
      completedAt,
      // decision 说明本轮控制动作的真实业务含义。
      decision,
    });
  }

  /** 保存韩立当前观点及其已有调查事实，供输入 1 后的 Workflow 读取。 */
  #recordViewpointContext(
    conversationId: string,
    request: SendPersonaConversationMessageInDto,
    viewpointContent: string,
    decision: ConversationRoundTopicDecisionInDto,
    createdAt: string,
    viewpoint?: HanliConversationViewpointValue,
    mustPersistBeforeDispatch = false,
  ): void {
    // memory 在 send 入口已经校验存在，这里读取同一会话的最近调查事实包。
    const memory = this.#options.memory!;
    // 旧事实包提供已经完成的调查依据；没有调查时允许为空。
    const investigated = memory.readLatestRequirementDiscussionContext?.("han-li", conversationId) || null;
    // 优先使用 Aggregate 找到的用户来源消息，否则使用本轮前端消息标识。
    const sourceRequestId = viewpoint?.sourceUserMessageId || request.clientMessageId || viewpoint?.sourceMessageId || randomUUID();
    // 观点正文必须非空，空白模型回复不能覆盖上一份有效研讨方向。
    const normalizedViewpoint = viewpointContent.trim();
    // 空白观点没有可保存的业务意义。
    if (!normalizedViewpoint) {
      // 直接返回并保留上一份事实包，不制造空研讨来源。
      return;
    }
    // 事实包写入失败不能伪装成功，但普通聊天仍应保留可见回复并记录异常。
    try {
      // 通过统一 memory 端口保存当前观点和可复用调查事实。
      const recordContext = memory.recordRequirementDiscussionContext;
      // 启动研讨前必须确认持久化能力真实存在，不能以可选调用伪装已经保存。
      if (!recordContext) {
        // 普通聊天仍可继续，但独立 1 的异步流程必须在这里明确阻断。
        if (mustPersistBeforeDispatch) {
          // 没有事实包就启动会导致重启后丢失观点，因此拒绝调度。
          throw new Error("韩立当前观点持久化能力尚未接入。");
        }
        // 普通回复没有启动副作用，允许保留可见会话并等待装配恢复。
        return;
      }
      // 调用真实持久化端口后，方法正常返回才允许启动后续异步研讨。
      recordContext.call(memory, {
        // contextId 使用观点消息或请求标识，确保同一轮可以稳定追溯。
        contextId: `viewpoint-${viewpoint?.sourceMessageId || request.clientMessageId || randomUUID()}`,
        // ownerPersonaId 固定表示事实包由韩立会话发布。
        ownerPersonaId: "han-li",
        // conversationId 隔离新旧人物会话的研讨方向。
        conversationId,
        // sourceRequestId 关联用户真实消息或已展示观点来源。
        sourceRequestId,
        // 已有调查时保留权威客户原问题，否则以当前观点作为研讨方向。
        customerQuestion: investigated?.customerQuestion || normalizedViewpoint,
        // 当前观点是用户独立 1 将要确认的最新业务目标。
        understoodGoal: decision.userIntent || normalizedViewpoint,
        // 已有调查时保留原核实对象，否则围绕当前观点核实真实影响。
        verificationTarget: investigated?.verificationTarget || normalizedViewpoint,
        // 已有调查时保留用户期望结论，否则要求形成可验证修正方案。
        expectedAnswer: investigated?.expectedAnswer || "形成解决真实需求且可验证的修正方案",
        // 已有调查时保留原调查问题，否则允许内部研讨自由核实事实和影响。
        investigationQuestion: investigated?.investigationQuestion || "围绕韩立当前观点调查事实、影响和可行修正",
        // 已有调查状态继续作为事实依据，没有调查时明确标记未知。
        findingStatus: investigated?.findingStatus || "unknown",
        // 已有调查摘要继续保留，没有调查时不得伪造已核实结论。
        findingSummary: investigated?.findingSummary || "尚未形成独立只读调查结论",
        // 已有可定位证据继续提供给内部研讨，没有调查时使用空数组。
        evidence: investigated?.evidence || [],
        // 没有调查时明确要求研讨继续核实，而不是假定事实成立。
        unknowns: investigated?.unknowns || ["需要在内部研讨中继续核实事实"],
        // customerConclusion 保存用户在界面上确认的韩立完整观点。
        customerConclusion: normalizedViewpoint,
        // createdAt 使用观点形成或用户确认的真实时间。
        createdAt,
      });
    } catch (error) {
      // 将未知异常统一转换成可审计文本，不把对象直接写入事件详情。
      let reason = "需求研讨观点保存失败";
      // Error 实例保留原始消息，帮助定位数据库或数据校验问题。
      if (error instanceof Error) {
        // 保存明确错误原因，不记录堆栈和潜在敏感上下文。
        reason = error.message;
      }
      // 记录观点保存失败，后续用户输入 1 时可以明确诊断缺失事实包。
      this.#options.recordEvent("hanli.conversation.discussion_context_failed", {
        // conversationId 关联发生失败的人物会话。
        conversationId,
        // requestId 关联本轮用户消息，缺失时允许为空。
        requestId: request.clientMessageId || null,
        // reason 保存可理解的失败原因。
        reason,
      });
      // 独立 1 的启动路径必须把持久化失败向上抛出，禁止继续创建不可恢复流程。
      if (mustPersistBeforeDispatch) {
        // 保留原始异常，使界面显示数据库或装配返回的真实失败原因。
        throw error;
      }
    }
  }

  /** 找出当前真正等待用户回复的内部研讨范围确认轮次。 */
  #pendingConfirmationRoundId(
    state: EvolutionStateOutDto,
    conversation: PersonaConversationOutDto,
  ): string | null {
    // 从最新研讨向前扫描，优先处理用户此刻看到的最近范围说明。
    for (let index = state.deliberations.length - 1; index >= 0; index -= 1) {
      // deliberation 是当前检查的持久研讨记录。
      const deliberation = state.deliberations[index];
      // 只有 ready-to-establish 状态可能正在等待用户范围确认。
      if (deliberation.status !== "ready-to-establish") {
        // 跳过仍在调查、已经建立或已经阻塞的研讨。
        continue;
      }
      // 最新轮次保存南宫婉范围说明和用户确认结果。
      const round = deliberation.rounds.at(-1);
      // 没有范围说明或已经收到回复时，不再等待用户确认。
      if (!round?.confirmation || round.confirmation.reply) {
        // 继续检查更早但仍可能等待确认的研讨。
        continue;
      }
      // 页面必须已经展示当前轮次确认消息，后台草稿不能取得用户授权。
      const expectedMessageId = `hanli-confirmation:${round.roundId}`;
      // 显式扫描会话消息，避免把内容相似的旧回复误当成当前确认。
      let confirmationIsVisible = false;
      // 按真实消息顺序检查稳定消息标识。
      for (const message of conversation.messages) {
        // 标识完全一致表示用户确实看到了本轮范围说明。
        if (message.messageId === expectedMessageId) {
          // 保存可见事实并停止无关扫描。
          confirmationIsVisible = true;
          // 当前轮次已经找到，不需要继续遍历消息。
          break;
        }
      }
      // 后台存在草稿但界面未展示时，不能消费用户输入。
      if (!confirmationIsVisible) {
        // 继续检查其他可能与当前会话关联的等待轮次。
        continue;
      }
      // 返回唯一可确认轮次，Aggregate 将优先处理它。
      return round.roundId;
    }
    // 没有可见等待轮次时返回 null，用户输入 1 才能启动新研讨。
    return null;
  }

  /** 找出当前会话已经存在的活动研讨，保证独立 1 幂等。 */
  #activeDeliberationId(state: EvolutionStateOutDto): string | null {
    // 一次性运行处于活动状态时，runId 是任务协作群可追踪的当前流程标识。
    if (state.oneShotRun?.status === "running") {
      // 返回当前一次性流程标识，禁止再次建立新的研讨。
      return state.oneShotRun.runId;
    }
    // 从最新研讨向前查找仍在提问或等待建立专题的活动记录。
    for (let index = state.deliberations.length - 1; index >= 0; index -= 1) {
      // deliberation 是当前检查的研讨状态。
      const deliberation = state.deliberations[index];
      // questioning 表示韩立和南宫婉仍在交换问题与事实。
      if (deliberation.status === "questioning") {
        // 返回真实研讨标识供幂等反馈使用。
        return deliberation.deliberationId;
      }
      // ready-to-establish 表示研讨已形成候选但尚未完成范围确认。
      if (deliberation.status === "ready-to-establish") {
        // 返回真实研讨标识，禁止用户创建第二条并行确认链。
        return deliberation.deliberationId;
      }
    }
    // 没有活动研讨时允许独立 1 创建新的流程。
    return null;
  }

  /** 构造本轮真实读取规模，避免多个分支重复拼装同一组零散字段。 */
  #contextReadStats(
    request: SendPersonaConversationMessageInDto,
    prompt: string,
    methodContext: string,
    recentConversation: string,
  ): NonNullable<PersonaConversationOutDto["contextReadStats"]> {
    // 返回统一统计对象，字段值均来自本轮真实字符串长度。
    return {
      // methodCharacters 表示方法资料实际进入提示词的字符数。
      methodCharacters: methodContext.length,
      // recentConversationCharacters 表示当前会话上下文实际字符数。
      recentConversationCharacters: recentConversation.length,
      // latestUserMessageCharacters 表示用户本轮原话的字符数。
      latestUserMessageCharacters: request.message.trim().length,
      // promptCharacters 表示最终发送给韩立模型的完整提示字符数。
      promptCharacters: prompt.length,
    };
  }

  /** 保存完整人物回合的统一审计事件。 */
  #recordArchivedRound(
    conversation: PersonaConversationOutDto,
    decision: ConversationRoundTopicDecisionInDto,
    contextReadStats: NonNullable<PersonaConversationOutDto["contextReadStats"]>,
  ): void {
    // 事件中心只接收回合索引和统计，不复制完整用户或模型正文。
    this.#options.recordEvent("hanli.conversation.round_archived", {
      // conversationId 关联当前人物业务会话。
      conversationId: conversation.conversationId,
      // messageCount 记录回合完成后的权威消息数量。
      messageCount: conversation.messages.length,
      // topicTitle 使用模型已经通过解析校验的自由主题。
      topicTitle: decision.title,
      // contextReadStats 记录本轮真实输入规模。
      contextReadStats,
    });
  }

  /** 在任何外部调用前验证用户消息和实施工作区。 */
  #validateRequest(request: SendPersonaConversationMessageInDto): void {
    // 去除输入首尾空白后检查是否仍有真实内容。
    const userContent = request.message.trim();
    // 空消息既不能形成观点，也不能启动研讨。
    if (!userContent) {
      // 明确提示人物目标，避免底层模型收到空提示。
      throw new Error("发送给韩立的消息不能为空。");
    }
    // 统一人物会话限制单轮最多二万个 Unicode 字符。
    if (userContent.length > 20_000) {
      // 超限时阻止模型调用和数据库写入。
      throw new Error("发送给韩立的消息不能超过 20000 个字符。");
    }
    // 韩立调查和后续研讨必须知道当前登记工作区。
    if (!request.workspaceState?.roots?.length) {
      // 缺少工作区时阻止无范围的调查或执行链启动。
      throw new Error("韩立自由对话必须使用已登记工作区。");
    }
  }
}
