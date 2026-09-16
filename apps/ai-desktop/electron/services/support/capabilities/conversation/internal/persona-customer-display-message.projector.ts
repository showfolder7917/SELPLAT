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
export const PERSONA_CUSTOMER_DISPLAY_DERIVATION_VERSION = 9;

/** 旧自动托管写入者使用该稳定前缀保存“首段答复 + 设计说明 + 内部调查字段”。 */
const LEGACY_HANLI_DESIGN_MESSAGE_PREFIX = "hanli-design:";

/**
 * 生成客户可见正文。
 *
 * 原始消息只在持久化边界短暂读取；调用方只能取得派生后的安全正文或不可显示状态。
 */
export function derivePersonaCustomerDisplayMessage(
  message: Pick<PersonaConversationMessageOutDto, "messageType" | "content"> & Partial<Pick<PersonaConversationMessageOutDto, "messageId" | "speakerType">>,
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
    // 旧 hanli-design 身份是混合格式的权威来源；只迁移当时唯一经过客户确认的首段答复。
    const legacyReply = message.messageId?.startsWith(LEGACY_HANLI_DESIGN_MESSAGE_PREFIX)
      ? extractLegacyHanliDesignReply(content)
      : extractLegacyReply(content);
    // 人物正文无论来自当前写入、历史补写还是客户重读，均使用同一安全边界。
    // 写入时机不能决定内部技术内容是否会进入客户页面。
    if (legacyReply === content && containsHistoricalInternalProse(content)) {
      throw new Error("legacy reply cannot be safely separated");
    }
    return { state: "ready", content: legacyReply, failureReason: null };
  } catch {
    return { state: "failed", content: null, failureReason: "客户显示正文派生失败，请重新读取。" };
  }
}

/**
 * 旧 hanli-design 写入者把“过程前言 + 客户结论”放在首段，再追加设计说明和调查字段。
 * 该稳定身份的首段若是多行，最后一行才是当时面向客户的结论；原文仍完整保留在审计记录。
 */
function extractLegacyHanliDesignReply(content: string): string {
  const [firstParagraph] = content.split(/\r?\n\s*\r?\n/u);
  const reply = firstParagraph?.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean).at(-1) || "";
  if (!reply) throw new Error("legacy hanli design reply is empty");
  return reply;
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
  const structuredMarkers = [
    /用户原话/u,
    /用户目标|(?:^|[、，,；;：:\s])目标(?:$|[、，,；;：:\s])/u,
    /调查对象/u,
    /期望结果/u,
    /contentRole/u,
    /交给南宫婉核实/u,
  ];
  // 人物回复中的实现说明也可能不采用旧字段组。两个以上实现标记同时出现时，
  // 无法可靠分离客户答复，必须保持失败位置，不能把整段技术正文标为 ready。
  const implementationMarkers = [
    /contentRole/u,
    /持久化/u,
    /恢复/u,
    /页面投影/u,
  ];
  // 历史协作说明常以完整句子保存，不含旧字段标题或实现标记；三个以上
  // 稳定协作概念同时出现时没有可靠的客户答复边界，必须安全失败。
  const collaborationMarkers = [
    /原始消息/u,
    /内部事实/u,
    /审计依据/u,
    /保存结构/u,
    /内容归类/u,
    /恢复读取/u,
    /时间线投影/u,
    /制造数据/u,
    /恢复任务/u,
  ];
  return structuredMarkers.filter((marker) => marker.test(content)).length >= 3
    || implementationMarkers.filter((marker) => marker.test(content)).length >= 2
    || collaborationMarkers.filter((marker) => marker.test(content)).length >= 3;
}
