/**
 * Evolution 提案与分发计划输出协议。
 * 生产者：Evolution 状态服务；消费者：南宫婉、韩立、Workflow 与 Renderer。
 * 数据方向：Evolution -> 跨人物协作消费者。
 * 本文件只表达共享提案事实，不接收人物命令或直接分发任务。
 */
import type { EvolutionApproval } from "./evolution-approval.out.dto.js";
import type { EvolutionProposalOrigin, EvolutionTopicStatus } from "./evolution-topic.out.dto.js";

export type EvolutionProposalType = "规则演进" | "规则优化" | "规则重构" | "目录演进" | "代码修正" | "Bug修复";
export type EvolutionProposalPurpose = "work-proposal" | "self-capability-upgrade";

export interface EvolutionDistributionUnit {
  title: string;
  scope: string;
  acceptanceCriteria: string[];
  expectedFiles: string[];
  independentReason: string;
}

export interface EvolutionDistributionValidation {
  decision: "passed" | "revise";
  reason: string;
  findings: string[];
  validatedAt: string;
}

export interface EvolutionDistributionPlan {
  version: 1;
  summary: string;
  units: EvolutionDistributionUnit[];
  validation: EvolutionDistributionValidation;
  plannedAt: string;
}

export interface EvolutionProposal {
  proposalId: string;
  topicId: string;
  version: number;
  title: string;
  type: EvolutionProposalType;
  origin: EvolutionProposalOrigin;
  submitterMemberId: string;
  submitterDisplayName: string;
  purpose: EvolutionProposalPurpose;
  targetMemberId: string | null;
  targetMemberDisplayName: string | null;
  capabilityScope: string | null;
  supersedesProposalId: string | null;
  revisionFeedbackApprovalId: string | null;
  content: string;
  evidence: string[];
  impactScope: string[];
  exclusions: string[];
  risks: string[];
  rollbackPlan: string;
  acceptanceCriteria: string[];
  distributionPlan: EvolutionDistributionPlan | null;
  status: Exclude<EvolutionTopicStatus, "registered" | "investigating">;
  approvals: EvolutionApproval[];
  distributedTaskIds: string[];
  resultSummary: string | null;
  createdAt: string;
  updatedAt: string;
}
