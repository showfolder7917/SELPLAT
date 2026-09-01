/**
 * Workflow 当前协作状态快照输出协议。
 * 生产者：Workflow 协作存储；消费者：Renderer、人物自动化和治理服务。
 * 数据方向：Workflow -> 协作消费者。
 * 本文件只聚合成员、任务和批次，不执行任何流程动作。
 */
import type { CollaborationMemberOutDto } from "./collaboration-member.out.dto.js";
import type { DesktopOperatingModeValue } from "../value/collaboration-member.value.js";
import type { CollaborationIntegrationBatchOutDto, CollaborationTaskOutDto } from "./collaboration-task.out.dto.js";

export interface CollaborationStateOutDto {
  version: 1;
  mode: DesktopOperatingModeValue;
  selectedMemberId: string;
  members: CollaborationMemberOutDto[];
  tasks: CollaborationTaskOutDto[];
  integrationBatches: CollaborationIntegrationBatchOutDto[];
  nextIntegrationGeneration: number;
  updatedAt: string;
}
