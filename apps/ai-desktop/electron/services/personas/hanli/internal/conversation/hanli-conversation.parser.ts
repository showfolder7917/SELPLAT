// 主题决定契约承载韩立每轮自由生成的主题、类型、意图、标签和摘要。
import type { ConversationRoundTopicDecisionInDto } from "../../../../../../contracts/services/support/capabilities/event-center/index.js";
// 调查理解契约限制模型只能声明理解结果和调查范围，不能覆盖客户原问题。
import type { HanliInquiryUnderstanding } from "../application/hanli-application.ports.js";

/** 韩立模型在可见正文末尾输出的结构化元数据前缀。 */
const HANLI_TOPIC_META_PREFIX = "HANLI_TOPIC_META=";

/** 韩立模型完成一轮回答后可以返回的可见正文和结构化理解。 */
export interface ParsedHanliConversationResponse {
  /** 去除内部元数据后的完整可见回复。 */
  reply: string;
  /** 通过字段校验的本轮主题决定；无效元数据返回待归类状态。 */
  topic: ConversationRoundTopicDecisionInDto;
  /** 只有模型返回有效调查门禁时才存在的结构化理解。 */
  inquiry?: HanliInquiryUnderstanding;
}

/** 分离韩立可见正文和训练语义坐标；元数据异常时保留正文并等待后续补齐。 */
export function parseHanliConversationResponse(text: string): ParsedHanliConversationResponse {
  // 每一行单独检查，避免正文中出现相似字符串时误删用户可见内容。
  const lines = text.trim().split(/\r?\n/u);
  // -1 表示当前还没有找到最后一条元数据标记。
  let markerIndex = -1;
  // 从末尾向前寻找，保证多次输出标记时只读取最后一份完整决定。
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    // normalizedLine 去掉格式空白后再检查稳定前缀。
    const normalizedLine = lines[index].trim();
    // 非元数据行属于可见正文，继续向前查找。
    if (!normalizedLine.startsWith(HANLI_TOPIC_META_PREFIX)) {
      // 当前行不改变 markerIndex。
      continue;
    }
    // 保存最后一条元数据所在位置。
    markerIndex = index;
    // 已经找到权威标记，不再读取更早的历史标记。
    break;
  }
  // 没有元数据时保留完整回复，主题进入待归类而不是机械猜测。
  if (markerIndex < 0) {
    // 返回原始可见正文和稳定待归类决定。
    return {
      // text 只做首尾清理，不截断模型可见回答。
      reply: text.trim(),
      // pendingTopicDecision 明确表示本轮语义尚未确认。
      topic: pendingTopicDecision(),
    };
  }
  // markerText 是去除稳定前缀后的 JSON 字符串。
  const markerText = lines[markerIndex].trim().slice(HANLI_TOPIC_META_PREFIX.length);
  // visibleLines 保存除元数据标记外的全部可见正文行。
  const visibleLines: string[] = [];
  // 按原顺序复制可见行，避免 filter 链隐藏删除规则。
  for (let index = 0; index < lines.length; index += 1) {
    // 元数据行只供程序解析，不能展示给用户。
    if (index === markerIndex) {
      // 跳过当前元数据行并继续复制剩余正文。
      continue;
    }
    // 保留原始行内容和换行结构。
    visibleLines.push(lines[index]);
  }
  // 合并可见行并清理首尾空白。
  const visibleReply = visibleLines.join("\n").trim();
  // 空可见正文时回退完整模型文本，避免界面出现无内容回复。
  const reply = visibleReply || text.trim();
  // JSON 解析或字段校验失败不能丢失已经生成的可见回复。
  try {
    // value 是模型返回的候选元数据，所有字段仍需逐项校验。
    const value = JSON.parse(markerText) as Partial<ConversationRoundTopicDecisionInDto> & {
      // inquiry 是模型可选返回的调查理解候选。
      inquiry?: Partial<HanliInquiryUnderstanding>;
    };
    // title 限制为一百二十个 Unicode 字符并合并多余空白。
    const title = normalizedText(value.title, 120);
    // type 由模型自由生成，但同样限制长度和空白格式。
    const type = normalizedText(value.type, 120);
    // userIntent 保留本轮真实意图，最多二千个 Unicode 字符。
    const userIntent = normalizedText(value.userIntent, 2_000);
    // tags 使用显式循环去重，避免链式 filter/map/set 隐藏清理规则。
    const tags = normalizedTags(value.tags);
    // summary 必须是字符串且不能超过三百个 Unicode 字符。
    const summary = normalizedSummary(value.summary);
    // 任一必填语义缺失时整份元数据进入待归类，禁止保存半真半假的主题。
    if (!title || !type || !userIntent || tags.length === 0 || !summary) {
      // 统一抛出内部校验错误，由本方法 catch 返回待归类结果。
      throw new Error("incomplete metadata");
    }
    // 调查理解使用独立门禁校验，缺失时允许普通对话继续。
    const inquiry = parseInquiryUnderstanding(value.inquiry);
    // 返回可见正文和全部通过校验的结构化语义。
    return {
      // reply 不包含内部 HANLI_TOPIC_META 行。
      reply,
      // inquiry 只在模型给出有效结构时存在。
      inquiry,
      // topic 是完整且可归档的主题决定。
      topic: {
        // title 是模型生成并经过长度校验的本轮主题。
        title,
        // type 是模型生成并经过长度校验的主题类型。
        type,
        // 只有严格布尔 true 才表示用户明确切换话题。
        switchTopic: value.switchTopic === true,
        // userIntent 是本轮确认后的用户真实意图。
        userIntent,
        // tags 已完成去空、去重和数量限制。
        tags,
        // summary 已完成三百字符上限校验。
        summary,
      },
    };
  } catch {
    // 元数据异常时只降级语义归档，不影响用户看到模型正文。
    return {
      // reply 保留本轮完整可见回答。
      reply,
      // topic 明确标记为待 AI 后续归类。
      topic: pendingTopicDecision(),
    };
  }
}

/** 校验模型声明的调查理解是否满足澄清或派发门禁。 */
function parseInquiryUnderstanding(
  value: Partial<HanliInquiryUnderstanding> | undefined,
): HanliInquiryUnderstanding | undefined {
  // 模型没有声明调查时，本轮按普通讨论处理。
  if (!value) {
    // undefined 表示不调用南宫婉，也不向用户制造澄清问题。
    return undefined;
  }
  // status 只允许后续两个明确分支消费。
  const status = value.status;
  // understoodGoal 是韩立对客户原目标的结构化理解。
  const understoodGoal = normalizedText(value.understoodGoal, 2_000);
  // verificationTarget 是需要核实的真实对象。
  const verificationTarget = normalizedText(value.verificationTarget, 1_000);
  // expectedAnswer 是用户希望调查最终回答的问题。
  const expectedAnswer = normalizedText(value.expectedAnswer, 1_000);
  // ambiguities 保存会实质改变调查方向且必须由用户确认的歧义。
  const ambiguities = normalizedAmbiguities(value.ambiguities);
  // investigationQuestion 只在理解充分时提供给南宫婉。
  const investigationQuestion = normalizedText(value.investigationQuestion, 4_000) || undefined;
  // 三个核心理解字段必须同时存在，避免南宫婉收到不完整调查请求。
  if (!understoodGoal || !verificationTarget || !expectedAnswer) {
    // 抛出统一内部错误，外层将整份元数据降级为待归类。
    throw new Error("incomplete inquiry understanding");
  }
  // clarification-required 必须有真实歧义且不能提前填写调查问题。
  if (status === "clarification-required") {
    // 没有歧义或已经生成调查问题都违反澄清门禁。
    if (ambiguities.length === 0 || investigationQuestion) {
      // 拒绝互相矛盾的调查状态。
      throw new Error("invalid clarification inquiry gate");
    }
    // 返回只能供用户澄清的结构化理解。
    return {
      // status 固定表明当前不能派发南宫婉。
      status,
      // understoodGoal 保留当前已确定的目标部分。
      understoodGoal,
      // verificationTarget 保留可能受歧义影响的核实对象。
      verificationTarget,
      // expectedAnswer 保留用户希望获得的最终结论。
      expectedAnswer,
      // ambiguities 只包含必须由用户回答的问题。
      ambiguities,
    };
  }
  // ready 必须没有客户歧义并且拥有可执行调查问题。
  if (status === "ready") {
    // 有歧义或缺少调查问题都不能调用南宫婉。
    if (ambiguities.length > 0 || !investigationQuestion) {
      // 拒绝看似 ready 但事实不完整的模型输出。
      throw new Error("invalid ready inquiry gate");
    }
    // 返回可以交给南宫婉的完整调查理解。
    return {
      // status 固定表明当前允许派发只读调查。
      status,
      // understoodGoal 是程序保存的目标理解。
      understoodGoal,
      // verificationTarget 是南宫婉必须核实的对象。
      verificationTarget,
      // expectedAnswer 是调查完成后必须回答的结论。
      expectedAnswer,
      // ambiguities 在 ready 状态中必须为空。
      ambiguities,
      // investigationQuestion 是南宫婉实际收到的补充调查范围。
      investigationQuestion,
    };
  }
  // 未知状态不能被默认解释成澄清或派发。
  throw new Error("invalid inquiry gate");
}

/** 使用显式循环清理标签，保留最多十二个不同的非空标签。 */
function normalizedTags(value: unknown): string[] {
  // 非数组标签不能进入主题归档。
  if (!Array.isArray(value)) {
    // 返回空数组，外层必填校验会把整份主题降级。
    return [];
  }
  // tags 保存最终稳定顺序的标签。
  const tags: string[] = [];
  // seen 防止模型重复输出相同标签。
  const seen = new Set<string>();
  // 按模型原始顺序处理每个候选标签。
  for (const candidate of value) {
    // 非字符串候选没有业务语义。
    if (typeof candidate !== "string") {
      // 跳过未知 JSON 类型。
      continue;
    }
    // normalizedCandidate 去除标签首尾空白。
    const normalizedCandidate = candidate.trim();
    // 空标签或重复标签不进入最终结果。
    if (!normalizedCandidate || seen.has(normalizedCandidate)) {
      // 继续处理下一个候选标签。
      continue;
    }
    // 记录已接收标签，保证后续重复项被过滤。
    seen.add(normalizedCandidate);
    // 按原始顺序追加有效标签。
    tags.push(normalizedCandidate);
    // 最多保留十二个标签，防止模型无限扩展归档字段。
    if (tags.length >= 12) {
      // 达到上限后停止读取剩余候选。
      break;
    }
  }
  // 返回清理完成的稳定标签数组。
  return tags;
}

/** 使用显式循环清理必须由用户确认的歧义列表。 */
function normalizedAmbiguities(value: unknown): string[] {
  // 非数组表示模型没有提供可用歧义列表。
  if (!Array.isArray(value)) {
    // 返回空数组，由具体状态门禁决定是否合法。
    return [];
  }
  // ambiguities 保存最终稳定顺序的歧义说明。
  const ambiguities: string[] = [];
  // seen 防止同一歧义被模型重复列出。
  const seen = new Set<string>();
  // 按模型原始顺序处理每一项歧义。
  for (const candidate of value) {
    // 每项歧义最多保留五百个 Unicode 字符。
    const ambiguity = normalizedText(candidate, 500);
    // 空白或重复内容不能成为新的客户问题。
    if (!ambiguity || seen.has(ambiguity)) {
      // 继续处理下一项候选。
      continue;
    }
    // 记录已经接收的歧义。
    seen.add(ambiguity);
    // 保留清理后的歧义正文。
    ambiguities.push(ambiguity);
    // 最多允许八项关键歧义，避免一次向用户提出大量问题。
    if (ambiguities.length >= 8) {
      // 达到上限后停止读取剩余候选。
      break;
    }
  }
  // 返回稳定的歧义列表。
  return ambiguities;
}

/** 校验三百 Unicode 字符以内的主题摘要。 */
function normalizedSummary(value: unknown): string {
  // 非字符串摘要不能进入训练主题。
  if (typeof value !== "string") {
    // 返回空字符串，外层必填校验会把主题降级。
    return "";
  }
  // summary 去除首尾空白但保留正文内容。
  const summary = value.trim();
  // 超过三百 Unicode 字符时拒绝整份摘要，禁止机械截断改变含义。
  if (Array.from(summary).length > 300) {
    // 返回空字符串触发待归类状态。
    return "";
  }
  // 返回通过长度校验的摘要。
  return summary;
}

/** 返回元数据缺失或无效时的明确待归类状态。 */
function pendingTopicDecision(): ConversationRoundTopicDecisionInDto {
  // 所有字段保持协议完整，但不伪造用户真实语义。
  return {
    // title 明确表示需要后续 AI 归类。
    title: "待 AI 归类",
    // type 不使用固定业务枚举猜测当前主题。
    type: "待归类",
    // 元数据无效时不能据此切换当前主题。
    switchTopic: false,
    // userIntent 留空表示尚未得到有效模型确认。
    userIntent: "",
    // tags 留空表示尚未形成语义标签。
    tags: [],
    // summary 留空表示没有可归档的可信摘要。
    summary: "",
  };
}

/** 把未知值清理成受 Unicode 字符上限约束的单行文本。 */
function normalizedText(value: unknown, maximum: number): string {
  // 非字符串值没有可保留的文本语义。
  if (typeof value !== "string") {
    // 返回空字符串，让调用方按字段门禁处理缺失值。
    return "";
  }
  // normalized 合并连续空白，避免模型格式差异污染结构化字段。
  const normalized = value.replaceAll(/\s+/gu, " ").trim();
  // 使用 Unicode 字符数组截取，避免拆坏代理对字符。
  return Array.from(normalized).slice(0, maximum).join("");
}
