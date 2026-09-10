/**
 * Workflow 当前协作状态快照输出协议。
 * 生产者：Workflow 协作存储；消费者：Renderer、人物自动化和治理服务。
 * 数据方向：Workflow -> 协作消费者。
 * 本文件只聚合成员、任务和批次，不执行任何流程动作。
 */
// DesktopOperatingModeValue 区分单会话模式和多人协作模式。
import type { DesktopOperatingModeValue } from "../value/collaboration-member.value.js";
// CollaborationIntegrationBatchOutDto 保存当前和历史集成批次。
import type { CollaborationIntegrationBatchOutDto } from "./collaboration-integration.out.dto.js";
// CollaborationMemberOutDto 保存所有可参与协作的人物状态。
import type { CollaborationMemberOutDto } from "./collaboration-member.out.dto.js";
// CollaborationTaskOutDto 保存所有协作任务的当前快照。
import type { CollaborationTaskOutDto } from "./collaboration-task.out.dto.js";

/** Renderer 可以整体替换使用的当前协作状态快照。 */
export interface CollaborationStateOutDto {
  /** 快照格式版本；读取方可据此执行兼容处理。 */
  version: 1;
  /** 桌面当前运行模式。 */
  mode: DesktopOperatingModeValue;
  /** 当前界面选中的成员标识。 */
  selectedMemberId: string;
  /** 当前存在的全部协作成员。 */
  members: CollaborationMemberOutDto[];
  /** 当前及历史协作任务。 */
  tasks: CollaborationTaskOutDto[];
  /** 当前及历史版本集成批次。 */
  integrationBatches: CollaborationIntegrationBatchOutDto[];
  /** 创建下一个集成批次时应使用的代次。 */
  nextIntegrationGeneration: number;
  /** 该快照最后一次发生变化的时间。 */
  updatedAt: string;
}
