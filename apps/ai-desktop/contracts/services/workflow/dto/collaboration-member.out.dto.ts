/**
 * Workflow 协作成员输出协议。
 *
 * 生产者：Workflow 协作存储。
 * 消费者：Renderer、人物模块和集成服务。
 * 数据方向：Workflow -> 协作消费者。
 * 本文件不创建成员、不启动 Agent，也不保存运行实现。
 */

// CollaborationMemberKindValue 区分会话负责人和可分配任务的执行成员。
import type { CollaborationMemberKindValue } from "../value/collaboration-member.value.js";
// CollaborationMemberRoleValue 说明成员当前承担的业务角色。
import type { CollaborationMemberRoleValue } from "../value/collaboration-member.value.js";
// CollaborationMemberStateValue 表示成员当前是否空闲、工作或离线。
import type { CollaborationMemberStateValue } from "../value/collaboration-member.value.js";
// CollaborationWorkerPhaseValue 表示工作成员在单个任务内的细分进度。
import type { CollaborationWorkerPhaseValue } from "../value/collaboration-member.value.js";

/** 当前可参与协作的一个成员及其运行状态。 */
export interface CollaborationMemberOutDto {
  /** 成员的稳定唯一标识。 */
  memberId: string;
  /** 在界面和审计记录中显示的人物名称。 */
  displayName: string;
  /** 成员是会话负责人还是工作成员。 */
  kind: CollaborationMemberKindValue;
  /** 受保护成员不能被普通清理流程删除。 */
  protected: boolean;
  /** 是否允许为该成员分配新的工作。 */
  enabled: boolean;
  /** 成员当前的总体运行状态。 */
  state: CollaborationMemberStateValue;
  /** 成员当前承担的业务角色；尚未分配角色时为 null。 */
  role: CollaborationMemberRoleValue;
  /** 当前任务内的执行阶段；没有任务时为 null。 */
  phase: CollaborationWorkerPhaseValue;
  /** 成员运行实例的代次，用来区分重启前后的实例。 */
  generation: number;
  /** 当前占用该成员的任务；空闲时为 null。 */
  currentTaskId: string | null;
  /** 阻止成员继续工作的原因；未阻塞时为 null。 */
  blockingReason: string | null;
  /** 最近一次确认成员仍存活的时间。 */
  lastHeartbeatAt: string | null;
  /** 最近一次产生有效业务进度的时间。 */
  lastProtocolProgressAt: string | null;
  /** 最近一次分配任务的时间。 */
  lastAssignedAt: string | null;
  /** 成员记录创建时间。 */
  createdAt: string;
  /** 成员记录最后更新时间。 */
  updatedAt: string;
}

/** 写入历史事实的人物最小快照，避免名称变化影响旧记录。 */
export interface CollaborationParticipantSnapshotOutDto {
  /** 事件发生时的人物标识。 */
  memberId: string;
  /** 事件发生时的人物显示名称。 */
  displayName: string;
}
