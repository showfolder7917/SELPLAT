// 自动测试预检是人工或人物启动测试前的统一权限与环境检查。
export { prepareAutomaticTesting } from "./automatic-test-preflight.facade.js";
// 测试资源门面保证不同任务与进程不能同时占用同一端口和构建目录。
export { TestResourceCoordinatorFacade } from "./test-resource-coordinator.facade.js";
import { TaskWorktreeTestRunner } from "./internal/task-worktree-test.runner.js";
import {
  FixedUnifiedTestRunner,
  UnifiedTestInfrastructureError,
  type FixedUnifiedTestRunnerOptions,
} from "./internal/fixed-unified-test.runner.js";

// Runner Port 只保留协作流程实际需要的执行方法，隐藏具体子进程和依赖租约实现。
export type TaskWorktreeTestPort = Pick<TaskWorktreeTestRunner, "run">;

// 组合根通过工厂装配固定测试 Runner，其他模块不能直接导入 internal 构造器。
export function createTaskWorktreeTestRunner(
  ...arguments_: ConstructorParameters<typeof TaskWorktreeTestRunner>
): TaskWorktreeTestPort {
  return new TaskWorktreeTestRunner(...arguments_);
}

// 固定统一测试端口只公开运行行为，人物看不到子进程和脚本清单。
export type FixedUnifiedTestPort = Pick<FixedUnifiedTestRunner, "run">;

// 人物通过公开工厂申请固定统一测试能力，并显式登记发起人和事件命名空间。
export function createFixedUnifiedTestRunner(options: FixedUnifiedTestRunnerOptions): FixedUnifiedTestPort {
  return new FixedUnifiedTestRunner(options);
}

// 失败分类由测试能力自己判断，人物只据此选择恢复路线。
export function isUnifiedTestInfrastructureError(error: unknown): boolean {
  return error instanceof UnifiedTestInfrastructureError;
}
