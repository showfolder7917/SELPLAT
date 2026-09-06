/**
 * 对话功能公开入口：统一对外提供 Codex 会话页面、人物会话模型与消息投影能力。
 * 其他功能只依赖这个入口，避免将对话内部文件当成公共协议。
 */

/** Codex 授权对话框：显示命令授权并回传客户决定。 */
export { CodexApprovalDialog } from "./components/CodexApprovalDialog";
/** Codex 会话工作区：展示消息、实时输出和发送区域。 */
export { CodexConversationWorkspace } from "./components/CodexConversationWorkspace";
/** Markdown 消息视图：供人物与协作页面一致渲染 AI 回复。 */
export { MarkdownMessage } from "./components/MarkdownMessage";
/** SEL UI 会话容器：统一处理会话滚动和提交事件。 */
export { SelUiConversation } from "./components/SelUiConversation";
/** Codex 工作区控制器：组合发送、流式状态、审批和排队操作。 */
export { useCodexWorkspace } from "./model/useCodexWorkspace";
/** 人物会话控制器：维护南宫婉和韩立的会话快照。 */
export { usePersonaConversation } from "./model/usePersonaConversation";
/** 会话尾部跟随控制器：在新消息到达时维持合理滚动位置。 */
export { usePersonaConversationTailFollow } from "./model/usePersonaConversationTailFollow";
/** 协作流消息更新器：把 Codex 流式事件投影到前端消息。 */
export { applyCodexStreamEvent } from "./model/chat-message";
/** AI 消息工厂：为协作流创建可持续写入的助手消息。 */
export { createAssistantMessage } from "./model/chat-message";
/** 人物会话时间线合并器：合并持久消息和实时事件。 */
export { mergeRealtimeConversationTimeline } from "./model/realtime-conversation";
/** 人物会话投影器：将后端会话快照转换为前端可读时间线。 */
export { projectPersonaConversation } from "./model/realtime-conversation";
/** 待发送附件类型：供人物会话和截图功能交换图片。 */
export type { ComposerAttachment } from "./model/chat-message";
/** 会话消息类型：供协作和测试功能交换可视消息。 */
export type { Message } from "./model/chat-message";
