import type { ConversationRoundTopicDecisionInDto } from "../../../../../contracts/services/support/capabilities/event-center/index.js";
import type { HanliInquiryUnderstanding } from "./hanli-application.ports.js";

const HANLI_TOPIC_META_PREFIX = "HANLI_TOPIC_META=";

/** 分离韩立可见正文和训练语义坐标；元数据异常时保留正文并等待后续补齐。 */
export function parseHanliConversationResponse(text: string): { reply: string; topic: ConversationRoundTopicDecisionInDto; inquiry?: HanliInquiryUnderstanding } {
  const lines = text.trim().split(/\r?\n/u);
  let markerIndex = -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].trim().startsWith(HANLI_TOPIC_META_PREFIX)) { markerIndex = index; break; }
  }
  if (markerIndex < 0) return { reply: text.trim(), topic: pendingTopicDecision() };
  const marker = lines[markerIndex].trim().slice(HANLI_TOPIC_META_PREFIX.length);
  const reply = lines.filter((_line, index) => index !== markerIndex).join("\n").trim() || text.trim();
  try {
    const value = JSON.parse(marker) as Partial<ConversationRoundTopicDecisionInDto> & { inquiry?: Partial<HanliInquiryUnderstanding> };
    const title = normalizedText(value.title, 120);
    const type = normalizedText(value.type, 120);
    const userIntent = normalizedText(value.userIntent, 2_000);
    const tags = Array.isArray(value.tags)
      ? [...new Set(value.tags.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 12)
      : [];
    const summary = typeof value.summary === "string" && Array.from(value.summary.trim()).length <= 300 ? value.summary.trim() : "";
    if (!title || !type || !userIntent || !tags.length || !summary) throw new Error("incomplete metadata");
    const inquiry = parseInquiryUnderstanding(value.inquiry);
    return { reply, inquiry, topic: { title, type, switchTopic: value.switchTopic === true, userIntent, tags, summary } };
  } catch { return { reply, topic: pendingTopicDecision() }; }
}

function parseInquiryUnderstanding(value: Partial<HanliInquiryUnderstanding> | undefined): HanliInquiryUnderstanding | undefined {
  if (!value) return undefined;
  const status = value.status;
  const understoodGoal = normalizedText(value.understoodGoal, 2_000);
  const verificationTarget = normalizedText(value.verificationTarget, 1_000);
  const expectedAnswer = normalizedText(value.expectedAnswer, 1_000);
  const ambiguities = Array.isArray(value.ambiguities)
    ? [...new Set(value.ambiguities.map((item) => normalizedText(item, 500)).filter(Boolean))].slice(0, 8)
    : [];
  const investigationQuestion = normalizedText(value.investigationQuestion, 4_000) || undefined;
  if (!understoodGoal || !verificationTarget || !expectedAnswer) throw new Error("incomplete inquiry understanding");
  if (status === "clarification-required" && ambiguities.length && !investigationQuestion) return { status, understoodGoal, verificationTarget, expectedAnswer, ambiguities };
  if (status === "ready" && !ambiguities.length && investigationQuestion) return { status, understoodGoal, verificationTarget, expectedAnswer, ambiguities, investigationQuestion };
  throw new Error("invalid inquiry gate");
}

function pendingTopicDecision(): ConversationRoundTopicDecisionInDto {
  return { title: "待 AI 归类", type: "待归类", switchTopic: false, userIntent: "", tags: [], summary: "" };
}

function normalizedText(value: unknown, maximum: number): string {
  return typeof value === "string" ? Array.from(value.replaceAll(/\s+/gu, " ").trim()).slice(0, maximum).join("") : "";
}
