"""H2 数据库查询台交付能力。

功能：
启动 H2 数据库查询台本地后端，必要时自动打开浏览器。

作用：
把 H2 查询台纳入 ability/app 体系，统一通过能力入口启动，而不是直接手工执行脚本。

适用场景：
- 启动本地数据库查询服务
- 为 Vue 查询界面提供后端接口
- 在需要时复用默认数据库配置启动调试
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
from typing import Any


ABILITY_ID = "h2_query_workbench_delivery"
ABILITY_NAME = "H2 数据库查询台交付"
ABILITY_DESC = "启动 H2 数据库查询台本地后端，并按需打开浏览器。"
REQUIRED_SKILLS: list[str] = []
REQUIRED_APPS = ["h2_query_workbench"]


def run(context: dict) -> dict:
    """返回能力声明。"""

    return {
        "ability": ABILITY_ID,
        "required_skills": REQUIRED_SKILLS,
        "required_apps": REQUIRED_APPS,
        "context": context,
    }


def execute(context: dict, skills: dict, apps: dict) -> dict:
    """启动查询台后端。"""

    app_config = apps[REQUIRED_APPS[0]]
    python_bin = app_config.get("python_candidates", ["python3"])[0]
    app_path = Path(app_config["path"]).resolve()
    launch_context = {
        "port": int(context.get("port", 8776) or 8776),
        "open_browser": bool(context.get("open_browser", True)),
        "database_path": str(
            context.get(
                "database_path",
                "/Users/showfolder/Documents/workSpace/SELFCOMMON/SELFSPH2.mv.db",
            )
        ).strip(),
    }
    with open(os.devnull, "r", encoding="utf-8") as devnull_read:
        with open(os.devnull, "a", encoding="utf-8") as devnull_write:
            process = subprocess.Popen(
                [python_bin, str(app_path), json.dumps(launch_context, ensure_ascii=False)],
                stdin=devnull_read,
                stdout=devnull_write,
                stderr=devnull_write,
                start_new_session=True,
                close_fds=True,
            )
    return {
        "status": "launched_app",
        "ability": ABILITY_ID,
        "app": REQUIRED_APPS[0],
        "pid": process.pid,
        "launch_context": launch_context,
    }
