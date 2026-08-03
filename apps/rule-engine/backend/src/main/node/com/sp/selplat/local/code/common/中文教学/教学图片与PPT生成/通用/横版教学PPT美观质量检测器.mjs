import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

// 第一个命令行参数是待验收的最终PPTX，检测器不接受目录或中间工程。
const pptx = path.resolve(process.argv[2] || "");
// 第二个参数可选，用于提供逐页图文语义、底板和音频控件期望。
const manifestPath = process.argv[3] ? path.resolve(process.argv[3]) : null;
// 缺少正式文件参数时立即失败，避免输出没有业务意义的空报告。
if (!process.argv[2]) {
  throw new Error("请传入待检测PPTX路径。");
}
// 正式检测前确认PPTX可读。
await fs.access(pptx);
// 有专项清单时完整读取；没有清单时仍执行通用文字和底板检查。
const manifest = manifestPath
  ? JSON.parse(await fs.readFile(manifestPath, "utf8"))
  : { slides: {} };
// 画布尺寸使用生成器统一的1280×720像素换算到Open XML EMU。
const SLIDE_WIDTH = 1280 * 9525;
// 画布高度用于计算底板占用率。
const SLIDE_HEIGHT = 720 * 9525;
// 汉字范围用于识别旧稿抽取后残留的异常字间空格。
const CJK = "[\\u3400-\\u9FFF]";

/**
 * 从PPTX压缩包读取明确部件，避免把临时解包文件写到源码或资源目录。
 */
function readEntry(entry) {
  // 系统解包工具按原始字节返回页面XML。
  return execFileSync("unzip", ["-p", pptx, entry], { maxBuffer: 128 * 1024 * 1024 }).toString("utf8");
}

/**
 * 从PPTX读取二进制媒体部件，供实际嵌入图片摘要比对。
 */
function readEntryBuffer(entry) {
  // 图片按原始字节读取，禁止通过重新编码后再比较。
  return execFileSync("unzip", ["-p", pptx, entry], { maxBuffer: 128 * 1024 * 1024 });
}

/**
 * 将XML实体还原成可见字符，保证中文内容检查基于实际展示文本。
 */
function decodeXml(value) {
  // 依次还原常见DrawingML实体。
  return String(value || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

/**
 * 提取页面全部可见文本节点及显式字号。
 */
function textRuns(xml) {
  // 每个文本运行保留所在运行属性，便于读取百分之一磅字号。
  return [...xml.matchAll(/<a:r>([\s\S]*?)<\/a:r>/g)].map((runMatch) => {
    // 当前运行的可见文字来自a:t节点。
    const text = decodeXml([...runMatch[1].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
      .map((match) => match[1])
      .join(""));
    // 运行属性中的字号单位为百分之一磅。
    const size = Number(runMatch[1].match(/\bsz="(\d+)"/)?.[1] || 0);
    // 返回文字和字号证据。
    return { text, size };
  }).filter((run) => run.text.trim());
}

/**
 * 提取页面图片的对象名称和替代说明，作为图文语义绑定证据。
 */
function imageLabels(xml) {
  // 所有图片对象的非视觉属性都位于cNvPr节点。
  return [...xml.matchAll(/<p:pic>[\s\S]*?<p:cNvPr\b([^>]*)>/g)].map((match) => {
    // 对象名可以记录媒体角色。
    const name = decodeXml(match[1].match(/\bname="([^"]*)"/)?.[1]);
    // 替代说明由生成器写入具体资源语义。
    const description = decodeXml(match[1].match(/\bdescr="([^"]*)"/)?.[1]);
    // 合并两类标签供关键字匹配。
    return `${name} ${description}`.trim();
  });
}

/**
 * 统计覆盖较大面积的圆角底板，区分必要文字卡和纯装饰小组件。
 */
function largeBackplates(xml) {
  // 每个普通形状分别读取几何类型和尺寸。
  return [...xml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)].map((shapeMatch) => {
    // 只把圆角矩形视为候选文字底板。
    const isRoundRect = /<a:prstGeom\b[^>]*prst="roundRect"/.test(shapeMatch[1]);
    // 形状尺寸来自当前变换节点。
    const extent = shapeMatch[1].match(/<a:ext\b[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
    // 缺少尺寸或不是圆角矩形时占用率记为零。
    const ratio = isRoundRect && extent
      ? (Number(extent[1]) * Number(extent[2])) / (SLIDE_WIDTH * SLIDE_HEIGHT)
      : 0;
    // 返回面积比例，供必要性门禁判断。
    return ratio;
  }).filter((ratio) => ratio >= 0.12);
}

/**
 * 提取文本框的可见文字、字号和页面边界，用于检查局部字号与人物避让。
 */
function textShapes(xml) {
  // 每个普通形状独立保留文本和变换信息，避免只看整页文字而漏掉单个偏移文本框。
  return [...xml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)].map((shapeMatch) => {
    // 当前文本框全部可见文字用于按教学关键词定位。
    const text = decodeXml([...shapeMatch[1].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
      .map((match) => match[1])
      .join(""));
    // 文本框左上角和尺寸来自同一形状的变换节点。
    const offset = shapeMatch[1].match(/<a:off\b[^>]*x="(\d+)"[^>]*y="(\d+)"/);
    const extent = shapeMatch[1].match(/<a:ext\b[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
    // 只读取实际文字运行字号；段落结束标记的默认字号不代表屏幕上正文大小。
    const sizes = textRuns(shapeMatch[1])
      .map((run) => run.size / 100)
      .filter((size) => size > 0);
    // 缺少文字或边界的形状不进入文本布局检查。
    if (!text.trim() || !offset || !extent) return null;
    // Open XML坐标按每像素9525 EMU换算回生成器画布像素。
    const left = Number(offset[1]) / 9525;
    const top = Number(offset[2]) / 9525;
    const width = Number(extent[1]) / 9525;
    const height = Number(extent[2]) / 9525;
    // 返回局部布局证据供清单复用。
    return {
      text,
      left,
      top,
      right: left + width,
      bottom: top + height,
      minimumPoint: sizes.length ? Math.min(...sizes) : 0,
    };
  }).filter(Boolean);
}

/**
 * 检查单页通用文字、美观、底板、语义和音频控件约束。
 */
async function inspectSlide(slideNumber, xml, expected = {}) {
  // 当前页全部文本运行形成字号和碎片检查依据。
  const runs = textRuns(xml);
  // 合并可见文字便于检查占位提示和专项关键字。
  const fullText = runs.map((run) => run.text).join("\n");
  // 图片标签用于判断插图是否解释当前教学文本。
  const labels = imageLabels(xml);
  // 文本框级证据用于检测局部字号、左右偏移和图片主体侵入。
  const shapeEvidence = textShapes(xml);
  // 汇总当前页失败原因。
  const errors = [];
  // 页码、栏目和单字符发音对象不参与通用正文最小字号检查。
  const undersized = runs.filter((run) => run.size > 0
    && run.size < 1600
    && !/^\d{1,2}$/.test(run.text.trim())
    && !/^(课前热身|学习导航|主题导入|情境再现|字正腔圆|口脑风暴|粉墨登场|句子宝库|拓展训练|课堂回顾|小任务)$/.test(run.text.trim()));
  // 20磅以下正文会在课堂投影环境中失去可读性。
  if (undersized.length) {
    errors.push({
      type: "undersized_text",
      evidence: undersized.map((run) => ({ text: run.text, pointSize: run.size / 100 })),
    });
  }
  // 汉字之间的空格通常来自旧稿人工字距或抽取碎片。
  const spacedCjk = new RegExp(`${CJK}(?:[ \\t]+${CJK}){2,}`, "u").test(fullText);
  // 正常词语不得通过插入空格制造字距。
  if (spacedCjk) {
    errors.push({ type: "abnormal_cjk_spacing" });
  }
  // 独立序号、书名号或标点节点说明列表和篇名尚未恢复语义结构。
  const orphanNodes = runs
    .map((run) => run.text.trim())
    .filter((text) => /^(?:\d+[.、]|[《》、，。；：！？])$/.test(text));
  // 任一孤立节点都判为排版失败。
  if (orphanNodes.length) {
    errors.push({ type: "orphan_text_fragment", evidence: orphanNodes });
  }
  // 教材页提示已被对应内容吸收，不得继续出现在正式课件。
  if (/请看教材|教材第\s*\d+\s*页/.test(fullText)) {
    errors.push({ type: "obsolete_text_prompt" });
  }
  // 统计当前页的大型圆角底板。
  const backplates = largeBackplates(xml);
  // 明确禁止底板的自然留白页不得出现占据12%以上画布的大卡片。
  if (expected.backplate === "forbidden" && backplates.length) {
    errors.push({ type: "unnecessary_backplate", evidence: backplates });
  }
  // 明确要求底板的高密度页必须至少有一块可读性保护区域。
  if (expected.backplate === "required" && !backplates.length) {
    errors.push({ type: "missing_required_backplate" });
  }
  // 专项文本关键字必须全部保留。
  const missingTextKeywords = (expected.textKeywords || []).filter((keyword) => !fullText.includes(keyword));
  // 缺少教学内容关键字说明重制时发生遗漏或错页。
  if (missingTextKeywords.length) {
    errors.push({ type: "missing_text_semantics", evidence: missingTextKeywords });
  }
  // 专项清单可以用教学关键词定位具体文本框，并复用通用字号和安全区检查。
  for (const layoutRule of expected.textLayout || []) {
    // 命中任一关键词的文本框都属于本条规则的目标对象。
    const matchedShapes = shapeEvidence.filter((shape) =>
      (layoutRule.keywords || []).some((keyword) => shape.text.includes(keyword)));
    // 找不到目标文本说明清单与页面内容已经错配。
    if (!matchedShapes.length) {
      errors.push({ type: "missing_text_layout_target", evidence: layoutRule.keywords || [] });
      continue;
    }
    // 目标正文必须达到页面类型指定的投影阅读字号。
    const undersizedTargets = matchedShapes.filter((shape) =>
      Number(layoutRule.minimumPoint) > 0 && shape.minimumPoint < Number(layoutRule.minimumPoint));
    if (undersizedTargets.length) {
      errors.push({
        type: "context_undersized_text",
        evidence: undersizedTargets.map((shape) => ({
          text: shape.text,
          pointSize: shape.minimumPoint,
          requiredPointSize: Number(layoutRule.minimumPoint),
        })),
      });
    }
    // 右侧人物场景页可声明文字最右边界，超过即表示文字侵入图片主体区。
    const rightOverflow = matchedShapes.filter((shape) =>
      Number(layoutRule.maxRightPx) > 0 && shape.right > Number(layoutRule.maxRightPx));
    if (rightOverflow.length) {
      errors.push({
        type: "text_intrudes_visual_subject",
        evidence: rightOverflow.map((shape) => ({
          text: shape.text,
          actualRightPx: Math.round(shape.right),
          requiredMaxRightPx: Number(layoutRule.maxRightPx),
        })),
      });
    }
    // 双栏页可声明左右边界，防止单栏整体漂向页面外侧。
    const leftDrift = matchedShapes.filter((shape) =>
      Number(layoutRule.minLeftPx) > 0 && shape.left < Number(layoutRule.minLeftPx));
    if (leftDrift.length) {
      errors.push({
        type: "text_column_horizontal_drift",
        evidence: leftDrift.map((shape) => ({
          text: shape.text,
          actualLeftPx: Math.round(shape.left),
          requiredMinLeftPx: Number(layoutRule.minLeftPx),
        })),
      });
    }
  }
  // 当前页关系表将图片关系ID映射到PPTX包内媒体部件。
  const relsXml = readEntry(`ppt/slides/_rels/slide${slideNumber}.xml.rels`);
  // 建立关系ID到媒体目标的查找表。
  const imageRelations = new Map(
    [...relsXml.matchAll(/<Relationship\b([^>]*)>/g)]
      .map((match) => ({
        id: match[1].match(/\bId="([^"]+)"/)?.[1],
        type: match[1].match(/\bType="([^"]+)"/)?.[1],
        target: match[1].match(/\bTarget="([^"]+)"/)?.[1],
      }))
      .filter((relationship) => relationship.id
        && relationship.target
        && relationship.type?.endsWith("/image"))
      .map((relationship) => [relationship.id, relationship.target]),
  );
  // 当前页实际引用的图片关系ID来自DrawingML blip节点。
  const embeddedRelationIds = [...xml.matchAll(/<a:blip\b[^>]*r:embed="([^"]+)"/g)]
    .map((match) => match[1]);
  // 逐个解析为PPTX内部媒体路径并计算SHA-256。
  const embeddedImageHashes = new Set(embeddedRelationIds
    .map((relationId) => imageRelations.get(relationId))
    .filter(Boolean)
    .map((target) => target.startsWith("/")
      ? target.slice(1)
      : path.posix.normalize(path.posix.join("ppt/slides", target)))
    .map((entry) => crypto.createHash("sha256").update(readEntryBuffer(entry)).digest("hex")));
  // 专项清单中的图片文件就是人工确认的图文语义映射。
  const missingImageFiles = [];
  // 每个期望文件都必须以原始字节摘要出现在当前页。
  for (const imageFile of expected.imageFiles || []) {
    // 相对路径按当前工程工作目录解析，保持清单可迁移。
    const expectedBytes = await fs.readFile(path.resolve(imageFile));
    // 计算期望图片摘要。
    const expectedHash = crypto.createHash("sha256").update(expectedBytes).digest("hex");
    // 当前页未嵌入该图片时登记实际缺失路径。
    if (!embeddedImageHashes.has(expectedHash)) {
      missingImageFiles.push(imageFile);
    }
  }
  // 实际图片摘要不匹配说明页面仍在使用错误或旧插图。
  if (missingImageFiles.length) {
    errors.push({ type: "text_image_semantic_mismatch", evidence: { missingImageFiles } });
  }
  // 媒体对象通过“播放”动作名识别。
  const audioButtonCount = labels.filter((label) => label.includes("播放")).length;
  // 有声页只能存在一个可见并可点击的媒体按钮。
  if (Number.isInteger(expected.audioButtonCount) && audioButtonCount !== expected.audioButtonCount) {
    errors.push({
      type: "audio_button_count",
      evidence: { expected: expected.audioButtonCount, actual: audioButtonCount },
    });
  }
  // 返回逐页完整证据。
  return {
    slide: slideNumber,
    passed: errors.length === 0,
    textLength: fullText.replace(/\s+/g, "").length,
    largeBackplates: backplates.length,
    audioButtonCount,
    errors,
  };
}

// 读取PPTX内部文件清单并按页号排序。
const slideEntries = execFileSync("unzip", ["-Z1", pptx], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry))
  .sort((left, right) => Number(left.match(/\d+/)[0]) - Number(right.match(/\d+/)[0]));
// 逐页执行通用门禁和可选专项门禁。
const results = [];
// 逐页顺序检测，图片文件摘要需要异步读取专项清单中的源资产。
for (const entry of slideEntries) {
  // 页号来自正式页面部件名称。
  const slideNumber = Number(entry.match(/slide(\d+)\.xml$/)[1]);
  // 当前页清单允许使用字符串键。
  const expected = manifest.slides?.[String(slideNumber)] || {};
  // 保存当前页完整检测结果。
  results.push(await inspectSlide(slideNumber, readEntry(entry), expected));
}
// 任一页面失败即表示整份PPT尚未达到交付条件。
const failedSlides = results.filter((result) => !result.passed).map((result) => result.slide);
// 报告默认写入PPTX同目录，便于样稿和证据一同归档。
const reportPath = path.resolve(
  process.argv[4]
    || `${pptx}.美观质量检测.json`,
);
// 报告目录在首次验收时可能尚未建立，检测器负责创建后再写入证据。
await fs.mkdir(path.dirname(reportPath), { recursive: true });
// 报告使用UTF-8和稳定缩进，供人工复查与后续程序读取。
await fs.writeFile(
  reportPath,
  `${JSON.stringify({ pptx, manifestPath, failedSlides, results }, null, 2)}\n`,
  "utf8",
);
// 控制台只输出简要结果，避免逐页中文正文淹没任务进度。
console.log(JSON.stringify({ reportPath, checkedSlides: results.length, failedSlides }, null, 2));
// 失败页面使进程返回非零状态，防止自动链路继续复制到正式成品目录。
if (failedSlides.length) {
  process.exitCode = 1;
}
