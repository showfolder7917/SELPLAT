/**
 * Workflow 任务协作群时间线输出协议。
 * 生产者：事件中心时间线投影；消费者：Renderer 协作群页面。
 * 数据方向：事件中心 -> Renderer。
 * 本文件只公开稳定人可读投影，不推断人物、不修改任务事实。
 */
import type { CollaborationParticipantSnapshot } from "./collaboration-member.out.dto.js";

export type CollaborationTimelineContentRole = "status" | "approval-content" | "approval-reason" | "task-content" | "analysis-output" | "execution-output" | "verification-output" | "repair-output" | "result-output";
export type CollaborationTimelineDetailRole = "none" | "application-evidence" | "approval-scope" | "task-breakdown" | "acceptance-criteria" | "changed-files" | "verification-evidence" | "recovery-conditions" | "result-evidence";

export interface CollaborationTimelineNode {
  nodeId: string;
  taskId: string | null;
  eventType: string;
  kind: "approval-application" | "approval-decision" | "distribution" | "analysis" | "execution" | "verification" | "repair" | "result";
  actor: CollaborationParticipantSnapshot;
  recipients: CollaborationParticipantSnapshot[];
  status: "completed" | "current" | "waiting" | "failed";
  action: string;
  summary: string;
  contentRole: CollaborationTimelineContentRole;
  content: string;
  detailRole: CollaborationTimelineDetailRole;
  detail: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number;
  automaticOpen: boolean;
  manualApprovalProposalId: string | null;
}

/** 一个专题对应一张可折叠任务卡；并行人物仍按分配顺序保存在同一纵向节点列表中。 */
export interface CollaborationTimelineGroup {
  groupId: string;
  topicId: string | null;
  proposalId: string | null;
  title: string;
  status: "waiting-approval" | "running" | "verifying" | "blocked" | "completed" | "cancelled";
  summary: string;
  nodes: CollaborationTimelineNode[];
  executingCount: number;
  verifyingCount: number;
  waitingCount: number;
  completedCount: number;
  startedAt: string;
  updatedAt: string;
  durationMs: number;
  nextStep: string;
  failureNextStep: string | null;
  nextOwner: CollaborationParticipantSnapshot | null;
}

/** 主进程一次返回完整、稳定、有序的任务协作群投影。 */
export interface CollaborationTimelineSnapshotOutDto {
  version: 1;
  groups: CollaborationTimelineGroup[];
  updatedAt: string;
}
