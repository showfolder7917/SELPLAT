// 会话门面统一维护请求排队、活动状态与重启恢复；人物模块只看到会话能力，不知道 JSON 文件位置。
export { ConversationDispatchStore as ConversationFacade } from "./internal/conversation-dispatch.store.js";
