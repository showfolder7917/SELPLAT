// 韩立人物模块只公开唯一 Facade、Runtime 工厂和装配类型。
export {
  HanliFacade,
  createHanliRuntime,
  type CreateHanliRuntimeOptions,
  type HanliApplicationPort,
  type HanliRuntime,
  type HanliWorkflowPort,
} from "./hanli.facade.js";
export { presentHanliTaskStatus, presentHanliWorkflowStatus } from "./internal/conversation/hanli-task-status.presenter.js";
/** 韩立正式页面验收使用的窗口绑定内存场景；跨模块只能经此入口引用。 */
