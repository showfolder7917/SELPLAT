import type { EvolutionProposalTypeValue, EvolutionProposalPurposeValue } from "../value/evolution-proposal.value.js";
/**
 * Evolution 提案与分发计划输出协议。
 * 生产者：Evolution 状态服务；消费者：南宫婉、韩立、Workflow 与 Renderer。
 * 数据方向：Evolution -> 跨人物协作消费者。
 * 本文件只表达共享提案事实，不接收人物命令或直接分发任务。
 */
import type { EvolutionApprovalOutDto } from "./evolution-approval.out.dto.js";
import type { EvolutionAcceptancePlanOutDto } from "./evolution-acceptance-plan.out.dto.js";
import type { EvolutionProposalOriginValue, EvolutionTopicStatusValue } from "../value/evolution-topic.value.js";


export interface EvolutionDistributionUnitOutDto {
  title: string;
  scope: string;
  acceptanceCriteria: string[];
  /** 预计会被本任务修改的文件；分发冲突只比较写边界，不把共享只读依赖误判为冲突。 */
  expectedWriteFiles: string[];
  /** 南宫婉已经核实、可由后续执行人按版本复用的技术调查结果。 */
  investigation: {
    /** 已确认的业务或程序入口，格式为“文件#符号”。 */
    entryPoints: string[];
    /** 从入口到结果的关键调用关系，不复制源码正文。 */
    callChain: string[];
    /** 权威状态、配置或持久化事实所在位置。 */
    authoritativeStates: string[];
    /** 已由源码或可重复读取结果确认的事实。 */
    verifiedFacts: string[];
    /** 当前尚未确认、必须由执行人继续调查的问题。 */
    unknowns: string[];
    /** 修改后必须覆盖的相邻回归风险。 */
    adjacentRisks: string[];
  };
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
  version: 2;
  /** 南宫婉调查时读取的工作区提交；任务工作树基线不一致时不得直接复用调查事实。 */
  evidenceBaseSha: string;
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
  /** 提案版本专属的验收计划；旧归档允许为空，但不会被用于新的完成判定。 */
  acceptancePlan: EvolutionAcceptancePlanOutDto | null;
  distributionPlan: EvolutionDistributionPlanOutDto | null;
  /** 最终验收通过时写入的唯一结果决定档案；历史专题缺失时只能按尚未核验呈现。 */
  finalConclusionRecordId: string | null;
  status: Exclude<EvolutionTopicStatusValue, "registered" | "investigating">;
  approvals: EvolutionApprovalOutDto[];
  distributedTaskIds: string[];
  resultSummary: string | null;
  createdAt: string;
  updatedAt: string;
}
