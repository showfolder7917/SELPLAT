"""最小用户 1/2 确认门能力。

功能：
在项目内 MEMORIES 中把 USER.PROTOCOL 的 1/2 确认规则落成最小可执行守门。

作用：
只处理“先陈述任务理解，再等待用户独立回复 1 或 2”这一条最小闭环，
不引入执行池、自动续跑或其他主系统侧附加流程。
"""

from __future__ import annotations

import json
from pathlib import Path
import time
from typing import Any


ABILITY_ID = "user_confirmation_gatekeeper"
ABILITY_NAME = "最小用户确认门"
ABILITY_DESC = "只处理独立 1/2 确认，不扩展执行池与其他附加流程。"
REQUIRED_SKILLS: list[str] = []
REQUIRED_APPS: list[str] = []
DEFAULT_STATE_TTL_SECONDS = 6 * 60 * 60
CODE_ROOT = Path(__file__).resolve().parents[1]


def _default_state() -> dict[str, Any]:
    return {
        "pending_task_understanding": "",
        "confirmation_gate_open": False,
        "confirmed_task_understanding": "",
        "session_id": "",
        "timestamp_id": "",
        "updated_at": 0,
        "expires_at": 0,
    }


def _session_identity(context: dict[str, Any]) -> tuple[str, str]:
    session_id = str(context.get("session_id") or context.get("conversation_id") or "").strip() or "default-session"
    timestamp_id = str(context.get("timestamp_id") or context.get("turn_id") or "").strip() or "default-thread"
    return session_id, timestamp_id


def _state_path(context: dict[str, Any]) -> Path:
    explicit = str(context.get("state_path") or "").strip()
    if explicit:
        return Path(explicit).expanduser().resolve()
    session_id, timestamp_id = _session_identity(context)
    safe_session = "".join(char if char.isalnum() or char in {"-", "_"} else "_" for char in session_id)
    safe_thread = "".join(char if char.isalnum() or char in {"-", "_"} else "_" for char in timestamp_id)
    state_root = CODE_ROOT.parents[2] / "OPTION" / "temp" / "user_confirmation_gatekeeper"
    return state_root / f"{safe_session}__{safe_thread}.json"


def _load_state(path: Path, context: dict[str, Any]) -> dict[str, Any]:
    if not path.exists():
        return _default_state()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return _default_state()
    state = _default_state()
    if isinstance(data, dict):
        state.update(data)
    session_id, timestamp_id = _session_identity(context)
    now_ts = int(time.time())
    if int(state.get("expires_at", 0) or 0) and int(state.get("expires_at", 0) or 0) < now_ts:
        return _default_state()
    if str(state.get("session_id") or "").strip() not in {"", session_id}:
        return _default_state()
    if str(state.get("timestamp_id") or "").strip() not in {"", timestamp_id}:
        return _default_state()
    return state


def _save_state(path: Path, state: dict[str, Any], context: dict[str, Any]) -> None:
    session_id, timestamp_id = _session_identity(context)
    now_ts = int(time.time())
    ttl_seconds = int(context.get("state_ttl_seconds") or DEFAULT_STATE_TTL_SECONDS)
    state["session_id"] = session_id
    state["timestamp_id"] = timestamp_id
    state["updated_at"] = now_ts
    state["expires_at"] = now_ts + max(60, ttl_seconds)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(f"{path.suffix}.tmp")
    temp_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    temp_path.replace(path)


def _normalize_reply(value: Any) -> str:
    return str(value or "").strip()


def _task_understanding(context: dict[str, Any]) -> str:
    return str(
        context.get("task_understanding")
        or context.get("task_text")
        or context.get("task_title")
        or context.get("task_summary")
        or ""
    ).strip()


def _propose(context: dict[str, Any], state: dict[str, Any]) -> dict[str, Any]:
    understanding = _task_understanding(context)
    if not understanding:
        return {
            "status": "no_task",
            "ability": ABILITY_ID,
            "message": "当前没有需要确认的具体任务。",
        }
    state["pending_task_understanding"] = understanding
    state["confirmation_gate_open"] = True
    state["confirmed_task_understanding"] = ""
    return {
        "status": "needs_confirmation",
        "ability": ABILITY_ID,
        "pending_task_understanding": understanding,
        "message": f"{understanding}\n1 立即执行\n2 暂不执行",
    }


def _reply(context: dict[str, Any], state: dict[str, Any]) -> dict[str, Any]:
    reply = _normalize_reply(context.get("user_reply"))
    pending = str(state.get("pending_task_understanding") or "").strip()
    if not state.get("confirmation_gate_open"):
        return {
            "status": "no_open_gate",
            "ability": ABILITY_ID,
            "message": "当前没有待确认任务。",
        }
    if reply == "1":
        state["confirmation_gate_open"] = False
        state["confirmed_task_understanding"] = pending
        state["pending_task_understanding"] = ""
        return {
            "status": "execution_confirmed",
            "ability": ABILITY_ID,
            "confirmed_task_understanding": state["confirmed_task_understanding"],
            "message": "已收到独立 1，可继续执行。",
        }
    if reply == "2":
        state["confirmation_gate_open"] = False
        state["confirmed_task_understanding"] = ""
        state["pending_task_understanding"] = ""
        return {
            "status": "execution_deferred",
            "ability": ABILITY_ID,
            "message": "已收到独立 2，当前任务暂不执行。",
        }
    return {
        "status": "waiting_for_standalone_1_or_2",
        "ability": ABILITY_ID,
        "pending_task_understanding": pending,
        "message": "当前只接受独立 1 或 2。",
    }


def _guard(context: dict[str, Any], state: dict[str, Any]) -> dict[str, Any]:
    reply = _normalize_reply(context.get("user_reply"))
    if reply:
        return _reply(context, state)
    if state.get("confirmation_gate_open"):
        return {
            "status": "blocked_by_confirmation_gate",
            "ability": ABILITY_ID,
            "pending_task_understanding": str(state.get("pending_task_understanding") or "").strip(),
            "message": "当前仍在等待用户独立回复 1 或 2。",
        }
    understanding = _task_understanding(context)
    if not understanding:
        return {
            "status": "no_task",
            "ability": ABILITY_ID,
            "message": "当前没有需要确认的具体任务。",
        }
    if understanding == str(state.get("confirmed_task_understanding") or "").strip():
        return {
            "status": "execution_already_confirmed",
            "ability": ABILITY_ID,
            "confirmed_task_understanding": understanding,
            "message": "当前任务已确认，可继续执行。",
        }
    return _propose(context, state)


def execute(context: dict, skills: dict, apps: dict) -> dict:
    _ = skills, apps
    path = _state_path(context)
    state = _load_state(path, context)
    action = str(context.get("action") or "guard").strip().lower()
    if action == "reset":
        state = _default_state()
        _save_state(path, state, context)
        return {
            "status": "reset",
            "ability": ABILITY_ID,
            "message": "确认门状态已重置。",
        }
    if action == "state":
        return {
            "status": "completed",
            "ability": ABILITY_ID,
            "state": state,
        }
    if action == "propose":
        result = _propose(context, state)
    elif action == "reply":
        result = _reply(context, state)
    else:
        result = _guard(context, state)
    _save_state(path, state, context)
    return result
