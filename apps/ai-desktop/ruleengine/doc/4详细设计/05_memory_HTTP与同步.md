# 分包 05：memory HTTP 与同步详细设计

## 1. 计划文件

- `.../sync/HTTP客户端.py`
- `.../sync/AI工厂客户端.py`
- `.../sync/待上报队列存储.py`
- `.../sync/同步工作器.py`
- `.../sync/SSE客户端.py`
- `.../model/接口模型.py`

## 2. 方法合同

| DES ID | 文件 / 方法 | 作用与真实传参 | 真实返回 | 异常或副作用 |
| --- | --- | --- | --- | --- |
| DES-SYN-001 | `HTTP客户端.py::request(method,path,body,headers)->HttpResult` | `POST /api/v1/ai-factory/tasks`、JSON 和幂等键。 | `HttpResult(status=201,json={'success':True,'data':{'taskId':'TASK-10001'}})`。 | 5xx 结果标记 uncertain，不自动重放高风险动作。 |
| DES-SYN-002 | `AI工厂客户端.py::create_task(command)->TaskContext` | 输入 title、project、clientId。 | `TaskContext(task_id='TASK-10001',root_thread_id='10001')`。 | 409 幂等冲突抛 `IdempotencyConflict`。 |
| DES-SYN-003 | `AI工厂客户端.py::claim_stage(stage_id,worker)->StageLease` | 输入 `STAGE-1`、`CLIENT-MAC-1`。 | 返回 runId、leaseToken、expiresAt、stateVersion。 | 409 已领取；410 流程版本失效。 |
| DES-SYN-004 | `AI工厂客户端.py::heartbeat(lease,event)->LeaseReceipt` | 输入 action、percent、sequence。 | `LeaseReceipt(accepted_sequence=18,expires_at='...')`。 | 410 租约过期后停止新增动作。 |
| DES-SYN-005 | `AI工厂客户端.py::register_artifact(facts)->ArtifactReceipt` | 输入类型、标准名、逻辑路径、sha256。 | `ArtifactReceipt(artifact_id='ART-1',version=1,gate_status='PENDING')`。 | 摘要冲突返回 409 并要求新版本。 |
| DES-SYN-006 | `AI工厂客户端.py::submit_gate_evidence(evidence)->GateReceipt` | 输入 G005、definition/runner/artifact 摘要。 | `GateReceipt(result_id='GR-1',aggregate_status='PENDING')`。 | 服务端拒绝证据不完整，不修改本地 evidence。 |
| DES-SYN-007 | `AI工厂客户端.py::submit_governance(bundle)->GovernanceReceipt` | 输入 candidateId、manifest、包或受控 URI。 | `GovernanceReceipt(status='PENDING_APPROVAL')`。 | 服务端不得返回改写内容；拒绝需新 candidate。 |
| DES-SYN-008 | `AI工厂客户端.py::get_approval(candidate_id)->ApprovalRecord` | 查询 `GOV-C-1`。 | `ApprovalRecord(decision='APPROVED',version='1.2.0',digest='abc')`。 | 摘要不匹配不激活。 |
| DES-SYN-009 | `待上报队列存储.py::append(event)->OutboxRecord` | 保存 `artifact.registered` 事件。 | `OutboxRecord(id=101,state='PENDING',idempotency_key='...')`。 | SQLite 事务失败时业务动作不得声明已上报。 |
| DES-SYN-010 | `待上报队列存储.py::mark_confirmed(id,receipt)->None` | 输入 101 和服务确认。 | 无返回；保存服务器对象 ID 与确认时间。 | 不删除原始发送事实。 |
| DES-SYN-011 | `同步工作器.py::flush(limit)->SyncReport` | 按序补报最多 100 条。 | `SyncReport(sent=8,confirmed=8,blocked=0)`。 | 遇 409/410 停止相关 task 后续事件并请求核对。 |
| DES-SYN-012 | `SSE客户端.py::subscribe(task_id,last_event_id)->Iterator[ProgressEvent]` | 输入 TASK-10001 和 18。 | 依次返回 sequence 19、20。 | 断线先拉快照再续订；重复序号丢弃。 |
| DES-SYN-013 | `同步工作器.py::reconcile(task_id)->ReconcileReport` | 比较本地 outbox、租约、包和服务快照。 | `ReconcileReport(conflicts=(),next_sequence=21)`。 | 不自动合并状态/摘要冲突。 |
| DES-SYN-014 | `AI工厂客户端.py::get_stage_role(stage_id)->RoleSnapshot` | 查询 STAGE-DESIGN 的冻结角色。 | 返回 roleId/version/digest/permissions。 | 未批准或版本漂移时不继续。 |
| DES-SYN-015 | `AI工厂客户端.py::resolve_agent(role_id,role_version)->AgentRegistration` | 查询角色绑定 Agent 地址。 | 返回 agentId/version/endpointType/endpoint/protocol/capabilities/shortLivedGrant。 | 不接收长期凭据；多个活动绑定返回冲突。 |
| DES-SYN-016 | `AI工厂客户端.py::report_agent_state(run,handle,state)->AgentStateReceipt` | 上报 Agent STARTED/HEARTBEAT/STOPPED 事实。 | 返回 serverSequence 和登记状态。 | Java只登记事实，不反向启动 Agent。 |

## 3. SQLite 本地表

`local_outbox(id, task_id, event_type, idempotency_key, payload_json, payload_digest, state, attempts, next_attempt_at, server_receipt_json, created_at)`；`local_snapshot(key, task_id, version, digest, logical_path, state, updated_at)`；`local_recovery_point(id, task_id, run_id, payload_json, created_at)`。数据库固定在 `OPTION/temp/ai-factory/状态/memory.db`，所有记录必须带 task_id 或明确标记为跨任务索引。

## 4. 重试

仅对网络失败、429 和明确可重试 5xx 使用指数退避；400/401/403/409/410/422 不自动重试。相同幂等键内容必须完全一致。
