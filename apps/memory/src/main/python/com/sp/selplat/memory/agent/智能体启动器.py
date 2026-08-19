"""通过登记的逻辑地址启动本地角色 Agent。"""

from datetime import datetime, timezone
import json
import subprocess
from pathlib import Path

from ..model.接口模型 import AgentConnection, AgentHandle, AgentRegistration


class AgentLauncher:
    def __init__(self, codex_command: str) -> None:
        self.codex_command = codex_command

    def start(self, registration: AgentRegistration, connection: AgentConnection,
              task_root: Path, instruction: str) -> tuple[AgentHandle, subprocess.Popen[str]]:
        """启动 Codex；上下文经 stdin 传递，不把短期授权写入命令行或日志。"""
        context = json.dumps({"agentId": registration.agent_id, "runId": connection.run_id,
                              "taskRoot": str(task_root), "instruction": instruction}, ensure_ascii=False)
        process = subprocess.Popen([self.codex_command, "exec", "-"], stdin=subprocess.PIPE,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                                   cwd=task_root)
        assert process.stdin is not None
        process.stdin.write(context)
        process.stdin.close()
        handle = AgentHandle(registration.agent_id, connection.run_id, connection.connection_id,
                             process.pid, datetime.now(timezone.utc).isoformat())
        return handle, process
