/**
 * 协作流式输出的数据结构。
 * 它由 useCollaborationWorkspace 创建，任务状态链、任务群和人物页负责读取。
 */

import type {
  // 会话消息：复用主会话已经验证过的流式文本和状态结构。
  Message,
} from "../../conversation";

/** 一个任务或时间线节点当前正在显示的流式回合。 */
export interface CollaborationLiveOutput {
  /** 可直接交给会话组件展示的助手消息。 */
  message: Message;
  /** Codex 回合标识；用于阻止两个回合的增量文本互相混合。 */
  turnId: string;
}
