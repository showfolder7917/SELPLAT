#!/usr/bin/env python3
"""Parse and import the basic questions (001-730) from the scanned N2 red-blue book."""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import urllib.parse
import urllib.request
import urllib.error
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# 直接执行导入能力时，将后续本地模块导入的字节码缓存移出正式源码树。
PROJECT_ROOT = next(
    candidate for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
sys.pycache_prefix = str(PROJECT_ROOT / "cache/python-pycache")

import numpy as np
from PIL import Image, ImageOps

from japanese_import_temp_path_guard import (
    JAPANESE_IMPORT_TEMP_ROOT,
    ensure_option_temp_path,
)


FIRST_QUESTION_PAGE = 8
LAST_QUESTION_PAGE = 246
FIRST_QUESTION_NO = 1
LAST_QUESTION_NO = 730
SOURCE_BOOK = "红蓝宝书1000题"
API_PATH = "/api/japanese/n2-blue-book-question/"
QUESTION_PLACEHOLDER_PATTERN = re.compile(
    r"(?:\(\s*\)|（\s*）|\[\s*\]|［\s*］)")
ANSWER_X_RATIOS = (0.363, 0.459, 0.570, 0.682, 0.806, 0.909)
ANSWER_X_RATIOS_SEVEN = (0.362, 0.446, 0.531, 0.632, 0.717, 0.828, 0.918)

# 这些字段由原扫描题页与官方详解页逐项人工复核，避免把 OCR 漏字写入题库。
VERIFIED_SOURCE_CORRECTIONS: dict[int, dict[str, str]] = {
    43: {"explanation": (
        "機械を使う作業なので、気をつけてください。\n"
        "因为使用机器作业，所以请注意安全。\n"
        "作：作業／工作、操作；作法／礼仪、礼节；作品／作品；作る／制作。\n"
        "業：企業／企业；事業／事业；職業／职业；業界／业界。")},
    59: {"optionD": "に至って"},
    76: {"optionD": "二方的"},
    77: {"optionD": "で"},
    99: {"optionD": "継続"},
    205: {"optionC": "かぜ"},
    275: {"optionA": "の限らず"},
    316: {"questionText": "最近、外で遊ぶ子どもが（　）減った。"},
    384: {"optionC": "うえ"},
    387: {"explanation": (
        "日々の努力が将来の成功につながる。\n"
        "平时的努力关系到将来的成功。\n"
        "繋がる（つながる）：连接；有关联。例：電話がつながる。\n"
        "進める（すすめる）：推进；使前进。例：計画を進める。\n"
        "強まる（つよまる）：增强；加强。例：危機感が強まる。\n"
        "助かる（たすかる）：得救；负担减轻。例：命が助かる。")},
    407: {"optionA": "持つことは", "optionB": "持っていることは"},
    412: {"explanation": (
        "内乱が治まり、住民の生活に平和が戻った。\n"
        "内乱平息，人们的生活恢复了和平。\n"
        "治まる（おさまる）：安定；平定；（疼痛等）止住。例：痛みが治まる。\n"
        "定まる（さだまる）：决定；安定。例：方針が定まる。\n"
        "纏まる（まとまる）：谈妥；凑齐；归纳。例：交渉がまとまる。\n"
        "止まる（とどまる）：停留；停止。例：足が止まる。")},
    423: {"optionB": "ジーパン"},
    460: {"optionA": "思い浮かべた"},
    464: {"optionB": "りこ"},
    551: {"optionD": "し"},
    613: {"optionC": "しょき"},
    682: {"optionB": "試験勉強が", "optionD": "試験勉強"},
    709: {"optionB": "し"},
}


@dataclass(frozen=True)
class OcrWord:
    """One word with its page coordinates from Tesseract TSV."""

    line_key: tuple[int, int, int]
    left: int
    top: int
    width: int
    height: int
    confidence: float
    text: str

    @property
    def right(self) -> int:
        return self.left + self.width


def read_tsv(path: Path) -> list[OcrWord]:
    """Read non-empty word rows from one Tesseract TSV file."""
    words: list[OcrWord] = []
    with path.open("r", encoding="utf-8", newline="") as stream:
        for row in csv.DictReader(stream, delimiter="\t"):
            text = str(row.get("text") or "").strip()
            if row.get("level") != "5" or not text:
                continue
            words.append(OcrWord(
                line_key=(int(row["block_num"]), int(row["par_num"]), int(row["line_num"])),
                left=int(row["left"]),
                top=int(row["top"]),
                width=int(row["width"]),
                height=int(row["height"]),
                confidence=float(row["conf"]),
                text=text,
            ))
    return words


def page_dimensions(words: list[OcrWord]) -> tuple[int, int]:
    """Estimate the OCR canvas dimensions from the full-page TSV coordinates."""
    width = max((word.right for word in words), default=1)
    height = max((word.top + word.height for word in words), default=1)
    return width, height


def group_lines(words: list[OcrWord]) -> list[list[OcrWord]]:
    """Group words by visual baseline because PSM 4 splits the two option columns."""
    lines: list[list[OcrWord]] = []
    for word in sorted(words, key=lambda item: (item.top, item.left)):
        matched: list[OcrWord] | None = None
        word_center = word.top + word.height / 2
        for line in reversed(lines[-4:]):
            line_center = sum(item.top + item.height / 2 for item in line) / len(line)
            tolerance = max(14.0, min(28.0, word.height * 0.55))
            if abs(word_center - line_center) <= tolerance:
                matched = line
                break
        if matched is None:
            lines.append([word])
        else:
            matched.append(word)
    return [sorted(line, key=lambda item: item.left) for line in lines]


def join_words(words: list[OcrWord]) -> str:
    """Join one visual segment and normalize OCR spacing without changing Japanese content."""
    text = "".join(word.text for word in sorted(words, key=lambda word: word.left))
    text = re.sub(r"\s+", "", text).strip()
    return text


def question_type(question_no: int) -> str:
    """Map each repeated six-question unit to reading, vocabulary/kanji, or grammar."""
    position = (question_no - 1) % 6
    if position < 2:
        return "PRONUNCIATION"
    if position < 4:
        return "KANJI"
    return "GRAMMAR"


def is_question_number(word: OcrWord, canvas_width: int, canvas_height: int) -> bool:
    """Identify the left-margin 001-730 question marker and reject printed page numbers."""
    if word.left > canvas_width * 0.22 or word.top > canvas_height * 0.94:
        return False
    if not re.fullmatch(r"\d{3}", word.text):
        return False
    value = int(word.text)
    return FIRST_QUESTION_NO <= value <= LAST_QUESTION_NO


def strip_option_label(words: list[OcrWord], anchor_limit: float) -> list[OcrWord]:
    """Drop the printed option number or one short OCR substitute at a known label anchor."""
    if not words:
        return []
    first = words[0]
    if first.left <= anchor_limit and (re.fullmatch(r"[1-4]", first.text) or len(first.text) <= 2):
        return words[1:]
    return words


def parse_question_block(
        block: list[OcrWord], question_no: int, canvas_width: int,
        fallback_blocks: list[list[OcrWord]] | None = None) -> dict[str, Any]:
    """Parse one base-section question using its stable two-column option geometry."""
    block = [word for word in block if word.right < canvas_width * 0.84]
    lines = group_lines(block)
    number_line_index = next(
        index for index, line in enumerate(lines)
        if any(word.text == f"{question_no:03d}" for word in line)
    )
    question_line = lines[number_line_index]
    number_word = next(word for word in question_line if word.text == f"{question_no:03d}")
    question_parts = [word for word in question_line if word.left > number_word.right]

    left_label_x = canvas_width * 0.18
    right_label_x = canvas_width * 0.50
    split_x = canvas_width * 0.46
    option_lines: list[list[OcrWord]] = []
    continuation_lines: list[list[OcrWord]] = []
    for line in lines[number_line_index + 1:]:
        left_words = [word for word in line if word.left < split_x]
        right_words = [word for word in line if word.left >= split_x]
        has_left_anchor = bool(left_words) and left_words[0].left < left_label_x
        has_right_anchor = bool(right_words) and right_words[0].left < right_label_x + canvas_width * 0.12
        if has_left_anchor and has_right_anchor and len(option_lines) < 2:
            option_lines.append(line)
        elif not option_lines:
            continuation_lines.append(line)

    fallback_options: list[str] | None = None
    if len(option_lines) != 2 and fallback_blocks:
        for fallback_block in fallback_blocks:
            try:
                fallback_record = parse_question_block(
                    fallback_block, question_no, canvas_width, fallback_blocks=None)
            except ValueError:
                continue
            fallback_options = [
                fallback_record["optionA"], fallback_record["optionB"],
                fallback_record["optionC"], fallback_record["optionD"],
            ]
            break
        if fallback_options is None:
            raise ValueError(
                f"question {question_no:03d}: all OCR modes missed complete option rows")
    elif len(option_lines) != 2:
        raise ValueError(f"question {question_no:03d}: expected two option rows, got {len(option_lines)}")
    for line in continuation_lines:
        question_parts.extend(line)

    option_values: list[str] = fallback_options or []
    if fallback_options is None:
        for line in option_lines:
            left_words = strip_option_label(
                [word for word in line if word.left < split_x],
                canvas_width * 0.20,
            )
            right_words = strip_option_label(
                [word for word in line if word.left >= split_x],
                canvas_width * 0.57,
            )
            option_values.extend([join_words(left_words), join_words(right_words)])

    return {
        "sourceQuestionNo": question_no,
        "questionType": question_type(question_no),
        "questionText": join_words(question_parts),
        "optionA": option_values[0],
        "optionB": option_values[1],
        "optionC": option_values[2],
        "optionD": option_values[3],
    }


def question_blocks(
        tsv_path: Path, expected_numbers: set[int] | None = None,
        ) -> tuple[int, list[tuple[OcrWord, list[OcrWord]]]]:
    """Return the page width and each numbered question's OCR word block."""
    words = read_tsv(tsv_path)
    canvas_width, canvas_height = page_dimensions(words)
    markers = sorted(
        [word for word in words
         if is_question_number(word, canvas_width, canvas_height)
         and (expected_numbers is None or int(word.text) in expected_numbers)],
        key=lambda word: word.top,
    )
    blocks: list[tuple[OcrWord, list[OcrWord]]] = []
    for index, marker in enumerate(markers):
        lower_top = markers[index + 1].top if index + 1 < len(markers) else canvas_height + 1
        block = [word for word in words if marker.top - 10 <= word.top < lower_top - 8]
        blocks.append((marker, block))
    return canvas_width, blocks


def parse_question_page(
        tsv_path: Path, fallback_tsv_paths: list[Path] | None = None,
        expected_numbers: set[int] | None = None) -> list[dict[str, Any]]:
    """Parse every question block from one even PDF page in the basic section."""
    canvas_width, blocks = question_blocks(tsv_path, expected_numbers)
    primary_map = {int(marker.text): block for marker, block in blocks}
    fallback_maps: list[dict[int, list[OcrWord]]] = []
    for fallback_tsv_path in fallback_tsv_paths or []:
        _, fallback_blocks = question_blocks(fallback_tsv_path, expected_numbers)
        fallback_maps.append(
            {int(marker.text): block for marker, block in fallback_blocks})
    questions: list[dict[str, Any]] = []
    question_numbers = (
        sorted(expected_numbers) if expected_numbers is not None
        else sorted(primary_map)
    )
    for question_no in question_numbers:
        available_blocks = [
            mapping[question_no] for mapping in [primary_map, *fallback_maps]
            if question_no in mapping
        ]
        if not available_blocks:
            raise ValueError(f"question {question_no:03d}: marker missing in all OCR modes")
        block = available_blocks[0]
        questions.append(parse_question_block(
            block, question_no, canvas_width,
            available_blocks[1:]))
    return questions


def normalize_glyph(image: Image.Image) -> np.ndarray:
    """Normalize one printed answer digit to a centered 24x36 binary bitmap."""
    gray = ImageOps.autocontrast(image.convert("L"), cutoff=1)
    binary = np.array(gray) < 190
    row_counts = binary.sum(axis=1)
    column_counts = binary.sum(axis=0)
    binary[row_counts > binary.shape[1] * 0.38, :] = False
    binary[:, column_counts > binary.shape[0] * 0.75] = False

    visited = np.zeros(binary.shape, dtype=bool)
    components: list[tuple[float, np.ndarray, np.ndarray]] = []
    height, width = binary.shape
    for start_y, start_x in zip(*np.where(binary & ~visited)):
        stack = [(int(start_y), int(start_x))]
        visited[start_y, start_x] = True
        ys: list[int] = []
        xs: list[int] = []
        while stack:
            y, x = stack.pop()
            ys.append(y)
            xs.append(x)
            for next_y, next_x in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if (0 <= next_y < height and 0 <= next_x < width
                        and binary[next_y, next_x] and not visited[next_y, next_x]):
                    visited[next_y, next_x] = True
                    stack.append((next_y, next_x))
        if len(xs) < 5:
            continue
        x_values = np.array(xs)
        y_values = np.array(ys)
        component_center_x = float(x_values.mean())
        component_center_y = float(y_values.mean())
        distance = abs(component_center_x - width / 2) + abs(component_center_y - height / 2)
        score = len(xs) - distance * 0.8
        components.append((score, y_values, x_values))
    if not components:
        return np.zeros((36, 24), dtype=np.float32)
    _, ys, xs = max(components, key=lambda item: item[0])
    crop = binary[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    glyph = Image.fromarray((~crop * 255).astype(np.uint8)).convert("L")
    glyph.thumbnail((20, 32), Image.Resampling.LANCZOS)
    canvas = Image.new("L", (24, 36), 255)
    canvas.paste(glyph, ((24 - glyph.width) // 2, (36 - glyph.height) // 2))
    return (np.array(canvas) < 190).astype(np.float32)


def build_answer_templates(ocr_dir: Path, pages_dir: Path) -> dict[str, np.ndarray]:
    """Build digit templates from high-confidence official answer cells across the book."""
    samples: dict[str, list[np.ndarray]] = {digit: [] for digit in "1234"}
    for page in range(FIRST_QUESTION_PAGE + 1, LAST_QUESTION_PAGE + 2, 2):
        words = read_tsv(ocr_dir / f"page-{page:03d}.tsv")
        image = Image.open(pages_dir / f"page-{page:03d}.jpg")
        for word in words:
            if word.text not in samples or word.confidence < 70:
                continue
            center_x = word.left + word.width / 2
            center_y = word.top + word.height / 2
            if not (image.width * 0.30 < center_x < image.width * 0.96
                    and image.height * 0.07 < center_y < image.height * 0.14):
                continue
            margin = max(8, word.height // 3)
            crop = image.crop((max(0, word.left - margin), max(0, word.top - margin),
                               min(image.width, word.right + margin),
                               min(image.height, word.top + word.height + margin)))
            samples[word.text].append(normalize_glyph(crop))
    missing = [digit for digit, values in samples.items() if not values]
    if missing:
        raise ValueError(f"answer digit templates missing: {missing}")
    return {digit: np.stack(values) for digit, values in samples.items()}


def answer_values(
        words: list[OcrWord], expected_count: int, page_path: Path,
        templates: dict[str, np.ndarray]) -> list[str]:
    """Read six official answer cells using OCR tokens plus image-template fallback."""
    image = Image.open(page_path)
    answer_x_ratios = (
        ANSWER_X_RATIOS_SEVEN if expected_count == 7 else ANSWER_X_RATIOS)
    if expected_count != len(answer_x_ratios):
        raise ValueError(f"unsupported official answer row size: {expected_count}")
    resolved: list[str | None] = [None] * expected_count
    for word in words:
        if word.text not in templates or word.confidence < 55:
            continue
        center_x = word.left + word.width / 2
        center_y = word.top + word.height / 2
        if not (image.height * 0.07 < center_y < image.height * 0.14):
            continue
        nearest = min(range(expected_count), key=lambda index: abs(
            center_x - image.width * answer_x_ratios[index]))
        if abs(center_x - image.width * answer_x_ratios[nearest]) < image.width * 0.045:
            resolved[nearest] = word.text

    for index in range(expected_count):
        if resolved[index] is not None:
            continue
        center_x = image.width * answer_x_ratios[index]
        crop = image.crop((center_x - image.width * 0.045, image.height * 0.070,
                           center_x + image.width * 0.045, image.height * 0.135))
        glyph = normalize_glyph(crop)
        resolved[index] = min(
            templates,
            key=lambda digit: float(np.min(np.mean(
                np.abs(templates[digit] - glyph), axis=(1, 2)))),
        )
    values = [str(value) for value in resolved]
    if len(values) != expected_count or any(value not in templates for value in values):
        raise ValueError(f"expected {expected_count} answers, got {values}")
    return values


def explanation_blocks(text: str) -> dict[int, str]:
    """Split official explanation OCR by its repeated three-digit question headings."""
    normalized = text.replace("\r\n", "\n")
    matches = list(re.finditer(r"(?m)^\s*(\d{3})\s+", normalized))
    blocks: dict[int, str] = {}
    for index, match in enumerate(matches):
        question_no = int(match.group(1))
        if not FIRST_QUESTION_NO <= question_no <= LAST_QUESTION_NO:
            continue
        end = matches[index + 1].start() if index + 1 < len(matches) else len(normalized)
        body = normalized[match.end():end].strip()
        body = re.sub(r"\n{3,}", "\n\n", body)
        blocks[question_no] = body
    return blocks


def parse_pair(
        ocr_dir: Path, pages_dir: Path, templates: dict[str, np.ndarray],
        question_page: int, expected_numbers: set[int],
        fallback_ocr_dirs: list[Path] | None = None,
        question_ocr_dir: Path | None = None) -> list[dict[str, Any]]:
    """Combine one question page with the immediately following official explanation page."""
    stem = f"page-{question_page:03d}"
    answer_stem = f"page-{question_page + 1:03d}"
    fallback_tsvs = [directory / f"{stem}.tsv" for directory in fallback_ocr_dirs or []]
    primary_question_dir = question_ocr_dir or ocr_dir
    questions = parse_question_page(
        primary_question_dir / f"{stem}.tsv", fallback_tsvs, expected_numbers)
    answer_words_on_page = read_tsv(ocr_dir / f"{answer_stem}.tsv")
    answers = answer_values(
        answer_words_on_page,
        len(questions),
        pages_dir / f"{answer_stem}.jpg",
        templates,
    )
    explanations = explanation_blocks(
        (ocr_dir / f"{answer_stem}.txt").read_text(encoding="utf-8"))
    for fallback_dir in fallback_ocr_dirs or []:
        fallback_text_path = fallback_dir / f"{answer_stem}.txt"
        if not fallback_text_path.exists():
            continue
        for question_no, body in explanation_blocks(
                fallback_text_path.read_text(encoding="utf-8")).items():
            if not explanations.get(question_no):
                explanations[question_no] = body
    for index, question in enumerate(questions):
        question_no = int(question["sourceQuestionNo"])
        question["correctOption"] = chr(ord("A") + int(answers[index]) - 1)
        question["explanation"] = explanations.get(question_no, "")
        question["sourcePdfQuestionPage"] = question_page
        question["sourcePdfExplanationPage"] = question_page + 1
    return questions


def parse_book(
        ocr_dir: Path, pages_dir: Path,
        fallback_ocr_dirs: list[Path] | None = None,
        question_ocr_dir: Path | None = None) -> list[dict[str, Any]]:
    """Parse only question numbers 001-730 and explicitly exclude all five mock tests."""
    records: list[dict[str, Any]] = []
    templates = build_answer_templates(ocr_dir, pages_dir)
    next_question_no = FIRST_QUESTION_NO
    for question_page in range(FIRST_QUESTION_PAGE, LAST_QUESTION_PAGE + 1, 2):
        page_question_count = 6 if question_page < 226 or question_page == 236 else 7
        expected_numbers = set(range(
            next_question_no,
            min(next_question_no + page_question_count, LAST_QUESTION_NO + 1),
        ))
        try:
            records.extend(parse_pair(
                ocr_dir, pages_dir, templates, question_page,
                expected_numbers, fallback_ocr_dirs, question_ocr_dir))
        except Exception as error:
            raise ValueError(f"PDF question page {question_page:03d}: {error}") from error
        next_question_no += page_question_count
    records.sort(key=lambda record: int(record["sourceQuestionNo"]))
    for record in records:
        record.update(VERIFIED_SOURCE_CORRECTIONS.get(
            int(record["sourceQuestionNo"]), {}))
        # 首次 OCR 数据先用题干占位，AI 审校合并时再替换为已填入正确答案的完整朗读句。
        record["audioText"] = str(record["questionText"])
    return records


def validate_records(records: list[dict[str, Any]]) -> list[str]:
    """Return every blocking data issue; an empty list means the import is structurally safe."""
    issues: list[str] = []
    numbers = [int(record.get("sourceQuestionNo") or 0) for record in records]
    expected = list(range(FIRST_QUESTION_NO, LAST_QUESTION_NO + 1))
    if numbers != expected:
        missing = sorted(set(expected) - set(numbers))
        duplicates = sorted(number for number in set(numbers) if numbers.count(number) > 1)
        issues.append(f"question number coverage mismatch; missing={missing}, duplicates={duplicates}")
    required_text = [
        "questionText", "optionA", "optionB", "optionC", "optionD", "explanation", "audioText"]
    for record in records:
        question_no = int(record.get("sourceQuestionNo") or 0)
        for field in required_text:
            value = str(record.get(field) or "").strip()
            if not value:
                issues.append(f"question {question_no:03d}: empty {field}")
        if record.get("correctOption") not in {"A", "B", "C", "D"}:
            issues.append(f"question {question_no:03d}: invalid correctOption={record.get('correctOption')}")
        if record.get("questionType") not in {"PRONUNCIATION", "KANJI", "GRAMMAR"}:
            issues.append(f"question {question_no:03d}: invalid questionType={record.get('questionType')}")
        option_values = [str(record.get(field) or "").strip()
                         for field in ["optionA", "optionB", "optionC", "optionD"]]
        if len(set(option_values)) != 4:
            issues.append(f"question {question_no:03d}: duplicate options")
        if QUESTION_PLACEHOLDER_PATTERN.search(str(record.get("audioText") or "")):
            issues.append(f"question {question_no:03d}: placeholder remains in audioText")
        if question_no > LAST_QUESTION_NO:
            issues.append(f"question {question_no:03d}: mock test item is forbidden")
    return issues


def write_dataset(records: list[dict[str, Any]], output: Path) -> None:
    """Write a stable, human-reviewable UTF-8 JSON dataset."""
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({
        "sourceBook": SOURCE_BOOK,
        "range": "001-730",
        "mockTestsIncluded": False,
        "recordCount": len(records),
        "records": records,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def api_json(url: str, data: dict[str, Any] | None = None) -> dict[str, Any]:
    """Call the local Japanese API using its existing form contract."""
    encoded = urllib.parse.urlencode(data).encode("utf-8") if data is not None else None
    request = urllib.request.Request(url, data=encoded)
    if encoded is not None:
        request.add_header("Content-Type", "application/x-www-form-urlencoded;charset=UTF-8")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"HTTP {error.code} from {url}: {body or error.reason}") from error
    if payload.get("success") is False:
        raise RuntimeError(str(payload.get("msg") or "API request failed"))
    return payload


def validate_ai_review_ready(payload: dict[str, Any]) -> None:
    """Block database writes until all 730 OCR records passed the no-PDF Codex review."""
    if payload.get("aiReviewMode") != "codex_ai_without_pdf":
        raise ValueError(
            "dataset must pass japanese_n2_ai_question_reviewer.py apply before import or sync")
    confidence_counts = dict(payload.get("aiReviewConfidenceCounts") or {})
    reviewed_count = sum(int(confidence_counts.get(level) or 0)
                         for level in ["HIGH", "MEDIUM", "LOW"])
    if reviewed_count != LAST_QUESTION_NO:
        raise ValueError(
            f"AI review coverage must be 730 records, actual={reviewed_count}")


def import_records(dataset: Path, base_url: str) -> tuple[int, int]:
    """Import validated records through BaseController and skip exact existing source numbers."""
    payload = json.loads(dataset.read_text(encoding="utf-8"))
    validate_ai_review_ready(payload)
    records = list(payload.get("records") or [])
    issues = validate_records(records)
    if issues:
        raise ValueError("dataset validation failed:\n" + "\n".join(issues[:100]))
    root = base_url.rstrip("/") + API_PATH
    existing_payload = api_json(root + "getStore.htm?pageNo=1&pageSize=1000")
    existing = {
        (str(item.get("sourceBook") or ""), int(item.get("sourceQuestionNo") or 0))
        for item in existing_payload.get("records") or []
    }
    created = 0
    skipped = 0
    for record in records:
        question_no = int(record["sourceQuestionNo"])
        key = (SOURCE_BOOK, question_no)
        if key in existing:
            skipped += 1
            continue
        api_json(root + "create.htm", {
            "tenantId": 1,
            "lastOperateUserId": 1,
            "name": f"红蓝宝书 N2 第{question_no:03d}题",
            "jlptLevel": "N2",
            "sourceBook": SOURCE_BOOK,
            "sourceQuestionNo": question_no,
            "questionType": record["questionType"],
            "questionText": record["questionText"],
            "optionA": record["optionA"],
            "optionB": record["optionB"],
            "optionC": record["optionC"],
            "optionD": record["optionD"],
            "correctOption": record["correctOption"],
            "explanation": record["explanation"],
            "audioText": record["audioText"],
            "sortnum": question_no,
            "status": 1,
        })
        created += 1
    return created, skipped


def sync_records(dataset: Path, base_url: str) -> tuple[int, int]:
    """Create missing records and update existing records through the Japanese application API."""
    payload = json.loads(dataset.read_text(encoding="utf-8"))
    validate_ai_review_ready(payload)
    records = list(payload.get("records") or [])
    issues = validate_records(records)
    if issues:
        raise ValueError("dataset validation failed:\n" + "\n".join(issues[:100]))
    root = base_url.rstrip("/") + API_PATH
    existing_payload = api_json(root + "getStore.htm?pageNo=1&pageSize=1000")
    existing = {
        (str(item.get("sourceBook") or ""), int(item.get("sourceQuestionNo") or 0)): item
        for item in existing_payload.get("records") or []
    }
    created = 0
    updated = 0
    for record in records:
        question_no = int(record["sourceQuestionNo"])
        key = (SOURCE_BOOK, question_no)
        save_data = {
            "tenantId": 1,
            "lastOperateUserId": 1,
            "name": f"红蓝宝书 N2 第{question_no:03d}题",
            "jlptLevel": "N2",
            "sourceBook": SOURCE_BOOK,
            "sourceQuestionNo": question_no,
            "questionType": record["questionType"],
            "questionText": record["questionText"],
            "optionA": record["optionA"],
            "optionB": record["optionB"],
            "optionC": record["optionC"],
            "optionD": record["optionD"],
            "correctOption": record["correctOption"],
            "explanation": record["explanation"],
            "audioText": record["audioText"],
            "sortnum": question_no,
            "status": 1,
        }
        existing_record = existing.get(key)
        if existing_record is None:
            api_json(root + "create.htm", save_data)
            created += 1
            continue
        save_data["id"] = int(existing_record["id"])
        api_json(root + "update.htm", save_data)
        updated += 1
    return created, updated


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    parse_parser = subparsers.add_parser("parse")
    parse_parser.add_argument(
        "--ocr-dir", type=Path,
        default=JAPANESE_IMPORT_TEMP_ROOT / "text")
    parse_parser.add_argument(
        "--pages-dir", type=Path,
        default=JAPANESE_IMPORT_TEMP_ROOT / "pages")
    parse_parser.add_argument("--fallback-ocr-dir", type=Path, action="append", default=[])
    parse_parser.add_argument(
        "--question-ocr-dir", type=Path,
        default=JAPANESE_IMPORT_TEMP_ROOT / "text-jpn-psm4")
    parse_parser.add_argument(
        "--output", type=Path,
        default=JAPANESE_IMPORT_TEMP_ROOT / "n2-red-blue-book-basic-001-730.json")
    validate_parser = subparsers.add_parser("validate")
    validate_parser.add_argument(
        "--dataset", type=Path,
        default=JAPANESE_IMPORT_TEMP_ROOT / "n2-red-blue-book-basic-001-730.json")
    import_parser = subparsers.add_parser("import")
    import_parser.add_argument(
        "--dataset", type=Path,
        default=JAPANESE_IMPORT_TEMP_ROOT / "n2-red-blue-book-basic-001-730.json")
    import_parser.add_argument("--base-url", default="http://127.0.0.1:8080")
    sync_parser = subparsers.add_parser("sync")
    sync_parser.add_argument(
        "--dataset", type=Path,
        default=JAPANESE_IMPORT_TEMP_ROOT / "n2-red-blue-book-basic-001-730.json")
    sync_parser.add_argument("--base-url", default="http://127.0.0.1:8080")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.command == "parse":
        args.ocr_dir = ensure_option_temp_path(
            args.ocr_dir, "--ocr-dir", must_exist=True)
        args.pages_dir = ensure_option_temp_path(
            args.pages_dir, "--pages-dir", must_exist=True)
        args.question_ocr_dir = ensure_option_temp_path(
            args.question_ocr_dir, "--question-ocr-dir", must_exist=True)
        fallback_ocr_dirs = args.fallback_ocr_dir or [
            JAPANESE_IMPORT_TEMP_ROOT / "text-jpn-psm6",
            JAPANESE_IMPORT_TEMP_ROOT / "text",
            JAPANESE_IMPORT_TEMP_ROOT / "text-psm6",
            JAPANESE_IMPORT_TEMP_ROOT / "text-psm11",
        ]
        args.fallback_ocr_dir = [
            ensure_option_temp_path(path, "--fallback-ocr-dir", must_exist=True)
            for path in fallback_ocr_dirs
        ]
        args.output = ensure_option_temp_path(args.output, "--output")
        records = parse_book(
            args.ocr_dir, args.pages_dir, args.fallback_ocr_dir,
            args.question_ocr_dir)
        issues = validate_records(records)
        write_dataset(records, args.output)
        print(json.dumps({"recordCount": len(records), "issueCount": len(issues),
                          "issues": issues[:100]}, ensure_ascii=False, indent=2))
        return 0 if not issues else 2
    if args.command == "validate":
        args.dataset = ensure_option_temp_path(
            args.dataset, "--dataset", must_exist=True)
        payload = json.loads(args.dataset.read_text(encoding="utf-8"))
        issues = validate_records(list(payload.get("records") or []))
        print(json.dumps({"issueCount": len(issues), "issues": issues[:100]},
                         ensure_ascii=False, indent=2))
        return 0 if not issues else 2
    args.dataset = ensure_option_temp_path(args.dataset, "--dataset", must_exist=True)
    if args.command == "sync":
        created, updated = sync_records(args.dataset, args.base_url)
        print(json.dumps({"created": created, "updated": updated}, ensure_ascii=False))
        return 0
    created, skipped = import_records(args.dataset, args.base_url)
    print(json.dumps({"created": created, "skipped": skipped}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
