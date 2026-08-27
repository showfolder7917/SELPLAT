"""记录独立 3 之前最新一轮问答，并生成同轮执行授权回执。"""

from __future__ import annotations

import hashlib
import os
from pathlib import Path
import re
from typing import Any

from ruleengine.util.文档存储 import 文档存储
from ruleengine.util.路径配置 import 加载路径配置


__all__ = ["execute", "验证记录回执"]

能力标识 = "session_turn_recorder"
允许角色 = {
    "需求",
    "架构",
    "详细设计",
    "代码",
    "测试",
    "验收交付",
    "运行运维",
    "规则治理",
}
用户格式 = re.compile(r"[A-Za-z][A-Za-z0-9_-]{0,63}")
线程格式 = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*")
用户声明格式 = re.compile(r"(?m)^- 当前稳定用户 ID：`([^`]+)`\s*$")
记录行格式 = re.compile(r"^(\d+)([QA])｜([^｜]+)｜(.*)$")
回执格式 = re.compile(r"^session-turn-v1:([A-Za-z0-9][A-Za-z0-9._-]*):(\d+):([0-9a-f]{64})$")

_路径 = 加载路径配置()
资源根 = _路径.取得("resource_root")
身份文件 = _路径.取得("agents_file")


def _当前稳定用户() -> str:
    """从工程根 AGENTS.md 读取唯一稳定用户，禁止根据目录猜测。"""

    匹配列表 = 用户声明格式.findall(身份文件.read_text(encoding="utf-8"))
    if len(匹配列表) != 1:
        raise ValueError("AGENTS.md 必须且只能声明一个当前稳定用户 ID。")
    用户 = 匹配列表[0].strip()
    if not 用户格式.fullmatch(用户):
        raise ValueError("当前稳定用户 ID 不符合安全格式。")
    return 用户


def _线程标识(context: dict[str, Any]) -> str:
    """从调用上下文或 Codex 环境取得安全线程 ID。"""

    线程 = str(context.get("thread_id") or os.environ.get("CODEX_THREAD_ID") or "").strip()
    if not 线程格式.fullmatch(线程):
        raise ValueError("缺少安全的 CURRENT_THREAD_ID。")
    return 线程


def _压平原文(正文: Any) -> str:
    """只把控制换行压成空格，保留其余可见原文且不截断。"""

    return re.sub(r"[\r\n\t\f\v]+", " ", str(正文 or "")).strip()


def _会话路径(用户: str, 线程: str) -> Path:
    """在动态当前用户层生成一会话一文档的安全路径。"""

    用户根 = (资源根 / "local" / 用户).resolve()
    会话路径 = (用户根 / "会话" / f"会话_{线程}.md").resolve()
    if 用户根 not in 会话路径.parents:
        raise ValueError("会话记录路径越出当前用户层。")
    return 会话路径


def _解析记录行(正文: str) -> list[tuple[int, str, str, str]]:
    """校验现有文档始终由顺序一致的 Q/A 两行组成。"""

    行列表 = 正文.splitlines() if 正文 else []
    if len(行列表) % 2:
        raise ValueError("会话文档不是完整的 Q/A 两行结构。")
    结果: list[tuple[int, str, str, str]] = []
    for 位置, 行 in enumerate(行列表):
        匹配 = 记录行格式.fullmatch(行)
        if 匹配 is None:
            raise ValueError(f"会话文档包含非法记录行：{位置 + 1}")
        序号 = int(匹配.group(1))
        方向 = 匹配.group(2)
        角色 = 匹配.group(3)
        原文 = 匹配.group(4)
        预期序号 = 位置 // 2 + 1
        预期方向 = "Q" if 位置 % 2 == 0 else "A"
        if 序号 != 预期序号 or 方向 != 预期方向 or 角色 not in 允许角色:
            raise ValueError(f"会话文档顺序或角色非法：{位置 + 1}")
        结果.append((序号, 方向, 角色, 原文))
    return 结果


def _回执(线程: str, 序号: int, 角色: str, 问题: str, 回答: str) -> str:
    """为已落盘的最新问答生成可复核授权回执。"""

    摘要原文 = f"{线程}\n{序号}\n{角色}\n{问题}\n{回答}"
    摘要 = hashlib.sha256(摘要原文.encode("utf-8")).hexdigest()
    return f"session-turn-v1:{线程}:{序号}:{摘要}"


def 验证记录回执(线程: str, 回执: str) -> bool:
    """确认回执对应当前线程会话文档最后一轮完整问答。"""

    匹配 = 回执格式.fullmatch(str(回执 or "").strip())
    if 匹配 is None or 匹配.group(1) != 线程:
        return False
    try:
        用户 = _当前稳定用户()
        文档路径 = _会话路径(用户, 线程)
        记录 = _解析记录行(文档存储.读取(文档路径))
    except (OSError, ValueError):
        return False
    if len(记录) < 2:
        return False
    问题行, 回答行 = 记录[-2], 记录[-1]
    序号 = int(匹配.group(2))
    if 问题行[0] != 序号 or 回答行[0] != 序号 or 问题行[2] != 回答行[2]:
        return False
    return 回执 == _回执(线程, 序号, 问题行[2], 问题行[3], 回答行[3])


def _记录最新问答(context: dict[str, Any]) -> dict[str, Any]:
    """原子追加最新问答；重复的最后一轮既不写入也不授权重跑。"""

    if str(context.get("command") or "").strip() != "3":
        raise ValueError("只有独立 3 可以触发会话记录与执行授权。")
    角色 = str(context.get("role") or "").strip()
    if 角色 not in 允许角色:
        raise ValueError("role 必须是已登记的八类工程角色之一。")
    问题 = _压平原文(context.get("question"))
    回答 = _压平原文(context.get("answer"))
    if not 问题 or not 回答:
        raise ValueError("最新一轮必须同时包含可见问题和可见回答。")
    线程 = _线程标识(context)
    用户 = _当前稳定用户()
    文档路径 = _会话路径(用户, 线程)
    锁路径 = 文档路径.with_name(f".{文档路径.name}.lock")
    with 文档存储.加锁(锁路径):
        正文 = 文档存储.读取(文档路径)
        记录 = _解析记录行(正文)
        if len(记录) >= 2:
            末问题, 末回答 = 记录[-2], 记录[-1]
            if (末问题[2], 末问题[3], 末回答[3]) == (角色, 问题, 回答):
                return {
                    "status": "completed",
                    "ability": 能力标识,
                    "recorded": False,
                    "duplicate": True,
                    "execution_authorized": False,
                    "should_execute": False,
                    "record_path": str(文档路径),
                    "sequence": 末问题[0],
                    "message": "最新一轮问答已经记录，不重复写入或执行。",
                }
        序号 = len(记录) // 2 + 1
        新增正文 = f"{序号:04d}Q｜{角色}｜{问题}\n{序号:04d}A｜{角色}｜{回答}"
        完整正文 = f"{正文.rstrip()}\n{新增正文}" if 正文 else 新增正文
        文档存储.写入(文档路径, 完整正文)
        回执 = _回执(线程, 序号, 角色, 问题, 回答)
    return {
        "status": "completed",
        "ability": 能力标识,
        "recorded": True,
        "duplicate": False,
        "execution_authorized": True,
        "should_execute": True,
        "authorization_scope": "latest_recorded_turn_only",
        "authorization_receipt": 回执,
        "record_path": str(文档路径),
        "sequence": 序号,
        "role": 角色,
    }


def execute(context: dict, skills: dict, apps: dict) -> dict:
    """执行最新问答记录并返回是否允许继续执行该轮明确任务。"""

    _ = skills, apps
    action = str(context.get("action") or "record_latest_turn").strip().replace("-", "_")
    try:
        if action != "record_latest_turn":
            raise ValueError(f"不支持的 action：{action}")
        return _记录最新问答(context)
    except (OSError, ValueError) as error:
        return {
            "status": "blocked",
            "exit_code": 1,
            "ability": 能力标识,
            "recorded": False,
            "execution_authorized": False,
            "should_execute": False,
            "message": str(error),
        }
