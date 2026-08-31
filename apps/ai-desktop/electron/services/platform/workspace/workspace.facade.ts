// 工作区门面把路径登记与校验统一收口；调用方不需要知道状态保存在 JSON 文件中。
export { WorkspaceStore as WorkspaceFacade } from "./internal/workspace.store.js";
