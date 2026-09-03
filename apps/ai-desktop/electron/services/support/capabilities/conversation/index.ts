// 会话能力的唯一公开出口只暴露应用级门面。
export { ConversationFacade } from "./conversation.facade.js";
// 协作人物会话复用同一公共会话能力，但人物业务提示词仍由上层注入。
export {
  CodexCollaborationSessionFactory,
  CollaborationCodexRegistry,
} from "./internal/collaboration-codex-sessions.js";
// 人物共享的会话持久化能力由本模块统一提供，具体人物不直接操作 SQLite。
export { PersonaConversationRepository } from "./internal/persona-conversation.repository.js";
