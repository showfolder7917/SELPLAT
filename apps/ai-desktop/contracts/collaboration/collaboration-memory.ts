/**
 * 协作记忆端口协议，用于从持久化层读取对话证据并写入演进主题来源快照。
 *
 * 生产者：事件中心 CollaborationMemoryService。
 * 消费者：南宫演进 facade 和主题研讨流程。
 * 数据方向：主进程内部端口调用；必要快照再通过桌面 API 返回 Renderer。
 * 本文件不约束 SQLite 表结构，也不直接执行查询。
 */
import type { EvolutionProposalOrigin, EvolutionProposalType, EvolutionSourceMessageSnapshot, NangongConversation, NangongEvolutionState } from "./nangong-evolution.js";

export interface CollaborationMemoryMessage {
  messageId: string;
  conversationId: string;
  sequenceNumber: number;
  role: "user" | "nangong";
  content: string;
  contentPreview: string;
  inferredIntent: string | null;
  createdAt: string;
}

export interface ConversationRoundTopicDecision {
  title: string;
  type: string;
  switchTopic: boolean;
  userIntent: string;
}

export interface ApprovalMemoryEvidence {
  approvalId: string;
  proposalType: EvolutionProposalType;
  origin: EvolutionProposalOrigin;
  decision: "approved" | "rejected" | "supplement-required";
  advice: string;
  approvedAt: string;
}

export interface CollaborationMemoryPort {
  syncConversation(conversation: NangongConversation): void;
  syncEvolutionState(state: NangongEvolutionState): void;
  buildNangongContext(conversation: NangongConversation): string;
  approvalEvidence(proposalType: EvolutionProposalType, origin: EvolutionProposalOrigin): ApprovalMemoryEvidence[];
  /** 按完整会话组读取南宫婉与 Codex 原文，供韩立综合后逐轮发问。 */
  readHanLiEvolutionCorpus(deliberationId: string): EvolutionSourceMessageSnapshot[];
  registerRound(conversation: NangongConversation, userMessageId: string, nangongMessageId: string, decision: ConversationRoundTopicDecision): void;
}
