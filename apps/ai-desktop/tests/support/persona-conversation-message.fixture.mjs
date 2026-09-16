/**
 * 手工会话快照必须显式指定持久化类别，避免 JavaScript 夹具绕过 DTO 的必填字段。
 */
export function personaConversationMessage(messageType, message) {
  return {
    ...message,
    messageType,
    // 客户显示消费者只接收 ready 投影；旧夹具必须明确模拟已经安全派生的记录。
    ...(messageType === "customer-visible" ? { customerDisplayState: "ready" } : {}),
  };
}
