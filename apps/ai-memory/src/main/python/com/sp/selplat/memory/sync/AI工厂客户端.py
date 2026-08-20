"""ai-factory v1 控制面客户端；所有工作流写操作由本类从 Python 发起。"""

from typing import Any

from ..model.接口模型 import AgentRegistration, RoleSnapshot, StageLease, TaskEvent
from .HTTP客户端 import HttpClient


class AiFactoryClient:
    def __init__(self, http: HttpClient) -> None:
        self.http = http

    def ready_events(self, cursor: int) -> tuple[TaskEvent, ...]:
        result = self.http.request("GET", f"/api/v1/ai-factory/progress/ready?cursor={cursor}")
        self._require_success(result.status, result.json_body)
        records = result.json_body.get("data", [])
        return tuple(TaskEvent(int(item["sequence"]), str(item["eventType"]), str(item["taskId"]),
                               str(item["stageId"]), dict(item.get("payload", {}))) for item in records)

    def create_task(self, title: str, project: str) -> dict[str, Any]:
        """由本地 Python 调 HTTP 创建任务，不直接生成服务端状态。"""
        return self._post_data("/api/v1/ai-factory/tasks", {
            "title": title, "project": project, "clientId": self.http.client_id,
        })

    def get_stage_role(self, stage_id: str) -> RoleSnapshot:
        data = self._post_data("/api/v1/ai-factory/roles/stage.htm", {"stageId": stage_id})
        return RoleSnapshot(str(data["roleId"]), str(data["version"]), str(data["digest"]),
                            tuple(data.get("permissions", [])))

    def resolve_agent(self, role: RoleSnapshot) -> AgentRegistration:
        data = self._post_data("/api/v1/ai-factory/agents/resolve.htm",
                               {"roleId": role.role_id, "roleVersion": role.version})
        return AgentRegistration(str(data["agentId"]), str(data["version"]), str(data["endpointType"]),
                                 str(data["endpoint"]), str(data["protocolVersion"]),
                                 tuple(data.get("capabilities", [])), str(data["digest"]),
                                 str(data.get("shortLivedGrant", "")),
                                 str(data.get("experienceLevel", "INEXPERIENCED")),
                                 str(data.get("codexPoolType", "DISPOSABLE")))

    def claim_stage(self, stage_id: str) -> StageLease:
        data = self._post_data("/api/v1/ai-factory/stage-runs/claim.htm", {
            "stageId": stage_id, "clientId": self.http.client_id,
        })
        return StageLease(str(data["runId"]), stage_id, str(data["leaseToken"]),
                          str(data["expiresAt"]), int(data["stateVersion"]))

    def report_agent_state(self, lease: StageLease, agent_id: str, state: str, sequence: int) -> dict[str, Any]:
        return self._post_data("/api/v1/ai-factory/agents/state.htm", {
            "runId": lease.run_id, "agentId": agent_id, "state": state, "sequence": sequence,
        })

    def complete_stage(self, lease: StageLease, exit_code: int, artifacts: list[str]) -> dict[str, Any]:
        return self._post_data("/api/v1/ai-factory/stage-runs/complete.htm", {
            "runId": lease.run_id, "leaseToken": lease.lease_token,
            "exitCode": exit_code, "artifactDigests": artifacts,
        })

    def _post_data(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        result = self.http.request("POST", path, body)
        self._require_success(result.status, result.json_body)
        return dict(result.json_body.get("data", {}))

    @staticmethod
    def _require_success(status: int, payload: dict[str, Any]) -> None:
        if status < 200 or status >= 300 or not payload.get("success", False):
            raise RuntimeError(f"ai-factory 请求失败: HTTP {status}, {payload.get('errorCode', 'UNKNOWN')}")
