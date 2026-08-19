# 分包 06：ai-factory HTTP 层详细设计

## 1. 计划文件

- `apps/ai-factiory/backend/src/main/java/com/sp/selplat/aifactory/AiFactoryBackendApplication.java`
- `.../task/controller/AiTaskController.java`
- `.../stagerun/controller/AiStageRunController.java`
- `.../artifact/controller/AiArtifactController.java`
- `.../governance/controller/AiGovernanceController.java`
- `.../gate/controller/AiGateController.java`
- `.../approval/controller/AiApprovalController.java`
- `.../progress/controller/AiProgressController.java`
- `.../agentregistry/controller/AiRoleRegistryController.java`
- `.../agentregistry/controller/AiAgentRegistryController.java`
- `.../security/AiClientAuthenticationFilter.java`

Controller 继承 SELPLAT `BaseController` 或使用同等公共 Web 能力，只负责 `CommonParam` 传递与 `JsonUtils.toJsonIgnoreNull` 序列化。

## 2. Controller 方法合同

| DES ID | 文件 / 方法 | 方法作用与真实传参 | 真实返回 | 异常或副作用 |
| --- | --- | --- | --- | --- |
| DES-HTTP-001 | `AiTaskController#createTask(CommonParam)` | `POST /api/v1/ai-factory/tasks`；`{"title":"用户导入","project":"SELPLAT","clientId":"CLIENT-MAC-1"}`。 | `{"success":true,"data":{"taskId":"TASK-10001","rootThreadId":"10001","stateVersion":1}}`。 | 只序列化 Service；幂等冲突返回 `IDEMPOTENCY_CONFLICT`。 |
| DES-HTTP-002 | `AiTaskController#getTask(CommonParam)` | `{"taskId":"TASK-10001"}`。 | 返回任务、阶段和当前状态快照。 | 无权限返回统一 403；不泄露其他用户任务。 |
| DES-HTTP-003 | `AiStageRunController#claim(CommonParam)` | `{"stageId":"STAGE-1","clientId":"CLIENT-MAC-1"}`。 | 返回 runId、stageThreadId、leaseToken、expiresAt。 | 双领返回 `STAGE_ALREADY_CLAIMED`。 |
| DES-HTTP-004 | `AiStageRunController#heartbeat(CommonParam)` | `{"runId":"RUN-1","leaseToken":"...","sequence":18,"percent":35}`。 | 返回 acceptedSequence 和新 expiresAt。 | 过期返回 `LEASE_EXPIRED`；不恢复状态。 |
| DES-HTTP-005 | `AiStageRunController#complete(CommonParam)` | `{"runId":"RUN-1","exitCode":0,"artifactDigests":["abc"]}`。 | `{"status":"WAITING_FILE_GATE"}`。 | 不能直接返回阶段完成；缺证据返回 422。 |
| DES-HTTP-006 | `AiArtifactController#register(CommonParam)` | 输入类型、中文名、logicalPath、sha256、size。 | 返回 artifactId、version、gateStatus。 | 同版本摘要不同返回 409。 |
| DES-HTTP-007 | `AiGovernanceController#submitCandidate(CommonParam)` | 输入 candidateId、manifest、digest、evidenceRefs。 | 返回 `PENDING_APPROVAL`。 | Service 不改写包；Rule Factory 不在服务端运行。 |
| DES-HTTP-008 | `AiGovernanceController#getPublished(CommonParam)` | 输入 type/scope/version。 | 返回正式版本、摘要、下载策略和有效期。 | 无批准包返回 404；不生成候选内容。 |
| DES-HTTP-009 | `AiGateController#submitEvidence(CommonParam)` | 输入 gateId、definitionVersion、runnerDigest、artifactDigest、result、violations。 | 返回 gateResultId 和 aggregateStatus。 | 证据 Schema 或摘要不符返回 FAIL/422。 |
| DES-HTTP-010 | `AiApprovalController#decide(CommonParam)` | `{"approvalId":"APR-1","decision":"APPROVED","expectedVersion":2}`。 | 返回决定、批准者、时间和对象摘要。 | 自审自批、过期对象或乐观锁冲突拒绝。 |
| DES-HTTP-011 | `AiProgressController#events(String,String)` | GET SSE，taskId 与 Last-Event-ID。 | `text/event-stream`，事件含 id/type/data。 | 无权限立即关闭；断线不改变状态。 |
| DES-HTTP-012 | `AiProgressController#snapshot(CommonParam)` | 输入 taskId。 | 返回任务、阶段、进度、文件、Gate、错误和审批快照。 | 只读，无状态副作用。 |

## 3. 认证过滤器方法

| DES ID | 方法 | 作用与真实示例 | 返回/副作用 | 异常 |
| --- | --- | --- | --- | --- |
| DES-HTTP-013 | `AiClientAuthenticationFilter#doFilterInternal(request,response,chain)` | 校验 `Authorization: Bearer <short-lived>`、`X-Client-Id: CLIENT-MAC-1`。 | 设置 client/user/requestId 上下文后继续。 | 令牌无效返回 401；请求正文和令牌不写日志。 |
| DES-HTTP-014 | `AiRequestIdFilter#doFilterInternal(...)` | 接受合法 `X-Request-Id` 或生成 UUID。 | 响应头与审计使用同一 requestId。 | 非法超长值被替换并记录安全事实。 |
| DES-HTTP-015 | `AiRoleRegistryController#getStageRole(CommonParam)` | `POST /api/v1/ai-factory/roles/stage.htm`，输入 stageId。 | 返回冻结 roleId/version/digest/permissions。 | 只读；未批准角色返回 404/410。 |
| DES-HTTP-016 | `AiAgentRegistryController#resolve(CommonParam)` | 输入 roleId、roleVersion、clientId。 | 返回 Agent 地址类型、逻辑地址、版本、能力、协议和短期授权。 | 多活动绑定、地址失效或客户端无 scope 返回 409/403。 |
| DES-HTTP-017 | `AiAgentRegistryController#reportState(CommonParam)` | Python 上报 runId、agentId、STARTED/HEARTBEAT/STOPPED 和摘要。 | 返回 acceptedSequence。 | 只登记事实，不建立连接、不启动 Agent。 |

## 4. HTTP 状态

201 创建；200 查询/动作完成；202 已接收待 Gate/审批；400 Schema；401/403 身份权限；404 不存在；409 状态/摘要/幂等冲突；410 过期；422 阶段合同不满足；429 限流；5xx 服务故障。

所有改变工作流的业务请求均由本地 Python 发起。Java可在请求事务内验证并派生权威状态，但不含主动任务调度器、Agent 启动器、Codex 客户端或本地 Gate Runner。
