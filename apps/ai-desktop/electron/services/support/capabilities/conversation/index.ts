// 会话能力的唯一公开出口只暴露应用级门面。
export { ConversationFacade } from "./conversation.facade.js";
// 协作人物会话复用同一公共会话能力，但人物业务提示词仍由上层注入。
export {
  CodexCollaborationSessionFactory,
  CollaborationCodexRegistry,
} from "./internal/collaboration-codex-sessions.js";
// 客户显示策略是会话业务规则；Worker 组合入口把它注入 DAO，DAO 不再定义内容判断。
export {
  derivePersonaCustomerDisplayMessage,
  PERSONA_CUSTOMER_DISPLAY_DERIVATION_VERSION,
  type PersonaCustomerDisplayDerivation,
} from "./internal/persona-customer-display-message.projector.js";
