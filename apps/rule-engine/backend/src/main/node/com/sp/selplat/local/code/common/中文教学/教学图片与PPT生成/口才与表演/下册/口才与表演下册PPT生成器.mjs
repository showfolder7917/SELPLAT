import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertSemanticCoverage,
  buildAdaptiveTextPanel,
  buildSceneLayout,
  chooseBodyFont,
  shouldSuppressInstructionTitle,
  validateVisualPlanMap,
} from "../通用/口才与表演通用生成核心.mjs";

// 生成器优先使用显式工程根，保证能力从不同任务页面调用时仍写入当前工程。
const PROJECT_ROOT = path.resolve(process.env.SELPLAT_PROJECT_ROOT || process.cwd());
// 大体积artifact-tool依赖固定从工程缓存加载，禁止复制到规则引擎源码。
const ARTIFACT_TOOL_ENTRY = path.join(PROJECT_ROOT, "cache/node-modules/@oai/artifact-tool/dist/artifact_tool.mjs");
// 缓存缺失时立即失败，避免静默回退到临时依赖。
await fs.access(ARTIFACT_TOOL_ENTRY);
// 文件URL用于稳定加载缓存内ES模块。
const { Presentation, PresentationFile } = await import(pathToFileURL(ARTIFACT_TOOL_ENTRY).href);
// 全量分析器生成的覆盖清单是下册内容唯一入口。
const COVERAGE_PATH = path.join(PROJECT_ROOT, "apps/rule-engine/backend/src/main/resources/local/common/中文教学/应用/口才与表演/template/RUL_少儿口才与表演下册PPT完整制作规则/课程内容索引.json");
// 第一课视觉计划把中册验证过的“自然留白侧”契约带入下册适配器。
const LESSON_ONE_VISUAL_PLAN_PATH = path.join(PROJECT_ROOT, "apps/rule-engine/backend/src/main/resources/local/common/中文教学/应用/口才与表演/template/RUL_少儿口才与表演下册PPT完整制作规则/第01课视觉计划.json");
// 正式成品进入口才与表演下册目录并保持原始文件名。
const OUTPUT_ROOT = path.join(PROJECT_ROOT, "OPTION/temp/中文教学/教学图片与PPT生成/成品/口才与表演/下册");
// 真实品牌Logo由规则引擎长期维护。
const LOGO_PATH = path.join(PROJECT_ROOT, "apps/rule-engine/backend/src/main/resources/local/common/中文教学/通用/template/RUL_中文教学公共品牌素材使用规则/新思度华文学堂.png");
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
// 视觉计划在生成前完成字段校验，禁止运行中再按页码猜测文字方向。
const lessonOneVisualPlans = validateVisualPlanMap(JSON.parse(await fs.readFile(LESSON_ONE_VISUAL_PLAN_PATH, "utf8")));
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
 * 将发音教学对象中的英文a字形转换为教材拼音单层ɑ。
 */
function normalizePinyinGlyphs(value) {
  // 带调a转换为单层ɑ与组合调号，保留原声调位置。
  const toned = String(value || "")
    .replaceAll("ā", "ɑ̄")
    .replaceAll("á", "ɑ́")
    .replaceAll("ǎ", "ɑ̌")
    .replaceAll("à", "ɑ̀");
  // 发音教学语境中的剩余小写a统一采用教材拼音字形。
  return toned.replaceAll("a", "ɑ");
}

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
  // 正文开头常重复旧模板栏目名，先按当前角色清除，避免新标题与旧栏目字样叠放。
  const duplicateRolePatterns = {
    主题导入: /^主题\s*导入\s*/u,
    学习导航: /^学习\s*导航\s*/u,
    情境再现: /^情[景境]\s*再现\s*/u,
    字正腔圆: /^字正\s*腔圆\s*/u,
    口脑风暴: /^口脑\s*风暴\s*/u,
    粉墨登场: /^粉墨\s*登场\s*/u,
    句子宝库: /^句子\s*宝库\s*/u,
    拓展训练: /^拓展\s*训练\s*/u,
    课堂回顾: /^课堂\s*回顾\s*/u,
    小任务: /^小\s*任务\s*/u,
    结束页: /^结束页\s*/u,
  };
  // 当前角色存在重复前缀时只移除栏目标签，保留后续教学正文。
  const withoutDuplicateRole = duplicateRolePatterns[role]
    ? cleaned.replace(duplicateRolePatterns[role], "").trim()
    : cleaned;
  // “说一说/做一做/读一读/记一记/演一演”是旧模板操作标签，新版由栏目和版式表达，不重复占用正文。
  const withoutTemplatePrompts = withoutDuplicateRole
    .replace(/^(?:(?:说一说|做一做|读一读|记一记|演一演)\s*)+/u, "")
    // 旧模板提示词被移除后可能残留独立逗号或冒号，必须同步清理，禁止出现在学生页。
    .replace(/^[，,、；;：:。！？!?\s]+/u, "")
    .trim();
  // 口才之歌统一替换为已确认版本。
  if (role === "口才之歌") return NEW_SONG;
  // 字正腔圆页面中的韵母、音节和带调拼音统一使用教材单层ɑ字形。
  if (role === "字正腔圆") return normalizePinyinGlyphs(withoutTemplatePrompts);
  // 教材页码占位文本必须由截图页替换，禁止进入新稿。
  if (/请看教材|教材第\s*\d+\s*页/.test(withoutTemplatePrompts)) return "";
  // 其他页面保留教材正文。
  return withoutTemplatePrompts;
}

/**
 * 将超长页面正文按原始段落切分为适龄可读的连续页。
 */
function splitReadableText(text, maxChars = 110, charsPerLine = 16, maxVisualLines = 8) {
  // 空正文仍返回一个空片段，保证图片页能够生成。
  if (!text) return [""];
  // 原始段落作为最小语义单位。
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => line.match(/[^。！？；：，,]+[。！？；：，,]?/gu) || [line]);
  // 当前片段按字符量累积。
  const chunks = [];
  // 工作片段逐行构建。
  let current = [];
  // 当前字符量包含换行。
  let currentLength = 0;
  // 当前片段按实际栏宽估算的视觉行数，避免字符总数合格但短句换行过多。
  let currentVisualLines = 0;
  // 每行依次放入合适片段。
  for (const line of lines) {
    // 加入当前行后的预计长度。
    const nextLength = currentLength + line.length + (current.length ? 1 : 0);
    // 中英文混排按当前栏宽估算至少占一行，长句则按字符宽度折行。
    const lineVisualLines = Math.max(1, Math.ceil([...line].length / charsPerLine));
    // 加入当前语义片段后的预计视觉行数。
    const nextVisualLines = currentVisualLines + lineVisualLines;
    // 字符量或视觉行数任一超出阈值且当前片段非空时先封存。
    if ((nextLength > maxChars || nextVisualLines > maxVisualLines) && current.length) {
      chunks.push(current.join("\n"));
      current = [];
      currentLength = 0;
      currentVisualLines = 0;
    }
    // 当前行进入新片段。
    current.push(line);
    currentLength += line.length + (current.length > 1 ? 1 : 0);
    // 同步累计视觉行数，确保窄栏不再发生底板内溢出。
    currentVisualLines += lineVisualLines;
  }
  // 最后片段不可丢失。
  if (current.length) chunks.push(current.join("\n"));
  // 至少返回一个片段。
  return chunks.length ? chunks : [text];
}

/**
 * 判断当前源页是否适合使用整页宽文字版式。
 */
function isTextOnlySource(sourceSlide) {
  // 课前说明、歌曲、回顾、小任务和结束页不需要为装饰图牺牲文字空间。
  return [2, 3, 23].includes(sourceSlide.source_slide)
    || ["课堂回顾", "小任务", "结束页"].includes(sourceSlide.role);
}

/**
 * 为模板占位页寻找距离最近的真实教学栏目。
 */
function resolveInheritedSection(lesson, sourceSlide) {
  // 可直接展示的业务栏目作为继承候选，模板术语不能进入学生页面。
  const visibleSections = new Set([
    "主题导入",
    "课前热身",
    "口才之歌",
    "情境再现",
    "字正腔圆",
    "口脑风暴",
    "粉墨登场",
    "句子宝库",
    "拓展训练",
    "课堂回顾",
    "小任务",
    "结束页",
  ]);
  // 当前页在原课件中的顺序用于向前、向后查找模块边界。
  const index = lesson.source_slides.findIndex((item) => item.source_slide === sourceSlide.source_slide);
  // 未找到源页时回退到主题导入，避免展示“内容页”。
  if (index < 0) return "主题导入";
  // 同时向两侧扩展，优先继承距离更近的真实栏目。
  for (let distance = 1; distance < lesson.source_slides.length; distance += 1) {
    // 前一页通常表示当前内容的所属模块，因此同距离时优先采用前一页。
    const previous = lesson.source_slides[index - distance];
    // 前向真实栏目命中后立即继承。
    if (previous && visibleSections.has(previous.role)) return previous.role;
    // 后一页用于识别位于模块标题前的内容页。
    const next = lesson.source_slides[index + distance];
    // 后向真实栏目命中后立即继承。
    if (next && visibleSections.has(next.role)) return next.role;
  }
  // 整课缺少栏目结构时使用可理解的主题导入。
  return "主题导入";
}

/**
 * 把旧稿中的通用占位栏目还原为真实教学栏目。
 */
function resolveSectionName(lesson, sourceSlide) {
  // 第一课的人工语义映射只允许作用于第一课，禁止污染其他课相同页码。
  if (lesson.lesson === 1) {
    // 观察分享场景属于情境再现的导入。
    if (sourceSlide.source_slide === 6) return "情境再现";
    // 菠萝葡萄观察和绕口令拓展都属于口脑风暴。
    if ([11, 13].includes(sourceSlide.source_slide)) return "口脑风暴";
    // 分苹果观察页属于粉墨登场的表演准备。
    if (sourceSlide.source_slide === 14) return "粉墨登场";
    // 原稿把家庭练习误标为字正腔圆，新版恢复为小任务。
    if (sourceSlide.source_slide === 23) return "小任务";
  }
  // 内容页和学习导航属于旧模板术语，必须继承邻近真实教学栏目。
  if (["内容页", "学习导航"].includes(sourceSlide.role)) {
    return resolveInheritedSection(lesson, sourceSlide);
  }
  // 其他页面沿用原稿真实栏目。
  return sourceSlide.role;
}

/**
 * 为旧稿占位页生成可直接教学的页面标题。
 */
function resolvePageTitle(lesson, sourceSlide, text) {
  // 第一课的人工标题映射只服务第一课，其他课必须从各自教材语义生成标题。
  if (lesson.lesson === 1) {
    // 阅读延伸页直接使用篇名作标题，避免模板层级“基本功延伸”与正文、右上栏目相互重叠。
    if (sourceSlide.source_slide === 10) return "《我多想出去看看》";
    // 通用“内容页”必须改为当前教学动作，禁止把模板术语显示给学生。
    if (sourceSlide.source_slide === 6) return "看图说一说";
    // 第二个观察页引导孩子识别分享对象。
    if (sourceSlide.source_slide === 11) return "说一说，你看到了什么？";
    // 分享儿歌使用真实篇名，禁止与右上“情境再现”栏目重复。
    if (sourceSlide.source_slide === 7) return "《分享》";
    // 发音说明页使用真实教学动作，禁止与右上“字正腔圆”栏目重复。
    if (sourceSlide.source_slide === 8) return "发音要领";
    // 宝宝和平平绕口令使用真实篇名，禁止与右上“口脑风暴”栏目重复。
    if (sourceSlide.source_slide === 12) return "《宝宝和平平》";
    // 绕口令拓展使用教材中的真实名称。
    if (sourceSlide.source_slide === 13) return "课外拓展";
    // 表演前先按顺序观察人物与动作。
    if (sourceSlide.source_slide === 14) return "按顺序观察";
    // 分苹果表演页使用教材篇名，禁止显示重复栏目名。
    if (sourceSlide.source_slide === 15) return "《分苹果》";
    // 句子宝库页直接使用当前分享主题，避免栏目名重复。
    if (sourceSlide.source_slide === 17) return "分享好喝的萝卜汤";
    // 家庭练习使用可直接理解的动作标题。
    if (sourceSlide.source_slide === 23) return "回家练一练";
  }
  // 主题导入页直接显示课程主题。
  if (sourceSlide.role === "主题导入") return lessonTitleFromText(text);
  // 模板占位页优先采用正文中的短语义标题，避免显示“内容页”或“学习导航”。
  if (["内容页", "学习导航"].includes(sourceSlide.role)) {
    // 第一条有效短句最接近旧教材原有的小标题。
    const candidate = String(text || "")
      .split(/\n/)
      .map((line) => line.trim())
      .find((line) => line && !["内容页", "学习导航", "此处添加标题"].includes(line));
    // 短标题可直接使用；长正文由真实栏目转成课堂动作标题。
    if (candidate && [...candidate].length <= 18) return candidate;
    // 情境类内容页使用观察提示，其余模块使用可理解的练习标题。
    return resolveSectionName(lesson, sourceSlide) === "情境再现" ? "看图说一说" : "练一练";
  }
  // 其余页面使用真实栏目。
  return resolveSectionName(lesson, sourceSlide);
}

/**
 * 从正文首行移除与页面标题或栏目相同的模板标签。
 */
function removeRepeatedHeading(text, title, sectionName) {
  // 压缩空白后比较，兼容旧课件把栏目名称拆字排版的情况。
  const compact = (value) => String(value || "")
    .replace(/\s+/gu, "")
    .replace(/^[《》“”"'【】（）()]+|[《》“”"'【】（）()，。！？；：、,.!?;:]+$/gu, "");
  // 正文逐行处理，保留真实段落顺序。
  const lines = String(text || "").split(/\n/);
  // 只有开头连续重复的标题需要删除，中间正文中的同词保留。
  while (
    lines.length
    && [compact(title), compact(sectionName)].includes(compact(lines[0]))
  ) {
    lines.shift();
  }
  // 清理删除标签后产生的多余空行。
  return lines.join("\n").replace(/^\s+|\s+$/gu, "");
}

/**
 * 从主题导入正文中提取第一行课程标题。
 */
function lessonTitleFromText(text) {
  // 第一行是旧稿已经确认的课题，其余课次文字不重复进入标题。
  return String(text || "").split(/\n/).map((line) => line.trim()).find(Boolean) || "主题导入";
}

/**
 * 为缺少正文的旧占位页补充与当前教学模块匹配的真实课堂指令。
 */
function resolveFallbackBody(sectionName) {
  // 情境再现必须引导观察人物、动作和事件关系。
  if (sectionName === "情境再现") return "观察人物的表情和动作，说一说发生了什么。";
  // 字正腔圆必须回到口形、听音和发音练习。
  if (sectionName === "字正腔圆") return "看清口形，听准发音，再试着读一读。";
  // 口脑风暴必须引导完整表达而不是机械复述提示语。
  if (sectionName === "口脑风暴") return "先看画面，再用完整句说出你的发现。";
  // 粉墨登场必须给出角色、动作和表演任务。
  if (sectionName === "粉墨登场") return "分清角色，想好动作，再自信地演一演。";
  // 其他模块使用最小观察指令，并由后续逐页视觉计划继续细化。
  return "观察画面，用完整句说出你的发现。";
}

/**
 * 把课前自我介绍整理为一页可直接练习的结构。
 */
function buildWarmupSlide(deck, sourceSlide, assets) {
  // 课前热身只生成一页，禁止按句子拆成多张“续”页。
  const slide = deck.slides.add();
  // 使用整幅原创舞台场景，人物主动让出右侧文字区。
  const layout = buildSceneLayout(lessonOneVisualPlans.warmup);
  // 原创图片铺满完整画布且不裁切。
  slide.images.add({
    blob: assets.warmup,
    contentType: "image/png",
    alt: "课前自我介绍与展示场景",
    fit: "contain",
    position: layout.imageArea,
    name: "FULL_SCENE_WARMUP",
  });
  // 栏目和页码保持全册一致。
  addChrome(slide, "课前热身", C.coral);
  // 自我介绍文字覆盖整块右侧留白，使用与文字组等高的40%透明轻底板保证投影可读。
  addGlassCard(slide, {
    left: layout.textArea.left + 4,
    top: layout.textArea.top + 8,
    width: layout.textArea.width - 8,
    height: layout.textArea.height - 16,
  });
  // 右侧自然留白区承载标题、步骤和示例句。
  addText(slide, "先认识一下吧", {
    left: layout.textArea.left + 24,
    top: layout.textArea.top + 18,
    width: layout.textArea.width - 48,
    height: 58,
  }, {
    name: "CONTENT_TITLE",
    fontSize: 34,
    bold: true,
    color: C.coral,
    alignment: "center",
    autoFit: "none",
  });
  // 五个动作与一句完整示例在同一页完成，保留原稿全部教学意图。
  const warmupText = [
    "问好 · 姓名和年龄",
    "兴趣或本领 · 展示",
    "微笑并致谢",
    "",
    "大家好，我是____，今年____岁。",
    "我喜欢____，接下来表演____。",
    "谢谢大家！",
  ].join("\n");
  // 内容组在右侧安全区内视觉居中，字号不依靠自动缩小。
  addText(slide, warmupText, {
    left: layout.textArea.left + 32,
    // 标题底部之后保留8像素呼吸位，禁止两个文本对象发生几何相交。
    top: layout.textArea.top + 84,
    width: layout.textArea.width - 64,
    // 正文高度同步扣除标题和间距，保证整组仍在自然留白区内。
    height: layout.textArea.height - 94,
  }, {
    name: "CONTENT_BODY",
    // 七行自我介绍步骤维持课堂投影可读字号，通过紧凑行距而非缩字保证容量。
    fontSize: 35,
    color: C.ink,
    alignment: "center",
    verticalAlignment: "middle",
    lineSpacing: 1.0,
    autoFit: "none",
  });
}

/**
 * 使用中册第一课验收版式生成一页双卡口才之歌。
 */
function buildOralSongSlide(deck) {
  // 口才之歌独立成页，完整内容不得拆分。
  const slide = deck.slides.add();
  // 右上栏目沿用课前热身，避免页面同时出现两个“口才之歌”标题。
  addChrome(slide, "课前热身", C.coral);
  // 主标题位于页面视觉中轴。
  addText(slide, "口才之歌", { left: 360, top: 88, width: 560, height: 72 }, {
    name: "CONTENT_TITLE",
    fontSize: 38,
    bold: true,
    color: C.ink,
    alignment: "center",
    autoFit: "none",
  });
  // 统一歌词分成两组，每组使用独立浅色卡片承载。
  const songLines = NEW_SONG.split("\n").filter(Boolean);
  // 左右卡片复刻中册已验收的均衡双栏比例。
  const cards = [
    { left: 150, lines: songLines.slice(0, 3), name: "SONG_LEFT_COLUMN" },
    { left: 660, lines: songLines.slice(3), name: "SONG_RIGHT_COLUMN" },
  ];
  // 两组歌词使用相同字号、行距和内边距。
  for (const card of cards) {
    // 淡色底板只服务诗歌分组，不覆盖人物插画。
    addGlassCard(slide, { left: card.left, top: 190, width: 470, height: 420 });
    // 歌词在卡片内部视觉垂直居中。
    addText(slide, card.lines.join("\n\n"), {
      left: card.left + 34,
      top: 220,
      width: 402,
      height: 360,
    }, {
      name: card.name,
      fontSize: 31,
      color: C.ink,
      alignment: "left",
      verticalAlignment: "middle",
      typeface: FONT_SERIF,
      lineSpacing: 1.3,
      autoFit: "none",
    });
  }
}

/**
 * 生成拼音与汉字逐组对齐的发音练习页。
 */
function buildPinyinPracticeSlide(deck, assets) {
  // 拼音练习独立使用结构化布局，禁止把整段文本交给自动换行。
  const slide = deck.slides.add();
  // 镜前送气示意图铺满画布并为左侧文字主动留白。
  const layout = buildSceneLayout(lessonOneVisualPlans.pronunciation);
  // 图片完整显示，人物和气流关系不得裁切。
  slide.images.add({
    blob: assets.pronunciation,
    contentType: "image/png",
    alt: "声母b和p送气对比发音训练",
    fit: "contain",
    position: layout.imageArea,
    name: "FULL_SCENE_PRONUNCIATION",
  });
  // 发音栏目位于插画上层。
  addChrome(slide, "字正腔圆", C.yellow);
  // 发音说明与拼音词组占据完整左侧安全区，使用统一轻底板避免水彩纹理干扰声调辨识。
  addGlassCard(slide, {
    left: layout.textArea.left + 4,
    top: layout.textArea.top,
    width: layout.textArea.width - 8,
    height: layout.textArea.height,
  });
  // 页面标题与发音说明构成第一层信息。
  addText(slide, "发音练习", { left: 96, top: 146, width: 430, height: 58 }, {
    name: "CONTENT_TITLE",
    fontSize: 34,
    bold: true,
    color: C.coral,
    alignment: "center",
    autoFit: "none",
  });
  // b、p的送气差异保持完整且不与词语练习混排。
  addText(slide, "b——不送气，声带不颤动。\np——送气，声带不颤动。", {
    left: 92,
    top: 208,
    width: 438,
    height: 130,
  }, {
    name: "CONTENT_BODY",
    fontSize: 35,
    color: C.ink,
    alignment: "left",
    lineSpacing: 1.2,
    autoFit: "none",
  });
  // 每个拼音与对应汉字使用相同横坐标和宽度，形成稳定上下对齐。
  const pairs = [
    { pinyin: "pō", hanzi: "坡", left: 102, top: 350, width: 116 },
    { pinyin: "pǎo bù", hanzi: "跑步", left: 246, top: 350, width: 142 },
    { pinyin: "bá miáo zhù zhǎng", hanzi: "拔苗助长", left: 82, top: 470, width: 210 },
    { pinyin: "píng yì jìn rén", hanzi: "平易近人", left: 306, top: 470, width: 210 },
  ];
  // 四组词语逐一生成，检测器可按名称核对中心线。
  pairs.forEach((pair, index) => {
    // 拼音位于对应汉字正上方。
    addText(slide, normalizePinyinGlyphs(pair.pinyin), {
      left: pair.left,
      top: pair.top,
      width: pair.width,
      height: 40,
    }, {
      name: `PINYIN_${index + 1}`,
      fontSize: 25,
      color: C.ink,
      alignment: "center",
      autoFit: "none",
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    // 汉字与拼音共用中心线，禁止靠空格模拟对齐。
    addText(slide, pair.hanzi, {
      left: pair.left,
      top: pair.top + 43,
      width: pair.width,
      height: 52,
    }, {
      name: `HANZI_${index + 1}`,
      fontSize: 31,
      color: C.ink,
      alignment: "center",
      autoFit: "none",
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  });
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
  // 右上栏目使用与文字成比例的轻底层，避免栏目名称直接压住人物、树叶或窗框。
  slide.shapes.add({
    geometry: "roundRect",
    name: "SECTION_BADGE",
    position: { left: 1012, top: 20, width: 228, height: 58 },
    fill: `${C.white}/62`,
    line: { style: "solid", fill: `${C.white}/45`, width: 1 },
    borderRadius: "rounded-full",
  });
  // 栏目短线放入轻底层内部并缩短，保持清晰但不抢正文视觉焦点。
  slide.shapes.add({
    geometry: "roundRect",
    name: "SECTION_RULE",
    position: { left: 1030, top: 47, width: 58, height: 8 },
    fill: accent,
    line: { style: "solid", fill: "none", width: 0 },
    borderRadius: "rounded-full",
  });
  // 栏目名称在同一底层内垂直居中，禁止右侧裁字或覆盖人物面部。
  addText(slide, section, { left: 1098, top: 27, width: 126, height: 44 }, {
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
 * 返回第一课当前源页对应的中册式大画面视觉计划。
 */
function resolveLessonOneScenePlan(lesson, sourceSlide) {
  // 其他课次仍由现有适配器处理，本轮样稿只验证第一课共用生成能力。
  if (lesson.lesson !== 1) return null;
  // 课前介绍使用专门的舞台展示图。
  if (sourceSlide.source_slide === 2) return { key: "warmup", plan: lessonOneVisualPlans.warmup };
  // 主题导入使用分享苹果主题图。
  if (sourceSlide.source_slide === 4) return { key: "theme", plan: lessonOneVisualPlans.theme };
  // 分享故事页使用专门为左侧文字让位的课堂分享场景，禁止沿用没有自然留白的通用场景。
  if (sourceSlide.source_slide === 7) return { key: "sharingStory", plan: lessonOneVisualPlans.sharingStory };
  // 三个观察页使用课堂分享场景并把问题放进自然留白。
  if ([6, 11, 14].includes(sourceSlide.source_slide)) return { key: "practice", plan: lessonOneVisualPlans.practice };
  // 分苹果表演页使用专门的祖孙分享苹果场景并为左侧标题让位。
  if (sourceSlide.source_slide === 15) {
    return { key: "appleSharingPerformance", plan: lessonOneVisualPlans.appleSharingPerformance };
  }
  // 发音说明与发音练习统一使用镜前气流示意图。
  if ([8, 9].includes(sourceSlide.source_slide)) return { key: "pronunciation", plan: lessonOneVisualPlans.pronunciation };
  // 北京阅读段落使用对应的天安门向往场景。
  if (sourceSlide.source_slide === 10) return { key: "beijing", plan: lessonOneVisualPlans.beijing };
  // 八面坡绕口令使用安全的课堂舞台模型图。
  if (sourceSlide.source_slide === 13) return { key: "tongueTwister", plan: lessonOneVisualPlans.tongueTwister };
  // 宝宝和平平互换水果必须使用菠萝和葡萄对应场景。
  if (sourceSlide.source_slide === 12) return { key: "fruitSharing", plan: lessonOneVisualPlans.fruitSharing };
  // 妙语连珠的萝卜汤句式必须使用真实分享汤品的对应场景。
  if (sourceSlide.source_slide === 17) return { key: "radishSoup", plan: lessonOneVisualPlans.radishSoup };
  // 其他页面继续使用现有故事插图或纯文字版式。
  return null;
}

/**
 * 使用图片自身自然留白生成中册式整幅场景图文页。
 */
function buildFullSceneContent(slide, lesson, sourceSlide, text, assets, scenePlan, continuationIndex) {
  // 当前图片必须与正文命中至少一个教学关键词，禁止装饰图替代释义图。
  // 连续页继承同一源页的完整教学语义，不能只用当前切分页片段误判后半页。
  assertSemanticCoverage(`${sourceSlide.role}\n${sourceSlide.source_text}`, scenePlan.plan);
  // 共用核心返回完整画布和文字安全区，不允许册别适配器缩回固定小图框。
  const layout = buildSceneLayout(scenePlan.plan);
  // 16:9原创插画完整放入画布，图片内部已经为文字主动留白。
  slide.images.add({
    blob: assets[scenePlan.key],
    contentType: "image/png",
    alt: `口才与表演语义插画-${scenePlan.key}`,
    fit: "contain",
    position: layout.imageArea,
    name: `FULL_SCENE_${scenePlan.key.toUpperCase()}`,
  });
  // 品牌、栏目和页码必须位于图片上层。
  const sectionName = resolveSectionName(lesson, sourceSlide);
  // 右上栏目必须显示真实教学模块，禁止出现“内容页”模板术语。
  addChrome(slide, sectionName, sectionName === "字正腔圆" ? C.yellow : C.coral);
  // 页面标题和正文作为一个整体在安全区内视觉居中。
  const title = resolvePageTitle(lesson, sourceSlide, text);
  // 页面标题若已经来自正文首句，正文必须去重，避免同一教学语重复两次。
  let bodyText = String(text || "").trim();
  // 主题导入页补充一个可讨论的问题，避免只剩“第一课”这种无效正文。
  if (sourceSlide.role === "主题导入") {
    bodyText = "第一课\n想一想：你愿意和朋友分享什么？";
  } else if (sourceSlide.source_slide === 10) {
    // 阅读延伸正文删除模板层级、重复篇名和无后续页面的“（一）”编号。
    bodyText = bodyText
      .replace(/^基本功延伸\s*/u, "")
      .replace(/^《我多想出去看看》\s*[（(]一[）)]\s*/u, "")
      .trim();
    // 长篇阅读按语义重新分段，保留原文信息但避免一整块大字压住场景人物。
    bodyText = [
      "妈妈告诉我，沿着弯弯的小路，",
      "就会走出天山。",
      "遥远的北京城，有一座雄伟的天安门，",
      "广场上的升旗仪式非常壮观。",
      "我对妈妈说：",
      "“我多想去看看，",
      "我多想去看看！”",
    ].join("\n");
  } else if (sourceSlide.source_slide === 13) {
    // 课外拓展标题不在正文再次出现。
    bodyText = bodyText.replace(/^课外拓展\s*/u, "").trim();
  } else if (sourceSlide.source_slide === 14) {
    // 长问题改为两行清晰观察提示，语义保持一致。
    bodyText = "图中都有谁？\n他们在做什么？";
  } else if (sourceSlide.source_slide === 15) {
    // 原稿本页只有篇名，必须补成可以直接开展角色表演的课堂台词，禁止生成只有标题的大空卡。
    bodyText = [
      "奶奶：苹果熟了，大家来尝一尝。",
      "小朋友：奶奶先吃，我来分苹果。",
      "把大的送给奶奶，把甜的分享给伙伴。",
      "看一看 · 说一说 · 演一演",
    ].join("\n");
  } else if (bodyText.startsWith(title)) {
    // 其他页面只移除完全相同的标题前缀。
    bodyText = bodyText.slice(title.length).trim();
  }
  // 重复的观察动作标题和与右上栏目相同的标题都由正文承担，禁止再增加一层机械层级。
  const hideTitle = shouldSuppressInstructionTitle(title, bodyText)
    || title.replace(/\s+/gu, "") === sectionName.replace(/\s+/gu, "");
  // 共用核心同时考虑正文长度、视觉行数和安全区面积，生成比例适配的文字组。
  const panel = buildAdaptiveTextPanel(layout.textArea, title, bodyText, {
    hideTitle,
    role: sourceSlide.role,
    // 长篇阅读使用30生成字号，导出后约22.5pt，避免大字硬塞或拆成无意义续页。
    bodyFont: sourceSlide.source_slide === 10 ? 30 : undefined,
  });
  // 文字落在整幅图片上时使用40%透明轻底板，底板只包住实际文字组。
  if (layout.useCard) addGlassCard(slide, panel.cardArea);
  // 真实业务标题保留；重复观察动作标题由正文替代。
  if (!panel.hideTitle) {
    // 标题与正文共用同一视觉组，不再固定贴在安全区顶部。
    addText(slide, title, panel.titleArea, {
      name: "CONTENT_TITLE",
      fontSize: sourceSlide.source_slide === 10 ? 31 : 32,
      bold: true,
      color: C.coral,
      alignment: "center",
      autoFit: "none",
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  }
  // 正文使用共用字号与自适应文字区，保持文字组与人物画面视觉平衡。
  addText(slide, bodyText, panel.bodyArea, {
    name: "CONTENT_BODY",
    // 生成核心已按内容密度给出适龄字号，禁止再次由页面适配器放大。
    fontSize: panel.bodyFont,
    color: C.ink,
    alignment: bodyText.length < 70 ? "center" : "left",
    verticalAlignment: "middle",
    typeface: /《|诗|歌|绕口令|儿歌/.test(bodyText) ? FONT_SERIF : FONT_SANS,
    lineSpacing: sourceSlide.source_slide === 10 ? 1.08 : 1.22,
    autoFit: "none",
  });
  // 音频入口放在文字安全区底部，避免拦截整页翻页点击。
  if (continuationIndex === 0 && ["情境再现", "口脑风暴", "粉墨登场"].includes(sourceSlide.role)) {
    addAudioButton(slide, {
      left: layout.textArea.left + 24,
      top: 628,
      width: 150,
      height: 46,
    });
  }
}

/**
 * 构建课程封面，标题和课次作为一个视觉组。
 */
function buildCover(deck, lesson, assets) {
  // 封面独立创建。
  const slide = deck.slides.add();
  // 封面主题图直接铺满完整画布，保持图片全部内容且不做半屏裁切。
  slide.images.add({
    blob: assets.theme,
    contentType: "image/png",
    alt: `少儿口才与表演下册第${lesson.lesson}课主题插画`,
    fit: "contain",
    position: { left: 0, top: 0, width: SLIDE_SIZE.width, height: SLIDE_SIZE.height },
    name: "FULL_BLEED_COVER_IMAGE",
  });
  // 封面只保留品牌和页码，不显示重复的右上栏目。
  outputPageNumber += 1;
  // Logo位于左上安全区。
  slide.images.add({
    blob: logoBytes,
    contentType: "image/png",
    alt: "新思度华文学堂品牌Logo",
    fit: "contain",
    position: { left: 42, top: 22, width: 116, height: 74 },
    name: "BRAND_LOGO",
  });
  // 页码位于右下安全区。
  addText(slide, "01", { left: 1186, top: 676, width: 54, height: 22 }, {
    name: "PAGE_NUMBER",
    fontSize: 13,
    color: C.gray,
    alignment: "right",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  // 系列名作为封面副标题。
  addText(slide, "少儿口才与表演 · 下册", { left: 72, top: 132, width: 500, height: 48 }, {
    name: "COVER_SERIES",
    fontSize: 27,
    bold: true,
    color: C.teal,
    alignment: "left",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  // 课次与课题作为一个整体位于图片自然留白区。
  addText(slide, `第${lesson.lesson}课\n${lesson.title}`, { left: 72, top: 214, width: 520, height: 220 }, {
    name: "COVER_TITLE_GROUP",
    fontSize: lesson.title.length > 14 ? 34 : 42,
    bold: true,
    color: C.ink,
    alignment: "left",
    verticalAlignment: "middle",
    lineSpacing: 1.32,
  });
}

/**
 * 构建普通图文页，按页序交替左右方向并保持内容组视觉居中。
 */
function buildContentSlide(deck, lesson, sourceSlide, text, assets, continuationIndex = 0) {
  // 课前自我介绍使用单页结构化版式。
  if (lesson.lesson === 1 && sourceSlide.source_slide === 2) {
    buildWarmupSlide(deck, sourceSlide, assets);
    return;
  }
  // 口才之歌严格继承中册第一课的双卡版式。
  if (sourceSlide.role === "口才之歌") {
    buildOralSongSlide(deck);
    return;
  }
  // 第一课拼音练习使用上下中心线对齐的专用版式。
  if (lesson.lesson === 1 && sourceSlide.source_slide === 9) {
    buildPinyinPracticeSlide(deck, assets);
    return;
  }
  // 当前输出页独立创建，避免复制后残留旧对象。
  const slide = deck.slides.add();
  // 第一课优先命中共用视觉计划，验证中册式自然留白大画面。
  const scenePlan = resolveLessonOneScenePlan(lesson, sourceSlide);
  // 命中后由共用场景流程先放图片再叠加品牌和文字。
  if (scenePlan) {
    buildFullSceneContent(slide, lesson, sourceSlide, text, assets, scenePlan, continuationIndex);
    return;
  }
  // 未命中大画面计划的页面继续使用当前角色栏目。
  const sectionName = resolveSectionName(lesson, sourceSlide);
  // 普通页同样只显示真实教学栏目。
  addChrome(slide, sectionName, sectionName === "字正腔圆" ? C.yellow : C.coral);
  // 课堂回顾和结束页只需要一个居中的收束语，不使用占据大面积画布的空白底板。
  if (["课堂回顾", "结束页"].includes(sourceSlide.role)) {
    // 收束语取清理后的真实正文；结束页正文为空时使用统一温暖文案。
    const closingText = String(text || "").trim()
      || (sourceSlide.role === "结束页" ? "期待下次再见~" : "今天我们学会了什么？");
    // 主文案位于页面视觉中心，形成明确停顿感而不制造空卡片。
    addText(slide, closingText, {
      left: 230,
      top: 252,
      width: 820,
      height: 150,
    }, {
      name: "CLOSING_MESSAGE",
      fontSize: sourceSlide.role === "结束页" ? 42 : 38,
      bold: sourceSlide.role === "结束页",
      color: sourceSlide.role === "结束页" ? C.teal : C.ink,
      alignment: "center",
      verticalAlignment: "middle",
      autoFit: "none",
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    // 简洁强调线平衡大面积留白，并与全册右上栏目线形成呼应。
    slide.shapes.add({
      geometry: "roundRect",
      name: "CLOSING_ACCENT",
      position: { left: 570, top: 430, width: 140, height: 8 },
      fill: sourceSlide.role === "结束页" ? C.teal : C.coral,
      line: { fill: sourceSlide.role === "结束页" ? C.teal : C.coral, width: 0 },
      borderRadius: "rounded-full",
    });
    // 简洁收束页到此完成，禁止继续添加通用文字卡片。
    return;
  }
  // 课前说明、歌曲、导航、回顾、小任务和结束页使用清晰原生信息版式，不添加无关重复图。
  const textOnly = isTextOnlySource(sourceSlide);
  // 其余课堂模块必须绑定明确视觉角色。
  const hasMedia = !textOnly;
  // 每个教学模块命中独立资产，不再按连续页码粗暴复用四张图。
  const visualKey = sourceSlide.role === "主题导入"
    ? "theme"
    : [6, 11, 14].includes(sourceSlide.source_slide)
      ? "practice"
      : sourceSlide.role === "情境再现"
        ? "scene1"
        : sourceSlide.role === "字正腔圆"
          // 发音模块连续页在镜前示范与课堂练习场景间交替，避免单图高频重复。
          ? (continuationIndex % 2 === 0 ? "scene2" : "practice")
          : sourceSlide.role === "口脑风暴"
            ? "scene3"
            : ["粉墨登场", "句子宝库"].includes(sourceSlide.role)
              ? "scene4"
              : sourceSlide.role === "拓展训练"
                ? "storyboard"
                : sourceSlide.source_slide < 11
                  ? "scene2"
                  : sourceSlide.source_slide < 15
                    ? "scene3"
                    : "scene4";
  // 新增主题图的主体在右侧、课堂练习图的主体在左侧；旧模块图继续交替，保证文字落在自然安全侧。
  const imageOnRight = visualKey === "theme"
    ? true
    : visualKey === "practice"
      ? false
      : sourceSlide.source_slide % 2 === 0;
  // 双栏文字卡位置根据图片方向镜像。
  const cardPosition = hasMedia
    ? { left: imageOnRight ? 54 : 766, top: 154, width: 460, height: 470 }
    : { left: 150, top: 145, width: 980, height: 500 };
  // 图片区域尽量铺满画布主视觉区，同时完整保留人物和场景。
  const imagePosition = { left: 0, top: 0, width: SLIDE_SIZE.width, height: SLIDE_SIZE.height };
  // 当前模块原创媒体完整铺满画布，人物和边框仍由contain保证不裁切。
  if (hasMedia) addOriginalVisual(slide, assets, visualKey, imagePosition);
  // 页面标题优先使用栏目名，连续页增加续页标记。
  const title = resolvePageTitle(lesson, sourceSlide, text);
  // 字符量决定正文起始字号，禁止过密页面使用过大字号。
  // 第一课不以缩小字号换容量；需要压缩时应先清理模板标签和重写成真实教学语。
  const bodyFont = lesson.lesson === 1 ? 35 : text.length > 110 ? 29 : text.length > 72 ? 32 : 35;
  // 第一课情境故事保留人物、动作和分享结果，删除旧模板重复口令。
  const rawBodyText = lesson.lesson === 1 && sourceSlide.source_slide === 7
    ? "《分享》\n小朋友们一起分享食物和玩具。\n娃娃撑着小花伞，弘弘的苹果大又圆。\n苹果切成几瓣，大家一起分享，开心极了！"
    : lesson.lesson === 1 && sourceSlide.source_slide === 23
      // 家庭任务压缩为三条真实可执行练习。
      ? "1. 练习《宝宝和平平》《炮兵攻打八面坡》。\n2. 给爸爸妈妈表演《分苹果》。\n3. 看图讲述《分享好喝的萝卜汤》。"
      // 原稿中的XXX只是模板占位符，成品必须改成可以现场填写的下划线。
      : String(text || "").replace(/X{2,}/giu, "____");
  // 页面正文不得再次显示与标题或右上栏目相同的旧模板标签。
  const bodyText = removeRepeatedHeading(rawBodyText, title, sectionName);
  // 空占位页必须先补成真实观察问题，再判断标题是否重复；禁止用补全前的空正文绕过检测。
  const displayBody = bodyText || resolveFallbackBody(sectionName);
  // 栏目名已经固定显示在右上角时，正文区不得再重复同名标题。
  const hideTitle = title.replace(/\s+/gu, "") === sectionName.replace(/\s+/gu, "")
    || shouldSuppressInstructionTitle(title, displayBody);
  // 普通图文页也通过共用核心按实际文字量收紧底板，禁止固定大卡制造失衡留白。
  const panel = buildAdaptiveTextPanel(cardPosition, title, displayBody, {
    hideTitle,
    role: sourceSlide.role,
  });
  // 文字底板只包围真实文字组，并位于插图预留的安全区内。
  addGlassCard(slide, panel.cardArea);
  // 只有真实业务标题才在卡片中显示，栏目名和机械动作标题由右上栏目或正文承担。
  if (!panel.hideTitle) {
    // 标题与正文共同构成视觉居中的内容组。
    addText(slide, title, panel.titleArea, {
      name: "CONTENT_TITLE",
      fontSize: 31,
      bold: true,
      color: C.coral,
      alignment: "center",
      autoFit: "none",
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  }
  // 正文在卡片有效区域内视觉垂直居中。
  addText(slide, displayBody, panel.bodyArea, {
    name: "CONTENT_BODY",
    // 普通图文页复用共用核心的字号决策，避免旧逻辑只按字符数导致大小失衡。
    fontSize: Math.min(bodyFont, panel.bodyFont),
    color: C.ink,
    alignment: displayBody.length < 70 ? "center" : "left",
    verticalAlignment: "middle",
    typeface: /《|诗|歌|绕口令|儿歌/.test(displayBody) ? FONT_SERIF : FONT_SANS,
    lineSpacing: 1.24,
    autoFit: "none",
  });
  // 三个表演与朗读栏目保留嵌入式音频入口位置。
  if (continuationIndex === 0 && ["情境再现", "口脑风暴", "粉墨登场"].includes(sourceSlide.role)) {
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
 * 读取当前课主题图、课堂练习图、故事板和四个独立原创模块场景。
 */
async function loadLessonAssets(lessonNumber) {
  // 两位课次目录与缓存生成阶段保持一致。
  const lessonDir = path.join(ORIGINAL_ASSET_ROOT, `第${String(lessonNumber).padStart(2, "0")}课`);
  // 七个基础原创资产必须全部存在，缺失时fs.readFile直接中止，禁止回退到少图版本。
  const [theme, practice, storyboard, scene1, scene2, scene3, scene4] = await Promise.all([
    fs.readFile(path.join(lessonDir, "主题底图.png")),
    fs.readFile(path.join(lessonDir, "课堂练习.png")),
    fs.readFile(path.join(lessonDir, "模块故事板.png")),
    fs.readFile(path.join(lessonDir, "场景1.png")),
    fs.readFile(path.join(lessonDir, "场景2.png")),
    fs.readFile(path.join(lessonDir, "场景3.png")),
    fs.readFile(path.join(lessonDir, "场景4.png")),
  ]);
  // 基础视觉按业务角色命名，供所有课次继续复用。
  const assets = { theme, practice, storyboard, scene1, scene2, scene3, scene4 };
  // 第一课补充读取经过语义审核的中册式16:9自然留白插画。
  if (lessonNumber === 1) {
    // 每个视觉计划按声明的缓存文件加载，禁止代码和资源清单发生路径分叉。
    for (const [key, plan] of Object.entries(lessonOneVisualPlans)) {
      // 已有基础资产不重复读取。
      if (assets[key]) continue;
      // 新生成插画进入当前课缓存并成为正式PPT的稳定输入。
      assets[key] = await fs.readFile(path.join(lessonDir, plan.asset));
    }
  }
  // 返回完整视觉集合供生成器和检测器共同校验。
  return assets;
}

/**
 * 把教材截图中的结构化事实重建为“可编辑文字＋原创插图”教学页。
 */
async function buildSupplementSlide(deck, lesson, supplement, index, assets) {
  // 每张教材截图至少对应一页独立可读教学单元。
  const slide = deck.slides.add();
  // 当前截图必须命中已校正结构化映射，禁止用待识别状态继续生成。
  const fact = SUPPLEMENT_FACTS[supplement.file];
  // 缺少映射属于内容硬错误。
  if (!fact?.title || !fact?.body) throw new Error(`缺少截图结构化内容：${supplement.file}`);
  // 第一课第四张教材图讲萝卜汤，必须使用同语义自然留白大场景而不是面包图。
  if (lesson.lesson === 1 && supplement.file === "14.JPG") {
    // 视觉计划提供右侧自然留白，人物和汤品集中在左侧。
    const scenePlan = lessonOneVisualPlans.radishSoup;
    // 教材提取文字必须与插画关键词命中。
    assertSemanticCoverage(`${fact.title}\n${fact.body}`, scenePlan);
    // 共用核心返回完整画布和文字安全区。
    const layout = buildSceneLayout(scenePlan);
    // 原创萝卜汤场景完整显示，禁止回退到教材截图。
    slide.images.add({
      blob: assets.radishSoup,
      contentType: "image/png",
      alt: "分享好喝的萝卜汤原创绘本场景",
      fit: "contain",
      position: layout.imageArea,
      name: "FULL_SCENE_RADISH_SOUP",
    });
    // 教材拓展栏目位于插画上层。
    addChrome(slide, "教材拓展", C.yellow);
    // 教材标题和问题直接叠在整幅插画上，因此使用与文字区同宽的40%透明轻底板。
    addGlassCard(slide, {
      left: layout.textArea.left + 4,
      top: layout.textArea.top + 16,
      width: layout.textArea.width - 8,
      height: layout.textArea.height - 32,
    });
    // 标题与问题作为一个整体放在右侧自然留白区。
    addText(slide, fact.title, {
      left: layout.textArea.left + 24,
      top: layout.textArea.top + 30,
      width: layout.textArea.width - 48,
      height: 72,
    }, {
      name: `SUPPLEMENT_TITLE_${supplement.order}`,
      fontSize: 34,
      bold: true,
      color: C.coral,
      alignment: "center",
    });
    // 结构化教材正文保持可编辑并使用适龄字号。
    addText(slide, fact.body, {
      left: layout.textArea.left + 24,
      top: layout.textArea.top + 116,
      width: layout.textArea.width - 48,
      height: layout.textArea.height - 150,
    }, {
      name: `SUPPLEMENT_BODY_${supplement.order}`,
      fontSize: 32,
      color: C.ink,
      alignment: "center",
      verticalAlignment: "middle",
      lineSpacing: 1.34,
      autoFit: "none",
    });
    // 专用语义页面完成后不再进入通用小图框流程。
    return;
  }
  // 其他教材拓展页沿用故事板和独立分镜排版。
  addChrome(slide, "教材拓展", C.yellow);
  // 四格关系页使用完整故事板，其余页按序使用独立场景，保持画面多样性。
  const visualKey = index === 0 || /按顺序|过程|十二生肖|找不同/.test(fact.body)
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
    fontSize: 32,
    color: C.ink,
    alignment: fact.body.length < 75 ? "center" : "left",
    verticalAlignment: "middle",
    typeface: /《|故事|儿歌|主持词/.test(fact.title) ? FONT_SERIF : FONT_SANS,
    lineSpacing: 1.34,
    autoFit: "none",
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
    // 学习导航属于旧课件目录页，不承载独立教学活动，最终稿直接删除。
    if (sourceSlide.role === "学习导航") continue;
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
    // 图文窄栏按实际视觉行数切分；整页文字卡允许更宽行，但同样禁止以缩字换容量。
    const chunks = lesson.lesson === 1
      // 第一课所有源页按一个教学模块一页生成，禁止因字号策略产生“续”页。
      ? [normalized]
      : sourceSlide.role === "口才之歌"
      // 口才之歌由专用双栏版式一次写入完整统一歌词，禁止切分后重复生成整页。
      ? [normalized]
      : isTextOnlySource(sourceSlide)
        ? splitReadableText(normalized, 110, 34, 6)
        // 其他图文页按中册式自然留白宽度控制单页信息量。
        : splitReadableText(normalized, 34, 12, 5);
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
// 主生成链完成可编辑页面后立即执行原生音频封装，禁止重制时只保留按钮却丢失媒体。
await import("./口才与表演下册音频嵌入器.mjs");
// 整册摘要供检测器和执行文档复用。
console.log(JSON.stringify({ status: "completed", lessons: results }, null, 2));
