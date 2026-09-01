/**
 * 南宫婉依据补充意见修订提案输入协议。
 * 生产者：Renderer 南宫婉页面或南宫婉调查服务；消费者：南宫婉提案应用服务。
 * 数据方向：南宫婉边界外 -> 南宫婉 -> Evolution。
 * 本文件只创建不可覆盖的新版本，不修改旧提案。
 */
import type { EvolutionMutationInDto } from "../../evolution/dto/evolution-mutation.in.dto.js";

export interface ReviseNangongProposalInDto {
  mutation: EvolutionMutationInDto;
  submitterMemberId: string;
  content: string;
  evidence: string[];
  impactScope: string[];
  exclusions?: string[];
  risks: string[];
  rollbackPlan: string;
  acceptanceCriteria: string[];
}
