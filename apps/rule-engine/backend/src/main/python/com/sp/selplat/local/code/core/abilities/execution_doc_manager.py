"""执行文档维护能力。

功能：
维护项目根目录中按任务页面线程隔离的执行文档，并在任务完成后归档到当天历史文件。

作用：
把执行文档的任务前检查、任务创建、步骤回写、完成归档和格式化沉淀为统一能力。

适用场景：
- 正式任务开始前检查是否存在未完成步骤
- 创建新的本轮执行文档
- 将执行步骤标记为完成并补写实际结果
- 任务完成后归档到 OPTION/temp/执行文档.history_YYYY-MM-DD.<线程ID>.md
"""

from __future__ import annotations

from datetime import datetime
import hashlib
import os
from pathlib import Path
import time
from typing import Any
import re


ABILITY_ID = "execution_doc_manager"
ABILITY_NAME = "执行文档维护能力"
ABILITY_DESC = "统一维护执行文档：任务前检查未完成、创建任务、更新步骤、任务后归档。"

REQUIRED_SKILLS: list[str] = []
REQUIRED_APPS: list[str] = []

CODE_ROOT = Path(__file__).resolve().parents[1]
# 从迁移后的深层包向上识别项目根，使执行文档稳定落在项目内 OPTION。
WORKSPACE_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
# 将本轮执行记录集中写入项目内 OPTION 目录，保证相对路径迁移后任务状态仍可持续追踪。
OPTION_ROOT = WORKSPACE_ROOT / "OPTION"
# 保留旧文件名只用于一次性迁移，避免多个任务页面继续共同读写同一份无线程文档。
LEGACY_EXECUTION_DOC_PATH = OPTION_ROOT / "执行文档.md"
# 使用 Codex 桌面端注入的线程 ID，让每个任务页面拥有独立执行状态。
THREAD_ID_ENV_KEY = "CODEX_THREAD_ID"
# 线程标识只允许进入文件名安全字符，避免外部参数越出 OPTION 目录。
SAFE_THREAD_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
# 在非 Codex 桌面端调用时仍提供稳定的独立默认文档，而不是回退到旧共享文件。
FALLBACK_THREAD_ID = "local"
# 将已完成的历史记录归入项目统一临时数据目录，避免与当前正在维护的执行文档混放。
HISTORY_ROOT = OPTION_ROOT / "temp"

STATUS_DONE = "完成"
STATUS_PENDING = "未完成"
REQUIRED_CONFIRMATION = "1"
STABLE_SNAPSHOT_SETTLE_SECONDS = 0.08
STABLE_SNAPSHOT_MAX_WAIT_SECONDS = 1.2
STABLE_SNAPSHOT_POLL_SECONDS = 0.02


def _now() -> datetime:
    return datetime.now().astimezone()


def _today_text(now: datetime | None = None) -> str:
    current = now or _now()
    return current.strftime("%Y-%m-%d")


def _now_text(now: datetime | None = None) -> str:
    current = now or _now()
    return current.strftime("%Y-%m-%d %H:%M:%S %Z")


def _normalize_thread_id(value: Any) -> str:
    # 将调用参数或环境变量收敛为安全文件名片段，避免线程值影响工程外路径。
    candidate = _normalize_text(value)
    if candidate and SAFE_THREAD_ID_PATTERN.fullmatch(candidate):
        return candidate
    # 缺少桌面端线程上下文时，使用 local 文件隔离本地 CLI 调用与历史旧文件。
    return FALLBACK_THREAD_ID


def _resolve_thread_id(context: dict[str, Any]) -> str:
    # 调用方可显式传入 thread_id 便于测试和自动化；未传时读取当前 Codex 任务页面环境。
    return _normalize_thread_id(context.get("thread_id") or os.environ.get(THREAD_ID_ENV_KEY))


def _execution_doc_path(thread_id: str) -> Path:
    # 每个线程用独立文件保存未完成步骤，两个页面同时执行时不会互相覆盖。
    return OPTION_ROOT / f"执行文档.{thread_id}.md"


def _lock_path(thread_id: str) -> Path:
    # 锁文件与执行文档采用同一线程 ID，使不同页面可并行且同一页面保持串行回写。
    return OPTION_ROOT / f"执行文档.{thread_id}.lock"


def _history_path(thread_id: str, now: datetime | None = None) -> Path:
    # 归档文件同时携带日期和线程 ID，确保同日不同页面的执行历史互不混入。
    return HISTORY_ROOT / f"执行文档.history_{_today_text(now)}.{thread_id}.md"


def _normalize_text(value: Any) -> str:
    return str(value or "").strip()


def _read_doc(path: Path) -> str:
    # 所有读取都必须显式指定当前线程文档，禁止隐式回退到共享固定文件。
    target_path = path
    if not target_path.exists():
        return ""
    return target_path.read_text(encoding="utf-8").strip()


def _doc_revision(text: str) -> str:
    # 用正文哈希标识当前执行文档版本，便于调用方判断并发回写后自己拿到的是哪一版状态。
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def _write_doc(text: str, path: Path) -> None:
    # 所有写入都必须显式指定当前线程文档，保证任务页面之间的状态隔离。
    target_path = path
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(f"{text.strip()}\n", encoding="utf-8")


def _acquire_lock(lock_path: Path, timeout_seconds: float = 10.0, retry_interval: float = 0.05) -> int:
    # 仅对当前线程的锁文件互斥，避免同页并发写入覆盖步骤状态。
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    deadline = time.monotonic() + timeout_seconds
    while True:
        try:
            return os.open(str(lock_path), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            if time.monotonic() >= deadline:
                raise TimeoutError(f"执行文档锁超时：{lock_path}")
            time.sleep(retry_interval)


def _release_lock(lock_fd: int, lock_path: Path) -> None:
    # 释放当前线程持有的锁，确保同一任务页面的后续步骤可以继续回写。
    os.close(lock_fd)
    try:
        lock_path.unlink()
    except FileNotFoundError:
        pass


def _read_stable_doc_snapshot(doc_path: Path, lock_path: Path) -> str:
    # 并发 complete_step 会串行落盘，但较早返回的调用仍可能拿到“后续步骤尚未写入前”的旧视图。
    # 这里统一等到锁空闲且正文连续稳定一小段时间后，再把最终快照返回给调用方。
    deadline = time.monotonic() + STABLE_SNAPSHOT_MAX_WAIT_SECONDS
    last_signature = ""
    stable_since = 0.0
    latest_text = ""
    while True:
        latest_text = _read_doc(doc_path)
        current_signature = _doc_revision(latest_text)
        lock_exists = lock_path.exists()
        if not lock_exists:
            if current_signature == last_signature:
                if stable_since == 0.0:
                    stable_since = time.monotonic()
                if time.monotonic() - stable_since >= STABLE_SNAPSHOT_SETTLE_SECONDS:
                    return latest_text
            else:
                stable_since = time.monotonic()
        else:
            stable_since = 0.0
        last_signature = current_signature
        if time.monotonic() >= deadline:
            return latest_text
        time.sleep(STABLE_SNAPSHOT_POLL_SECONDS)


def _build_state_payload(text: str) -> dict[str, Any]:
    # 把同一份正文快照统一转换为状态响应，避免不同 action 各自重复拼字段而出现口径漂移。
    return {
        "exists": bool(text),
        "authorized": _task_confirmation(text) == REQUIRED_CONFIRMATION,
        "goal": _task_goal(text),
        "step_count": len(_all_steps(text)),
        "all_completed": _is_all_completed(text),
        "pending_steps": _pending_steps(text),
        "doc_revision": _doc_revision(text),
    }


def _step_pattern(step_number: int) -> re.Pattern[str]:
    return re.compile(
        rf"(?ms)^({step_number}\.\s+\*\*)(完成|未完成)(\*\*：.*?)(?=^\d+\.\s+\*\*|\Z)"
    )


def _pending_steps(text: str) -> list[int]:
    return [int(item) for item in re.findall(r"(?m)^(\d+)\.\s+\*\*未完成\*\*：", text)]


def _all_steps(text: str) -> list[int]:
    # 统一读取完成与未完成步骤，门禁据此区分真实任务和只有标题的空模板。
    return [int(item) for item in re.findall(r"(?m)^(\d+)\.\s+\*\*(?:完成|未完成)\*\*：", text)]


def _task_goal(text: str) -> str:
    # 目标必须位于固定章节内，避免把授权信息或步骤正文误判成正式任务目标。
    match = re.search(r"(?ms)^## 总体任务目标\s*\n(.*?)(?=^## 执行步骤\s*$|\Z)", text)
    return _normalize_text(match.group(1)) if match else ""


def _task_confirmation(text: str) -> str:
    # 独立确认写入当前线程文档，使后续 Gradle 门禁能够技术核验任务确实经过 USER 协议授权。
    match = re.search(r"(?m)^独立确认：(.+?)\s*$", text)
    return _normalize_text(match.group(1)) if match else ""


def _is_all_completed(text: str) -> bool:
    # 只读取步骤行状态；实际结果可以合法描述“未完成步骤已被门禁阻断”，不得因此误判整份任务。
    all_steps = _all_steps(text)
    return bool(all_steps) and not _pending_steps(text) and len(all_steps) == len(
        re.findall(r"(?m)^\d+\.\s+\*\*完成\*\*：", text)
    )


def _format_step(step_number: int, content: str, *, status: str = STATUS_PENDING, result: str = "") -> str:
    line = f"{step_number}. **{status}**：{_normalize_text(content)}"
    clean_result = _normalize_text(result)
    if clean_result:
        line = f"{line}\n   - 实际结果：{clean_result}"
    return line


def _format_document(goal: str, steps: list[str], thread_id: str, confirmation: str) -> str:
    step_lines = [
        _format_step(index + 1, step, status=STATUS_PENDING)
        for index, step in enumerate(steps)
    ]
    return "\n".join(
        [
            "# 本次执行文档",
            "",
            "## 执行授权",
            "",
            f"独立确认：{_normalize_text(confirmation)}",
            f"任务线程：{thread_id}",
            "",
            "## 总体任务目标",
            "",
            _normalize_text(goal),
            "",
            "## 执行步骤",
            "",
            "\n".join(step_lines),
        ]
    )


def _append_history(doc_text: str, thread_id: str, *, now: datetime | None = None) -> Path:
    # 当前线程完成后只追加到自己的历史文件，避免同日其他页面的任务记录混入。
    history_path = _history_path(thread_id, now)
    history_path.parent.mkdir(parents=True, exist_ok=True)
    archive_block = "\n".join([f"**执行时间：{_now_text(now)}**", "", doc_text.strip(), ""])
    separator = "\n\n" if history_path.exists() and history_path.stat().st_size > 0 else ""
    with history_path.open("a", encoding="utf-8") as file_obj:
        file_obj.write(f"{separator}{archive_block.rstrip()}\n")
    return history_path


def _migrate_legacy_doc_if_needed(doc_path: Path) -> bool:
    # 仅在线程文档首次创建前迁移旧固定文件，保留既有任务内容并终止旧路径的共享写入。
    if doc_path.exists() or not LEGACY_EXECUTION_DOC_PATH.exists():
        return False
    # 空白模板不包含可追踪任务，不迁移到任何线程，避免制造无意义执行文档。
    legacy_text = _read_doc(LEGACY_EXECUTION_DOC_PATH)
    if not _pending_steps(legacy_text) and not _is_all_completed(legacy_text):
        return False
    doc_path.parent.mkdir(parents=True, exist_ok=True)
    # 原子移动旧文件到当前页面专属名称，确保内容不会被复制后遗留一份共享副本。
    LEGACY_EXECUTION_DOC_PATH.replace(doc_path)
    return True


def check_current(context: dict[str, Any]) -> dict[str, Any]:
    # 解析调用所处任务页面，再只读取该页面对应的执行文档。
    thread_id = _resolve_thread_id(context)
    doc_path = _execution_doc_path(thread_id)
    lock_path = _lock_path(thread_id)
    # 启动前检查也可能是升级后的首次调用，因此先在当前线程锁内完成旧文件迁移。
    lock_fd = _acquire_lock(lock_path)
    try:
        _migrate_legacy_doc_if_needed(doc_path)
        text = _read_doc(doc_path)
    finally:
        _release_lock(lock_fd, lock_path)
    return {
        "status": "completed",
        "ability": ABILITY_ID,
        "action": "check",
        "thread_id": thread_id,
        "doc_path": str(doc_path),
        **_build_state_payload(text),
        "should_continue_existing": bool(_pending_steps(text)),
    }


def start_task(context: dict[str, Any]) -> dict[str, Any]:
    goal = _normalize_text(context.get("goal") or context.get("task_goal"))
    confirmation = _normalize_text(context.get("confirmation") or context.get("authorization"))
    raw_steps = context.get("steps") or []
    steps = [_normalize_text(item) for item in raw_steps if _normalize_text(item)]
    if confirmation != REQUIRED_CONFIRMATION:
        return {
            "status": "blocked_missing_confirmation",
            "exit_code": 1,
            "ability": ABILITY_ID,
            "action": "begin",
            "message": "正式任务必须先取得独立 1，并通过 confirmation 字段写入执行文档。",
        }
    if not goal or not steps:
        return {
            "status": "blocked",
            "exit_code": 1,
            "ability": ABILITY_ID,
            "action": "begin",
            "message": "缺少 goal 或 steps。",
        }
    # 本次创建与回写均绑定调用页面的线程 ID，防止一个页面开启任务阻塞另一个页面。
    thread_id = _resolve_thread_id(context)
    doc_path = _execution_doc_path(thread_id)
    lock_path = _lock_path(thread_id)
    lock_fd = _acquire_lock(lock_path)
    try:
        # 旧固定文件若含有真实任务，首次调用时原子迁入当前页面的专属文件。
        _migrate_legacy_doc_if_needed(doc_path)
        current_text = _read_doc(doc_path)
        pending = _pending_steps(current_text)
        if pending and not context.get("force"):
            return {
                "status": "blocked_unfinished_steps",
                "exit_code": 1,
                "ability": ABILITY_ID,
                "action": "begin",
                "thread_id": thread_id,
                "doc_path": str(doc_path),
                "pending_steps": pending,
                "message": "当前执行文档仍有未完成步骤，必须先继续或显式 force。",
            }
        archived_path = None
        if _is_all_completed(current_text):
            archived_path = _append_history(current_text, thread_id)
        new_doc = _format_document(goal, steps, thread_id, confirmation)
        _write_doc(new_doc, doc_path)
        written_text = _read_doc(doc_path)
        return {
            "status": "completed",
            "ability": ABILITY_ID,
            "action": "begin",
            "thread_id": thread_id,
            "doc_path": str(doc_path),
            "archived_path": str(archived_path) if archived_path else "",
            "step_count": len(steps),
            **_build_state_payload(written_text),
        }
    finally:
        _release_lock(lock_fd, lock_path)


def complete_step(context: dict[str, Any]) -> dict[str, Any]:
    step_number = int(context.get("step_number") or context.get("step") or 0)
    result = _normalize_text(context.get("result") or context.get("actual_result"))
    if step_number <= 0 or not result:
        return {
            "status": "blocked",
            "ability": ABILITY_ID,
            "action": "step",
            "message": "缺少有效 step_number 或 result。",
        }
    # 先解析当前页面的专属文档和锁，再在锁内完成正文替换，确保步骤回写不会互相覆盖。
    thread_id = _resolve_thread_id(context)
    doc_path = _execution_doc_path(thread_id)
    lock_path = _lock_path(thread_id)
    lock_fd = _acquire_lock(lock_path)
    updated_text = ""
    try:
        _migrate_legacy_doc_if_needed(doc_path)
        text = _read_doc(doc_path)
        pattern = _step_pattern(step_number)
        match = pattern.search(text)
        if not match:
            return {
                "status": "step_not_found",
                "ability": ABILITY_ID,
                "action": "step",
                "step_number": step_number,
            }
        step_body = match.group(3)
        step_title = step_body.splitlines()[0]
        replacement = f"{match.group(1)}{STATUS_DONE}{step_title}\n   - 实际结果：{result}\n"
        # 当前步骤完成后，把同一步骤的正文和实际结果原位替换，避免破坏整份执行文档的步骤顺序。
        updated_text = f"{text[:match.start()]}{replacement}{text[match.end():]}".strip()
        _write_doc(updated_text, doc_path)
    finally:
        _release_lock(lock_fd, lock_path)
    # 再在锁外等待正文进入稳定快照，让并发回写时较早返回的调用也能拿到最新状态而不是中间态。
    stable_text = _read_stable_doc_snapshot(doc_path, lock_path) if updated_text else _read_doc(doc_path)
    return {
        "status": "completed",
        "ability": ABILITY_ID,
        "action": "step",
        "thread_id": thread_id,
        "doc_path": str(doc_path),
        "step_number": step_number,
        **_build_state_payload(stable_text),
    }


def archive_completed(context: dict[str, Any]) -> dict[str, Any]:
    # 归档时只锁定当前页面，保证其他任务页面仍能独立推进自己的执行步骤。
    thread_id = _resolve_thread_id(context)
    doc_path = _execution_doc_path(thread_id)
    lock_path = _lock_path(thread_id)
    lock_fd = _acquire_lock(lock_path)
    try:
        _migrate_legacy_doc_if_needed(doc_path)
        text = _read_doc(doc_path)
        if not text:
            return {
                "status": "empty_doc",
                "exit_code": 1,
                "ability": ABILITY_ID,
                "action": "archive_completed",
            }
        pending = _pending_steps(text)
        if pending:
            return {
                "status": "blocked_unfinished_steps",
                "exit_code": 1,
                "ability": ABILITY_ID,
                "action": "archive_completed",
                "pending_steps": pending,
            }
        history_path = _append_history(text, thread_id)
        _write_doc("# 本次执行文档\n\n## 总体任务目标\n\n\n\n## 执行步骤\n", doc_path)
        return {
            "status": "completed",
            "ability": ABILITY_ID,
            "action": "archive_completed",
            "history_path": str(history_path),
            "thread_id": thread_id,
            "doc_path": str(doc_path),
        }
    finally:
        _release_lock(lock_fd, lock_path)


def gate_active(context: dict[str, Any]) -> dict[str, Any]:
    # 快速、专项和全量门禁开始前必须命中同一线程的已授权真实任务，空模板或旧格式文档均不得放行。
    state = check_current(context)
    if not state.get("exists") or not state.get("authorized") or not state.get("goal") or not state.get("step_count"):
        return {
            **state,
            "status": "blocked_task_document_not_active",
            "exit_code": 1,
            "action": "active",
            "message": "当前线程缺少经过独立 1 授权的真实执行文档，请先调用 begin。",
        }
    return {
        **state,
        "status": "completed",
        "action": "active",
        "message": "当前线程执行文档已授权且处于可执行状态。",
    }


def gate_ready(context: dict[str, Any]) -> dict[str, Any]:
    # 最终交付只接受全部步骤已经按实际结果回写的文档，避免测试通过但执行记录仍停留在未完成。
    state = gate_active(context)
    if state.get("status") != "completed":
        return state
    if not state.get("all_completed"):
        return {
            **state,
            "status": "blocked_task_document_not_ready",
            "exit_code": 1,
            "action": "ready",
            "message": "执行文档仍有未完成步骤，禁止进入最终归档。",
        }
    return {
        **state,
        "status": "completed",
        "action": "ready",
        "message": "执行文档全部步骤已回写，可以执行最终归档。",
    }


def finish_task(context: dict[str, Any]) -> dict[str, Any]:
    # 修改步骤全部完成且测试计划已经由外部门禁登记后归档；测试结果由独立测试文档持续维护。
    ready_state = gate_ready(context)
    if ready_state.get("status") != "completed":
        return ready_state
    archived = archive_completed(context)
    return {
        **archived,
        "action": "finish",
        "message": "执行步骤已完成并归档；待测内容继续由同线程测试文档维护。",
    }


def execute(context: dict, skills: dict, apps: dict) -> dict:
    _ = skills, apps
    action = _normalize_text(context.get("action") or "check").replace("-", "_")
    if action == "check":
        return check_current(context)
    if action == "begin":
        return start_task(context)
    if action == "step":
        return complete_step(context)
    if action == "active":
        return gate_active(context)
    if action == "ready":
        return gate_ready(context)
    if action == "finish":
        return finish_task(context)
    return {
        "status": "unknown_action",
        "exit_code": 1,
        "ability": ABILITY_ID,
        "action": action,
        "message": "支持的 action：check/begin/step/active/ready/finish。",
    }
