import type { EvolutionProposalTypeValue, EvolutionProposalPurposeValue } from "../value/evolution-proposal.value.js";
/**
 * Evolution 提案与分发计划输出协议。
 * 生产者：Evolution 状态服务；消费者：南宫婉、韩立、Workflow 与 Renderer。
 * 数据方向：Evolution -> 跨人物协作消费者。
 * 本文件只表达共享提案事实，不接收人物命令或直接分发任务。
 */
import type { EvolutionApprovalOutDto } from "./evolution-approval.out.dto.js";
import type { EvolutionProposalOriginValue, EvolutionTopicStatusValue } from "../value/evolution-topic.value.js";


export interface EvolutionDistributionUnitOutDto {
  title: string;
  scope: string;
  acceptanceCriteria: string[];
  expectedFiles: string[];
  /** 南宫婉从当前用户索引选择、由任务提交时冻结的专项规则逻辑 ID。 */
  taskRuleIds?: string[];
  independentReason: string;
}

export interface EvolutionDistributionValidationOutDto {
  decision: "passed" | "revise";
  reason: string;
  findings: string[];
  validatedAt: string;
}

export interface EvolutionDistributionPlanOutDto {
  version: 1;
  summary: string;
  units: EvolutionDistributionUnitOutDto[];
  validation: EvolutionDistributionValidationOutDto;
  plannedAt: string;
}

export interface EvolutionProposalOutDto {
  proposalId: string;
  topicId: string;
  version: number;
  title: string;
  type: EvolutionProposalTypeValue;
  origin: EvolutionProposalOriginValue;
  submitterMemberId: string;
  submitterDisplayName: string;
  purpose: EvolutionProposalPurposeValue;
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
  distributionPlan: EvolutionDistributionPlanOutDto | null;
  status: Exclude<EvolutionTopicStatusValue, "registered" | "investigating">;
  approvals: EvolutionApprovalOutDto[];
  distributedTaskIds: string[];
  resultSummary: string | null;
  createdAt: string;
  updatedAt: string;
}
