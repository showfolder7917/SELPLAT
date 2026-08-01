import fs from "node:fs/promises";
import path from "node:path";

// 能力标识用于日志、验证报告和后续规则路由，明确本文件负责整张底图PPT的批量修复渲染。
const ABILITY_ID = "child_poetry_fullpage_ppt_repair_renderer";

// 工作区根目录由调用方显式传入，避免把某台机器的绝对路径固化进通用修复能力。
const workspaceRoot = path.resolve(process.env.WORKSPACE_ROOT || process.cwd());

// 需要项目输入的路径必须由任务显式声明，避免删除旧目录后仍悄悄读取过期的中文教学项目副本。
function requireTaskPath(environmentName) {
  // 业务上缺少关键输入时立即阻断，让调用方明确本轮使用的项目或诗目模块。
  const configuredPath = process.env[environmentName];
  if (!configuredPath) throw new Error(`缺少 ${environmentName}，无法定位本轮中文教学输入。`);
  // 业务上统一返回规范绝对路径，避免后续动态导入和底图读取受到工作目录变化影响。
  return path.resolve(configuredPath);
}

// 项目根目录保存核定数据、正式底图和最终可编辑PPT，必须由调用任务明确指定。
const projectRoot = requireTaskPath("PROJECT_ROOT");

// 底图根目录默认指向项目正式素材；超大分册可显式传入等尺寸压缩工作副本以降低导出内存，禁止隐式改写正式图片。
const backgroundRoot = path.resolve(
  process.env.BACKGROUND_ROOT
    || path.join(projectRoot, "底图/少儿古诗三页整张底图"),
);

// 旧批量脚本只作为核定诗目与教学文案库导入，禁止触发旧的素材板裁切生成流程。
const sourceModulePath = requireTaskPath("POEM_SOURCE_MODULE");

// 临时构建目录保存链接映射和可删除检查产物，正式PPT不会依赖这些外部文件。
const buildRoot = path.resolve(process.env.BUILD_ROOT || path.join(workspaceRoot, "OPTION/temp/中文教学/PPT渲染检查/三页整张底图批量修复"));

// 输出路径必须由调用方指定，避免覆盖上一轮已交付的错误对照稿。
const outputPptx = path.resolve(process.env.OUTPUT_PPTX || path.join(buildRoot, "少儿古诗整张底图批量修复_待链接.pptx"));

// 当前分册起止编号限制单次内存规模，也保证目录、上一篇和下一篇链接只指向本册有效页面。
const sequenceStart = Number.parseInt(process.env.SEQUENCE_START || "1", 10);
const sequenceEnd = Number.parseInt(process.env.SEQUENCE_END || "13", 10);

// 分册名称直接显示在封面上，帮助教师区分六个年级成果。
const volumeLabel = process.env.VOLUME_LABEL || `${String(sequenceStart).padStart(3, "0")}—${String(sequenceEnd).padStart(3, "0")}`;

// 工作区捆绑运行时入口是正式PPT唯一实现，缺失时立即停止而不是静默切换工具。
const artifactToolEntry = process.env.ARTIFACT_TOOL_ENTRY;

// 没有演示文稿运行时无法生成可编辑PPT，因此在读取大批量图片前优先失败。
if (!artifactToolEntry) throw new Error("缺少 ARTIFACT_TOOL_ENTRY，无法加载演示文稿运行时。");

// 动态载入工作区指定版本，避免个人环境中的包版本差异改变排版结果。
const { Presentation, PresentationFile } = await import(artifactToolEntry);

// 以库模式导入上一轮核定数据，确保本轮只修复版式而不重新猜测原诗、拼音和教学文案。
process.env.POEM_LIBRARY_MODE = "1";

// 文件URL支持中文与空格路径，导入后只读取公开的数据和分页函数。
const sourceModule = await import(new URL(`file://${sourceModulePath}`));

// 全部诗目按编号过滤为当前分册，空范围视为硬错误，防止输出只有封面和目录的假成品。
const poems = sourceModule.poems.filter((poem) => poem.sequence >= sequenceStart && poem.sequence <= sequenceEnd);

// 当前分册命中的册次目录来自同一核定编号映射，不手写第二套区间。
const gradeGroups = sourceModule.gradeGroups.filter((group) => group.end >= sequenceStart && group.start <= sequenceEnd);

// 长诗分页继续复用已验证函数，保证汉字、拼音和标点的顺序与上一轮一致。
const getOriginalChunks = sourceModule.getOriginalChunks;

// 没有诗目时立即终止，避免后续链接脚本对空文稿产生误导性成功结果。
if (!poems.length) throw new Error(`编号范围 ${sequenceStart}-${sequenceEnd} 没有可生成诗目。`);

// 标准画布与全部正式底图一致，插入时不做比例拉伸或二次裁切。
const slideSize = { width: 1672, height: 941 };

// 中文、诗文和拼音分别使用项目已验证字体，降低跨页字体回退造成的错位风险。
const fonts = { title: "Songti SC", poem: "Kaiti SC", body: "Songti SC", pinyin: "Arial Unicode MS" };

// 深色正文、竹绿色题签和暖白衬板形成稳定高对比度，解决文字落在复杂插画上看不清的问题。
const colors = { ink: "#342A23", muted: "#6E6254", green: "#557743", greenDark: "#36562F", white: "#FFFDF7", warmWhite: "#FFF9EA", softLine: "#D9C89C", gold: "#BEA05D" };

// 专项规则要求文字衬板透明度40%，这里以60%不透明度承托正文并保留背景水彩质感。
const backingFill = { type: "solid", color: { type: "rgb", value: colors.warmWhite, transform: { opacity: 60 } } };

// 咏鹅第二页使用本轮针对主体裁切问题修复后的版本，其他底图仍从正式目录自动发现。
const understandingOverrides = new Map([
  [1, path.join(backgroundRoot, "001_咏鹅/02_理解场景页_整张无文字底图_v02.png")],
]);

// 把二进制图片完整嵌入PPT，确保交付文件不依赖本机外部链接。
async function addBackground(slide, imagePath, name) {
  // 读取当前页正式无文字底图，文件不存在时让异常向上抛出并阻断成品生成。
  const bytes = await fs.readFile(imagePath);
  // 使用cover铺满同尺寸画布；源图与画布同为1672×941，因此不会发生主体裁切。
  // 工作副本允许使用JPEG降低大分册内存，正式PNG仍按原类型嵌入，避免扩展名与内容类型错配。
  const contentType = /\.jpe?g$/i.test(imagePath) ? "image/jpeg" : "image/png";
  // 图片二进制、真实内容类型与稳定对象名共同保证导出结果可移植且可检查。
  const image = slide.images.add({ blob: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), contentType, fit: "cover", alt: `${name}无文字整页教学底图`, name: `${name}-fullpage-background` });
  // 背景固定从左上角铺满，所有可编辑文字随后叠加在其上。
  image.position = { left: 0, top: 0, width: slideSize.width, height: slideSize.height };
}

// 创建稳定命名的可编辑文字对象，统一处理字号、颜色、行距、衬底和自动缩放。
function addText(slide, name, text, frame, style = {}) {
  // 文本框默认透明；需要对比保护时由调用方传入60%不透明暖白衬板。
  const shape = slide.shapes.add({ geometry: "textbox", name, position: frame, fill: style.fill ?? "#00000000", line: { style: "solid", fill: style.line ?? "#00000000", width: style.line ? 1 : 0 } });
  // 页面可见文案保持为PowerPoint原生文本，后续教师可以继续人工编辑。
  shape.text = String(text ?? "");
  // 统一样式避免同类页面因为局部默认值不同而出现字号和对齐漂移。
  shape.text.style = { fontSize: style.fontSize ?? 22, typeface: style.typeface ?? fonts.body, color: style.color ?? colors.ink, bold: style.bold ?? false, alignment: style.alignment ?? "left", verticalAlignment: style.verticalAlignment ?? "top", lineSpacing: style.lineSpacing ?? 1.35, autoFit: "shrinkText", insets: style.insets ?? { left: 8, right: 8, top: 4, bottom: 4 } };
  // 返回形状供导航或验证逻辑继续使用。
  return shape;
}

// 栏目题签统一使用深绿底和白色大字，保证在明暗不同的背景上都清楚可见。
function addSectionLabel(slide, name, text, left, top, width = 172) {
  // 圆角题签只承担栏目识别，不扩大为遮挡插画的大卡片。
  const label = slide.shapes.add({ geometry: "roundRect", name, position: { left, top, width, height: 50 }, fill: colors.green, line: { style: "solid", fill: colors.greenDark, width: 1 } });
  // 栏目名保持单行居中，过长时只在当前题签内自动缩小。
  label.text = text;
  // 白字与深绿底形成明确对比，投影环境仍可辨认。
  label.text.style = { fontSize: 25, typeface: fonts.body, color: colors.white, bold: true, alignment: "center", verticalAlignment: "middle", autoFit: "shrinkText", insets: { left: 8, right: 8, top: 2, bottom: 2 } };
  // 返回题签对象供结构检查统计。
  return label;
}

// 页面底部导航固定在安全区内，并使用高不透明度承托条避免复杂插画吞没按钮文字。
function addNavigation(slide, poem, pageIndex, pageTotal) {
  // 导航承托条覆盖底部中央，不进入原文或正文主要阅读区。
  slide.shapes.add({ geometry: "roundRect", name: `nav-${poem.sequence}-${pageIndex}-backing`, position: { left: 535, top: 882, width: 930, height: 50 }, fill: { type: "solid", color: { type: "rgb", value: "#FFFDF4", transform: { opacity: 94 } } }, line: { style: "solid", fill: "#DCCB96", width: 1 } });
  // 三个按钮的位置和对象名稳定，后处理脚本据此写入真实内部跳转关系。
  const buttons = [{ key: "previous", text: "← 上一篇", left: 552 }, { key: "directory", text: "本册目录", left: 716 }, { key: "next", text: "下一篇 →", left: 888 }];
  // 遍历按钮配置创建相同视觉和不同稳定对象名。
  for (const button of buttons) {
    // 导航按钮使用浅色底和深绿边，避免与正文题签混淆。
    const shape = slide.shapes.add({ geometry: "roundRect", name: `nav-${poem.sequence}-${pageIndex}-${button.key}`, position: { left: button.left, top: 887, width: 150, height: 39 }, fill: button.key === "directory" ? "#FFF0C8" : "#F2F7E9", line: { style: "solid", fill: colors.green, width: 1.4 } });
    // 按钮文字短而清楚，保持单行居中。
    shape.text = button.text;
    // 统一按钮字号，防止某一页因字体回退出现高度漂移。
    shape.text.style = { fontSize: 18, typeface: fonts.body, color: colors.greenDark, bold: true, alignment: "center", verticalAlignment: "middle", autoFit: "shrinkText", insets: { left: 6, right: 6, top: 2, bottom: 2 } };
  }
  // 页码定位条显示三位编号、诗题和当前页序，截图脱离目录时仍可识别。
  addText(slide, `page-location-${poem.sequence}-${pageIndex}`, `${String(poem.sequence).padStart(3, "0")}  ${poem.title}  ·  ${pageIndex}/${pageTotal}`, { left: 1054, top: 887, width: 392, height: 39 }, { fontSize: 16, color: colors.greenDark, bold: true, alignment: "center", verticalAlignment: "middle", fill: "#FFFDF4", insets: { left: 6, right: 6, top: 2, bottom: 2 } });
}

// 读取当前诗的正式整页底图，并按原文、讲解和拓展三类稳定排序。
async function resolveBackgrounds(poem) {
  // 每首诗使用“NNN_诗名”独立目录，避免同名诗之间错误串图。
  const poemRoot = path.join(backgroundRoot, `${String(poem.sequence).padStart(3, "0")}_${poem.title}`);
  // 正式目录使用PNG；受控工作副本可使用JPEG降低超大分册导出内存，其他检查图和中间文件一律忽略。
  const files = (await fs.readdir(poemRoot)).filter((name) => /\.(png|jpe?g)$/i.test(name));
  // 原文底图优先非“续页”版本，长诗续页随后按文件名顺序使用。
  const original = files.filter((name) => name.startsWith("01")).sort((left, right) => Number(left.includes("续页")) - Number(right.includes("续页")) || left.localeCompare(right, "zh-CN")).map((name) => path.join(poemRoot, name));
  // 讲解页只允许一个02开头的正式底图；咏鹅命中本轮修复覆盖图。
  const understanding = understandingOverrides.get(poem.sequence) || path.join(poemRoot, files.find((name) => name.startsWith("02")) || "");
  // 拓展页只允许一个03开头的正式底图。
  const extension = path.join(poemRoot, files.find((name) => name.startsWith("03")) || "");
  // 缺少任一页型时停止生成，不能用上一首或旧素材板静默补位。
  if (!original.length || !understanding || !extension) throw new Error(`${poem.sequence} ${poem.title} 正式整页底图不完整。`);
  // 返回与教学分页一一对应的底图集合。
  return { original, understanding, extension };
}

// 计算逐字诗句宽度，用于把每行在左侧文字安全区内视觉居中。
function lineWidth(tokens) {
  // 有拼音的汉字使用104像素字位，标点使用44像素窄列。
  return tokens.reduce((sum, token) => sum + (token.pinyin ? 104 : 44), 0);
}

// 每个拼音、汉字和标点分别创建原生对象，维持核定内容的一一对应关系。
function addPoemLine(slide, poem, tokens, pageIndex, rowIndex, top) {
  // 当前行从左侧安全区中央起排，避免标题和正文整体偏向一侧。
  let cursor = 105 + (820 - lineWidth(tokens)) / 2;
  // 逐词元排版保证拼音始终位于对应汉字正上方。
  for (const [tokenIndex, token] of tokens.entries()) {
    // 汉字使用标准字位，标点使用窄字位，不把标点误当成完整汉字列。
    const width = token.pinyin ? 104 : 44;
    // 只有汉字词元具有核定拼音，标点不创建空拼音框。
    if (token.pinyin) addText(slide, `poem-${poem.sequence}-${pageIndex}-${rowIndex}-pinyin-${tokenIndex}`, token.pinyin, { left: cursor, top, width, height: 30 }, { fontSize: 20, typeface: fonts.pinyin, color: colors.muted, alignment: "center", verticalAlignment: "middle", insets: { left: 0, right: 0, top: 0, bottom: 0 } });
    // 汉字和标点采用不同字号但共用垂直基线，朗读时行结构清楚。
    addText(slide, `poem-${poem.sequence}-${pageIndex}-${rowIndex}-char-${tokenIndex}`, token.text, { left: cursor, top: top + 28, width, height: 78 }, { fontSize: token.pinyin ? 61 : 48, typeface: fonts.poem, color: colors.ink, alignment: "center", verticalAlignment: "middle", insets: { left: 0, right: 0, top: 0, bottom: 0 } });
    // 游标按当前词元真实字位前进，防止标点后面的汉字错位。
    cursor += width;
  }
}

// 原文页在连续浅色安全区内恢复标题、作者、题签、拼音、汉字和标点。
async function buildOriginalSlide(presentation, poem, background, chunk, pageIndex, pageTotal, originalIndex, originalTotal) {
  // 新建空白页并先嵌入一张完整正式底图。
  const slide = presentation.slides.add();
  // 背景名称包含编号和页型，便于对象检查定位。
  await addBackground(slide, background, `${poem.sequence}-original-${originalIndex}`);
  // 长标题适度减小但保持单行，禁止挤到右侧人物区。
  addText(slide, `${poem.sequence}-${pageIndex}-title`, poem.title, { left: 92, top: 42, width: 820, height: 82 }, { fontSize: poem.title.length > 9 ? 46 : poem.title.length > 6 ? 55 : 66, typeface: fonts.title, color: colors.greenDark, bold: true, alignment: "center", verticalAlignment: "middle", fill: backingFill });
  // 朝代与作者位于题目下方，保持与原文内容同一视觉列。
  addText(slide, `${poem.sequence}-${pageIndex}-author`, `【${poem.dynasty}】${poem.author}`, { left: 212, top: 126, width: 580, height: 38 }, { fontSize: 25, color: colors.ink, alignment: "center", verticalAlignment: "middle", fill: backingFill });
  // 原文题签明确当前页功能，长诗续页仍保持同一位置。
  addSectionLabel(slide, `${poem.sequence}-${pageIndex}-original-label`, originalTotal > 1 ? `原文·拼音 ${originalIndex}/${originalTotal}` : "原文·拼音", 92, 178, originalTotal > 1 ? 230 : 180);
  // 计算当前页所有诗句的整体高度，使两行、三行或四行都在正文区垂直居中。
  const rowGap = 139;
  // 每行实际内容高度包括拼音和汉字区域。
  const rowBlockHeight = 106;
  // 原文安全区位于题签下方和导航上方。
  const contentTop = 225;
  // 正文安全区高度为600像素，保留底部导航呼吸空间。
  const contentHeight = 600;
  // 当前页总高度用于计算首行起点。
  const rowsHeight = rowBlockHeight + Math.max(0, chunk.length - 1) * rowGap;
  // 行数较少时整体居中，避免续页文字挤在左上角。
  const firstTop = contentTop + (contentHeight - rowsHeight) / 2;
  // 逐行创建核定拼音和汉字对象。
  chunk.forEach((tokens, rowIndex) => addPoemLine(slide, poem, tokens, pageIndex, rowIndex + 1, firstTop + rowIndex * rowGap));
  // 最后加入导航，确保任何正文对象都不会被后加背景覆盖。
  addNavigation(slide, poem, pageIndex, pageTotal);
}

// 讲解页统一恢复左侧诗意和字词，并把四条场景说明准确放入右侧标签槽。
async function buildUnderstandingSlide(presentation, poem, background, pageIndex, pageTotal) {
  // 新建讲解页并先铺一张完整无文字底图。
  const slide = presentation.slides.add();
  // 使用当前诗第二页正式底图，禁止继续复用旧素材板裁片。
  await addBackground(slide, background, `${poem.sequence}-understanding`);
  // 60%不透明衬板覆盖左侧文字安全区，统一解决浅纹理和装饰植物造成的低对比问题。
  // 咏鹅修复底图的右侧分镜略向左延伸，因此其文字衬板收窄，其他页面沿用标准左栏宽度。
  const understandingBackingWidth = poem.sequence === 1 ? 680 : 706;
  // 衬板右边缘不得穿过右侧第一列分镜，避免半透明竖线压住鹅或场景主体。
  slide.shapes.add({ geometry: "roundRect", name: `${poem.sequence}-understanding-backing`, position: { left: 42, top: 38, width: understandingBackingWidth, height: 820 }, fill: backingFill, line: { style: "solid", fill: colors.softLine, width: 1.2 } });
  // 页面标题恢复诗名与教学阶段，不再出现整块左栏空白。
  addText(slide, `${poem.sequence}-understanding-title`, `${poem.title} · 读懂诗意`, { left: 78, top: 62, width: 632, height: 64 }, { fontSize: poem.title.length > 9 ? 34 : 40, typeface: fonts.title, color: colors.greenDark, bold: true, verticalAlignment: "middle" });
  // 诗意题签与正文保持固定纵向关系。
  addSectionLabel(slide, `${poem.sequence}-meaning-label`, "诗意", 82, 142, 128);
  // 诗意正文使用较大字号和1.5倍行距，允许自动缩小但不得进入右侧插画区。
  addText(slide, `${poem.sequence}-meaning-text`, poem.meaning, { left: 88, top: 204, width: 610, height: 230 }, { fontSize: 24, lineSpacing: 1.5, insets: { left: 8, right: 8, top: 6, bottom: 6 } });
  // 分隔线固定在两个教学栏目之间，帮助儿童建立阅读顺序。
  slide.shapes.add({ geometry: "line", name: `${poem.sequence}-understanding-divider`, position: { left: 82, top: 454, width: 620, height: 0 }, fill: "#00000000", line: { style: "solid", fill: colors.softLine, width: 1.2 } });
  // 字词题签恢复在下半区，避免只剩空卡片。
  addSectionLabel(slide, `${poem.sequence}-words-label`, "字词理解", 82, 476, 174);
  // 字词逐条换行并使用项目核定内容，不让说明文字散落到插画上。
  addText(slide, `${poem.sequence}-words-text`, poem.words.map((item) => `• ${item}`).join("\n"), { left: 88, top: 538, width: 610, height: 280 }, { fontSize: 20, lineSpacing: 1.38, insets: { left: 8, right: 8, top: 4, bottom: 4 } });
  // 右侧题签明确四幅分镜的教学用途。
  addSectionLabel(slide, `${poem.sequence}-scene-label`, "画面理解", 790, 40, 184);
  // 固定四个标签槽坐标对应右侧2×2分镜，底排标签上移避开导航条。
  const captionFrames = [{ left: 820, top: 382, width: 300, height: 44 }, { left: 1282, top: 382, width: 300, height: 44 }, { left: 820, top: 812, width: 300, height: 44 }, { left: 1282, top: 812, width: 300, height: 44 }];
  // 每条场景说明独立叠加在浅色标签槽，防止文字直接压在泥土、水面或人物衣服上。
  poem.sceneCaptions.forEach((caption, index) => addText(slide, `${poem.sequence}-scene-caption-${index + 1}`, caption, captionFrames[index], { fontSize: 20, color: colors.greenDark, bold: true, alignment: "center", verticalAlignment: "middle", fill: { type: "solid", color: { type: "rgb", value: colors.warmWhite, transform: { opacity: 92 } } }, line: colors.softLine, insets: { left: 6, right: 6, top: 2, bottom: 2 } }));
  // 页面内容全部恢复后加入本册导航。
  addNavigation(slide, poem, pageIndex, pageTotal);
}

// 拓展页把四类教学内容重新映射到左侧四个预留卡片，禁止正文横向漂移到人物区。
async function buildExtensionSlide(presentation, poem, background, pageIndex, pageTotal) {
  // 新建拓展页并嵌入当前诗第三张完整底图。
  const slide = presentation.slides.add();
  // 背景保持一页一图，不在PPT中拼贴额外插画。
  await addBackground(slide, background, `${poem.sequence}-extension`);
  // 标题置于左侧四卡片上方的连续安全区，长标题自动缩小且保持单行。
  addText(slide, `${poem.sequence}-extension-title`, `${poem.title} · 品读与拓展`, { left: 62, top: 30, width: 790, height: 58 }, { fontSize: poem.title.length > 9 ? 32 : 38, typeface: fonts.title, color: colors.greenDark, bold: true, alignment: "center", verticalAlignment: "middle", fill: backingFill });
  // 四个栏目与底图左侧2×2空框一一对应，内容不会再只出现在右侧两个栏目。
  const cards = [
    { key: "emotion", title: "情感与寓意", text: poem.emotion, left: 52, top: 98, fontSize: 18 },
    { key: "author", title: "作者简介", text: poem.authorIntro, left: 454, top: 98, fontSize: 18 },
    { key: "questions", title: "思考互动", text: poem.questions.map((item, index) => `${index + 1}. ${item}`).join("\n"), left: 52, top: 462, fontSize: 17 },
    { key: "knowledge", title: "知识拓展", text: poem.knowledge.map((item, index) => `${index + 1}. ${item}`).join("\n"), left: 454, top: 462, fontSize: 17 },
  ];
  // 逐卡片增加60%不透明衬板、题签和正文，保证明亮背景与深色字始终有足够对比。
  for (const [index, card] of cards.entries()) {
    // 卡片衬板严格留在左半页，不遮挡右侧作者画像、儿童和主场景。
    slide.shapes.add({ geometry: "roundRect", name: `${poem.sequence}-${card.key}-backing`, position: { left: card.left, top: card.top, width: 382, height: 322 }, fill: backingFill, line: { style: "solid", fill: colors.softLine, width: 1.1 } });
    // 栏目题签位于卡片内上方，四个卡片保持统一边距。
    addSectionLabel(slide, `${poem.sequence}-${card.key}-label`, card.title, card.left + 22, card.top + 24, card.title.length > 4 ? 184 : 158);
    // 正文仅使用当前卡片安全区，并按内容长度自动缩小而不越过卡片边界。
    addText(slide, `${poem.sequence}-${card.key}-text`, card.text, { left: card.left + 24, top: card.top + 90, width: 334, height: 202 }, { fontSize: card.fontSize, lineSpacing: index < 2 ? 1.45 : 1.36, insets: { left: 6, right: 6, top: 4, bottom: 4 } });
  }
  // 导航条最后加入，始终位于所有四个卡片下方。
  addNavigation(slide, poem, pageIndex, pageTotal);
}

// 封面只提供分册身份和入口，不重复堆叠教学内容。
function buildCover(presentation) {
  // 新建分册封面并使用稳定暖白底色。
  const slide = presentation.slides.add();
  // 全页纸张底色保证封面在投影环境中明亮清楚。
  slide.shapes.add({ geometry: "rect", name: "cover-paper", position: { left: 0, top: 0, width: slideSize.width, height: slideSize.height }, fill: "#FFFDF4", line: { style: "solid", fill: "#FFFDF4", width: 0 } });
  // 金色细框承接现有课件视觉语言，不引入新的模板风格。
  slide.shapes.add({ geometry: "roundRect", name: "cover-border", position: { left: 28, top: 26, width: 1616, height: 886 }, fill: "#00000000", line: { style: "solid", fill: colors.gold, width: 2 } });
  // 主标题显示年级分册，避免继续误标为1—6年级总稿。
  addText(slide, "cover-title", `小学人教版 ${volumeLabel} 古诗词`, { left: 230, top: 220, width: 1212, height: 100 }, { fontSize: 58, typeface: fonts.title, color: colors.greenDark, bold: true, alignment: "center", verticalAlignment: "middle" });
  // 副标题说明本轮已经修复文字与整页底图排版。
  addText(slide, "cover-subtitle", "拼音原文 · 读懂诗意 · 品读拓展 · 可编辑导航", { left: 320, top: 345, width: 1032, height: 58 }, { fontSize: 28, color: colors.ink, alignment: "center", verticalAlignment: "middle" });
  // 封面入口按钮由链接脚本连接到本册第一张目录页。
  const start = slide.shapes.add({ geometry: "roundRect", name: "cover-start", position: { left: 650, top: 520, width: 372, height: 82 }, fill: "#FFF0C8", line: { style: "solid", fill: colors.green, width: 2 } });
  // 按钮文字面向教师和儿童，保持简短直接。
  start.text = "进入本册目录  →";
  // 大号深绿文字提高投影可读性。
  start.text.style = { fontSize: 29, typeface: fonts.body, color: colors.greenDark, bold: true, alignment: "center", verticalAlignment: "middle", autoFit: "shrinkText", insets: { left: 10, right: 10, top: 4, bottom: 4 } };
}

// 每个上下册生成独立目录页，目录按钮和诗目编号来自核定数据。
function buildDirectory(presentation, group, localGroupIndex) {
  // 新建当前册次目录页。
  const slide = presentation.slides.add();
  // 目录采用干净暖白底，避免插画干扰长标题阅读。
  slide.shapes.add({ geometry: "rect", name: `directory-${localGroupIndex}-paper`, position: { left: 0, top: 0, width: slideSize.width, height: slideSize.height }, fill: "#FFFDF4", line: { style: "solid", fill: "#FFFDF4", width: 0 } });
  // 标题显示册次与当前分册实际编号范围。
  addText(slide, `directory-${localGroupIndex}-title`, `${group.label} · ${String(Math.max(group.start, sequenceStart)).padStart(3, "0")}—${String(Math.min(group.end, sequenceEnd)).padStart(3, "0")}`, { left: 250, top: 66, width: 1172, height: 72 }, { fontSize: 44, typeface: fonts.title, color: colors.greenDark, bold: true, alignment: "center", verticalAlignment: "middle" });
  // 当前目录只列出本分册实际包含的诗，不产生越界按钮。
  const groupPoems = poems.filter((poem) => poem.sequence >= group.start && poem.sequence <= group.end);
  // 每列最多九首，长标题仍有足够宽度。
  for (const [index, poem] of groupPoems.entries()) {
    // 根据索引计算左右列和列内行号。
    const column = Math.floor(index / 9);
    // 列内行号决定纵向位置。
    const row = index % 9;
    // 左右两列使用相同宽度和边距。
    const left = column === 0 ? 120 : 858;
    // 72像素步进保证按钮之间不重叠。
    const top = 170 + row * 72;
    // 目录按钮名称是链接脚本的唯一定位键。
    const button = slide.shapes.add({ geometry: "roundRect", name: `toc-poem-${poem.sequence}`, position: { left, top, width: 694, height: 58 }, fill: row % 2 === 0 ? "#F3F8E9" : "#FFF7E4", line: { style: "solid", fill: "#C8D8A9", width: 1.2 } });
    // 按钮显示编号、诗题和作者，便于搜索和课堂定位。
    button.text = `${String(poem.sequence).padStart(3, "0")}  ${poem.title}  ·  ${poem.author}`;
    // 长标题自动缩小但保持左对齐和单行。
    button.text.style = { fontSize: 22, typeface: fonts.body, color: colors.ink, bold: true, alignment: "left", verticalAlignment: "middle", autoFit: "shrinkText", insets: { left: 22, right: 18, top: 3, bottom: 3 } };
  }
  // 上一册按钮在第一张目录页返回封面，其余连接前一张本册目录。
  const previous = slide.shapes.add({ geometry: "roundRect", name: `toc-group-${localGroupIndex}-previous`, position: { left: 475, top: 842, width: 210, height: 50 }, fill: "#F3F8E9", line: { style: "solid", fill: colors.green, width: 1.4 } });
  // 上一册按钮使用统一文字样式。
  previous.text = "← 上一册";
  // 按钮文字居中并保持高对比度。
  previous.text.style = { fontSize: 21, typeface: fonts.body, color: colors.greenDark, bold: true, alignment: "center", verticalAlignment: "middle" };
  // 下一册按钮在最后一张目录页返回封面，其余连接下一张本册目录。
  const next = slide.shapes.add({ geometry: "roundRect", name: `toc-group-${localGroupIndex}-next`, position: { left: 987, top: 842, width: 210, height: 50 }, fill: "#F3F8E9", line: { style: "solid", fill: colors.green, width: 1.4 } });
  // 下一册按钮文字包含方向提示。
  next.text = "下一册 →";
  // 按钮样式与上一册保持一致。
  next.text.style = { fontSize: 21, typeface: fonts.body, color: colors.greenDark, bold: true, alignment: "center", verticalAlignment: "middle" };
}

// 主流程按当前分册生成封面、目录和全部诗页，再输出待写链接的可编辑PPT与链接映射。
async function main() {
  // 预先创建正式输出目录和可删除构建目录。
  await fs.mkdir(path.dirname(outputPptx), { recursive: true });
  // 链接映射和日志统一放在当前构建目录。
  await fs.mkdir(buildRoot, { recursive: true });
  // 创建1672×941标准横版演示文稿。
  const presentation = Presentation.create({ slideSize });
  // 第1页固定为当前年级分册封面。
  buildCover(presentation);
  // 记录每首诗所属的本册目录页，供所有“本册目录”按钮跳转。
  const directoryBySequence = new Map();
  // 按上下册顺序生成一或两张目录页。
  gradeGroups.forEach((group, index) => {
    // 本册目录对象名使用1基编号。
    const localGroupIndex = index + 1;
    // 创建当前册次目录页。
    buildDirectory(presentation, group, localGroupIndex);
    // 封面之后连续排列目录，因此目录实际页码为索引加2。
    const slideNumber = index + 2;
    // 把当前目录范围内的所有诗映射到该目录页。
    poems.filter((poem) => poem.sequence >= group.start && poem.sequence <= group.end).forEach((poem) => directoryBySequence.set(poem.sequence, slideNumber));
  });
  // 记录每首诗第一张原文页的实际页码，供目录和篇间导航使用。
  const poemStartSlides = new Map();
  // 记录每首诗实际页数，长诗包含不同构图的原文续页。
  const poemPageCounts = new Map();
  // 按核定编号顺序生成当前分册全部诗页。
  for (const poem of poems) {
    // 当前已有页面数加一就是该诗第一张原文页的1基页码。
    poemStartSlides.set(poem.sequence, presentation.slides.items.length + 1);
    // 读取当前诗全部正式整页底图。
    const backgrounds = await resolveBackgrounds(poem);
    // 原文按安全宽度和每页最多四行拆分。
    const chunks = getOriginalChunks(poem);
    // 原文页数量优先由核定分页决定；底图数量不足时直接失败，不复用同一底图掩盖缺口。
    if (backgrounds.original.length < chunks.length) throw new Error(`${poem.sequence} ${poem.title} 原文底图 ${backgrounds.original.length} 张，少于分页 ${chunks.length} 张。`);
    // 总页数等于原文分页数加讲解和拓展两页。
    const pageTotal = chunks.length + 2;
    // 保存总页数供导航关系生成。
    poemPageCounts.set(poem.sequence, pageTotal);
    // 逐个原文分块使用不同正式底图生成可编辑原文页。
    for (const [chunkIndex, chunk] of chunks.entries()) await buildOriginalSlide(presentation, poem, backgrounds.original[chunkIndex], chunk, chunkIndex + 1, pageTotal, chunkIndex + 1, chunks.length);
    // 原文末页之后生成完整诗意、字词和画面理解页。
    await buildUnderstandingSlide(presentation, poem, backgrounds.understanding, chunks.length + 1, pageTotal);
    // 最后一页生成完整情感、作者、互动和知识拓展页。
    await buildExtensionSlide(presentation, poem, backgrounds.extension, chunks.length + 2, pageTotal);
  }
  // 链接映射由稳定对象名和本册真实页码组成，后处理脚本严格检查缺失、重复和越界。
  const links = [{ shapeName: "cover-start", targetSlide: 2 }];
  // 目录前后按钮形成本册内部浏览链，边界目录回到封面。
  gradeGroups.forEach((group, index) => {
    // 当前本册目录对象编号使用1基序号。
    const local = index + 1;
    // 第一张目录的上一册返回封面，其余跳到前一张目录。
    links.push({ shapeName: `toc-group-${local}-previous`, targetSlide: index === 0 ? 1 : index + 1 });
    // 最后一张目录的下一册返回封面，其余跳到下一张目录。
    links.push({ shapeName: `toc-group-${local}-next`, targetSlide: index === gradeGroups.length - 1 ? 1 : index + 3 });
  });
  // 每个诗目目录按钮跳到该诗第一张原文页。
  poems.forEach((poem) => links.push({ shapeName: `toc-poem-${poem.sequence}`, targetSlide: poemStartSlides.get(poem.sequence) }));
  // 每一页的上一篇、目录和下一篇都限制在当前分册范围内。
  poems.forEach((poem, poemIndex) => {
    // 本册第一首的上一篇保持在本首，避免跳到其他文件不存在的页面。
    const previousTarget = poemIndex === 0 ? poemStartSlides.get(poem.sequence) : poemStartSlides.get(poems[poemIndex - 1].sequence);
    // 本册最后一首的下一篇保持在本首，避免越界。
    const nextTarget = poemIndex === poems.length - 1 ? poemStartSlides.get(poem.sequence) : poemStartSlides.get(poems[poemIndex + 1].sequence);
    // 按当前诗真实页数生成全部导航关系。
    for (let pageIndex = 1; pageIndex <= poemPageCounts.get(poem.sequence); pageIndex += 1) {
      // 上一篇连接前一首原文首页。
      links.push({ shapeName: `nav-${poem.sequence}-${pageIndex}-previous`, targetSlide: previousTarget });
      // 本册目录连接当前诗所属上下册目录。
      links.push({ shapeName: `nav-${poem.sequence}-${pageIndex}-directory`, targetSlide: directoryBySequence.get(poem.sequence) });
      // 下一篇连接后一首原文首页。
      links.push({ shapeName: `nav-${poem.sequence}-${pageIndex}-next`, targetSlide: nextTarget });
    }
  });
  // 每个分册使用独立链接映射文件，避免并行或连续生成时相互覆盖。
  const linkMapPath = path.join(buildRoot, `内部链接映射_${String(sequenceStart).padStart(3, "0")}-${String(sequenceEnd).padStart(3, "0")}.json`);
  // 链接映射记录真实页数，注入脚本会与PPT压缩结构逐项核对。
  await fs.writeFile(linkMapPath, JSON.stringify({ slideCount: presentation.slides.items.length, links }, null, 2), "utf8");
  // 将内存演示文稿导出为PowerPoint文件，全部文字仍为可编辑对象。
  const pptx = await PresentationFile.exportPptx(presentation);
  // 保存待写内部链接版本，注入成功后再复制到正式文件名。
  await pptx.save(outputPptx);
  // 输出机器可读结果，供分册批处理和验证链收集路径、页数与链接数量。
  console.log(JSON.stringify({ status: "completed", ability: ABILITY_ID, outputPptx, linkMapPath, slideCount: presentation.slides.items.length, poemCount: poems.length, linkCount: links.length, sequenceStart, sequenceEnd }, null, 2));
}

// 主流程异常必须显示具体诗号、底图或输出路径并返回失败退出码。
main().catch((error) => {
  // 保留原始错误栈，便于定位能力、素材或运行时问题。
  console.error(error);
  // 非零退出码阻断链接注入、渲染验证和最终打包。
  process.exitCode = 1;
});
