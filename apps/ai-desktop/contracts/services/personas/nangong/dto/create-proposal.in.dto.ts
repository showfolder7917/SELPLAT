/**
 * 南宫婉创建专题提案输入协议。
 * 生产者：Renderer 南宫婉页面或南宫婉自动整理服务；消费者：南宫婉提案应用服务。
 * 数据方向：南宫婉边界外 -> 南宫婉 -> Evolution。
 * 本文件不作审批决定，也不直接分发任务。
 */
import type { EvolutionProposalTypeValue } from "../../../evolution/index.js";

export interface CreateNangongProposalInDto {
  type: EvolutionProposalTypeValue;
  content: string;
  risks: string[];
  rollbackPlan: string;
}
