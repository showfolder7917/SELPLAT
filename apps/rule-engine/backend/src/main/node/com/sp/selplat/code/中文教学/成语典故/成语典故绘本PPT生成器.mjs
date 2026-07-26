import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";


// 当前项目根由调用环境明确传入；缺失时停止，避免把课程文件写到旧工程或用户绝对路径。
const IDIOM_PROJECT_ROOT = process.env.IDIOM_PROJECT_ROOT;
if (!IDIOM_PROJECT_ROOT) throw new Error("缺少 IDIOM_PROJECT_ROOT：请指定当前成语课程项目目录。");
// 课程内容、词典、插画清单和项目稿均由当前项目根派生，保证一次运行只读取一套课程资料。
const CONTENT_JSON = path.join(IDIOM_PROJECT_ROOT, "参考资料/成语课程内容.json");
const DICTIONARY_JSON = path.join(IDIOM_PROJECT_ROOT, "参考资料/公开成语故事词典.json");
const IMAGE_MANIFEST_JSON = path.join(IDIOM_PROJECT_ROOT, "重制版/全量插画生成清单.json");
const GRADE1_CONTENT_JSON = path.join(IDIOM_PROJECT_ROOT, "重制版/一年级/一年级内容与分镜.json");
const ART_DIR = path.join(IDIOM_PROJECT_ROOT, "参考资料/原创插画");
const PROJECT_DIR = path.join(IDIOM_PROJECT_ROOT, "PPT排版/批量稿");
// 成品和预览默认写入当前项目下的运行目录；调用方可通过环境变量显式调整版本化输出位置。
const PRODUCT_DIR = process.env.IDIOM_PRODUCT_DIR || path.join(IDIOM_PROJECT_ROOT, "成品");
const PREVIEW_DIR = process.env.IDIOM_PREVIEW_DIR || path.join(IDIOM_PROJECT_ROOT, "验证预览");
// 横版课件使用标准16:9画布，所有定位均以96DPI像素计算。
const SLIDE_SIZE = { width: 1280, height: 720 };
// 中文统一使用已安装的思源黑体，避免跨环境缺字。
const FONT_CN = "Noto Sans CJK SC";
// 拼音使用Arial，保证带调字母的清晰度与兼容性。
const FONT_PINYIN = "Arial";
// 每页目录容纳12个成语，按钮足够大，儿童可以快速点击。
const DIRECTORY_PAGE_SIZE = 12;
// 环境变量只用于小样测试；正式运行不设值即可生成全部274条。
const TEST_IDIOM_LIMIT = Number(process.env.IDIOM_LIMIT || "0");
// 环境变量可限定年级，便于先验证一册而不改变正式生成逻辑。
const TEST_GRADE = Number(process.env.ONLY_GRADE || "0");


// 六个年级使用同一体系下的不同强调色，既统一又能快速辨认册别。
const GRADE_THEMES = [
  { accent: "#C95F46", deep: "#6E3026", pale: "#FFF1E8", jade: "#2F7C76" },
  { accent: "#D89A32", deep: "#704B17", pale: "#FFF7DD", jade: "#397F74" },
  { accent: "#4D8B72", deep: "#214E42", pale: "#EAF5ED", jade: "#B35B45" },
  { accent: "#547AA5", deep: "#2B4664", pale: "#EDF3FA", jade: "#B55C46" },
  { accent: "#9B6653", deep: "#58362A", pale: "#F8EFE9", jade: "#377B72" },
  { accent: "#655E91", deep: "#39345B", pale: "#F1EFF8", jade: "#B16245" },
];
// 场景类别决定插画底色和象征物，确保词义和视觉相互支持。
const CATEGORY_COLORS = {
  nature: ["#DDEFD9", "#A8D5C1", "#5A907D"],
  learning: ["#F8E8B8", "#E5B96A", "#855B2D"],
  virtue: ["#F6D9D0", "#DB8F78", "#7C3D31"],
  courage: ["#D9E5F4", "#7799C2", "#354F75"],
  emotion: ["#FFE1A8", "#EFAE50", "#91542B"],
  order: ["#E5DDF2", "#A892C3", "#594B77"],
  speech: ["#D8ECEB", "#76B1AD", "#326A67"],
  general: ["#EFE3D2", "#C9A77F", "#6D5137"],
};


/**
 * 创建可编辑文本框，并统一处理字体、内边距和自动缩放。
 */
function addText(slide, text, position, options = {}) {
  // 文本框名称用于结构检查和导航补丁定位。
  const shape = slide.shapes.add({
    geometry: "textbox",
    name: options.name || `TEXT_${Math.random().toString(36).slice(2, 8)}`,
    position,
    fill: options.fill || "none",
    line: options.line || { style: "solid", fill: "none", width: 0 },
    borderRadius: options.borderRadius,
  });
  // 写入最终可编辑文字，不把文字烘焙进图片。
  shape.text = text;
  // 应用全框文字样式，长文本只允许轻微收缩，不缩到难以阅读。
  shape.text.style = {
    fontSize: options.fontSize || 24,
    bold: Boolean(options.bold),
    color: options.color || "#24363E",
    alignment: options.alignment || "left",
    verticalAlignment: options.verticalAlignment || "middle",
    typeface: options.typeface || FONT_CN,
    // 正文按用户核定标准使用1.5倍行距，标题等短文本可由调用方覆盖。
    lineSpacing: options.lineSpacing || 1.5,
    autoFit: options.autoFit || "shrinkText",
    insets: options.insets || { top: 8, right: 10, bottom: 8, left: 10 },
  };
  // 返回形状便于调用方继续设置名称或链接标记。
  return shape;
}


/**
 * 创建圆角卡片，卡片与背景保持轻微透明融合。
 */
function addCard(slide, position, fill = "#FFFDF7/92", lineColor = "#FFFFFF/50", name = "CARD") {
  // 使用圆角矩形作为统一信息容器。
  return slide.shapes.add({
    geometry: "roundRect",
    name,
    position,
    fill,
    line: { style: "solid", fill: lineColor, width: 1 },
    borderRadius: "rounded-2xl",
    shadow: "shadow-sm",
  });
}


/**
 * 把当前成语的拼音逐字放在汉字正上方，形成适合儿童指读的整齐注音标题。
 */
function addPinyinTitle(slide, lesson, frame, color) {
  // 按Unicode字符拆分成语，保证每个汉字拥有独立列位。
  const characters = [...lesson.idiom];
  // 按空格拆分核定拼音，保留每个音节的声调符号。
  const syllables = String(lesson.final_pinyin || "").trim().split(/\s+/);
  // 根据成语长度计算单字列宽，避免五字或六字成语越出文字卡。
  const cellWidth = Math.min(92, frame.width / Math.max(characters.length, 1));
  // 让整组成语在给定区域内水平居中。
  const startX = frame.left + (frame.width - cellWidth * characters.length) / 2;
  // 逐字建立“上拼音、下汉字”的垂直对应关系。
  characters.forEach((character, index) => {
    // 拼音使用较小字号并保持居中，音节数量不足时留空而不错误错位。
    addText(slide, syllables[index] || "", { left: startX + index * cellWidth, top: frame.top, width: cellWidth, height: 28 }, { fontSize: 17, color: "#607278", alignment: "center", typeface: FONT_PINYIN, lineSpacing: 1, insets: { top: 0, right: 0, bottom: 0, left: 0 } });
    // 汉字使用大号深色字并与上方音节共享同一列中心。
    addText(slide, character, { left: startX + index * cellWidth, top: frame.top + 26, width: cellWidth, height: 66 }, { fontSize: 46, bold: true, color, alignment: "center", lineSpacing: 1, insets: { top: 0, right: 0, bottom: 0, left: 0 } });
  });
}


/**
 * 把故事按自然句号整理为短段落，并在每段首行加入两个中文全角空格。
 */
function formatStoryParagraphs(story) {
  // 先保留人工稿已有分段，避免重新打散已经审校的故事结构。
  const manualParagraphs = String(story || "").split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  // 已有两段以上时只补首行缩进并直接返回。
  if (manualParagraphs.length >= 2) return manualParagraphs.map((item) => `　　${item}`).join("\n\n");
  // 单段长故事按完整句子切分，保证标点跟随前句而不单独落行。
  const sentences = String(story || "").match(/[^。！？]+[。！？]?/g) || [];
  // 每两句组成一个短段，控制儿童阅读时的视觉停顿。
  const grouped = [];
  // 顺序遍历句子并按两句一组写入段落数组。
  for (let index = 0; index < sentences.length; index += 2) grouped.push(sentences.slice(index, index + 2).join("").trim());
  // 每段首行统一空两个中文字符，并用空行分隔段落。
  return grouped.map((item) => `　　${item}`).join("\n\n");
}


/**
 * 把当前成语的原创插画铺满整页，确保图片不裁掉关键情节并与文字区融为一体。
 */
function addFullBleedIllustration(slide, lesson, imageBytes) {
  // 使用整页cover方式铺设已按16:9构图生成的原创插画。
  slide.images.add({ blob: imageBytes, contentType: "image/jpeg", alt: `${lesson.idiom}原创绘本插画`, fit: "cover", position: { left: 0, top: 0, width: 1280, height: 720 } });
}


/**
 * 绘制简洁人物，由头、身体和动作线组成，保持可编辑和儿童绘本感。
 */
function drawCharacter(slide, x, y, scale, colors, pose = 0) {
  // 身体使用柔和色圆角块，作为人物主要色彩识别。
  slide.shapes.add({ geometry: "roundRect", position: { left: x, top: y + 58 * scale, width: 58 * scale, height: 82 * scale }, fill: colors[0], line: { style: "solid", fill: "none", width: 0 }, borderRadius: "rounded-xl" });
  // 头部使用暖米色圆形，保持跨年级统一角色风格。
  slide.shapes.add({ geometry: "ellipse", position: { left: x + 6 * scale, top: y, width: 46 * scale, height: 46 * scale }, fill: "#F4C9A4", line: { style: "solid", fill: colors[2], width: 1 } });
  // 头发用深色半圆覆盖头部上方，增加人物表情辨识度。
  slide.shapes.add({ geometry: "ellipse", position: { left: x + 5 * scale, top: y - 4 * scale, width: 48 * scale, height: 22 * scale }, fill: colors[2], line: { style: "solid", fill: "none", width: 0 } });
  // 两只眼睛用小圆点表示，保证缩放后仍清晰。
  slide.shapes.add({ geometry: "ellipse", position: { left: x + 18 * scale, top: y + 20 * scale, width: 4 * scale, height: 4 * scale }, fill: "#2D2A27", line: { style: "solid", fill: "none", width: 0 } });
  // 第二只眼睛与第一只保持自然间距。
  slide.shapes.add({ geometry: "ellipse", position: { left: x + 34 * scale, top: y + 20 * scale, width: 4 * scale, height: 4 * scale }, fill: "#2D2A27", line: { style: "solid", fill: "none", width: 0 } });
  // 微笑用短线代替复杂曲线，保持编辑兼容性。
  const smile = slide.shapes.add({ geometry: "rect", position: { left: x + 23 * scale, top: y + 32 * scale, width: 12 * scale, height: 2 * scale }, fill: colors[0], line: { style: "solid", fill: "none", width: 0 } });
  // 不同姿态通过轻微旋转身体和手臂，形成独立画面节奏。
  smile.rotation = pose % 2 === 0 ? 4 : -4;
  // 左手臂用细长圆角块绘制。
  const leftArm = slide.shapes.add({ geometry: "roundRect", position: { left: x - 20 * scale, top: y + 70 * scale, width: 32 * scale, height: 10 * scale }, fill: "#F4C9A4", line: { style: "solid", fill: "none", width: 0 }, borderRadius: "rounded-full" });
  // 左手角度随姿态变化，避免所有角色动作相同。
  leftArm.rotation = pose % 3 === 0 ? -28 : 18;
  // 右手臂向故事象征物方向伸展。
  const rightArm = slide.shapes.add({ geometry: "roundRect", position: { left: x + 48 * scale, top: y + 70 * scale, width: 34 * scale, height: 10 * scale }, fill: "#F4C9A4", line: { style: "solid", fill: "none", width: 0 }, borderRadius: "rounded-full" });
  // 右手角度与左手形成对比，增强动作感。
  rightArm.rotation = pose % 3 === 1 ? -22 : 22;
}


/**
 * 根据语义类别绘制独立场景，所有元素保持PowerPoint原生可编辑。
 */
function drawScene(slide, lesson, frame, variant = 0) {
  // 读取类别配色，未识别类别回退到通用米棕色。
  const colors = CATEGORY_COLORS[lesson.category] || CATEGORY_COLORS.general;
  // 场景底板占据大面积画面，并以柔和渐变营造绘本纸感。
  slide.shapes.add({ geometry: "roundRect", name: `SCENE_${lesson.visual_seed}`, position: frame, fill: `linear(135deg, ${colors[0]} 0%, #FFF8EA 62%, ${colors[1]}/70 100%)`, line: { style: "solid", fill: "#FFFFFF/60", width: 1 }, borderRadius: "rounded-3xl" });
  // 远景太阳位置由词条序号确定，保证每个场景略有变化。
  const sunX = frame.left + frame.width * (0.18 + ((lesson.lesson_index * 7) % 45) / 100);
  // 太阳使用半透明暖色圆形，不抢占文字视觉层级。
  slide.shapes.add({ geometry: "ellipse", position: { left: sunX, top: frame.top + 44, width: 72, height: 72 }, fill: "#F6C968/75", line: { style: "solid", fill: "none", width: 0 } });
  // 远山由三个错落圆角块组成，形成统一东方山水轮廓。
  const hill1 = slide.shapes.add({ geometry: "roundRect", position: { left: frame.left + 20, top: frame.top + frame.height - 180, width: frame.width * 0.54, height: 150 }, fill: `${colors[2]}/24`, line: { style: "solid", fill: "none", width: 0 }, borderRadius: "rounded-3xl" });
  // 第一座山轻微旋转形成自然坡度。
  hill1.rotation = -8 + (lesson.lesson_index % 5);
  // 第二座山从右侧叠入，提供景深。
  const hill2 = slide.shapes.add({ geometry: "roundRect", position: { left: frame.left + frame.width * 0.42, top: frame.top + frame.height - 155, width: frame.width * 0.52, height: 130 }, fill: `${colors[1]}/28`, line: { style: "solid", fill: "none", width: 0 }, borderRadius: "rounded-3xl" });
  // 第二座山与第一座山反向旋转，避免机械对称。
  hill2.rotation = 7 - (lesson.lesson_index % 4);
  // 前景地面覆盖山脚并稳定人物站位。
  slide.shapes.add({ geometry: "roundRect", position: { left: frame.left + 12, top: frame.top + frame.height - 105, width: frame.width - 24, height: 92 }, fill: `${colors[1]}/48`, line: { style: "solid", fill: "none", width: 0 }, borderRadius: "rounded-2xl" });
  // 左侧角色承担观察或行动者角色。
  drawCharacter(slide, frame.left + 98 + (lesson.lesson_index % 3) * 10, frame.top + frame.height - 260, 1.05, [colors[2], colors[1], "#37434A"], lesson.lesson_index + variant);
  // 右侧角色承担交流者角色，两个角色形成故事关系。
  drawCharacter(slide, frame.left + 265 + (lesson.lesson_index % 4) * 8, frame.top + frame.height - 235, 0.9, [lesson.grade % 2 ? "#C8624B" : "#4F7DA2", colors[1], "#3E3733"], lesson.lesson_index + variant + 1);
  // 不同类别绘制不同象征物，使画面与词义直接关联。
  if (lesson.category === "learning") {
    // 学习类用打开的书本和一支笔作为核心象征。
    slide.shapes.add({ geometry: "rect", position: { left: frame.left + frame.width - 210, top: frame.top + frame.height - 205, width: 110, height: 72 }, fill: "#FFFDF4", line: { style: "solid", fill: colors[2], width: 2 } });
    const pen = slide.shapes.add({ geometry: "roundRect", position: { left: frame.left + frame.width - 165, top: frame.top + frame.height - 225, width: 9, height: 92 }, fill: colors[2], line: { style: "solid", fill: "none", width: 0 }, borderRadius: "rounded-full" });
    pen.rotation = 32;
  } else if (lesson.category === "nature") {
    // 自然类用三朵大小不同的花呈现观察对象。
    for (let i = 0; i < 3; i += 1) {
      slide.shapes.add({ geometry: "ellipse", position: { left: frame.left + frame.width - 210 + i * 48, top: frame.top + frame.height - 160 - (i % 2) * 24, width: 34, height: 34 }, fill: i === 1 ? "#E88767" : "#F0C95C", line: { style: "solid", fill: "#FFFFFF/50", width: 1 } });
    }
  } else if (lesson.category === "virtue") {
    // 品格类用相连的两颗心表示真诚、合作与关爱。
    slide.shapes.add({ geometry: "heart", position: { left: frame.left + frame.width - 220, top: frame.top + frame.height - 195, width: 74, height: 66 }, fill: "#D96E64", line: { style: "solid", fill: "#FFFFFF/60", width: 1 } });
    slide.shapes.add({ geometry: "heart", position: { left: frame.left + frame.width - 162, top: frame.top + frame.height - 174, width: 58, height: 52 }, fill: "#F1A36E", line: { style: "solid", fill: "#FFFFFF/60", width: 1 } });
  } else if (lesson.category === "courage") {
    // 勇气类用向上台阶和小旗表现迎难而上。
    for (let i = 0; i < 4; i += 1) {
      slide.shapes.add({ geometry: "rect", position: { left: frame.left + frame.width - 245 + i * 42, top: frame.top + frame.height - 120 - i * 34, width: 44, height: 34 + i * 34 }, fill: `${colors[2]}/${38 + i * 8}`, line: { style: "solid", fill: "#FFFFFF/40", width: 1 } });
    }
    slide.shapes.add({ geometry: "triangle", position: { left: frame.left + frame.width - 92, top: frame.top + frame.height - 260, width: 56, height: 44 }, fill: "#C95F46", line: { style: "solid", fill: "none", width: 0 } });
  } else if (lesson.category === "speech") {
    // 表达类用两个对话气泡表现倾听与交流。
    slide.shapes.add({ geometry: "wedgeRoundRectCallout", position: { left: frame.left + frame.width - 250, top: frame.top + 110, width: 125, height: 76 }, fill: "#FFFFFF/82", line: { style: "solid", fill: colors[2], width: 1 } });
    slide.shapes.add({ geometry: "wedgeRoundRectCallout", position: { left: frame.left + frame.width - 150, top: frame.top + 190, width: 105, height: 66 }, fill: "#FFFFFF/70", line: { style: "solid", fill: colors[1], width: 1 } });
  } else if (lesson.category === "order") {
    // 条理类用整齐排列的积木体现分类与秩序。
    for (let i = 0; i < 6; i += 1) {
      slide.shapes.add({ geometry: "roundRect", position: { left: frame.left + frame.width - 230 + (i % 3) * 62, top: frame.top + frame.height - 195 + Math.floor(i / 3) * 58, width: 48, height: 44 }, fill: i % 2 ? colors[1] : "#F0BE67", line: { style: "solid", fill: "#FFFFFF/60", width: 1 }, borderRadius: "rounded-lg" });
    }
  } else {
    // 通用类用一盏灯和延伸小路表达理解、发现与成长。
    slide.shapes.add({ geometry: "ellipse", position: { left: frame.left + frame.width - 196, top: frame.top + 128, width: 82, height: 82 }, fill: "#F5C65B/86", line: { style: "solid", fill: "#FFFFFF/60", width: 1 } });
    slide.shapes.add({ geometry: "roundRect", position: { left: frame.left + frame.width - 166, top: frame.top + 202, width: 24, height: 52 }, fill: colors[2], line: { style: "solid", fill: "none", width: 0 }, borderRadius: "rounded-md" });
  }
  // 场景右下角放置无文字印章形色块，强化国学视觉但不制造假文字。
  slide.shapes.add({ geometry: "rect", position: { left: frame.left + frame.width - 66, top: frame.top + frame.height - 68, width: 34, height: 34 }, fill: "#B64E3D/76", line: { style: "solid", fill: "#FFFFFF/70", width: 1 } });
}


/**
 * 添加页眉与导航按钮；链接目标由后处理程序根据形状名称写入OOXML。
 */
function addChrome(slide, grade, section, slideNumber, nav) {
  // 页眉短线作为整套课件的视觉锚点。
  slide.shapes.add({ geometry: "roundRect", position: { left: 58, top: 34, width: 72, height: 8 }, fill: grade ? GRADE_THEMES[grade - 1].accent : "#B55B45", line: { style: "solid", fill: "none", width: 0 }, borderRadius: "rounded-full" });
  // 页眉显示当前国学板块名称。
  addText(slide, section, { left: 144, top: 22, width: 230, height: 34 }, { fontSize: 16, bold: true, color: "#64757B", insets: { top: 0, right: 0, bottom: 0, left: 0 } });
  // 右上角页码用于线下打印和教师口头定位。
  addText(slide, String(slideNumber).padStart(2, "0"), { left: 1178, top: 20, width: 54, height: 36 }, { fontSize: 16, color: "#718087", alignment: "right", insets: { top: 0, right: 0, bottom: 0, left: 0 } });
  // 底部左侧的总目录按钮返回跨文件主目录。
  addText(slide, "总目录", { left: 52, top: 670, width: 92, height: 30 }, { name: "LINK_FILE_MASTER", fontSize: 14, bold: true, color: "#3E716C", alignment: "center", fill: "#FFFFFF/70", borderRadius: "rounded-full", insets: { top: 2, right: 4, bottom: 2, left: 4 } });
  // 年级目录按钮返回当前册第一页目录。
  if (nav.home) {
    addText(slide, "本册目录", { left: 154, top: 670, width: 104, height: 30 }, { name: `LINK_SLIDE_${nav.home}`, fontSize: 14, bold: true, color: "#3E716C", alignment: "center", fill: "#FFFFFF/70", borderRadius: "rounded-full", insets: { top: 2, right: 4, bottom: 2, left: 4 } });
  }
  // 上一成语按钮仅在存在目标时显示。
  if (nav.prev) {
    addText(slide, "← 上一成语", { left: 930, top: 670, width: 120, height: 30 }, { name: `LINK_SLIDE_${nav.prev}`, fontSize: 14, bold: true, color: "#60757C", alignment: "center", fill: "#FFFFFF/70", borderRadius: "rounded-full", insets: { top: 2, right: 4, bottom: 2, left: 4 } });
  }
  // 下一成语按钮帮助课堂连续讲授。
  if (nav.next) {
    addText(slide, "下一成语 →", { left: 1060, top: 670, width: 132, height: 30 }, { name: `LINK_SLIDE_${nav.next}`, fontSize: 14, bold: true, color: "#60757C", alignment: "center", fill: "#FFFFFF/70", borderRadius: "rounded-full", insets: { top: 2, right: 4, bottom: 2, left: 4 } });
  }
}


/**
 * 创建年级封面，把新生成主视觉作为大幅背景并叠加半透明信息面板。
 */
async function addGradeCover(presentation, grade, lessons, imageBytes) {
  // 新建年级封面页。
  const slide = presentation.slides.add();
  // 背景使用暖米色，保证图片边缘与画布自然融合。
  slide.background.fill = "#F7F1E7";
  // 主视觉占满全页，保持图片大、主题明确。
  slide.images.add({ blob: imageBytes, contentType: "image/jpeg", alt: `${grade}年级成语绘本主视觉`, fit: "cover", position: { left: 0, top: 0, width: 1280, height: 720 } });
  // 封面信息卡使用60%不透明度，对应PowerPoint透明度40%。
  addCard(slide, { left: 720, top: 92, width: 480, height: 520 }, "#FFFDF6/60", "#FFFFFF/18", "COVER_PANEL");
  // 年级标签建立层级，不与主标题争抢注意力。
  addText(slide, "国学成语绘本课", { left: 776, top: 136, width: 290, height: 44 }, { fontSize: 21, bold: true, color: GRADE_THEMES[grade - 1].accent, insets: { top: 0, right: 0, bottom: 0, left: 0 } });
  // 主标题突出年级与课程主题。
  addText(slide, `${grade}年级\n成语故事`, { left: 772, top: 205, width: 354, height: 154 }, { fontSize: 48, bold: true, color: GRADE_THEMES[grade - 1].deep, insets: { top: 0, right: 0, bottom: 0, left: 0 } });
  // 副标题说明本册数量和六板块结构。
  addText(slide, `本册 ${lessons.length} 条成语\n诵读 · 观图 · 故事 · 明理 · 运用 · 启智`, { left: 776, top: 382, width: 352, height: 82 }, { fontSize: 18, color: "#53676D", insets: { top: 0, right: 0, bottom: 0, left: 0 } });
  // 封面进入按钮跳转到本册第一张目录页。
  addText(slide, "进入本册目录  →", { left: 776, top: 500, width: 300, height: 64 }, { name: "LINK_SLIDE_2", fontSize: 22, bold: true, color: "#FFFFFF", alignment: "center", fill: GRADE_THEMES[grade - 1].jade, borderRadius: "rounded-full", insets: { top: 8, right: 8, bottom: 8, left: 8 } });
  // 右下角注明课程定位，保持专业完整。
  addText(slide, "新思度华文学堂｜小学成语分级学习", { left: 790, top: 640, width: 390, height: 28 }, { fontSize: 13, color: "#7A8587", alignment: "right", insets: { top: 0, right: 0, bottom: 0, left: 0 } });
  // 封面备注说明图片来源和课程结构，教师可在备注区查看。
  slide.speakerNotes.textFrame.setText(["本页主视觉为本项目新生成素材。", "本册每个成语连续两页，完整覆盖六个国学板块。"]);
}


/**
 * 创建年级目录页，目录按钮直接跳转到目标成语故事页。
 */
function addDirectorySlides(presentation, grade, lessons, directoryCount) {
  // 按每页12条切分目录。
  for (let pageIndex = 0; pageIndex < directoryCount; pageIndex += 1) {
    // 新建一张目录页。
    const slide = presentation.slides.add();
    // 使用主题浅色作为目录背景，保持少儿感但不花哨。
    slide.background.fill = `linear(135deg, #FFFDF8 0%, ${GRADE_THEMES[grade - 1].pale} 100%)`;
    // 页眉标记目录和页码。
    addChrome(slide, grade, "本册目录", pageIndex + 2, { home: 2, prev: null, next: null });
    // 目录主标题显示当前分页。
    addText(slide, `${grade}年级成语目录`, { left: 62, top: 80, width: 470, height: 64 }, { fontSize: 36, bold: true, color: GRADE_THEMES[grade - 1].deep, insets: { top: 0, right: 0, bottom: 0, left: 0 } });
    // 目录分页说明降低查找压力。
    addText(slide, `第 ${pageIndex + 1} / ${directoryCount} 页｜点击成语即可进入`, { left: 62, top: 142, width: 420, height: 36 }, { fontSize: 16, color: "#687B80", insets: { top: 0, right: 0, bottom: 0, left: 0 } });
    // 取出当前页的12条成语。
    const pageLessons = lessons.slice(pageIndex * DIRECTORY_PAGE_SIZE, (pageIndex + 1) * DIRECTORY_PAGE_SIZE);
    // 以3列4行网格排布按钮。
    pageLessons.forEach((lesson, localIndex) => {
      // 当前按钮列号决定水平位置。
      const column = localIndex % 3;
      // 当前按钮行号决定垂直位置。
      const row = Math.floor(localIndex / 3);
      // 每个成语的故事页是目录区之后按两页一组排列。
      const absoluteIndex = pageIndex * DIRECTORY_PAGE_SIZE + localIndex;
      // 计算PowerPoint一基页码：封面1＋目录页数＋当前成语之前的两页＋故事页1。
      const targetSlide = 2 + directoryCount + absoluteIndex * 2;
      // 按钮采用大字号成语和小字号拼音的两层结构。
      addCard(slide, { left: 62 + column * 390, top: 198 + row * 106, width: 354, height: 88 }, "#FFFFFF/88", `${GRADE_THEMES[grade - 1].accent}/24`, `DIR_CARD_${lesson.lesson_index}`);
      // 拼音放在按钮上方，帮助按读音查找。
      addText(slide, lesson.final_pinyin, { left: 76 + column * 390, top: 205 + row * 106, width: 322, height: 26 }, { fontSize: 13, color: "#778589", alignment: "center", typeface: FONT_PINYIN, insets: { top: 0, right: 0, bottom: 0, left: 0 } });
      // 成语文本承担链接区域，点击即可进入故事页。
      addText(slide, lesson.idiom, { left: 76 + column * 390, top: 228 + row * 106, width: 322, height: 48 }, { name: `LINK_SLIDE_${targetSlide}`, fontSize: 25, bold: true, color: GRADE_THEMES[grade - 1].deep, alignment: "center", insets: { top: 0, right: 0, bottom: 0, left: 0 } });
    });
    // 目录分页前进按钮只在非末页显示。
    if (pageIndex < directoryCount - 1) {
      addText(slide, "下一页目录 →", { left: 1050, top: 610, width: 154, height: 40 }, { name: `LINK_SLIDE_${pageIndex + 3}`, fontSize: 15, bold: true, color: "#FFFFFF", alignment: "center", fill: GRADE_THEMES[grade - 1].jade, borderRadius: "rounded-full", insets: { top: 4, right: 6, bottom: 4, left: 6 } });
    }
    // 目录分页返回按钮只在非首页显示。
    if (pageIndex > 0) {
      addText(slide, "← 上一页目录", { left: 870, top: 610, width: 164, height: 40 }, { name: `LINK_SLIDE_${pageIndex + 1}`, fontSize: 15, bold: true, color: GRADE_THEMES[grade - 1].jade, alignment: "center", fill: "#FFFFFF/78", borderRadius: "rounded-full", insets: { top: 4, right: 6, bottom: 4, left: 6 } });
    }
  }
}


/**
 * 创建成语第一页，合并诵读正音、观图入境和典故寻源。
 */
function addStorySlide(presentation, lesson, grade, slideNumber, nav, imageBytes) {
  // 新建故事页。
  const slide = presentation.slides.add();
  // 先铺满当前成语专属原创插画，形成真正的全页绘本页面。
  addFullBleedIllustration(slide, lesson, imageBytes);
  // 添加统一页眉和导航。
  // 页眉根据内容性质区分真实典故与生活绘本，避免把现代情境误称为古代出处。
  addChrome(slide, grade, lesson.story_type === "典故绘本" ? "诵读正音 · 观图入境 · 典故寻源" : "诵读正音 · 观图入境 · 生活绘本", slideNumber, nav);
  // 左侧文字卡叠在插画预留水彩区上，60%不透明度对应PowerPoint透明度40%。
  addCard(slide, { left: 58, top: 64, width: 524, height: 586 }, "#FFFDF7/60", "#FFFFFF/18", `STORY_PANEL_${lesson.lesson_index}`);
  // 读音标签提示本页第一项学习任务。
  addText(slide, "诵读正音 · 观图入境", { left: 94, top: 88, width: 250, height: 30 }, { fontSize: 16, bold: true, color: GRADE_THEMES[grade - 1].accent, lineSpacing: 1, insets: { top: 0, right: 0, bottom: 0, left: 0 } });
  // 成语采用逐字上注拼音的固定标题结构。
  addPinyinTitle(slide, lesson, { left: 92, top: 126, width: 456, height: 96 }, GRADE_THEMES[grade - 1].deep);
  // 绘本类型明确区分历史典故和生活情境，防止误把生活故事当出处。
  addText(slide, lesson.story_type, { left: 94, top: 234, width: 150, height: 32 }, { fontSize: 15, bold: true, color: "#FFFFFF", alignment: "center", fill: lesson.story_type === "典故绘本" ? GRADE_THEMES[grade - 1].jade : "#7C8F87", borderRadius: "rounded-full", lineSpacing: 1, insets: { top: 3, right: 6, bottom: 3, left: 6 } });
  // 故事正文控制在大字号可读范围，并按原有句号自然换行。
  addText(slide, formatStoryParagraphs(lesson.story), { left: 92, top: 284, width: 456, height: 292 }, { fontSize: 20, color: "#29424D", verticalAlignment: "top", lineSpacing: 1.5, insets: { top: 2, right: 0, bottom: 0, left: 0 } });
  // 页底说明故事性质，强化内容可信边界。
  addText(slide, lesson.story_note, { left: 94, top: 596, width: 452, height: 32 }, { fontSize: 11, color: "#718083", lineSpacing: 1.1, insets: { top: 0, right: 0, bottom: 0, left: 0 } });
  // 备注区保留教师提示，便于讲故事时先看图再读文。
  slide.speakerNotes.textFrame.setText(["教学建议：先遮住故事文字看图猜情节，再朗读故事。", lesson.story_note]);
}


/**
 * 创建成语第二页，合并释义明理、学以致用和启智润心。
 */
function addPracticeSlide(presentation, lesson, grade, slideNumber, nav, imageBytes) {
  // 新建讲解与运用页。
  const slide = presentation.slides.add();
  // 继续铺满同一成语的原创插画，保证故事与释义页面视觉连续。
  addFullBleedIllustration(slide, lesson, imageBytes);
  // 添加统一页眉和导航。
  addChrome(slide, grade, "释义明理 · 学以致用 · 启智润心", slideNumber, nav);
  // 左侧统一使用参考图式大卡，60%不透明度对应PowerPoint透明度40%。
  addCard(slide, { left: 58, top: 64, width: 524, height: 586 }, "#FFFDF7/60", "#FFFFFF/18", `PRACTICE_PANEL_${lesson.lesson_index}`);
  // 页面顶部继续使用逐字注音标题，避免拼音与汉字分离。
  addPinyinTitle(slide, lesson, { left: 92, top: 82, width: 456, height: 96 }, GRADE_THEMES[grade - 1].deep);
  // 释义板块名称使用年级强调色。
  addText(slide, "释义明理", { left: 94, top: 196, width: 148, height: 28 }, { fontSize: 16, bold: true, color: GRADE_THEMES[grade - 1].accent, lineSpacing: 1, insets: { top: 0, right: 0, bottom: 0, left: 0 } });
  // 核心释义使用两行左右的大字号短文。
  addText(slide, `　　${lesson.meaning}`, { left: 92, top: 228, width: 456, height: 90 }, { fontSize: 19, color: "#29424D", verticalAlignment: "top", lineSpacing: 1.5, insets: { top: 0, right: 0, bottom: 0, left: 0 } });
  // 学以致用标题建立板块层级。
  addText(slide, "学以致用", { left: 94, top: 326, width: 148, height: 28 }, { fontSize: 16, bold: true, color: GRADE_THEMES[grade - 1].accent, lineSpacing: 1, insets: { top: 0, right: 0, bottom: 0, left: 0 } });
  // 例句以完整句子呈现，适合全班跟读。
  addText(slide, `　　${lesson.example}`, { left: 92, top: 358, width: 456, height: 86 }, { fontSize: 18, color: "#29424D", verticalAlignment: "top", lineSpacing: 1.5, insets: { top: 0, right: 0, bottom: 0, left: 0 } });
  // 生活问题单独另起一段，避免一堆文字挤在一起。
  addText(slide, `想一想｜${lesson.life_prompt}`, { left: 92, top: 452, width: 456, height: 66 }, { fontSize: 17, bold: true, color: GRADE_THEMES[grade - 1].jade, verticalAlignment: "top", lineSpacing: 1.4, insets: { top: 0, right: 0, bottom: 0, left: 0 } });
  // 启智润心标题用印章红强调。
  addText(slide, "启智润心", { left: 94, top: 526, width: 148, height: 28 }, { fontSize: 16, bold: true, color: GRADE_THEMES[grade - 1].accent, lineSpacing: 1, insets: { top: 0, right: 0, bottom: 0, left: 0 } });
  // 启示文字控制在两至三行，并留出充分行距。
  addText(slide, `　　${lesson.moral}`, { left: 92, top: 558, width: 456, height: 72 }, { fontSize: 18, bold: true, color: GRADE_THEMES[grade - 1].deep, verticalAlignment: "top", lineSpacing: 1.4, insets: { top: 0, right: 0, bottom: 0, left: 0 } });
  // 备注区提示教师让学生先造句再看示例。
  slide.speakerNotes.textFrame.setText(["教学建议：先请孩子口头造句，再显示或朗读课件例句。", "生活问题可作为同桌交流或课后口语作业。"]);
}


/**
 * 导出单个演示文稿到项目目录和成品目录。
 */
async function exportDeck(presentation, filename) {
  // 导出为真正可编辑的PPTX文件。
  const pptx = await PresentationFile.exportPptx(presentation);
  // 项目稿保留与生成器同目录，便于后续重建。
  await pptx.save(path.join(PROJECT_DIR, filename));
  // 同一PPTX再次导出到成品目录，用户从统一目录获取。
  const productPptx = await PresentationFile.exportPptx(presentation);
  // 写入最终交付目录。
  await productPptx.save(path.join(PRODUCT_DIR, filename));
  // 输出每册首页预览和整册蒙太奇，供快速视觉审查。
  const deckPreviewDir = path.join(PREVIEW_DIR, filename.replace(/\.pptx$/i, ""));
  // 创建当前册预览目录。
  await fs.mkdir(deckPreviewDir, { recursive: true });
  // 导出首页作为尺寸和字体首检。
  const firstPng = await presentation.export({ slide: presentation.slides.items[0], format: "png", scale: 1 });
  // 保存首页PNG。
  await fs.writeFile(path.join(deckPreviewDir, "首页.png"), new Uint8Array(await firstPng.arrayBuffer()));
  // 导出低倍率蒙太奇用于整册版式一致性检查。
  const montage = await presentation.export({ format: "webp", montage: true, scale: 0.35 });
  // 保存整册蒙太奇。
  await fs.writeFile(path.join(deckPreviewDir, "整册蒙太奇.webp"), new Uint8Array(await montage.arrayBuffer()));
}


/**
 * 构建一册年级PPT。
 */
async function buildGradeDeck(grade, sourceLessons) {
  // 测试模式可只取前若干条，正式模式使用该年级全部成语。
  const lessons = TEST_IDIOM_LIMIT > 0 ? sourceLessons.slice(0, TEST_IDIOM_LIMIT) : sourceLessons;
  // 计算当前册需要多少张目录页。
  const directoryCount = Math.ceil(lessons.length / DIRECTORY_PAGE_SIZE);
  // 创建16:9演示文稿。
  const presentation = Presentation.create({ slideSize: SLIDE_SIZE });
  // 读取本册第一条成语的新生成插画作为封面背景，避免继续使用旧版年级主视觉。
  const coverBytes = await fs.readFile(lessons[0].image_path);
  // 添加封面。
  await addGradeCover(presentation, grade, lessons, coverBytes);
  // 添加可点击的分页目录。
  addDirectorySlides(presentation, grade, lessons, directoryCount);
  // 为每个成语连续生成故事页和讲解页。
  for (let index = 0; index < lessons.length; index += 1) {
    // 读取当前成语专属原创插画，确保每条内容都对应自己的故事画面。
    const lesson = lessons[index];
    // 等待图片字节加载完成后再添加页面，避免异步顺序打乱目录链接。
    const imageBytes = await fs.readFile(lesson.image_path);
    // 当前成语故事页的一基页码。
    const storySlideNumber = 2 + directoryCount + index * 2;
    // 当前成语讲解页紧接故事页。
    const practiceSlideNumber = storySlideNumber + 1;
    // 上一成语目标统一跳到上一成语故事页。
    const prevStory = index > 0 ? storySlideNumber - 2 : null;
    // 下一成语目标统一跳到下一成语故事页。
    const nextStory = index < lessons.length - 1 ? storySlideNumber + 2 : null;
    // 故事页的下一按钮进入本成语讲解页，上一按钮回到上一成语故事页。
    addStorySlide(presentation, lesson, grade, storySlideNumber, { home: 2, prev: prevStory, next: practiceSlideNumber }, imageBytes);
    // 讲解页的上一按钮返回本成语故事页，下一按钮进入下一成语故事页。
    addPracticeSlide(presentation, lesson, grade, practiceSlideNumber, { home: 2, prev: storySlideNumber, next: nextStory }, imageBytes);
  }
  // 文件名使用两位序号，确保目录按年级自然排序。
  const filename = `${String(grade).padStart(2, "0")}_${grade}年级成语故事.pptx`;
  // 导出项目稿、成品和快速预览。
  await exportDeck(presentation, filename);
  // 返回统计信息供日志与验证使用。
  return { grade, lessons: lessons.length, slides: presentation.slides.items.length, filename };
}


/**
 * 构建跨文件总目录PPT。
 */
async function buildMasterDeck(gradeGroups) {
  // 创建两页式总目录演示文稿。
  const presentation = Presentation.create({ slideSize: SLIDE_SIZE });
  // 读取六年级第一条成语的新生成插画作为总封面背景。
  const coverBytes = await fs.readFile(gradeGroups.get(6)[0].image_path);
  // 新建总封面页。
  const cover = presentation.slides.add();
  // 封面以图片铺满，建立完整课程的远景感。
  cover.images.add({ blob: coverBytes, contentType: "image/jpeg", alt: "成语学习总目录主视觉", fit: "cover", position: { left: 0, top: 0, width: 1280, height: 720 } });
  // 左侧大面板使用60%不透明度，对应PowerPoint透明度40%。
  addCard(cover, { left: 74, top: 92, width: 560, height: 520 }, "#FFFDF7/60", "#FFFFFF/18", "MASTER_COVER_PANEL");
  // 主标题明确课程范围。
  addText(cover, "小学一至六年级\n成语绘本学习", { left: 124, top: 154, width: 460, height: 190 }, { fontSize: 49, bold: true, color: "#3E4C52", insets: { top: 0, right: 0, bottom: 0, left: 0 } });
  // 副标题说明搜索与导航能力。
  addText(cover, "274条成语｜六个国学板块｜点击直达｜随时返回目录", { left: 126, top: 382, width: 440, height: 80 }, { fontSize: 20, color: "#566A70", insets: { top: 0, right: 0, bottom: 0, left: 0 } });
  // 封面按钮进入第二页总目录。
  addText(cover, "打开学习地图  →", { left: 126, top: 510, width: 320, height: 64 }, { name: "LINK_SLIDE_2", fontSize: 22, bold: true, color: "#FFFFFF", alignment: "center", fill: "#377B72", borderRadius: "rounded-full", insets: { top: 8, right: 8, bottom: 8, left: 8 } });
  // 新建跨文件目录页。
  const directory = presentation.slides.add();
  // 总目录背景保持专业大方的暖白渐变。
  directory.background.fill = "linear(135deg, #FFFDF8 0%, #F3EEE4 100%)";
  // 添加总目录页眉。
  addChrome(directory, 0, "成语学习总目录", 2, { home: null, prev: null, next: null });
  // 主标题提示选择年级。
  addText(directory, "选择年级，开始一段成语旅程", { left: 62, top: 82, width: 760, height: 70 }, { fontSize: 38, bold: true, color: "#3C5057", insets: { top: 0, right: 0, bottom: 0, left: 0 } });
  // 说明所有册别的查找方式相同。
  addText(directory, "每册都有成语目录、直达按钮、上一条/下一条和返回目录。", { left: 64, top: 148, width: 740, height: 38 }, { fontSize: 17, color: "#6B7C80", insets: { top: 0, right: 0, bottom: 0, left: 0 } });
  // 六个年级以两行三列排布。
  for (let grade = 1; grade <= 6; grade += 1) {
    // 当前年级在网格中的列位置。
    const column = (grade - 1) % 3;
    // 当前年级在网格中的行位置。
    const row = Math.floor((grade - 1) / 3);
    // 获取当前年级条目数。
    const count = gradeGroups.get(grade).length;
    // 创建大面积卡片承载年级入口。
    addCard(directory, { left: 62 + column * 390, top: 218 + row * 188, width: 354, height: 154 }, "#FFFFFF/90", `${GRADE_THEMES[grade - 1].accent}/26`, `MASTER_GRADE_CARD_${grade}`);
    // 年级名称作为可点击的跨文件链接区域。
    addText(directory, `${grade}年级`, { left: 90 + column * 390, top: 246 + row * 188, width: 298, height: 58 }, { name: `LINK_FILE_GRADE_${grade}`, fontSize: 34, bold: true, color: GRADE_THEMES[grade - 1].deep, alignment: "center", insets: { top: 0, right: 0, bottom: 0, left: 0 } });
    // 显示条目数和视觉主题，帮助家长理解分级规模。
    addText(directory, `${count} 条｜国学绘本课`, { left: 90 + column * 390, top: 314 + row * 188, width: 298, height: 34 }, { fontSize: 16, color: GRADE_THEMES[grade - 1].jade, alignment: "center", insets: { top: 0, right: 0, bottom: 0, left: 0 } });
  }
  // 总目录页备注说明跨文件链接需要七个PPT保持同一文件夹。
  directory.speakerNotes.textFrame.setText(["使用提示：请保持00总目录和01—06年级PPT位于同一文件夹。", "点击年级卡片可打开相应年级课件。"]);
  // 导出总目录PPT。
  await exportDeck(presentation, "00_成语学习总目录.pptx");
  // 返回总目录统计信息。
  return { slides: presentation.slides.items.length, filename: "00_成语学习总目录.pptx" };
}


/**
 * 主流程：读取内容、按年级生成七个PPT并输出统计清单。
 */
async function main() {
  // 创建项目、成品和验证目录。
  await Promise.all([fs.mkdir(PROJECT_DIR, { recursive: true }), fs.mkdir(PRODUCT_DIR, { recursive: true }), fs.mkdir(PREVIEW_DIR, { recursive: true })]);
  // 读取全量课程JSON。
  const lessons = JSON.parse(await fs.readFile(CONTENT_JSON, "utf8"));
  // 读取含真实典故与出处的公开成语故事词典。
  const dictionaryEntries = JSON.parse(await fs.readFile(DICTIONARY_JSON, "utf8"));
  // 读取每条成语的新生成插画路径与关键场景。
  const imageManifest = JSON.parse(await fs.readFile(IMAGE_MANIFEST_JSON, "utf8"));
  // 读取一年级人工逐条改写内容，优先覆盖机器基线。
  const grade1Content = JSON.parse(await fs.readFile(GRADE1_CONTENT_JSON, "utf8"));
  // 按成语建立词典索引，后续274条记录可直接定位而不重复遍历大型文件。
  const dictionaryMap = new Map(dictionaryEntries.map((entry) => [entry.word, entry]));
  // 按“年级＋成语”建立插画索引，避免跨年级同名词条互相覆盖路径。
  const imageMap = new Map(imageManifest.map((entry) => [`${entry.grade}:${entry.idiom}`, entry]));
  // 逐条补入真实典故、规范释义、人工内容与新图路径。
  lessons.forEach((lesson) => {
    // 取得当前成语的公开词典记录；未收录的现代短语保持项目核定内容。
    const dictionary = dictionaryMap.get(lesson.idiom);
    // 取得一年级人工故事；其他年级没有记录时返回空对象。
    const manual = lesson.grade === 1 ? grade1Content[lesson.idiom] : null;
    // 取得当前成语的原创插画清单记录。
    const visual = imageMap.get(`${lesson.grade}:${lesson.idiom}`);
    // 规范释义优先采用公开词典，一年级与未收录词条保留项目原释义。
    lesson.meaning = dictionary?.explanation || lesson.meaning;
    // 有真实典故故事时标为典故绘本，其余明确标为生活绘本。
    lesson.story_type = dictionary?.story?.length ? "典故绘本" : "生活绘本";
    // 一年级人工三段故事优先，其次使用公开词典真实典故，最后才回退到生活情境基线。
    lesson.story = manual?.story?.join("\n\n") || dictionary?.story?.[0] || lesson.story;
    // 一年级人工例句优先，其他年级继续使用适合课堂朗读的项目例句。
    lesson.example = manual?.example || lesson.example;
    // 一年级人工启示优先，其他年级保留围绕词义的启智问题。
    lesson.moral = manual?.moral || lesson.moral;
    // 真实典故显示出处书名，生活绘本明确说明不虚构古代出处。
    lesson.story_note = dictionary?.story?.length ? `典故来源：${dictionary.source?.book || dictionary.derivation || "公开成语词典"}` : "生活情境绘本：帮助理解词义，不作为历史出处。";
    // PPT嵌入同尺寸高质量JPEG副本以控制百页课件内存，原始PNG素材继续完整保留。
    lesson.image_path = visual?.output?.replace(/\.png$/i, ".jpg");
  });
  // 缺少插画路径会导致页面错配，因此在正式生成前立即终止并列出词条。
  const missingImagePaths = lessons.filter((lesson) => !lesson.image_path);
  // 若清单本身缺词，抛出明确错误而不是静默生成空白页。
  if (missingImagePaths.length) throw new Error(`插画清单缺少：${missingImagePaths.map((lesson) => lesson.idiom).join("、")}`);
  // 按年级建立映射，保持源文档顺序。
  const gradeGroups = new Map();
  // 初始化六个年级空数组。
  for (let grade = 1; grade <= 6; grade += 1) gradeGroups.set(grade, []);
  // 把每条课程记录放入对应年级。
  lessons.forEach((lesson) => gradeGroups.get(lesson.grade).push(lesson));
  // 初始化生成统计；测试指定年级时先跳过依赖六年级图片的总目录。
  const results = [];
  // 正式全量运行时先生成总目录，使后续链接补丁拥有稳定文件名集合。
  if (TEST_GRADE === 0) results.push(await buildMasterDeck(gradeGroups));
  // 逐年级生成课件；测试模式可只生成指定年级。
  for (let grade = 1; grade <= 6; grade += 1) {
    // 若设置了测试年级，则跳过其他年级。
    if (TEST_GRADE > 0 && grade !== TEST_GRADE) continue;
    // 生成当前年级完整课件。
    results.push(await buildGradeDeck(grade, gradeGroups.get(grade)));
  }
  // 写出生成统计，后续验证脚本据此核对页数。
  await fs.writeFile(path.join(PROJECT_DIR, "生成统计.json"), JSON.stringify(results, null, 2), "utf8");
  // 向终端输出结果，便于执行文档记录。
  console.log(JSON.stringify(results));
}


// 运行主流程；任一册导出失败都会以非零状态退出，阻止错误交付。
main().catch((error) => {
  // 输出完整错误堆栈，便于定位具体形状或导出阶段。
  console.error(error);
  // 设置失败状态，由外层连续执行流程捕获并修复。
  process.exitCode = 1;
});
