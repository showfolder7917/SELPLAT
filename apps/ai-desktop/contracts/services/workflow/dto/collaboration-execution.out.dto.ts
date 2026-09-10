/**
 * Workflow 任务执行过程输出协议。
 *
 * 生产者：Workflow 协调器和统一测试流程。
 * 消费者：任务卡、恢复流程和审计记录。
 * 数据方向：Workflow -> 协作消费者。
 * 本文件只保存执行事实，不分配成员或启动测试。
 */

// CollaborationExecutionStatusValue 表示一次任务分配记录当前所处的执行状态。
import type { CollaborationExecutionStatusValue } from "../value/collaboration-task.value.js";
// CollaborationParticipantSnapshotOutDto 保存执行当时的人物身份，避免显示名变化影响历史。
import type { CollaborationParticipantSnapshotOutDto } from "./collaboration-member.out.dto.js";

/** 一次任务分配从开始到结束的完整执行记录。 */
export interface CollaborationExecutionRecordOutDto {
  /** 本次任务分配的唯一标识。 */
  assignmentId: string;
  /** 接受这次分配的执行者快照。 */
  executor: CollaborationParticipantSnapshotOutDto;
  /** 执行者实例的代次，用来区分重启前后的不同实例。 */
  workerGeneration: number;
  /** 当前执行状态。 */
  status: CollaborationExecutionStatusValue;
  /** Workflow 完成任务分配的时间。 */
  assignedAt: string;
  /** 真正开始执行的时间；尚未开始时为 null。 */
  executionStartedAt: string | null;
  /** 本次执行结束的时间；仍在执行时为 null。 */
  completedAt: string | null;
  /** 如果从旧分配转交而来，这里保存旧分配标识。 */
  transferFromAssignmentId: string | null;
  /** 这次分配是首次执行、恢复执行还是转交执行。 */
  handoffType: "initial" | "resume" | "transfer";
  /** 执行者返回的结果说明；尚未返回时为 null。 */
  result: string | null;
  /** 阻止本次执行继续的原因；未阻塞时为 null。 */
  blockingReason: string | null;
  /** 本次执行真实修改的工作区相对路径；旧记录可能没有该字段。 */
  changedFiles?: string[];
}

/** 令狐负责的统一测试在当前任务上的执行结果。 */
export interface CollaborationUnifiedTestOutDto {
  /** 统一测试当前所处阶段。 */
  status: "pending" | "running" | "passed" | "failed";
  /** 对这次统一测试负责的人物快照。 */
  owner: CollaborationParticipantSnapshotOutDto;
  /** 测试失败原因；未失败时为 null。 */
  failureReason: string | null;
  /** 测试开始时间；尚未开始时为 null。 */
  startedAt: string | null;
  /** 测试结束时间；尚未结束时为 null。 */
  completedAt: string | null;
}
