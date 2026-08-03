"""UTF-8 记账提交能力。

功能：
统一从 UTF-8 上下文执行记账，必要时支持先从 UTF-8 JSON 文件读取 payload，
再调用 ledger_http_submitter 完成实际 HTTP 提交。

作用：
把“中文记账不要经过 PowerShell 内联管道”固化成能力入口，后续执行器自动记账
与人工补记账都优先走这一层，减少中文字段在调用链前段被破坏的风险。
"""

from __future__ import annotations

from datetime import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
from typing import Any


ABILITY_ID = "ledger_utf8_submitter"
ABILITY_NAME = "UTF-8 记账提交能力"
ABILITY_DESC = "统一从 UTF-8 上下文或 UTF-8 JSON 文件读取记账 payload，再调用 ledger_http_submitter。"

REQUIRED_SKILLS: list[str] = []
REQUIRED_APPS: list[str] = []

CODE_ROOT = Path(__file__).resolve().parents[1]
# 从迁移后的深层包向上识别项目根目录，使失败队列继续归属当前工程。
WORKSPACE_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
LEDGER_HTTP_SUBMITTER_PATH = CODE_ROOT / "abilities" / "ledger_http_submitter.py"
# 将记账请求和失败队列保存在项目内 OPTION 临时目录，保证相对路径下的补记流程可持续运行。
LEDGER_PAYLOAD_ROOT = WORKSPACE_ROOT / "OPTION" / "temp" / "ledger_payload_agents"
FAILED_QUEUE_DIR = LEDGER_PAYLOAD_ROOT / "failed_queue"
FAILED_QUEUE_ARCHIVE_DIR = FAILED_QUEUE_DIR / "completed"
AUTO_RETRY_FAILED_QUEUE_LIMIT = 3
SKIP_FAILED_QUEUE_AUTO_RETRY_KEY = "_skip_failed_queue_auto_retry"


def _load_module(module_path: Path, module_name: str) -> Any:
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"无法加载模块：{module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _read_payload_file(payload_path: str) -> dict[str, Any]:
    resolved_path = Path(payload_path).expanduser().resolve()
    raw_text = resolved_path.read_text(encoding="utf-8")
    payload = json.loads(raw_text)
    if not isinstance(payload, dict):
        raise ValueError("payload_path 对应的 JSON 根对象必须是对象。")
    return payload


def _is_failed_result(result: dict[str, Any]) -> bool:
    if result.get("status") != "completed":
        return True
    return str(result.get("ledger_status") or "").strip().lower() == "failed"


def _now_text() -> str:
    return datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")


def _canonical_payload_text(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, sort_keys=True)


def _build_failed_entry_path(payload_context: dict[str, Any], source_payload_path: str) -> Path:
    digest_source = f"{source_payload_path}\n{_canonical_payload_text(payload_context)}"
    digest = hashlib.sha256(digest_source.encode("utf-8")).hexdigest()[:16]
    return FAILED_QUEUE_DIR / f"ledger_failed_{digest}.json"


def _read_json_file(json_path: Path) -> dict[str, Any]:
    raw_text = json_path.read_text(encoding="utf-8")
    payload = json.loads(raw_text)
    if not isinstance(payload, dict):
        raise ValueError(f"JSON 根对象必须是对象：{json_path}")
    return payload


def _ensure_failed_queue_dirs() -> None:
    FAILED_QUEUE_DIR.mkdir(parents=True, exist_ok=True)
    FAILED_QUEUE_ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)


def _result_requires_failed_queue(ledger_result: dict[str, Any]) -> bool:
    if ledger_result.get("status") != "completed":
        return True
    return str(ledger_result.get("ledger_status") or "").strip().lower() == "failed"


def _archive_failed_entry(
    entry_path: Path,
    entry: dict[str, Any],
    ledger_result: dict[str, Any],
    *,
    resolution: str,
) -> Path:
    # 失败队列业务收口统一走 completed 归档，避免 pending 根目录长期残留误报。
    _ensure_failed_queue_dirs()
    entry["queue_status"] = "completed"
    entry["completed_at"] = _now_text()
    entry["resolution"] = resolution
    entry["success_result"] = ledger_result
    archive_path = FAILED_QUEUE_ARCHIVE_DIR / entry_path.name
    archive_path.write_text(json.dumps(entry, ensure_ascii=False, indent=2), encoding="utf-8")
    if entry_path.exists():
        entry_path.unlink()
    return archive_path


def _update_failed_entry_after_retry(
    entry_path: Path,
    entry: dict[str, Any],
    ledger_result: dict[str, Any],
) -> None:
    # 远端仍失败时只更新原 pending 项，让下一轮自动补记还能继续识别同一任务。
    retry_count = int(entry.get("retry_count", 0) or 0) + 1
    entry["queue_status"] = "pending"
    entry["last_failed_at"] = _now_text()
    entry["retry_count"] = retry_count
    entry["last_result"] = ledger_result
    entry_path.write_text(json.dumps(entry, ensure_ascii=False, indent=2), encoding="utf-8")


def _expected_failed_entry_path(entry: dict[str, Any]) -> Path | None:
    # 按当前正式算法计算失败文件名，用来识别历史手工命名文件。
    payload = entry.get("payload")
    if not isinstance(payload, dict):
        return None
    source_payload_path = str(entry.get("source_payload_path") or "").strip()
    return _build_failed_entry_path(payload, source_payload_path)


def _is_legacy_manual_failed_entry(entry_path: Path, entry: dict[str, Any]) -> bool:
    # 历史手工文件不再自动提交，按用户要求直接归档 completed。
    expected_path = _expected_failed_entry_path(entry)
    return expected_path is not None and expected_path.name != entry_path.name


def _submit_payload_context(payload_context: dict[str, Any]) -> dict[str, Any]:
    # 真正的远端提交集中在这里，自动补记不会递归调用 execute。
    ledger_module = _load_module(
        LEDGER_HTTP_SUBMITTER_PATH,
        "ledger_http_submitter_wrapped_by_utf8_submitter",
    )
    return ledger_module.execute(context=payload_context, skills={}, apps={})


def record_failed_submission(
    payload_context: dict[str, Any],
    ledger_result: dict[str, Any],
    *,
    source_payload_path: str = "",
) -> Path:
    _ensure_failed_queue_dirs()
    entry_path = _build_failed_entry_path(payload_context, source_payload_path)
    existing_entry: dict[str, Any] = {}
    if entry_path.exists():
        try:
            existing_entry = _read_json_file(entry_path)
        except Exception:
            existing_entry = {}
    retry_count = int(existing_entry.get("retry_count", 0) or 0)
    if existing_entry:
        retry_count += 1
    failed_entry = {
        "queue_status": "pending",
        "task_title": str(payload_context.get("task_title") or "").strip(),
        "tags": payload_context.get("tags") if isinstance(payload_context.get("tags"), list) else [],
        "source_payload_path": source_payload_path,
        "payload": payload_context,
        "first_failed_at": existing_entry.get("first_failed_at") or _now_text(),
        "last_failed_at": _now_text(),
        "retry_count": retry_count,
        "last_result": ledger_result,
    }
    entry_path.write_text(json.dumps(failed_entry, ensure_ascii=False, indent=2), encoding="utf-8")
    return entry_path


def clear_failed_submission(
    payload_context: dict[str, Any],
    ledger_result: dict[str, Any],
    *,
    source_payload_path: str = "",
) -> Path | None:
    _ensure_failed_queue_dirs()
    entry_path = _build_failed_entry_path(payload_context, source_payload_path)
    if not entry_path.exists():
        return None
    entry = _read_json_file(entry_path)
    return _archive_failed_entry(
        entry_path,
        entry,
        ledger_result,
        resolution="retry_submitted_successfully",
    )


def _build_payload_context(context: dict[str, Any]) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    payload_path = str(context.get("payload_path") or "").strip()
    if payload_path:
        payload.update(_read_payload_file(payload_path))
    for key, value in context.items():
        if key in {"payload_path", "source_payload_path"}:
            continue
        payload[key] = value
    # 通过一次 UTF-8 JSON 往返统一文本编码边界，并复制出稳定 dict。
    return json.loads(json.dumps(payload, ensure_ascii=False))


def submit_payload_file(json_path: str) -> dict[str, Any]:
    payload_path = Path(json_path).expanduser().resolve()
    payload = _read_payload_file(str(payload_path))
    return execute(
        context={
            **payload,
            "payload_path": str(payload_path),
        },
        skills={},
        apps={},
    )


def retry_failed_queue(limit: int | None = None, *, archive_legacy_manual: bool = True) -> dict[str, Any]:
    # 正式记账前最多处理少量失败项，避免远端慢时拖垮本次正常记账。
    _ensure_failed_queue_dirs()
    pending_entries = sorted(
        path for path in FAILED_QUEUE_DIR.glob("ledger_failed_*.json") if path.is_file()
    )
    if limit is not None and limit > 0:
        pending_entries = pending_entries[:limit]
    attempted_entries: list[dict[str, Any]] = []
    succeeded_count = 0
    failed_count = 0
    skipped_count = 0
    for entry_path in pending_entries:
        entry = _read_json_file(entry_path)
        payload = entry.get("payload")
        if not isinstance(payload, dict):
            # 无法安全补记的历史坏数据也收口到 completed，避免反复阻塞自动补记。
            skipped_count += 1
            archive_path = _archive_failed_entry(
                entry_path,
                entry,
                {
                    "status": "skipped",
                    "ledger_status": "not_submitted",
                    "failure_reason": "payload 字段不是对象，无法安全补记。",
                },
                resolution="invalid_payload_not_submitted",
            )
            attempted_entries.append(
                {
                    "entry_path": str(entry_path),
                    "result_status": "skipped",
                    "ledger_status": "not_submitted",
                    "archive_path": str(archive_path),
                    "resolution": "invalid_payload_not_submitted",
                }
            )
            continue
        if archive_legacy_manual and _is_legacy_manual_failed_entry(entry_path, entry):
            # 手工命名项按用户要求不补记也归档，保留 resolution 说明未提交原因。
            skipped_count += 1
            archive_path = _archive_failed_entry(
                entry_path,
                entry,
                {
                    "status": "skipped",
                    "ledger_status": "not_submitted",
                    "failure_reason": "历史手工命名失败文件不再自动提交，按用户要求归档 completed。",
                },
                resolution="manual_skip_not_submitted",
            )
            attempted_entries.append(
                {
                    "entry_path": str(entry_path),
                    "result_status": "skipped",
                    "ledger_status": "not_submitted",
                    "archive_path": str(archive_path),
                    "resolution": "manual_skip_not_submitted",
                }
            )
            continue
        result = _submit_payload_context(dict(payload))
        attempted_entries.append(
            {
                "entry_path": str(entry_path),
                "result_status": result.get("status"),
                "ledger_status": result.get("ledger_status"),
                "run_id": result.get("run_id", ""),
            }
        )
        if _is_failed_result(result):
            failed_count += 1
            _update_failed_entry_after_retry(entry_path, entry, result)
        else:
            # 成功补记按正在处理的 entry_path 归档，兼容非 digest 文件名。
            succeeded_count += 1
            archive_path = _archive_failed_entry(
                entry_path,
                entry,
                result,
                resolution="retry_submitted_successfully",
            )
            attempted_entries[-1]["archive_path"] = str(archive_path)
    return {
        "status": "completed" if failed_count == 0 else "partial_failed",
        "attempted_count": len(attempted_entries),
        "succeeded_count": succeeded_count,
        "failed_count": failed_count,
        "skipped_count": skipped_count,
        "attempted_entries": attempted_entries,
    }


def execute(context: dict, skills: dict, apps: dict) -> dict:
    _ = skills, apps
    auto_retry_result: dict[str, Any] | None = None
    should_retry_failed_queue = not bool(context.get(SKIP_FAILED_QUEUE_AUTO_RETRY_KEY))
    if should_retry_failed_queue:
        # 每次正式记账前先自动清理少量历史失败项，再提交本次 payload。
        auto_retry_result = retry_failed_queue(limit=AUTO_RETRY_FAILED_QUEUE_LIMIT)
    raw_source_payload_path = str(
        context.get("payload_path") or context.get("source_payload_path") or ""
    ).strip()
    source_payload_path = ""
    if raw_source_payload_path:
        source_payload_path = str(Path(raw_source_payload_path).expanduser().resolve())
    payload_context = _build_payload_context(context)
    payload_context.pop(SKIP_FAILED_QUEUE_AUTO_RETRY_KEY, None)
    ledger_result = _submit_payload_context(payload_context)
    if auto_retry_result is not None:
        ledger_result["failed_queue_auto_retry"] = auto_retry_result
    if _result_requires_failed_queue(ledger_result):
        failed_queue_path = record_failed_submission(
            payload_context,
            ledger_result,
            source_payload_path=source_payload_path,
        )
        ledger_result["failed_queue_path"] = str(failed_queue_path)
        ledger_result["failed_queue_status"] = "pending"
        return ledger_result
    cleared_queue_path = clear_failed_submission(
        payload_context,
        ledger_result,
        source_payload_path=source_payload_path,
    )
    if cleared_queue_path is not None:
        ledger_result["failed_queue_cleared_path"] = str(cleared_queue_path)
    return ledger_result
