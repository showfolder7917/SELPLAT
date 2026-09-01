import type { EvolutionApprovalDecisionValue, EvolutionApprovalSourceValue, EvolutionApprovalStageValue, EvolutionFeedbackTargetValue } from "../value/evolution-approval.value.js";
/**
 * Evolution 共享审批事实输出协议。
 * 生产者：Evolution 状态服务；消费者：韩立审批流程与 Renderer 工作台。
 * 数据方向：Evolution -> 人物应用服务和 Renderer。
 * 本文件不接收审批命令，也不执行审批决定。
 */

export interface EvolutionApprovalOutDto {
  approvalId: string;
  proposalId: string;
  decision: EvolutionApprovalDecisionValue;
  source: EvolutionApprovalSourceValue;
  stage: EvolutionApprovalStageValue;
  approverMemberId: "han-li" | "user";
  approverDisplayName: "韩立" | "用户";
  advice: string;
  feedbackTarget: EvolutionFeedbackTargetValue;
  capabilityScope: string | null;
  referencedApprovalIds: string[];
  preferenceSnapshotVersion: number;
  createdAt: string;
}
