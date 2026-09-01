import type { CollaborationTimelineContentRoleValue, CollaborationTimelineDetailRoleValue } from "../value/collaboration-timeline.value.js";
/**
 * Workflow 任务协作群时间线输出协议。
 * 生产者：事件中心时间线投影；消费者：Renderer 协作群页面。
 * 数据方向：事件中心 -> Renderer。
 * 本文件只公开稳定人可读投影，不推断人物、不修改任务事实。
 */
import type { CollaborationParticipantSnapshotOutDto } from "./collaboration-member.out.dto.js";


export interface CollaborationTimelineNodeOutDto {
  nodeId: string;
  taskId: string | null;
  eventType: string;
  kind: "approval-application" | "approval-decision" | "distribution" | "analysis" | "execution" | "verification" | "repair" | "result";
  actor: CollaborationParticipantSnapshotOutDto;
  recipients: CollaborationParticipantSnapshotOutDto[];
  status: "completed" | "current" | "waiting" | "failed";
  action: string;
  summary: string;
  contentRole: CollaborationTimelineContentRoleValue;
  content: string;
  detailRole: CollaborationTimelineDetailRoleValue;
  detail: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number;
  automaticOpen: boolean;
  manualApprovalProposalId: string | null;
}

/** 一个专题对应一张可折叠任务卡；并行人物仍按分配顺序保存在同一纵向节点列表中。 */
export interface CollaborationTimelineGroupOutDto {
  groupId: string;
  topicId: string | null;
  proposalId: string | null;
  title: string;
  status: "waiting-approval" | "running" | "verifying" | "blocked" | "completed" | "cancelled";
  summary: string;
  nodes: CollaborationTimelineNodeOutDto[];
  executingCount: number;
  verifyingCount: number;
  waitingCount: number;
  completedCount: number;
  startedAt: string;
  updatedAt: string;
  durationMs: number;
  nextStep: string;
  failureNextStep: string | null;
  nextOwner: CollaborationParticipantSnapshotOutDto | null;
}

/** 主进程一次返回完整、稳定、有序的任务协作群投影。 */
export interface CollaborationTimelineSnapshotOutDto {
  version: 1;
  groups: CollaborationTimelineGroupOutDto[];
  updatedAt: string;
}
