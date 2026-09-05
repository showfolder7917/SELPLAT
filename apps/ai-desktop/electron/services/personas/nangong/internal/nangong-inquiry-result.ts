import type { NangongInquiryResultOutDto } from "../../../../../contracts/services/personas/nangong/index.js";
import type { SendMessageOutDto } from "../../../../../contracts/services/support/capabilities/conversation/index.js";

/** 南宫婉只从一条独立最终消息建立调查结果，过程说明和多条消息不会混进机器合同。 */
export function nangongInquiryResult(response: SendMessageOutDto, customerQuestion: string): NangongInquiryResultOutDto {
  const candidates = response.agentMessages?.length ? [...response.agentMessages].reverse() : [response.text];
  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate.trim().replace(/^```(?:json)?\s*/u, "").replace(/\s*```$/u, "")) as Partial<NangongInquiryResultOutDto>;
      if (!value || !["verified", "unknown"].includes(String(value.status)) || typeof value.answeredQuestion !== "string" || typeof value.summary !== "string" || !value.summary.trim() || !Array.isArray(value.evidence) || !Array.isArray(value.unknowns)) continue;
      if (value.answeredQuestion.trim() !== customerQuestion.trim()) throw new Error("南宫婉调查结果没有对应客户原问题");
      if (value.evidence.some((item) => !item || typeof item.source !== "string" || !item.source.trim() || typeof item.detail !== "string" || !item.detail.trim()) || value.unknowns.some((item) => typeof item !== "string")) continue;
      if (value.status === "verified" && !value.evidence.length) throw new Error("南宫婉未提供可定位的核实依据");
      return value as NangongInquiryResultOutDto;
    } catch (error) {
      if (error instanceof Error && /没有对应客户原问题|未提供可定位/.test(error.message)) throw error;
    }
  }
  throw new Error("南宫婉调查没有返回独立、完整的结构化结果");
}

/** 首次调查仅在结果边界校验失败时允许一次纠正；传输失败不伪装成格式问题重试。 */
export async function nangongInquiryWithCorrection(
  investigate: () => Promise<SendMessageOutDto>,
  correct: (reason: string) => Promise<SendMessageOutDto>,
  customerQuestion: string,
): Promise<NangongInquiryResultOutDto> {
  const first = await investigate();
  try {
    return nangongInquiryResult(first, customerQuestion);
  } catch (firstError) {
    const reason = firstError instanceof Error ? firstError.message : "调查结果格式不完整";
    const correction = await correct(reason);
    try {
      return nangongInquiryResult(correction, customerQuestion);
    } catch (secondError) {
      throw new Error(`南宫婉调查结果连续两次未通过校验：${secondError instanceof Error ? secondError.message : String(secondError)}`);
    }
  }
}
