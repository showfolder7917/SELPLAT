import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

// 能力从调用方工作目录识别当前工程，避免写入其他工程的成品目录。
const PROJECT_ROOT = path.resolve(process.env.SELPLAT_PROJECT_ROOT || process.cwd());
// 下册正式成品目录只保存保持原名的最终PPTX。
const OUTPUT_ROOT = path.join(PROJECT_ROOT, "OPTION/temp/中文教学/教学图片与PPT生成/成品/口才与表演/下册");
// 音频封装中间包统一写入当前工程任务临时区。
const WORK_ROOT = path.join(PROJECT_ROOT, "OPTION/temp/中文教学/下册制作分析/audio-package");
// 两段通用示例音频从工程缓存复用，后续可逐页替换。
const AUDIO_CACHE_ROOT = path.join(PROJECT_ROOT, "cache/中文教学/口才与表演/中册/示例音频");
// 已确认的透明玻璃播放按钮作为原生媒体对象海报图。
const AUDIO_BUTTON_PATH = path.join(PROJECT_ROOT, "cache/中文教学/口才与表演/中册/控件/音频按钮_透明玻璃.png");
// 命令行可处理单课，也可用all连续处理整册。
const requested = process.argv[2] || "all";
// 只有这三个教学栏目需要内嵌独立音频。
const AUDIO_ROLES = ["情境再现", "口脑风暴", "粉墨登场"];

/**
 * 读取PPTX内部文件列表并计算最终页数。
 */
function countSlides(pptxPath) {
  // 只统计标准页面XML，排除页面关系文件。
  const listing = execFileSync("unzip", ["-Z1", pptxPath], { encoding: "utf8" });
  // 页面编号可能超过两位，因此使用完整数字匹配。
  return listing.split(/\r?\n/).filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry)).length;
}

/**
 * 从页面XML中提取所有可见文字，用于识别最终成品中的教学栏目。
 */
function extractText(xml) {
  // 页面文字按出现顺序拼接，便于同时识别右上栏目名和正文标题。
  return [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
    // XML实体在栏目名中通常不存在，仍处理常见字符保证比较稳定。
    .map((match) => match[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"))
    // 空片段不参与栏目判断。
    .filter(Boolean)
    // 连续文字用换行隔开，避免相邻词误拼接。
    .join("\n");
}

/**
 * 定位页面底部已经显示的透明玻璃按钮，媒体热区必须与它完全重合。
 */
function findVisibleButtonBounds(xml) {
  // 每个图片对象独立检查，避免把主视觉图片误当播放按钮。
  const pictureBlocks = [...xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)].map((match) => match[0]);
  // 候选按钮位于页面下方且尺寸明显小于主视觉。
  const candidates = pictureBlocks.flatMap((block) => {
    // 图片坐标由Open XML的偏移和尺寸定义。
    const transform = block.match(/<a:off x="(\d+)" y="(\d+)"\s*\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\s*\/>/);
    // 无坐标图片无法作为点击热区。
    if (!transform) return [];
    // 坐标保持EMU整数，写回时不做二次缩放。
    const bounds = {
      x: Number(transform[1]),
      y: Number(transform[2]),
      cx: Number(transform[3]),
      cy: Number(transform[4]),
    };
    // 下册按钮位于约634像素高度，且宽高远小于内容图片。
    const isBottomControl = bounds.y >= 5_700_000 && bounds.cx <= 2_000_000 && bounds.cy <= 700_000;
    // 只返回符合页面底部控件特征的图片。
    return isBottomControl ? [bounds] : [];
  });
  // 生成器每个音频页只有一个底部播放按钮。
  return candidates[0] || null;
}

/**
 * 在可见按钮上方追加PowerPoint原生媒体对象。
 */
function patchSlideXml(xml, shapeId, bounds) {
  // 媒体对象海报图与现有按钮精确同宽同高，不向左右扩大。
  const audioPicture = `<p:pic><p:nvPicPr><p:cNvPr id="${shapeId}" name="播放"><a:hlinkClick xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="" action="ppaction://media"/></p:cNvPr><p:cNvPicPr><a:picLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></p:cNvPicPr><p:nvPr><a:audioFile xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:link="rIdLowerAudio"/><p:extLst><p:ext uri="{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}"><p14:media xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rIdLowerMedia"/></p:ext></p:extLst></p:nvPr></p:nvPicPr><p:blipFill><a:blip xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rIdLowerAudioIcon"/><a:stretch xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:off x="${bounds.x}" y="${bounds.y}"/><a:ext cx="${bounds.cx}" cy="${bounds.cy}"/></a:xfrm><a:prstGeom xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
  // 原生媒体对象放在形状树末尾，单击按钮即可播放或暂停。
  return xml.replace("</p:spTree>", `${audioPicture}</p:spTree>`);
}

/**
 * 为当前页面追加音频、媒体和海报图关系。
 */
function patchRelationships(xml, mediaName) {
  // 三条关系都使用包内相对路径，移动PPTX后仍能播放。
  const relationships = `<Relationship Id="rIdLowerAudio" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/audio" Target="../media/${mediaName}"/><Relationship Id="rIdLowerMedia" Type="http://schemas.microsoft.com/office/2007/relationships/media" Target="../media/${mediaName}"/><Relationship Id="rIdLowerAudioIcon" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/lower-audio-button.png"/>`;
  // 保留页面已有图片、布局和备注关系，只在末尾追加媒体关系。
  return xml.replace("</Relationships>", `${relationships}</Relationships>`);
}

/**
 * 为一份下册成品嵌入三个独立音频。
 */
async function embedDeck(pptxPath, lessonNumber) {
  // 当前课使用唯一展开目录，避免上一次封装残留进入新文件。
  const packageDir = path.join(WORK_ROOT, `lesson-${String(lessonNumber).padStart(2, "0")}-${Date.now()}`);
  // 封装后的临时PPTX先做结构验证再替换正式文件。
  const patchedOutput = path.join(WORK_ROOT, `lesson-${String(lessonNumber).padStart(2, "0")}-patched-${Date.now()}.pptx`);
  // 创建当前课工作目录。
  await fs.mkdir(packageDir, { recursive: true });
  // 展开PPTX全部Open XML部件。
  execFileSync("unzip", ["-qq", pptxPath, "-d", packageDir]);
  // 海报图写入包内媒体目录并由三个音频页复用。
  await fs.copyFile(AUDIO_BUTTON_PATH, path.join(packageDir, "ppt/media/lower-audio-button.png"));
  // 两段音频完整读入内存，分别复制成三个独立媒体文件。
  const sourceAudio = [
    await fs.readFile(path.join(AUDIO_CACHE_ROOT, "media1.mp3")),
    await fs.readFile(path.join(AUDIO_CACHE_ROOT, "media2.mp3")),
  ];
  // 最终页数以生成后的PPTX为准，不能使用原稿固定页码。
  const slideCount = countSlides(pptxPath);
  // 命中页面记录用于质量检测和执行报告。
  const audioSlides = [];
  // 从第一页开始扫描最终栏目名。
  for (let slideNumber = 1; slideNumber <= slideCount; slideNumber += 1) {
    // 当前页面XML位于标准slides目录。
    const slidePath = path.join(packageDir, "ppt/slides", `slide${slideNumber}.xml`);
    // 页面XML按UTF-8完整读取。
    const slideXml = await fs.readFile(slidePath, "utf8");
    // 当前页面可见文字用于精准识别教学角色。
    const text = extractText(slideXml);
    // 只有正文标题完全命中三类角色时才嵌入音频，学习导航页不命中。
    const role = AUDIO_ROLES.find((candidate) => new RegExp(`(^|\\n)${candidate}(\\n|$)`).test(text));
    // 同一页面必须至少出现两次角色名，分别来自栏目标签和正文标题。
    const roleCount = role ? text.split(role).length - 1 : 0;
    // 导航页只在列表中出现一次，因此不加入音频。
    if (!role || roleCount < 2) continue;
    // 可见按钮边界由页面XML直接读取，保证点击区不遮挡空白翻页区。
    const bounds = findVisibleButtonBounds(slideXml);
    // 缺少可见按钮属于生成链路错误，禁止生成隐形大热区。
    if (!bounds) throw new Error(`第${lessonNumber}课第${slideNumber}页未找到可见播放按钮。`);
    // 每个音频页使用独立文件名，后续可逐页替换真实录音。
    const mediaName = `lesson-${lessonNumber}-${audioSlides.length + 1}.mp3`;
    // 两段示例音频交替使用，但输出文件彼此独立。
    await fs.writeFile(path.join(packageDir, "ppt/media", mediaName), sourceAudio[audioSlides.length % sourceAudio.length]);
    // 已有形状ID用于生成当前页唯一媒体对象ID。
    const existingIds = [...slideXml.matchAll(/<p:cNvPr[^>]*\sid="(\d+)"/g)].map((match) => Number(match[1]));
    // 媒体对象ID严格大于页面现有全部对象。
    const shapeId = Math.max(1, ...existingIds) + 1;
    // 页面写入与按钮完全重合的媒体对象。
    await fs.writeFile(slidePath, patchSlideXml(slideXml, shapeId, bounds), "utf8");
    // 页面关系表追加当前音频关系。
    const relsPath = path.join(packageDir, "ppt/slides/_rels", `slide${slideNumber}.xml.rels`);
    // 原有关系按UTF-8完整读取。
    const relsXml = await fs.readFile(relsPath, "utf8");
    // 关系表保留原内容并追加媒体关系。
    await fs.writeFile(relsPath, patchRelationships(relsXml, mediaName), "utf8");
    // 保存栏目、页码和文件名供检测器核对。
    audioSlides.push({ slide: slideNumber, role, media: mediaName, bounds });
  }
  // 每课必须恰好命中三个核心音频栏目。
  if (audioSlides.length !== AUDIO_ROLES.length) {
    throw new Error(`第${lessonNumber}课音频页数量异常：期望3页，实际${audioSlides.length}页。`);
  }
  // 内容类型表用于让PowerPoint识别MP3部件。
  const contentTypesPath = path.join(packageDir, "[Content_Types].xml");
  // 完整读取包内容类型。
  const contentTypes = await fs.readFile(contentTypesPath, "utf8");
  // 首次加入MP3时登记audio/mpeg，已有声明则保持原样。
  if (!contentTypes.includes('Extension="mp3"')) {
    // 新类型追加在Types结束标签前。
    await fs.writeFile(
      contentTypesPath,
      contentTypes.replace("</Types>", '<Default Extension="mp3" ContentType="audio/mpeg"/></Types>'),
      "utf8",
    );
  }
  // 在展开目录内部重新压缩为标准PPTX。
  execFileSync("zip", ["-q", "-r", patchedOutput, "."], { cwd: packageDir });
  // 压缩包结构验证通过后才允许覆盖正式成品。
  execFileSync("unzip", ["-tqq", patchedOutput]);
  // 正式文件原子式替换为带音频版本。
  await fs.copyFile(patchedOutput, pptxPath);
  // 返回当前课音频封装摘要。
  return { lesson: lessonNumber, pptxPath, audioSlides };
}

// 正式封装前确保缓存音频和透明按钮都可读取。
await Promise.all([
  fs.access(path.join(AUDIO_CACHE_ROOT, "media1.mp3")),
  fs.access(path.join(AUDIO_CACHE_ROOT, "media2.mp3")),
  fs.access(AUDIO_BUTTON_PATH),
]);
// 成品目录中的PPTX按自然文件名顺序读取。
const allFiles = (await fs.readdir(OUTPUT_ROOT))
  // 只处理PPTX，忽略artifact-tool辅助检查文件。
  .filter((file) => /\.pptx$/i.test(file))
  // 中文数字文件名按locale自然排序。
  .sort((left, right) => left.localeCompare(right, "zh-CN", { numeric: true }));
// 单课模式从文件名前缀筛选目标。
const targets = requested === "all"
  ? allFiles
  : allFiles.filter((file) => file.startsWith(`${Number(requested)}、`));
// 找不到目标时立即失败，避免空跑被误判为完成。
if (!targets.length) throw new Error(`未找到待封装下册成品：${requested}`);
// 工作根按需创建。
await fs.mkdir(WORK_ROOT, { recursive: true });
// 所有目标按课次连续处理。
const results = [];
// 文件顺序对应课程顺序。
for (const file of targets) {
  // 文件名前缀就是课号。
  const lessonNumber = Number(file.match(/^(\d+)、/)?.[1]);
  // 非标准名称禁止猜测课号。
  if (!Number.isInteger(lessonNumber)) throw new Error(`无法从文件名识别课号：${file}`);
  // 当前课完成后记录结果。
  results.push(await embedDeck(path.join(OUTPUT_ROOT, file), lessonNumber));
  // 控制台输出逐课进度，便于长任务观察。
  console.log(`[下册音频] 第${String(lessonNumber).padStart(2, "0")}课完成`);
}
// 最终输出整册摘要供检测器复用。
console.log(JSON.stringify({ status: "completed", results }, null, 2));
