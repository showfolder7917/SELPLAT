import type { ConversationRoundTopicDecisionInDto } from "../../../../../contracts/services/support/capabilities/event-center/index.js";
import type { NangongTopicDraftOutDto } from "../../../../../contracts/services/personas/nangong/index.js";

/** 南宫婉判断本轮事实已经成熟后使用的唯一可见邀请。 */
const NANGONG_ONE_SHOT_INVITATION = "若确认启动持续自动演化，请回复 1。";
const CONVERSATION_TOPIC_META_PREFIX = "NANGONG_TOPIC_META=";

/** 把人物返回的结构化草稿转换为可编辑字段；缺少必要事实时明确失败。 */
export function parseNangongTopicDraft(text: string): NangongTopicDraftOutDto {
  const candidate = text.match(/\{[\s\S]*\}/)?.[0];
  if (!candidate) throw new Error("南宫婉未返回可编辑的课题草稿，请重试。");
  try {
    const value = JSON.parse(candidate) as Partial<NangongTopicDraftOutDto>;
    const title = typeof value.title === "string" ? value.title.trim() : "";
    const goal = typeof value.goal === "string" ? value.goal.trim() : "";
    const scope = normalizeList(value.scope);
    const evidence = normalizeList(value.evidence);
    const acceptanceCriteria = normalizeList(value.acceptanceCriteria);
    if (!title || !goal || !scope.length || !evidence.length || !acceptanceCriteria.length) throw new Error();
    return { title, goal, scope, evidence, acceptanceCriteria };
  } catch {
    throw new Error("南宫婉生成的课题草稿不完整，请重试。");
  }
}

/** 保留自然语言正文并读取 AI 生成的自由主题坐标；元数据异常不会丢弃正文。 */
export function parseNangongConversationResponse(text: string): { reply: string; topic: ConversationRoundTopicDecisionInDto; invitesOneShot: boolean } {
  const lines = text.trim().split(/\r?\n/);
  let markerIndex = -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].trim().startsWith(CONVERSATION_TOPIC_META_PREFIX)) { markerIndex = index; break; }
  }
  if (markerIndex < 0) {
    const corpus = parseCorpusMetadata(text);
    const reply = text.trim();
    return { reply, topic: corpus || pendingTopicDecision(), invitesOneShot: reply.includes(NANGONG_ONE_SHOT_INVITATION) };
  }
  const marker = lines[markerIndex].trim().slice(CONVERSATION_TOPIC_META_PREFIX.length);
  try {
    const value = JSON.parse(marker) as Partial<ConversationRoundTopicDecisionInDto>;
    const title = typeof value.title === "string" ? value.title.trim().slice(0, 120) : "";
    const type = typeof value.type === "string" ? value.type.trim().slice(0, 120) : "";
    const userIntent = typeof value.userIntent === "string" ? value.userIntent.trim().slice(0, 2_000) : "";
    const tags = Array.isArray(value.tags) ? [...new Set(value.tags.filter((item): item is string => typeof item === "string").map((item) => item.replaceAll(/\s+/g, " ").trim()).filter(Boolean))].slice(0, 12) : [];
    const summary = typeof value.summary === "string" && Array.from(value.summary.trim()).length <= 300 ? value.summary.trim() : "";
    const reply = lines.filter((_line, index) => index !== markerIndex).join("\n").trim();
    if (!reply || !title || !type || !userIntent || !tags.length || !summary) throw new Error("incomplete conversation topic metadata");
    return { reply, topic: { title, type, switchTopic: value.switchTopic === true, userIntent, tags, summary }, invitesOneShot: reply.includes(NANGONG_ONE_SHOT_INVITATION) };
  } catch {
    const reply = lines.filter((_line, index) => index !== markerIndex).join("\n").trim() || text.trim();
    return { reply, topic: pendingTopicDecision(), invitesOneShot: reply.includes(NANGONG_ONE_SHOT_INVITATION) };
  }
}

/** 兼容只返回工程语料元数据的 Codex 回合，并保持字段完全来自 AI 语义判断。 */
function parseCorpusMetadata(text: string): ConversationRoundTopicDecisionInDto | null {
  const match = text.match(/<!--\s*SELPLAT_CORPUS_META\s+(\{[\s\S]*?\})\s*-->/);
  if (!match) return null;
  try {
    const value = JSON.parse(match[1]) as Record<string, unknown>;
    const title = typeof value.title === "string" ? value.title.trim().slice(0, 120) : "";
    const type = typeof value.type === "string" ? value.type.trim().slice(0, 120) : "";
    const userIntent = typeof value.intent === "string" ? value.intent.trim().slice(0, 2_000) : "";
    const tags = normalizeList(value.tags).slice(0, 12);
    const summary = typeof value.summary === "string" && Array.from(value.summary.trim()).length <= 300 ? value.summary.trim() : "";
    return title && type && userIntent && tags.length && summary ? { title, type, switchTopic: false, userIntent, tags, summary } : null;
  } catch { return null; }
}

function pendingTopicDecision(): ConversationRoundTopicDecisionInDto {
  return { title: "待 AI 归类", type: "待归类", switchTopic: false, userIntent: "", tags: [], summary: "" };
}

function normalizeList(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 100) : [];
}
