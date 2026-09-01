/**
 * 韩立真实应用验收计划输出协议。
 * 生产者：韩立验收计划服务；消费者：韩立验收 Runner 与 Renderer 审批页。
 * 数据方向：韩立 -> 验收执行消费者。
 * 本文件只描述待执行检查，不等同于测试或验收通过。
 */
export interface HanliAcceptanceCheckOutDto {
  checkId: string;
  category: string;
  target: string;
  action: string;
  expected: string;
  evidenceRequired: string;
  operations: HanliAcceptanceOperationValue[];
}

export interface HanliAcceptancePlanOutDto {
  version: 1;
  planId: string;
  topicId: string;
  proposalId: string;
  summary: string;
  concerns: string[];
  checks: HanliAcceptanceCheckOutDto[];
  generatedAt: string;
}

/** 真实检查失败返还南宫婉时使用结构化证据，避免只剩一句无法复现的审批意见。 */
export interface HanliAcceptanceFailureEvidenceOutDto {
  evidenceId: string;
  runId: string;
  planId: string;
  checkId: string;
  target: string;
  severity: "blocking" | "major";
  reproductionOperations: HanliAcceptanceOperationValue[];
  actual: string;
  expected: string;
  screenshotAttachmentIds: string[];
}

/** 修复并复验成功只形成项目候选经验；没有跨场景治理前不得冒充稳定规则。 */
export interface HanliAcceptanceExperienceCandidateOutDto {
  candidateId: string;
  status: "candidate" | "validated" | "degraded" | "retired";
  title: string;
  applicableScope: string[];
  sourceFailureEvidenceIds: string[];
  failedProposalId: string;
  correctionProposalId: string;
  failedRunId: string;
  passedRetestRunId: string;
  counterexampleCount: number;
  createdAt: string;
}
import type { HanliAcceptanceOperationValue } from "../value/acceptance.value.js";
