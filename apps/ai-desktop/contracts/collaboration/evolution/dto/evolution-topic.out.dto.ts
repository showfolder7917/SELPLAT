/**
 * Evolution 专题共享事实输出协议。
 * 生产者：Evolution 状态服务；消费者：人物应用服务、Workflow 与 Renderer 工作台。
 * 数据方向：Evolution -> 业务消费者。
 * 本文件不包含人物对话命令、审批命令或持久化实现。
 */
import type { Locale } from "../../../foundation/base.js";
import type { WorkspaceState } from "../../../platform/workspace/workspace.js";

export type EvolutionProposalOrigin = "nangong" | "linghu";
export type EvolutionTopicStatus = "registered" | "investigating" | "pending-approval" | "supplement-required" | "rejected" | "approved" | "executing" | "verifying" | "pending-acceptance" | "completed" | "blocked";

/** 对话库原文在研讨开始时冻结；来源表以后迁移或清理也不能破坏专题证据。 */
export interface EvolutionSourceMessageSnapshot {
  snapshotId: string;
  deliberationId: string;
  source: "nangong" | "codex";
  conversationId: string;
  sourceMessageId: string;
  sequenceNumber: number;
  role: string;
  responsePhase: string | null;
  content: string;
  originalCreatedAt: string;
  capturedAt: string;
}

export interface EvolutionTopic {
  topicId: string;
  title: string;
  goal: string;
  scope: string[];
  exclusions: string[];
  evidence: string[];
  acceptanceCriteria: string[];
  workspaceState: WorkspaceState;
  locale: Locale;
  origin: EvolutionProposalOrigin;
  sourceConversationMessageIds: string[];
  deliberationId: string | null;
  continuationOfTopicId: string | null;
  nextTopicId: string | null;
  seriesId: string;
  roundNumber: number;
  status: EvolutionTopicStatus;
  /** 课题保存修订号用于拒绝基于过期界面的覆盖写入。 */
  topicRevision: number;
  currentProposalVersion: number;
  recoveryPoint: string;
  createdAt: string;
  updatedAt: string;
}
