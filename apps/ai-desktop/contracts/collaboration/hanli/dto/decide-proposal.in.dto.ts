/**
 * 韩立方向审批输入协议。
 * 生产者：Renderer 韩立审批页或韩立自动审批器；消费者：韩立审批应用服务。
 * 数据方向：韩立边界外 -> 韩立 -> Evolution。
 * 本文件不修改提案正文，也不直接写数据库。
 */
import type { EvolutionApprovalDecision, EvolutionFeedbackTarget } from "../../evolution/dto/evolution-approval.out.dto.js";
import type { EvolutionMutationInDto } from "../../evolution/dto/evolution-mutation.in.dto.js";

export interface DecideHanliProposalInDto {
  mutation: EvolutionMutationInDto;
  decision: EvolutionApprovalDecision;
  advice?: string;
  feedbackTarget?: EvolutionFeedbackTarget;
  capabilityScope?: string;
}
