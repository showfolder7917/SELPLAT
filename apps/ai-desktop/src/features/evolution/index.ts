/** 专题演化公开入口：提供专题状态和版本保护的变更请求。 */

/** 专题演化控制器：订阅专题状态并执行恢复操作。 */
export { useEvolutionRuntime } from "./model/useEvolutionRuntime";
/** 专题变更参数工厂：附加当前版本，防止旧页面覆盖新状态。 */
export { evolutionMutationRequest } from "./model/evolution-runtime";
