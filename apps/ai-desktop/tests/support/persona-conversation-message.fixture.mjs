/**
 * 手工会话快照必须显式指定持久化类别，避免 JavaScript 夹具绕过 DTO 的必填字段。
 */
export function personaConversationMessage(messageType, message) {
  return { ...message, messageType };
}
