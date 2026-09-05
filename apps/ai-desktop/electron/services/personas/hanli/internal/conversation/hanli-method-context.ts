import type { HanliSemanticContextOutDto } from "../../../../../../contracts/services/support/capabilities/event-center/index.js";

export const HANLI_METHOD_CONTEXT_CHARACTER_BUDGET = 6_000;
export const HANLI_RECENT_CONVERSATION_CHARACTER_BUDGET = 4_000;
const HANLI_AI_MESSAGE_PREVIEW_CHARACTERS = 80;

interface HanliMethodSample {
  /** 本轮语义证据的数量轮廓；不包含客户原始业务内容。 */
  evidenceShape: {
    /** 已确认事实的数量。 */
    confirmedFacts: number;
    /** 尚未证实假设的数量。 */
    assumptions: number;
    /** 相互冲突事实的数量。 */
    conflicts: number;
    /** 当前信息缺口的数量。 */
    informationGaps: number;
    /** 从上下文推断出的隐含需求数量。 */
    implicitRequirements: number;
  };
  /** 当时向客户提出的问题；只保留受限长度的方法样本。 */
  questionAsked: string | null;
  /** 提出该问题的理由；用于学习何时应追问。 */
  questionReason: string | null;
  /** 当时选择的调查动作；用于学习怎样补齐事实。 */
  investigationAction: string;
  /** 当时建议扩展问题的方向。 */
  expansionDirection: string | null;
  /** 需求树的结构轮廓；不包含具体节点正文。 */
  expansionShape: {
    /** 需求节点总数。 */
    requirementNodes: number;
    /** 被标记为关键的需求节点数量。 */
    criticalNodes: number;
    /** 等待客户答复的需求节点数量。 */
    waitingCustomerNodes: number;
    /** 需要继续调查的需求节点数量。 */
    investigationNodes: number;
  };
  /** 当轮需求成熟度，范围为零到一。 */
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
        criticalNodes: countCriticalNodes(trajectory.nodes),
        waitingCustomerNodes: countNodesWithStatus(trajectory.nodes, "waiting-customer"),
        investigationNodes: countNodesWithStatus(trajectory.nodes, "investigate"),
      },
      maturityScore: trajectory.maturityScore,
    };
    // 没有提问、调查动作或扩展方向的轨迹不具备方法学习价值，不用业务内容补齐。
    const hasReusableMethod = Boolean(
      sample.questionAsked
      || sample.questionReason
      || sample.investigationAction
      || sample.expansionDirection,
    );
    if (!hasReusableMethod) {
      continue;
    }
    const candidate = serializeMethodContext([...samples, sample]);
    if (candidate.length > HANLI_METHOD_CONTEXT_CHARACTER_BUDGET) {
      break;
    }
    samples.push(sample);
  }
  return serializeMethodContext(samples);
}

/** 后续会话保留完整用户原话，人物长回答只提供八十字预览，并从最新消息向前装入固定预算。 */
export function buildHanliRecentConversation(messages: Array<{ messageId?: string; speakerType: string; speakerPersonaId: string | null; content: string }>): string {
  const blocks: string[] = [];
  let characters = 0;
  const recentMessages = messages.slice(-16).reverse();
  for (const message of recentMessages) {
    const isInquiryAnchor = message.messageId?.startsWith("internal:hanli-inquiry-anchor:");
    const isDiscussionContext = message.messageId?.startsWith("internal:requirement-discussion-context:");
    if (isInquiryAnchor || isDiscussionContext) {
      continue;
    }
    const speaker = readableSpeakerName(message);
    let content = message.content;
    if (message.speakerType !== "user") {
      content = message.content.slice(0, HANLI_AI_MESSAGE_PREVIEW_CHARACTERS);
    }
    const block = `${speaker}：${content}`;
    let separatorCharacters = 0;
    if (blocks.length > 0) {
      separatorCharacters = 2;
    }
    if (characters + block.length + separatorCharacters > HANLI_RECENT_CONVERSATION_CHARACTER_BUDGET) {
      break;
    }
    blocks.unshift(block);
    characters += block.length;
    if (blocks.length > 1) {
      characters += 2;
    }
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
  if (!normalized) {
    return null;
  }
  return normalized;
}

/** 计算轨迹中的关键节点数量，避免在领域对象构造处隐藏筛选规则。 */
function countCriticalNodes(nodes: HanliSemanticContextOutDto["trajectories"][number]["nodes"]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.critical) {
      count += 1;
    }
  }
  return count;
}

/** 计算指定处理状态的节点数量。 */
function countNodesWithStatus(
  nodes: HanliSemanticContextOutDto["trajectories"][number]["nodes"],
  status: HanliSemanticContextOutDto["trajectories"][number]["nodes"][number]["status"],
): number {
  let count = 0;
  for (const node of nodes) {
    if (node.status === status) {
      count += 1;
    }
  }
  return count;
}

/** 把消息参与者转换为会话提示词中可读的人物名称。 */
function readableSpeakerName(message: { speakerType: string; speakerPersonaId: string | null }): string {
  if (message.speakerType === "user") {
    return "用户";
  }
  if (message.speakerPersonaId === "nangong-wan") {
    return "南宫婉";
  }
  return "韩立";
}
