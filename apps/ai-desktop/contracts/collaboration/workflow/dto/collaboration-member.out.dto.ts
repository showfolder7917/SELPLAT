/**
 * Workflow 协作成员与任务来源快照输出协议。
 * 生产者：Workflow 协作存储；消费者：Renderer、人物模块和集成服务。
 * 数据方向：Workflow -> 协作消费者。
 * 本文件不创建成员、不启动 Agent，也不保存运行实现。
 */
import type { Locale } from "../../../foundation/base.js";
import type { WorkspaceState } from "../../../platform/workspace/index.js";

export type DesktopOperatingMode = "single-conversation" | "collaboration";
export type CollaborationMemberKind = "conversation-owner" | "worker";
export type CollaborationMemberRole = "conversation" | "executor" | null;
export type CollaborationMemberState = "idle" | "conversation" | "assigned" | "working" | "retiring" | "recovering" | "draining" | "offline";
export type CollaborationWorkerPhase = "analyzing" | "planning" | "implementing" | "verifying" | "finalizing" | "ready" | "blocked" | "failed" | null;

export interface CollaborationMember {
  memberId: string;
  displayName: string;
  kind: CollaborationMemberKind;
  protected: boolean;
  enabled: boolean;
  state: CollaborationMemberState;
  role: CollaborationMemberRole;
  phase: CollaborationWorkerPhase;
  generation: number;
  currentTaskId: string | null;
  blockingReason: string | null;
  lastHeartbeatAt: string | null;
  lastProtocolProgressAt: string | null;
  lastAssignedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CollaborationParticipantSnapshot {
  memberId: string;
  displayName: string;
}

export interface CollaborationTaskSnapshot {
  title: string;
  problemStatement: string;
  confirmedIntent: string;
  constraints: string[];
  acceptanceCriteria: string[];
  sourceMessageIds: number[];
  attachmentIds: string[];
  workspaceState: WorkspaceState;
  locale: Locale;
  contentHash: string;
}
