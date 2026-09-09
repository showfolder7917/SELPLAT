/**
 * 主会话跨进程 API 的唯一领域视图。
 *
 * 调用链：Renderer conversation feature -> conversation desktop adapter
 * -> conversation preload bridge -> conversation IPC -> ConversationFacade 与 ManagedExecutionFacade。
 */
import type { DesktopApi } from "../desktop.api.js";

/** 主会话领域包含队列、恢复、发送和状态订阅能力。 */
export const CONVERSATION_DESKTOP_API_METHODS = [
  "getConversationDispatchState",
  "enqueueMessage",
  "supplementQueuedMessage",
  "discardQueuedMessage",
  "recoverConversationTask",
  "discardConversationRecovery",
  "onConversationDispatchState",
  "sendMessage",
] as const satisfies readonly (keyof DesktopApi)[];

/** Renderer 主会话模块只能使用这一组队列与发送能力。 */
export type ConversationDesktopApi = Pick<DesktopApi, (typeof CONVERSATION_DESKTOP_API_METHODS)[number]>;
