#!/usr/bin/env python3
"""Use the local Codex CLI to repair N2 OCR text without reopening the source PDF."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

PROJECT_ROOT = next(
    candidate for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
sys.pycache_prefix = str(PROJECT_ROOT / "cache/python-pycache")

from japanese_import_temp_path_guard import (  # noqa: E402
    JAPANESE_IMPORT_TEMP_ROOT,
    ensure_option_temp_path,
)


DEFAULT_DATASET = JAPANESE_IMPORT_TEMP_ROOT / "n2-red-blue-book-basic-001-730.json"
DEFAULT_REVIEW = JAPANESE_IMPORT_TEMP_ROOT / "ai-review-001-730.json"
DEFAULT_CODEX = Path("/Applications/ChatGPT.app/Contents/Resources/codex")
OPTION_FIELDS = ("optionA", "optionB", "optionC", "optionD")
REVIEW_FIELDS = ("questionText", *OPTION_FIELDS, "explanation")
PLACEHOLDER_PATTERN = re.compile(r"(?:\(\s*\)|（\s*）|\[\s*\]|［\s*］)")


def selected_option(record: dict[str, Any]) -> str:
    """Return the option text selected by the locked official answer letter."""
    answer = str(record.get("correctOption") or "").strip().upper()
    if answer not in {"A", "B", "C", "D"}:
        raise ValueError(
            f"question {record.get('sourceQuestionNo')}: invalid correctOption={answer}")
    return str(record.get(f"option{answer}") or "").strip()


def compose_audio_text(record: dict[str, Any]) -> str:
    """Fill one visible question placeholder with the locked correct option for natural TTS."""
    question_text = str(record.get("questionText") or "").strip()
    answer_text = selected_option(record)
    placeholder_count = len(PLACEHOLDER_PATTERN.findall(question_text))
    if placeholder_count:
        # “やら／やら”等成对语法按斜线拆开并依次填入两个空格，避免朗读残留第二个占位符。
        answer_parts = [part.strip() for part in re.split(r"[/／]", answer_text)]
        if placeholder_count > 1 and len(answer_parts) == placeholder_count:
            answer_values = iter(answer_parts)
            return PLACEHOLDER_PATTERN.sub(
                lambda _match: next(answer_values), question_text)
        return PLACEHOLDER_PATTERN.sub(answer_text, question_text, count=1)
    return question_text


def review_schema() -> dict[str, Any]:
    """Describe the exact per-batch JSON contract returned by Codex."""
    item_properties: dict[str, Any] = {
        "sourceQuestionNo": {"type": "integer"},
        **{field: {"type": "string", "minLength": 1} for field in REVIEW_FIELDS},
        "confidence": {"type": "string", "enum": ["HIGH", "MEDIUM", "LOW"]},
        "notes": {"type": "string"},
    }
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["records"],
        "properties": {
            "records": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": list(item_properties),
                    "properties": item_properties,
                },
            }
        },
    }


def compact_record(record: dict[str, Any]) -> dict[str, Any]:
    """Keep all question evidence while bounding noisy OCR explanation input."""
    value = {
        "sourceQuestionNo": int(record["sourceQuestionNo"]),
        "questionType": str(record["questionType"]),
        "questionText": str(record["questionText"]),
        **{field: str(record[field]) for field in OPTION_FIELDS},
        "correctOption": str(record["correctOption"]),
        "ocrExplanation": str(record.get("explanation") or "")[:2400],
    }
    return value


def build_prompt(records: list[dict[str, Any]]) -> str:
    """Build one self-contained Japanese teacher review prompt that forbids PDF access."""
    return (
        "你是严谨的 JLPT N2 日语教师和 OCR 数据审校员。审校下面每一道题，但不要读取 PDF、"
        "图片、工程文件或网络资料，只能使用输入中的题干、四个选项、锁定答案和 OCR 解释。\n"
        "必须逐题返回，不得遗漏、合并或改变 sourceQuestionNo。correctOption 是已经从官方答案栏取得的"
        "锁定答案字母，绝对禁止改变；应当修复该答案字母对应的选项文字，使题目语义正确。\n"
        "修复明显 OCR 错字、乱码、数字混入、漏字、多字和错误标点。填空题的 questionText 必须保留"
        "一个全角占位符（　）；非填空读音题保留完整自然句子。四个选项必须互不相同，且都要是"
        "合理的日语干扰项，不得把答案直接写入 questionText。\n"
        "explanation 必须重新写成简体中文学习解释：先给出代入正确选项后的完整日语句子，再说明"
        "正确答案、读音或语法含义，并简要说明其他选项。不要复制 OCR 乱码。\n"
        "confidence 表示仅凭现有文字恢复的把握；无法唯一恢复时用 LOW 并在 notes 说明，但仍提供"
        "最合理的完整版本。只返回符合输出结构的 JSON。\n\n"
        + json.dumps([compact_record(record) for record in records], ensure_ascii=False)
    )


def validate_review_batch(
        source_records: list[dict[str, Any]], reviewed_records: list[dict[str, Any]]) -> None:
    """Reject missing IDs, answer changes by omission, placeholders in options, and empty fields."""
    expected = [int(record["sourceQuestionNo"]) for record in source_records]
    actual = [int(record.get("sourceQuestionNo") or 0) for record in reviewed_records]
    if actual != expected:
        raise ValueError(f"review IDs mismatch; expected={expected}, actual={actual}")
    for record in reviewed_records:
        question_no = int(record["sourceQuestionNo"])
        for field in REVIEW_FIELDS:
            if not str(record.get(field) or "").strip():
                raise ValueError(f"question {question_no:03d}: empty reviewed {field}")
        for field in OPTION_FIELDS:
            if PLACEHOLDER_PATTERN.search(str(record[field])):
                raise ValueError(f"question {question_no:03d}: placeholder leaked into {field}")
        normalized_options = [str(record[field]).strip() for field in OPTION_FIELDS]
        if len(set(normalized_options)) != len(normalized_options):
            raise ValueError(
                f"question {question_no:03d}: reviewed options must be distinct")


def review_batch(
        batch_index: int,
        records: list[dict[str, Any]],
        codex_executable: Path,
        work_root: Path) -> list[dict[str, Any]]:
    """Run one isolated Codex process and parse its strict JSON response."""
    batch_dir = work_root / f"batch-{batch_index:03d}"
    batch_dir.mkdir(parents=True, exist_ok=True)
    schema_path = batch_dir / "review-schema.json"
    output_path = batch_dir / "review-result.json"
    schema_path.write_text(
        json.dumps(review_schema(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    command = [
        str(codex_executable), "exec", "--ephemeral", "--ignore-rules",
        "--skip-git-repo-check", "-C", str(batch_dir), "--sandbox", "read-only",
        "--output-schema", str(schema_path), "-o", str(output_path), "-",
    ]
    completed = subprocess.run(
        command,
        input=build_prompt(records),
        text=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        timeout=900,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(
            f"Codex batch {batch_index} failed with {completed.returncode}: "
            f"{completed.stderr[-2000:]}")
    payload = json.loads(output_path.read_text(encoding="utf-8"))
    reviewed_records = list(payload.get("records") or [])
    validate_review_batch(records, reviewed_records)
    return reviewed_records


def load_dataset(path: Path) -> dict[str, Any]:
    """Load one 001-730 dataset and reject any incomplete source-number range."""
    payload = json.loads(path.read_text(encoding="utf-8"))
    records = list(payload.get("records") or [])
    numbers = [int(record.get("sourceQuestionNo") or 0) for record in records]
    if numbers != list(range(1, 731)):
        raise ValueError("dataset must contain continuous sourceQuestionNo 001-730")
    return payload


def run_review(
        dataset: Path,
        output: Path,
        codex_executable: Path,
        batch_size: int,
        workers: int) -> dict[str, Any]:
    """Review all 730 records in bounded parallel batches and write a resumable proposal."""
    payload = load_dataset(dataset)
    records = list(payload["records"])
    work_root = output.parent / "ai-review-work"
    work_root.mkdir(parents=True, exist_ok=True)
    batches = [records[index:index + batch_size]
               for index in range(0, len(records), batch_size)]
    reviewed_by_index: dict[int, list[dict[str, Any]]] = {}
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(
                review_batch, index + 1, batch, codex_executable, work_root): index
            for index, batch in enumerate(batches)
        }
        for future in as_completed(futures):
            index = futures[future]
            reviewed_by_index[index] = future.result()
            print(json.dumps({
                "completedBatches": len(reviewed_by_index),
                "totalBatches": len(batches),
                "lastBatch": index + 1,
            }, ensure_ascii=False), flush=True)
    reviewed = [record for index in range(len(batches))
                for record in reviewed_by_index[index]]
    result = {
        "sourceBook": payload.get("sourceBook"),
        "range": payload.get("range"),
        "reviewMode": "codex_ai_without_pdf",
        "correctOptionPolicy": "locked_official_answer_letter",
        "recordCount": len(reviewed),
        "records": reviewed,
    }
    output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return result


def apply_review(dataset: Path, review: Path, output: Path) -> dict[str, Any]:
    """Merge reviewed text into the reproducible dataset and derive every audioText field."""
    payload = load_dataset(dataset)
    review_payload = json.loads(review.read_text(encoding="utf-8"))
    reviewed = {
        int(record["sourceQuestionNo"]): record
        for record in review_payload.get("records") or []
    }
    if sorted(reviewed) != list(range(1, 731)):
        raise ValueError("AI review must contain continuous sourceQuestionNo 001-730")
    ordered_review = [reviewed[question_no] for question_no in range(1, 731)]
    validate_review_batch(list(payload["records"]), ordered_review)
    confidence_counts = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for record in payload["records"]:
        question_no = int(record["sourceQuestionNo"])
        correction = reviewed[question_no]
        for field in REVIEW_FIELDS:
            record[field] = str(correction[field]).strip()
        record["audioText"] = compose_audio_text(record)
        if PLACEHOLDER_PATTERN.search(record["audioText"]):
            raise ValueError(
                f"question {question_no:03d}: placeholder remains in audioText")
        confidence_counts[str(correction["confidence"])] += 1
    payload["aiReviewMode"] = "codex_ai_without_pdf"
    payload["aiReviewConfidenceCounts"] = confidence_counts
    output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return payload


def parse_args() -> argparse.Namespace:
    """Parse explicit review or apply commands while keeping every file under OPTION/temp."""
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    review_parser = subparsers.add_parser("review")
    review_parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    review_parser.add_argument("--output", type=Path, default=DEFAULT_REVIEW)
    review_parser.add_argument("--codex", type=Path, default=DEFAULT_CODEX)
    review_parser.add_argument("--batch-size", type=int, default=20)
    review_parser.add_argument("--workers", type=int, default=3)
    apply_parser = subparsers.add_parser("apply")
    apply_parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    apply_parser.add_argument("--review", type=Path, default=DEFAULT_REVIEW)
    apply_parser.add_argument("--output", type=Path, default=DEFAULT_DATASET)
    return parser.parse_args()


def main() -> int:
    """Execute a no-PDF Codex review or merge a completed review into the import dataset."""
    args = parse_args()
    args.dataset = ensure_option_temp_path(args.dataset, "--dataset", must_exist=True)
    args.output = ensure_option_temp_path(args.output, "--output")
    if args.command == "review":
        if not args.codex.is_file():
            raise FileNotFoundError(f"Codex executable not found: {args.codex}")
        if args.batch_size < 1 or args.workers < 1:
            raise ValueError("--batch-size and --workers must be positive")
        result = run_review(
            args.dataset, args.output, args.codex, args.batch_size, args.workers)
        print(json.dumps({
            "recordCount": result["recordCount"],
            "output": str(args.output),
        }, ensure_ascii=False))
        return 0
    args.review = ensure_option_temp_path(args.review, "--review", must_exist=True)
    result = apply_review(args.dataset, args.review, args.output)
    print(json.dumps({
        "recordCount": len(result["records"]),
        "confidenceCounts": result["aiReviewConfidenceCounts"],
        "output": str(args.output),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
