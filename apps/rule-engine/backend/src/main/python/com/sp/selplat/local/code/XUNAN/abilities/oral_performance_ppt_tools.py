#!/usr/bin/env python3
"""少儿口才与表演 PPT 分析、生成、音频嵌入和质量检测能力。

中册、下册共用同一 Python 实现；册别只通过课程索引、视觉计划和输出参数
表达差异，避免继续维护两套生成核心和两套检测核心。
"""

from __future__ import annotations

import argparse
import hashlib
import html
import importlib.util
import json
from pathlib import Path
import re
import sys
from typing import Any
from zipfile import ZIP_DEFLATED, ZipFile

XUNAN_CODE_ROOT = Path(__file__).resolve().parents[1]


def _load_pptx_tools():
    """按唯一文件路径加载共享 util，避免外部同名 util 包污染导入。"""

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


EMU_PER_PIXEL = 9525
CANVAS = (1280 * EMU_PER_PIXEL, 720 * EMU_PER_PIXEL)
AUDIO_ROLES = {"情境再现", "口脑风暴", "粉墨登场"}
TEXT_PATTERN = re.compile(r"<a:t>([\s\S]*?)</a:t>")
SLIDE_ENTRY_PATTERN = re.compile(r"ppt/slides/slide(\d+)\.xml$")


def read_pptx_entries(pptx_path: Path) -> dict[str, bytes]:
    """完整读取 PPTX 包，后续修改以新包写出，不在源压缩包上原地写。"""

    with ZipFile(pptx_path) as archive:
        return {name: archive.read(name) for name in archive.namelist()}


def slide_entries(entries: dict[str, bytes]) -> list[tuple[int, str, str]]:
    """返回按页码排序的页面 XML。"""

    result: list[tuple[int, str, str]] = []
    for name, payload in entries.items():
        match = SLIDE_ENTRY_PATTERN.fullmatch(name)
        if match:
            result.append((int(match.group(1)), name, payload.decode("utf-8")))
    return sorted(result)


def extract_text(xml: str) -> str:
    """按页面出现顺序提取可见文本并解码 XML 实体。"""

    return "\n".join(html.unescape(match) for match in TEXT_PATTERN.findall(xml) if match)


def infer_role(slide_number: int, text: str) -> str:
    """根据稳定栏目词识别教学角色，未知页面保持“普通内容”。"""

    normalized = text.replace("\n", "")
    for role in ("口才之歌", "字正腔圆", "情境再现", "口脑风暴", "粉墨登场", "拓展训练", "句子宝库"):
        if role in normalized:
            return role
    return "封面" if slide_number == 1 else "普通内容"


def analyze_pptx(pptx_path: Path) -> dict[str, object]:
    """生成源 PPTX 页面文字、角色和媒体数量清单。"""

    entries = read_pptx_entries(pptx_path)
    slides = []
    for number, _, xml in slide_entries(entries):
        text = extract_text(xml)
        slides.append({"source_slide": number, "role": infer_role(number, text), "text": text})
    media = sorted(name for name in entries if name.startswith("ppt/media/"))
    return {"source": str(pptx_path), "slide_count": len(slides), "slides": slides, "media": media}


def analyze_directory(source_root: Path, output_json: Path) -> dict[str, object]:
    """递归分析全部 PPTX，并把结果写入一个稳定 JSON。"""

    decks = [analyze_pptx(path) for path in sorted(source_root.rglob("*.pptx"))]
    output_json.parent.mkdir(parents=True, exist_ok=True)
    output_json.write_text(json.dumps(decks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"decks": len(decks), "output": str(output_json)}


def choose_body_font(role: str, text: str) -> int:
    """按文字密度选择课堂可读字号，不低于 22pt。"""

    length = len(re.sub(r"\s+", "", text))
    if length <= 36:
        return 30
    if length <= 90:
        return 26
    return 22


def split_readable_text(text: str, maximum_characters: int = 110) -> list[str]:
    """按句义拆分长文，避免缩成不可读小字。"""

    clean = re.sub(r"^[，,、；;：:。！？!?]+", "", str(text or "").strip())
    sentences = re.findall(r"[^。！？]+[。！？]?", clean) or [clean]
    pages: list[str] = []
    current = ""
    for sentence in sentences:
        if current and len(current) + len(sentence) > maximum_characters:
            pages.append(current)
            current = sentence
        else:
            current += sentence
    if current:
        pages.append(current)
    return pages or [""]


def _resolve_asset(asset_root: Path, value: object) -> Path | None:
    if not value:
        return None
    path = Path(str(value))
    target = path if path.is_absolute() else asset_root / path
    return target if target.is_file() else None


def _add_course_chrome(slide, section: str, page: int, accent: str = "#D26C58") -> None:
    add_text(slide, "新思度华文学堂", (54, 30, 230, 36), font_size=15, bold=True, color="#475B62")
    add_text(slide, section, (910, 28, 270, 36), font_size=15, bold=True, color=accent, align="right", name="SECTION_NAME")
    add_text(slide, str(page).zfill(2), (1190, 28, 44, 34), font_size=14, color="#718087", align="right")


def _build_lesson_deck(lesson: dict[str, Any], asset_root: Path):
    presentation = create_presentation()
    title = str(lesson.get("title") or f"第{lesson.get('lesson', '')}课")
    source_slides = lesson.get("source_slides") or lesson.get("slides") or []
    cover_asset = _resolve_asset(asset_root, lesson.get("cover") or lesson.get("cover_asset"))
    cover = presentation.slides.add_slide(presentation.slide_layouts[6])
    if cover_asset:
        add_cover_image(cover, cover_asset, (0, 0, 1280, 720))
    add_card(cover, (88, 110, 560, 480), transparency=30, name="TEXT_CARD")
    add_text(cover, title, (138, 190, 460, 150), font_size=48, bold=True, color="#4D3D38", name="CONTENT_TITLE")
    add_text(cover, "少儿口才与表演", (142, 360, 410, 64), font_size=26, color="#C45E4B")
    page_number = 2
    for source in source_slides:
        role = str(source.get("role") or "普通内容")
        raw_text = str(source.get("text") or source.get("body") or "").strip()
        title_text = str(source.get("title") or role)
        asset = _resolve_asset(asset_root, source.get("asset") or source.get("image"))
        safe_side = str(source.get("safeSide") or source.get("safe_side") or "left")
        for continuation, body in enumerate(split_readable_text(raw_text)):
            slide = presentation.slides.add_slide(presentation.slide_layouts[6])
            if asset:
                add_cover_image(slide, asset, (0, 0, 1280, 720))
            _add_course_chrome(slide, role, page_number)
            panel_left = 74 if safe_side == "left" else 730
            add_card(slide, (panel_left, 142, 476, 476), transparency=28, name="TEXT_CARD")
            actual_title = title_text if continuation == 0 else f"{title_text}（续）"
            add_text(slide, actual_title, (panel_left + 30, 174, 416, 70), font_size=30, bold=True, color="#4C3B38", name="CONTENT_TITLE")
            add_text(slide, body, (panel_left + 32, 258, 412, 310), font_size=choose_body_font(role, body), color="#273E47", vertical="top", name="CONTENT_BODY")
            if role in AUDIO_ROLES:
                add_text(slide, "▶ 播放示例", (panel_left + 32, 570, 150, 42), font_size=16, bold=True, color="#FFFFFF", fill="#3E716C", radius=True, name="AUDIO_BUTTON")
            page_number += 1
    return presentation


def generate_courses(
    coverage_json: Path,
    asset_root: Path,
    output_root: Path,
    preview_root: Path,
    *,
    lesson_number: int = 0,
) -> dict[str, object]:
    """按课程覆盖清单生成单课或整册 PPTX。"""

    payload = json.loads(coverage_json.read_text(encoding="utf-8"))
    lessons = payload if isinstance(payload, list) else payload.get("lessons") or payload.get("items") or []
    if lesson_number:
        lessons = [item for item in lessons if int(item.get("lesson") or 0) == lesson_number]
    results = []
    for lesson in lessons:
        presentation = _build_lesson_deck(lesson, asset_root)
        number = int(lesson.get("lesson") or len(results) + 1)
        title = re.sub(r"[\\/:*?\"<>|]", "_", str(lesson.get("title") or "课程"))
        filename = f"少儿口才与表演第{number:02d}课_{title}_Python重制版.pptx"
        output = output_root / f"第{number}课/PPT排版/批量稿/{filename}"
        output.parent.mkdir(parents=True, exist_ok=True)
        presentation.save(output)
        render_preview(output, preview_root / f"第{number:02d}课")
        results.append({"lesson": number, "slides": len(presentation.slides), "output": str(output)})
    return {"lessons": len(results), "results": results}


def _next_shape_id(xml: str) -> int:
    ids = [int(value) for value in re.findall(r'<p:cNvPr[^>]*\sid="(\d+)"', xml)]
    return max(ids or [1]) + 1


def _audio_picture(shape_id: int, bounds: tuple[int, int, int, int], relationship_prefix: str) -> str:
    x, y, width, height = bounds
    return (
        f'<p:pic><p:nvPicPr><p:cNvPr id="{shape_id}" name="播放">'
        '<a:hlinkClick xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="" action="ppaction://media"/>'
        '</p:cNvPr><p:cNvPicPr><a:picLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>'
        '</p:cNvPicPr><p:nvPr><a:audioFile xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        f'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:link="rId{relationship_prefix}Audio"/>'
        '<p:extLst><p:ext uri="{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}"><p14:media '
        'xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" '
        f'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId{relationship_prefix}Media"/>'
        '</p:ext></p:extLst></p:nvPr><p:blipFill><a:blip xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        f'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId{relationship_prefix}Icon"/>'
        '<a:stretch xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:fillRect/></a:stretch></p:blipFill>'
        f'<p:spPr><a:xfrm xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:off x="{x}" y="{y}"/>'
        f'<a:ext cx="{width}" cy="{height}"/></a:xfrm><a:prstGeom xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>'
    )


def embed_audio(
    source_pptx: Path,
    target_pptx: Path,
    mappings: list[dict[str, object]],
    button_image: Path,
) -> dict[str, object]:
    """按明确页码、音频和按钮区域嵌入 PowerPoint 原生媒体对象。"""

    entries = read_pptx_entries(source_pptx)
    icon_name = "ppt/media/selplat-audio-button.png"
    entries[icon_name] = button_image.read_bytes()
    for index, mapping in enumerate(mappings, 1):
        slide_number = int(mapping["slide"])
        audio_path = Path(str(mapping["audio"]))
        if not audio_path.is_file():
            raise FileNotFoundError(f"音频不存在：{audio_path}")
        media_name = f"selplat-audio-{slide_number}-{index}{audio_path.suffix.lower()}"
        entries[f"ppt/media/{media_name}"] = audio_path.read_bytes()
        slide_name = f"ppt/slides/slide{slide_number}.xml"
        rels_name = f"ppt/slides/_rels/slide{slide_number}.xml.rels"
        xml = entries[slide_name].decode("utf-8")
        rels = entries[rels_name].decode("utf-8")
        prefix = f"Selplat{index}"
        raw_bounds = mapping.get("bounds") or [92, 622, 112, 45]
        bounds = tuple(int(float(value) * EMU_PER_PIXEL) for value in raw_bounds)
        xml = xml.replace("</p:spTree>", _audio_picture(_next_shape_id(xml), bounds, prefix) + "</p:spTree>")
        relationships = (
            f'<Relationship Id="rId{prefix}Audio" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/audio" Target="../media/{media_name}"/>'
            f'<Relationship Id="rId{prefix}Media" Type="http://schemas.microsoft.com/office/2007/relationships/media" Target="../media/{media_name}"/>'
            f'<Relationship Id="rId{prefix}Icon" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/selplat-audio-button.png"/>'
        )
        entries[slide_name] = xml.encode("utf-8")
        entries[rels_name] = rels.replace("</Relationships>", relationships + "</Relationships>").encode("utf-8")
    content_types = entries["[Content_Types].xml"].decode("utf-8")
    for extension, content_type in (("mp3", "audio/mpeg"), ("wav", "audio/wav"), ("m4a", "audio/mp4")):
        if any(str(mapping["audio"]).lower().endswith(f".{extension}") for mapping in mappings) and f'Extension="{extension}"' not in content_types:
            content_types = content_types.replace("</Types>", f'<Default Extension="{extension}" ContentType="{content_type}"/></Types>')
    entries["[Content_Types].xml"] = content_types.encode("utf-8")
    target_pptx.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(target_pptx, "w", ZIP_DEFLATED) as archive:
        for name, payload in entries.items():
            archive.writestr(name, payload)
    return {"slides": [int(item["slide"]) for item in mappings], "media_count": len(mappings), "output": str(target_pptx)}


def _shape_bounds(xml: str) -> list[tuple[str, int, int, int, int]]:
    """解析形状名称和 EMU 边界，供越界与重叠检查。"""

    result = []
    for block in re.findall(r"<(?:p:sp|p:pic)>[\s\S]*?</(?:p:sp|p:pic)>", xml):
        name = re.search(r'<p:cNvPr[^>]*name="([^"]*)"', block)
        transform = re.search(r'<a:off x="(-?\d+)" y="(-?\d+)"\s*/>\s*<a:ext cx="(\d+)" cy="(\d+)"', block)
        if name and transform:
            result.append((name.group(1), *(int(transform.group(index)) for index in range(1, 5))))
    return result


def inspect_pptx(pptx_path: Path, *, expected_slides: int = 0) -> dict[str, object]:
    """检查包结构、页数、文本越界、重复媒体和空白页面。"""

    entries = read_pptx_entries(pptx_path)
    slides = slide_entries(entries)
    errors: list[str] = []
    if expected_slides and len(slides) != expected_slides:
        errors.append(f"页数不一致：期望 {expected_slides}，实际 {len(slides)}")
    for number, _, xml in slides:
        text = extract_text(xml).strip()
        pictures = xml.count("<p:pic>")
        if not text and pictures == 0:
            errors.append(f"第 {number} 页没有文字或图片。")
        for name, x, y, width, height in _shape_bounds(xml):
            if x < 0 or y < 0 or x + width > CANVAS[0] or y + height > CANVAS[1]:
                errors.append(f"第 {number} 页对象 {name} 越出画布。")
    image_hashes: dict[str, list[str]] = {}
    for name, payload in entries.items():
        if name.startswith("ppt/media/") and Path(name).suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
            digest = hashlib.sha256(payload).hexdigest()
            image_hashes.setdefault(digest, []).append(name)
    duplicates = [names for names in image_hashes.values() if len(names) > 1]
    return {
        "status": "passed" if not errors else "failed",
        "slide_count": len(slides),
        "errors": errors,
        "duplicate_image_groups": duplicates,
    }


def main() -> int:
    """统一提供 analyze、generate、embed-audio 和 inspect 子命令。"""

    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="action", required=True)
    analyze = subparsers.add_parser("analyze")
    analyze.add_argument("source", type=Path)
    analyze.add_argument("output", type=Path)
    generate = subparsers.add_parser("generate")
    generate.add_argument("coverage", type=Path)
    generate.add_argument("asset_root", type=Path)
    generate.add_argument("output_root", type=Path)
    generate.add_argument("preview_root", type=Path)
    generate.add_argument("--lesson", type=int, default=0)
    embed = subparsers.add_parser("embed-audio")
    embed.add_argument("source", type=Path)
    embed.add_argument("target", type=Path)
    embed.add_argument("mapping_json", type=Path)
    embed.add_argument("button_image", type=Path)
    inspect = subparsers.add_parser("inspect")
    inspect.add_argument("source", type=Path)
    inspect.add_argument("--expected-slides", type=int, default=0)
    arguments = parser.parse_args()
    if arguments.action == "analyze":
        result = analyze_directory(arguments.source, arguments.output) if arguments.source.is_dir() else analyze_pptx(arguments.source)
        if arguments.source.is_file():
            arguments.output.parent.mkdir(parents=True, exist_ok=True)
            arguments.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    elif arguments.action == "generate":
        result = generate_courses(arguments.coverage, arguments.asset_root, arguments.output_root, arguments.preview_root, lesson_number=arguments.lesson)
    elif arguments.action == "embed-audio":
        mappings = json.loads(arguments.mapping_json.read_text(encoding="utf-8"))
        result = embed_audio(arguments.source, arguments.target, mappings, arguments.button_image)
    else:
        result = inspect_pptx(arguments.source, expected_slides=arguments.expected_slides)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result.get("status") not in {"failed", "blocked"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
