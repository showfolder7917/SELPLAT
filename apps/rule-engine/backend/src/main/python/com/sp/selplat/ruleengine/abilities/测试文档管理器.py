"""维护当前任务线程的测试清单、批量结果和历史归档。"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
import re
from typing import Any

from com.sp.selplat.ruleengine.util.文档存储 import 文档存储
from com.sp.selplat.ruleengine.util.路径配置 import 加载路径配置


__all__ = ["execute"]

能力标识 = "test_doc_manager"
待测试状态 = "待测试"
通过状态 = "通过"
失败状态 = "失败"
允许结果状态 = {通过状态, 失败状态}
_路径 = 加载路径配置()
OPTION_ROOT = _路径.取得("option_root")
HISTORY_ROOT = _路径.取得("history_root")


def _当前时间() -> datetime:
    """返回带本地时区的当前时间。"""

    return datetime.now().astimezone()


def _规范文本(值: Any) -> str:
    """把外部值转换为去除首尾空白的文本。"""

    return str(值 or "").strip()


def _线程标识(上下文: dict[str, Any]) -> str:
    """从上下文或会话环境解析安全线程标识。"""

    return 文档存储.解析线程标识(上下文)


def _test_doc_path(线程: str) -> Path:
    """返回指定线程的测试文档路径。"""

    return OPTION_ROOT / f"测试文档.{线程}.md"


def _lock_path(线程: str) -> Path:
    """返回指定线程的测试文档锁路径。"""

    return OPTION_ROOT / f"测试文档.{线程}.lock"


def _history_path(线程: str, 当前: datetime | None = None) -> Path:
    """返回指定线程当天的测试历史路径。"""

    时间 = 当前 or _当前时间()
    return HISTORY_ROOT / f"测试文档.history_{时间:%Y-%m-%d}.{线程}.md"


def _item_blocks(正文: str) -> list[re.Match[str]]:
    """返回测试文档中全部测试项正文块。"""

    return list(re.finditer(
        r"(?ms)^(\d+)\. \*\*(待测试|通过|失败)\*\*：(.*?)(?=^\d+\. \*\*(?:待测试|通过|失败)\*\*：|\Z)",
        正文,
    ))


def _item_numbers(正文: str, 状态: str | None = None) -> list[int]:
    """返回全部或指定状态的测试项序号。"""

    return [
        int(匹配.group(1))
        for 匹配 in _item_blocks(正文)
        if 状态 is None or 匹配.group(2) == 状态
    ]


def _state_payload(正文: str) -> dict[str, Any]:
    """从同一正文快照构造统一测试状态。"""

    全部 = _item_numbers(正文)
    待测试 = _item_numbers(正文, 待测试状态)
    失败 = _item_numbers(正文, 失败状态)
    return {
        "exists": bool(正文),
        "item_count": len(全部),
        "pending_items": 待测试,
        "failed_items": 失败,
        "all_completed": bool(全部) and not 待测试 and not 失败,
        "doc_revision": 文档存储.版本(正文),
    }


def _empty_document(线程: str) -> str:
    """生成当前线程的空测试文档。"""

    return "\n".join(["# 本次测试文档", "", f"任务线程：{线程}", "", "## 统一测试清单"])


def _format_item(序号: int, 项目: dict[str, Any]) -> str:
    """把一个完整测试合同格式化为待测试条目。"""

    return "\n".join([
        f"{序号}. **{待测试状态}**：{项目['title']}",
        f"   - 变更内容：{项目['change']}",
        f"   - 测试命令：{项目['command']}",
        f"   - 预期结果：{项目['expected']}",
    ])


def _normalize_items(上下文: dict[str, Any]) -> list[dict[str, str]]:
    """提取同时包含标题、变更、命令和预期的测试项。"""

    原始项目 = 上下文.get("items")
    if 原始项目 is None:
        原始项目 = [上下文]
    if not isinstance(原始项目, list):
        return []
    结果: list[dict[str, str]] = []
    for 项目 in 原始项目:
        if not isinstance(项目, dict):
            continue
        标题 = _规范文本(项目.get("title") or 项目.get("content") or 项目.get("test"))
        变更 = _规范文本(项目.get("change") or 项目.get("reason"))
        命令 = _规范文本(项目.get("command"))
        预期 = _规范文本(项目.get("expected") or 项目.get("expected_result"))
        if 标题 and 变更 and 命令 and 预期:
            结果.append({"title": 标题, "change": 变更, "command": 命令, "expected": 预期})
    return 结果


def _check(上下文: dict[str, Any]) -> dict[str, Any]:
    """读取当前线程测试文档并返回完整状态。"""

    线程 = _线程标识(上下文)
    文档路径 = _test_doc_path(线程)
    正文 = 文档存储.读取(文档路径)
    return {
        "status": "completed",
        "ability": 能力标识,
        "action": "check",
        "thread_id": 线程,
        "doc_path": str(文档路径),
        **_state_payload(正文),
    }


def _record(上下文: dict[str, Any]) -> dict[str, Any]:
    """一次登记一个或多个完整测试合同并自动去重。"""

    项目列表 = _normalize_items(上下文)
    if not 项目列表:
        return {
            "status": "blocked_invalid_test_items",
            "exit_code": 1,
            "ability": 能力标识,
            "action": "record",
            "message": "每项必须包含 title、change、command 和 expected。",
        }
    线程 = _线程标识(上下文)
    文档路径 = _test_doc_path(线程)
    新增序号: list[int] = []
    with 文档存储.加锁(_lock_path(线程)):
        正文 = 文档存储.读取(文档路径) or _empty_document(线程)
        已有键 = {
            (
                _规范文本(匹配.group(3).splitlines()[0]),
                _规范文本(命令匹配.group(1)) if (命令匹配 := re.search(r"(?m)^\s+- 测试命令：(.*)$", 匹配.group(3))) else "",
            )
            for 匹配 in _item_blocks(正文)
            if 匹配.group(2) == 待测试状态
        }
        下一序号 = max(_item_numbers(正文), default=0) + 1
        新增块: list[str] = []
        for 项目 in 项目列表:
            键 = (项目["title"], 项目["command"])
            if 键 in 已有键:
                continue
            新增块.append(_format_item(下一序号, 项目))
            新增序号.append(下一序号)
            已有键.add(键)
            下一序号 += 1
        if 新增块:
            正文 = f"{正文.rstrip()}\n\n" + "\n\n".join(新增块)
            文档存储.写入(文档路径, 正文)
    return {
        "status": "completed",
        "ability": 能力标识,
        "action": "record",
        "thread_id": 线程,
        "doc_path": str(文档路径),
        "added_items": 新增序号,
        **_state_payload(正文),
    }


def _normalize_status(状态: Any) -> str:
    """把英文兼容状态转换为中文正式状态。"""

    原始状态 = _规范文本(状态)
    return {
        "passed": 通过状态,
        "pass": 通过状态,
        "failed": 失败状态,
        "fail": 失败状态,
    }.get(原始状态.lower(), 原始状态)


def _normalize_test_results(上下文: dict[str, Any]) -> list[tuple[int, str, str]]:
    """把批量测试结果转换为有序且去重的序号、状态和实际结果。"""

    原始结果 = 上下文.get("results")
    if not isinstance(原始结果, (dict, list)):
        return []
    if isinstance(原始结果, dict):
        候选项 = []
        for 序号, 值 in 原始结果.items():
            if isinstance(值, dict):
                候选项.append((序号, 值.get("status") or 值.get("test_status"), 值.get("result") or 值.get("actual_result")))
            else:
                候选项.append((序号, 通过状态, 值))
    else:
        候选项 = [
            (
                项目.get("item_number") or 项目.get("item"),
                项目.get("status") or 项目.get("test_status"),
                项目.get("result") or 项目.get("actual_result"),
            )
            for 项目 in 原始结果
            if isinstance(项目, dict)
        ]
    结果列表: list[tuple[int, str, str]] = []
    已见序号: set[int] = set()
    for 原始序号, 原始状态, 原始正文 in 候选项:
        try:
            序号 = int(原始序号)
        except (TypeError, ValueError):
            return []
        状态 = _normalize_status(原始状态)
        正文 = _规范文本(原始正文)
        if 序号 <= 0 or 状态 not in 允许结果状态 or not 正文 or 序号 in 已见序号:
            return []
        已见序号.add(序号)
        结果列表.append((序号, 状态, 正文))
    return 结果列表


def _complete_tests(上下文: dict[str, Any]) -> dict[str, Any]:
    """在一次文件锁和一次写入中回写多个测试结果。"""

    结果列表 = _normalize_test_results(上下文)
    if not 结果列表:
        return {
            "status": "blocked_invalid_test_results",
            "exit_code": 1,
            "ability": 能力标识,
            "action": "complete_tests",
            "message": "results 必须包含有效且不重复的测试序号、状态和实际结果。",
        }
    线程 = _线程标识(上下文)
    文档路径 = _test_doc_path(线程)
    with 文档存储.加锁(_lock_path(线程)):
        正文 = 文档存储.读取(文档路径)
        for 序号, _, _ in 结果列表:
            表达式 = re.compile(
                rf"(?ms)^({序号}\. )\*\*(待测试|通过|失败)\*\*：(.*?)(?=^\d+\. \*\*(?:待测试|通过|失败)\*\*：|\Z)"
            )
            if not 表达式.search(正文):
                return {
                    "status": "test_item_not_found",
                    "exit_code": 1,
                    "ability": 能力标识,
                    "action": "complete_tests",
                    "item_number": 序号,
                }
        for 序号, 状态, 实际结果 in 结果列表:
            表达式 = re.compile(
                rf"(?ms)^({序号}\. )\*\*(待测试|通过|失败)\*\*：(.*?)(?=^\d+\. \*\*(?:待测试|通过|失败)\*\*：|\Z)"
            )
            匹配 = 表达式.search(正文)
            assert 匹配 is not None
            主体 = re.sub(r"(?m)^\s+- 实际结果：.*\n?", "", 匹配.group(3)).rstrip()
            替换 = f"{匹配.group(1)}**{状态}**：{主体}\n   - 实际结果：{实际结果}\n"
            正文 = f"{正文[:匹配.start()]}{替换}{正文[匹配.end():]}".strip()
        文档存储.写入(文档路径, 正文)
    return {
        "status": "completed",
        "ability": 能力标识,
        "action": "complete_tests",
        "thread_id": 线程,
        "doc_path": str(文档路径),
        "completed_items": [序号 for 序号, _, _ in 结果列表],
        **_state_payload(正文),
    }


def _record_result(上下文: dict[str, Any]) -> dict[str, Any]:
    """兼容单个测试结果回写并复用批量实现。"""

    序号 = 上下文.get("item_number") or 上下文.get("item")
    批量上下文 = {
        **上下文,
        "results": {
            序号: {
                "status": 上下文.get("status") or 上下文.get("test_status"),
                "result": 上下文.get("result") or 上下文.get("actual_result"),
            }
        },
    }
    结果 = _complete_tests(批量上下文)
    return {**结果, "action": "result", "item_number": int(序号 or 0)}


def _pending(上下文: dict[str, Any]) -> dict[str, Any]:
    """确认当前线程至少登记一个待统一测试项。"""

    状态 = _check(上下文)
    if not 状态.get("pending_items"):
        return {
            **状态,
            "status": "blocked_test_document_has_no_pending_items",
            "exit_code": 1,
            "action": "pending",
        }
    return {**状态, "status": "completed", "action": "pending"}


def _ready(上下文: dict[str, Any]) -> dict[str, Any]:
    """确认当前测试文档不存在待测试或失败项。"""

    状态 = _check(上下文)
    if not 状态.get("all_completed"):
        return {
            **状态,
            "status": "blocked_test_document_not_ready",
            "exit_code": 1,
            "action": "ready",
        }
    return {**状态, "status": "completed", "action": "ready"}


def _finish(上下文: dict[str, Any]) -> dict[str, Any]:
    """在 ready 通过后归档并清空当前测试文档。"""

    就绪 = _ready(上下文)
    if 就绪.get("status") != "completed":
        return 就绪
    线程 = str(就绪["thread_id"])
    文档路径 = _test_doc_path(线程)
    with 文档存储.加锁(_lock_path(线程)):
        正文 = 文档存储.读取(文档路径)
        时间 = _当前时间()
        历史路径 = _history_path(线程, 时间)
        历史路径.parent.mkdir(parents=True, exist_ok=True)
        分隔 = "\n\n" if 历史路径.exists() and 历史路径.stat().st_size else ""
        with 历史路径.open("a", encoding="utf-8") as 文件:
            文件.write(f"{分隔}**统一测试时间：{时间:%Y-%m-%d %H:%M:%S %Z}**\n\n{正文}\n")
        文档存储.写入(文档路径, _empty_document(线程))
    return {
        "status": "completed",
        "ability": 能力标识,
        "action": "finish",
        "thread_id": 线程,
        "doc_path": str(文档路径),
        "history_path": str(历史路径),
    }


def execute(context: dict, skills: dict, apps: dict) -> dict:
    """按统一 execute 契约调度测试文档公开动作。"""

    _ = skills, apps
    动作 = _规范文本(context.get("action") or "check").replace("-", "_")
    动作表 = {
        "check": _check,
        "record": _record,
        "result": _record_result,
        "complete_tests": _complete_tests,
        "pending": _pending,
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
            "message": "支持 check/record/result/complete_tests/pending/ready/finish。",
        }
    return 处理器(context)
