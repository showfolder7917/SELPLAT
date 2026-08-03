"""把核定清单、待审教学内容和一体化无文字底图合成为古诗教学图片。"""

import argparse
import importlib.util
import json
from pathlib import Path

from PIL import Image, ImageDraw


# 业务上通用排版器与样板渲染器同目录部署，避免迁移后继续引用 OPTION 下的旧脚本。
POETRY_WORKSPACE_ROOT = Path(__file__).resolve().parent
# 业务上复用已迁入规则引擎的样板渲染器，保持字体、标签、换行和几何检查一致。
BASE_RENDERER_PATH = POETRY_WORKSPACE_ROOT / "古诗教学图片Pillow样板渲染器.py"
# 业务上模块规格绑定到明确文件，避免同名脚本从系统路径被误加载。
BASE_SPEC = importlib.util.spec_from_file_location("poetry_sample_renderer", BASE_RENDERER_PATH)
# 业务上规格或加载器缺失表示样板排版器不可用，当前篇目必须停止。
if BASE_SPEC is None or BASE_SPEC.loader is None:
    raise RuntimeError(f"无法加载样板排版器：{BASE_RENDERER_PATH}")
# 业务上创建独立模块实例，批量排版不会执行样板脚本的命令行入口。
BASE = importlib.util.module_from_spec(BASE_SPEC)
# 业务上加载已验收绘制函数，保证正式图片与样板使用同一字体和标签尺寸。
BASE_SPEC.loader.exec_module(BASE)


def parse_arguments() -> argparse.Namespace:
    """读取一篇作品的核定清单、内容、底图和输出路径。"""

    # 业务上所有路径和篇号都由命名参数提供，禁止根据目录中第一个文件猜测。
    parser = argparse.ArgumentParser(description="生成一张古诗教学图片")
    # 业务上核定清单是标题、作者、原文和逐字拼音的唯一来源。
    parser.add_argument("--manifest", required=True, type=Path)
    # 业务上篇号采用从一开始的 DOCX 位置，决定清单索引和正式文件名。
    parser.add_argument("--sequence", required=True, type=int)
    # 业务上教学扩展内容来自独立 JSON，并保留待审状态。
    parser.add_argument("--content", required=True, type=Path)
    # 业务上底图必须是当前诗词的无文字一体化素材。
    parser.add_argument("--background", required=True, type=Path)
    # 业务上输出必须由调用方指定，避免覆盖已有人工验收版本。
    parser.add_argument("--output", required=True, type=Path)
    # 业务上返回完整参数对象，后续先统一校验再绘制。
    return parser.parse_args()


def read_json(path: Path) -> dict:
    """读取 UTF-8 JSON 并确认文件真实存在。"""

    # 业务上缺少核定清单或待审内容时停止当前篇目，禁止生成空栏目。
    if not path.is_file():
        raise FileNotFoundError(f"JSON 文件不存在：{path}")
    # 业务上按 UTF-8 解析中文和带调拼音，不使用系统区域编码。
    return json.loads(path.read_text(encoding="utf-8"))


def annotated_rows(poem: dict) -> list[list[tuple[str, str]]]:
    """把清单逐字结构转换为稳定的拼音汉字行。"""

    # 业务上每一行都保持 DOCX 解析顺序，不重新分句或改写标点。
    rows: list[list[tuple[str, str]]] = []
    # 业务上逐行读取 token，使拼音和原字符始终成对进入排版。
    for line in poem["lines"]:
        # 业务上逐字只取核定 pinyin 与 text 字段，不调用任何拼音生成库。
        rows.append([(token["pinyin"], token["text"]) for token in line["tokens"]])
    # 业务上正文不能为空，空作品不能生成教学图片。
    if not rows:
        raise ValueError("核定作品没有正文行")
    # 业务上返回保持原顺序的行集合，绘制和校验共用同一份数据。
    return rows


def wrap_long_source_rows(rows: list[list[tuple[str, str]]]) -> list[list[tuple[str, str]]]:
    """把十字以上复句仅在原有标点处换成标准字号展示行。"""

    # 业务上生成新的展示行集合，核定 token 本身及先后顺序保持不变。
    display_rows: list[list[tuple[str, str]]] = []
    # 业务上逐条检查源行，普通五言、七言和八字民歌不改变原有行结构。
    for source_row in rows:
        regular_count = sum(1 for pinyin, _ in source_row if pinyin)
        if regular_count < 10:
            display_rows.append(source_row)
            continue
        # 业务上十字复句以 DOCX 已有逗号或句号作为唯一换行点，不新增、删除或改写任何标点。
        segment: list[tuple[str, str]] = []
        for token in source_row:
            segment.append(token)
            if token[1] in "，。；！？":
                display_rows.append(segment)
                segment = []
        # 业务上异常缺少句末标点时仍保留剩余 token，避免正文被静默丢失。
        if segment:
            display_rows.append(segment)
    # 业务上返回只改变视觉换行的完整 token 集合，后续包围框检查照常执行。
    return display_rows


def draw_poem(draw: ImageDraw.ImageDraw, rows: list[list[tuple[str, str]]]) -> list[tuple[int, int, int, int]]:
    """在主卡片左侧按实测列宽绘制逐字注音。"""

    # 业务上预先识别八字以上长句，仅为这类民歌长句启用紧凑字号，普通五言、七言继续沿用已核定样板。
    maximum_regular_token_count = max((sum(1 for pinyin, _ in row if pinyin) for row in rows), default=0)
    # 业务上汉字仍使用样板文楷，长句降至 36px 后可留在左侧诗文区且保持清晰层级。
    hanzi_font = BASE.load_font(BASE.DISPLAY_FONT_PATH, 30 if maximum_regular_token_count >= 10 else (36 if maximum_regular_token_count >= 8 else 40))
    # 业务上拼音仍使用样板 Arial，长句同步收紧以免较长拼音撑破单字列。
    pinyin_font = BASE.load_font(BASE.PINYIN_FONT_PATH, 13 if maximum_regular_token_count >= 10 else (16 if maximum_regular_token_count >= 8 else 18))
    # 业务上全部拼音和汉字包围框进入最终安全区检查。
    boxes: list[tuple[int, int, int, int]] = []
    # 业务上正文总高度按实际行数计算，四行诗保持样板位置，更多行自动压缩到预检上限内。
    line_step = min(72, 300 // max(1, len(rows)))
    # 业务上最低行距不足以容纳拼音和汉字时触发分页，而不是继续压缩。
    if line_step < 58:
        raise ValueError(f"正文共 {len(rows)} 行，需要进入多页计划")
    # 业务上按总高度把诗文垂直放在主卡片阅读区中部。
    start_y = 330 + max(0, (4 - len(rows)) * 18)
    # 业务上逐行计算列宽与整行宽度，使不同句长仍在左侧安全区居中。
    for row_index, row in enumerate(rows):
        # 业务上统计当前句实际带拼音字数，区分五言宽列和七言紧凑列。
        regular_token_count = sum(1 for pinyin, _ in row if pinyin)
        # 业务上七言句使用 54px 最小列宽，五言及更短句保留样板 74px 舒展列宽。
        # 对八字及以上长句进一步收紧单字列宽，保证民歌长句仍留在左侧诗文安全区，避免侵入右侧一体化插画。
        # 业务上只要本诗包含八字长句，同页各行统一采用紧凑列宽，避免长短句之间字号和起伏观感不一致。
        minimum_token_width = 34 if maximum_regular_token_count >= 10 else (44 if maximum_regular_token_count >= 8 else (54 if regular_token_count >= 7 else 74))
        # 业务上十字复句的拼音列使用更小内边距，使原 DOCX 整句不拆字也能完整保留在 420px 阅读区。
        token_padding = 4 if maximum_regular_token_count >= 10 else 10
        # 业务上每个列宽同时容纳拼音和汉字，连续同音拼音不会粘连。
        widths: list[int] = []
        # 业务上逐字采用实际字体宽度，标点使用窄列。
        for pinyin, hanzi in row:
            # 业务上标点没有拼音时不人为增加拼音占位宽度。
            pinyin_width = draw.textbbox((0, 0), pinyin, font=pinyin_font)[2] if pinyin else 0
            # 业务上汉字宽度由正式文楷字体实测。
            hanzi_width = draw.textbbox((0, 0), hanzi, font=hanzi_font)[2]
            # 业务上无拼音标点只保留 22px 窄列，普通字列使用当前句式的最小列宽并容纳实测字形。
            widths.append(22 if not pinyin else max(minimum_token_width, pinyin_width + token_padding, hanzi_width + token_padding))
        # 业务上行宽超过左侧诗文安全区时必须进入多页或专用版式。
        if sum(widths) > 420:
            raise ValueError(f"诗句宽度 {sum(widths)}px 超过主卡片安全区，需要专用版式")
        # 业务上当前诗句在 90 至 510 的左侧阅读区水平居中。
        x = 90 + (420 - sum(widths)) / 2
        # 业务上每行起点由统一行距计算，拼音与汉字共同移动。
        y = start_y + row_index * line_step
        # 业务上逐列绘制拼音和原字符，并记录实际包围框。
        for (pinyin, hanzi), width in zip(row, widths):
            # 业务上只绘制核定非空拼音，标点上方保持空白。
            if pinyin:
                # 业务上拼音按实际宽度在当前字列居中。
                pinyin_width = draw.textbbox((0, 0), pinyin, font=pinyin_font)[2]
                # 业务上拼音使用灰棕辅助色，不与汉字争夺视觉层级。
                draw.text((x + (width - pinyin_width) / 2, y), pinyin, font=pinyin_font, fill=BASE.MUTED)
                # 业务上记录拼音的真实像素范围，后续检查越框与贴边。
                boxes.append(draw.textbbox((x + (width - pinyin_width) / 2, y), pinyin, font=pinyin_font))
            # 业务上汉字按当前列实测居中，保持拼音与原文一一对应。
            hanzi_width = draw.textbbox((0, 0), hanzi, font=hanzi_font)[2]
            # 业务上汉字位于拼音下方 22px，并使用样板深墨色。
            draw.text((x + (width - hanzi_width) / 2, y + 22), hanzi, font=hanzi_font, fill=BASE.INK)
            # 业务上记录汉字或标点包围框，确保全部位于主卡片安全区。
            boxes.append(draw.textbbox((x + (width - hanzi_width) / 2, y + 22), hanzi, font=hanzi_font))
            # 业务上按当前实测列宽前进，不使用平均字符间距。
            x += width
    # 业务上返回全部逐字包围框供统一几何验证。
    return boxes


def is_gold_border_pixel(pixel: tuple[int, ...]) -> bool:
    """识别母版金棕框线像素，忽略宣纸和普通水墨颜色。"""

    # 业务上只读取 RGB 三通道，RGBA 底图的透明度不参与框线颜色判断。
    red, green, blue = pixel[:3]
    # 业务上金棕框线需同时满足亮度、棕色比例和蓝通道上限，减少山水插画误判。
    return red > 120 and 70 < green < 200 and blue < 145 and red > green * 0.9 and green > blue * 1.05


def validate_locked_frame_geometry(canvas: Image.Image) -> None:
    """按锁定母版的真实横线位置检查全部内容框没有漂移。"""

    # 业务上每项记录框名、横向扫描范围、母版横线纵坐标及最少连续金线像素数。
    checks = [
        ("主卡片上边", 60, 990, 226, 400),
        ("主卡片下边", 60, 990, 712, 400),
        ("双栏上边", 60, 990, 735, 350),
        ("双栏下边", 60, 990, 993, 350),
        ("核心栏上边", 115, 935, 1016, 350),
        ("核心栏下边", 115, 935, 1163, 350),
        ("启示栏上边", 115, 935, 1185, 350),
        ("启示栏下边", 115, 935, 1320, 350),
        ("页脚框上边", 310, 745, 1347, 150),
        ("页脚框下边", 310, 745, 1411, 150),
    ]
    # 业务上逐条检查真实框线，任何一条缺失都在排字前终止当前篇目。
    for name, left, right, expected_y, minimum_count in checks:
        # 业务上允许 imagegen 或标准缩放产生最多 6px 的抗锯齿位置差。
        candidate_counts: list[int] = []
        # 业务上扫描母版纵坐标附近的每一行，寻找当前边框的最强金线响应。
        for y in range(expected_y - 6, expected_y + 7):
            # 业务上统计指定横向范围内的金棕框线像素，插画区不参与其它位置扫描。
            candidate_counts.append(sum(is_gold_border_pixel(canvas.getpixel((x, y))) for x in range(left, right)))
        # 业务上最强响应仍低于阈值表示框线移动、缺失、变形或被插画覆盖。
        if max(candidate_counts, default=0) < minimum_count:
            raise ValueError(f"无文字底图框线漂移：{name}，expectedY={expected_y}，goldCount={max(candidate_counts, default=0)}")


def render(args: argparse.Namespace) -> Path:
    """合成一篇单页古诗并执行样板同级的几何检查。"""

    # 业务上篇号必须落在清单范围内，避免零号或越界编号写错标题。
    manifest = read_json(args.manifest)
    # 业务上清单数组位置与 DOCX 位置一一对应，篇号从一转换为数组下标。
    if args.sequence < 1 or args.sequence > len(manifest["poems"]):
        raise ValueError(f"篇号超出清单范围：{args.sequence}")
    # 业务上选取当前篇的核定标题、作者、原文和拼音。
    poem = manifest["poems"][args.sequence - 1]
    # 业务上读取独立教学内容，并保留待审状态供生成清单记录。
    content = read_json(args.content)
    # 业务上内容标题必须与核定标题一致，防止同名目录里绑定错篇。
    if content.get("title") != poem["title"]:
        raise ValueError(f"教学内容标题与核定标题不一致：{content.get('title')} != {poem['title']}")
    # 业务上一体化底图缺失时停止当前篇目，不回退到其它诗词插画。
    if not args.background.is_file():
        raise FileNotFoundError(f"无文字底图不存在：{args.background}")
    # 业务上把 imagegen 的一像素尺寸差统一到标准画布并重建绘制上下文。
    canvas = Image.open(args.background).convert("RGBA").resize(BASE.CANVAS_SIZE, Image.Resampling.LANCZOS)
    # 业务上排字前先核对真实框线位置，防止旧锚点让跨线文字产生假阳性。
    validate_locked_frame_geometry(canvas)
    # 业务上全部核定文字通过 Pillow 画笔后加，图片模型不承担文字正确性。
    draw = ImageDraw.Draw(canvas)
    # 业务上标题默认沿用样板 52px，长标题逐级缩小到标题框 440px 安全宽度内，左右至少保留约 20px 留白。
    title_font_size = 52
    # 业务上按正式文楷字体实测标题宽度，禁止仅按汉字数量估算而让括号等字符越过边框。
    while title_font_size > 32:
        title_font = BASE.load_font(BASE.DISPLAY_FONT_PATH, title_font_size)
        if draw.textbbox((0, 0), poem["title"], font=title_font)[2] <= 440:
            break
        title_font_size -= 2
    # 业务上使用已通过宽度预检的字号居中绘制，短标题不受长标题适配影响。
    BASE.draw_centered(draw, poem["title"], 100, title_font, BASE.BROWN)
    # 业务上朝代作者完全来自核定清单，并保持样板作者带状区域位置。
    attribution = f"【{poem['dynasty']}】{poem['author']}" if poem["dynasty"] else poem["author"]
    # 业务上多页作品把当前页码作为独立元数据追加到作者后，不修改核定作者字段。
    if int(content.get("pageCount", 1)) > 1:
        attribution = f"{attribution}  ·  {int(content['pageNumber'])}/{int(content['pageCount'])}页"
    # 业务上作者采用样板灰棕色和 22px 字号，与标题框边线保持安全距离。
    BASE.draw_centered(draw, attribution, 158, BASE.load_font(BASE.DISPLAY_FONT_PATH, 22), BASE.MUTED)
    # 业务上所有栏目标签使用与《咏鹅》一致的内部锚点和棕色圆角样式。
    poem_label = BASE.draw_label(draw, 86, 250, "原文与注音")
    # 业务上分页起点按核定行边界配置，默认从第一行开始。
    line_start = int(content.get("lineStart", 0))
    # 业务上分页终点按核定行边界配置，默认包含当前作品全部正文。
    line_end = int(content.get("lineEnd", len(poem["lines"])))
    # 业务上分页范围必须非空且位于核定正文范围内，禁止拆分或遗漏 token。
    if line_start < 0 or line_end > len(poem["lines"]) or line_start >= line_end:
        raise ValueError(f"正文分页范围无效：{line_start}:{line_end}")
    # 业务上逐字注音只绘制当前页的完整核定行，不从标题或普通文本反推。
    # 业务上先按核定源行截取当前页，再对超长复句按原标点换行，分页边界仍对应 DOCX 原始位置。
    poem_boxes = draw_poem(draw, wrap_long_source_rows(annotated_rows(poem)[line_start:line_end]))
    # 业务上故事卡片采用左文右图布局，短文在 220px 文字列自然换行。
    story_label = BASE.draw_label(draw, 86, 752, "诗意故事")
    # 业务上故事正文来自待审 JSON，右侧一体化小景保持完整可见。
    # 业务上每篇可按一体化小景实际左边界收窄故事列，未指定时沿用样板 220px。
    story_width = int(content.get("storyWidth", 220))
    # 业务上故事正文使用当前篇实测后的文字列宽，保证与右侧插画至少相隔 20px。
    story_boxes = BASE.draw_body(draw, 92, 812, content["story"], story_width)
    # 业务上解读标签与故事标签横向对齐，形成稳定双栏节奏。
    interpretation_label = BASE.draw_label(draw, 560, 752, "诗句解读")
    # 业务上解读正文限制在左侧窄列，避免覆盖右侧太湖石与花鸟小景。
    # 业务上解读列宽允许按当前底图的小景边界配置，未指定时使用 190px。
    interpretation_width = int(content.get("interpretationWidth", 190))
    # 业务上解读正文使用实测列宽，避免文字虽在框内却与饭碗、太湖石等插画相撞。
    interpretation_boxes = BASE.draw_body(draw, 568, 812, content["interpretation"], interpretation_width, line_height=30)
    # 业务上核心标签与正文使用宽幅卡片的样板锚点。
    core_label = BASE.draw_label(draw, 145, 1035, "核心意境")
    # 业务上核心正文保持左侧 400px 文字区，与右侧画卷砚台至少留 20px。
    # 业务上核心文字列可按右侧一体化小景边界配置，默认沿用样板 400px。
    core_width = int(content.get("coreWidth", 400))
    # 业务上核心正文使用当前篇的安全列宽，避免画卷、船只或人物侵入文字。
    core_boxes = BASE.draw_body(draw, 150, 1085, content["coreIdeas"], core_width, line_height=28)
    # 业务上生活启示标签与核心标签使用相同左内边距。
    life_label = BASE.draw_label(draw, 145, 1206, "生活启示")
    # 业务上启示正文限制在 480px 内，右侧亭台鸟群小景不被文字遮挡。
    # 业务上启示文字列可按右侧主题小景的实际起点收窄，默认使用 480px。
    life_width = int(content.get("lifeWidth", 480))
    # 业务上启示正文使用当前篇配置宽度，确保图文视觉间隔达到规则要求。
    life_boxes = BASE.draw_body(draw, 150, 1258, content["lifeTips"], life_width)
    # 业务上页脚按样板中轴绘制在独立窄框内。
    BASE.draw_centered(draw, content["footer"], 1365, BASE.load_font(BASE.DISPLAY_FONT_PATH, 23), BASE.BROWN)
    # 业务上每个文字区域分别执行至少 16px 的框内安全距离检查。
    BASE.assert_inside([poem_label], (64, 227, 989, 709), 16, "原文标签")
    # 业务上原诗与拼音只允许位于主卡片左侧阅读安全区。
    BASE.assert_inside(poem_boxes, (80, 300, 535, 685), 16, "原文与拼音")
    # 业务上故事标签和正文作为同一区域检查，防止正文或标签单独压线。
    BASE.assert_inside([story_label, *story_boxes], (64, 731, 520, 989), 16, "诗意故事")
    # 业务上解读标签和正文必须同时通过右侧卡片安全区检查。
    BASE.assert_inside([interpretation_label, *interpretation_boxes], (534, 731, 989, 989), 16, "诗句解读")
    # 业务上核心文字不得侵入下边线或右侧一体化插画区。
    BASE.assert_inside([core_label, *core_boxes], (120, 1013, 933, 1159), 16, "核心意境")
    # 业务上启示文字不得侵入下边线或右侧山水小景。
    BASE.assert_inside([life_label, *life_boxes], (120, 1184, 933, 1315), 16, "生活启示")
    # 业务上输出目录只按需创建，不删除或覆盖其它篇目文件。
    args.output.parent.mkdir(parents=True, exist_ok=True)
    # 业务上已有成品默认受保护，重复生成必须由调用方改用版本化文件名。
    if args.output.exists():
        raise FileExistsError(f"输出已存在，请使用版本化文件名：{args.output}")
    # 业务上最终成品以高质量 RGB JPEG 保存，中文笔画和细边框保持清晰。
    canvas.convert("RGB").save(args.output, quality=95, subsampling=0)
    # 业务上重新解码确认尺寸和文件完整性，损坏输出不能进入验证清单。
    with Image.open(args.output) as verified:
        # 业务上标准成品必须严格为 1053×1493，任何漂移都视为失败。
        if verified.size != BASE.CANVAS_SIZE:
            raise ValueError(f"成品尺寸错误：{verified.size}")
    # 业务上返回正式输出路径，供验证截图和批量清单继续处理。
    return args.output


# 业务上直接运行时只处理命令行明确指定的一篇，批量调度器逐篇复用本入口。
if __name__ == "__main__":
    # 业务上打印最终路径，方便调用方把成功输出加入生成清单。
    print(render(parse_arguments()))
