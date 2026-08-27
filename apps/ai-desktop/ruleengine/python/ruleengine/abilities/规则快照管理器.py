"""缓存同线程规则加载结果，并在相关资源变化时自动失效。"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from ruleengine.util.路径配置 import 加载路径配置
from local.core.abilities import layered_rule_loader


__all__ = ["execute"]
能力标识 = "rule_snapshot_manager"
_路径 = 加载路径配置()
_缓存根 = _路径.取得("rule_snapshot_cache")


def _线程标识(context: dict[str, Any]) -> str:
    """校验调用方提供的稳定线程标识。"""

    return hashlib.sha256(str(context.get("thread_id") or "default").encode()).hexdigest()[:32]


def _资源版本() -> str:
    """用规则索引、规则正文和身份文件的修改信息生成失效版本。"""

    根 = _路径.取得("resource_root")
    文件 = [_路径.取得("agents_file"), *根.rglob("*.md")]
    状态 = "\n".join(
        f"{路径.relative_to(_路径.工程根)}:{路径.stat().st_mtime_ns}:{路径.stat().st_size}"
        for 路径 in sorted(set(文件)) if 路径.is_file()
    )
    return hashlib.sha256(状态.encode()).hexdigest()


def execute(context: dict, skills: dict, apps: dict) -> dict:
    """返回有效快照；未命中时调用已登记分层加载器并保存精简结果。"""

    _ = apps
    加载器 = skills.get("layered_rule_loader", layered_rule_loader)
    版本 = _资源版本()
    请求 = {键: context.get(键) for 键 in ("logical_ids", "active_scope", "active_user")}
    请求键 = hashlib.sha256(json.dumps(请求, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    快照路径 = _缓存根 / f"{_线程标识(context)}.{请求键}.json"
    if 快照路径.is_file():
        快照 = json.loads(快照路径.read_text(encoding="utf-8"))
        if 快照.get("resource_revision") == 版本:
            return {**快照, "status": "completed", "cache": "hit", "ability": 能力标识}
    加载结果 = 加载器.execute({"action": "load_bundle", **请求}, {}, {})
    if 加载结果.get("status") != "completed":
        return 加载结果
    规则 = 加载结果["result"]["rules"]
    精简规则 = {键: {"effective_values": 值["effective_values"], "receipt": [层["resource_path"] for 层 in 值["layers"]]} for 键, 值 in 规则.items()}
    快照 = {"resource_revision": 版本, "rules": 精简规则, "receipt": 加载结果["result"]["receipt"]}
    快照路径.parent.mkdir(parents=True, exist_ok=True)
    快照路径.write_text(json.dumps(快照, ensure_ascii=False, indent=2), encoding="utf-8")
    return {**快照, "status": "completed", "cache": "miss", "ability": 能力标识}
