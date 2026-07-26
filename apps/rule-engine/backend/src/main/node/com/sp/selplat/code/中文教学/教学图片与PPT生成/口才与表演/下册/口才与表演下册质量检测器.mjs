import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

// 检测器从调用方工作目录识别当前工程，保证跨任务页面仍检查正确成品。
const PROJECT_ROOT = path.resolve(process.env.SELPLAT_PROJECT_ROOT || process.cwd());
// 全量分析索引提供每课源页、截图和栏目基线。
const COVERAGE_PATH = path.join(PROJECT_ROOT, "apps/rule-engine/backend/src/main/resources/中文教学/template/口才与表演/下册/课程内容索引.json");
// 正式下册成品目录只读取保持原名的PPTX。
const OUTPUT_ROOT = path.join(PROJECT_ROOT, "OPTION/temp/中文教学/教学图片与PPT生成/成品/口才与表演/下册");
// 检测报告统一进入当前工程任务临时区。
const REPORT_ROOT = path.join(PROJECT_ROOT, "OPTION/temp/中文教学/下册制作分析");
// 生成器源码必须先通过准入检查，避免旧逻辑在下次批量生成时重新污染成品。
const GENERATOR_PATH = path.join(PROJECT_ROOT, "apps/rule-engine/backend/src/main/node/com/sp/selplat/code/中文教学/教学图片与PPT生成/口才与表演/下册/口才与表演下册PPT生成器.mjs");
// 下册原创缓存是最终教学主视觉的唯一合法来源。
const ORIGINAL_ASSET_ROOT = path.join(PROJECT_ROOT, "cache/中文教学/口才与表演/下册/原创插图");
// 教材照片只参与哈希黑名单和教学事实核对，不允许进入最终媒体。
const SCREENSHOT_ROOT = path.join(PROJECT_ROOT, "OPTION/temp/中文教学/0输入/下册/下册截图");
// 品牌Logo属于已确认固定资产，不因旧稿也曾使用而误判为教学旧图复用。
const LOGO_PATH = path.join(PROJECT_ROOT, "apps/rule-engine/backend/src/main/resources/中文教学/assets/品牌/新思度华文学堂.png");
// 透明玻璃播放按钮属于已确认控件，不参与旧教学媒体黑名单。
const AUDIO_BUTTON_PATH = path.join(PROJECT_ROOT, "cache/中文教学/口才与表演/中册/控件/音频按钮_透明玻璃.png");
// 三个核心音频栏目是每课固定交互基线。
const AUDIO_ROLES = ["情境再现", "口脑风暴", "粉墨登场"];
// 关键教学板块必须从原稿延续到新版。
const CORE_ROLES = ["口才之歌", "学习导航", "情境再现", "字正腔圆", "口脑风暴", "粉墨登场", "课堂回顾", "结束页"];
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
  const requiredMarkers = ["ORIGINAL_ASSET_ROOT", "SUPPLEMENT_FACTS", "addOriginalVisual", "Presentation.create"];
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
  // 每课必须具有故事板和四个独立场景。
  for (let lesson = 1; lesson <= 16; lesson += 1) {
    // 课次目录使用稳定两位编号。
    const lessonDir = path.join(ORIGINAL_ASSET_ROOT, `第${String(lesson).padStart(2, "0")}课`);
    // 五个资产缺一不可。
    for (const file of ["模块故事板.png", "场景1.png", "场景2.png", "场景3.png", "场景4.png"]) {
      // 缺图时记录完整课次和文件名。
      try {
        await fs.access(path.join(lessonDir, file));
      } catch {
        errors.push(`第${lesson}课缺少原创资产：${file}。`);
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
  // 全课文字用于残留占位和板块检查。
  const allText = slides.map((slide) => slide.text).join("\n");
  // 所有教材页码提示必须已被实际截图页替换。
  if (/请看教材|教材第\s*\d+\s*页/.test(allText)) {
    errors.push("仍残留“请看教材第N页”占位提示。");
  }
  // 原稿存在的核心角色必须在最终稿中可见。
  for (const role of CORE_ROLES) {
    // 某些极端原稿可能缺少当前角色，因此只要求原稿已存在的角色。
    const required = lesson.source_slides.some((slide) => slide.role === role);
    // 原稿有而成品没有时属于模块遗漏。
    if (required && !allText.includes(role)) errors.push(`缺少核心板块：${role}。`);
  }
  // 每张教材截图在生成器中对应一个“教材拓展”页。
  const supplementSlides = slides.filter((slide) => slide.text.includes("教材拓展"));
  // 生成页数量必须覆盖当前课全部截图。
  if (supplementSlides.length !== lesson.supplements.length) {
    errors.push(`教材截图页数量异常：期望${lesson.supplements.length}页，实际${supplementSlides.length}页。`);
  }
  // 汉字之间的异常空格会造成标题和短语视觉破碎。
  for (const slide of slides) {
    // 只检查同一文本运行中的连续汉字空格。
    if (/(?<=\p{Script=Han})[ \u3000]+(?=\p{Script=Han})/u.test(slide.text)) {
      errors.push(`第${slide.number}页存在汉字间异常空格。`);
    }
    // 孤立书名号或只剩标点的文本框属于列表破碎。
    if (/(^|\n)\s*[《》、；，。]\s*(\n|$)/.test(slide.text)) {
      errors.push(`第${slide.number}页存在孤立书名号或标点。`);
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
    // 当前栏目页面同时包含右上栏目名和正文标题。
    const matches = audioSlides.filter((slide) => slide.text.split(role).length - 1 >= 2);
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
  // 最终媒体若与旧PPT或教材截图字节相同，说明生成器仍发生了旧资产回退。
  const reusedOldHashes = [...new Set(imageHashes)].filter((hash) =>
    forbiddenOldMediaHashes.has(hash) && !approvedFixedAssetHashes.has(hash));
  // 任一旧教学媒体命中都必须返工。
  if (reusedOldHashes.length) errors.push(`发现${reusedOldHashes.length}个旧PPT或教材截图媒体哈希复用。`);
  // 唯一图片数量过少说明可能把同一图用于全部页面。
  const uniqueImageCount = new Set(imageHashes).size;
  // 下册每课至少应有Logo、封面视觉和多个模块视觉。
  if (uniqueImageCount < 6) errors.push(`主视觉多样性不足：仅${uniqueImageCount}个唯一图片内容。`);
  // 相同内容占比过高时发出人工检查警告。
  const frequency = new Map();
  // 汇总每个图片哈希出现次数。
  imageHashes.forEach((hash) => frequency.set(hash, (frequency.get(hash) || 0) + 1));
  // 每页固定出现的Logo属于页面标识，不参与主视觉重复率判断。
  const contentFrequencies = [...frequency.values()].filter((count) => count < slideEntries.length);
  // 最大重复次数只反映非全页固定资产的滥用程度。
  const maxRepeat = Math.max(0, ...contentFrequencies);
  // 超过页面总数一半时属于明显错配。
  if (maxRepeat > slideEntries.length / 2) errors.push(`单一图片重复过多：最多重复${maxRepeat}次。`);
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
    reusedOldMediaCount: reusedOldHashes.length,
    errors,
    warnings,
  };
}

// 覆盖索引按UTF-8完整读取。
const coverage = JSON.parse(await fs.readFile(COVERAGE_PATH, "utf8"));
// 整册必须恰好包含16课。
if (coverage.length !== 16) throw new Error(`下册覆盖索引课数异常：${coverage.length}`);
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
for (const lesson of coverage) {
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
// 逐课调用结构检测。
for (const lesson of coverage) {
  // 当前课结果追加到整册报告。
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
  sourceSlideCount: coverage.reduce((sum, lesson) => sum + lesson.source_slide_count, 0),
  outputSlideCount: lessons.reduce((sum, lesson) => sum + (lesson.outputSlides || 0), 0),
  supplementCount: coverage.reduce((sum, lesson) => sum + lesson.supplements.length, 0),
  errorCount,
  warningCount,
  lessons,
};
// JSON报告写入任务临时区。
await fs.writeFile(
  path.join(REPORT_ROOT, "下册整册质量检测报告.json"),
  `${JSON.stringify(jsonReport, null, 2)}\n`,
  "utf8",
);
// Markdown报告便于用户和执行文档直接查看。
const markdownRows = lessons.map((lesson) =>
  `| ${lesson.lesson} | ${lesson.sourceSlides || "-"} | ${lesson.outputSlides || "-"} | ${lesson.supplements || "-"} | ${lesson.audioSlides?.length || 0} | ${lesson.errors.length} | ${lesson.warnings.length} |`);
// 报告正文包含整册汇总和逐课结果。
const markdown = [
  "# 少儿口才与表演下册整册质量检测报告",
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
await fs.writeFile(path.join(REPORT_ROOT, "下册整册质量检测报告.md"), `${markdown}\n`, "utf8");
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
