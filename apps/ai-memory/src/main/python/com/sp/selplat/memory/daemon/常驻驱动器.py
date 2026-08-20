"""监听服务端就绪事件并从本地驱动角色 Agent。"""

from threading import Event

from ..agent.智能体启动器 import AgentLauncher
from ..audit.审计日志记录器 import AuditLogger
from ..codex.Codex连接池 import CodexConnectionPools
from ..sync.AI工厂客户端 import AiFactoryClient
from ..sync.待上报队列存储 import OutboxStore
from ..workspace.工作空间管理器 import WorkspaceManager


class MemoryDaemon:
    def __init__(self, client: AiFactoryClient, workspace: WorkspaceManager,
                 pool: CodexConnectionPools, launcher: AgentLauncher, outbox: OutboxStore,
                 poll_interval: float) -> None:
        self.client = client
        self.workspace = workspace
        self.pool = pool
        self.launcher = launcher
        self.outbox = outbox
        self.poll_interval = poll_interval
        self.cursor = 0

    def run_once(self) -> int:
        processed = 0
        for event in self.client.ready_events(self.cursor):
            self._dispatch(event.task_id, event.stage_id, event.payload.get("instruction", "执行当前阶段"))
            self.cursor = max(self.cursor, event.sequence)
            processed += 1
        return processed

    def serve(self, stop_event: Event) -> None:
        self.workspace.prepare_runtime()
        while not stop_event.is_set():
            self.run_once()
            stop_event.wait(self.poll_interval)

    def _dispatch(self, task_id: str, stage_id: str, instruction: str) -> None:
        task = self.workspace.create(task_id)
        audit = AuditLogger(task.task_root)
        role = self.client.get_stage_role(stage_id)
        registration = self.client.resolve_agent(role)
        lease = self.client.claim_stage(stage_id)
        connection = self.pool.acquire(registration, lease.run_id)
        process = None
        reusable = False
        try:
            handle, process = self.launcher.start(registration, connection, task.task_root, instruction)
            audit.append("AGENT_STARTED", {"runId": lease.run_id, "roleId": role.role_id,
                                           "agentId": registration.agent_id, "sessionId": handle.session_id})
            self._report_state(lease, task_id, registration.agent_id, "STARTED", 1)
            exit_code = process.wait()
            self._report_state(lease, task_id, registration.agent_id, "STOPPED", 2)
            try:
                self.client.complete_stage(lease, exit_code, [])
            except ConnectionError:
                self.outbox.append(task_id, "stage.complete",
                                   {"runId": lease.run_id, "exitCode": exit_code,
                                    "artifactDigests": []}, f"{lease.run_id}:complete")
            audit.append("AGENT_STOPPED", {"runId": lease.run_id, "exitCode": exit_code})
            reusable = exit_code == 0
        finally:
            if process is not None and process.poll() is None:
                process.terminate()
            self.pool.release(connection, reusable=reusable)

    def _report_state(self, lease, task_id: str, agent_id: str,
                      state: str, sequence: int) -> None:
        payload = {"runId": lease.run_id, "agentId": agent_id,
                   "state": state, "sequence": sequence}
        try:
            self.client.report_agent_state(lease, agent_id, state, sequence)
        except ConnectionError:
            self.outbox.append(task_id, "agent.state", payload,
                               f"{lease.run_id}:agent-state:{sequence}")
