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
