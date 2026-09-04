/** 真实检查失败返还南宫婉时使用结构化证据，避免只剩一句无法复现的审批意见。 */
export interface HanliAcceptanceFailureEvidenceOutDto {
  evidenceId: string;
  runId: string;
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

