"""本地驱动与服务端之间使用的不可变业务事实。"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class MemoryConfig:
    project_root: Path
    runtime_root: Path
    sqlite_path: Path
    base_url: str
    api_version: str
    client_id: str
    request_timeout_seconds: int
    poll_interval_seconds: float
    max_connections: int
    codex_command: str


@dataclass(frozen=True)
class TaskEvent:
    sequence: int
    event_type: str
    task_id: str
    stage_id: str
    payload: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class RoleSnapshot:
    role_id: str
    version: str
    digest: str
    permissions: tuple[str, ...]


@dataclass(frozen=True)
class AgentRegistration:
    agent_id: str
    version: str
    endpoint_type: str
    endpoint: str
    protocol_version: str
    capabilities: tuple[str, ...]
    digest: str
    short_lived_grant: str = ""


@dataclass(frozen=True)
class StageLease:
    run_id: str
    stage_id: str
    lease_token: str
    expires_at: str
    state_version: int


@dataclass(frozen=True)
class AgentConnection:
    connection_id: str
    endpoint: str
    run_id: str


@dataclass(frozen=True)
class AgentHandle:
    agent_id: str
    run_id: str
    session_id: str
    process_id: int | None
    started_at: str


@dataclass(frozen=True)
class GateEvidence:
    gate_id: str
    result: str
    violations: tuple[str, ...]
    digest: str
