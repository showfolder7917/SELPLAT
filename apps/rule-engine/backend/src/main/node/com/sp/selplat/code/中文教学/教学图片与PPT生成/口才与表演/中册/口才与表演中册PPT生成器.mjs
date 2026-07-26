import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// 工具优先使用调用方显式传入的工程根，否则以当前工作目录作为当前工程。
const PROJECT_ROOT = path.resolve(process.env.SELPLAT_PROJECT_ROOT || process.cwd());
// artifact-tool属于大体积可复用运行依赖，统一从当前工程缓存加载。
const ARTIFACT_TOOL_ENTRY = path.join(PROJECT_ROOT, "cache/node-modules/@oai/artifact-tool/dist/artifact_tool.mjs");
// 缓存缺失时在导入阶段明确失败，禁止静默回退到旧OPTION临时目录。
await fs.access(ARTIFACT_TOOL_ENTRY);
// 通过文件URL加载缓存模块，避免Node ESM依赖源码目录旁的node_modules链接。
const { Presentation, PresentationFile } = await import(pathToFileURL(ARTIFACT_TOOL_ENTRY).href);
// 本任务工作区只保存生成结果和验证数据，便于后续统一清理。
const WORKSPACE = path.join(PROJECT_ROOT, "OPTION/temp/口才与表演中册其余课程重制");
// 内容覆盖清单属于轻量课程模板配置，随规则引擎源码统一维护。
const COVERAGE_FILE = path.join(PROJECT_ROOT, "apps/rule-engine/backend/src/main/resources/中文教学/template/口才与表演/中册/课程内容索引.json");
// 正式成品统一回写到当前工程的中文教学项目目录。
const OUTPUT_ROOT = path.join(PROJECT_ROOT, "OPTION/temp/中文教学/教学图片与PPT生成/项目/口才与表演/中册");
// 逐页返工目录按课堂模块保存独立插图，避免整课机械复用同一张主题图。
const ROLE_ASSET_ROOT = path.join(PROJECT_ROOT, "cache/中文教学/口才与表演/中册/课程插图/模块插图");
// 课件严格采用16:9横版画布，和第一课确认稿保持一致。
const SLIDE_SIZE = { width: 1280, height: 720 };
// 中文标题和正文使用本机稳定的思源字体，避免跨页字形错乱。
const FONT_SANS = "Noto Sans CJK SC";
const FONT_SERIF = "Noto Serif CJK SC";
// 统一色板延续第一课的暖白、水彩青、珊瑚和柔黄。
const C = {
  cream: "#FBF7EF",
  ink: "#28556D",
  teal: "#2E8B88",
  coral: "#F4776D",
  yellow: "#F4C95D",
  paleTeal: "#DCEDEC",
  paleCoral: "#FBE3DE",
  paleYellow: "#FFF0BA",
  paleBlue: "#DFEBF3",
  white: "#FFFFFF",
  gray: "#71848E",
};
// 新版口才之歌作为中册统一热身内容，禁止回退到旧歌词。
const NEW_SONG = [
  "学口才，练口才，想学口才跟我来。",
  "小舞台，大梦想，自信登台展风采。",
  "同学们，快快来，游戏课堂真精彩。",
  "",
  "口才课，有口令，大家一起说出来：",
  "勇敢讲，声音开；自信演，站稳台。",
  "认真学，大胆来，学好口才更出彩！",
].join("\n");
// 补充截图中的教学事实转换成可编辑练习，不把教材照片直接贴回成品。
const SUPPLEMENT_FACTS = {
  2: "看一看，说一说：\n爸爸是医生。妈妈是教师。\n春天到了：我看见____，听见____，闻到____，摸到____。",
  3: "用“这是……”说完整句：\n这是我们的教室。这是蓝色的大海。这是高高的山。\n再说一说：我们怎样保护环境？",
  4: "他们在做什么？\n小朋友在唱歌。妈妈在买蔬菜。\n森林里的小动物又在做什么？",
  5: "看状态，说动作：\n文文生病了。娃娃哭了。\n小朋友们正在放风筝。",
  6: "尝一尝，说一说：\n杨梅酸，棒棒糖甜，苦瓜苦，辣椒辣。\n判断对不对，再用完整句说明理由。",
  7: "他们在做什么？\n用“谁在做什么”介绍画面。\n再说一说家里人正在做的事情。",
  8: "用“我喜欢……”说完整句。\n小动物喜欢哪些运动？你最喜欢什么运动？",
  9: "用“……了”说变化和完成的动作。\n想一想：刚才发生了什么？现在怎样了？",
  10: "用“有……”介绍画面。\n升级表达：这里有____，还有____。",
  11: "用“很……”描述特点。\n比较练习：大和小、快和慢、胖和瘦。",
  12: "用“会……”介绍本领。\n升级表达：____会____，也会____。",
  13: "用“不能……”说规则。\n把原因和结果连起来，说清楚为什么不能这样做。",
  14: "用“要……”表达计划和要求。\n练习文具店里的礼貌问候、询问和致谢。",
  15: "用“得……”说动作的程度。\n看一看，再说一说：谁做得怎么样？",
  16: "用“把……”说完整句。\n练习把普通句转换成“把”字句。",
};

// 从命令行接收单课编号，便于逐课生成和在失败后精确续跑。
const requestedLesson = Number(process.argv[2]);
// 非法课号会立即停止，避免误写其他目录。
if (!Number.isInteger(requestedLesson) || requestedLesson < 2 || requestedLesson > 16) {
  throw new Error("请传入2至16之间的课号。");
}
// 完整读取覆盖清单，确保每一页都来自已经盘点的中册内容。
const coverage = JSON.parse(await fs.readFile(COVERAGE_FILE, "utf8"));
// 只选择当前调用指定的一课，保持单次内存占用稳定。
const lesson = coverage.find((item) => item.lesson === requestedLesson);
// 缺失清单时停止生成，禁止用猜测内容补页。
if (!lesson) {
  throw new Error(`覆盖清单中不存在第${requestedLesson}课。`);
}
// 本课原创主题图由图像生成能力创建，不复用旧课件视觉资产。
const themePath = path.join(PROJECT_ROOT, "cache/中文教学/口才与表演/中册/课程插图/主题与练习", `第${String(requestedLesson).padStart(2, "0")}课_主题底图.png`);
// 本课多场景练习图专门承载句子宝库和拓展训练，不复用教材截图。
const exercisePath = path.join(PROJECT_ROOT, "cache/中文教学/口才与表演/中册/课程插图/主题与练习", `第${String(requestedLesson).padStart(2, "0")}课_练习图.png`);
// 品牌Logo使用项目已确认的真实透明资产。
const logoPath = path.join(PROJECT_ROOT, "apps/rule-engine/backend/src/main/resources/中文教学/assets/品牌/新思度华文学堂.png");
// 透明玻璃按钮只承担可见播放入口，音频在后续Open XML封装阶段嵌入。
const audioButtonPath = path.join(PROJECT_ROOT, "cache/中文教学/口才与表演/中册/控件/音频按钮_透明玻璃.png");
// 四个核心课堂模块各读取一张独立插图，拓展页继续使用本课完整组合练习图。
const rolePaths = {
  situation: path.join(ROLE_ASSET_ROOT, `第${String(requestedLesson).padStart(2, "0")}课`, "情境观察.png"),
  pronunciation: path.join(ROLE_ASSET_ROOT, `第${String(requestedLesson).padStart(2, "0")}课`, "发音训练.png"),
  brainstorm: path.join(ROLE_ASSET_ROOT, `第${String(requestedLesson).padStart(2, "0")}课`, "口脑风暴.png"),
  performance: path.join(ROLE_ASSET_ROOT, `第${String(requestedLesson).padStart(2, "0")}课`, "粉墨登场.png"),
};
// 预读全部图片字节，避免异步读取改变页面生成顺序。
const imageBytes = {
  theme: await fs.readFile(themePath),
  exercise: await fs.readFile(exercisePath),
  logo: await fs.readFile(logoPath),
  audioButton: await fs.readFile(audioButtonPath),
  situation: await fs.readFile(rolePaths.situation),
  pronunciation: await fs.readFile(rolePaths.pronunciation),
  brainstorm: await fs.readFile(rolePaths.brainstorm),
  performance: await fs.readFile(rolePaths.performance),
};
// 每课从空白演示文稿创建，不导入旧课件的页面、母版或媒体。
const deck = Presentation.create({ slideSize: SLIDE_SIZE });

/**
 * 添加原生可编辑文字，并统一中文字体、行距和自适应策略。
 */
function addText(slide, text, position, options = {}) {
  // 文本对象保留业务名称，方便后续在PowerPoint选择窗格中定位。
  const shape = slide.shapes.add({
    geometry: "textbox",
    name: options.name || `TEXT_${Math.random().toString(36).slice(2, 8)}`,
    position,
    fill: options.fill || "none",
    line: options.line || { style: "solid", fill: "none", width: 0 },
    borderRadius: options.borderRadius,
  });
  // 文字始终保持可编辑，禁止烘焙到背景图中。
  shape.text = text;
  // 长正文仅在必要时缩小，标题、提示和练习句保持适龄可读。
  shape.text.style = {
    fontSize: options.fontSize || 27,
    bold: Boolean(options.bold),
    color: options.color || C.ink,
    alignment: options.alignment || "left",
    verticalAlignment: options.verticalAlignment || "middle",
    typeface: options.typeface || FONT_SANS,
    lineSpacing: options.lineSpacing || 1.28,
    autoFit: options.autoFit || "shrinkText",
    insets: options.insets || { top: 9, right: 12, bottom: 9, left: 12 },
  };
  // 返回对象供调用方继续设置页面行为。
  return shape;
}

/**
 * 添加40%透明度视觉效果的文字底板。
 */
function addGlassCard(slide, position, options = {}) {
  // 白色60%不透明等价于40%透明，既保留水彩纹理又保证正文清晰。
  return slide.shapes.add({
    geometry: "roundRect",
    position,
    fill: options.fill || `${C.white}/60`,
    line: { style: "solid", fill: options.line || `${C.teal}/18`, width: 1 },
    borderRadius: "rounded-2xl",
    shadow: options.shadow || "shadow-sm",
  });
}

/**
 * 完整显示原创主题图，绝不使用裁剪填充。
 */
function addTheme(slide, position = { left: 0, top: 0, width: 1280, height: 720 }) {
  // contain模式完整保留人物、场景和图片内已有构图边界。
  return slide.images.add({
    blob: imageBytes.theme,
    contentType: "image/png",
    alt: `第${requestedLesson}课原创水彩绘本主题图`,
    fit: "contain",
    position,
  });
}

/**
 * 完整显示本课四格练习图，保留图片自身的全部边框。
 */
function addExerciseImage(slide, position) {
  // contain模式禁止裁切四格边缘、人物和场景。
  return slide.images.add({
    blob: imageBytes.exercise,
    contentType: "image/png",
    alt: `第${requestedLesson}课原创四格练习图`,
    fit: "contain",
    position,
  });
}

/**
 * 完整显示当前课堂模块的专属插图。
 */
function addRoleImage(slide, roleKey, position) {
  // 每个模块只读取自己的图像字节，禁止回退到全课主题图制造重复页面。
  const blob = imageBytes[roleKey];
  // 缺失模块图时立即失败，避免静默生成视觉缩水稿。
  if (!blob) {
    throw new Error(`第${requestedLesson}课缺少模块插图：${roleKey}`);
  }
  // contain模式完整保留人物、动作、物品和图片自带边框。
  return slide.images.add({
    blob,
    contentType: "image/png",
    alt: `第${requestedLesson}课${roleKey}原创水彩绘本插图`,
    fit: "contain",
    position,
  });
}

/**
 * 添加通用品牌、栏目和页码。
 */
function addChrome(slide, section, page, accent = C.coral) {
  // 暖白底色填补原图完整显示时可能产生的边缘留白。
  slide.background.fill = C.cream;
  // Logo完整显示，不拉伸、不裁切。
  slide.images.add({
    blob: imageBytes.logo,
    contentType: "image/png",
    alt: "新思度华文学堂品牌Logo",
    fit: "contain",
    position: { left: 42, top: 22, width: 116, height: 74 },
  });
  // 右上短横线标识课堂阶段。
  slide.shapes.add({
    geometry: "roundRect",
    position: { left: 1065, top: 50, width: 76, height: 9 },
    fill: accent,
    line: { style: "solid", fill: "none", width: 0 },
    borderRadius: "rounded-full",
  });
  // 栏目名称保持紧凑，不遮挡右侧完整人物。
  addText(slide, section, { left: 1140, top: 31, width: 120, height: 42 }, {
    // 栏目标识按导出换算后至少保留18磅，避免投影环境下难以辨认。
    fontSize: 24,
    bold: true,
    color: C.gray,
    alignment: "right",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  // 页码固定右下，便于与旧稿逐页核对。
  addText(slide, String(page).padStart(2, "0"), { left: 1190, top: 672, width: 52, height: 24 }, {
    fontSize: 13,
    color: C.gray,
    alignment: "right",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  });
}

/**
 * 清理旧稿抽取文本中的占位符和碎片空行。
 */
function normalizeText(value) {
  // 删除PPT默认占位提示，避免无业务意义的文字进入成品。
  const withoutPlaceholders = String(value || "").replaceAll("此处添加标题", "");
  // 合并重复空行并清理行首尾空白，保留诗歌和台词的自然换行。
  const cleaned = withoutPlaceholders
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line, index, lines) => line || (index > 0 && lines[index - 1]))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  // 抽取结果若被拆成大量单字行，则重新合并为连续文本，避免页面出现纵向碎字和异常缩小。
  const compactLines = cleaned.split("\n").filter(Boolean);
  const averageLength = compactLines.length
    ? compactLines.reduce((sum, line) => sum + line.length, 0) / compactLines.length
    : 0;
  // 只处理明显碎片化页面，正常诗歌和故事仍保留原始换行。
  return compactLines.length > 12 && averageLength < 4.5 ? compactLines.join(" ") : cleaned;
}

/**
 * 将发音教学对象中的英文a字形转换为教材拼音字形。
 */
function normalizePinyinGlyphs(value) {
  // 带调a使用单层ɑ加组合调号，确保视觉字形不回退为英文双层a。
  const toned = String(value || "")
    .replaceAll("ā", "ɑ̄")
    .replaceAll("á", "ɑ́")
    .replaceAll("ǎ", "ɑ̌")
    .replaceAll("à", "ɑ̀");
  // 发音栏目内剩余小写a均属于拼音说明或音节，统一改为教材拼音ɑ。
  const teachingGlyphs = toned.replaceAll("a", "ɑ");
  // 旧稿抽取会把拼音说明拆成大量单字行；发音页统一折叠为空格分隔文本，再由文本框自然换行。
  return teachingGlyphs.replace(/\s+/g, " ").trim();
}

/**
 * 清理拼音教学文本中的抽取空格和行首标点。
 */
function normalizePinyinSentence(value) {
  // 先统一教材拼音字形并折叠旧稿的碎片换行。
  const normalized = normalizePinyinGlyphs(value);
  // 标点必须紧跟前文，禁止逗号或句号被单独挤到下一行开头。
  return normalized
    .replace(/\s+([,，。；：！？、])/g, "$1")
    .replace(/([,，。；：！？、])(?=[^\s])/g, "$1 ")
    .trim();
}

/**
 * 按旧稿四声和词语行解析拼音练习页。
 */
function parsePinyinPractice(slideInfo) {
  // 保留原始双空格分栏信息，只清理每行首尾空白。
  const lines = String(slideInfo.source_text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  // 第一行“练习”只是旧稿页标题，不参与发音说明解析。
  const contentLines = lines[0]?.replace(/\s+/g, "") === "练习" ? lines.slice(1) : lines;
  // 第一组四个带调音节是“发音说明”和“练习卡片”的稳定边界。
  const syllableLineIndex = contentLines.findIndex((line) => {
    // 双空格分隔的四栏对应旧稿四声音节。
    const columns = line.split(/\s{2,}/).filter(Boolean);
    // 至少四栏且包含声调字符时才认定为四声行。
    return columns.length >= 4 && /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/u.test(line);
  });
  // 无法稳定识别结构时返回空值，让调用方使用普通教学页作为安全回退。
  if (syllableLineIndex < 1 || syllableLineIndex + 1 >= contentLines.length) {
    return null;
  }
  // 发音说明由四声音节行之前的碎片组成。
  const headingAndExplanation = normalizePinyinSentence(contentLines.slice(0, syllableLineIndex).join(" "));
  // 旧稿可能把复韵母拆成“o u”或“ü n”；仅折叠破折号前的韵母字母，避免改动正文词间距。
  const compactHeading = headingAndExplanation.replace(
    /^([a-züɑ](?:\s+[a-züɑ])+)\s*([—-]+)/iu,
    (_matched, splitPhoneme, dash) => `${splitPhoneme.replace(/\s+/g, "")}${dash}`,
  );
  // 韵母位于说明开头和破折号之前。
  const phonemeMatch = compactHeading.match(/^([a-züɑ]+)\s*[—-]+/iu);
  // 缺少明确韵母标签时停止结构化，避免猜测教学内容。
  if (!phonemeMatch) {
    return null;
  }
  // 取出教材字形韵母作为页面标题。
  const phoneme = normalizePinyinGlyphs(phonemeMatch[1]);
  // 删除重复韵母和破折号，只保留完整发音要领。
  const explanation = normalizePinyinSentence(compactHeading.slice(phonemeMatch[0].length))
    // 旧稿正文也可能把当前复韵母拆开；只合并与本页韵母完全相同的字母序列。
    .replace(new RegExp([...phoneme].join("\\s*"), "giu"), phoneme);
  // 四声音节按旧稿双空格分栏。
  const syllablePinyin = contentLines[syllableLineIndex].split(/\s{2,}/).filter(Boolean);
  // 汉字行移除布局空格后与四声音节逐项对应。
  const syllableHanzi = contentLines[syllableLineIndex + 1].replace(/\s+/g, "");
  // 只使用前四组四声练习，避免旧稿尾部噪声进入卡片。
  const syllables = syllablePinyin.slice(0, 4).map((pinyin, index) => ({
    // 音节统一转换为教材拼音字形。
    pinyin: normalizePinyinGlyphs(pinyin),
    // 每个音节对应一个原稿汉字。
    hanzi: syllableHanzi[index] || "",
  }));
  // 四声汉字缺失时停止结构化，防止出现空标签卡。
  if (syllables.some((item) => !item.hanzi)) {
    return null;
  }
  // 四声之后第一行包含全部词语拼音；旧稿同一词内部也可能使用双空格，因此先按单音节读取。
  const wordSyllables = String(contentLines[syllableLineIndex + 2] || "").split(/\s+/).filter(Boolean);
  // 对应汉字行先去除所有排版空格，再按拼音音节数量切分。
  const compactWordHanzi = String(contentLines[syllableLineIndex + 3] || "").replace(/\s+/g, "");
  // 中册练习区稳定承载四组词语；仅在音节和汉字都能等分时启用结构化分组。
  const wordGroupCount = wordSyllables.length > 0 && compactWordHanzi.length > 0 ? 4 : 0;
  // 每组音节数必须一致，避免根据不可靠的旧稿空格猜测词界。
  const syllablesPerWord = wordGroupCount > 0 && wordSyllables.length % wordGroupCount === 0
    ? wordSyllables.length / wordGroupCount
    : 0;
  // 每组汉字数必须和音节数一致，才能建立确定的一一对应。
  const hanziPerWord = wordGroupCount > 0 && compactWordHanzi.length % wordGroupCount === 0
    ? compactWordHanzi.length / wordGroupCount
    : 0;
  // 只有音节数与汉字数相等时才生成词语卡，禁止出现“白 / 云”式误拆。
  const words = syllablesPerWord > 0 && syllablesPerWord === hanziPerWord
    ? Array.from({ length: wordGroupCount }, (_unused, index) => ({
      // 同一词组的拼音音节合并到一张卡片。
      pinyin: normalizePinyinGlyphs(
        wordSyllables.slice(index * syllablesPerWord, (index + 1) * syllablesPerWord).join(" "),
      ),
      // 同位置汉字按相同数量切分，保持拼音与汉字严格对应。
      hanzi: compactWordHanzi.slice(index * hanziPerWord, (index + 1) * hanziPerWord),
    }))
    // 无法确定词界时返回空数组，由检测器报告内容缺失而不是输出错误配对。
    : [];
  // 返回结构化教学数据，页面无需再依赖旧稿空格排版。
  return { phoneme, explanation, syllables, words };
}

/**
 * 根据旧稿页序选择课堂模块图，保证同课不同教学环节使用不同视觉。
 */
function visualRoleFor(slideInfo) {
  // 情境观察和情境正文共同使用本课情境图，形成连续课堂动作。
  if (slideInfo.source_slide <= 7) {
    return "situation";
  }
  // 发音方法、词语练习及口部操使用本课发音图。
  if (slideInfo.source_slide <= 10) {
    return "pronunciation";
  }
  // 观察导入、绕口令及课外拓展使用本课口脑图。
  if (slideInfo.source_slide <= 13) {
    return "brainstorm";
  }
  // 表演观察和正式表演文本使用本课舞台图。
  return "performance";
}

/**
 * 根据页面角色确定右上栏目。
 */
function sectionFor(slideInfo) {
  // 专项栏目直接沿用旧中册的教学结构。
  if (["情境再现", "字正腔圆", "口脑风暴", "粉墨登场", "句子宝库", "拓展训练", "课堂回顾", "小任务"].includes(slideInfo.role)) {
    return slideInfo.role;
  }
  // 封面之后的前两页统一归到课前热身。
  if (slideInfo.source_slide <= 3) {
    return "课前热身";
  }
  // 主题和导航页保持明确标签。
  if (slideInfo.role === "主题导入" || slideInfo.role === "学习导航") {
    return slideInfo.role;
  }
  // 普通内容页根据前后位置归入最近的课堂模块。
  if (slideInfo.source_slide < 12) {
    return "字正腔圆";
  }
  if (slideInfo.source_slide < 16) {
    return "口脑风暴";
  }
  return "拓展训练";
}

/**
 * 从一页完整文本中提取短标题和正文。
 */
function titleAndBody(slideInfo) {
  // 课前自我介绍使用中册统一的清晰四步结构，完整覆盖旧页的问好、介绍、展示和致谢。
  if (slideInfo.source_slide === 2) {
    return {
      title: "自我介绍",
      body: "① 问好\n② 姓名和年龄\n③ 兴趣、本领或一段展示\n④ 微笑并致谢\n\n大家好！我叫______，今年____岁。\n我喜欢______。接下来请看我的表演，谢谢大家！",
    };
  }
  // 第3页必须使用用户确认的新口才之歌。
  if (slideInfo.source_slide === 3) {
    return { title: "口才之歌", body: NEW_SONG };
  }
  // 学习导航按六个既定模块重新排成可读清单，不遗漏旧稿栏目。
  if (slideInfo.role === "学习导航") {
    return {
      title: "学习内容",
      body: "① 情境再现\n② 字正腔圆\n③ 口脑风暴\n④ 粉墨登场\n⑤ 句子宝库\n⑥ 拓展训练",
    };
  }
  // 句子宝库直接吸收补充截图的教学事实，替代“请看教材”的失效占位。
  if (slideInfo.role === "句子宝库") {
    return { title: "句子宝库", body: SUPPLEMENT_FACTS[requestedLesson] };
  }
  // 课堂回顾给教师明确的三步复盘提示，同时保留原页作用。
  if (slideInfo.role === "课堂回顾") {
    return {
      title: "今天我们学到了什么？",
      body: "说一说：今天练习了哪个发音？\n读一读：你最喜欢哪首儿歌或故事？\n演一演：你最想展示哪个片段？",
    };
  }
  // 清理抽取文本后再进行标题拆分。
  const cleaned = normalizeText(slideInfo.source_text);
  // 空白旧页用补充材料构成完整可编辑练习，不保留空白页。
  if (!cleaned) {
    return { title: "看一看，说一说", body: SUPPLEMENT_FACTS[requestedLesson] };
  }
  // 第一行较短时作为标题，其余行保持原始顺序。
  const lines = cleaned.split("\n");
  const first = lines[0];
  // 过长首行通常本身就是问题句，使用角色作为页面标题。
  if (first.length > 18) {
    return { title: slideInfo.role === "内容页" ? "想一想，说一说" : slideInfo.role, body: cleaned };
  }
  // 角色词和标题重复时只展示一次。
  const body = lines.slice(1).join("\n").trim();
  return { title: first || slideInfo.role, body: body || cleaned };
}

/**
 * 添加紧凑透明玻璃播放入口。
 */
function addAudioButton(slide, left = 228, top = 622) {
  // 按钮完整PNG以contain显示，避免左右被截断或额外拉宽。
  slide.images.add({
    blob: imageBytes.audioButton,
    contentType: "image/png",
    alt: "播放",
    fit: "contain",
    position: { left, top, width: 112, height: 45 },
  });
}

/**
 * 为每页写入来源和重制约束，方便后续维护。
 */
function addNotes(slide, slideInfo) {
  // 备注说明内容来自旧中册，但视觉资产全部重新制作。
  slide.speakerNotes.textFrame.setText([
    `内容与页序依据：${path.basename(lesson.source_file)} 第${slideInfo.source_slide}页。`,
    "视觉资产：本轮原创水彩绘本图；未复用旧课件图片。",
    "图片规则：完整显示，禁止裁剪；正文保持PowerPoint原生可编辑。",
  ]);
}

/**
 * 创建封面页。
 */
function buildCover(slideInfo) {
  // 从完整原创图开始，保留左侧安全区和右侧完整主题人物。
  const slide = deck.slides.add();
  slide.background.fill = C.cream;
  addTheme(slide);
  // 品牌Logo放在左上留白区。
  slide.images.add({
    blob: imageBytes.logo,
    contentType: "image/png",
    alt: "新思度华文学堂品牌Logo",
    fit: "contain",
    position: { left: 64, top: 40, width: 130, height: 82 },
  });
  // 册别、课次和主题作为一个整体在左侧视觉垂直居中。
  addText(slide, "少儿口才与表演 · 中册", { left: 82, top: 175, width: 530, height: 58 }, {
    fontSize: 32,
    bold: true,
    color: C.teal,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  addText(slide, `第${requestedLesson}课`, { left: 84, top: 268, width: 220, height: 50 }, {
    fontSize: 25,
    bold: true,
    color: C.coral,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  addText(slide, lesson.title, { left: 80, top: 325, width: 540, height: 150 }, {
    fontSize: lesson.title.length > 8 ? 48 : 58,
    bold: true,
    lineSpacing: 1.12,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  addText(slide, "发音准 · 会表达 · 懂礼仪", { left: 86, top: 520, width: 500, height: 52 }, {
    fontSize: 24,
    color: C.gray,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  addNotes(slide, slideInfo);
}

/**
 * 创建普通教学页，并按内容密度选择完整图、安全区和信息卡布局。
 */
function buildContent(slideInfo) {
  // 当前页保持与旧稿完全相同的序号。
  const slide = deck.slides.add();
  // 暖白底承接完整显示产生的留白，不使用放大裁切填满。
  slide.background.fill = C.cream;
  // 主题导入页继续使用主题主视觉，其他页面按模块选择不同插图。
  if (slideInfo.role === "主题导入") {
    addTheme(slide);
  }
  // 根据角色写入稳定栏目和导航。
  const section = sectionFor(slideInfo);
  addChrome(slide, section, slideInfo.source_slide, section === "字正腔圆" ? C.yellow : section === "情境再现" || section === "粉墨登场" ? C.coral : C.teal);
  // 提取本页标题和正文。
  const extracted = titleAndBody(slideInfo);
  // 发音页只在明确的字正腔圆教学语境中转换教材拼音ɑ，普通英文不受影响。
  const title = section === "字正腔圆" ? normalizePinyinGlyphs(extracted.title) : extracted.title;
  // 发音正文同步转换带调ɑ和韵母组合，保证第一层文本检查可验证。
  const body = section === "字正腔圆" ? normalizePinyinGlyphs(extracted.body) : extracted.body;
  // 自我介绍、口才之歌和学习导航使用原生信息版式，不用主题图充当装饰。
  const textOnly = [2, 3, 5].includes(slideInfo.source_slide);
  // 主题导入页在左侧安全区放置短文字，保持主题图为主视觉。
  const themeIntro = slideInfo.role === "主题导入";
  // 普通页面按奇偶页交替图文方向，增加整套课件的布局节奏。
  const imageOnLeft = !textOnly && !themeIntro && slideInfo.source_slide % 2 === 0;
  // 非纯文字页面完整显示对应模块图，固定图文分区避免文字压住人物。
  if (!textOnly && !themeIntro) {
    addRoleImage(
      slide,
      visualRoleFor(slideInfo),
      imageOnLeft
        ? { left: 38, top: 118, width: 710, height: 550 }
        : { left: 532, top: 118, width: 710, height: 550 },
    );
  }
  // 文本卡与插图分区，整组在可用高度内视觉居中。
  const card = textOnly
    ? { left: 150, top: 145, width: 980, height: 500 }
    : themeIntro
      ? { left: 70, top: 185, width: 520, height: 380 }
      : imageOnLeft
        ? { left: 770, top: 160, width: 455, height: 455 }
        : { left: 60, top: 160, width: 455, height: 455 };
  addGlassCard(slide, card);
  // 标题位于卡片内而不是压在图片人物上。
  addText(slide, title, { left: card.left + 36, top: card.top + 24, width: card.width - 72, height: 74 }, {
    fontSize: title.length > 18 ? 29 : textOnly ? 41 : 35,
    bold: true,
    color: title.includes("练习") || title.includes("看一看") ? C.coral : C.ink,
    alignment: title.length <= 14 ? "center" : "left",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  // 正文在标题下方完整保留，字号由内容长度分级但不低于20。
  const bodySize = body.length > 220 ? 18 : body.length > 165 ? 20 : body.length > 110 ? 22 : textOnly ? 27 : 25;
  addText(slide, body, {
    left: card.left + 40,
    top: card.top + 108,
    width: card.width - 80,
    height: card.height - 140,
  }, {
    fontSize: bodySize,
    typeface: section === "字正腔圆" ? "Arial" : slideInfo.role === "情境再现" || slideInfo.role === "口脑风暴" || slideInfo.role === "粉墨登场" ? FONT_SERIF : FONT_SANS,
    alignment: body.length < 90 ? "center" : "left",
    verticalAlignment: "middle",
    lineSpacing: body.length > 160 ? 1.18 : 1.34,
    insets: { top: 4, right: 6, bottom: 4, left: 6 },
  });
  // 三个有声栏目页显示统一“播放”入口，点击热区只覆盖按钮自身。
  if (["情境再现", "口脑风暴", "粉墨登场"].includes(slideInfo.role)) {
    // 装饰按钮与后续Open XML媒体热区使用完全相同的坐标，避免出现两个播放按钮。
    addAudioButton(slide, imageOnLeft ? 950 : 230, 622);
  }
  // 备注记录逐页内容来源和不裁剪规则。
  addNotes(slide, slideInfo);
}

/**
 * 创建结构化拼音练习页，明确分开发音说明、四声和词语。
 */
function buildPronunciationPracticePage(slideInfo) {
  // 从原稿恢复拼音与汉字对应关系，不沿用旧稿碎片换行。
  const practice = parsePinyinPractice(slideInfo);
  // 无法可靠解析时使用普通页并保留原文，禁止丢失教学内容。
  if (!practice) {
    buildContent(slideInfo);
    return;
  }
  // 当前页保持原稿页码和字正腔圆栏目。
  const slide = deck.slides.add();
  // 添加统一品牌、栏目和页码。
  addChrome(slide, "字正腔圆", slideInfo.source_slide, C.yellow);
  // 主标题明确本页教学韵母，使用教材拼音字形。
  addText(slide, `韵母 ${practice.phoneme}`, { left: 70, top: 112, width: 570, height: 64 }, {
    fontSize: 38,
    bold: true,
    alignment: "left",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  // 发音要领使用独立底板，不与音节和词语混成连续段落。
  addGlassCard(slide, { left: 60, top: 185, width: 620, height: 190 });
  // 分区标题帮助儿童和教师快速定位说明内容。
  addText(slide, "发音要领", { left: 92, top: 202, width: 180, height: 38 }, {
    // 导出后保持不低于18磅，形成清晰的分区标题。
    fontSize: 24,
    bold: true,
    color: C.coral,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  // 发音说明在底板中部自然换行，禁止行首标点和单字碎行。
  addText(slide, practice.explanation, { left: 92, top: 246, width: 556, height: 104 }, {
    // 长说明也不通过缩小到18磅以下解决，必要时由文本框自然换行。
    fontSize: 24,
    typeface: FONT_SANS,
    alignment: "left",
    verticalAlignment: "middle",
    lineSpacing: 1.24,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  // 发音示意图完整放在右上视觉区，使用contain禁止裁剪人物和口形。
  addRoleImage(slide, "pronunciation", { left: 715, top: 132, width: 500, height: 255 });
  // 四声音节单独成组，避免与发音说明混排。
  addText(slide, "四声练习", { left: 60, top: 395, width: 180, height: 34 }, {
    // 分区名称与发音要领保持同级字号。
    fontSize: 24,
    bold: true,
    color: C.teal,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  // 四组音节在整页宽度上等距排列。
  practice.syllables.forEach((item, index) => {
    // 每张音节卡宽度固定，拼音和汉字保持同一视觉中心。
    const left = 60 + index * 300;
    // 淡色卡片区分四声，同时保持足够文字对比度。
    addGlassCard(slide, { left, top: 435, width: 260, height: 82 }, {
      fill: `${[C.paleYellow, C.paleCoral, C.paleTeal, C.paleBlue][index]}/82`,
    });
    // 拼音位于卡片上半部并使用验证过的拉丁字形字体。
    addText(slide, item.pinyin, { left: left + 18, top: 445, width: 224, height: 30 }, {
      // 拼音需要承载声调辨识，字号略大于最低可读线。
      fontSize: 27,
      bold: true,
      typeface: "Arial",
      alignment: "center",
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    // 对应汉字位于卡片下半部，与拼音严格居中对齐。
    addText(slide, item.hanzi, { left: left + 18, top: 478, width: 224, height: 28 }, {
      // 对应汉字不低于18磅并与拼音垂直对齐。
      fontSize: 24,
      typeface: FONT_SANS,
      alignment: "center",
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  });
  // 词语练习是第二个独立教学分区。
  addText(slide, "词语练习", { left: 60, top: 535, width: 180, height: 34 }, {
    // 词语区标题沿用统一分区字号。
    fontSize: 24,
    bold: true,
    color: C.teal,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  // 根据词语数量平均分配页面宽度，最多四组。
  const wordCardWidth = practice.words.length > 0 ? 1160 / practice.words.length : 1160;
  // 每组词语使用独立卡片保证拼音和汉字不串位。
  practice.words.forEach((item, index) => {
    // 卡片宽度保留相邻间距，避免边框粘连。
    const width = wordCardWidth - 18;
    // 卡片位置由组序稳定计算。
    const left = 60 + index * wordCardWidth;
    // 词语卡使用统一半透明底板。
    addGlassCard(slide, { left, top: 575, width, height: 86 }, { fill: `${C.white}/72` });
    // 拼音词组保持在同一行，禁止异常缩小。
    addText(slide, item.pinyin, { left: left + 12, top: 586, width: width - 24, height: 30 }, {
      // 词组拼音保留声调细节，不使用小字号压缩。
      fontSize: 24,
      typeface: "Arial",
      alignment: "center",
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    // 汉字词组与上方拼音逐组对应。
    addText(slide, item.hanzi, { left: left + 12, top: 620, width: width - 24, height: 28 }, {
      // 词组汉字与上方拼音成对居中显示。
      fontSize: 24,
      typeface: FONT_SANS,
      alignment: "center",
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  });
  // 备注继续保留原始来源文本，方便逐页追溯。
  addNotes(slide, slideInfo);
}

/**
 * 创建句子宝库或拓展训练图文页。
 */
function buildExercisePage(slideInfo) {
  // 页面使用暖白底并留出稳定边距。
  const slide = deck.slides.add();
  slide.background.fill = C.cream;
  // 添加品牌、栏目和原页码。
  addChrome(slide, slideInfo.role, slideInfo.source_slide, C.yellow);
  // 四格图片按原始比例完整显示在左侧，图片自身边框全部保留。
  addExerciseImage(slide, { left: 48, top: 142, width: 804, height: 536 });
  // 文字独立放在右侧安全区，不压住任何一格插画。
  addGlassCard(slide, { left: 868, top: 166, width: 354, height: 450 });
  // 页面标题位于右侧底板顶部。
  addText(slide, slideInfo.role, { left: 894, top: 196, width: 302, height: 68 }, {
    fontSize: 34,
    bold: true,
    color: C.coral,
    alignment: "center",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  // 句子宝库使用补充截图转写事实，拓展页同时保留原页任务与补充句式。
  const sourceBody = normalizeText(slideInfo.source_text);
  // 同一课的补充事实必须进入可编辑正文，禁止只留“看教材”占位。
  const body = slideInfo.role === "句子宝库"
    ? SUPPLEMENT_FACTS[requestedLesson]
    : `${sourceBody}\n\n${SUPPLEMENT_FACTS[requestedLesson]}`;
  // 右侧正文做视觉垂直居中，和左侧四格图片形成平衡。
  addText(slide, body, { left: 900, top: 278, width: 290, height: 296 }, {
    fontSize: body.length > 175 ? 19 : body.length > 115 ? 21 : 24,
    alignment: "left",
    verticalAlignment: "middle",
    lineSpacing: 1.3,
    insets: { top: 4, right: 4, bottom: 4, left: 4 },
  });
  // 备注记录补图只用于教学事实，成品视觉为本轮原创。
  addNotes(slide, slideInfo);
}

/**
 * 创建结束页。
 */
function buildEnding(slideInfo) {
  // 结束页继续完整使用本课原创主题图，形成前后呼应。
  const slide = deck.slides.add();
  slide.background.fill = C.cream;
  addTheme(slide);
  // Logo保持与封面一致。
  slide.images.add({
    blob: imageBytes.logo,
    contentType: "image/png",
    alt: "新思度华文学堂品牌Logo",
    fit: "contain",
    position: { left: 64, top: 42, width: 130, height: 82 },
  });
  // 左侧文字作为整体视觉垂直居中，避开右侧完整人物。
  addText(slide, "今天我会啦！", { left: 82, top: 235, width: 500, height: 98 }, {
    fontSize: 55,
    bold: true,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  addText(slide, lesson.title, { left: 84, top: 345, width: 500, height: 82 }, {
    fontSize: lesson.title.length > 8 ? 32 : 39,
    bold: true,
    color: C.teal,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  addText(slide, "期待下次再见～", { left: 86, top: 455, width: 430, height: 64 }, {
    fontSize: 30,
    color: C.coral,
    bold: true,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  addNotes(slide, slideInfo);
}

// 按覆盖清单逐页生成，页数和顺序与旧稿一一对应。
for (const slideInfo of lesson.source_slides) {
  // 第一页生成正式封面。
  if (slideInfo.source_slide === 1) {
    buildCover(slideInfo);
  // 最后一页生成结束页。
  } else if (slideInfo.source_slide === lesson.source_slide_count) {
    buildEnding(slideInfo);
  // 拼音练习页使用专门结构化版式，禁止旧稿碎片文字直接进入通用卡片。
  } else if (slideInfo.role === "字正腔圆" && /练\s*习/.test(slideInfo.source_text || "")) {
    buildPronunciationPracticePage(slideInfo);
  // 句子宝库和拓展训练使用完整四格练习图，增强视觉丰富度且不遮挡文字。
  } else if (["句子宝库", "拓展训练"].includes(slideInfo.role)) {
    buildExercisePage(slideInfo);
  // 其他页面全部按普通教学页保留内容。
  } else {
    buildContent(slideInfo);
  }
}

// 输出目录按“第N课/PPT排版/批量稿”统一归档。
const outputDir = path.join(OUTPUT_ROOT, `第${requestedLesson}课`, "PPT排版", "批量稿");
// 首次生成时自动创建目录，不覆盖其他课次文件。
await fs.mkdir(outputDir, { recursive: true });
// 文件名同时记录课次、主题和重制标准，便于教师选择。
const outputFile = path.join(outputDir, `少儿口才与表演中册第${String(requestedLesson).padStart(2, "0")}课_${lesson.title}_严格重制版.pptx`);
// 导出原生PPTX，所有文字、形状和图片均可继续编辑或替换。
const pptx = await PresentationFile.exportPptx(deck);
// 保存本课无音频底稿，后续封装只增加媒体关系。
await pptx.save(outputFile);
// 输出机器可读结果，供批量脚本和验证链采集。
console.log(JSON.stringify({
  lesson: requestedLesson,
  title: lesson.title,
  output: outputFile,
  slides: deck.slides.items.length,
  expectedSlides: lesson.source_slide_count,
}, null, 2));
