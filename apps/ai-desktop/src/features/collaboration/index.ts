/**
 * 协作功能公开入口：向 Developer 应用和其他功能提供协作页面、协作状态与显示转换能力。
 * 调用方只从本文件选择所需符号，不需要知道 components 和 model 的内部路径。
 */

/** 协作资源管理器：在左侧树中展示成员、任务和当前阶段。 */
export { CollaborationExplorerFeature } from "./components/CollaborationExplorerFeature";
/** 协作工作区：根据选中内容组装任务群或成员页面。 */
export { CollaborationWorkspaceFeature } from "./components/CollaborationWorkspaceFeature";
/** 协作状态控制器：为应用层提供任务、时间线和继续执行操作。 */
export { useCollaborationWorkspace } from "./model/useCollaborationWorkspace";
/** 协作成员状态文案：供对话页面把稳定状态码转成客户可读文本。 */
export { collaborationTaskStateLabel } from "./model/collaboration-formatters";
