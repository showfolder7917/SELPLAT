import type { WorkflowExceptionRecordOutDto } from "../../../../../contracts/services/workflow/index.js";
import type { WorkflowCheckpointState } from "../../domain/workflow-checkpoint.aggregate.js";

/** 同一规范完成事实所汇集的原始异常与其领域快照。 */
export interface CheckpointResolvedRoundEvent {
  event: WorkflowExceptionRecordOutDto;
  checkpoint: WorkflowCheckpointState;
}

/** 为同一原任务和恢复轮次生成唯一的解除完成事实身份。 */
export function checkpointResolutionIdentity(event: WorkflowExceptionRecordOutDto, checkpoint: WorkflowCheckpointState): string {
  // 原任务优先保证同一任务的多条异常收敛；回退事实保留来源类型，不能因字符串偶然相同而错误合并。
  const originalIdentity = checkpoint.taskId ? `task:${checkpoint.taskId}`
    : checkpoint.runId ? `run:${checkpoint.runId}`
      : checkpoint.proposalId ? `proposal:${checkpoint.proposalId}`
        : event.correlationId ? `correlation:${event.correlationId}`
          : `event:${event.eventId}`;
  // 轮次是原点复验后的新调查边界，不能与上一轮共用完成事实。
  return `checkpoint-resolution:${originalIdentity}:round:${checkpoint.round}`;
}
