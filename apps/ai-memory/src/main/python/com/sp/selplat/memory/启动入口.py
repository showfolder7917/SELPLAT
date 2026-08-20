"""memory 本地常驻驱动命令入口。"""

import argparse
import json
from pathlib import Path
from threading import Event

from .agent.智能体启动器 import AgentLauncher
from .codex.Codex连接池 import CodexConnectionPools
from .daemon.常驻驱动器 import MemoryDaemon
from .sync.AI工厂客户端 import AiFactoryClient
from .sync.HTTP客户端 import HttpClient
from .sync.待上报队列存储 import OutboxStore
from .workspace.工作空间管理器 import WorkspaceManager
from .配置 import load_config


def build_daemon(config_path: Path | None = None) -> MemoryDaemon:
    config = load_config(config_path)
    http = HttpClient(config.base_url, config.client_id, config.request_timeout_seconds)
    return MemoryDaemon(AiFactoryClient(http), WorkspaceManager(config.runtime_root),
                        CodexConnectionPools(config.persistent_max_connections,
                                             config.disposable_max_connections),
                        AgentLauncher(config.codex_command),
                        OutboxStore(config.sqlite_path),
                        config.poll_interval_seconds)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="SELPLAT 本地 AI 工厂驱动")
    parser.add_argument("command", choices=("daemon", "once", "create"))
    parser.add_argument("--config", type=Path)
    parser.add_argument("--title")
    parser.add_argument("--project", default="SELPLAT")
    arguments = parser.parse_args(argv)
    daemon = build_daemon(arguments.config)
    if arguments.command == "create":
        if not arguments.title:
            parser.error("create 需要 --title")
        print(json.dumps(daemon.client.create_task(arguments.title, arguments.project), ensure_ascii=False))
        return 0
    if arguments.command == "once":
        daemon.workspace.prepare_runtime()
        daemon.run_once()
        return 0
    try:
        daemon.serve(Event())
    except KeyboardInterrupt:
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
