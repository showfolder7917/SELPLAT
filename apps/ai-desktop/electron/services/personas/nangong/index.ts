/** 南宫婉唯一业务门面，供组合根和 IPC 调用人物公开能力。 */
export { NangongFacade } from "./nangong.facade.js";
/** 创建南宫婉人物运行时，供 Workflow 组合根取得受控生命周期。 */
export { createNangongRuntime } from "./nangong.facade.js";
/** 南宫婉运行时装配参数，供组合根注入共享状态和最小端口。 */
export type { CreateNangongRuntimeOptions } from "./nangong.facade.js";
/** 南宫婉应用能力边界，供门面隔离 internal 实现。 */
export type { NangongApplicationPort } from "./nangong.facade.js";
/** 南宫婉运行对象，供组合根启动或停止人物生命周期。 */
export type { NangongRuntime } from "./nangong.facade.js";
/** 把南宫婉核实回复解析为结构化事实，供韩立调查链消费。 */
export { nangongInquiryResult } from "./nangong.facade.js";
/** 为核实结果补充客户纠正语义，供韩立调查链保留原问题。 */
export { nangongInquiryWithCorrection } from "./nangong.facade.js";
/** 南宫婉任务分发实现；仅由本文件工厂实例化，不形成公开类出口。 */
import { NangongTaskDistributionService } from "./internal/distribution/nangong-task-distribution.service.js";
/** 南宫婉任务分发装配参数；用于工厂参数类型检查。 */
import type { NangongTaskDistributionServiceOptions } from "./internal/distribution/nangong-task-distribution.service.js";
/** Workflow 依赖的最小任务分发端口；公开工厂只返回该边界。 */
import type { NangongTaskDistributionPort } from "./internal/application/nangong-application.ports.js";

/** 组合根通过显式工厂装配南宫婉任务分发能力，不暴露 internal 实现类。 */
export function createNangongTaskDistribution(options: NangongTaskDistributionServiceOptions): NangongTaskDistributionPort {
  return new NangongTaskDistributionService(options);
}
