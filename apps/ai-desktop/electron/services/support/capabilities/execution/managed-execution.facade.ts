// 受管执行门面统一推进分析、实施和验证阶段，调用方不接触底层 Codex 轮次细节。
export {
  ManagedTaskExecutor as ManagedExecutionFacade,
  type ManagedExecutionRequest,
  type ManagedExecutionResult,
} from "./internal/managed-task.executor.js";
