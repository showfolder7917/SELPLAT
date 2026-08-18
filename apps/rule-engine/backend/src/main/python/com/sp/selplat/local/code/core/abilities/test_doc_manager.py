"""测试文档维护能力。

功能：
按当前任务线程维护待统一测试清单，让修改任务只记录验证责任，用户决定何时集中执行。

作用：
把测试项登记、结果回写、就绪检查和历史归档收敛为稳定 Python 入口。
"""

from __future__ import annotations

from datetime import datetime
import hashlib
import os
from pathlib import Path
import re
import time
from typing import Any


ABILITY_ID = "test_doc_manager"
ABILITY_NAME = "测试文档维护能力"
ABILITY_DESC = "维护同线程测试文档：记录待测项、回写手动统一测试结果并归档。"

REQUIRED_SKILLS: list[str] = []
REQUIRED_APPS: list[str] = []

# 从能力源码向上识别当前工程，测试记录只能写入工程自己的 OPTION。
WORKSPACE_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
OPTION_ROOT = WORKSPACE_ROOT / "OPTION"
HISTORY_ROOT = OPTION_ROOT / "temp"
THREAD_ID_ENV_KEY = "CODEX_THREAD_ID"
SAFE_THREAD_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
FALLBACK_THREAD_ID = "local"

STATUS_PENDING = "待测试"
STATUS_PASSED = "通过"
STATUS_FAILED = "失败"
ALLOWED_RESULT_STATUS = {STATUS_PASSED, STATUS_FAILED}


def _now() -> datetime:
    return datetime.now().astimezone()


def _normalize_text(value: Any) -> str:
    return str(value or "").strip()


def _resolve_thread_id(context: dict[str, Any]) -> str:
    # 显式上下文优先，缺省读取当前 Codex 页面；非法值统一退回 local，禁止进入路径。
    candidate = _normalize_text(context.get("thread_id") or os.environ.get(THREAD_ID_ENV_KEY))
    if candidate and SAFE_THREAD_ID_PATTERN.fullmatch(candidate):
        return candidate
    return FALLBACK_THREAD_ID


def _test_doc_path(thread_id: str) -> Path:
    return OPTION_ROOT / f"测试文档.{thread_id}.md"


def _lock_path(thread_id: str) -> Path:
    return OPTION_ROOT / f"测试文档.{thread_id}.lock"


def _history_path(thread_id: str, now: datetime | None = None) -> Path:
    current = now or _now()
    return HISTORY_ROOT / f"测试文档.history_{current:%Y-%m-%d}.{thread_id}.md"


def _read_doc(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip() if path.exists() else ""


def _write_doc(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"{text.strip()}\n", encoding="utf-8")


def _acquire_lock(lock_path: Path, timeout_seconds: float = 10.0) -> int:
    # 同一线程串行登记测试项，不同页面仍可维护各自独立清单。
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    deadline = time.monotonic() + timeout_seconds
    while True:
        try:
            return os.open(str(lock_path), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            if time.monotonic() >= deadline:
                raise TimeoutError(f"测试文档锁超时：{lock_path}")
            time.sleep(0.05)


def _release_lock(lock_fd: int, lock_path: Path) -> None:
    os.close(lock_fd)
    try:
        lock_path.unlink()
    except FileNotFoundError:
        pass


def _item_blocks(text: str) -> list[re.Match[str]]:
    return list(re.finditer(
        r"(?ms)^(\d+)\. \*\*(待测试|通过|失败)\*\*：(.*?)(?=^\d+\. \*\*(?:待测试|通过|失败)\*\*：|\Z)",
        text,
    ))


def _item_numbers(text: str, status: str | None = None) -> list[int]:
    return [
        int(match.group(1))
        for match in _item_blocks(text)
        if status is None or match.group(2) == status
    ]


def _document_revision(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def _state_payload(text: str) -> dict[str, Any]:
    all_items = _item_numbers(text)
    pending_items = _item_numbers(text, STATUS_PENDING)
    failed_items = _item_numbers(text, STATUS_FAILED)
    return {
        "exists": bool(text),
        "item_count": len(all_items),
        "pending_items": pending_items,
        "failed_items": failed_items,
        "all_completed": bool(all_items) and not pending_items and not failed_items,
        "doc_revision": _document_revision(text),
    }


def _empty_document(thread_id: str) -> str:
    return "\n".join([
        "# 本次测试文档",
        "",
        f"任务线程：{thread_id}",
        "",
        "## 统一测试清单",
    ])


def _format_item(number: int, item: dict[str, Any]) -> str:
    title = _normalize_text(item.get("title") or item.get("content") or item.get("test"))
    change = _normalize_text(item.get("change") or item.get("reason"))
    command = _normalize_text(item.get("command"))
    expected = _normalize_text(item.get("expected") or item.get("expected_result"))
    return "\n".join([
        f"{number}. **{STATUS_PENDING}**：{title}",
        f"   - 变更内容：{change}",
        f"   - 测试命令：{command}",
        f"   - 预期结果：{expected}",
    ])


def _normalized_items(context: dict[str, Any]) -> list[dict[str, Any]]:
    raw_items = context.get("items")
    if raw_items is None:
        raw_items = [context]
    if not isinstance(raw_items, list):
        return []
    result: list[dict[str, Any]] = []
    for raw_item in raw_items:
        if not isinstance(raw_item, dict):
            continue
        title = _normalize_text(raw_item.get("title") or raw_item.get("content") or raw_item.get("test"))
        change = _normalize_text(raw_item.get("change") or raw_item.get("reason"))
        command = _normalize_text(raw_item.get("command"))
        expected = _normalize_text(raw_item.get("expected") or raw_item.get("expected_result"))
        # 每项必须能回答“改了什么、怎么测、什么算通过”，禁止只登记模糊标题。
        if title and change and command and expected:
            result.append({
                "title": title,
                "change": change,
                "command": command,
                "expected": expected,
            })
    return result


def check_current(context: dict[str, Any]) -> dict[str, Any]:
    thread_id = _resolve_thread_id(context)
    doc_path = _test_doc_path(thread_id)
    text = _read_doc(doc_path)
    return {
        "status": "completed",
        "ability": ABILITY_ID,
        "action": "check",
        "thread_id": thread_id,
        "doc_path": str(doc_path),
        **_state_payload(text),
    }


def record_tests(context: dict[str, Any]) -> dict[str, Any]:
    items = _normalized_items(context)
    if not items:
        return {
            "status": "blocked_invalid_test_items",
            "exit_code": 1,
            "ability": ABILITY_ID,
            "action": "record",
            "message": "每个测试项必须包含 title、change、command 和 expected。",
        }
    thread_id = _resolve_thread_id(context)
    doc_path = _test_doc_path(thread_id)
    lock_path = _lock_path(thread_id)
    lock_fd = _acquire_lock(lock_path)
    added_numbers: list[int] = []
    try:
        text = _read_doc(doc_path) or _empty_document(thread_id)
        # 标题与命令共同构成稳定去重键，同一修改反复保存时不会制造重复待测项。
        existing_keys = {
            (
                _normalize_text(match.group(3).splitlines()[0]),
                _normalize_text(re.search(r"(?m)^\s+- 测试命令：(.*)$", match.group(3)).group(1))
                if re.search(r"(?m)^\s+- 测试命令：(.*)$", match.group(3)) else "",
            )
            for match in _item_blocks(text)
            if match.group(2) == STATUS_PENDING
        }
        next_number = max(_item_numbers(text), default=0) + 1
        blocks: list[str] = []
        for item in items:
            key = (item["title"], item["command"])
            if key in existing_keys:
                continue
            blocks.append(_format_item(next_number, item))
            added_numbers.append(next_number)
            existing_keys.add(key)
            next_number += 1
        if blocks:
            text = f"{text.rstrip()}\n\n" + "\n\n".join(blocks)
            _write_doc(doc_path, text)
        final_text = _read_doc(doc_path)
    finally:
        _release_lock(lock_fd, lock_path)
    return {
        "status": "completed",
        "ability": ABILITY_ID,
        "action": "record",
        "thread_id": thread_id,
        "doc_path": str(doc_path),
        "added_items": added_numbers,
        **_state_payload(final_text),
    }


def record_result(context: dict[str, Any]) -> dict[str, Any]:
    item_number = int(context.get("item_number") or context.get("item") or 0)
    raw_status = _normalize_text(context.get("status") or context.get("test_status"))
    status_aliases = {"passed": STATUS_PASSED, "pass": STATUS_PASSED, "failed": STATUS_FAILED, "fail": STATUS_FAILED}
    result_status = status_aliases.get(raw_status.lower(), raw_status)
    actual_result = _normalize_text(context.get("result") or context.get("actual_result"))
    if item_number <= 0 or result_status not in ALLOWED_RESULT_STATUS or not actual_result:
        return {
            "status": "blocked_invalid_test_result",
            "exit_code": 1,
            "ability": ABILITY_ID,
            "action": "result",
            "message": "结果必须包含有效 item_number、通过/失败状态和 actual_result。",
        }
    thread_id = _resolve_thread_id(context)
    doc_path = _test_doc_path(thread_id)
    lock_path = _lock_path(thread_id)
    lock_fd = _acquire_lock(lock_path)
    try:
        text = _read_doc(doc_path)
        pattern = re.compile(
            rf"(?ms)^({item_number}\. )\*\*(待测试|通过|失败)\*\*：(.*?)(?=^\d+\. \*\*(?:待测试|通过|失败)\*\*：|\Z)"
        )
        match = pattern.search(text)
        if not match:
            return {
                "status": "test_item_not_found",
                "exit_code": 1,
                "ability": ABILITY_ID,
                "action": "result",
                "item_number": item_number,
            }
        body = re.sub(r"(?m)^\s+- 实际结果：.*\n?", "", match.group(3)).rstrip()
        replacement = f"{match.group(1)}**{result_status}**：{body}\n   - 实际结果：{actual_result}\n"
        text = f"{text[:match.start()]}{replacement}{text[match.end():]}".strip()
        _write_doc(doc_path, text)
        final_text = _read_doc(doc_path)
    finally:
        _release_lock(lock_fd, lock_path)
    return {
        "status": "completed",
        "ability": ABILITY_ID,
        "action": "result",
        "thread_id": thread_id,
        "doc_path": str(doc_path),
        "item_number": item_number,
        **_state_payload(final_text),
    }


def gate_pending(context: dict[str, Any]) -> dict[str, Any]:
    state = check_current(context)
    if not state.get("pending_items"):
        return {
            **state,
            "status": "blocked_test_document_has_no_pending_items",
            "exit_code": 1,
            "action": "pending",
            "message": "修改任务结束前必须登记至少一个待统一测试项。",
        }
    return {
        **state,
        "status": "completed",
        "action": "pending",
        "message": "测试文档已登记待统一测试内容。",
    }


def gate_ready(context: dict[str, Any]) -> dict[str, Any]:
    state = check_current(context)
    if not state.get("all_completed"):
        return {
            **state,
            "status": "blocked_test_document_not_ready",
            "exit_code": 1,
            "action": "ready",
            "message": "仍有待测试或失败项，禁止归档测试文档。",
        }
    return {**state, "status": "completed", "action": "ready"}


def finish_tests(context: dict[str, Any]) -> dict[str, Any]:
    ready = gate_ready(context)
    if ready.get("status") != "completed":
        return ready
    thread_id = _resolve_thread_id(context)
    doc_path = _test_doc_path(thread_id)
    lock_path = _lock_path(thread_id)
    lock_fd = _acquire_lock(lock_path)
    try:
        text = _read_doc(doc_path)
        history_path = _history_path(thread_id)
        history_path.parent.mkdir(parents=True, exist_ok=True)
        separator = "\n\n" if history_path.exists() and history_path.stat().st_size else ""
        with history_path.open("a", encoding="utf-8") as file_obj:
            file_obj.write(f"{separator}**统一测试时间：{_now():%Y-%m-%d %H:%M:%S %Z}**\n\n{text}\n")
        _write_doc(doc_path, _empty_document(thread_id))
    finally:
        _release_lock(lock_fd, lock_path)
    return {
        "status": "completed",
        "ability": ABILITY_ID,
        "action": "finish",
        "thread_id": thread_id,
        "doc_path": str(doc_path),
        "history_path": str(history_path),
        "message": "统一测试全部通过，测试文档已归档。",
    }


def execute(context: dict, skills: dict, apps: dict) -> dict:
    _ = skills, apps
    action = _normalize_text(context.get("action") or "check").replace("-", "_")
    if action == "check":
        return check_current(context)
    if action == "record":
        return record_tests(context)
    if action == "result":
        return record_result(context)
    if action == "pending":
        return gate_pending(context)
    if action == "ready":
        return gate_ready(context)
    if action == "finish":
        return finish_tests(context)
    return {
        "status": "unknown_action",
        "exit_code": 1,
        "ability": ABILITY_ID,
        "action": action,
        "message": "支持的 action：check/record/result/pending/ready/finish。",
    }
