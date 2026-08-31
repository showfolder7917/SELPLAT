// 南宫人物模块只公开唯一 Facade、Runtime 工厂和装配类型，外部不能取得人物内部实现。
export {
  NangongFacade,
  createNangongRuntime,
  type CreateNangongRuntimeOptions,
  type NangongApplicationPort,
  type NangongRuntime,
} from "./nangong.facade.js";
