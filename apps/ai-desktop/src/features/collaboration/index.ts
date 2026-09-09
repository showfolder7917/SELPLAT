/**
 * 协作功能唯一公开入口。
 *
 * Developer 应用、工作区路由和主会话只从这里使用协作能力，
 * 不直接依赖 components 或 model 的内部文件。
 */

/** 右侧协作工作区：供 Developer 路由显示任务群或普通协作成员页面。 */
export { CollaborationWorkspaceFeature } from "./components/CollaborationWorkspaceFeature";
/** 协作状态控制器：供应用层订阅成员、任务、时间线和实时输出并执行协作操作。 */
export { useCollaborationWorkspace } from "./model/useCollaborationWorkspace";
/** 协作任务状态文案：供主会话把后端稳定状态码转换成中日文客户文案。 */
export { collaborationTaskStateLabel } from "./model/collaboration-formatters";
/** 人物导航显示转换器：供 Developer 左侧任务区解释成员的圆点与文字状态。 */
export { collaborationMemberPresenceState, collaborationMemberStateLabel } from "./model/collaboration-formatters";
/** 人物会话临时活动：供 Developer 左侧任务区显示正在回复、调查或等待审批。 */
export type { PersonaConversationActivity } from "./model/collaboration-formatters";
