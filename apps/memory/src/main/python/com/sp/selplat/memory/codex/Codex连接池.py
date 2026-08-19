"""按 run_id 独占分配本地 Codex 逻辑连接。"""

from queue import Empty, Queue
from threading import Lock
import uuid

from ..model.接口模型 import AgentConnection, AgentRegistration


class CodexConnectionPool:
    def __init__(self, maximum: int) -> None:
        if maximum < 1:
            raise ValueError("连接池容量至少为 1")
        self._permits: Queue[str] = Queue(maximum)
        for _ in range(maximum):
            self._permits.put(str(uuid.uuid4()))
        self._active: dict[str, str] = {}
        self._lock = Lock()

    def acquire(self, registration: AgentRegistration, run_id: str, timeout: float = 30) -> AgentConnection:
        if registration.endpoint_type != "LOCAL_CODEX" or not registration.endpoint.startswith("codex://"):
            raise ValueError("本地连接池只接受 codex:// LOCAL_CODEX 登记")
        try:
            connection_id = self._permits.get(timeout=timeout)
        except Empty as error:
            raise TimeoutError("Codex 连接池已满") from error
        with self._lock:
            self._active[connection_id] = run_id
        return AgentConnection(connection_id, registration.endpoint, run_id)

    def release(self, connection: AgentConnection, reusable: bool = True) -> None:
        with self._lock:
            owner = self._active.pop(connection.connection_id, None)
        if owner != connection.run_id:
            raise RuntimeError("连接所有者与 run_id 不一致")
        if reusable:
            self._permits.put(connection.connection_id)
