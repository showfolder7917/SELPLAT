/**
 * 排查恢复点存入既有内部事实消息；只追加，不覆盖用户原文或历史证据。
 * assessment 后缀沿用内部状态排除约定，不把 JSON 状态冒充人物发言。
 */
import type { PersonaConversationOutDto } from "../../../../../../contracts/services/personas/conversation/index.js";
import type { InquirySnapshot, InquiryAssessment } from "../../domain/hanli-inquiry.aggregate.js";
import type { SendMessageOutDto } from "../../../../../../contracts/services/support/capabilities/conversation/index.js";

export const INQUIRY_CHECKPOINT_PREFIX = "internal:inquiry-checkpoint:";

/** 仅读取本会话精确请求的最新恢复点；损坏状态阻断，不退回旧阶段重跑。 */
export function readInquiryCheckpoint(conversation: PersonaConversationOutDto, requestId?: string): InquirySnapshot | null {
  const candidates = [...conversation.messages].reverse();
  for (const message of candidates) {
    if (!message.messageId.startsWith(INQUIRY_CHECKPOINT_PREFIX)) continue;
    if (requestId && message.replyToMessageId !== requestId) continue;
    const state = JSON.parse(message.content) as InquirySnapshot;
    if (state.version !== 1 || state.conversationId !== conversation.conversationId
      || state.requestId !== message.replyToMessageId || !state.request || !state.goal
      || !Array.isArray(state.rounds) || !state.rounds.length
      || !["queued", "investigating", "assessing", "explaining", "completed", "blocked"].includes(state.phase)
      || !["running", "retryable", "completed", "blocked"].includes(state.status)) {
      throw new Error("排查恢复记录不完整，无法安全恢复当前阶段。");
    }
    return state;
  }
  return null;
}

/** 只解析韩立独立最终消息，不从混合过程文本中截取或猜测 JSON。 */
export function parseInquiryAssessment(response: SendMessageOutDto, customerQuestion: string): InquiryAssessment {
  const messages = response.agentMessages?.length ? [...response.agentMessages].reverse() : [response.text];
  for (const message of messages) {
    let value;
    try {
      value = JSON.parse(message.trim().replace(/^\x60\x60\x60(?:json)?\s*/u, "").replace(/\s*\x60\x60\x60$/u, ""));
    } catch {
      continue;
    }
    if (!value || value.answeredQuestion !== customerQuestion
      || !["conclude", "investigate", "blocked"].includes(value.action)
      || typeof value.reason !== "string" || !value.reason.trim()
      || typeof value.nextQuestion !== "string"
      || !Array.isArray(value.missingEvidence) || value.missingEvidence.some((item: unknown) => typeof item !== "string")
      || (value.action === "investigate" && !value.nextQuestion.trim())) continue;
    return { action: value.action, reason: value.reason, nextQuestion: value.nextQuestion, missingEvidence: value.missingEvidence };
  }
  throw new Error("韩立证据评估未返回对应原问题的完整判断。");
}
