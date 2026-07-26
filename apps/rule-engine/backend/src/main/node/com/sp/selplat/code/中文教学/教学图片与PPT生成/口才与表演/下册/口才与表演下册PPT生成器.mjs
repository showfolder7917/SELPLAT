import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// 生成器优先使用显式工程根，保证能力从不同任务页面调用时仍写入当前工程。
const PROJECT_ROOT = path.resolve(process.env.SELPLAT_PROJECT_ROOT || process.cwd());
// 大体积artifact-tool依赖固定从工程缓存加载，禁止复制到规则引擎源码。
const ARTIFACT_TOOL_ENTRY = path.join(PROJECT_ROOT, "cache/node-modules/@oai/artifact-tool/dist/artifact_tool.mjs");
// 缓存缺失时立即失败，避免静默回退到临时依赖。
await fs.access(ARTIFACT_TOOL_ENTRY);
// 文件URL用于稳定加载缓存内ES模块。
const { Presentation, PresentationFile } = await import(pathToFileURL(ARTIFACT_TOOL_ENTRY).href);
// 全量分析器生成的覆盖清单是下册内容唯一入口。
const COVERAGE_PATH = path.join(PROJECT_ROOT, "apps/rule-engine/backend/src/main/resources/中文教学/template/口才与表演/下册/课程内容索引.json");
// 正式成品进入口才与表演下册目录并保持原始文件名。
const OUTPUT_ROOT = path.join(PROJECT_ROOT, "OPTION/temp/中文教学/教学图片与PPT生成/成品/口才与表演/下册");
// 真实品牌Logo由规则引擎长期维护。
const LOGO_PATH = path.join(PROJECT_ROOT, "apps/rule-engine/backend/src/main/resources/中文教学/assets/品牌/新思度华文学堂.png");
// 已确认透明玻璃播放按钮属于全系列可复用缓存资产。
const AUDIO_BUTTON_PATH = path.join(PROJECT_ROOT, "cache/中文教学/口才与表演/中册/控件/音频按钮_透明玻璃.png");
// 下册原创插图按课次缓存，生成器只能读取这一目录，禁止回退到旧PPT媒体或教材截图。
const ORIGINAL_ASSET_ROOT = path.join(PROJECT_ROOT, "cache/中文教学/口才与表演/下册/原创插图");
// 统一16:9画布与已确认第一课保持一致。
const SLIDE_SIZE = { width: 1280, height: 720 };
// 中文教学正文使用本机稳定思源黑体。
const FONT_SANS = "Noto Sans CJK SC";
// 诗歌和故事正文使用思源宋体增强绘本阅读感。
const FONT_SERIF = "Noto Serif CJK SC";
// 当前页码由生成过程连续推进，确保扩展教材页后仍保持稳定顺序。
let outputPageNumber = 0;
// 暖白、水彩青、珊瑚和柔黄构成下册统一色板。
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
// 新版口才之歌在全系列统一使用，禁止回退到旧课件占位歌词。
const NEW_SONG = [
  "学口才，练口才，想学口才跟我来。",
  "小舞台，大梦想，自信登台展风采。",
  "同学们，快快来，游戏课堂真精彩。",
  "",
  "口才课，有口令，大家一起说出来：",
  "勇敢讲，声音开；自信演，站稳台。",
  "认真学，大胆来，学好口才更出彩！",
].join("\n");
// 教材照片只用于确认文字和教学关系；这里保存已经提取、校正并可编辑的教材内容。
const SUPPLEMENT_FACTS = {
  // 第一课教材包含《分苹果》分段表演和“分享萝卜汤”看图表达。
  "11.JPG": { title: "《分苹果》· 选择", body: "外婆给宝宝带来一大篮红苹果。\n宝宝挑选了一个最大、最红的苹果。" },
  "12.JPG": { title: "《分苹果》· 分享", body: "宝宝没有独自吃苹果，而是把苹果递给外婆：\n“外婆，您也吃苹果吧！”" },
  "13.JPG": { title: "《分苹果》· 夸奖", body: "外婆接过苹果，抱住宝宝说：\n“我的好乖乖，你真是一个懂事的好孩子！”" },
  "14.JPG": { title: "看图说话", body: "分享好喝的萝卜汤。\n按顺序说清楚：谁准备了萝卜汤？谁主动分享？大家的心情怎样？" },
  // 第二课教材用完整故事说明“诚实比漂亮结果更重要”。
  "21.JPG": { title: "《手捧空花盆的孩子》· 国王选继承人", body: "国王把花籽发给孩子们，请大家用心种植。\n三个月后，他要根据种花结果选择未来的国王。" },
  "22.JPG": { title: "《手捧空花盆的孩子》· 空花盆", body: "别的孩子捧着鲜花，只有一个孩子捧着空花盆。\n他说：“我每天认真浇水，可花籽一直没有发芽。”" },
  "23.JPG": { title: "《手捧空花盆的孩子》· 真相", body: "国王高兴地说：“我找到诚实的孩子了！”\n原来，发给大家的花籽都是煮过的，不可能发芽。" },
  "24.JPG": { title: "诚实地演一演", body: "分角色表演国王和孩子的对话。\n想一想：面对没有发芽的花籽，孩子为什么仍然捧着空花盆来？" },
  "25.JPG": { title: "看图说话", body: "诚实的弘弘。\n观察事情的起因、经过和结果，用“先……接着……最后……”完整表达。" },
  // 第三课教材通过小羊脱险和小兔守门训练安全判断。
  "31.JPG": { title: "《聪明的小羊》· 想办法", body: "小羊被狼捉住了，但它没有放弃。\n它请求在被吃掉以前，先用笛子给狼吹一支曲子。" },
  "32.JPG": { title: "《聪明的小羊》· 成功脱险", body: "笛声引来了牧人，狼吓得飞快逃走。\n说一说：小羊为什么能脱险？" },
  "33.JPG": { title: "安全情境表演", body: "《小兔乖乖》：陌生人敲门时不能随便开门。\n练习询问身份、及时求助和保护自己的正确做法。" },
  // 第四课教材用演讲与生活故事表达对母亲的爱。
  "41.JPG": { title: "《我爱妈妈》· 开场", body: "大家好，我今天演讲的题目是《我爱妈妈》。\n妈妈的怀抱温暖我，也陪伴我快乐成长。" },
  "42.JPG": { title: "《我爱妈妈》· 行动", body: "在特别的日子里，把祝福送给妈妈。\n让我们用一个拥抱表达感谢。" },
  "43.JPG": { title: "《我爱妈妈》· 完整表达", body: "先说妈妈怎样关爱我，再说我想为妈妈做什么，最后向大家致谢。" },
  "44.JPG": { title: "看图讲故事", body: "懂事的文文。\n观察文文为家人做了什么，把人物、动作和心情讲清楚。" },
  // 第五课教材用跳蚤说大话的故事建立谦逊表达。
  "51.JPG": { title: "《跳蚤》· 夸口", body: "跳蚤跳到黄牛鼻尖上，觉得自己很了不起。\n它夸口说：“世界上没有比我更大的动物了。”" },
  "52.JPG": { title: "《跳蚤》· 明白道理", body: "小蜜蜂提醒跳蚤看看自己站在哪里。\n想一想：跳蚤为什么闹了笑话？" },
  "53.JPG": { title: "看图讲故事", body: "说大话的河马和大象。\n比较“事实”和“夸口”，练习实事求是地介绍自己的本领。" },
  // 第六课教材突出细心观察和完整比较。
  "61.JPG": { title: "《粗心的小画家》· 找错误", body: "螃蟹画成四条腿，鸭子画成尖嘴巴，兔子画成圆耳朵，大马忘了画尾巴。" },
  "62.JPG": { title: "《粗心的小画家》· 改一改", body: "观察每种动物的真实特点，把画错的地方逐一改正。\n说话时使用“应该……而不是……”。" },
  "63.JPG": { title: "找不同", body: "细心观察两幅图，找出不同的地方。\n按“位置＋变化”逐条说明，不重复、不遗漏。" },
  // 第七课教材用救助故事理解宽容，但不复用任何既有角色形象。
  "71.JPG": { title: "《小猪救狐狸》· 听见求救", body: "小猪听到狐狸呼救，立刻准备去帮助它。\n伙伴提醒：狐狸以前还骗过大家。" },
  "72.JPG": { title: "《小猪救狐狸》· 宽容", body: "小猪说：“它现在遇到危险，我们应该先救它。”\n狐狸获救后向大家诚恳道歉。" },
  "73.JPG": { title: "宽容地说", body: "练习礼貌表达：\n“没关系，我愿意原谅你。”\n“谢谢你，我会改正。”" },
  "74.JPG": { title: "看图讲故事", body: "宽宏大量的小老鼠。\n根据原创画面讲清冲突、原谅和重新成为朋友的过程。" },
  // 第八课教材从家人、老师、朋友和寓言故事理解感恩。
  "81.JPG": { title: "《感恩的心》", body: "感恩爸爸妈妈给我温暖的家，感恩老师教给我知识，感恩朋友陪伴我成长。" },
  "82.JPG": { title: "感谢家人", body: "爸爸妈妈为我遮风挡雨、准备饭菜、陪伴成长。\n我想对他们说：“谢谢你们，我爱你们！”" },
  "83.JPG": { title: "看图讲故事", body: "《蚂蚁报恩》。\n说清楚谁先帮助了蚂蚁，蚂蚁后来怎样回报这份善意。" },
  // 第九课教材用迷路的小蚂蚁和小老鼠故事训练互助表达。
  "91.JPG": { title: "《一只迷路的小蚂蚁》· 相遇", body: "小蚂蚁爬到娃娃手上，请求不要伤害它。\n娃娃发现它和伙伴走散了。" },
  "92.JPG": { title: "《一只迷路的小蚂蚁》· 回家", body: "娃娃找到不远处的蚂蚁队伍，轻轻把小蚂蚁送回去。" },
  "93.JPG": { title: "《一只迷路的小蚂蚁》· 表演", body: "分角色演一演娃娃和小蚂蚁。\n注意使用关心、询问和感谢的语气。" },
  "94.JPG": { title: "看图讲故事", body: "互相帮助的小老鼠。\n按照画面顺序说明大家遇到的困难和合作办法。" },
  // 第十课教材用三句半和生活故事倡导主动劳动。
  "101.JPG": { title: "《我愿做个好孩子》· 以前", body: "四人合作表演三句半：以前在家淘气、依赖长辈，许多事情都让爸爸妈妈帮助。" },
  "102.JPG": { title: "《我愿做个好孩子》· 现在", body: "学习口才和礼仪后，我会给爷爷捶背、给奶奶倒水，自己的事情自己做。" },
  "103.JPG": { title: "三句半表演", body: "四人一组分角色朗读并表演。\n前三人铺陈内容，第四人用简短有力的词语收尾。" },
  "104.JPG": { title: "看图讲故事", body: "爱劳动的弘弘。\n观察弘弘做了哪些家务，说说劳动前后环境有什么变化。" },
  // 第十一课教材从不同地域和季节感受祖国辽阔。
  "111.JPG": { title: "《我们的祖国真大》", body: "北方十月已经飘雪，南方一年四季鲜花盛开。\n同一时间，有的孩子滑雪，有的孩子游泳。" },
  "112.JPG": { title: "祖国南北", body: "比较北方和南方的季节、天气与活动。\n用“有的……有的……”说完整句。" },
  "113.JPG": { title: "看图连一连", body: "观察不同国家和地区的代表性画面，再按线索完成对应。\n表达时说明自己的判断依据。" },
  // 第十二课教材用动物园对话练习礼貌问候。
  "121.JPG": { title: "《打招呼》· 动物园对话", body: "围绕“去过动物园吗”“喜欢哪些动物”展开问答，注意先问好再提问。" },
  "122.JPG": { title: "《打招呼》· 幽默收尾", body: "伙伴询问是否敢和老虎亲近，回答要配合语气和表情，形成自然收尾。" },
  "123.JPG": { title: "分角色问答", body: "轮流扮演提问者和回答者。\n做到看着对方、认真倾听、礼貌回应。" },
  "124.JPG": { title: "看图讲故事", body: "会打招呼、懂礼貌的小白兔。\n练习在家里、学校和公共场所使用合适的问候语。" },
  // 第十三课教材用儿歌和安全情境体验春节。
  "131.JPG": { title: "《新年到》", body: "新年到，步步高；合家欢聚在今宵。\n孩子们唱歌又跳舞，把祝福送给每个人。" },
  "132.JPG": { title: "新年祝福", body: "选择合适的对象送祝福，并配合自然的动作和表情。" },
  "133.JPG": { title: "春节安全", body: "看图说说春节活动。\n燃放烟花爆竹必须由成人负责，儿童保持安全距离。" },
  // 第十四课教材认识生肖并讲述排序故事。
  "141.JPG": { title: "《生肖歌》", body: "按顺序认识十二生肖，用节奏朗读并配合动物动作。" },
  "142.JPG": { title: "十二生肖", body: "鼠、牛、虎、兔、龙、蛇、马、羊、猴、鸡、狗、猪。\n按顺序读一读，再说说自己的生肖。" },
  "143.JPG": { title: "看图讲故事", body: "为什么老鼠排第一？\n根据原创画面讲清比赛的开始、经过和结果。" },
  // 第十五课教材包含儿童节主持词和节日场景。
  "151.JPG": { title: "六一文艺演出主持词· 开场", body: "亲爱的家人和小朋友们，大家好！\n我们迈着喜悦的步子走进自己的节日，联欢会现在开始。" },
  "152.JPG": { title: "六一文艺演出主持词· 过渡", body: "我们是祖国的春天和希望，也是新时代温暖明亮的阳光。" },
  "153.JPG": { title: "六一文艺演出主持词· 结束", body: "感谢老师和家长的教育与陪伴。\n祝大家身体健康、学习进步、天天快乐！" },
  "154.JPG": { title: "看图说话", body: "快乐的儿童节。\n按照“环境—人物—活动—心情”的顺序介绍节日画面。" },
  // 第十六课教材用诗歌、才艺表达和入学故事完成全册收束。
  "161.JPG": { title: "《老师，您好》· 感谢", body: "早晨走进学校，我们亲切地问候老师。\n老师为我们的成长付出时间和心血。" },
  "162.JPG": { title: "《老师，您好》· 敬意", body: "无论将来走到哪里，见到老师都要深深鞠躬，恭敬地说：“老师，您好！”" },
  "163.JPG": { title: "我的本领", body: "我会画画、跳舞、讲故事。\n选择一项本领，用“我会……还会……”自信介绍。" },
  "164.JPG": { title: "看图讲故事", body: "上学的第一天。\n说清楚出发、到校、问候老师和认识同学的过程。" },
};
// 命令行课次支持单课返工，也支持all连续生成整册。
const requested = process.argv[2] || "all";
// 覆盖清单完整读取后按课次筛选。
const coverage = JSON.parse(await fs.readFile(COVERAGE_PATH, "utf8"));
// all表示连续处理第1至16课。
const lessons = requested === "all"
  ? coverage
  : coverage.filter((item) => item.lesson === Number(requested));
// 非法课次阻止误写成品。
if (!lessons.length) throw new Error(`覆盖清单中不存在课次：${requested}`);
// 品牌和播放按钮预读为字节，减少逐页磁盘访问。
const logoBytes = await fs.readFile(LOGO_PATH);
// 播放按钮缓存缺失时使用原生形状降级，不阻断内容生成。
const audioButtonBytes = await fs.readFile(AUDIO_BUTTON_PATH).catch(() => null);

/**
 * 清理旧课件占位文字、异常空格和多余空行，同时保留正文语义。
 */
function normalizeSourceText(text, role) {
  // 旧模板编辑提示不进入新稿。
  const cleaned = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line !== "此处添加标题")
    .join("\n")
    .replace(/(?<=\p{Script=Han})[ \u3000]+(?=\p{Script=Han})/gu, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  // 口才之歌统一替换为已确认版本。
  if (role === "口才之歌") return NEW_SONG;
  // 教材页码占位文本必须由截图页替换，禁止进入新稿。
  if (/请看教材|教材第\s*\d+\s*页/.test(cleaned)) return "";
  // 其他页面保留教材正文。
  return cleaned;
}

/**
 * 将超长页面正文按原始段落切分为适龄可读的连续页。
 */
function splitReadableText(text, maxChars = 320) {
  // 空正文仍返回一个空片段，保证图片页能够生成。
  if (!text) return [""];
  // 原始段落作为最小语义单位。
  const lines = text.split(/\n/).map((line) => line.trim()).filter(Boolean);
  // 当前片段按字符量累积。
  const chunks = [];
  // 工作片段逐行构建。
  let current = [];
  // 当前字符量包含换行。
  let currentLength = 0;
  // 每行依次放入合适片段。
  for (const line of lines) {
    // 加入当前行后的预计长度。
    const nextLength = currentLength + line.length + (current.length ? 1 : 0);
    // 超出阈值且当前片段非空时先封存。
    if (nextLength > maxChars && current.length) {
      chunks.push(current.join("\n"));
      current = [];
      currentLength = 0;
    }
    // 当前行进入新片段。
    current.push(line);
    currentLength += line.length + (current.length > 1 ? 1 : 0);
  }
  // 最后片段不可丢失。
  if (current.length) chunks.push(current.join("\n"));
  // 至少返回一个片段。
  return chunks.length ? chunks : [text];
}

/**
 * 添加可编辑文字并统一字体、颜色、行距和内边距。
 */
function addText(slide, text, position, options = {}) {
  // 每个文本框使用稳定业务名称供检测器定位。
  const shape = slide.shapes.add({
    geometry: "textbox",
    name: options.name || `TEXT_${Math.random().toString(36).slice(2, 8)}`,
    position,
    fill: options.fill || "none",
    line: options.line || { style: "solid", fill: "none", width: 0 },
    borderRadius: options.borderRadius,
  });
  // 可见文字保持PowerPoint原生可编辑。
  shape.text = text;
  // 字号根据页面角色选择，但不低于适龄阅读底线。
  shape.text.style = {
    fontSize: options.fontSize || 27,
    bold: Boolean(options.bold),
    color: options.color || C.ink,
    alignment: options.alignment || "left",
    verticalAlignment: options.verticalAlignment || "middle",
    typeface: options.typeface || FONT_SANS,
    lineSpacing: options.lineSpacing || 1.3,
    autoFit: options.autoFit || "shrinkText",
    insets: options.insets || { top: 12, right: 16, bottom: 12, left: 16 },
  };
  // 返回对象供页面行为继续设置。
  return shape;
}

/**
 * 添加40%透明的暖白文字底板。
 */
function addGlassCard(slide, position) {
  // 白色60%不透明对应用户确认的40%透明度。
  return slide.shapes.add({
    geometry: "roundRect",
    name: "TEXT_CARD",
    position,
    fill: `${C.white}/60`,
    line: { style: "solid", fill: `${C.teal}/18`, width: 1 },
    borderRadius: "rounded-2xl",
    shadow: "shadow-sm",
  });
}

/**
 * 添加品牌、栏目、安全边距和页码。
 */
function addChrome(slide, section, accent = C.coral) {
  // 每生成一页先推进最终页码。
  outputPageNumber += 1;
  // 暖白底色保证图片contain模式留白自然。
  slide.background.fill = C.cream;
  // Logo完整显示且禁止裁剪。
  slide.images.add({
    blob: logoBytes,
    contentType: "image/png",
    alt: "新思度华文学堂品牌Logo",
    fit: "contain",
    position: { left: 42, top: 22, width: 116, height: 74 },
  });
  // 右上栏目短线远离画布边界。
  slide.shapes.add({
    geometry: "roundRect",
    name: "SECTION_RULE",
    position: { left: 1040, top: 50, width: 74, height: 9 },
    fill: accent,
    line: { style: "solid", fill: "none", width: 0 },
    borderRadius: "rounded-full",
  });
  // 栏目名称使用完整安全宽度，禁止右侧裁字。
  addText(slide, section, { left: 1125, top: 28, width: 115, height: 44 }, {
    name: "SECTION_NAME",
    fontSize: 22,
    bold: true,
    color: C.gray,
    alignment: "right",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  // 页码位于右下安全区。
  addText(slide, String(outputPageNumber).padStart(2, "0"), { left: 1186, top: 676, width: 54, height: 22 }, {
    name: "PAGE_NUMBER",
    fontSize: 13,
    color: C.gray,
    alignment: "right",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  });
}

/**
 * 添加紧凑透明玻璃音频入口。
 */
function addAudioButton(slide, position = { left: 100, top: 620, width: 170, height: 54 }) {
  // 有透明按钮素材时完整显示，不裁掉玻璃边缘。
  if (audioButtonBytes) {
    slide.images.add({
      blob: audioButtonBytes,
      contentType: "image/png",
      alt: "播放",
      fit: "contain",
      position,
      name: "AUDIO_BUTTON",
    });
    return;
  }
  // 缓存缺失时使用紧凑原生按钮，保持后续音频热区坐标稳定。
  slide.shapes.add({
    geometry: "roundRect",
    name: "AUDIO_BUTTON",
    position,
    fill: `${C.teal}/88`,
    line: { style: "solid", fill: `${C.white}/45`, width: 1 },
    borderRadius: "rounded-full",
  });
  // 标签只显示通用“播放”。
  addText(slide, "🔊  播放", position, {
    name: "AUDIO_BUTTON_LABEL",
    fontSize: 20,
    bold: true,
    color: C.white,
    alignment: "center",
  });
}

/**
 * 添加当前课原创插图并始终完整显示。
 */
function addOriginalVisual(slide, assets, visualKey, position) {
  // 视觉键只允许选择本课原创故事板或四个独立场景。
  const blob = assets[visualKey];
  // 缺图立即失败，禁止回退到旧课件媒体或教材截图。
  if (!blob) throw new Error(`当前课缺少原创视觉：${visualKey}`);
  // contain模式完整保留人物、物品、边框和解释关系。
  slide.images.add({
    blob,
    contentType: "image/png",
    alt: `下册原创水彩绘本视觉-${visualKey}`,
    fit: "contain",
    position,
    name: `ORIGINAL_VISUAL_${visualKey.toUpperCase()}`,
  });
  // 返回已添加标记供版式检测。
  return true;
}

/**
 * 构建课程封面，标题和课次作为一个视觉组。
 */
function buildCover(deck, lesson, assets) {
  // 封面独立创建。
  const slide = deck.slides.add();
  // 封面栏目名称为主题导入。
  addChrome(slide, "主题导入", C.teal);
  // 右侧完整显示当前课独立主题场景，与中册保持单页横版绘本结构。
  addOriginalVisual(slide, assets, "scene1", { left: 650, top: 112, width: 560, height: 520 });
  // 左侧透明底板避开右侧人物。
  addGlassCard(slide, { left: 72, top: 180, width: 540, height: 360 });
  // 系列名作为封面副标题。
  addText(slide, "少儿口才与表演 · 下册", { left: 110, top: 218, width: 460, height: 52 }, {
    name: "COVER_SERIES",
    fontSize: 27,
    bold: true,
    color: C.teal,
    alignment: "center",
  });
  // 课次与课题共同放在底板光学中心。
  addText(slide, `第${lesson.lesson}课\n${lesson.title}`, { left: 104, top: 292, width: 476, height: 178 }, {
    name: "COVER_TITLE_GROUP",
    fontSize: lesson.title.length > 14 ? 34 : 42,
    bold: true,
    color: C.ink,
    alignment: "center",
    verticalAlignment: "middle",
    lineSpacing: 1.32,
  });
}

/**
 * 构建普通图文页，按页序交替左右方向并保持内容组视觉居中。
 */
function buildContentSlide(deck, lesson, sourceSlide, text, assets, continuationIndex = 0) {
  // 当前输出页独立创建，避免复制后残留旧对象。
  const slide = deck.slides.add();
  // 栏目名称使用当前教学角色。
  addChrome(slide, sourceSlide.role, sourceSlide.role === "字正腔圆" ? C.yellow : C.coral);
  // 奇偶源页交替图文方向，保持整套视觉节奏。
  const imageOnRight = sourceSlide.source_slide % 2 === 0;
  // 课前说明和导航使用中央宽卡；课堂模块使用本课原创图文双栏。
  const hasMedia = ![2, 3, 5].includes(sourceSlide.source_slide);
  // 双栏文字卡位置根据图片方向镜像。
  const cardPosition = hasMedia
    ? { left: imageOnRight ? 60 : 770, top: 160, width: 455, height: 455 }
    : { left: 150, top: 145, width: 980, height: 500 };
  // 图片区域与文字卡保持中册相同的宽幅绘本比例和安全间距。
  const imagePosition = imageOnRight
    ? { left: 532, top: 118, width: 710, height: 550 }
    : { left: 38, top: 118, width: 710, height: 550 };
  // 根据源页所在模块选择不同原创场景，避免整课重复同一张图。
  const visualKey = sourceSlide.source_slide <= 7
    ? "scene1"
    : sourceSlide.source_slide <= 10
      ? "scene2"
      : sourceSlide.source_slide <= 13
        ? "scene3"
        : "scene4";
  // 当前模块原创媒体完整显示。
  if (hasMedia) addOriginalVisual(slide, assets, visualKey, imagePosition);
  // 文字底板位于无人物安全区。
  addGlassCard(slide, cardPosition);
  // 页面标题优先使用栏目名，连续页增加续页标记。
  const title = continuationIndex > 0 ? `${sourceSlide.role}（续${continuationIndex}）` : sourceSlide.role;
  // 标题与正文共同在卡片中形成内容组。
  addText(slide, title, {
    left: cardPosition.left + 34,
    top: cardPosition.top + 34,
    width: cardPosition.width - 68,
    height: 58,
  }, {
    name: "CONTENT_TITLE",
    fontSize: 33,
    bold: true,
    color: C.coral,
    alignment: "center",
  });
  // 字符量决定正文起始字号，禁止过密页面使用过大字号。
  const bodyFont = text.length > 260 ? 18 : text.length > 180 ? 20 : text.length > 100 ? 22 : 25;
  // 正文在卡片有效区域内视觉垂直居中。
  addText(slide, text || "观察画面，说一说你发现了什么。", {
    left: cardPosition.left + 34,
    top: cardPosition.top + 108,
    width: cardPosition.width - 68,
    height: cardPosition.height - 142,
  }, {
    name: "CONTENT_BODY",
    fontSize: bodyFont,
    color: C.ink,
    alignment: text.length < 70 ? "center" : "left",
    verticalAlignment: "middle",
    typeface: /《|诗|歌|绕口令|儿歌/.test(text) ? FONT_SERIF : FONT_SANS,
    lineSpacing: 1.38,
  });
  // 三个表演与朗读栏目保留嵌入式音频入口位置。
  if (["情境再现", "口脑风暴", "粉墨登场"].includes(sourceSlide.role)) {
    // 音频按钮归入文字卡底部并与正文主轴对齐。
    addAudioButton(slide, {
      left: cardPosition.left + 34,
      top: 634,
      width: 170,
      height: 50,
    });
  }
}

/**
 * 读取当前课故事板和四个独立原创场景。
 */
async function loadLessonAssets(lessonNumber) {
  // 两位课次目录与缓存生成阶段保持一致。
  const lessonDir = path.join(ORIGINAL_ASSET_ROOT, `第${String(lessonNumber).padStart(2, "0")}课`);
  // 五个原创资产必须全部存在，缺失时fs.readFile直接中止。
  const [storyboard, scene1, scene2, scene3, scene4] = await Promise.all([
    fs.readFile(path.join(lessonDir, "模块故事板.png")),
    fs.readFile(path.join(lessonDir, "场景1.png")),
    fs.readFile(path.join(lessonDir, "场景2.png")),
    fs.readFile(path.join(lessonDir, "场景3.png")),
    fs.readFile(path.join(lessonDir, "场景4.png")),
  ]);
  // 返回按业务角色命名的视觉集合。
  return { storyboard, scene1, scene2, scene3, scene4 };
}

/**
 * 把教材截图中的结构化事实重建为“可编辑文字＋原创插图”教学页。
 */
async function buildSupplementSlide(deck, lesson, supplement, index, assets) {
  // 每张教材截图至少对应一页独立可读教学单元。
  const slide = deck.slides.add();
  // 教材拓展属于句子宝库或拓展训练。
  addChrome(slide, "教材拓展", C.yellow);
  // 当前截图必须命中已校正结构化映射，禁止用待识别状态继续生成。
  const fact = SUPPLEMENT_FACTS[supplement.file];
  // 缺少映射属于内容硬错误。
  if (!fact?.title || !fact?.body) throw new Error(`缺少截图结构化内容：${supplement.file}`);
  // 四格关系页使用完整故事板，其余页按序使用独立场景，保持画面多样性。
  const visualKey = /按顺序|过程|十二生肖|找不同/.test(fact.body)
    ? "storyboard"
    : `scene${(index % 4) + 1}`;
  // 原创画面在右侧完整显示，不裁切人物和重要对象。
  addOriginalVisual(slide, assets, visualKey, { left: 566, top: 118, width: 670, height: 540 });
  // 左侧底板承载全部可编辑教材文字。
  const card = { left: 58, top: 146, width: 468, height: 468 };
  // 40%透明底板避开右侧人物场景。
  addGlassCard(slide, card);
  // 截图标题转为原生可编辑标题。
  addText(slide, fact.title, { left: 92, top: 182, width: 400, height: 82 }, {
    name: `SUPPLEMENT_TITLE_${supplement.order}`,
    fontSize: fact.title.length > 16 ? 28 : 34,
    bold: true,
    color: C.coral,
    alignment: "center",
  });
  // 教材正文、问题和步骤以可编辑文本显示。
  addText(slide, fact.body, { left: 96, top: 280, width: 392, height: 286 }, {
    name: `SUPPLEMENT_BODY_${supplement.order}`,
    fontSize: fact.body.length > 105 ? 22 : 25,
    color: C.ink,
    alignment: fact.body.length < 75 ? "center" : "left",
    verticalAlignment: "middle",
    typeface: /《|故事|儿歌|主持词/.test(fact.title) ? FONT_SERIF : FONT_SANS,
    lineSpacing: 1.34,
  });
}

/**
 * 构建单课全部页面并在教材占位位置展开全部截图。
 */
async function buildLesson(lesson) {
  // 每课页码从1重新计数。
  outputPageNumber = 0;
  // 当前课从空白演示文稿创建。
  const deck = Presentation.create({ slideSize: SLIDE_SIZE });
  // 当前课只加载原创缓存，不读取旧PPT媒体或教材截图字节。
  const assets = await loadLessonAssets(lesson.lesson);
  // 教材占位页列表用于平均分配当前课截图。
  const placeholderSlides = lesson.source_slides.filter((item) => /请看教材|教材第\s*\d+\s*页/.test(item.source_text));
  // 每个占位页对应的截图数组预先建立。
  const supplementBuckets = new Map(placeholderSlides.map((item) => [item.source_slide, []]));
  // 所有截图按顺序分配，多个占位页时采用轮转保证每处都有内容。
  lesson.supplements.forEach((supplement, index) => {
    // 没有占位页时稍后追加到句子宝库之后。
    if (!placeholderSlides.length) return;
    // 当前截图分配到对应占位页。
    const target = placeholderSlides[index % placeholderSlides.length].source_slide;
    // 保持截图序号顺序。
    supplementBuckets.get(target).push(supplement);
  });
  // 源页按原始顺序逐页处理。
  for (const sourceSlide of lesson.source_slides) {
    // 教材占位页不保留提示语，而是展开该位置对应的全部截图。
    if (supplementBuckets.has(sourceSlide.source_slide)) {
      // 当前占位位置逐张创建可见教学页。
      const bucket = supplementBuckets.get(sourceSlide.source_slide);
      for (const [index, supplement] of bucket.entries()) {
        await buildSupplementSlide(deck, lesson, supplement, index, assets);
      }
      // 占位页本身不再生成。
      continue;
    }
    // 原稿中仅写“图一、图二……”的页面只是教材截图占位，不再生成重复空页。
    const placeholderText = normalizeSourceText(sourceSlide.source_text, sourceSlide.role);
    // 当前课已有结构化教材页时，纯图片编号页由对应截图教学单元完整替代。
    if (lesson.supplements.length && /^图[一二三四五六七八九十\d]+$/u.test(placeholderText)) {
      continue;
    }
    // 封面使用专属标题布局。
    if (sourceSlide.role === "封面") {
      buildCover(deck, lesson, assets);
      continue;
    }
    // 源正文先清理占位和异常空格。
    const normalized = placeholderText;
    // 超长内容按段落扩展为连续页，禁止过度缩字。
    const chunks = splitReadableText(normalized, 320);
    // 每个片段生成一页并保留当前教学角色。
    for (const [index, chunk] of chunks.entries()) {
      buildContentSlide(deck, lesson, sourceSlide, chunk, assets, index);
    }
  }
  // 极端情况下没有教材占位页时，仍把全部截图追加到末尾。
  if (!placeholderSlides.length) {
    for (const [index, supplement] of lesson.supplements.entries()) {
      await buildSupplementSlide(deck, lesson, supplement, index, assets);
    }
  }
  // 输出目录按需创建。
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  // 文件名严格保持原始名称。
  const outputPath = path.join(OUTPUT_ROOT, path.basename(lesson.source_file));
  // 导出为可编辑PPTX。
  const pptx = await PresentationFile.exportPptx(deck);
  // 正式文件一次性保存。
  await pptx.save(outputPath);
  // 返回当前课构建摘要。
  return {
    lesson: lesson.lesson,
    title: lesson.title,
    sourceSlides: lesson.source_slide_count,
    supplements: lesson.supplements.length,
    outputSlides: deck.slides.items.length,
    outputPath,
  };
}

// 连续任务按课次依次生成，单课失败时明确中止，禁止宣称整册完成。
const results = [];
// 第1至16课按覆盖清单顺序执行。
for (const lesson of lessons) {
  // 输出当前课进度。
  console.log(`[下册生成] 第${String(lesson.lesson).padStart(2, "0")}课 ${lesson.title}`);
  // 当前课完成后写入结果。
  results.push(await buildLesson(lesson));
}
// 整册摘要供检测器和执行文档复用。
console.log(JSON.stringify({ status: "completed", lessons: results }, null, 2));
