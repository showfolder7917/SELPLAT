import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

// 检测器优先使用调用方显式传入的工程根，否则以当前工作目录作为当前工程。
const PROJECT_ROOT = path.resolve(process.env.SELPLAT_PROJECT_ROOT || process.cwd());
// 当前工作区保存原稿覆盖清单和本轮验证报告，避免把检测产物写入正式成品目录。
const WORKSPACE = path.join(PROJECT_ROOT, "OPTION/temp/口才与表演中册其余课程重制");
// 覆盖清单是第2至16课逐页模块和页数的唯一核对依据。
const COVERAGE_FILE = path.join(PROJECT_ROOT, "apps/rule-engine/backend/src/main/resources/中文教学/template/口才与表演/中册/课程内容索引.json");
// 图片安全区映射是整幅铺底后自动避让人物的生成依据。
const SAFE_ZONE_FILE = path.join(PROJECT_ROOT, "apps/rule-engine/backend/src/main/resources/中文教学/template/口才与表演/中册/图片安全区映射.json");
// 生成器源码必须先通过静态准入，防止下次批量执行重新退回小图片版式。
const GENERATOR_FILE = path.join(PROJECT_ROOT, "apps/rule-engine/backend/src/main/node/com/sp/selplat/code/中文教学/教学图片与PPT生成/口才与表演/中册/口才与表演中册PPT生成器.mjs");
// 正式输出根目录用于定位每课最终PPTX。
const OUTPUT_ROOT = path.join(PROJECT_ROOT, "OPTION/temp/中文教学/教学图片与PPT生成/项目/口才与表演/中册");
// 第一课采用独立生成器，因此显式登记其第七版成品和已确认页数。
const LESSON_ONE = {
  lesson: 1,
  title: "爱是什么",
  source_slide_count: 25,
  pinyin_slides: [8, 9, 10],
  output: path.join(
    OUTPUT_ROOT,
    "第一课",
    "PPT排版",
    "批量稿",
    "少儿口才与表演中册第一课_爱是什么_第7版_教材拼音字形修正版.pptx",
  ),
};
// 这些稳定栏目必须在相应原稿页继续存在，防止重制时漏掉教学模块。
const REQUIRED_ROLES = new Set([
  "主题导入",
  "学习导航",
  "课前热身",
  "情境再现",
  "字正腔圆",
  "口脑风暴",
  "粉墨登场",
  "句子宝库",
  "拓展训练",
  "课堂回顾",
  "小任务",
]);

/**
 * 检查中册生成器是否持续使用第一课标准和完整图片安全区配置。
 */
async function inspectGeneratorSource(coverage) {
  // 源码和图片安全区配置必须同时可读。
  const [source, safeZoneMap] = await Promise.all([
    fs.readFile(GENERATOR_FILE, "utf8"),
    fs.readFile(SAFE_ZONE_FILE, "utf8").then((text) => JSON.parse(text)),
  ]);
  // 所有准入失败原因集中返回。
  const errors = [];
  // 这些标记共同证明生成器使用整幅铺底、自然安全区和空白画布。
  const requiredMarkers = [
    "SAFE_ZONE_FILE",
    "safeSideFor",
    "Presentation.create",
    "width: 1280, height: 720",
    "请看教材",
  ];
  // 任一关键标记缺失都说明生成链路可能回退。
  for (const marker of requiredMarkers) {
    if (!source.includes(marker)) errors.push(`生成器缺少准入标记：${marker}`);
  }
  // 每课六类现有原创资产必须全部拥有左右安全区分析，不允许按奇偶页猜测。
  for (const lesson of coverage) {
    // 两位课次与缓存目录命名一致。
    const code = String(lesson.lesson).padStart(2, "0");
    // 主题、练习和四个模块图构成当前课完整视觉资产集合。
    const keys = [
      `主题与练习/第${code}课_主题底图.png`,
      `主题与练习/第${code}课_练习图.png`,
      `模块插图/第${code}课/情境观察.png`,
      `模块插图/第${code}课/发音训练.png`,
      `模块插图/第${code}课/口脑风暴.png`,
      `模块插图/第${code}课/粉墨登场.png`,
    ];
    // 逐图检查稳定左右值。
    for (const key of keys) {
      if (!["left", "right"].includes(safeZoneMap[key]?.safeSide)) {
        errors.push(`缺少图片安全区映射：${key}`);
      }
    }
  }
  // 返回静态门禁结果供整册报告置顶展示。
  return {
    passed: errors.length === 0,
    mappedAssets: Object.keys(safeZoneMap).length,
    errors,
  };
}

/**
 * 从压缩包读取一个明确部件，不把解包中间文件写到磁盘。
 */
function readArchiveEntry(pptx, entry) {
  // 使用系统解包工具按原始字节读取，既保留XML编码也可直接计算图片摘要。
  return execFileSync("unzip", ["-p", pptx, entry], { maxBuffer: 128 * 1024 * 1024 });
}

/**
 * 提取页面中的可见文本，供模块和拼音字形检查使用。
 */
function extractSlideText(pptx, entry) {
  // 页面XML按UTF-8解释，避免中文检测受到系统编码影响。
  const xml = readArchiveEntry(pptx, entry).toString("utf8");
  // 仅抽取DrawingML文本节点，图片替代文字不会干扰拼音正文判断。
  return [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
    .map((match) => match[1])
    .join("\n")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

/**
 * 提取页面中的独立文本节点，检查行首标点和异常长段落。
 */
function extractSlideTextNodes(pptx, entry) {
  // 页面XML按UTF-8读取，保留每个文本对象的边界。
  const xml = readArchiveEntry(pptx, entry).toString("utf8");
  // 每个DrawingML文本节点作为一个独立排版单元。
  return [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((match) => match[1]
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'"));
}

/**
 * 提取文本形状及其显式字号，检查为塞入内容而异常缩字的问题。
 */
function extractTextShapes(pptx, entry) {
  // 页面XML保留形状、文本和字号的共同上下文。
  const xml = readArchiveEntry(pptx, entry).toString("utf8");
  // 每个普通形状单独解析，图片和连接线不参与字号检查。
  return [...xml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)].map((shapeMatch) => {
    // 合并当前形状内的全部可见文本。
    const text = [...shapeMatch[1].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
      .map((match) => match[1])
      .join("");
    // 收集运行或段落默认属性中的显式字号，单位为百分之一磅。
    const sizes = [...shapeMatch[1].matchAll(/\bsz="(\d+)"/g)].map((match) => Number(match[1]));
    // 返回当前形状的文字和最小显式字号。
    return { text, minSize: sizes.length ? Math.min(...sizes) : null };
  }).filter((shape) => shape.text);
}

/**
 * 将旧稿拼音转换为目标教材字形，供对应关系检测使用。
 */
function normalizeExpectedPinyin(value) {
  // 带调a转换为单层ɑ和组合调号。
  const toned = String(value || "")
    .replaceAll("ā", "ɑ̄")
    .replaceAll("á", "ɑ́")
    .replaceAll("ǎ", "ɑ̌")
    .replaceAll("à", "ɑ̀");
  // 剩余ASCII a在拼音教学语境中统一转换为ɑ。
  return toned.replaceAll("a", "ɑ").replace(/\s+/g, " ").trim();
}

/**
 * 从旧稿拼音练习页恢复必须出现的拼音和汉字对应项。
 */
function expectedPinyinPairs(slideInfo) {
  // 清理首尾空白但保留双空格分栏。
  const lines = String(slideInfo.source_text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  // 找到四个带调音节所在的稳定行。
  const syllableLineIndex = lines.findIndex((line) => line.split(/\s{2,}/).filter(Boolean).length >= 4
    && /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/u.test(line));
  // 缺失稳定结构时不输出猜测配对。
  if (syllableLineIndex < 0 || syllableLineIndex + 1 >= lines.length) {
    return [];
  }
  // 四声音节按双空格拆分。
  const syllablePinyin = lines[syllableLineIndex].split(/\s{2,}/).filter(Boolean).slice(0, 4);
  // 对应汉字去除布局空格。
  const syllableHanzi = lines[syllableLineIndex + 1].replace(/\s+/g, "");
  // 形成四声音节和汉字配对。
  const pairs = syllablePinyin.map((pinyin, index) => ({
    pinyin: normalizeExpectedPinyin(pinyin),
    hanzi: syllableHanzi[index] || "",
  }));
  // 词语拼音行按单音节读取，因为旧稿同一个词内部也可能使用双空格。
  const wordSyllables = String(lines[syllableLineIndex + 2] || "").split(/\s+/).filter(Boolean);
  // 词语汉字行去除所有布局空格。
  const compactWordHanzi = String(lines[syllableLineIndex + 3] || "").replace(/\s+/g, "");
  // 中册页面固定展示四组词语，音节和汉字必须能按四组等分。
  const wordGroupCount = wordSyllables.length > 0 && compactWordHanzi.length > 0 ? 4 : 0;
  // 计算每组应包含的拼音音节数量。
  const syllablesPerWord = wordGroupCount > 0 && wordSyllables.length % wordGroupCount === 0
    ? wordSyllables.length / wordGroupCount
    : 0;
  // 计算每组应包含的汉字数量。
  const hanziPerWord = wordGroupCount > 0 && compactWordHanzi.length % wordGroupCount === 0
    ? compactWordHanzi.length / wordGroupCount
    : 0;
  // 只有一音节对应一汉字时才形成期望配对，避免检测器认可错误拆词。
  if (syllablesPerWord > 0 && syllablesPerWord === hanziPerWord) {
    // 逐组构造“完整词语拼音—完整汉字词语”期望值。
    for (let index = 0; index < wordGroupCount; index += 1) {
      // 当前组拼音按固定音节数量合并。
      const pinyin = wordSyllables
        .slice(index * syllablesPerWord, (index + 1) * syllablesPerWord)
        .join(" ");
      // 当前组汉字按相同数量切分。
      const hanzi = compactWordHanzi.slice(index * hanziPerWord, (index + 1) * hanziPerWord);
      // 完整配对加入检测集合，页面拆成单字时将明确失败。
      pairs.push({ pinyin: normalizeExpectedPinyin(pinyin), hanzi });
    }
  }
  // 返回检测所需的全部对应项。
  return pairs;
}

/**
 * 检查拼音练习页的教学分区、标点、密度和对应关系。
 */
function validatePinyinLayout(lesson, slideTexts, slideEntries) {
  // 第一课使用已人工确认的独立版式，本检测只处理批量生成器的结构化拼音页。
  if (!lesson.source_slides) {
    return [];
  }
  // 只选择旧稿中明确包含“练习”的字正腔圆页面。
  const practiceSlides = lesson.source_slides.filter(
    (slide) => slide.role === "字正腔圆" && /练\s*习/.test(slide.source_text || ""),
  );
  // 汇总逐页问题，空数组代表通过。
  const issues = [];
  for (const slideInfo of practiceSlides) {
    // 根据原稿页号定位对应成品页面。
    const entry = slideEntries.find((candidate) => candidate.endsWith(`slide${slideInfo.source_slide}.xml`));
    // 页面部件缺失直接记录。
    if (!entry) {
      issues.push({ slide: slideInfo.source_slide, type: "missing_slide" });
      continue;
    }
    // 提取独立文本对象，避免只检查整页合并文本。
    const nodes = extractSlideTextNodes(lesson.output, entry);
    // 提取文本形状字号，检测异常缩小。
    const textShapes = extractTextShapes(lesson.output, entry);
    // 页面必须存在三个清晰教学分区。
    const missingSections = ["发音要领", "四声练习", "词语练习"].filter(
      (label) => !nodes.includes(label),
    );
    // 任何文本对象不得以标点开头。
    const leadingPunctuation = nodes.filter((node) => /^[,，。；：！？、]/.test(node.trim()));
    // 单一正文对象不得超过160字符，防止说明、音节和汉字再次混成一块。
    const overDenseNodes = nodes.filter((node) => node.trim().length > 160);
    // 除纯数字页码外，拼音教学文字不得小于18磅。
    const undersizedText = textShapes.filter(
      (shape) => !/^\d+$/.test(shape.text.trim()) && shape.minSize !== null && shape.minSize < 1800,
    );
    // 原稿中的每组拼音和汉字都必须继续出现在目标页面。
    const missingPairs = expectedPinyinPairs(slideInfo).filter(
      (pair) => !nodes.includes(pair.pinyin) || !nodes.includes(pair.hanzi),
    );
    // 任一专项检查失败时记录具体证据。
    if (missingSections.length
      || leadingPunctuation.length
      || overDenseNodes.length
      || undersizedText.length
      || missingPairs.length) {
      issues.push({
        slide: slideInfo.source_slide,
        type: "pinyin_layout",
        missingSections,
        leadingPunctuation,
        overDenseNodeLengths: overDenseNodes.map((node) => node.length),
        undersizedText: undersizedText.map((shape) => ({ text: shape.text, pointSize: shape.minSize / 100 })),
        missingPairs,
      });
    }
  }
  // 返回全部拼音排版问题。
  return issues;
}

/**
 * 形成第2至16课的正式文件路径和拼音页清单。
 */
function buildLessonTarget(lesson) {
  // 字正腔圆页是拼音教材字形的专项检查范围，普通英文页面不参与替换判断。
  const pinyinSlides = lesson.source_slides
    .filter((slide) => slide.role === "字正腔圆")
    .map((slide) => slide.source_slide);
  // 输出路径严格复用生成器的课号、标题和批量稿命名。
  const output = path.join(
    OUTPUT_ROOT,
    `第${lesson.lesson}课`,
    "PPT排版",
    "批量稿",
    `少儿口才与表演中册第${String(lesson.lesson).padStart(2, "0")}课_${lesson.title}_严格重制版.pptx`,
  );
  // 返回统一结构，便于第一课和其余课程共用验证逻辑。
  return { ...lesson, pinyin_slides: pinyinSlides, output };
}

/**
 * 验证单课结构、模块、媒体、视觉多样性和拼音字形。
 */
async function validateLesson(lesson) {
  // 文件缺失属于硬失败，不能用目录存在代替成品完成。
  await fs.access(lesson.output);
  // 读取压缩包清单，作为页面、图片和音频部件的结构依据。
  const entries = execFileSync("unzip", ["-Z1", lesson.output], { encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);
  // 只统计正式页面XML，排除页面关系和母版。
  const slideEntries = entries
    .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry))
    .sort((left, right) => Number(left.match(/\d+/)[0]) - Number(right.match(/\d+/)[0]));
  // 页数必须和原稿覆盖清单完全一致。
  const slideCountMatches = slideEntries.length === lesson.source_slide_count;
  // 所有页面文字只读取一次，后续模块和字形检查共享结果。
  const slideTexts = new Map(
    slideEntries.map((entry) => [
      Number(entry.match(/slide(\d+)\.xml$/)[1]),
      extractSlideText(lesson.output, entry),
    ]),
  );
  // 第一课已由独立逐页脚本验证模块；第2至16课按覆盖清单逐页检查栏目标签。
  const missingRoles = lesson.source_slides
    ? lesson.source_slides
      .filter((slide) => REQUIRED_ROLES.has(slide.role))
      .filter((slide) => !String(slideTexts.get(slide.source_slide) || "").includes(slide.role))
      .map((slide) => ({ slide: slide.source_slide, role: slide.role }))
    : [];
  // 拼音页中英文a及其预组合声调字形均视为未完成教材字形转换。
  const legacyPinyinGlyphs = lesson.pinyin_slides
    .filter((slideNumber) => /[aāáǎà]/.test(String(slideTexts.get(slideNumber) || "")))
    .map((slideNumber) => ({ slide: slideNumber, text: slideTexts.get(slideNumber) }));
  // 只对原稿确实含a系列韵母的课程要求出现单层ɑ，避免误报ei、ui等课程。
  const sourceHasPinyinA = lesson.lesson === 1 || lesson.source_slides?.some(
    (slide) => slide.role === "字正腔圆"
      && /[aāáǎà]/.test(Object.values(slide).map((value) => String(value || "")).join("\n")),
  );
  // 已转换课程至少应在拼音页中出现一次ɑ。
  const hasTeachingAlpha = !sourceHasPinyinA || lesson.pinyin_slides.some(
    (slideNumber) => String(slideTexts.get(slideNumber) || "").includes("ɑ"),
  );
  // 拼音页还必须通过语义分区、行首标点、密度和音汉对应检查。
  const pinyinLayoutIssues = validatePinyinLayout(lesson, slideTexts, slideEntries);
  // 每课必须嵌入三段示例音频，保证播放、暂停和继续由PowerPoint媒体控件承担。
  const mp3Entries = entries.filter((entry) => /^ppt\/media\/.*\.mp3$/i.test(entry));
  // 只对较大的教学插图做摘要，排除Logo和透明播放按钮造成的重复噪声。
  const largeImageHashes = entries
    .filter((entry) => /^ppt\/media\/image\d+\.(png|jpe?g)$/i.test(entry))
    .map((entry) => readArchiveEntry(lesson.output, entry))
    .filter((buffer) => buffer.length >= 100000)
    .map((buffer) => crypto.createHash("sha256").update(buffer).digest("hex"));
  // 至少五张不同的大图，覆盖主题、情境、发音、口脑和表演，防止全课复用同一图。
  const uniqueLargeImages = new Set(largeImageHashes).size;
  // 汇总所有检查项，便于机器和人工共同审阅。
  const passed = slideCountMatches
    && missingRoles.length === 0
    && legacyPinyinGlyphs.length === 0
    && hasTeachingAlpha
    && pinyinLayoutIssues.length === 0
    && mp3Entries.length === 3
    && uniqueLargeImages >= 5;
  // 返回逐课证据，不只给出布尔结论。
  return {
    lesson: lesson.lesson,
    title: lesson.title,
    output: lesson.output,
    passed,
    expectedSlides: lesson.source_slide_count,
    actualSlides: slideEntries.length,
    missingRoles,
    pinyinSlides: lesson.pinyin_slides,
    legacyPinyinGlyphs: legacyPinyinGlyphs.map((item) => item.slide),
    requiresTeachingAlpha: Boolean(sourceHasPinyinA),
    hasTeachingAlpha,
    pinyinLayoutIssues,
    embeddedMp3: mp3Entries.length,
    uniqueLargeImages,
  };
}

// 完整读取第2至16课覆盖清单。
const coverage = JSON.parse(await fs.readFile(COVERAGE_FILE, "utf8"));
// 合并第一课和其余课程，形成全中册连续检查队列。
const lessons = [LESSON_ONE, ...coverage.map(buildLessonTarget)];
// 逐课执行验证，避免同时解压16个大文件造成内存峰值。
const results = [];
for (const lesson of lessons) {
  // 每课验证完成立即保留结果，单课失败时仍能定位具体原因。
  results.push(await validateLesson(lesson));
}
// 汇总失败课次，作为命令退出状态和返工入口。
const failedLessons = results.filter((result) => !result.passed).map((result) => result.lesson);
// 报告写入OPTION临时目录，供本轮验收和后续复查。
const reportPath = path.join(WORKSPACE, "中册第1至16课_结构模块音频拼音检测报告.json");
// 使用UTF-8和可读缩进保存完整证据。
await fs.writeFile(reportPath, `${JSON.stringify({ failedLessons, results }, null, 2)}\n`, "utf8");
// 控制台输出摘要，便于执行文档记录。
console.log(JSON.stringify({ reportPath, failedLessons, checkedLessons: results.length }, null, 2));
// 任一课程失败时返回非零状态，禁止把未通过检测的批次视为完成。
if (failedLessons.length) {
  process.exitCode = 1;
}
