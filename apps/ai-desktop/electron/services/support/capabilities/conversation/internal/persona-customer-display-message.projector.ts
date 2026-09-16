import type { PersonaConversationMessageOutDto, PersonaCustomerDisplayStateValue } from "../../../../../../contracts/services/personas/conversation/index.js";

export interface PersonaCustomerDisplayDerivation {
  readonly state: PersonaCustomerDisplayStateValue;
  readonly content: string | null;
  readonly failureReason: string | null;
}

/**
 * 客户显示派生规则的版本。
 *
 * 历史记录保留当时的派生结果；读取端据此只重算规则落后的记录，避免把
 * 已经安全的记录在每次打开页面时重复写入。
 */
export const PERSONA_CUSTOMER_DISPLAY_DERIVATION_VERSION = 2;

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

/** 兼容旧版“自然答复 + 内部字段”记录，只保留内部字段出现前的自然答复。 */
function extractLegacyReply(content: string): string {
  // 历史字段既可能以空行分段，也可能紧凑地逐行记录。只识别已知协作字段，
  // 不用宽泛模式猜测正文，避免误删客户自然语言中的普通冒号。
  const marker = /(?:^|\n)\s*(?:(?:用户原话|用户目标|调查对象|期望结果|交给南宫婉核实)\s*[：:]|contentRole\s*(?:[：:=]|标注))/u.exec(content);
  if (!marker) return content;
  if (marker.index === 0) throw new Error("legacy reply is missing");
  const reply = content.slice(0, marker.index).trim();
  if (!reply) throw new Error("legacy reply is empty");
  return reply;
}
