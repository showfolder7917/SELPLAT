#!/usr/bin/env python3
"""成语典故绘本 PPT Python 生成能力。

读取现有课程、词典、人工分镜和插画清单，生成总目录及一至六年级可编辑
PPTX；页面结构、逐字拼音、透明信息卡和内部导航保持原生成器语义。
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import os
from pathlib import Path
import sys

XUNAN_CODE_ROOT = Path(__file__).resolve().parents[1]


def _load_pptx_tools():
    """按文件身份加载共享 PPT util，阻断同名顶层包覆盖。"""

    module_name = "selplat_xunan_pptx_tools"
    if module_name in sys.modules:
        return sys.modules[module_name]
    module_path = XUNAN_CODE_ROOT / "util/pptx_tools.py"
    specification = importlib.util.spec_from_file_location(module_name, module_path)
    if specification is None or specification.loader is None:
        raise RuntimeError(f"无法加载 PPTX 共享工具：{module_path}")
    module = importlib.util.module_from_spec(specification)
    sys.modules[module_name] = module
    specification.loader.exec_module(module)
    return module


_PPTX_TOOLS = _load_pptx_tools()
add_card = _PPTX_TOOLS.add_card
add_cover_image = _PPTX_TOOLS.add_cover_image
add_text = _PPTX_TOOLS.add_text
create_presentation = _PPTX_TOOLS.create_presentation
render_preview = _PPTX_TOOLS.render_preview
set_external_link = _PPTX_TOOLS.set_external_link
set_internal_link = _PPTX_TOOLS.set_internal_link


GRADE_THEMES = [
    ("#C95F46", "#6E3026", "#FFF1E8", "#2F7C76"),
    ("#D89A32", "#704B17", "#FFF7DD", "#397F74"),
    ("#4D8B72", "#214E42", "#EAF5ED", "#B35B45"),
    ("#547AA5", "#2B4664", "#EDF3FA", "#B55C46"),
    ("#9B6653", "#58362A", "#F8EFE9", "#377B72"),
    ("#655E91", "#39345B", "#F1EFF8", "#B16245"),
]
DIRECTORY_PAGE_SIZE = 12


def _load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_lessons(project_root: Path) -> list[dict[str, object]]:
    """按明确优先级合并课程基线、公开典故、一年级人工稿和插画路径。"""

    lessons = _load_json(project_root / "参考资料/成语课程内容.json")
    dictionary = {item["word"]: item for item in _load_json(project_root / "参考资料/公开成语故事词典.json")}
    visuals = {
        f"{item['grade']}:{item['idiom']}": item
        for item in _load_json(project_root / "重制版/全量插画生成清单.json")
    }
    grade_one = _load_json(project_root / "重制版/一年级/一年级内容与分镜.json")
    for lesson in lessons:
        idiom = str(lesson["idiom"])
        grade = int(lesson["grade"])
        dictionary_entry = dictionary.get(idiom) or {}
        manual = grade_one.get(idiom) if grade == 1 else None
        visual = visuals.get(f"{grade}:{idiom}") or {}
        story_values = dictionary_entry.get("story") or []
        lesson["meaning"] = dictionary_entry.get("explanation") or lesson.get("meaning") or ""
        lesson["story_type"] = "典故绘本" if story_values else "生活绘本"
        lesson["story"] = "\n\n".join(manual.get("story") or []) if manual else (story_values[0] if story_values else lesson.get("story") or "")
        if manual:
            lesson["example"] = manual.get("example") or lesson.get("example") or ""
            lesson["moral"] = manual.get("moral") or lesson.get("moral") or ""
        source = dictionary_entry.get("source") or {}
        lesson["story_note"] = (
            f"典故来源：{source.get('book') or dictionary_entry.get('derivation') or '公开成语词典'}"
            if story_values else "生活情境绘本：帮助理解词义，不作为历史出处。"
        )
        raw_image = visual.get("output")
        if not raw_image:
            raise ValueError(f"插画清单缺少：{grade}年级 {idiom}")
        image_path = Path(str(raw_image).replace(".png", ".jpg"))
        if not image_path.is_absolute():
            image_path = project_root / image_path
        if not image_path.is_file():
            png_path = image_path.with_suffix(".png")
            image_path = png_path if png_path.is_file() else image_path
        if not image_path.is_file():
            raise FileNotFoundError(f"插画不存在：{image_path}")
        lesson["image_path"] = image_path
    return lessons


def _blank_slide(presentation):
    return presentation.slides.add_slide(presentation.slide_layouts[6])


def _add_pinyin_title(slide, lesson: dict[str, object], box: tuple[int, int, int, int], color: str) -> None:
    """为每个汉字建立独立拼音和汉字文本框，保证教师后续可编辑。"""

    left, top, width, _ = box
    characters = list(str(lesson["idiom"]))
    syllables = str(lesson.get("final_pinyin") or "").split()
    cell_width = min(92, width / max(1, len(characters)))
    start = left + (width - cell_width * len(characters)) / 2
    for index, character in enumerate(characters):
        add_text(slide, syllables[index] if index < len(syllables) else "", (start + index * cell_width, top, cell_width, 28), font_size=17, color="#607278", font_name="Arial", align="center")
        add_text(slide, character, (start + index * cell_width, top + 26, cell_width, 66), font_size=46, color=color, bold=True, align="center")


def _format_story(value: object) -> str:
    text = str(value or "").strip()
    paragraphs = [item.strip() for item in re_split_paragraphs(text) if item.strip()]
    if len(paragraphs) < 2:
        sentences = [item for item in _sentence_split(text) if item]
        paragraphs = ["".join(sentences[index:index + 2]) for index in range(0, len(sentences), 2)]
    return "\n\n".join(f"　　{item}" for item in paragraphs)


def re_split_paragraphs(text: str) -> list[str]:
    return text.replace("\r\n", "\n").split("\n\n")


def _sentence_split(text: str) -> list[str]:
    import re
    return re.findall(r"[^。！？]+[。！？]?", text)


def _add_chrome(slide, theme: tuple[str, str, str, str], section: str, page: int) -> None:
    accent, _, _, jade = theme
    add_card(slide, (58, 34, 72, 8), fill=accent, transparency=0)
    add_text(slide, section, (144, 20, 520, 36), font_size=15, color="#64757B", bold=True)
    add_text(slide, str(page).zfill(2), (1178, 20, 54, 36), font_size=16, color="#718087", align="right")
    add_text(slide, "成语绘本课", (52, 670, 120, 28), font_size=13, color=jade, bold=True)


def _add_cover(presentation, grade: int, lessons: list[dict[str, object]]):
    slide = _blank_slide(presentation)
    theme = GRADE_THEMES[grade - 1]
    add_cover_image(slide, Path(lessons[0]["image_path"]), (0, 0, 1280, 720))
    add_card(slide, (720, 92, 480, 520), transparency=40, name="COVER_PANEL")
    add_text(slide, "国学成语绘本课", (776, 136, 290, 44), font_size=21, bold=True, color=theme[0])
    add_text(slide, f"{grade}年级\n成语故事", (772, 205, 354, 154), font_size=48, bold=True, color=theme[1])
    add_text(slide, f"本册 {len(lessons)} 条成语\n诵读 · 观图 · 故事 · 明理 · 运用 · 启智", (776, 382, 352, 82), font_size=18, color="#53676D")
    button = add_text(slide, "进入本册目录  →", (776, 500, 300, 64), font_size=22, bold=True, color="#FFFFFF", align="center", fill=theme[3], radius=True)
    add_text(slide, "新思度华文学堂｜小学成语分级学习", (790, 640, 390, 28), font_size=13, color="#7A8587", align="right")
    return slide, button


def _add_directories(presentation, grade: int, lessons: list[dict[str, object]]) -> list[tuple[object, list[tuple[object, int]]]]:
    directory_count = math.ceil(len(lessons) / DIRECTORY_PAGE_SIZE)
    result = []
    theme = GRADE_THEMES[grade - 1]
    for page_index in range(directory_count):
        slide = _blank_slide(presentation)
        _add_chrome(slide, theme, "本册目录", page_index + 2)
        add_text(slide, f"{grade}年级成语目录", (62, 80, 470, 64), font_size=36, bold=True, color=theme[1])
        add_text(slide, f"第 {page_index + 1} / {directory_count} 页｜点击成语即可进入", (62, 142, 420, 36), font_size=16, color="#687B80")
        targets: list[tuple[object, int]] = []
        for local_index, lesson in enumerate(lessons[page_index * DIRECTORY_PAGE_SIZE:(page_index + 1) * DIRECTORY_PAGE_SIZE]):
            column = local_index % 3
            row = local_index // 3
            absolute_index = page_index * DIRECTORY_PAGE_SIZE + local_index
            add_card(slide, (62 + column * 390, 198 + row * 106, 354, 88), transparency=10)
            add_text(slide, str(lesson.get("final_pinyin") or ""), (76 + column * 390, 205 + row * 106, 322, 26), font_size=13, color="#778589", font_name="Arial", align="center")
            button = add_text(slide, str(lesson["idiom"]), (76 + column * 390, 228 + row * 106, 322, 48), font_size=25, bold=True, color=theme[1], align="center")
            targets.append((button, absolute_index))
        result.append((slide, targets))
    return result


def _add_story_page(presentation, lesson: dict[str, object], grade: int, page: int):
    slide = _blank_slide(presentation)
    theme = GRADE_THEMES[grade - 1]
    add_cover_image(slide, Path(lesson["image_path"]), (0, 0, 1280, 720))
    _add_chrome(slide, theme, "诵读正音 · 观图入境 · 典故寻源", page)
    add_card(slide, (58, 64, 524, 586), transparency=40)
    add_text(slide, "诵读正音 · 观图入境", (94, 88, 250, 30), font_size=16, bold=True, color=theme[0])
    _add_pinyin_title(slide, lesson, (92, 126, 456, 96), theme[1])
    add_text(slide, str(lesson["story_type"]), (94, 234, 150, 32), font_size=15, bold=True, color="#FFFFFF", align="center", fill=theme[3], radius=True)
    add_text(slide, _format_story(lesson.get("story")), (92, 284, 456, 292), font_size=20, color="#29424D", vertical="top")
    add_text(slide, str(lesson.get("story_note") or ""), (94, 596, 452, 32), font_size=11, color="#718083")
    return slide


def _add_practice_page(presentation, lesson: dict[str, object], grade: int, page: int):
    slide = _blank_slide(presentation)
    theme = GRADE_THEMES[grade - 1]
    add_cover_image(slide, Path(lesson["image_path"]), (0, 0, 1280, 720))
    _add_chrome(slide, theme, "释义明理 · 学以致用 · 启智润心", page)
    add_card(slide, (58, 64, 524, 586), transparency=40)
    _add_pinyin_title(slide, lesson, (92, 82, 456, 96), theme[1])
    sections = [
        ("释义明理", f"　　{lesson.get('meaning') or ''}", 196, 228, 90, 19),
        ("学以致用", f"　　{lesson.get('example') or ''}", 326, 358, 86, 18),
        ("想一想", str(lesson.get("life_prompt") or ""), 452, 480, 56, 17),
        ("启智润心", f"　　{lesson.get('moral') or ''}", 526, 558, 72, 18),
    ]
    for title, body, title_top, body_top, body_height, font_size in sections:
        add_text(slide, title, (94, title_top, 148, 28), font_size=16, bold=True, color=theme[0])
        add_text(slide, body, (92, body_top, 456, body_height), font_size=font_size, color=theme[1] if title == "启智润心" else "#29424D", vertical="top", bold=title == "启智润心")
    return slide


def build_grade_deck(grade: int, lessons: list[dict[str, object]], output_dir: Path, preview_dir: Path) -> dict[str, object]:
    """生成一册 PPT，并在全部页面创建后绑定目录跳转。"""

    presentation = create_presentation()
    _, cover_button = _add_cover(presentation, grade, lessons)
    directories = _add_directories(presentation, grade, lessons)
    story_slides = []
    practice_slides = []
    directory_count = len(directories)
    for index, lesson in enumerate(lessons):
        story_slides.append(_add_story_page(presentation, lesson, grade, 2 + directory_count + index * 2))
        practice_slides.append(_add_practice_page(presentation, lesson, grade, 3 + directory_count + index * 2))
    set_internal_link(cover_button, directories[0][0])
    for _, targets in directories:
        for button, lesson_index in targets:
            set_internal_link(button, story_slides[lesson_index])
    filename = f"{grade:02d}_{grade}年级成语故事.pptx"
    output_path = output_dir / filename
    output_path.parent.mkdir(parents=True, exist_ok=True)
    presentation.save(output_path)
    render_preview(output_path, preview_dir / output_path.stem)
    return {"grade": grade, "lessons": len(lessons), "slides": len(presentation.slides), "filename": filename}


def build_master_deck(groups: dict[int, list[dict[str, object]]], output_dir: Path, preview_dir: Path) -> dict[str, object]:
    """生成跨文件总目录，年级按钮打开同目录相应课件。"""

    presentation = create_presentation()
    cover = _blank_slide(presentation)
    add_cover_image(cover, Path(groups[6][0]["image_path"]), (0, 0, 1280, 720))
    add_card(cover, (74, 92, 560, 520), transparency=40)
    add_text(cover, "小学一至六年级\n成语绘本学习", (124, 154, 460, 190), font_size=49, bold=True, color="#3E4C52")
    enter = add_text(cover, "打开学习地图  →", (126, 510, 320, 64), font_size=22, bold=True, color="#FFFFFF", align="center", fill="#377B72", radius=True)
    directory = _blank_slide(presentation)
    set_internal_link(enter, directory)
    add_text(directory, "选择年级，开始一段成语旅程", (62, 82, 760, 70), font_size=38, bold=True, color="#3C5057")
    for grade in range(1, 7):
        column = (grade - 1) % 3
        row = (grade - 1) // 3
        theme = GRADE_THEMES[grade - 1]
        add_card(directory, (62 + column * 390, 218 + row * 188, 354, 154), transparency=10)
        button = add_text(directory, f"{grade}年级", (90 + column * 390, 246 + row * 188, 298, 58), font_size=34, bold=True, color=theme[1], align="center")
        set_external_link(button, f"{grade:02d}_{grade}年级成语故事.pptx")
        add_text(directory, f"{len(groups[grade])} 条｜国学绘本课", (90 + column * 390, 314 + row * 188, 298, 34), font_size=16, color=theme[3], align="center")
    output_path = output_dir / "00_成语学习总目录.pptx"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    presentation.save(output_path)
    render_preview(output_path, preview_dir / output_path.stem)
    return {"slides": len(presentation.slides), "filename": output_path.name}


def generate(project_root: Path, product_dir: Path, preview_dir: Path, *, grade: int = 0, limit: int = 0) -> list[dict[str, object]]:
    """生成指定年级或全部七份 PPT，并输出稳定统计清单。"""

    lessons = load_lessons(project_root)
    groups = {current: [item for item in lessons if int(item["grade"]) == current] for current in range(1, 7)}
    if limit > 0:
        groups = {key: value[:limit] for key, value in groups.items()}
    results: list[dict[str, object]] = []
    if grade == 0:
        results.append(build_master_deck(groups, product_dir, preview_dir))
    for current in range(1, 7):
        if grade and current != grade:
            continue
        results.append(build_grade_deck(current, groups[current], product_dir, preview_dir))
    (product_dir / "生成统计.json").write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return results


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("project_root", type=Path)
    parser.add_argument("--product-dir", type=Path)
    parser.add_argument("--preview-dir", type=Path)
    parser.add_argument("--grade", type=int, choices=range(0, 7), default=int(os.environ.get("ONLY_GRADE", "0")))
    parser.add_argument("--limit", type=int, default=int(os.environ.get("IDIOM_LIMIT", "0")))
    arguments = parser.parse_args()
    product = arguments.product_dir or arguments.project_root / "成品"
    preview = arguments.preview_dir or arguments.project_root / "验证预览"
    results = generate(arguments.project_root, product, preview, grade=arguments.grade, limit=arguments.limit)
    print(json.dumps({"status": "completed", "results": results}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
