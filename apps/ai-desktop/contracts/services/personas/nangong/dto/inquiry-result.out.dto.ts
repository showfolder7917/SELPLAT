/**
 * 南宫婉完成只读调查后直接交给韩立的结构化结果。
 * DTO 方向：输出。
 * 数据生产方：南宫婉只读调查边界。
 * 数据接收方：韩立客户解释服务。
 * 数据流向：南宫婉 -> 韩立。
 * 禁止职责：不包含调查过程话术，不代替韩立向客户给出结论和方案。
 */
export interface NangongInquiryResultOutDto {
  status: "verified" | "unknown";
  answeredQuestion: string;
  summary: string;
  evidence: Array<{ source: string; detail: string }>;
  unknowns: string[];
}
