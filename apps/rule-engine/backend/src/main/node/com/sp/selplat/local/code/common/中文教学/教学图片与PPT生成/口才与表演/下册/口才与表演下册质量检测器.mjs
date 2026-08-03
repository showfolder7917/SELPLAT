import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { inspectCommonDeckQuality } from "../通用/口才与表演通用质量检测核心.mjs";

// 检测器从调用方工作目录识别当前工程，保证跨任务页面仍检查正确成品。
const PROJECT_ROOT = path.resolve(process.env.SELPLAT_PROJECT_ROOT || process.cwd());
// 全量分析索引提供每课源页、截图和栏目基线。
const COVERAGE_PATH = path.join(PROJECT_ROOT, "apps/rule-engine/backend/src/main/resources/local/common/中文教学/template/口才与表演/下册/课程内容索引.json");
// 正式下册成品目录只读取保持原名的PPTX。
const OUTPUT_ROOT = path.join(PROJECT_ROOT, "OPTION/temp/中文教学/教学图片与PPT生成/成品/口才与表演/下册");
// 检测报告统一进入当前工程任务临时区。
const REPORT_ROOT = path.join(PROJECT_ROOT, "OPTION/temp/中文教学/下册制作分析");
// 生成器源码必须先通过准入检查，避免旧逻辑在下次批量生成时重新污染成品。
const GENERATOR_PATH = path.join(PROJECT_ROOT, "apps/rule-engine/backend/src/main/node/com/sp/selplat/local/code/common/中文教学/教学图片与PPT生成/口才与表演/下册/口才与表演下册PPT生成器.mjs");
// 第一课视觉计划用于核对中册式自然留白插画是否真正进入成品。
const LESSON_ONE_VISUAL_PLAN_PATH = path.join(PROJECT_ROOT, "apps/rule-engine/backend/src/main/resources/local/common/中文教学/template/口才与表演/下册/第01课视觉计划.json");
// 下册原创缓存是最终教学主视觉的唯一合法来源。
const ORIGINAL_ASSET_ROOT = path.join(PROJECT_ROOT, "cache/中文教学/口才与表演/下册/原创插图");
// 教材照片只参与哈希黑名单和教学事实核对，不允许进入最终媒体。
const SCREENSHOT_ROOT = path.join(PROJECT_ROOT, "OPTION/temp/中文教学/0输入/下册/下册截图");
// 品牌Logo属于已确认固定资产，不因旧稿也曾使用而误判为教学旧图复用。
const LOGO_PATH = path.join(PROJECT_ROOT, "apps/rule-engine/backend/src/main/resources/local/common/中文教学/assets/品牌/新思度华文学堂.png");
// 透明玻璃播放按钮属于已确认控件，不参与旧教学媒体黑名单。
const AUDIO_BUTTON_PATH = path.join(PROJECT_ROOT, "cache/中文教学/口才与表演/中册/控件/音频按钮_透明玻璃.png");
// 三个核心音频栏目是每课固定交互基线。
const AUDIO_ROLES = ["情境再现", "口脑风暴", "粉墨登场"];
// 关键教学板块必须从原稿延续到新版。
const CORE_ROLES = ["口才之歌", "情境再现", "字正腔圆", "口脑风暴", "粉墨登场", "课堂回顾", "结束页"];
// 旧PPT媒体和教材截图哈希在整册检查开始前统一建立。
const forbiddenOldMediaHashes = new Set();
// 已确认Logo与控件即使曾出现在旧稿中也允许继续使用。
const approvedFixedAssetHashes = new Set();

/**
 * 调用系统unzip读取PPTX内部指定文本部件。
 */
function readEntry(pptxPath, entry) {
  // Open XML文本统一按UTF-8读取。
  return execFileSync("unzip", ["-p", pptxPath, entry], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

/**
 * 调用系统unzip读取PPTX内部指定二进制部件。
 */
function readBinaryEntry(pptxPath, entry) {
  // 图片和音频必须按Buffer读取，禁止默认编码破坏内容。
  return execFileSync("unzip", ["-p", pptxPath, entry], {
    encoding: null,
    maxBuffer: 64 * 1024 * 1024,
  });
}

/**
 * 列出PPTX全部包内路径。
 */
function listEntries(pptxPath) {
  // 每行一个Open XML部件。
  return execFileSync("unzip", ["-Z1", pptxPath], { encoding: "utf8" })
    // 空行不参与后续统计。
    .split(/\r?\n/)
    // 保留有效部件名。
    .filter(Boolean);
}

/**
 * 从页面XML提取可见文字。
 */
function extractText(xml) {
  // 所有文本运行按页面出现顺序拼接。
  return [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
    // 常见XML实体还原为实际字符。
    .map((match) => match[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"))
    // 页面检查使用换行区分文本框。
    .join("\n");
}

/**
 * 从页面XML提取所有图片和媒体对象的坐标。
 */
function extractPictureBounds(xml) {
  // 每个图片对象独立解析，便于比较可见按钮和媒体热区。
  return [...xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)].flatMap((match) => {
    // 当前图片对象完整XML。
    const block = match[0];
    // 对象名称用于区分原生媒体热区。
    const name = block.match(/<p:cNvPr[^>]*\sname="([^"]*)"/)?.[1] || "";
    // 坐标由偏移和尺寸构成。
    const transform = block.match(/<a:off x="(\d+)" y="(\d+)"\s*\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\s*\/>/);
    // 无坐标对象无法检测重合关系。
    if (!transform) return [];
    // 返回稳定整数坐标。
    return [{
      name,
      x: Number(transform[1]),
      y: Number(transform[2]),
      cx: Number(transform[3]),
      cy: Number(transform[4]),
    }];
  });
}

/**
 * 提取带业务名称的文本框及其可用容量参数。
 */
function extractNamedTextBoxes(xml) {
  // 每个原生文本形状独立解析，检测字号缩水和底板内文字溢出。
  return [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].flatMap((match) => {
    // 当前文本形状完整XML。
    const block = match[0];
    // 业务名称用于区分正文、标题和教材拓展。
    const name = block.match(/<p:cNvPr[^>]*\sname="([^"]*)"/)?.[1] || "";
    // 只检查需要承担成段教学文字的正文框。
    if (!/^CONTENT_BODY$|^SUPPLEMENT_BODY_/u.test(name)) return [];
    // 文本框坐标与尺寸决定可用行宽和行高。
    const transform = block.match(/<a:off x="(\d+)" y="(\d+)"\s*\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\s*\/>/);
    // 无尺寸时由其他结构检查处理。
    if (!transform) return [];
    // 实际运行字号以最小值为准，防止局部自动缩字逃过检测。
    const fontSizes = [...block.matchAll(/\ssz="(\d+)"/g)].map((item) => Number(item[1]) / 100);
    // 未显式写入字号时无法做容量估算。
    if (!fontSizes.length) return [];
    // 行距百分比不存在时按常规1.3估算。
    const lineSpacing = Number(block.match(/<a:spcPct val="(\d+)"/)?.[1] || 130000) / 100000;
    // 返回检测所需的可见文字和几何信息。
    return [{
      name,
      text: extractText(block),
      width: Number(transform[3]) / 9525,
      height: Number(transform[4]) / 9525,
      fontSize: Math.min(...fontSizes),
      lineSpacing,
    }];
  });
}

/**
 * 估算文本框在当前字号下需要的视觉行数。
 */
function estimateVisualLineCount(text, width, fontSize) {
  // 左右内边距合计按32画布单位扣除，与生成器正文框保持一致。
  const usableWidth = Math.max(1, width - 32);
  // 中文全角字按字号宽度估算，保守系数避免渲染器字体差异造成漏报。
  const charsPerLine = Math.max(1, Math.floor(usableWidth / (fontSize * 0.95)));
  // 每个显式段落至少占一行，长段落按栏宽继续折行。
  return String(text || "")
    .split(/\n/)
    .filter((line) => line.length > 0)
    .reduce((sum, line) => sum + Math.max(1, Math.ceil([...line].length / charsPerLine)), 0);
}

/**
 * 按对象名称读取单个文本形状的可见文字。
 */
function extractShapeTextByName(xml, shapeName) {
  // 遍历页面文本形状并命中指定业务名称。
  const block = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)]
    .map((match) => match[0])
    .find((item) => new RegExp(`<p:cNvPr[^>]*\\sname="${shapeName}"`).test(item));
  // 未找到目标形状时返回空串，由其他结构规则判断缺失。
  return block ? extractText(block) : "";
}

/**
 * 按业务名称提取文本形状坐标，供拼音与汉字中心线检查。
 */
function extractTextShapeBounds(xml, shapeName) {
  // 逐个文本形状查找精确业务名称。
  const block = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)]
    .map((match) => match[0])
    .find((item) => new RegExp(`<p:cNvPr[^>]*\\sname="${shapeName}"`).test(item));
  // 缺少对象时返回空值，由调用方给出明确错误。
  if (!block) return null;
  // 坐标和尺寸必须同时存在。
  const transform = block.match(/<a:off x="(\d+)" y="(\d+)"\s*\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\s*\/>/);
  // 没有变换信息无法计算中心线。
  if (!transform) return null;
  // 返回原始EMU坐标，避免单位换算引入误差。
  return {
    x: Number(transform[1]),
    y: Number(transform[2]),
    cx: Number(transform[3]),
    cy: Number(transform[4]),
  };
}

/**
 * 把栏目名称归一为可比较的紧凑文本。
 */
function normalizeSectionLabel(text) {
  // “情景再现”与“情境再现”在旧稿中属于同一栏目，统一后再比较。
  return String(text || "").replace(/\s+/g, "").replace(/^情景再现/u, "情境再现");
}

/**
 * 对二进制内容计算稳定SHA-1，用于跨PPTX和缓存目录比较媒体来源。
 */
function hashBytes(bytes) {
  // 哈希只比较字节内容，不受文件名和包内路径影响。
  return crypto.createHash("sha1").update(bytes).digest("hex");
}

/**
 * 收集一个PPTX包内全部位图哈希。
 */
function collectPptxImageHashes(pptxPath) {
  // 只读取常见PNG和JPEG图片部件。
  return new Set(
    listEntries(pptxPath)
      .filter((entry) => /^ppt\/media\/.*\.(?:png|jpe?g)$/i.test(entry))
      .map((entry) => hashBytes(readBinaryEntry(pptxPath, entry))),
  );
}

/**
 * 在生成任何成品前审计生成器源码、截图映射和16课原创资产绑定。
 */
async function inspectGeneratorSource(coverage) {
  // 所有准入失败统一汇总，便于一次修正而不是逐次中断。
  const errors = [];
  // 生成器源码按UTF-8完整读取。
  const source = await fs.readFile(GENERATOR_PATH, "utf8");
  // 必须存在的架构标记证明生成器绑定原创缓存、结构化映射和空白画布。
  const requiredMarkers = [
    "ORIGINAL_ASSET_ROOT",
    "SUPPLEMENT_FACTS",
    "addOriginalVisual",
    "Presentation.create",
    '"theme"',
    '"practice"',
    '"storyboard"',
    // 下册生成器必须接入全册共用布局核心。
    "buildSceneLayout",
    // 图文语义必须在生成阶段执行硬门禁。
    "assertSemanticCoverage",
    // 册别适配器必须按图片声明读取自然留白侧。
    "lessonOneVisualPlans",
  ];
  // 逐个检查关键入口。
  for (const marker of requiredMarkers) {
    // 缺少入口说明生成器未完成新链路迁移。
    if (!source.includes(marker)) errors.push(`生成器缺少必需入口：${marker}。`);
  }
  // 禁止模式覆盖旧PPT最大图、源视觉对象和教材截图二进制直入。
  const forbiddenPatterns = [
    ["readLargestSlideImage", /readLargestSlideImage/],
    ["SOURCE_VISUAL", /SOURCE_VISUAL/],
    ["教材截图二进制直读", /fs\.readFile\(\s*path\.join\(PROJECT_ROOT,\s*supplement\.source_path\)/],
    ["教材截图图片对象", /name:\s*`SUPPLEMENT_\$\{supplement\.order\}`/],
  ];
  // 每个禁止模式命中都属于生成器硬错误。
  for (const [label, pattern] of forbiddenPatterns) {
    // 禁止只在运行时绕开而仍保留可回退分支。
    if (pattern.test(source)) errors.push(`生成器仍包含禁止入口：${label}。`);
  }
  // 输入截图文件集合来自覆盖清单，必须恰好58张且不能依赖人工记忆。
  const expectedFiles = coverage.flatMap((lesson) => lesson.supplements.map((item) => item.file)).sort();
  // 生成器结构化映射键从SUPPLEMENT_FACTS对象中提取。
  const mappedFiles = [...source.matchAll(/"(\d+\.JPG)"\s*:/g)].map((match) => match[1]).sort();
  // 集合大小不一致时直接报告，避免后续“部分映射”被当成完成。
  if (mappedFiles.length !== expectedFiles.length) {
    errors.push(`截图结构化映射数量异常：期望${expectedFiles.length}，实际${mappedFiles.length}。`);
  }
  // 逐文件验证映射集合相等。
  for (const file of expectedFiles) {
    // 每张截图都必须在生成器映射中出现一次。
    if (!mappedFiles.includes(file)) errors.push(`生成器缺少截图结构化映射：${file}。`);
  }
  // 重复映射会造成课程页重复或错配。
  if (new Set(mappedFiles).size !== mappedFiles.length) errors.push("生成器存在重复截图映射键。");
  // 每课必须具有主题、练习、故事板和四个独立模块场景，质量基准不得低于中册。
  for (let lesson = 1; lesson <= 16; lesson += 1) {
    // 课次目录使用稳定两位编号。
    const lessonDir = path.join(ORIGINAL_ASSET_ROOT, `第${String(lesson).padStart(2, "0")}课`);
    // 七个资产缺一不可，禁止重新回退成“四张图轮换整课”。
    for (const file of ["主题底图.png", "课堂练习.png", "模块故事板.png", "场景1.png", "场景2.png", "场景3.png", "场景4.png"]) {
      // 缺图时记录完整课次和文件名。
      try {
        await fs.access(path.join(lessonDir, file));
      } catch {
        errors.push(`第${lesson}课缺少原创资产：${file}。`);
      }
    }
    // 第一课样稿还必须具备四张中册式16:9自然留白语义插画。
    if (lesson === 1) {
      // 补图文件由视觉计划稳定声明，禁止检测器和生成器各维护一份文件名。
      const visualPlans = JSON.parse(await fs.readFile(LESSON_ONE_VISUAL_PLAN_PATH, "utf8"));
      // 非基础资产逐一检查缓存存在性。
      for (const plan of Object.values(visualPlans)) {
        // 基础主题图和练习图已经在七类资产检查中覆盖。
        if (["主题底图.png", "课堂练习.png"].includes(plan.asset)) continue;
        // 缺少任何补图都会使第一课重新退化为少图版本。
        try {
          await fs.access(path.join(lessonDir, plan.asset));
        } catch {
          errors.push(`第1课缺少中册式语义插画：${plan.asset}。`);
        }
      }
    }
  }
  // 返回生成器准入结果供整册报告置顶展示。
  return { status: errors.length ? "failed" : "passed", mappedScreenshotCount: mappedFiles.length, errors };
}

/**
 * 对一课最终PPTX执行结构、内容、截图、音频和视觉静态检测。
 */
async function inspectLesson(lesson) {
  // 成品文件名必须与原稿完全一致。
  const expectedName = path.basename(lesson.source_file);
  // 当前课正式输出路径。
  const pptxPath = path.join(OUTPUT_ROOT, expectedName);
  // 所有失败原因统一记录并在整册末尾决定退出码。
  const errors = [];
  // 警告用于记录需要人工看图的非硬错误。
  const warnings = [];
  // 文件必须存在且可读。
  try {
    await fs.access(pptxPath);
  } catch {
    return {
      lesson: lesson.lesson,
      title: lesson.title,
      file: pptxPath,
      errors: ["缺少最终PPTX。"],
      warnings,
    };
  }
  // 压缩包完整性是所有后续检查的前置条件。
  try {
    execFileSync("unzip", ["-tqq", pptxPath]);
  } catch {
    return {
      lesson: lesson.lesson,
      title: lesson.title,
      file: pptxPath,
      errors: ["PPTX压缩包结构损坏。"],
      warnings,
    };
  }
  // 包内路径用于统计页面、媒体和关系。
  const entries = listEntries(pptxPath);
  // 只统计标准页面XML。
  const slideEntries = entries
    .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry))
    // 页面按数字顺序检查，禁止字符串排序把第10页放到第1页后。
    .sort((left, right) => Number(left.match(/slide(\d+)/)[1]) - Number(right.match(/slide(\d+)/)[1]));
  // 源PPT中的教材提示页和“图一、图二”编号页都属于同一批截图教学单元的旧占位表达。
  const replacedSourceCount = lesson.source_slides.filter((slide) => {
    // 学习导航属于旧课件目录页，不再作为最终教学页面。
    if (slide.role === "学习导航") return true;
    // 原始提示语由对应的结构化教材拓展页替代。
    if (/请看教材|教材第\s*\d+\s*页/.test(slide.source_text)) return true;
    // 纯图片编号页不具备独立教学内容，已有补充截图时不得重复计入最低页数。
    return lesson.supplements.length > 0
      && /^图[一二三四五六七八九十\d]+$/u.test(
        String(slide.source_text || "")
          // PowerPoint默认占位文字不属于教学内容，必须先清理后识别图片编号页。
          .replace(/此处添加标题/g, "")
          // 换行和空格不会改变“图一”等占位语义。
          .replace(/\s+/g, ""),
      );
  }).length;
  // 每张截图展开为一页；最低页数按有效原稿模块加结构化补充模块计算，避免把被替换的占位页重复计数。
  const minimumSlides = lesson.source_slide_count - replacedSourceCount + lesson.supplements.length;
  // 页数不足直接说明存在模块或截图遗漏。
  if (slideEntries.length < minimumSlides) {
    errors.push(`输出页数不足：最低${minimumSlides}页，实际${slideEntries.length}页。`);
  }
  // 逐页XML完整读入，供多个检查复用。
  const slides = slideEntries.map((entry) => {
    // 页面编号从部件名解析。
    const number = Number(entry.match(/slide(\d+)/)[1]);
    // 页面XML按UTF-8读取。
    const xml = readEntry(pptxPath, entry);
    // 可见文字提前抽取。
    return { number, entry, xml, text: extractText(xml) };
  });
  // 全部页面先通过三册共用质量核心，几何重叠、动态字号、长文分段和拼音中心线均为硬门禁。
  errors.push(...inspectCommonDeckQuality(slides));
  // 全课文字用于残留占位和板块检查。
  const allText = slides.map((slide) => slide.text).join("\n");
  // 旧模板占位栏目不得出现在面向学生的成品中。
  if (/学习导航|内容页/u.test(allText)) {
    errors.push("仍残留“学习导航”或“内容页”模板术语。");
  }
  // 自动分页不得使用“续1/续2”这类生成器痕迹。
  if (/[（(]续\d+[）)]/u.test(allText)) {
    errors.push("仍存在“续N”自动分页标题。");
  }
  // 清理旧模板动作词后不得留下独立前导标点，避免出现“，你看到什么？”之类残句。
  if (slides.some((slide) => /^[，,、；;：:。！？!?]/u.test(
    extractShapeTextByName(slide.xml, "CONTENT_BODY").trim(),
  ))) {
    errors.push("正文仍存在由旧模板提示词清理产生的前导标点。");
  }
  // 所有教材页码提示必须已被实际截图页替换。
  if (/请看教材|教材第\s*\d+\s*页/.test(allText)) {
    errors.push("仍残留“请看教材第N页”占位提示。");
  }
  // 模板占位字符不是可交付教学内容，成品只能保留可现场填写的下划线。
  if (/X{2,}/iu.test(allText)) {
    errors.push("仍残留XXX模板占位符，必须改为可填写下划线或真实教学内容。");
  }
  // 旧通用兜底句无法证明图文语义一致，最终稿不得用它冒充逐页教学设计。
  if (/观察画面，?说一说你发现了什么/u.test(allText)) {
    errors.push("仍存在无逐页语义的通用观察占位句，必须按当前模块和图片内容改写。");
  }
  // 原稿存在的核心角色必须在最终稿中可见。
  for (const role of CORE_ROLES) {
    // 某些极端原稿可能缺少当前角色，因此只要求原稿已存在的角色。
    const required = lesson.source_slides.some((slide) => slide.role === role);
    // 原稿有而成品没有时属于模块遗漏。
    if (required && !allText.includes(role)) errors.push(`缺少核心板块：${role}。`);
  }
  // 每页右上栏目名用于检查不允许重复的单页模块。
  const sectionNames = slides.map((slide) => normalizeSectionLabel(extractShapeTextByName(slide.xml, "SECTION_NAME")));
  // 统一口才之歌采用一页双栏完整呈现，不得因正文切分而复制出多页相同歌词。
  const songSlideCount = slides.filter(
    (slide) => normalizeSectionLabel(extractShapeTextByName(slide.xml, "CONTENT_TITLE")) === "口才之歌",
  ).length;
  // 原稿每课只有一页口才之歌，成品必须保持一页且内容完整。
  if (songSlideCount !== 1) errors.push(`口才之歌页面数量异常：期望1页，实际${songSlideCount}页。`);
  // 第一课课前热身必须在单页中完成，禁止逐句拆页。
  if (lesson.lesson === 1) {
    // 课前热身包含口才之歌，因此用“先认识一下吧”标题精准识别自我介绍页。
    const warmupSlideCount = slides.filter(
      (slide) => extractShapeTextByName(slide.xml, "CONTENT_TITLE").includes("先认识一下吧"),
    ).length;
    // 自我介绍只能生成一页。
    if (warmupSlideCount !== 1) errors.push(`课前自我介绍页面数量异常：期望1页，实际${warmupSlideCount}页。`);
    // 阅读延伸页必须使用真实篇名标题，禁止模板层级与右上“字正腔圆”栏目重叠。
    const pronunciationIntroCount = slides.filter(
      (slide) => extractShapeTextByName(slide.xml, "CONTENT_TITLE").includes("我多想出去看看"),
    ).length;
    // 第一课只有一张阅读延伸页，缺失说明生成器仍在复用模板层级作正文标题。
    if (pronunciationIntroCount !== 1) {
      errors.push(`阅读延伸篇名标题异常：期望1页，实际${pronunciationIntroCount}页。`);
    }
    // 简单收束页不得使用大面积通用文字底板。
    for (const slide of slides) {
      // 右上栏目用于识别课堂回顾和结束页。
      const section = normalizeSectionLabel(extractShapeTextByName(slide.xml, "SECTION_NAME"));
      // 命中收束页仍存在TEXT_CARD时说明视觉层级退化。
      if (["课堂回顾", "结束页"].includes(section) && slide.xml.includes('name="TEXT_CARD"')) {
        errors.push(`第${slide.number}页${section}仍使用大面积空白文字底板。`);
      }
    }
    // 第一课清理导航与占位页后页数应与有效模块数量完全一致，额外页通常意味着不合理拆分。
    if (slideEntries.length !== minimumSlides) {
      errors.push(`第一课存在不合理增页或漏页：期望${minimumSlides}页，实际${slideEntries.length}页。`);
    }
    // 第一页主题图必须完整覆盖16:9画布。
    const coverPicture = extractPictureBounds(slides[0].xml)
      // artifact-tool导出图片时可能不保留业务名称，因此用面积最大的图片识别封面主视觉。
      .sort((left, right) => right.cx * right.cy - left.cx * left.cy)[0];
    // 画布尺寸按1280×720和每像素9525EMU换算。
    const fullCanvas = { x: 0, y: 0, cx: 1280 * 9525, cy: 720 * 9525 };
    // 缺少图片或任一边不贴画布都视为封面未铺满。
    const fullBleedTolerance = 9525;
    // contain模式允许因源图比例产生不超过1像素的居中留白，但不得形成可见边框。
    if (!coverPicture || !Object.keys(fullCanvas).every(
      (key) => Math.abs(coverPicture[key] - fullCanvas[key]) <= fullBleedTolerance,
    )) {
      errors.push("第一课封面主题图没有完整铺满16:9画布。");
    }
  }
  // 字正腔圆页面单独进入拼音教材字形检测，普通英文页面不参与。
  const pinyinSlides = slides.filter((slide, index) => sectionNames[index] === "字正腔圆");
  // 英文双层a及其预组合声调字形不得残留在拼音教学对象中。
  for (const slide of pinyinSlides) {
    if (/[aāáǎà]/u.test(slide.text)) errors.push(`第${slide.number}页字正腔圆仍含英文a字形。`);
  }
  // 原稿确实包含a系列韵母时，成品必须出现教材单层ɑ，防止简单删除规避检测。
  const sourceRequiresTeachingAlpha = lesson.source_slides.some(
    (slide) => slide.role === "字正腔圆" && /[aāáǎà]/u.test(slide.source_text),
  );
  // 任一拼音页出现单层ɑ即可证明该课转换链已生效。
  if (sourceRequiresTeachingAlpha && !pinyinSlides.some((slide) => slide.text.includes("ɑ"))) {
    errors.push("字正腔圆缺少教材单层ɑ字形。");
  }
  // 第一课专用拼音页必须让每组拼音与汉字共用同一横向中心线。
  if (lesson.lesson === 1) {
    // 通过业务对象名找到包含四组拼音的页面。
    const alignedPinyinSlide = slides.find((slide) => extractTextShapeBounds(slide.xml, "PINYIN_1"));
    // 缺少专用结构说明仍在依赖空格或自动换行排版。
    if (!alignedPinyinSlide) {
      errors.push("第一课缺少结构化拼音对齐页面。");
    } else {
      // 四组拼音逐一与对应汉字比较横向中心点。
      for (let index = 1; index <= 4; index += 1) {
        // 当前拼音对象坐标。
        const pinyin = extractTextShapeBounds(alignedPinyinSlide.xml, `PINYIN_${index}`);
        // 当前汉字对象坐标。
        const hanzi = extractTextShapeBounds(alignedPinyinSlide.xml, `HANZI_${index}`);
        // 两个对象都必须存在。
        if (!pinyin || !hanzi) {
          errors.push(`第一课拼音第${index}组缺少拼音或汉字对象。`);
          continue;
        }
        // 横向中心必须完全一致，禁止使用空格模拟对齐。
        if (pinyin.x * 2 + pinyin.cx !== hanzi.x * 2 + hanzi.cx) {
          errors.push(`第一课拼音第${index}组与汉字中心线错位。`);
        }
      }
    }
  }
  // 每张教材截图在生成器中对应一个“教材拓展”页。
  const supplementSlides = slides.filter((slide) => slide.text.includes("教材拓展"));
  // 生成页数量必须覆盖当前课全部截图。
  if (supplementSlides.length !== lesson.supplements.length) {
    errors.push(`教材截图页数量异常：期望${lesson.supplements.length}页，实际${supplementSlides.length}页。`);
  }
  // 汉字之间的异常空格会造成标题和短语视觉破碎。
  for (const slide of slides) {
    // 当前页新生成的栏目标题用于精准判断正文是否重复旧栏目名。
    const contentTitle = normalizeSectionLabel(extractShapeTextByName(slide.xml, "CONTENT_TITLE"));
    // 只检查同一文本运行中的连续汉字空格。
    if (/(?<=\p{Script=Han})[ \u3000]+(?=\p{Script=Han})/u.test(slide.text)) {
      errors.push(`第${slide.number}页存在汉字间异常空格。`);
    }
    // 孤立书名号或只剩标点的文本框属于列表破碎。
    if (/(^|\n)\s*[《》、；，。]\s*(\n|$)/.test(slide.text)) {
      errors.push(`第${slide.number}页存在孤立书名号或标点。`);
    }
    // 图文正文和教材拓展正文逐框检查业务语义；字号、容量和相交由三册共用核心统一裁决。
    for (const box of extractNamedTextBoxes(slide.xml)) {
      // 正文开头再次出现当前页栏目名说明旧模板标题未清理，会与新标题重复。
      if (contentTitle && normalizeSectionLabel(box.text).startsWith(contentTitle)) {
        errors.push(`第${slide.number}页${box.name}仍包含重复栏目标题。`);
      }
    }
  }
  // 包内MP3按当前课独立文件名筛选。
  const mp3Entries = entries.filter((entry) => new RegExp(`^ppt/media/lesson-${lesson.lesson}-\\d+\\.mp3$`).test(entry));
  // 三个栏目必须有三个独立音频部件。
  if (mp3Entries.length !== AUDIO_ROLES.length) {
    errors.push(`独立音频数量异常：期望3个，实际${mp3Entries.length}个。`);
  }
  // 音频页面用于检查栏目覆盖和热区重合。
  const audioSlides = slides.filter((slide) => slide.xml.includes('action="ppaction://media"'));
  // 每课必须恰好三个原生媒体页面。
  if (audioSlides.length !== AUDIO_ROLES.length) {
    errors.push(`音频页面数量异常：期望3页，实际${audioSlides.length}页。`);
  }
  // 三个音频栏目逐一命中一个媒体页面。
  for (const role of AUDIO_ROLES) {
    // 原生媒体页以右上角真实栏目名为准，不再要求正文重复栏目标题。
    const matches = audioSlides.filter((slide) =>
      normalizeSectionLabel(extractShapeTextByName(slide.xml, "SECTION_NAME")) === role);
    // 数量不是1说明遗漏或重复嵌入。
    if (matches.length !== 1) errors.push(`栏目“${role}”音频页面数量异常：${matches.length}。`);
  }
  // 每个媒体热区必须与底部可见按钮完全重合。
  for (const slide of audioSlides) {
    // 页面所有图片对象包括主视觉、Logo、可见按钮和原生媒体对象。
    const pictures = extractPictureBounds(slide.xml);
    // 原生媒体对象名称固定为“播放”。
    const mediaBounds = pictures.find((picture) => picture.name === "播放");
    // 底部小图中排除媒体对象后得到可见玻璃按钮。
    const visibleButton = pictures.find((picture) =>
      picture.name !== "播放"
      && picture.y >= 5_700_000
      && picture.cx <= 2_000_000
      && picture.cy <= 700_000);
    // 任一对象缺失都无法保证单击区域。
    if (!mediaBounds || !visibleButton) {
      errors.push(`第${slide.number}页缺少媒体热区或可见播放按钮。`);
      continue;
    }
    // 四个坐标必须完全一致，禁止左右扩大造成翻页困难。
    const sameBounds = ["x", "y", "cx", "cy"].every((key) => mediaBounds[key] === visibleButton[key]);
    // 不重合时记录硬错误。
    if (!sameBounds) errors.push(`第${slide.number}页音频热区与可见按钮不重合。`);
  }
  // 所有普通图片部件计算内容哈希，用于发现整课只重复同一主图。
  const imageEntries = entries.filter((entry) => /^ppt\/media\/.*\.(?:png|jpe?g)$/i.test(entry));
  // 透明按钮和固定Logo重复不应降低主视觉多样性。
  const imageHashes = imageEntries
    // 固定按钮海报图从内容多样性统计排除。
    .filter((entry) => !/audio-button/i.test(entry))
    // 每个图片按真实字节计算SHA-1。
    .map((entry) => hashBytes(readBinaryEntry(pptxPath, entry)));
  // 包内图片哈希集合用于核对七类原创素材是否真正进入成品，而不是只存在缓存目录。
  const packagedImageHashes = new Set(imageHashes);
  // 当前课七类业务视觉与缓存文件建立稳定映射，避免依赖PPT库可能丢弃的对象名称。
  const visualRoleFiles = {
    theme: "主题底图.png",
    practice: "课堂练习.png",
    storyboard: "模块故事板.png",
    scene1: "场景1.png",
    scene2: "场景2.png",
    scene3: "场景3.png",
    scene4: "场景4.png",
  };
  // 第一课额外核对四张按正文释义生成的中册式自然留白插画。
  if (lesson.lesson === 1) {
    // 视觉计划作为唯一文件名来源，避免检测规则与资源索引错配。
    const visualPlans = JSON.parse(await fs.readFile(LESSON_ONE_VISUAL_PLAN_PATH, "utf8"));
    // 基础角色不重复写入，新增角色按计划键纳入媒体哈希检测。
    for (const [role, plan] of Object.entries(visualPlans)) {
      if (!(role in visualRoleFiles)) visualRoleFiles[role] = plan.asset;
    }
  }
  // 当前课原创缓存目录按两位课次定位。
  const lessonAssetDir = path.join(ORIGINAL_ASSET_ROOT, `第${String(lesson.lesson).padStart(2, "0")}课`);
  // 实际使用角色由缓存文件内容哈希与PPT包内图片哈希相交得到。
  const usedVisualRoles = new Set();
  // 逐角色核对素材，确保七类视觉不是“文件存在但生成器未使用”。
  for (const [role, file] of Object.entries(visualRoleFiles)) {
    // 缓存图片字节哈希不受PPT内部重命名影响。
    const assetHash = hashBytes(await fs.readFile(path.join(lessonAssetDir, file)));
    // 成品包内存在相同字节时记录该角色已实际使用。
    if (packagedImageHashes.has(assetHash)) usedVisualRoles.add(role);
  }
  // 中册同等级要求每课覆盖七类不同教学语义；第一课的分享故事图已替代无专项语义的scene1。
  const requiredVisualRoles = Object.keys(visualRoleFiles)
    // 第一课使用更精准的分享故事和分苹果场景替代无专项语义的scene1、scene4。
    .filter((role) => !(lesson.lesson === 1 && ["scene1", "scene4"].includes(role)));
  // 任一视觉角色未进入成品都属于生成器缩水。
  for (const role of requiredVisualRoles) {
    if (!usedVisualRoles.has(role)) errors.push(`成品未使用必需视觉角色：${role}。`);
  }
  // 最终媒体若与旧PPT或教材截图字节相同，说明生成器仍发生了旧资产回退。
  const reusedOldHashes = [...new Set(imageHashes)].filter((hash) =>
    forbiddenOldMediaHashes.has(hash) && !approvedFixedAssetHashes.has(hash));
  // 任一旧教学媒体命中都必须返工。
  if (reusedOldHashes.length) errors.push(`发现${reusedOldHashes.length}个旧PPT或教材截图媒体哈希复用。`);
  // 唯一图片数量过少说明可能把同一图用于全部页面。
  const uniqueImageCount = new Set(imageHashes).size;
  // 七类业务视觉加固定Logo至少形成八个唯一图片内容。
  if (uniqueImageCount < 8) errors.push(`主视觉多样性不足：仅${uniqueImageCount}个唯一图片内容，最低要求8个。`);
  // 相同内容占比过高时发出人工检查警告。
  const frequency = new Map();
  // 汇总每个图片哈希出现次数。
  imageHashes.forEach((hash) => frequency.set(hash, (frequency.get(hash) || 0) + 1));
  // 每页固定出现的Logo属于页面标识，不参与主视觉重复率判断。
  const contentFrequencies = [...frequency.values()].filter((count) => count < slideEntries.length);
  // 最大重复次数只反映非全页固定资产的滥用程度。
  const maxRepeat = Math.max(0, ...contentFrequencies);
  // 任一业务图片超过总页数18%说明仍在跨模块滥用；至少保证约六页更换一次独立语义画面。
  const repeatLimit = Math.max(3, Math.ceil(slideEntries.length * 0.18));
  // 超过阈值属于硬错误，不再只依赖人工查看。
  if (maxRepeat > repeatLimit) errors.push(`单一图片重复过多：最多重复${maxRepeat}次，阈值${repeatLimit}次。`);
  // 页面较少但内容完整的课程仍需人工查看联系表，不作为自动失败。
  if (slideEntries.length < lesson.source_slide_count) {
    warnings.push("输出页数少于原稿页数，请人工确认占位页替换和空白页清理合理。");
  }
  // 返回当前课完整检测摘要。
  return {
    lesson: lesson.lesson,
    title: lesson.title,
    file: pptxPath,
    sourceSlides: lesson.source_slide_count,
    outputSlides: slideEntries.length,
    minimumSlides,
    supplements: lesson.supplements.length,
    supplementSlides: supplementSlides.length,
    audioSlides: audioSlides.map((slide) => slide.number),
    mp3Entries,
    uniqueImageCount,
    maxRepeat,
    usedVisualRoles: [...usedVisualRoles].sort(),
    reusedOldMediaCount: reusedOldHashes.length,
    errors,
    warnings,
  };
}

// 覆盖索引按UTF-8完整读取。
const coverage = JSON.parse(await fs.readFile(COVERAGE_PATH, "utf8"));
// 整册必须恰好包含16课。
if (coverage.length !== 16) throw new Error(`下册覆盖索引课数异常：${coverage.length}`);
// 命令行允许指定单课返工检测；未指定时仍执行整册质量门禁。
const requested = process.argv[2] || "all";
// 单课模式只缩小成品检测范围，不缩减生成器和资源准入审计。
const selectedCoverage = requested === "all"
  ? coverage
  : coverage.filter((lesson) => lesson.lesson === Number(requested));
// 非法课次必须明确失败，禁止生成空报告。
if (!selectedCoverage.length) throw new Error(`覆盖索引中不存在检测课次：${requested}`);
// 生成器准入在读取成品前执行，防止旧逻辑凭历史文件误通过。
const generatorAudit = await inspectGeneratorSource(coverage);
// 固定Logo哈希加入允许列表。
approvedFixedAssetHashes.add(hashBytes(await fs.readFile(LOGO_PATH)));
// 播放按钮存在时加入允许列表，缓存缺失由生成器原生形状回退。
try {
  approvedFixedAssetHashes.add(hashBytes(await fs.readFile(AUDIO_BUTTON_PATH)));
} catch {
  // 缺少按钮由后续页面控件检查直接暴露，无需在这里重复报错。
}
// 16份源PPT包内图片全部加入旧媒体黑名单。
for (const sourceFile of new Set(coverage.map((lesson) => lesson.source_file))) {
  // 源文件路径由课程索引相对工程根定位。
  const sourcePath = path.join(PROJECT_ROOT, sourceFile);
  // 每个包内媒体哈希合并到全册黑名单。
  for (const hash of collectPptxImageHashes(sourcePath)) forbiddenOldMediaHashes.add(hash);
}
// 58张教材截图原文件全部加入旧媒体黑名单。
for (const lesson of selectedCoverage) {
  // 当前课逐张处理，确保覆盖清单中的每个输入都被纳入。
  for (const supplement of lesson.supplements) {
    // 截图哈希按真实字节计算，与扩展名大小写无关。
    forbiddenOldMediaHashes.add(hashBytes(await fs.readFile(path.join(SCREENSHOT_ROOT, supplement.file))));
  }
}
// 报告目录按需创建。
await fs.mkdir(REPORT_ROOT, { recursive: true });
// 所有课程依次执行，单课错误继续收集以便一次修完。
const lessons = [];
// 逐课调用结构检测；单课返工只能审计已选择课程，禁止把其他历史成品误计入当前结果。
for (const lesson of selectedCoverage) {
  // 当前检测范围内的课程结果追加到报告。
  lessons.push(await inspectLesson(lesson));
}
// 整册错误汇总决定最终状态。
const errorCount = generatorAudit.errors.length + lessons.reduce((sum, lesson) => sum + lesson.errors.length, 0);
// 整册警告汇总用于人工视觉复核。
const warningCount = lessons.reduce((sum, lesson) => sum + lesson.warnings.length, 0);
// JSON报告供自动流程复用。
const jsonReport = {
  status: errorCount === 0 ? "passed" : "failed",
  generatorAudit,
  lessonCount: lessons.length,
  sourceSlideCount: selectedCoverage.reduce((sum, lesson) => sum + lesson.source_slide_count, 0),
  outputSlideCount: lessons.reduce((sum, lesson) => sum + (lesson.outputSlides || 0), 0),
  supplementCount: selectedCoverage.reduce((sum, lesson) => sum + lesson.supplements.length, 0),
  errorCount,
  warningCount,
  lessons,
};
// JSON报告写入任务临时区。
// 单课和整册使用不同报告名，避免样稿复核覆盖正式整册历史结果。
const reportStem = requested === "all" ? "下册整册质量检测报告" : `下册第${String(requested).padStart(2, "0")}课质量检测报告`;
// JSON报告写入当前检测范围对应的稳定文件。
await fs.writeFile(
  path.join(REPORT_ROOT, `${reportStem}.json`),
  `${JSON.stringify(jsonReport, null, 2)}\n`,
  "utf8",
);
// Markdown报告便于用户和执行文档直接查看。
const markdownRows = lessons.map((lesson) =>
  `| ${lesson.lesson} | ${lesson.sourceSlides || "-"} | ${lesson.outputSlides || "-"} | ${lesson.supplements || "-"} | ${lesson.audioSlides?.length || 0} | ${lesson.errors.length} | ${lesson.warnings.length} |`);
// 报告正文包含整册汇总和逐课结果。
const markdown = [
  `# 少儿口才与表演${requested === "all" ? "下册整册" : `下册第${String(requested).padStart(2, "0")}课`}质量检测报告`,
  "",
  `- 状态：${jsonReport.status}`,
  `- 生成器准入：${generatorAudit.status}`,
  `- 生成器映射截图：${generatorAudit.mappedScreenshotCount}`,
  `- 课程：${jsonReport.lessonCount}`,
  `- 源页：${jsonReport.sourceSlideCount}`,
  `- 成品页：${jsonReport.outputSlideCount}`,
  `- 教材截图：${jsonReport.supplementCount}`,
  `- 错误：${jsonReport.errorCount}`,
  `- 警告：${jsonReport.warningCount}`,
  "",
  "## 生成器准入",
  "",
  ...(generatorAudit.errors.length ? generatorAudit.errors.map((error) => `- 错误：${error}`) : ["- 错误：无"]),
  "",
  "| 课次 | 源页 | 成品页 | 截图 | 音频页 | 错误 | 警告 |",
  "|---:|---:|---:|---:|---:|---:|---:|",
  ...markdownRows,
  "",
  ...lessons.flatMap((lesson) => [
    `## 第${lesson.lesson}课 ${lesson.title}`,
    "",
    ...(lesson.errors.length ? lesson.errors.map((error) => `- 错误：${error}`) : ["- 错误：无"]),
    ...(lesson.warnings.length ? lesson.warnings.map((warning) => `- 警告：${warning}`) : ["- 警告：无"]),
    "",
  ]),
].join("\n");
// Markdown报告按UTF-8写入。
await fs.writeFile(path.join(REPORT_ROOT, `${reportStem}.md`), `${markdown}\n`, "utf8");
// 控制台输出精简摘要供长任务观察。
console.log(JSON.stringify({
  status: jsonReport.status,
  generatorAudit: generatorAudit.status,
  mappedScreenshotCount: generatorAudit.mappedScreenshotCount,
  lessonCount: jsonReport.lessonCount,
  sourceSlideCount: jsonReport.sourceSlideCount,
  outputSlideCount: jsonReport.outputSlideCount,
  supplementCount: jsonReport.supplementCount,
  errorCount,
  warningCount,
}, null, 2));
// 任一硬错误都让进程失败，禁止后续流程误标记完成。
if (errorCount > 0) process.exitCode = 1;
