"""维护当前任务线程的执行授权、步骤状态和历史归档。"""

from __future__ import annotations

from datetime import datetime
import re
from pathlib import Path
from typing import Any

from com.sp.selplat.ruleengine.util.文档存储 import 文档存储
from com.sp.selplat.ruleengine.util.路径配置 import 加载路径配置
from com.sp.selplat.ruleengine.abilities.会话记录执行器 import 验证记录回执


__all__ = ["execute"]

能力标识 = "execution_doc_manager"
完成状态 = "完成"
未完成状态 = "未完成"
必要确认 = "1"
会话执行确认 = "3"
_路径 = 加载路径配置()
OPTION_ROOT = _路径.取得("option_root")
HISTORY_ROOT = _路径.取得("history_root")
LEGACY_EXECUTION_DOC_PATH = OPTION_ROOT / "执行文档.md"


def _当前时间() -> datetime:
    """返回带本地时区的当前时间。"""

    return datetime.now().astimezone()


def _规范文本(值: Any) -> str:
    """把外部值转换为去除首尾空白的文本。"""

    return str(值 or "").strip()


def _线程标识(上下文: dict[str, Any]) -> str:
    """从上下文或会话环境解析安全线程标识。"""

    return 文档存储.解析线程标识(上下文)


def _execution_doc_path(线程: str) -> Path:
    """返回指定线程的执行文档路径。"""

    return OPTION_ROOT / f"执行文档.{线程}.md"


def _lock_path(线程: str) -> Path:
    """返回指定线程的执行文档锁路径。"""

    return OPTION_ROOT / f"执行文档.{线程}.lock"


def _history_path(线程: str, 当前: datetime | None = None) -> Path:
    """返回指定线程当天的执行历史路径。"""

    时间 = 当前 or _当前时间()
    return HISTORY_ROOT / f"执行文档.history_{时间:%Y-%m-%d}.{线程}.md"


def _step_pattern(序号: int) -> re.Pattern[str]:
    """建立只匹配一个执行步骤正文块的表达式。"""

    return re.compile(
        rf"(?ms)^({序号}\.\s+\*\*)(完成|未完成)(\*\*：.*?)(?=^\d+\.\s+\*\*|\Z)"
    )


def _pending_steps(正文: str) -> list[int]:
    """返回仍未完成的步骤序号。"""

    return [int(值) for 值 in re.findall(r"(?m)^(\d+)\.\s+\*\*未完成\*\*：", 正文)]


def _all_steps(正文: str) -> list[int]:
    """返回文档中的全部步骤序号。"""

    return [
        int(值)
        for 值 in re.findall(r"(?m)^(\d+)\.\s+\*\*(?:完成|未完成)\*\*：", 正文)
    ]


def _task_goal(正文: str) -> str:
    """读取固定章节内的正式任务目标。"""

    匹配 = re.search(r"(?ms)^## 总体任务目标\s*\n(.*?)(?=^## 执行步骤\s*$|\Z)", 正文)
    return _规范文本(匹配.group(1)) if 匹配 else ""


def _task_confirmation(正文: str) -> str:
    """读取执行文档中保存的独立授权值。"""

    匹配 = re.search(r"(?m)^独立确认：(.+?)\s*$", 正文)
    return _规范文本(匹配.group(1)) if 匹配 else ""


def _task_session_receipt(正文: str) -> str:
    """读取独立 3 在写入最新问答后生成的授权回执。"""

    匹配 = re.search(r"(?m)^会话记录回执：(.+?)\s*$", 正文)
    return _规范文本(匹配.group(1)) if 匹配 else ""


def _is_all_completed(正文: str) -> bool:
    """判断真实步骤是否全部处于完成状态。"""

    全部步骤 = _all_steps(正文)
    完成数量 = len(re.findall(r"(?m)^\d+\.\s+\*\*完成\*\*：", 正文))
    return bool(全部步骤) and not _pending_steps(正文) and len(全部步骤) == 完成数量


def _state_payload(正文: str) -> dict[str, Any]:
    """从同一正文快照构造统一执行状态。"""

    return {
        "exists": bool(正文),
        "authorized": (
            _task_confirmation(正文) == 必要确认
            or (
                _task_confirmation(正文) == 会话执行确认
                and bool(_task_session_receipt(正文))
            )
        ),
        "goal": _task_goal(正文),
        "step_count": len(_all_steps(正文)),
        "all_completed": _is_all_completed(正文),
        "pending_steps": _pending_steps(正文),
        "doc_revision": 文档存储.版本(正文),
    }


def _format_document(
    目标: str,
    步骤: list[str],
    线程: str,
    确认: str,
    会话回执: str = "",
) -> str:
    """生成一份带授权和待完成步骤的新执行文档。"""

    步骤正文 = "\n".join(
        f"{序号}. **{未完成状态}**：{内容}" for 序号, 内容 in enumerate(步骤, start=1)
    )
    授权行 = [f"独立确认：{确认}"]
    if 确认 == 会话执行确认:
        授权行.append(f"会话记录回执：{会话回执}")
    return "\n".join([
        "# 本次执行文档",
        "",
        "## 执行授权",
        "",
        *授权行,
        f"任务线程：{线程}",
        "",
        "## 总体任务目标",
        "",
        目标,
        "",
        "## 执行步骤",
        "",
        步骤正文,
    ])


def _append_history(正文: str, 线程: str, 当前: datetime | None = None) -> Path:
    """把完成文档追加到当前线程当天的历史文件。"""

    时间 = 当前 or _当前时间()
    历史路径 = _history_path(线程, 时间)
    历史路径.parent.mkdir(parents=True, exist_ok=True)
    分隔 = "\n\n" if 历史路径.exists() and 历史路径.stat().st_size else ""
    归档块 = f"**执行时间：{时间:%Y-%m-%d %H:%M:%S %Z}**\n\n{正文.strip()}\n"
    with 历史路径.open("a", encoding="utf-8") as 文件:
        文件.write(f"{分隔}{归档块}")
    return 历史路径


def _migrate_legacy_doc_if_needed(文档路径: Path) -> bool:
    """在线程文档不存在时一次性迁移仍含任务的旧共享文档。"""

    if 文档路径.exists() or not LEGACY_EXECUTION_DOC_PATH.exists():
        return False
    旧正文 = 文档存储.读取(LEGACY_EXECUTION_DOC_PATH)
    if not _pending_steps(旧正文) and not _is_all_completed(旧正文):
        return False
    文档路径.parent.mkdir(parents=True, exist_ok=True)
    LEGACY_EXECUTION_DOC_PATH.replace(文档路径)
    return True


def _check(上下文: dict[str, Any]) -> dict[str, Any]:
    """读取当前线程执行文档并返回完整状态。"""

    线程 = _线程标识(上下文)
    文档路径 = _execution_doc_path(线程)
    锁路径 = _lock_path(线程)
    with 文档存储.加锁(锁路径):
        _migrate_legacy_doc_if_needed(文档路径)
        正文 = 文档存储.读取(文档路径)
    return {
        "status": "completed",
        "ability": 能力标识,
        "action": "check",
        "thread_id": 线程,
        "doc_path": str(文档路径),
        **_state_payload(正文),
        "should_continue_existing": bool(_pending_steps(正文)),
    }


def _begin(上下文: dict[str, Any]) -> dict[str, Any]:
    """核验独立授权并创建当前线程的新执行文档。"""

    目标 = _规范文本(上下文.get("goal") or 上下文.get("task_goal"))
    确认 = _规范文本(上下文.get("confirmation") or 上下文.get("authorization"))
    会话回执 = _规范文本(上下文.get("session_record_receipt"))
    原始步骤 = 上下文.get("steps") or []
    步骤 = [_规范文本(值) for 值 in 原始步骤 if _规范文本(值)]
    线程 = _线程标识(上下文)
    if 确认 not in {必要确认, 会话执行确认}:
        return {
            "status": "blocked_missing_confirmation",
            "exit_code": 1,
            "ability": 能力标识,
            "action": "begin",
            "message": "正式任务必须先取得独立 1，或由独立 3 成功记录最新问答。",
        }
    if 确认 == 会话执行确认 and not 验证记录回执(线程, 会话回执):
        return {
            "status": "blocked_invalid_session_record_receipt",
            "exit_code": 1,
            "ability": 能力标识,
            "action": "begin",
            "thread_id": 线程,
            "message": "独立 3 缺少当前线程最新问答的有效记录回执。",
        }
    if not 目标 or not 步骤:
        return {
            "status": "blocked",
            "exit_code": 1,
            "ability": 能力标识,
            "action": "begin",
            "message": "缺少 goal 或 steps。",
        }
    文档路径 = _execution_doc_path(线程)
    锁路径 = _lock_path(线程)
    已归档路径 = ""
    with 文档存储.加锁(锁路径):
        _migrate_legacy_doc_if_needed(文档路径)
        当前正文 = 文档存储.读取(文档路径)
        if 确认 == 会话执行确认:
            历史正文 = 文档存储.读取(_history_path(线程))
            回执标记 = f"会话记录回执：{会话回执}"
            if 回执标记 in 当前正文 or 回执标记 in 历史正文:
                return {
                    "status": "blocked_reused_session_record_receipt",
                    "exit_code": 1,
                    "ability": 能力标识,
                    "action": "begin",
                    "thread_id": 线程,
                    "message": "该轮问答已经开启过执行任务，不允许重复执行。",
                }
        待完成 = _pending_steps(当前正文)
        if 待完成 and not 上下文.get("force"):
            return {
                "status": "blocked_unfinished_steps",
                "exit_code": 1,
                "ability": 能力标识,
                "action": "begin",
                "thread_id": 线程,
                "doc_path": str(文档路径),
                "pending_steps": 待完成,
            }
        if _is_all_completed(当前正文):
            已归档路径 = str(_append_history(当前正文, 线程))
        新正文 = _format_document(目标, 步骤, 线程, 确认, 会话回执)
        文档存储.写入(文档路径, 新正文)
    return {
        "status": "completed",
        "ability": 能力标识,
        "action": "begin",
        "thread_id": 线程,
        "doc_path": str(文档路径),
        "archived_path": 已归档路径,
        **_state_payload(新正文),
    }


def _normalize_step_results(上下文: dict[str, Any]) -> list[tuple[int, str]]:
    """把批量步骤结果转换为有序且去重的序号与正文。"""

    原始结果 = 上下文.get("results")
    if not isinstance(原始结果, (dict, list)):
        return []
    结果列表: list[tuple[int, str]] = []
    if isinstance(原始结果, dict):
        候选项 = 原始结果.items()
    else:
        候选项 = [
            (项目.get("step_number") or 项目.get("step"), 项目.get("result") or 项目.get("actual_result"))
            for 项目 in 原始结果
            if isinstance(项目, dict)
        ]
    已见序号: set[int] = set()
    for 原始序号, 原始正文 in 候选项:
        try:
            序号 = int(原始序号)
        except (TypeError, ValueError):
            return []
        正文 = _规范文本(原始正文)
        if 序号 <= 0 or not 正文 or 序号 in 已见序号:
            return []
        已见序号.add(序号)
        结果列表.append((序号, 正文))
    return 结果列表


def _complete_steps(上下文: dict[str, Any]) -> dict[str, Any]:
    """在一次文件锁和一次写入中完成多个执行步骤。"""

    结果列表 = _normalize_step_results(上下文)
    if not 结果列表:
        return {
            "status": "blocked_invalid_step_results",
            "exit_code": 1,
            "ability": 能力标识,
            "action": "complete_steps",
            "message": "results 必须包含有效且不重复的步骤序号和实际结果。",
        }
    线程 = _线程标识(上下文)
    文档路径 = _execution_doc_path(线程)
    锁路径 = _lock_path(线程)
    with 文档存储.加锁(锁路径):
        _migrate_legacy_doc_if_needed(文档路径)
        正文 = 文档存储.读取(文档路径)
        for 序号, _ in 结果列表:
            if not _step_pattern(序号).search(正文):
                return {
                    "status": "step_not_found",
                    "exit_code": 1,
                    "ability": 能力标识,
                    "action": "complete_steps",
                    "step_number": 序号,
                }
        for 序号, 实际结果 in 结果列表:
            匹配 = _step_pattern(序号).search(正文)
            assert 匹配 is not None
            标题 = re.sub(r"(?m)^\s+- 实际结果：.*$", "", 匹配.group(3)).rstrip()
            替换 = f"{匹配.group(1)}{完成状态}{标题}\n   - 实际结果：{实际结果}\n"
            正文 = f"{正文[:匹配.start()]}{替换}{正文[匹配.end():]}".strip()
        文档存储.写入(文档路径, 正文)
    return {
        "status": "completed",
        "ability": 能力标识,
        "action": "complete_steps",
        "thread_id": 线程,
        "doc_path": str(文档路径),
        "completed_steps": [序号 for 序号, _ in 结果列表],
        **_state_payload(正文),
    }


def _complete_step(上下文: dict[str, Any]) -> dict[str, Any]:
    """兼容单步骤调用并返回并发稳定后的最新状态。"""

    序号 = 上下文.get("step_number") or 上下文.get("step")
    实际结果 = 上下文.get("result") or 上下文.get("actual_result")
    批量上下文 = {**上下文, "results": {序号: 实际结果}}
    结果 = _complete_steps(批量上下文)
    if 结果.get("status") != "completed":
        return {**结果, "action": "step"}
    线程 = str(结果["thread_id"])
    文档路径 = Path(str(结果["doc_path"]))
    稳定正文 = 文档存储.读取稳定快照(文档路径, _lock_path(线程))
    return {
        **结果,
        "action": "step",
        "step_number": int(序号),
        **_state_payload(稳定正文),
    }


def _ready(上下文: dict[str, Any]) -> dict[str, Any]:
    """核验当前线程已授权且全部执行步骤完成。"""

    状态 = _check(上下文)
    if not 状态.get("exists") or not 状态.get("authorized") or not 状态.get("goal") or not 状态.get("step_count"):
        return {
            **状态,
            "status": "blocked_task_document_not_active",
            "exit_code": 1,
            "action": "ready",
        }
    if not 状态.get("all_completed"):
        return {
            **状态,
            "status": "blocked_task_document_not_ready",
            "exit_code": 1,
            "action": "ready",
        }
    return {**状态, "status": "completed", "action": "ready"}


def _active(上下文: dict[str, Any]) -> dict[str, Any]:
    """核验当前线程存在经过独立授权的真实任务。"""

    状态 = _check(上下文)
    if not 状态.get("exists") or not 状态.get("authorized") or not 状态.get("goal") or not 状态.get("step_count"):
        return {
            **状态,
            "status": "blocked_task_document_not_active",
            "exit_code": 1,
            "action": "active",
        }
    return {**状态, "status": "completed", "action": "active"}


def _finish(上下文: dict[str, Any]) -> dict[str, Any]:
    """在 ready 通过后归档并清空当前执行文档。"""

    就绪 = _ready(上下文)
    if 就绪.get("status") != "completed":
        return 就绪
    线程 = str(就绪["thread_id"])
    文档路径 = _execution_doc_path(线程)
    with 文档存储.加锁(_lock_path(线程)):
        正文 = 文档存储.读取(文档路径)
        历史路径 = _append_history(正文, 线程)
        文档存储.写入(文档路径, "# 本次执行文档\n\n## 总体任务目标\n\n\n\n## 执行步骤")
    return {
        "status": "completed",
        "ability": 能力标识,
        "action": "finish",
        "thread_id": 线程,
        "doc_path": str(文档路径),
        "history_path": str(历史路径),
    }


def execute(context: dict, skills: dict, apps: dict) -> dict:
    """按统一 execute 契约调度执行文档公开动作。"""

    _ = skills, apps
    动作 = _规范文本(context.get("action") or "check").replace("-", "_")
    动作表 = {
        "check": _check,
        "begin": _begin,
        "step": _complete_step,
        "complete_steps": _complete_steps,
        "active": _active,
        "ready": _ready,
        "finish": _finish,
    }
    处理器 = 动作表.get(动作)
    if 处理器 is None:
        return {
            "status": "unknown_action",
            "exit_code": 1,
            "ability": 能力标识,
            "action": 动作,
            "message": "支持 check/begin/step/complete_steps/active/ready/finish。",
        }
    return 处理器(context)
