import type { PersonaConversationMessageOutDto, PersonaCustomerDisplayStateValue } from "../../../../../../contracts/services/personas/conversation/index.js";

export interface PersonaCustomerDisplayDerivation {
  readonly state: PersonaCustomerDisplayStateValue;
  readonly content: string | null;
  readonly failureReason: string | null;
}

/** 历史补写比新消息更保守：无法证明正文安全时保留失败位置。 */
export interface PersonaCustomerDisplayDerivationOptions {
  readonly historical?: boolean;
}

/**
 * 客户显示派生规则的版本。
 *
 * 历史记录保留当时的派生结果；读取端据此只重算规则落后的记录，避免把
 * 已经安全的记录在每次打开页面时重复写入。
 */
export const PERSONA_CUSTOMER_DISPLAY_DERIVATION_VERSION = 4;

/**
 * 生成客户可见正文。
 *
 * 原始消息只在持久化边界短暂读取；调用方只能取得派生后的安全正文或不可显示状态。
 */
export function derivePersonaCustomerDisplayMessage(
  message: Pick<PersonaConversationMessageOutDto, "messageType" | "content"> & Partial<Pick<PersonaConversationMessageOutDto, "speakerType">>,
  options: PersonaCustomerDisplayDerivationOptions = {},
): PersonaCustomerDisplayDerivation {
  if (message.messageType !== "customer-visible") {
    return { state: "excluded", content: null, failureReason: null };
  }
  const content = message.content.trim();
  if (!content) {
    return { state: "failed", content: null, failureReason: "客户显示正文为空，无法安全读取。" };
  }
  // 用户输入是审计与客户显示共同的原文事实；内部整理只可能出现在人物历史回复中。
  if (message.speakerType === "user") return { state: "ready", content, failureReason: null };
  try {
    const legacyReply = extractLegacyReply(content);
    if (options.historical && legacyReply === content && containsHistoricalInternalProse(content)) {
      throw new Error("legacy reply cannot be safely separated");
    }
    return { state: "ready", content: legacyReply, failureReason: null };
  } catch {
    return { state: "failed", content: null, failureReason: "客户显示正文派生失败，请重新读取。" };
  }
}

/** 兼容旧版“自然答复 + 内部字段组”记录，只保留字段组前的自然答复。 */
function extractLegacyReply(content: string): string {
  const lines = content.split(/\r?\n/u);
  const labeledLines = lines.map((line, index) => ({ index, label: legacyFieldLabel(line) })).filter((line): line is { index: number; label: string } => line.label !== null);
  const distinctLabels = new Set(labeledLines.map((line) => line.label));
  if (labeledLines[0]?.index === 0) throw new Error("legacy reply is missing");
  // 三个以上字段同时出现才是旧整理块，避免把人物在正常答复中偶然提及单个词语误判为内部正文。
  const firstLine = distinctLabels.size >= 3 ? labeledLines[0]?.index : undefined;
  if (firstLine === undefined) return content;
  const reply = lines.slice(0, firstLine).join("\n").trim();
  if (!reply) throw new Error("legacy reply is empty");
  return reply;
}

/** 识别旧整理块的字段标题，兼容列表、标题和加粗等 Markdown 形态。 */
function legacyFieldLabel(line: string): string | null {
  const plain = line.trim()
    .replace(/^(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+)/u, "")
    .replace(/^\*\*([^*]+)\*\*/u, "$1")
    .replace(/^【([^】]+)】/u, "$1")
    .trim();
  const match = /^(用户原话|用户目标|目标|调查对象|期望结果|交给南宫婉核实|contentRole)(?:\s*(?:[：:=]|标注)|\s*$)/u.exec(plain);
  return match?.[1] || null;
}

/**
 * 历史技术长文可能没有可截取的字段行。命中多项受控概念时，无法证明其中
 * 哪一段属于客户答复，必须失败而不是显示原文。
 */
function containsHistoricalInternalProse(content: string): boolean {
  const markers = [
    /用户原话/u,
    /用户目标|(?:^|[、，,；;：:\s])目标(?:$|[、，,；;：:\s])/u,
    /调查对象/u,
    /期望结果/u,
    /contentRole/u,
    /交给南宫婉核实/u,
  ];
  return markers.filter((marker) => marker.test(content)).length >= 3;
}
