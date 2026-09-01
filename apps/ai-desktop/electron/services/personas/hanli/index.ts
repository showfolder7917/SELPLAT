// 韩立人物模块只公开唯一 Facade、Runtime 工厂和装配类型。
export {
  HanliFacade,
  createHanliRuntime,
  type CreateHanliRuntimeOptions,
  type HanliApplicationPort,
  type HanliRuntime,
  type HanliWorkflowPort,
} from "./hanli.facade.js";
