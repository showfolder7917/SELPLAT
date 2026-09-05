/** 韩立会话能够交给应用服务执行的确定性业务动作。 */
export type HanliConversationActionKindValue =
  // 普通用户消息继续交给韩立模型理解和回答。
  | "continue-conversation"
  // 已经进入内部研讨范围确认时，本轮输入只回答当前确认问题。
  | "confirm-deliberation-scope"
  // 用户独立输入 1 时，以当前观点快照直接启动新的内部研讨。
  | "start-deliberation"
  // 同一会话已经存在活动研讨时，返回原研讨而不是重复创建。
  | "return-existing-deliberation"
  // 当前会话还没有形成韩立观点时，拒绝创建没有业务目标的空研讨。
  | "reject-empty-viewpoint";

/** 韩立会话中可以被冻结并交给南宫婉研讨的当前观点。 */
export interface HanliConversationViewpointValue {
  /** 产生当前观点的韩立消息标识，用于追溯界面上用户实际确认的内容。 */
  sourceMessageId: string;
  /** 当前观点对应的用户消息标识；无法定位原问题时允许为空。 */
  sourceUserMessageId: string | null;
  /** 韩立向用户展示的完整观点正文，也是启动研讨时的权威业务方向。 */
  content: string;
  /** 观点形成时间，用于判断重试是否仍然指向同一轮会话事实。 */
  createdAt: string;
}

/** 会话聚合根根据当前状态和用户输入返回的业务决定。 */
export interface HanliConversationActionValue {
  /** 应用服务下一步必须执行的唯一动作，禁止再从自然语言文案推断流程。 */
  kind: HanliConversationActionKindValue;
  /** 启动研讨时冻结的观点；普通对话或空观点拒绝时允许为空。 */
  viewpoint: HanliConversationViewpointValue | null;
  /** 等待用户确认的内部研讨轮次；不处于范围确认阶段时允许为空。 */
  confirmationRoundId: string | null;
  /** 已存在的活动研讨标识；没有活动研讨时允许为空。 */
  activeDeliberationId: string | null;
}
