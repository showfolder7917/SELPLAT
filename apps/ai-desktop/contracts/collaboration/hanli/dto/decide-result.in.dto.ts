/**
 * 韩立结果验收输入协议。
 * 生产者：Renderer 韩立验收页或韩立真实应用验收器；消费者：韩立验收应用服务。
 * 数据方向：韩立边界外 -> 韩立 -> Evolution。
 * 本文件不代表测试已经通过，也不直接归档专题。
 */
import type { EvolutionApprovalDecision } from "../../evolution/dto/evolution-approval.out.dto.js";
import type { EvolutionMutationInDto } from "../../evolution/dto/evolution-mutation.in.dto.js";

export interface DecideHanliResultInDto {
  mutation: EvolutionMutationInDto;
  decision: EvolutionApprovalDecision;
  advice?: string;
}
