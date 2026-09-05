// 执行能力唯一出口只公开受管执行门面及其纯请求结果协议。
export {
  ManagedExecutionFacade,
  type ManagedExecutionRequest,
  type ManagedExecutionResult,
} from "./managed-execution.facade.js";

// 自修范围聚合由执行能力公开，测试与发布门禁必须复用同一判断，不能各自猜测文件边界。
export {
  TaskRepairScopeAggregate,
  TaskRepairScopeViolationError,
  type TaskRepairScopeCheck,
} from "./domain/task-repair-scope.aggregate.js";
