// 执行能力唯一出口只公开受管执行门面及其纯请求结果协议。
export {
  ManagedExecutionFacade,
  type ManagedExecutionRequest,
  type ManagedExecutionResult,
} from "./managed-execution.facade.js";
