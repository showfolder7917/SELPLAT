"""统一检查并归档当前线程的执行文档和测试文档。"""

from __future__ import annotations

from typing import Any

from com.sp.selplat.ruleengine.abilities import 执行文档管理器, 测试文档管理器
from com.sp.selplat.ruleengine.util.文档存储 import 文档存储
from com.sp.selplat.ruleengine.util.路径配置 import 加载路径配置


__all__ = ["execute"]

能力标识 = "task_lifecycle_manager"
_路径 = 加载路径配置()
OPTION_ROOT = _路径.取得("option_root")


def _finish_all(上下文: dict[str, Any]) -> dict[str, Any]:
    """在两份文档均就绪后通过一次能力调用完成统一归档。"""

    执行就绪 = 执行文档管理器.execute({**上下文, "action": "ready"}, {}, {})
    if 执行就绪.get("status") != "completed":
        return {
            "status": "blocked_execution_document_not_ready",
            "exit_code": 1,
            "ability": 能力标识,
            "action": "finish_all",
            "execution": 执行就绪,
        }
    测试就绪 = 测试文档管理器.execute({**上下文, "action": "ready"}, {}, {})
    if 测试就绪.get("status") != "completed":
        return {
            "status": "blocked_test_document_not_ready",
            "exit_code": 1,
            "ability": 能力标识,
            "action": "finish_all",
            "execution": 执行就绪,
            "tests": 测试就绪,
        }
    线程 = 文档存储.解析线程标识(上下文)
    生命周期锁 = OPTION_ROOT / f"任务生命周期.{线程}.lock"
    with 文档存储.加锁(生命周期锁):
        执行归档 = 执行文档管理器.execute({**上下文, "action": "finish"}, {}, {})
        测试归档 = 测试文档管理器.execute({**上下文, "action": "finish"}, {}, {})
    if 执行归档.get("status") != "completed" or 测试归档.get("status") != "completed":
        return {
            "status": "partial_archive_failure",
            "exit_code": 1,
            "ability": 能力标识,
            "action": "finish_all",
            "execution": 执行归档,
            "tests": 测试归档,
        }
    return {
        "status": "completed",
        "ability": 能力标识,
        "action": "finish_all",
        "thread_id": 线程,
        "execution_history_path": 执行归档["history_path"],
        "test_history_path": 测试归档["history_path"],
    }


def execute(context: dict, skills: dict, apps: dict) -> dict:
    """按统一 execute 契约开放 finish_all。"""

    _ = skills, apps
    动作 = str(context.get("action") or "finish_all").strip().replace("-", "_")
    if 动作 == "finish_all":
        return _finish_all(context)
    return {
        "status": "unknown_action",
        "exit_code": 1,
        "ability": 能力标识,
        "action": 动作,
        "message": "仅支持 finish_all。",
    }

