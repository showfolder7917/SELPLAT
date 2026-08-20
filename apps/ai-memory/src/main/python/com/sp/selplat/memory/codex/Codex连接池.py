"""按 run_id 独占分配本地 Codex 逻辑连接。"""

from queue import Empty, Queue
from threading import Lock
import uuid

from ..model.接口模型 import AgentConnection, AgentRegistration


class CodexConnectionPool:
    def __init__(self, maximum: int, pool_type: str = "PERSISTENT") -> None:
        if maximum < 1:
            raise ValueError("连接池容量至少为 1")
        if pool_type not in {"PERSISTENT", "DISPOSABLE"}:
            raise ValueError("连接池类型必须是 PERSISTENT 或 DISPOSABLE")
        self.pool_type = pool_type
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
        return AgentConnection(connection_id, registration.endpoint, run_id, self.pool_type)

    def release(self, connection: AgentConnection, reusable: bool = True) -> None:
        with self._lock:
            owner = self._active.pop(connection.connection_id, None)
        if owner != connection.run_id:
            raise RuntimeError("连接所有者与 run_id 不一致")
        # 常驻池只在进程正常退出时复用原连接；临时池和异常连接都补充全新连接 ID。
        next_connection_id = connection.connection_id \
            if self.pool_type == "PERSISTENT" and reusable else str(uuid.uuid4())
        self._permits.put(next_connection_id)


class CodexConnectionPools:
    def __init__(self, persistent_maximum: int, disposable_maximum: int) -> None:
        self._pools = {
            "PERSISTENT": CodexConnectionPool(persistent_maximum, "PERSISTENT"),
            "DISPOSABLE": CodexConnectionPool(disposable_maximum, "DISPOSABLE"),
        }

    def acquire(self, registration: AgentRegistration, run_id: str,
                timeout: float = 30) -> AgentConnection:
        pool_type = registration.codex_pool_type
        if pool_type not in self._pools:
            raise ValueError("角色未登记有效的 Codex 连接池类型")
        return self._pools[pool_type].acquire(registration, run_id, timeout)

    def release(self, connection: AgentConnection, reusable: bool = True) -> None:
        pool = self._pools.get(connection.pool_type)
        if pool is None:
            raise ValueError("连接不属于已登记的 Codex 连接池")
        pool.release(connection, reusable)
