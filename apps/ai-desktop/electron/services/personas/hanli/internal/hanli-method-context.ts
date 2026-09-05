import type { HanliSemanticContextOutDto } from "../../../../../contracts/services/support/capabilities/event-center/index.js";

export const HANLI_METHOD_CONTEXT_CHARACTER_BUDGET = 6_000;
export const HANLI_RECENT_CONVERSATION_CHARACTER_BUDGET = 4_000;
const HANLI_AI_MESSAGE_PREVIEW_CHARACTERS = 80;

interface HanliMethodSample {
  evidenceShape: {
    confirmedFacts: number;
    assumptions: number;
    conflicts: number;
    informationGaps: number;
    implicitRequirements: number;
  };
  questionAsked: string | null;
  questionReason: string | null;
  investigationAction: string;
  expansionDirection: string | null;
  expansionShape: {
    requirementNodes: number;
    criticalNodes: number;
    waitingCustomerNodes: number;
    investigationNodes: number;
  };
  maturityScore: number;
}

/**
 * 把派生语义资料转换成调查方法样本。客户目标、历史答案、证据原文和节点正文不会进入韩立提示词，
 * 防止人物按相似内容模仿旧结论；只保留“缺口—提问—调查—扩展”的工作方式。
 */
export function buildHanliMethodContext(context: HanliSemanticContextOutDto): string {
  const samples: HanliMethodSample[] = [];
  for (const trajectory of context.trajectories) {
    const sample: HanliMethodSample = {
      evidenceShape: {
        confirmedFacts: trajectory.confirmedFacts.length,
        assumptions: trajectory.assumptions.length,
        conflicts: trajectory.conflicts.length,
        informationGaps: trajectory.informationGaps.length,
        implicitRequirements: trajectory.implicitRequirements.length,
      },
      questionAsked: boundedText(trajectory.questionAsked, 320),
      questionReason: boundedText(trajectory.questionReason, 240),
      investigationAction: boundedText(trajectory.selectedAction, 320) || "",
      expansionDirection: boundedText(trajectory.evolutionDirection, 320),
      expansionShape: {
        requirementNodes: trajectory.nodes.length,
        criticalNodes: trajectory.nodes.filter((node) => node.critical).length,
        waitingCustomerNodes: trajectory.nodes.filter((node) => node.status === "waiting-customer").length,
        investigationNodes: trajectory.nodes.filter((node) => node.status === "investigate").length,
      },
      maturityScore: trajectory.maturityScore,
    };
    // 没有提问、调查动作或扩展方向的轨迹不具备方法学习价值，不用业务内容补齐。
    if (!(sample.questionAsked || sample.questionReason || sample.investigationAction || sample.expansionDirection)) continue;
    const candidate = serializeMethodContext([...samples, sample]);
    if (candidate.length > HANLI_METHOD_CONTEXT_CHARACTER_BUDGET) break;
    samples.push(sample);
  }
  return serializeMethodContext(samples);
}

/** 后续会话保留完整用户原话，人物长回答只提供八十字预览，并从最新消息向前装入固定预算。 */
export function buildHanliRecentConversation(messages: Array<{ messageId?: string; speakerType: string; speakerPersonaId: string | null; content: string }>): string {
  const blocks: string[] = [];
  let characters = 0;
  for (const message of messages.slice(-16).reverse()) {
    if (message.messageId?.startsWith("internal:hanli-inquiry-anchor:")) continue;
    const speaker = message.speakerType === "user" ? "用户" : message.speakerPersonaId === "nangong-wan" ? "南宫婉" : "韩立";
    const content = message.speakerType === "user" ? message.content : message.content.slice(0, HANLI_AI_MESSAGE_PREVIEW_CHARACTERS);
    const block = `${speaker}：${content}`;
    if (characters + block.length + (blocks.length ? 2 : 0) > HANLI_RECENT_CONVERSATION_CHARACTER_BUDGET) break;
    blocks.unshift(block);
    characters += block.length + (blocks.length > 1 ? 2 : 0);
  }
  return blocks.join("\n\n");
}

function serializeMethodContext(samples: HanliMethodSample[]): string {
  return JSON.stringify({
    purpose: "只学习客户如何提问、调查、识别信息缺口和扩展问题；禁止复用历史业务结论或按相似内容模仿答案。",
    samples,
  });
}

function boundedText(value: string | null | undefined, maximum: number): string | null {
  const normalized = String(value || "").replaceAll(/\s+/g, " ").trim().slice(0, maximum);
  return normalized || null;
}
