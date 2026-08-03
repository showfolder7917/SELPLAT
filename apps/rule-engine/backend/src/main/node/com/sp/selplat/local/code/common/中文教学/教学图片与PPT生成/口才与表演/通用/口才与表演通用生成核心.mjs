/**
 * 口才与表演全册共用的视觉规划、文字适配和质量门禁。
 *
 * 业务目标：
 * - 中册与下册只提供课程内容和图片清单，不再各自猜测文字方向。
 * - 图片先声明自然留白侧和教学语义，再由统一布局生成可编辑文字。
 * - 页面在导出前完成字号、图片覆盖率和语义对应关系的硬性检查。
 */

// 全系列课件使用统一16:9像素画布，避免册别适配器产生比例漂移。
export const ORAL_SLIDE_SIZE = Object.freeze({ width: 1280, height: 720 });

// 文字安全区保留Logo、栏目名称、页码和音频按钮所需的外侧边距。
const SAFE_TEXT_AREAS = Object.freeze({
  // 左侧自然留白时，正文组位于左中部并避开左上Logo。
  left: Object.freeze({ left: 74, top: 142, width: 476, height: 476 }),
  // 右侧自然留白时，正文组位于右中部并避开右上栏目名称。
  right: Object.freeze({ left: 730, top: 142, width: 476, height: 476 }),
});

// 不同教学角色的正文最低字号体现儿童课堂投影的可读性底线。
const ROLE_FONT_FLOORS = Object.freeze({
  // artifact-tool导出后字号按约0.75换算，30生成字号对应22.5pt长文底线。
  口才之歌: 30,
  // 发音说明包含拼音和术语，仍保持30生成字号长文底线。
  字正腔圆: 30,
  // 故事、表演和绕口令正文统一使用30生成字号长文底线。
  情境再现: 30,
  口脑风暴: 30,
  粉墨登场: 30,
  拓展训练: 30,
  句子宝库: 30,
  // 其他普通内容页同样使用30生成字号底线。
  默认: 30,
});

// 这些标题只是在重复正文的观察动作，不应再占一层视觉层级。
const REDUNDANT_INSTRUCTION_TITLES = Object.freeze([
  "看图说一说",
  "说一说，你看到了什么？",
  "按顺序观察",
  "观察图片",
  "仔细观察图片",
  "你看到什么？",
  "你看到了什么？",
  "练一练",
]);

/**
 * 校验并返回图片声明的自然文字安全侧。
 */
export function resolveSafeSide(visualPlan) {
  // 图片必须显式声明左右安全侧，禁止按课次或页码奇偶猜测。
  const safeSide = visualPlan?.safeSide;
  // 缺失或非法声明会导致人物与文字重叠，因此直接阻断生成。
  if (!["left", "right"].includes(safeSide)) {
    throw new Error(`图片缺少有效自然留白侧：${visualPlan?.asset || "unknown"}`);
  }
  // 返回经过验证的安全侧供所有册别适配器复用。
  return safeSide;
}

/**
 * 生成“整幅插画＋自然留白文字区”的标准页面规划。
 */
export function buildSceneLayout(visualPlan) {
  // 先验证图片的自然留白侧。
  const safeSide = resolveSafeSide(visualPlan);
  // 文字区域复制为新对象，避免调用方意外修改全局标准。
  const textArea = { ...SAFE_TEXT_AREAS[safeSide] };
  // 图片按完整16:9画布显示；生成资产自身已经把人物让出文字区。
  const imageArea = { left: 0, top: 0, width: ORAL_SLIDE_SIZE.width, height: ORAL_SLIDE_SIZE.height };
  // 返回布局契约，册别生成器不得另行缩成固定小图框。
  return {
    safeSide,
    textArea,
    imageArea,
    // 清洁自然留白默认不加底板；复杂留白可由图片声明启用轻底板。
    useCard: Boolean(visualPlan.useCard),
  };
}

/**
 * 根据角色和文本长度给出稳定正文尺寸。
 */
export function chooseBodyFont(role, text) {
  // 当前角色没有专项值时使用通用课堂字号底线。
  const floor = ROLE_FONT_FLOORS[role] || ROLE_FONT_FLOORS.默认;
  // 字符量忽略布局空白，与质量检测器保持同一统计口径。
  const length = [...String(text || "").replace(/\s+/gu, "")].length;
  // 36字以内使用35生成字号，导出后保持至少26pt投影可读性。
  if (length <= 36) return Math.max(floor, 35);
  // 中等内容回到30pt，避免在半幅文字安全区内形成大字墙。
  if (length <= 90) return Math.max(floor, 32);
  // 长内容只能收缩到当前角色底线，超量内容应由上游重组版式。
  return floor;
}

/**
 * 判断页面动作标题是否与正文重复，适合直接隐藏。
 */
export function shouldSuppressInstructionTitle(title, bodyText) {
  // 去除空白和常见尾部标点后比较，兼容旧课件标题拆字或标点差异。
  const compact = (value) => String(value || "")
    .replace(/\s+/gu, "")
    .replace(/[，。！？；：、,.!?;:]+$/gu, "");
  // 当前标题压缩后作为稳定比较键。
  const titleKey = compact(title);
  // 不在通用观察动作列表中的标题保留业务语义。
  if (!REDUNDANT_INSTRUCTION_TITLES.some((item) => compact(item) === titleKey)) return false;
  // 正文为空时仍保留标题，避免页面失去教学指令。
  if (!String(bodyText || "").trim()) return false;
  // 有正文承载观察问题时隐藏机械标题，让问题成为唯一视觉焦点。
  return true;
}

/**
 * 根据标题、正文和安全区生成比例适配的文字组与轻底板。
 */
export function buildAdaptiveTextPanel(textArea, title, bodyText, options = {}) {
  // 调用方可以显式隐藏已被正文替代的动作标题。
  const hideTitle = Boolean(options.hideTitle);
  // 正文字号沿用全册角色策略，并允许长阅读页显式覆盖。
  const bodyFont = Number(options.bodyFont || chooseBodyFont(options.role, bodyText));
  // 可用正文宽度扣除左右文字内边距。
  const bodyWidth = Math.max(120, textArea.width - 64);
  // 中文平均字宽按字号的0.95倍保守估计。
  const charsPerLine = Math.max(1, Math.floor(bodyWidth / (bodyFont * 0.95)));
  // 显式换行与自动换行共同决定正文视觉行数。
  const visualLines = String(bodyText || "")
    .split(/\n/u)
    .reduce((sum, line) => sum + Math.max(1, Math.ceil([...line].length / charsPerLine)), 0);
  // 标题存在时保留58像素高度；隐藏标题后正文直接成为视觉中心。
  const titleHeight = hideTitle ? 0 : 58;
  // 正文高度根据实际视觉行数计算，并保留上下呼吸位。
  const bodyHeight = Math.max(86, Math.ceil(visualLines * bodyFont * 1.78 + 28));
  // 文字组总高度限制在安全区内，避免大底板包围少量文字。
  const contentHeight = Math.min(textArea.height - 16, Math.max(142, titleHeight + bodyHeight + (hideTitle ? 0 : 12)));
  // 整组在安全区内垂直居中，与另一侧人物形成稳定平衡。
  const panelTop = textArea.top + Math.max(8, Math.floor((textArea.height - contentHeight) / 2));
  // 轻底板只比文字组扩大少量内边距，禁止固定铺满整个安全区。
  const cardArea = {
    left: textArea.left + 4,
    top: panelTop,
    width: textArea.width - 8,
    height: contentHeight,
  };
  // 标题位于轻底板顶部并保持单行可读。
  const titleArea = {
    left: textArea.left + 28,
    top: panelTop + 16,
    width: textArea.width - 56,
    height: titleHeight,
  };
  // 正文占据剩余区域并与标题保持稳定间距。
  const bodyArea = {
    left: textArea.left + 32,
    top: panelTop + (hideTitle ? 12 : titleHeight + 18),
    width: textArea.width - 64,
    height: contentHeight - (hideTitle ? 24 : titleHeight + 30),
  };
  // 返回统一布局证据，生成器和检测器使用相同命名与比例。
  return {
    hideTitle,
    bodyFont,
    visualLines,
    cardArea,
    titleArea,
    bodyArea,
  };
}

/**
 * 检查视觉计划是否覆盖页面文本的关键教学语义。
 */
export function assertSemanticCoverage(text, visualPlan) {
  // 视觉计划必须提供可审计的语义关键词。
  const visualKeywords = Array.isArray(visualPlan?.keywords) ? visualPlan.keywords : [];
  // 没有文字的纯观察页允许只依赖图片自身语义。
  if (!String(text || "").trim()) return true;
  // 至少一个视觉关键词必须出现在当前正文中，或正文关键词出现在视觉声明中。
  const normalizedText = String(text).replace(/\s+/g, "");
  // 对每个关键词做直接包含判断，保持检测结果可解释。
  const matched = visualKeywords.some((keyword) => normalizedText.includes(String(keyword).replace(/\s+/g, "")));
  // 未命中意味着生成器正在使用与正文无关的装饰图，必须阻断。
  if (!matched) {
    throw new Error(`图片语义与正文不匹配：${visualPlan?.asset || "unknown"}；关键词=${visualKeywords.join("、")}`);
  }
  // 命中后允许生成页面。
  return true;
}

/**
 * 检查共用视觉计划的基础质量字段。
 */
export function validateVisualPlanMap(visualPlanMap) {
  // 所有资产逐一检查，保证适配器不能绕过共用契约。
  for (const [key, visualPlan] of Object.entries(visualPlanMap || {})) {
    // 资产文件名必须存在，便于生成器稳定加载缓存。
    if (!visualPlan?.asset) throw new Error(`视觉计划缺少资产文件：${key}`);
    // 安全侧由统一函数验证。
    resolveSafeSide(visualPlan);
    // 语义关键词为空时无法执行图文一致性检查。
    if (!Array.isArray(visualPlan.keywords) || !visualPlan.keywords.length) {
      throw new Error(`视觉计划缺少语义关键词：${key}`);
    }
  }
  // 返回原映射便于调用方链式使用。
  return visualPlanMap;
}
