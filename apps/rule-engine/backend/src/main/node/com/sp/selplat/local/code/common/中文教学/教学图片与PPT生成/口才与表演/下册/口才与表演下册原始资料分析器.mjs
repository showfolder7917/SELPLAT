import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

// 分析器优先使用调用方指定的工程根，保证能力可在不同工作目录稳定运行。
const PROJECT_ROOT = path.resolve(process.env.SELPLAT_PROJECT_ROOT || process.cwd());
// 下册源课件目录只用于读取，禁止在输入目录生成分析副本。
const SOURCE_PPT_ROOT = path.join(PROJECT_ROOT, "OPTION/temp/中文教学/0输入/下册/3、口才与表演下册课件");
// 下册教材截图按全册通用编号规则归入对应课次。
const SOURCE_IMAGE_ROOT = path.join(PROJECT_ROOT, "OPTION/temp/中文教学/0输入/下册/下册截图");
// 逐课覆盖清单属于稳定配置，进入规则引擎资源目录供生成器和检测器共同使用。
const COVERAGE_PATH = path.join(PROJECT_ROOT, "apps/rule-engine/backend/src/main/resources/local/common/中文教学/template/口才与表演/下册/课程内容索引.json");
// 可删除分析报告统一写入当前工程OPTION/temp。
const REPORT_PATH = path.join(PROJECT_ROOT, "OPTION/temp/中文教学/下册制作分析/下册原始资料覆盖报告.md");

/**
 * 还原PowerPoint XML中的常见字符实体，保证中文正文和标点按UTF-8进入覆盖清单。
 */
function decodeXml(value) {
  // 命名实体先恢复，避免后续数字实体替换改变原始文本。
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

/**
 * 从单页XML恢复段落和文本运行，禁止依赖旧稿对象位置推测正文顺序。
 */
function extractSlideText(xml) {
  // 每个PowerPoint段落独立抽取，保留列表、诗歌和训练步骤的语义边界。
  const paragraphs = [...xml.matchAll(/<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g)];
  // 段落内部按文本运行顺序拼接，避免拼音和汉字被对象名称打乱。
  const lines = paragraphs.map((paragraph) => {
    // 同一段落可能含多个字体运行，全部依次合并。
    const runs = [...paragraph[1].matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)];
    // XML实体在写入JSON前统一恢复。
    return runs.map((run) => decodeXml(run[1])).join("").trim();
  });
  // 空段落不进入正文，但非空段落保持原始先后次序。
  return lines.filter(Boolean).join("\n");
}

/**
 * 根据页面正文识别教学角色，供后续生成器保持全部教学板块和顺序。
 */
function inferRole(slideNumber, text) {
  // 第一页固定为课程封面。
  if (slideNumber === 1) return "封面";
  // 自我介绍页属于课前热身。
  if (/自我介绍|问好.*展示/s.test(text)) return "课前热身";
  // 口才之歌独立归入统一热身栏目。
  if (/口\s*才\s*之\s*歌/.test(text)) return "口才之歌";
  // 学习内容页承担整课导航。
  if (/学习内容|第一部分.*第六部分/s.test(text)) return "学习导航";
  // 情景或情境栏目保留音频入口。
  if (/情[景境].*再现|说一说.*做一做/s.test(text)) return "情境再现";
  // 发音、练习和基本功延伸共同归入字正腔圆。
  if (/发音训练|复习.*发音|练\s*习|基本功延伸|口部操|气息训练/.test(text)) return "字正腔圆";
  // 口脑风暴及其课外拓展按原顺序保留。
  if (/口脑.*风暴|读一读.*记一记/s.test(text)) return "口脑风暴";
  // 粉墨登场承担诵读或表演音频。
  if (/粉墨.*登场|读一读.*演一演/s.test(text)) return "粉墨登场";
  // 句子宝库页通常带教材页码占位，需要优先映射外部截图。
  if (/句子宝库|妙语连珠/.test(text)) return "句子宝库";
  // 拓展训练和能力篇使用本课截图恢复完整教学内容。
  if (/拓展训练|能力篇/.test(text)) return "拓展训练";
  // 课堂总结页归入回顾栏目。
  if (/今天.*学到|课堂回顾|我会啦/.test(text)) return "课堂回顾";
  // 家庭练习和课后任务保持独立。
  if (/小\s*任\s*务|回家.*表演|发音练习/.test(text)) return "小任务";
  // 结束语固定归入结束页。
  if (/期待下次|再见/.test(text)) return "结束页";
  // 第四页通常是当前课主题导入，其他未命中页面保留为内容页等待逐页审核。
  return slideNumber === 4 ? "主题导入" : "内容页";
}

/**
 * 读取PPTX压缩包内的全部页面正文并建立逐页覆盖记录。
 */
function analyzePptx(pptxPath) {
  // 先列出包内页面文件，页数以真实Open XML结构为准。
  const packageFiles = execFileSync("unzip", ["-Z1", pptxPath], { encoding: "utf8" });
  // 页面文件按数值序号排序，禁止slide10排在slide2之前。
  const slideFiles = packageFiles
    .split(/\r?\n/)
    .filter((item) => /^ppt\/slides\/slide\d+\.xml$/.test(item))
    .sort((left, right) => Number(left.match(/\d+/)[0]) - Number(right.match(/\d+/)[0]));
  // 每一页独立读取正文，保证369页全部进入分析而不受检查输出长度限制。
  const sourceSlides = slideFiles.map((slideFile) => {
    // 单页XML通过unzip按文件名只读提取。
    const xml = execFileSync("unzip", ["-p", pptxPath, slideFile], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    // 页面序号直接取自Open XML文件名。
    const sourceSlide = Number(slideFile.match(/slide(\d+)\.xml$/)[1]);
    // 正文按段落和运行顺序恢复。
    const sourceText = extractSlideText(xml);
    // 教学角色用于后续逐模块生成和完整性检查。
    const role = inferRole(sourceSlide, sourceText);
    // 页级记录保留原文，不在分析阶段擅自精简教材内容。
    return { source_slide: sourceSlide, role, source_text: sourceText };
  });
  // 返回真实页数与完整逐页记录。
  return { source_slide_count: sourceSlides.length, source_slides: sourceSlides };
}

/**
 * 把截图文件名解析为课次和本课图片序号。
 */
function parseSupplementName(fileName) {
  // 扩展名之外的纯数字部分决定图片归属。
  const stem = path.parse(fileName).name;
  // 非纯数字文件必须报告，不得静默归入错误课次。
  if (!/^\d+$/.test(stem)) return { valid: false, file: fileName, reason: "文件名不是纯数字" };
  // 全册通用规则规定最后一位为本课序号。
  const numericStem = Number(stem);
  // 前面的数字整体表示课次。
  const lesson = Math.floor(numericStem / 10);
  // 最后一位表示同课图片顺序。
  const order = numericStem % 10;
  // 零序号或超出16课均属于非法映射。
  if (lesson < 1 || lesson > 16 || order < 1) {
    return { valid: false, file: fileName, reason: "课次或图片序号超出范围" };
  }
  // 合法结果供逐课归组。
  return { valid: true, file: fileName, lesson, order };
}

/**
 * 执行整册盘点并写出生成器可复用的覆盖清单。
 */
async function main() {
  // 确认输入目录存在，避免生成空清单覆盖稳定配置。
  await fs.access(SOURCE_PPT_ROOT);
  // 确认截图目录存在，确保“请看教材”页面能够被补齐。
  await fs.access(SOURCE_IMAGE_ROOT);
  // 课件按文件名前缀课次排序。
  const pptxFiles = (await fs.readdir(SOURCE_PPT_ROOT))
    .filter((item) => item.toLowerCase().endsWith(".pptx"))
    .sort((left, right) => Number(left.match(/^\d+/)?.[0] || 0) - Number(right.match(/^\d+/)?.[0] || 0));
  // 必须恰好覆盖第1至16课。
  if (pptxFiles.length !== 16) throw new Error(`下册课件数量应为16，实际为${pptxFiles.length}`);
  // 所有截图先按全册规则解析。
  const parsedSupplements = (await fs.readdir(SOURCE_IMAGE_ROOT))
    .filter((item) => /\.(jpe?g|png)$/i.test(item))
    .map(parseSupplementName);
  // 任一非法文件名都阻止生成，避免截图漏课。
  const invalidSupplements = parsedSupplements.filter((item) => !item.valid);
  // 非法映射集中报告。
  if (invalidSupplements.length) throw new Error(`存在无法归组的截图：${JSON.stringify(invalidSupplements)}`);
  // 逐课建立完整覆盖记录。
  const coverage = pptxFiles.map((fileName) => {
    // 课次来自文件名前缀。
    const lesson = Number(fileName.match(/^\d+/)[0]);
    // 当前源课件只读分析。
    const sourceFile = path.join(SOURCE_PPT_ROOT, fileName);
    // 读取全部页面正文和角色。
    const analyzed = analyzePptx(sourceFile);
    // 当前课截图按本课序号排序，禁止字符串排序错配第10课。
    const supplements = parsedSupplements
      .filter((item) => item.lesson === lesson)
      .sort((left, right) => left.order - right.order)
      .map((item) => ({
        file: item.file,
        order: item.order,
        source_path: path.relative(PROJECT_ROOT, path.join(SOURCE_IMAGE_ROOT, item.file)),
        mapping_status: "待逐图识别并映射到教材占位页",
      }));
    // 主题标题优先取第四页正文，保留后续人工校正入口。
    const title = analyzed.source_slides.find((item) => item.source_slide === 4)?.source_text.split("\n")[0] || `第${lesson}课`;
    // 覆盖记录同时服务生成器和质量检测器。
    return {
      lesson,
      title,
      source_file: path.relative(PROJECT_ROOT, sourceFile),
      target_policy: "完整保留源PPT全部教学板块；教材截图按课次全部展开；删除所有“请看教材第N页”占位提示。",
      ...analyzed,
      supplements,
      visual_policy: "旧课件和教材截图用于核定内容；最终课件使用新排版、原创绘本视觉和可编辑文字。",
    };
  });
  // 输出目录按需创建。
  await fs.mkdir(path.dirname(COVERAGE_PATH), { recursive: true });
  // 稳定JSON使用两空格缩进，便于规则审查和版本比较。
  await fs.writeFile(COVERAGE_PATH, `${JSON.stringify(coverage, null, 2)}\n`, "utf8");
  // 报告目录属于可删除分析区。
  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  // 报告逐课显示页数、截图数、占位提示数和栏目覆盖情况。
  const reportLines = [
    "# 少儿口才与表演下册原始资料覆盖报告",
    "",
    "| 课次 | 主题 | 源PPT页数 | 教材截图 | 请看教材占位页 | 已识别板块 |",
    "|---:|---|---:|---:|---:|---|",
    ...coverage.map((item) => {
      // 占位提示必须在生成阶段全部替换。
      const placeholderCount = item.source_slides.filter((slide) => /请看教材|教材第\s*\d+\s*页/.test(slide.source_text)).length;
      // 栏目去重后用于快速发现缺失模块。
      const roles = [...new Set(item.source_slides.map((slide) => slide.role))].join("、");
      // 每课汇总为一行。
      return `| ${item.lesson} | ${item.title.replaceAll("|", "／")} | ${item.source_slide_count} | ${item.supplements.length} | ${placeholderCount} | ${roles} |`;
    }),
    "",
    `- 源PPT总页数：${coverage.reduce((sum, item) => sum + item.source_slide_count, 0)}`,
    `- 教材截图总数：${coverage.reduce((sum, item) => sum + item.supplements.length, 0)}`,
    "- 编号规则：最后一位为本课图片序号，前面全部数字为课次。",
    "- 最终要求：截图全部映射，且“请看教材第N页”残留数量为0。",
  ];
  // 报告按UTF-8一次性写入。
  await fs.writeFile(REPORT_PATH, `${reportLines.join("\n")}\n`, "utf8");
  // 命令行返回稳定摘要供执行文档记录。
  console.log(JSON.stringify({
    status: "completed",
    lesson_count: coverage.length,
    slide_count: coverage.reduce((sum, item) => sum + item.source_slide_count, 0),
    supplement_count: coverage.reduce((sum, item) => sum + item.supplements.length, 0),
    coverage_path: COVERAGE_PATH,
    report_path: REPORT_PATH,
  }, null, 2));
}

// 分析失败时保留明确错误并返回非零状态，禁止继续生成不完整课件。
main().catch((error) => {
  // 标准错误输出供连续任务定位硬阻塞。
  console.error(error);
  // 非零退出码阻止后续生成链误判分析成功。
  process.exitCode = 1;
});
