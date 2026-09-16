import type { EventCenterExceptionInDto } from "../../../contracts/services/support/capabilities/event-center/index.js";
import type { CodexStreamEventOutDto } from "../../../contracts/services/support/platform/codex/index.js";

/** 应用组合根把流式分发写入映射为局部可恢复的时间线投影。 */
export interface DistributionTimelineStreamRecorderDependencies {
  timeline: { appendStream(taskId: string, memberId: string, event: CodexStreamEventOutDto): unknown };
  eventCenter: { recordException(input: EventCenterExceptionInDto): void };
}

/**
 * 时间线门面会保存失败写入的重试上下文；这里不能再次上抛，否则整场内部研讨会错误失败。
 * 业务时间线事实仍由各自调用方决定是否上抛，避免把两种失败语义混为一谈。
 */
export function recordDistributionTimelineStream(
  dependencies: DistributionTimelineStreamRecorderDependencies,
  taskId: string,
  memberId: string,
  event: CodexStreamEventOutDto,
): void {
  try {
    dependencies.timeline.appendStream(taskId, memberId, event);
  } catch (error) {
    dependencies.eventCenter.recordException({
      kind: "technical",
      sourceType: "system",
      sourceId: "collaboration-timeline",
      operation: "append_distribution_stream",
      error,
      correlationId: taskId,
    });
  }
}
