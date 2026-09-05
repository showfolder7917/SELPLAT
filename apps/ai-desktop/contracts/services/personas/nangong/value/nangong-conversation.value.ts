/**
 * 南宫婉会话聚合根使用的稳定值对象。
 *
 * 生产者：Electron 南宫婉会话领域聚合根。
 * 消费者：南宫婉会话应用服务及其专项测试。
 * 数据方向：Evolution 状态快照 -> 会话聚合根 -> 明确的会话动作。
 * 本文件不保存会话、不调用 Codex，也不决定跨人物 Workflow 的推进顺序。
 */

/** 南宫婉会话收到一条用户输入后允许返回的业务动作。 */
export type NangongConversationActionKindValue =
  | "continue-conversation"
  | "reject-missing-confirmation"
  | "report-active-run"
  | "retire-orphan-and-start"
  | "start-confirmed-evolution";

/** 会话聚合根对当前用户输入作出的确定性判断。 */
export interface NangongConversationActionValue {
  /** 要执行的动作种类；应用服务只能按该值进入一个分支。 */
  kind: NangongConversationActionKindValue;
  /** 当前消息携带的专题标识；普通自由会话没有专题时为 null。 */
  topicId: string | null;
  /** 已存在的一次性运行标识；没有活动运行时为 null。 */
  activeRunId: string | null;
  /** 已存在运行正在执行的自然语言动作；没有活动运行时为 null。 */
  activeRunAction: string | null;
}

/** 从持久化 Evolution 状态提取的南宫婉会话属性。 */
export interface NangongConversationSnapshotValue {
  /** 当前南宫婉会话标识；尚未建立会话时为 null。 */
  conversationId: string | null;
  /** 当前会话已经持久化的消息数量，用于空会话和草稿判断。 */
  messageCount: number;
  /** 等待用户回复 1 的邀请消息标识；当前没有邀请时为 null。 */
  pendingInvitationMessageId: string | null;
  /** 邀请所属会话标识；用于阻止旧会话中的 1 启动新会话流程。 */
  pendingInvitationConversationId: string | null;
  /** 当前一次性运行标识；当前没有运行时为 null。 */
  activeRunId: string | null;
  /** 当前一次性运行状态；没有运行时为 null。 */
  activeRunStatus: "running" | "completed" | "blocked" | null;
  /** 当前一次性运行正在处理的业务动作；没有运行时为 null。 */
  activeRunAction: string | null;
}
