import type { ConversationRoundTopicDecisionInDto } from "../../../../../contracts/services/support/capabilities/event-center/index.js";

const HANLI_TOPIC_META_PREFIX = "HANLI_TOPIC_META=";

/** 分离韩立可见正文和训练语义坐标；元数据异常时保留正文并等待后续补齐。 */
export function parseHanliConversationResponse(text: string): { reply: string; topic: ConversationRoundTopicDecisionInDto } {
  const lines = text.trim().split(/\r?\n/u);
  let markerIndex = -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].trim().startsWith(HANLI_TOPIC_META_PREFIX)) { markerIndex = index; break; }
  }
  if (markerIndex < 0) return { reply: text.trim(), topic: pendingTopicDecision() };
  const marker = lines[markerIndex].trim().slice(HANLI_TOPIC_META_PREFIX.length);
  const reply = lines.filter((_line, index) => index !== markerIndex).join("\n").trim() || text.trim();
  try {
    const value = JSON.parse(marker) as Partial<ConversationRoundTopicDecisionInDto>;
    const title = normalizedText(value.title, 120);
    const type = normalizedText(value.type, 120);
    const userIntent = normalizedText(value.userIntent, 2_000);
    const tags = Array.isArray(value.tags)
      ? [...new Set(value.tags.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 12)
      : [];
    const summary = typeof value.summary === "string" && Array.from(value.summary.trim()).length <= 300 ? value.summary.trim() : "";
    if (!title || !type || !userIntent || !tags.length || !summary) throw new Error("incomplete metadata");
    return { reply, topic: { title, type, switchTopic: value.switchTopic === true, userIntent, tags, summary } };
  } catch { return { reply, topic: pendingTopicDecision() }; }
}

function pendingTopicDecision(): ConversationRoundTopicDecisionInDto {
  return { title: "待 AI 归类", type: "待归类", switchTopic: false, userIntent: "", tags: [], summary: "" };
}

function normalizedText(value: unknown, maximum: number): string {
  return typeof value === "string" ? Array.from(value.replaceAll(/\s+/gu, " ").trim()).slice(0, maximum).join("") : "";
}
