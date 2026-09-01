/** 测试资源持有者、等待者与协调状态快照。 */
import type { TestResourceInDto } from "./test-resource.in.dto.js";
import type { TestResourceEventTypeValue } from "../value/test-resource-event-type.value.js";

export interface TestResourceHolderOutDto extends TestResourceInDto {
  leaseId: string;
  processId: number;
  queuedAt: string;
  acquiredAt: string;
  heartbeatAt: string;
}

export interface TestResourceWaiterOutDto extends TestResourceInDto {
  leaseId: string;
  processId: number;
  queuedAt: string;
}

export interface TestResourceCoordinatorStateOutDto {
  holder: TestResourceHolderOutDto | null;
  waiters: TestResourceWaiterOutDto[];
  localQueueDepth: number;
  lastEvent: {
    type: TestResourceEventTypeValue;
    runId: string;
    taskId: string | null;
    occurredAt: string;
    waitDurationMs: number;
    executionDurationMs: number | null;
    contentionCount: number;
  } | null;
}
