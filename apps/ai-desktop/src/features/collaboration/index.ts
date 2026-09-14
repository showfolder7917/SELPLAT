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
/** 人物状态显示模型：供左侧任务区和人物页读取同一份主进程协作状态。 */
export { collaborationMemberDisplayModel } from "./model/collaboration-formatters";
