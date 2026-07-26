import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

// 工具优先使用调用方显式传入的工程根，否则以当前工作目录作为当前工程。
const PROJECT_ROOT = path.resolve(process.env.SELPLAT_PROJECT_ROOT || process.cwd());
// 当前任务工作区承载音频封装中间包和无音频备份。
const WORKSPACE = path.join(PROJECT_ROOT, "OPTION/temp/口才与表演中册其余课程重制");
// 逐课清单用于精确定位情境再现、口脑风暴和粉墨登场页面。
const COVERAGE_FILE = path.join(PROJECT_ROOT, "apps/rule-engine/backend/src/main/resources/中文教学/template/口才与表演/中册/课程内容索引.json");
// 图片安全区映射决定每个音频栏目的文字组和播放按钮位于左侧还是右侧。
const SAFE_ZONE_FILE = path.join(PROJECT_ROOT, "apps/rule-engine/backend/src/main/resources/中文教学/template/口才与表演/中册/图片安全区映射.json");
// 示例音频已经从用户参考文件抽取到可复用缓存，正常运行不再反复解包原始PPT。
const AUDIO_CACHE_ROOT = path.join(PROJECT_ROOT, "cache/中文教学/口才与表演/中册/示例音频");
// 用户参考PPT是示例音频缓存缺失时的可追溯恢复来源。
const AUDIO_SOURCE = path.join(PROJECT_ROOT, "OPTION/temp/中文教学/0输入/1、口才与表演第一课.pptx");
// 正式中册成品根目录和生成器保持一致。
const OUTPUT_ROOT = path.join(PROJECT_ROOT, "OPTION/temp/中文教学/教学图片与PPT生成/项目/口才与表演/中册");
// 当前调用只处理一个明确课号，避免多个压缩包同时修改。
const requestedLesson = Number(process.argv[2]);
// 非法课号立即停止，防止覆盖其他资料。
if (!Number.isInteger(requestedLesson) || requestedLesson < 2 || requestedLesson > 16) {
  throw new Error("请传入2至16之间的课号。");
}
// 完整读取覆盖清单并找到当前课。
const coverage = JSON.parse(await fs.readFile(COVERAGE_FILE, "utf8"));
// 音频热区必须读取与生成器同一份安全区配置，禁止按奇偶页猜测位置。
const safeZoneMap = JSON.parse(await fs.readFile(SAFE_ZONE_FILE, "utf8"));
// 当前课内容提供主题、页数和角色定位。
const lesson = coverage.find((item) => item.lesson === requestedLesson);
// 缺失数据时禁止继续猜测封装。
if (!lesson) {
  throw new Error(`覆盖清单中不存在第${requestedLesson}课。`);
}
// 当前课两位编号与原创模块图片目录保持一致。
const lessonCode = String(requestedLesson).padStart(2, "0");
// 三个音频栏目分别绑定本课的模块专图。
const audioRoleAssets = {
  情境再现: `模块插图/第${lessonCode}课/情境观察.png`,
  口脑风暴: `模块插图/第${lessonCode}课/口脑风暴.png`,
  粉墨登场: `模块插图/第${lessonCode}课/粉墨登场.png`,
};
// 正式文件名与生成器输出保持完全一致。
const target = path.join(
  OUTPUT_ROOT,
  `第${requestedLesson}课`,
  "PPT排版",
  "批量稿",
  `少儿口才与表演中册第${String(requestedLesson).padStart(2, "0")}课_${lesson.title}_严格重制版.pptx`,
);
// 每次封装使用唯一目录，避免残留部件混入新PPTX。
const packageDir = path.join(WORKSPACE, `audio-package-lesson-${requestedLesson}-${Date.now()}`);
// 无音频版本保存在任务工作区，方便排查兼容问题。
const backup = path.join(WORKSPACE, `第${String(requestedLesson).padStart(2, "0")}课_无音频备份.pptx`);
// 透明玻璃按钮是用户确认的完整透明PNG。
const audioButton = path.join(PROJECT_ROOT, "cache/中文教学/口才与表演/中册/控件/音频按钮_透明玻璃.png");
// 三类音频页按旧稿角色定位，若同类出现多页则全部封装，不依赖固定页号。
const audioSlides = lesson.source_slides
  .filter((slide) => ["情境再现", "口脑风暴", "粉墨登场"].includes(slide.role))
  .map((slide, index) => {
    // 当前栏目图片必须存在安全区分析结果。
    const safeZone = safeZoneMap[audioRoleAssets[slide.role]];
    // 缺少映射时停止封装，避免真实热区与可见按钮错位。
    if (!safeZone || !["left", "right"].includes(safeZone.safeSide)) {
      throw new Error(`缺少音频栏目图片安全区：第${requestedLesson}课 ${slide.role}`);
    }
    // 返回与生成器卡片左边距加34像素完全一致的按钮位置。
    return {
      slide: slide.source_slide,
      buttonLeft: safeZone.safeSide === "left" ? 92 : 736,
      media: `lesson-${requestedLesson}-sample-audio-${index + 1}.mp3`,
      source: index % 2 === 1 ? "media2.mp3" : "media1.mp3",
    };
  });

/**
 * 向页面最上层加入与可见按钮完全重合的音频热区。
 */
function patchSlideXml(xml, shapeId, buttonLeft) {
  // 媒体热区读取当前页的可见按钮横坐标，保证左右交替版式仍完全重合。
  const left = buttonLeft * 9525;
  // 顶部位置换算为Open XML使用的EMU单位。
  const top = 622 * 9525;
  // 按钮宽度换算为EMU，点击区不向左右扩张。
  const width = 112 * 9525;
  // 按钮高度换算为EMU，避免遮挡页面推进区域。
  const height = 45 * 9525;
  // 音频对象使用PowerPoint原生媒体动作，第一次点击即播放或暂停。
  const audioPicture = `<p:pic><p:nvPicPr><p:cNvPr id="${shapeId}" name="播放"><a:hlinkClick xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="" action="ppaction://media"/></p:cNvPr><p:cNvPicPr><a:picLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></p:cNvPicPr><p:nvPr><a:audioFile xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:link="rIdLessonAudio"/><p:extLst><p:ext uri="{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}"><p14:media xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rIdLessonMedia"/></p:ext></p:extLst></p:nvPr></p:nvPicPr><p:blipFill><a:blip xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rIdLessonAudioIcon"/><a:stretch xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:off x="${left}" y="${top}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
  // 音频热区插入形状树末尾，确保按钮可点击但不影响其他对象。
  return xml.replace("</p:spTree>", `${audioPicture}</p:spTree>`);
}

/**
 * 为页面关系表增加音频、媒体和透明按钮三条关系。
 */
function patchRelationships(xml, mediaName) {
  // 所有关系使用包内相对路径，文件移动后仍可播放。
  const relationships = `<Relationship Id="rIdLessonAudio" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/audio" Target="../media/${mediaName}"/><Relationship Id="rIdLessonMedia" Type="http://schemas.microsoft.com/office/2007/relationships/media" Target="../media/${mediaName}"/><Relationship Id="rIdLessonAudioIcon" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/lesson-audio-button.png"/>`;
  // 保留原有图片、备注和布局关系，只追加当前页媒体。
  return xml.replace("</Relationships>", `${relationships}</Relationships>`);
}

/**
 * 确保示例音频缓存存在，缺失时从用户参考PPT恢复。
 */
async function ensureAudioCache() {
  // 缓存目录可能在首次运行或人工清理后不存在。
  await fs.mkdir(AUDIO_CACHE_ROOT, { recursive: true });
  // 两段音频分别记录目标缓存文件和参考PPT内部部件。
  const entries = [
    { file: "media1.mp3", sourceEntry: "ppt/media/media1.mp3" },
    { file: "media2.mp3", sourceEntry: "ppt/media/media2.mp3" },
  ];
  // 逐项检查缓存，已存在文件保持不变。
  for (const entry of entries) {
    // 当前缓存文件的绝对位置由工程根和固定相对路径派生。
    const cachedFile = path.join(AUDIO_CACHE_ROOT, entry.file);
    try {
      // 可读即视为缓存命中，不重复解包。
      await fs.access(cachedFile);
    } catch {
      // 缓存缺失时要求参考PPT仍存在，否则无法恢复并立即失败。
      await fs.access(AUDIO_SOURCE);
      // 只抽取声明的MP3部件，不展开参考页面和其他媒体。
      const bytes = execFileSync("unzip", ["-p", AUDIO_SOURCE, entry.sourceEntry], { encoding: null });
      // 空部件不得写入缓存，避免后续生成静音损坏文件。
      if (!bytes.length) {
        throw new Error(`参考PPT中的音频为空：${entry.sourceEntry}`);
      }
      // 将恢复的音频写入当前工程缓存，供以后持续复用。
      await fs.writeFile(cachedFile, bytes);
    }
  }
}

// 正式封装前先完成缓存检查和按需恢复。
await ensureAudioCache();
// 创建唯一封装目录并保存无音频底稿。
await fs.mkdir(packageDir, { recursive: true });
// 无音频备份覆盖同课旧备份，避免任务工作区无限累积。
await fs.copyFile(target, backup);
// 展开PPTX的Open XML部件。
execFileSync("unzip", ["-qq", target, "-d", packageDir]);
// 从当前工程可复用缓存读取两个示例MP3，避免每轮重复解包参考课件。
const sourceAudio = {
  // 第一段示例音频供第一个和第三个音频页独立复制。
  "media1.mp3": await fs.readFile(path.join(AUDIO_CACHE_ROOT, "media1.mp3")),
  // 第二段示例音频供中间音频页独立复制。
  "media2.mp3": await fs.readFile(path.join(AUDIO_CACHE_ROOT, "media2.mp3")),
};
// 将完整透明按钮复制为所有媒体对象共用的海报图。
await fs.copyFile(audioButton, path.join(packageDir, "ppt/media/lesson-audio-button.png"));
// 逐个页面写入独立示例音频，后续可分别替换。
for (const entry of audioSlides) {
  // 每个音频页拥有独立MP3，替换单页时不会联动其他页。
  await fs.writeFile(path.join(packageDir, "ppt/media", entry.media), sourceAudio[entry.source]);
  // 读取页面XML并计算未占用的形状ID。
  const slidePath = path.join(packageDir, "ppt/slides", `slide${entry.slide}.xml`);
  // 页面XML按UTF-8完整读取。
  const slideXml = await fs.readFile(slidePath, "utf8");
  // 现有形状ID用于生成唯一媒体对象ID。
  const existingIds = [...slideXml.matchAll(/<p:cNvPr[^>]*\sid="(\d+)"/g)].map((match) => Number(match[1]));
  // 新对象ID严格大于当前页所有形状ID。
  const shapeId = Math.max(1, ...existingIds) + 1;
  // 写回带媒体热区的页面XML。
  await fs.writeFile(slidePath, patchSlideXml(slideXml, shapeId, entry.buttonLeft), "utf8");
  // 读取当前页关系表并追加媒体关系。
  const relsPath = path.join(packageDir, "ppt/slides/_rels", `slide${entry.slide}.xml.rels`);
  // 关系表使用UTF-8完整读取。
  const relsXml = await fs.readFile(relsPath, "utf8");
  // 写回追加关系后的XML。
  await fs.writeFile(relsPath, patchRelationships(relsXml, entry.media), "utf8");
}
// 首次加入MP3时登记audio/mpeg内容类型。
const contentTypesPath = path.join(packageDir, "[Content_Types].xml");
// 完整读取内容类型表。
const contentTypes = await fs.readFile(contentTypesPath, "utf8");
// 只在缺失时追加MP3类型，避免重复声明。
if (!contentTypes.includes('Extension="mp3"')) {
  // 保留所有已有类型并追加音频类型。
  await fs.writeFile(
    contentTypesPath,
    contentTypes.replace("</Types>", '<Default Extension="mp3" ContentType="audio/mpeg"/></Types>'),
    "utf8",
  );
}
// 在封装目录内部重新压缩，避免将外层目录打入PPTX。
const patchedOutput = path.join(WORKSPACE, `第${String(requestedLesson).padStart(2, "0")}课_音频封装稿_${Date.now()}.pptx`);
// 重新生成标准PPTX压缩包。
execFileSync("zip", ["-q", "-r", patchedOutput, "."], { cwd: packageDir });
// 先做压缩结构验证，失败时不替换正式文件。
execFileSync("unzip", ["-tqq", patchedOutput]);
// 结构正确后原子式覆盖正式成品。
await fs.copyFile(patchedOutput, target);
// 输出当前课媒体页面，供后续结构检查。
console.log(JSON.stringify({
  lesson: requestedLesson,
  target,
  audioSlides: audioSlides.map((entry) => entry.slide),
  embeddedMedia: audioSlides.map((entry) => entry.media),
}, null, 2));
