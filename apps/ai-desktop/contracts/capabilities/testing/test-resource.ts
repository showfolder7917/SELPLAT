/**
 * 测试资源协调协议，描述端口和构建根等排他资源的请求、持有与等待状态。
 *
 * 生产者：主进程 TestResourceCoordinatorFacade。
 * 消费者：任务测试、集成验证和灵狐统一测试流程。
 * 数据方向：主进程内部协调，状态快照可通过协作协议返回 Renderer。
 * 本文件不执行测试命令，也不创建或删除构建目录。
 */
export type TestResourceEventType = "queued" | "acquired" | "contended" | "released" | "timeout" | "failed" | "stale-recovered";

export interface TestResourceRequest {
  runId: string;
  taskId: string | null;
  initiatorMemberId: string;
  kind: "task-validation" | "integration-validation" | "linghu-unified-test";
  port: number | null;
  buildRoot: string;
}

export interface TestResourceHolder extends TestResourceRequest {
  leaseId: string;
  processId: number;
  queuedAt: string;
  acquiredAt: string;
  heartbeatAt: string;
}

export interface TestResourceWaiter extends TestResourceRequest {
  leaseId: string;
  processId: number;
  queuedAt: string;
}

export interface TestResourceCoordinatorState {
  holder: TestResourceHolder | null;
  waiters: TestResourceWaiter[];
  localQueueDepth: number;
  lastEvent: {
    type: TestResourceEventType;
    runId: string;
    taskId: string | null;
    occurredAt: string;
    waitDurationMs: number;
    executionDurationMs: number | null;
    contentionCount: number;
  } | null;
}
