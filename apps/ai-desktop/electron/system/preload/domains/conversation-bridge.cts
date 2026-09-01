/** 主会话队列桥接；队列状态由主进程持久化并向所有窗口发布。 */
import { invoke, subscribe } from "../ipc-client.cjs";

export function conversationBridge() {
  return {
    getConversationDispatchState: () => invoke("desktop:get-conversation-dispatch-state"),
    enqueueMessage: (request: unknown) => invoke("desktop:enqueue-message", request),
    supplementQueuedMessage: (itemId: string) => invoke("desktop:supplement-queued-message", itemId),
    discardQueuedMessage: (itemId: string) => invoke("desktop:discard-queued-message", itemId),
    recoverConversationTask: () => invoke("desktop:recover-conversation-task"),
    discardConversationRecovery: () => invoke("desktop:discard-conversation-recovery"),
    onConversationDispatchState: (listener: (state: unknown) => void) => subscribe("desktop:conversation-dispatch-state", listener),
    sendMessage: (request: unknown) => invoke("desktop:send-message", request),
  };
}
