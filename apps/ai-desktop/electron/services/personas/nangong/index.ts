// 南宫人物模块只公开唯一 Facade、Runtime 工厂和装配类型，外部不能取得人物内部实现。
export {
  NangongFacade,
  createNangongRuntime,
  type CreateNangongRuntimeOptions,
  type NangongApplicationPort,
  type NangongRuntime,
} from "./nangong.facade.js";
import { NangongTaskDistributionService, type NangongTaskDistributionServiceOptions } from "./internal/nangong-task-distribution.service.js";
import type { NangongTaskDistributionPort } from "./internal/nangong-application.ports.js";

/** 组合根通过显式工厂装配南宫婉任务分发能力，不暴露 internal 实现类。 */
export function createNangongTaskDistribution(options: NangongTaskDistributionServiceOptions): NangongTaskDistributionPort {
  return new NangongTaskDistributionService(options);
}
