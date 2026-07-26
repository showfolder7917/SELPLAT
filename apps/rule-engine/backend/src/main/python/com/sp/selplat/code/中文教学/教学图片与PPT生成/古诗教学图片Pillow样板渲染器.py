"""使用无文字底图和已审核插画生成可精确验收的古诗教学图片。"""

import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def locate_project_root() -> Path:
    """向上查找 Gradle 工程根目录，避免能力依赖某台机器或旧 OPTION 目录。"""

    # 业务上能力可被任意工程调用，因此只以工程标记识别当前项目根而不固定 SELPLAT 路径。
    for candidate in Path(__file__).resolve().parents:
        # 业务上 settings.gradle 是本工程构建与缓存归属的稳定标记。
        if (candidate / "settings.gradle").is_file():
            return candidate
    # 业务上无法判断项目归属时必须中止，避免把成品写入源码目录或系统临时目录。
    raise RuntimeError("未找到包含 settings.gradle 的工程根目录")


# 业务上所有运行输出归当前工程 OPTION/temp，确保样板生成不污染下载工程旧目录。
PROJECT_ROOT = locate_project_root()
# 业务上中文教学临时数据采用统一根目录，调用方可按项目名继续分类。
POETRY_WORKSPACE_ROOT = PROJECT_ROOT / "OPTION/temp/中文教学/教学图片与PPT生成"
# 业务上 OPTION/temp 是本项目全部可清理运行数据的唯一入口。
OPTION_ROOT = PROJECT_ROOT / "OPTION/temp"
# 业务上《咏鹅》一体化样例使用已把书卷、白鹅和山水直接画入栏目的无文字整页底图，不让图片模型承担汉字排版。
BACKGROUND_PATH = POETRY_WORKSPACE_ROOT / "公共/样板底图/001_咏鹅_无文字一体化底图_v3_插画去重.png"
# 业务上主题插画用于故事和启示卡片的视觉平衡区，与当前诗词保持一一对应。
THEME_ART_PATH = POETRY_WORKSPACE_ROOT / "项目/小学人教1-6年级古诗词汇总（拼音版）核定版1/参考资料/插画/咏鹅.png"
# 业务上书卷插画用于解读和核心意境卡片，避免所有栏目机械重复白鹅图。
STUDY_ART_PATH = POETRY_WORKSPACE_ROOT / "项目/小学人教1-6年级古诗词汇总（拼音版）核定版1/参考资料/插画/书卷笔筒.png"
# 业务上样例成图属于可由底图和核定内容重新生成的派生输出，因此写入小学项目的可删除最终输出分类并保留版本名供比较。
OUTPUT_PATH = OPTION_ROOT / "可删除临时文件/教学图片与PPT生成/小学人教1-6年级古诗词/最终输出（可重新生成）/小学人教1-6年级古诗词汇总（拼音版）核定版1/001_咏鹅_一体化修正版_v3_插画去重.jpg"
# 业务上文楷由工程缓存统一提供；调用方也可通过环境变量指定已核定的同类字体。
DISPLAY_FONT_PATH = Path(os.environ.get("CHINESE_TEACHING_DISPLAY_FONT", PROJECT_ROOT / "cache/fonts/LXGWWenKai-Regular.ttf"))
# 业务上正文与拼音默认复用同一工程字体，避免引用操作系统专属绝对字体路径。
BODY_FONT_PATH = Path(os.environ.get("CHINESE_TEACHING_BODY_FONT", DISPLAY_FONT_PATH))
# 业务上拼音字体允许独立指定；未指定时与正文保持同一可迁移字体来源。
PINYIN_FONT_PATH = Path(os.environ.get("CHINESE_TEACHING_PINYIN_FONT", BODY_FONT_PATH))
# 业务上标准成品固定为用户规则要求的像素尺寸。
CANVAS_SIZE = (1053, 1493)
# 业务上深墨色用于正文，保持宣纸底上的印刷对比度。
INK = "#342b20"
# 业务上棕色用于标题和标签，延续底图的古金棕视觉体系。
BROWN = "#704a24"
# 业务上灰棕色用于作者和拼音，降低辅助信息的视觉层级。
MUTED = "#675846"
# 业务上标签文字使用暖白色，避免纯白与宣纸背景产生突兀对比。
LABEL_TEXT = "#fffdf7"


def load_font(path: Path, size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    """按明确字体文件加载字号，禁止系统静默选择未知回退字体。"""

    # 业务上字体文件缺失时立即失败，避免整批作品出现不同机器字形漂移。
    if not path.is_file():
        raise FileNotFoundError(f"字体文件不存在：{path}")
    # 业务上由 Pillow 直接载入指定字体文件及 TTC 字重索引，使尺寸测量和最终绘制使用同一字体对象。
    return ImageFont.truetype(str(path), size, index=index)


def draw_centered(draw: ImageDraw.ImageDraw, text: str, y: int, font: ImageFont.FreeTypeFont, fill: str) -> None:
    """把一行文字水平居中到标准画布。"""

    # 业务上使用实际字形包围框计算宽度，而不是按字符数量估计居中位置。
    box = draw.textbbox((0, 0), text, font=font)
    # 业务上按实测宽度求得左坐标，使标题、作者和页脚保持同一中轴线。
    x = (CANVAS_SIZE[0] - (box[2] - box[0])) / 2
    # 业务上绘制到已通过边框检查的基线区域，不允许文字压住标题框或页脚框。
    draw.text((x, y), text, font=font, fill=fill)


def draw_label(draw: ImageDraw.ImageDraw, x: int, y: int, text: str) -> tuple[int, int, int, int]:
    """在内容框内部绘制栏目标签并返回包围框。"""

    # 业务上栏目字号固定为 26px，在信息层级清晰的同时为边框留出足够内边距。
    label_font = load_font(DISPLAY_FONT_PATH, 26)
    # 业务上按实际栏目名称测量标签宽度，避免短标签旁出现过长色块。
    text_box = draw.textbbox((0, 0), text, font=label_font)
    # 业务上标签高度固定为 42px，所有栏目在整页中保持一致节奏。
    label_box = (x, y, x + text_box[2] - text_box[0] + 34, y + 42)
    # 业务上圆角棕色底完整位于内容框内，不再覆盖或切断上边框。
    draw.rounded_rectangle(label_box, radius=11, fill=BROWN)
    # 业务上标签文字在色块内部保留左右 17px、上下 6px 的可见留白。
    draw.text((x + 17, y + 6), text, font=label_font, fill=LABEL_TEXT)
    # 业务上返回实际标签包围框，便于后续验证标签与正文、边框的距离。
    return label_box


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, maximum_width: int) -> list[str]:
    """按实际宋体字宽换行中文正文。"""

    # 业务上逐字符构造当前行，保证中文标点和正文顺序保持原样。
    lines: list[str] = []
    # 业务上当前行从空文本开始，后续只在完整字符边界换行。
    current = ""
    # 业务上遍历扩展文案中的每个字符，避免通过平均字宽造成右侧压线。
    for character in text:
        # 业务上先试排新增字符后的实际宽度，再决定是否换行。
        candidate = current + character
        # 业务上只有当前行非空且超出安全宽度时才收取一行，禁止生成空行。
        if current and draw.textbbox((0, 0), candidate, font=font)[2] > maximum_width:
            # 业务上句号、逗号等闭合标点不得成为新行首字符，超宽时把前一个正文字符与标点共同移到下一行。
            if character in "，。；：！？、”’）》】」』" and len(current) > 1:
                # 业务上先收取去掉末字后的上一行，使其继续保持在文字安全宽度内。
                lines.append(current[:-1])
                # 业务上新行以正文末字开头并紧跟标点，避免出现截图中的孤立句号。
                current = current[-1] + character
            else:
                # 业务上普通字符超宽时收取当前完整行，避免末字侵入插画平衡区。
                lines.append(current)
                # 业务上超宽字符作为下一行首字符继续排版，不丢失内容。
                current = character
        else:
            # 业务上未超宽时继续累积当前行，保持自然中文阅读节奏。
            current = candidate
    # 业务上收取段尾剩余文字，避免末句和标点被遗漏。
    if current:
        lines.append(current)
    # 业务上返回稳定行列表，绘制与验证使用同一换行结果。
    return lines


def draw_body(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, width: int, line_height: int = 34) -> list[tuple[int, int, int, int]]:
    """在指定安全区绘制正文并返回每行实际包围框。"""

    # 业务上说明正文使用规则最低 24px 宋体，兼顾清晰度、空间利用和与标签的字体区分。
    body_font = load_font(BODY_FONT_PATH, 24, index=6)
    # 业务上保存全部行包围框，供生成后执行边框和插画碰撞检查。
    boxes: list[tuple[int, int, int, int]] = []
    # 业务上按实测宽度得到稳定换行，不把文字挤入右侧插画区域。
    for line in wrap_text(draw, text, body_font, width):
        # 业务上在真正绘制前记录当前行实际像素范围。
        box = draw.textbbox((x, y), line, font=body_font)
        # 业务上正文统一使用深墨色，保证屏幕和打印状态均可阅读。
        draw.text((x, y), line, font=body_font, fill=INK)
        # 业务上保存包围框用于最终自动检查，而不是仅凭缩略图判断。
        boxes.append(box)
        # 业务上每行固定前进 33px，保持正文松紧一致且不发生上下重叠。
        y += line_height
    # 业务上返回包围框集合，让调用方能验证全部文字仍在内容框安全区内。
    return boxes


def make_feathered_art(source: Image.Image, size: tuple[int, int], opacity: int) -> Image.Image:
    """把现有插画缩放成带柔和边缘的栏目小景。"""

    # 业务上将插画统一转为 RGBA，使透明素材和普通 RGB 素材可以走同一合成路径。
    art = source.convert("RGBA")
    # 业务上按目标区域等比缩放，禁止把白鹅、书卷或山水拉伸变形。
    art.thumbnail(size, Image.Resampling.LANCZOS)
    # 业务上建立与缩放后插画同尺寸的灰度遮罩，用于控制边缘透明度。
    mask = Image.new("L", art.size, 0)
    # 业务上在遮罩内保留 8px 呼吸区，避免插画边缘形成生硬矩形照片感。
    mask_draw = ImageDraw.Draw(mask)
    # 业务上用圆角矩形覆盖主体区域，整体透明度由栏目层级决定。
    mask_draw.rounded_rectangle((8, 8, art.width - 8, art.height - 8), radius=22, fill=opacity)
    # 业务上把已有透明通道与栏目遮罩相乘，书卷素材的透明背景不会变成色块。
    if art.getchannel("A").getextrema() != (255, 255):
        mask = Image.composite(mask, Image.new("L", art.size, 0), art.getchannel("A"))
    # 业务上把最终遮罩写回插画，后续可安全贴入正文旁的视觉平衡区。
    art.putalpha(mask)
    # 业务上返回已处理插画，不在此函数猜测具体栏目坐标。
    return art


def paste_art(canvas: Image.Image, source: Image.Image, box: tuple[int, int, int, int], opacity: int = 210) -> None:
    """把插画在指定栏目平衡区中居中贴入。"""

    # 业务上根据栏目矩形计算最大允许尺寸，插画与内边框至少保留既定安全距离。
    target_size = (box[2] - box[0], box[3] - box[1])
    # 业务上生成带柔和透明边缘的栏目小景，避免覆盖文字安全区。
    art = make_feathered_art(source, target_size, opacity)
    # 业务上按栏目平衡区中心计算坐标，使不同长宽素材都保持视觉居中。
    x = box[0] + (target_size[0] - art.width) // 2
    # 业务上按栏目平衡区中心计算纵坐标，使图片不会贴住上边框或下边框。
    y = box[1] + (target_size[1] - art.height) // 2
    # 业务上使用自身透明通道合成，不改变无文字底图中的边框和纸纹。
    canvas.alpha_composite(art, (x, y))


def draw_annotated_poem(draw: ImageDraw.ImageDraw) -> list[tuple[int, int, int, int]]:
    """绘制《咏鹅》核定版逐字拼音和原文。"""

    # 业务上逐行数据保持 DOCX 中核定的拼音、汉字和标点顺序。
    rows = [
        [("é", "鹅"), ("", "，"), ("é", "鹅"), ("", "，"), ("é", "鹅"), ("", "，")],
        [("qū", "曲"), ("xiàng", "项"), ("xiàng", "向"), ("tiān", "天"), ("gē", "歌"), ("", "。")],
        [("bái", "白"), ("máo", "毛"), ("fú", "浮"), ("lǜ", "绿"), ("shuǐ", "水"), ("", "，")],
        [("hóng", "红"), ("zhǎng", "掌"), ("bō", "拨"), ("qīng", "清"), ("bō", "波"), ("", "。")],
    ]
    # 业务上汉字使用 40px 文楷，形成教学页中最清晰的阅读主体。
    hanzi_font = load_font(DISPLAY_FONT_PATH, 40)
    # 业务上拼音使用 18px Arial，声调清楚且不与汉字争夺层级。
    pinyin_font = load_font(PINYIN_FONT_PATH, 18)
    # 业务上收集每个拼音和汉字的包围框，供最终检查逐字区域是否越界。
    boxes: list[tuple[int, int, int, int]] = []
    # 业务上每个核定行使用 72px 行距，拼音、汉字及下一行之间保持稳定呼吸。
    for row_index, row in enumerate(rows):
        # 业务上逐字列宽同时容纳拼音和汉字，连续 xiàng 不会粘连。
        widths: list[int] = []
        # 业务上逐个核定字元测量实际显示宽度，不用固定平均列宽。
        for pinyin, hanzi in row:
            # 业务上无拼音标点的拼音宽度按零处理，不绘制占位字符。
            pinyin_width = draw.textbbox((0, 0), pinyin, font=pinyin_font)[2] if pinyin else 0
            # 业务上汉字或标点宽度直接来自实际字体度量。
            hanzi_width = draw.textbbox((0, 0), hanzi, font=hanzi_font)[2]
            # 业务上中文标点使用窄列，其余字元保留最小 10px 横向呼吸空间。
            widths.append(26 if hanzi in "，。！？" else max(42, pinyin_width, hanzi_width) + 10)
        # 业务上整行在左侧诗文安全区内居中，不侵入右侧主题插画。
        x = 100 + (445 - sum(widths)) / 2
        # 业务上行起点位于栏目标签下方，四行诗整体在主卡片中垂直居中。
        y = 330 + row_index * 72
        # 业务上逐列绘制拼音和对应汉字，始终保持同一中心线。
        for (pinyin, hanzi), width in zip(row, widths):
            # 业务上只为非空拼音绘制拉丁字符，标点上方保持空白。
            if pinyin:
                # 业务上按实际拼音宽度计算列内居中坐标。
                pinyin_width = draw.textbbox((0, 0), pinyin, font=pinyin_font)[2]
                # 业务上拼音使用灰棕色，作为汉字的辅助信息层。
                draw.text((x + (width - pinyin_width) / 2, y), pinyin, font=pinyin_font, fill=MUTED)
                # 业务上记录拼音包围框，便于后续发现越框或相邻粘连。
                boxes.append(draw.textbbox((x + (width - pinyin_width) / 2, y), pinyin, font=pinyin_font))
            # 业务上测量当前汉字的实际宽度，保证列内视觉居中。
            hanzi_width = draw.textbbox((0, 0), hanzi, font=hanzi_font)[2]
            # 业务上汉字使用深墨色，并与对应拼音保持 22px 垂直间距。
            draw.text((x + (width - hanzi_width) / 2, y + 22), hanzi, font=hanzi_font, fill=INK)
            # 业务上记录汉字包围框，确保诗文不会侵入插画或卡片边框。
            boxes.append(draw.textbbox((x + (width - hanzi_width) / 2, y + 22), hanzi, font=hanzi_font))
            # 业务上按当前列实测宽度前进，保持逐字对应关系不变。
            x += width
    # 业务上返回全部逐字包围框，统一纳入最终几何验证。
    return boxes


def assert_inside(boxes: list[tuple[int, int, int, int]], anchor: tuple[int, int, int, int], minimum_gap: int, name: str) -> None:
    """验证文字完全位于对应内容框的安全内边距内。"""

    # 业务上逐个检查实际文字包围框，任何一行失败都不能交付整张图片。
    for box in boxes:
        # 业务上同时检查四个方向的最小距离，防止只检查左右而漏掉上下压线。
        if box[0] < anchor[0] + minimum_gap or box[1] < anchor[1] + minimum_gap or box[2] > anchor[2] - minimum_gap or box[3] > anchor[3] - minimum_gap:
            # 业务上异常包含栏目名、文字框和锚点，便于下一轮直接定位调整。
            raise ValueError(f"{name}文字未通过安全区检查：box={box}, anchor={anchor}, gap={minimum_gap}")


def render_sample() -> Path:
    """生成并验证新版《咏鹅》样例。"""

    # 业务上先确认一体化底图存在，栏目小景已经属于底图，不再另外嵌入独立图片块。
    for required_path in (BACKGROUND_PATH,):
        if not required_path.is_file():
            raise FileNotFoundError(f"图片素材不存在：{required_path}")
    # 业务上把 imagegen 可能出现的 1px 宽高差统一缩放为 1053×1493，并按新尺寸使用同一比例锚点。
    canvas = Image.open(BACKGROUND_PATH).convert("RGBA").resize(CANVAS_SIZE, Image.Resampling.LANCZOS)
    # 业务上一体化小景已由 imagegen 直接绘制在栏目右侧及底部景线上，排字器只创建文字画笔覆盖核定文字。
    draw = ImageDraw.Draw(canvas)
    # 业务上标题使用 52px 文楷并适度上移，为作者与标题框底线同时预留呼吸空间。
    draw_centered(draw, "咏鹅", 100, load_font(DISPLAY_FONT_PATH, 52), BROWN)
    # 业务上作者使用 22px 文楷位于标题下方，并与标题框底线保留超过 16px 的视觉距离。
    draw_centered(draw, "【唐】骆宾王", 158, load_font(DISPLAY_FONT_PATH, 22), MUTED)
    # 业务上原文标签与主卡片上边框保持 20px 以上距离，标签完全在框内。
    poem_label = draw_label(draw, 86, 250, "原文与注音")
    # 业务上逐字注音从 DOCX 核定内容绘制到主卡片左侧安全区。
    poem_boxes = draw_annotated_poem(draw)
    # 业务上故事标签位于左侧卡片内部，顶部和左侧均保留稳定内边距。
    story_label = draw_label(draw, 86, 752, "诗意故事")
    # 业务上故事正文使用左文右图列布局，不让短文集中在上方后留下整块空白。
    story_boxes = draw_body(draw, 92, 812, "清晨，骆宾王在池边看见白鹅游水。长颈向天鸣叫，红掌轻拨清波。", 220)
    # 业务上解读标签与故事标签保持同一纵坐标，形成左右卡片对齐关系。
    interpretation_label = draw_label(draw, 560, 752, "诗句解读")
    # 业务上解读正文在左侧窄列换行，右侧书卷小景承担视觉平衡。
    interpretation_boxes = draw_body(draw, 568, 812, "叫声、白毛、红掌、清水组成画面；“浮、拨”写出轻快姿态。", 170, line_height=30)
    # 业务上核心标签下移到长框内部 22px，彻底消除标签压住上边框的问题。
    core_label = draw_label(draw, 145, 1035, "核心意境")
    # 业务上核心正文位于标签下方并限制在左侧文字区，右侧书卷插画保持可见。
    core_boxes = draw_body(draw, 150, 1085, "• 细心观察，用声音、颜色和动作写活白鹅。", 400, line_height=28)
    # 业务上启示标签使用与核心标签相同的左内边距和顶部距离，整页模块保持一致。
    life_label = draw_label(draw, 145, 1206, "生活启示")
    # 业务上启示正文在一至两行内完成，右侧主题图不与文字发生碰撞。
    life_boxes = draw_body(draw, 150, 1258, "• 观察外形、声音和动作，写作选准动词。", 480)
    # 业务上页脚总结在独立窄框中水平居中，四周保留可见宣纸留白。
    draw_centered(draw, "在观察中发现诗意，在童心里感受自然。", 1365, load_font(DISPLAY_FONT_PATH, 23), BROWN)
    # 业务上栏目标签也作为文字区域接受框内安全距离检查。
    assert_inside([poem_label], (64, 227, 989, 709), 16, "原文标签")
    # 业务上诗文逐字包围框必须完全位于主卡片左侧安全区内。
    assert_inside(poem_boxes, (80, 300, 535, 685), 16, "原文与拼音")
    # 业务上故事标签和正文分别检查，避免标签通过但正文仍贴线。
    assert_inside([story_label, *story_boxes], (64, 731, 520, 989), 16, "诗意故事")
    # 业务上解读标签和正文分别检查，确保左右卡片采用相同安全标准。
    assert_inside([interpretation_label, *interpretation_boxes], (534, 731, 989, 989), 16, "诗句解读")
    # 业务上核心标签及正文必须与长框边线保持至少 16px 距离。
    assert_inside([core_label, *core_boxes], (120, 1013, 933, 1159), 16, "核心意境")
    # 业务上生活启示标签及正文必须与长框边线保持至少 16px 距离。
    assert_inside([life_label, *life_boxes], (120, 1184, 933, 1315), 16, "生活启示")
    # 业务上输出目录按需创建，确保重新修正能稳定写入用户指定位置。
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    # 业务上最终成品转换为 RGB 并用高质量 JPEG 保存，保持中文边缘清晰。
    canvas.convert("RGB").save(OUTPUT_PATH, quality=95, subsampling=0)
    # 业务上重新解码成品并验证精确尺寸，排除损坏文件或画布漂移。
    with Image.open(OUTPUT_PATH) as verified:
        if verified.size != CANVAS_SIZE:
            raise ValueError(f"成品尺寸错误：{verified.size}")
    # 业务上返回最终路径供批处理清单和人工验收使用。
    return OUTPUT_PATH


# 业务上直接运行脚本时只生成当前已确认样例，后续批量入口复用同一版式函数。
if __name__ == "__main__":
    # 业务上输出最终绝对路径，方便人工立即打开验收图片。
    print(render_sample())
