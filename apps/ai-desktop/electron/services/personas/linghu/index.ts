/**
 * 令狐主进程模块的唯一公开出口。
 *
 * 业务调用方只能依赖这里公开的 Facade 和 Runtime 工厂，不能获取 Store、Runner 或内部常量。
 */
// 自动保障门面是令狐检测、恢复和模块轮转的唯一业务入口。
export { LinghuAutomationFacade } from "./linghu-automation.facade.js";
// Runtime 工厂内部创建 Store 与 Runner，只把 Facade 和受控生命周期能力交给组合根。
export {
  createLinghuRuntime,
  type CreateLinghuRuntimeOptions,
  type LinghuRuntime,
  type LinghuUnifiedTestRuntimeOptions,
} from "./internal/create-linghu-runtime.js";
