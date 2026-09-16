import type { PersonaConversationMessageOutDto, PersonaCustomerDisplayStateValue } from "../../../../../../contracts/services/personas/conversation/index.js";

export interface PersonaCustomerDisplayDerivation {
  readonly state: PersonaCustomerDisplayStateValue;
  readonly content: string | null;
  readonly failureReason: string | null;
}

/**
 * 生成客户可见正文。
 *
 * 原始消息只在持久化边界短暂读取；调用方只能取得派生后的安全正文或不可显示状态。
 */
export function derivePersonaCustomerDisplayMessage(message: Pick<PersonaConversationMessageOutDto, "messageType" | "content">): PersonaCustomerDisplayDerivation {
  if (message.messageType !== "customer-visible") {
    return { state: "excluded", content: null, failureReason: null };
  }
  const content = message.content.trim();
  if (!content) {
    return { state: "failed", content: null, failureReason: "客户显示正文为空，无法安全读取。" };
  }
  try {
    const legacyReply = extractLegacyReply(content);
    return { state: "ready", content: legacyReply, failureReason: null };
  } catch {
    return { state: "failed", content: null, failureReason: "客户显示正文派生失败，请重新读取。" };
  }
}

/** 兼容旧版“自然答复 + 固定内部字段”记录，只保留首段答复。 */
function extractLegacyReply(content: string): string {
  const paragraphs = content.split(/\n\s*\n/u);
  if (paragraphs.length < 2) return content;
  const internalPrefixes = ["用户原话：", "用户目标：", "调查对象：", "期望结果：", "交给南宫婉核实："];
  let internalFieldCount = 0;
  for (const paragraph of paragraphs.slice(1)) {
    if (internalPrefixes.some((prefix) => paragraph.startsWith(prefix))) internalFieldCount += 1;
  }
  if (internalFieldCount < 4) return content;
  const reply = paragraphs[0].trim();
  if (!reply) throw new Error("legacy reply is empty");
  return reply;
}
