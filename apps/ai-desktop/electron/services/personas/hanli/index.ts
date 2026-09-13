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

// 韩立验收场景提交能力只服务首次真实验收，不形成令狐介入事实。
export { createAcceptanceSceneSubmission, validateAcceptanceScenePlan } from "./internal/acceptance/hanli-acceptance-scene.js";
