// 从统一人物会话契约读取持久消息结构，Domain 不直接依赖数据库实现。
import type {
  PersonaConversationMessageOutDto,
  PersonaConversationOutDto,
} from "../../../../../contracts/services/personas/conversation/index.js";
// 从韩立公开契约读取会话动作和值对象，避免 Domain 私自创造跨层数据格式。
import type {
  HanliConversationActionValue,
  HanliConversationViewpointValue,
} from "../../../../../contracts/services/personas/hanli/index.js";

/** 创建会话聚合根时需要的全部业务事实。 */
export interface HanliConversationAggregateState {
  /** 数据库返回的当前韩立业务会话；Aggregate 只读取快照，不直接持久化。 */
  conversation: PersonaConversationOutDto;
  /** 当前等待用户确认的内部研讨轮次；没有等待确认时为 null。 */
  pendingConfirmationRoundId: string | null;
  /** 当前仍在推进的内部研讨标识；没有活动研讨时为 null。 */
  activeDeliberationId: string | null;
}

/**
 * 韩立会话聚合根。
 *
 * 该实体只判断会话当前是什么状态以及用户输入应触发什么动作；
 * 模型调用、数据库写入和 Workflow 调度全部留给应用服务完成。
 */
export class HanliConversationAggregate {
  /** 当前业务会话的稳定标识；空白会话尚未入库时允许为 null。 */
  readonly #conversationId: string | null;
  /** 当前会话的权威消息快照；只用于还原观点和用户确认上下文。 */
  readonly #messages: PersonaConversationMessageOutDto[];
  /** 已展示给用户的内部研讨范围确认轮次；存在时优先处理确认回复。 */
  readonly #pendingConfirmationRoundId: string | null;
  /** 已经启动且尚未结束的研讨标识；用于保证重复输入 1 不重复建任务。 */
  readonly #activeDeliberationId: string | null;
  /** 韩立最近一次面向用户形成的观点；输入 1 时冻结这份内容进入研讨。 */
  readonly #currentViewpoint: HanliConversationViewpointValue | null;
  /** 最近一轮仍等待用户澄清的原始问题；没有待澄清问题时为 null。 */
  readonly #pendingCustomerQuestion: string | null;

  /** 使用持久会话和 Workflow 状态还原实体，不在构造阶段产生任何副作用。 */
  constructor(state: HanliConversationAggregateState) {
    // 保存稳定会话标识，让后续动作能够明确归属哪一段人物会话。
    this.#conversationId = state.conversation.conversationId;
    // 复制消息数组，防止调用方在实体判断期间改变同一份会话快照。
    this.#messages = [...state.conversation.messages];
    // 保存当前范围确认轮次，使确认回复不会被误判成新研讨启动命令。
    this.#pendingConfirmationRoundId = state.pendingConfirmationRoundId;
    // 保存活动研讨标识，使重复命令可以幂等返回原流程。
    this.#activeDeliberationId = state.activeDeliberationId;
    // 从真实可见消息中恢复最近观点，不依赖模型是否输出某句固定邀请文案。
    this.#currentViewpoint = this.#findLatestViewpoint();
    // 从内部锚点恢复权威原问题，使用户补充不会替换最初调查目标。
    this.#pendingCustomerQuestion = this.#findPendingCustomerQuestion();
  }

  /** 返回当前业务会话标识，应用服务据此记录审计事件和研讨事实包。 */
  conversationId(): string | null {
    // 只返回构造时冻结的标识，避免一次处理过程跨到另一段新会话。
    return this.#conversationId;
  }

  /** 返回当前观点快照；调用方不能通过返回值修改实体内部消息。 */
  currentViewpoint(): HanliConversationViewpointValue | null {
    // 没有观点时明确返回 null，让应用服务给用户可理解的反馈。
    if (!this.#currentViewpoint) {
      // 空值代表韩立尚未形成可以交给南宫婉研讨的业务方向。
      return null;
    }
    // 复制值对象，保证后续异步调用使用本轮确认时的固定内容。
    return { ...this.#currentViewpoint };
  }

  /** 返回仍在等待澄清的客户原问题，普通会话没有该状态时返回 null。 */
  pendingCustomerQuestion(): string | null {
    // 返回构造时从持久消息恢复的固定原问题，禁止模型在后续回合覆盖。
    return this.#pendingCustomerQuestion;
  }

  /** 根据当前会话事实解释用户输入，返回唯一、结构化的下一步动作。 */
  decideUserMessage(message: string): HanliConversationActionValue {
    // 去掉输入首尾空白，使独立数字 1 的判断不受输入法空格影响。
    const normalizedMessage = message.trim();
    // 已展示范围确认时，本轮回复必须先完成现有研讨，不能创建第二条研讨链。
    if (this.#pendingConfirmationRoundId) {
      // 返回明确轮次，让应用服务调用范围确认端口而不是普通聊天模型。
      return this.#action("confirm-deliberation-scope", this.#pendingConfirmationRoundId);
    }
    // 普通文字继续进入韩立会话，不参与任何流程关键词识别。
    if (normalizedMessage !== "1") {
      // 普通会话仍携带当前观点，便于调用方记录状态但不得据此自动执行。
      return this.#action("continue-conversation", null);
    }
    // 同一研讨已经活动时，独立 1 只返回原流程，禁止重复创建专题和任务。
    if (this.#activeDeliberationId) {
      // 返回现有研讨标识，使界面能够定位原任务而不是显示一次新的假启动。
      return this.#action("return-existing-deliberation", null);
    }
    // 没有韩立观点时不能把数字 1 解释成空白授权或无目标研讨。
    if (!this.#currentViewpoint) {
      // 返回可识别的拒绝动作，由应用服务保存一条清楚的用户反馈。
      return this.#action("reject-empty-viewpoint", null);
    }
    // 当前会话已有观点且没有冲突流程，独立 1 直接进入内部研讨。
    return this.#action("start-deliberation", null);
  }

  /** 组装统一动作对象，避免每个分支重复传递零散状态变量。 */
  #action(
    kind: HanliConversationActionValue["kind"],
    confirmationRoundId: string | null,
  ): HanliConversationActionValue {
    // 返回一次完整领域决定，应用服务只能按 kind 分发受控副作用。
    return {
      // kind 是应用服务唯一允许读取的流程分支，不再检查可见回复文本。
      kind,
      // 观点在构造时已冻结；启动研讨和幂等反馈都使用同一份事实。
      viewpoint: this.currentViewpoint(),
      // 确认轮次只在 confirm-deliberation-scope 动作中存在。
      confirmationRoundId,
      // 活动研讨标识帮助调用方返回原流程，其他动作中允许为空。
      activeDeliberationId: this.#activeDeliberationId,
    };
  }

  /** 从当前会话反向查找最近一条韩立可见回复，并关联它之前的用户消息。 */
  #findLatestViewpoint(): HanliConversationViewpointValue | null {
    // 从最新消息向前扫描，保证找到用户此刻在界面看到的最近观点。
    for (let index = this.#messages.length - 1; index >= 0; index -= 1) {
      // currentMessage 是当前扫描位置的权威持久消息。
      const currentMessage = this.#messages[index];
      // 内部研讨消息不属于韩立面向用户形成的当前观点。
      if (currentMessage.messageId.startsWith("internal:")) {
        // 跳过内部消息后继续寻找最近的直接韩立回复。
        continue;
      }
      // 程序生成的控制反馈只说明流程状态，不能成为下一次研讨的新观点。
      if (currentMessage.messageId.startsWith("hanli-control:")) {
        // 跳过启动、幂等或缺少观点反馈，继续查找此前真正的韩立观点。
        continue;
      }
      // 澄清问题是向用户索取信息，不代表韩立已经形成了可执行观点。
      if (currentMessage.messageId.startsWith("hanli-clarification:")) {
        // 跳过澄清消息，防止用户输入 1 后围绕问题句创建空研讨。
        continue;
      }
      // 非人物消息不能代表韩立观点。
      if (currentMessage.speakerType !== "persona") {
        // 用户和系统消息留给来源关联逻辑处理，不作为观点返回。
        continue;
      }
      // 其他人物消息不能冒充韩立对用户形成的观点。
      if (currentMessage.speakerPersonaId !== "han-li") {
        // 继续向前查找真实韩立回复。
        continue;
      }
      // 空白回复没有可研讨内容，必须继续寻找更早的有效观点。
      if (!currentMessage.content.trim()) {
        // 跳过空白内容，避免创建没有目标的内部研讨。
        continue;
      }
      // 在观点之前查找最近一条用户消息，保留用户问题的可追溯关系。
      const sourceUserMessageId = this.#findPreviousUserMessageId(index);
      // 返回界面上真实存在的韩立观点，不重新概括或改写用户确认内容。
      return {
        // 消息标识让后续研讨事实能够回链到用户实际确认的气泡。
        sourceMessageId: currentMessage.messageId,
        // 用户来源在历史迁移数据缺失时允许为空，不伪造消息标识。
        sourceUserMessageId,
        // 完整正文作为南宫婉开始研讨时的当前观点依据。
        content: currentMessage.content.trim(),
        // 使用原消息形成时间，禁止用本次点击时间替代观点事实时间。
        createdAt: currentMessage.createdAt,
      };
    }
    // 整段会话没有有效韩立回复时，明确表示尚未形成观点。
    return null;
  }

  /** 查找指定韩立观点之前最近一条用户消息。 */
  #findPreviousUserMessageId(viewpointIndex: number): string | null {
    // 从观点前一项开始反向扫描，保持真实对话发生顺序。
    for (let index = viewpointIndex - 1; index >= 0; index -= 1) {
      // candidate 是可能与当前观点对应的上游消息。
      const candidate = this.#messages[index];
      // 只有真实用户消息才能成为观点来源。
      if (candidate.speakerType === "user") {
        // 返回数据库稳定消息标识，不以正文匹配推断来源。
        return candidate.messageId;
      }
    }
    // 迁移历史中找不到用户消息时保留空值，禁止制造不存在的来源。
    return null;
  }

  /** 从当前会话的内部锚点恢复仍然有效的客户原问题。 */
  #findPendingCustomerQuestion(): string | null {
    // latestDirect 保存当前最后一条用户或韩立可见消息，用于判断澄清是否仍未结束。
    let latestDirect: PersonaConversationMessageOutDto | null = null;
    // marker 保存最近一条结构化澄清锚点，锚点正文不会直接展示给用户。
    let marker: PersonaConversationMessageOutDto | null = null;
    // 从最新消息向前扫描，同时寻找最新可见消息和最新澄清锚点。
    for (let index = this.#messages.length - 1; index >= 0; index -= 1) {
      // candidate 是本次扫描检查的持久消息。
      const candidate = this.#messages[index];
      // 第一条非内部消息就是当前页面最后一条直接对话。
      if (!latestDirect && !candidate.messageId.startsWith("internal:")) {
        // 保存消息对象，后续必须确认锚点仍然指向它。
        latestDirect = candidate;
      }
      // 第一条澄清锚点就是当前会话最新的原问题记录。
      if (!marker && candidate.messageId.startsWith("internal:hanli-inquiry-anchor:")) {
        // 保存锚点，后续解析其结构化内容。
        marker = candidate;
      }
      // 两项事实都已找到后停止扫描，避免继续读取无关历史。
      if (latestDirect && marker) {
        // 退出循环后统一校验两条消息之间的关联关系。
        break;
      }
    }
    // 任一事实缺失都表示当前没有可安全延续的澄清问题。
    if (!latestDirect || !marker) {
      // 返回 null，普通对话将以本轮用户输入作为新的当前问题。
      return null;
    }
    // 解析内部锚点时捕获历史损坏，禁止单条坏记录阻断整段人物会话。
    try {
      // 锚点只接受原问题和对应澄清消息标识两个业务字段。
      const value = JSON.parse(marker.content) as {
        // customerQuestion 保存用户最初需要解决的问题。
        customerQuestion?: unknown;
        // clarificationMessageId 保存当时展示给用户的澄清消息标识。
        clarificationMessageId?: unknown;
      };
      // 锚点不再指向最后一条可见消息时，说明澄清已经被后续对话结束。
      if (value.clarificationMessageId !== latestDirect.messageId) {
        // 返回 null，避免旧锚点劫持新的用户目标。
        return null;
      }
      // 非字符串原问题属于无效历史记录，不能交给后续模型。
      if (typeof value.customerQuestion !== "string") {
        // 返回 null，禁止把未知 JSON 类型转换成用户原话。
        return null;
      }
      // 去掉存储中可能存在的首尾空白，保留用户原问题正文不变。
      const customerQuestion = value.customerQuestion.trim();
      // 空白问题不能成为调查锚点。
      if (!customerQuestion) {
        // 返回 null，让当前输入重新建立清楚的对话目标。
        return null;
      }
      // 返回验证通过的客户原问题。
      return customerQuestion;
    } catch {
      // 历史锚点不是有效 JSON 时安全忽略，不制造新的流程异常。
      return null;
    }
  }
}
