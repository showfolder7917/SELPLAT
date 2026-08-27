# 分包 13：API 示例与测试详细设计

## 1. 公共 HTTP 合同

除 SSE 外，HTTP 请求与响应均使用 UTF-8 JSON。写接口必须携带 `Authorization`、`X-Client-Id`、`X-Request-Id` 和 `Idempotency-Key`；响应沿用 SELPLAT 的 `CommonResult`，业务数据位于 `data`，不得另造包装类型。

成功示例：

```json
{
  "success": true,
  "data": {
    "taskId": "TASK-10001",
    "rootThreadId": "10001",
    "stateVersion": 1
  }
}
```

失败示例：

```json
{
  "success": false,
  "code": "STATE_VERSION_CONFLICT",
  "message": "任务状态已变化，请刷新后重试",
  "requestId": "REQ-7f3a"
}
```

错误响应只返回安全业务信息；令牌、租约原文、绝对路径、连接串、未脱敏堆栈和候选包敏感正文不得出现。

## 2. 端到端接口样例

| DES ID | 场景 | 请求示例 | 响应与断言 |
| --- | --- | --- | --- |
| DES-TST-001 | 创建根任务 | `POST /api/v1/ai-factory/tasks`，正文 `{"title":"用户导入","project":"SELPLAT","clientId":"CLIENT-MAC-1"}` | HTTP 201；返回 `TASK-10001/rootThreadId/stateVersion=1`；同幂等键同正文重放同一结果。 |
| DES-TST-002 | 领取需求阶段 | `POST /api/v1/ai-factory/stages/STAGE-1/claim`，正文 `{"clientId":"CLIENT-MAC-1","expectedStateVersion":1}` | HTTP 200；返回 `RUN-1/stageThreadId/leaseToken/expiresAt`；并发第二次领取返回 409。 |
| DES-TST-003 | 心跳与完成事实 | 先提交 `sequence=18,percent=35`，再提交 `exitCode=0,artifactIds=["ART-1"]` | 心跳返回 `acceptedSequence=18`；完成仅进入 `FILE_GATING`，不得直接返回 DONE。 |
| DES-TST-004 | 登记产物版本 | `POST /artifacts`，正文含 `artifactType=DESIGN_DOC`、`logicalPath=任务/TASK-10001/当前任务/详细设计/详细设计_V001.md`、`version=1`、`sha256=abc` | 返回 `artifactId=ART-1,gateStatus=PENDING`；绝对路径、跨 task_id 或 `..` 返回 422。 |
| DES-TST-005 | 提交治理候选包 | `POST /governance/candidates`，正文含 `candidateId=GOV-C-1`、manifest、内容摘要和证据引用 | 返回 `PENDING_APPROVAL`；服务端保存原摘要且不改写内容；规则数超过 30 返回 422。 |
| DES-TST-006 | 提交 Gate 证据 | `POST /gates/evidence`，正文含 `gateId=G005`、definition/runner/artifact 摘要、`result=PASS` | 固定摘要匹配才登记；缺证据、超时、Runner 故障或摘要不符按 FAIL 处理。 |
| DES-TST-007 | 审批治理版本 | `POST /approvals/APR-1/decision`，正文 `{"decision":"APPROVED","expectedVersion":2,"targetDigest":"abc"}` | 有权且非申请者返回 APPROVED；自审自批、目标过期或摘要变化返回 403/409。 |
| DES-TST-008 | 快照与 SSE 续传 | 先 `GET /tasks/TASK-10001/snapshot`，再以 `Last-Event-ID: 18` 请求 `/events` | 快照为数据库权威状态；SSE 从 19 开始、按序发送，重复事件可去重。 |
| DES-TST-009 | 统一错误合同 | 分别触发 401、403、404、409、410、422、429、500 | 每个响应含稳定 `code/message/requestId`；不得包含敏感字段或伪 PASS。 |
| DES-TST-010 | 幂等与 uncertain 恢复 | 首次写入在服务端提交后断网，本地将动作标记 `uncertain`，随后以原幂等键查询/重放 | 同摘要得到原回执；不同摘要得到 `IDEMPOTENCY_CONFLICT`；高风险动作不自动重做。 |
| DES-TST-021 | 获取阶段角色 | `POST /api/v1/ai-factory/roles/stage.htm`，正文 `{"stageId":"STAGE-DESIGN","taskId":"TASK-10001"}` | 返回冻结 roleId/version/digest/permissions；未批准或版本变化返回 404/410。 |
| DES-TST-022 | 解析角色 Agent | `POST /api/v1/ai-factory/agents/resolve.htm`，正文含 roleId/version/clientId | 返回 agentId/version/endpointType/逻辑地址/能力/短期授权；不得包含长期凭据或机器绝对路径。 |
| DES-TST-023 | Agent 状态上报 | Python启动 Agent 后提交 runId、agentId、sequence、STARTED 和事实摘要 | Java只登记状态并返回 acceptedSequence；不能建立 Codex 连接或代替 Python 启动。 |

SSE 事件示例：

```text
id: 19
event: stage.heartbeat
data: {"taskId":"TASK-10001","runId":"RUN-1","sequence":19,"percent":40,"occurredAt":"2026-08-19T10:15:30Z"}

```

治理候选 manifest 最小示例：

```json
{
  "candidateId": "GOV-C-1",
  "type": "RULE_PACKAGE",
  "scope": "SELPLAT/rule-engine",
  "candidateVersion": "1.2.0-candidate.1",
  "contentDigest": "sha256:abc",
  "rules": 18,
  "dependencies": ["BASE-1@2.0.0"],
  "validationEvidence": ["EVD-101", "EVD-102"]
}
```

## 3. 分层测试对象

| DES ID | 测试对象 | 真实输入 | 预期结果与关键负向场景 |
| --- | --- | --- | --- |
| DES-TST-011 | memory 入口与角色单元测试 | 根任务回执、五种 role definition、不同 stage/run | 角色版本/权限/上下文绑定正确；缺批准版本、跨阶段上下文和权限越界均阻断。 |
| DES-TST-012 | 本地 Rule Factory 测试 | 30/31 条 Rule、重复 ID、循环依赖、失效路径、G001～G015 正负样例 | 30 条可构包；其余异常给出稳定诊断且不产生候选包。 |
| DES-TST-013 | 工作空间/Codex/Test Runner 测试 | 安全中文名、`..`、符号链接、并发写集、成功和失败命令 | 只在工程根内原子写；唯一所有者生效；保存命令、期望、实际和脱敏证据。 |
| DES-TST-014 | HTTP/outbox/恢复测试 | 乱序心跳、重复事件、5xx、断网、租约过期、服务快照冲突 | 低风险事实按序补报；409/410 和状态摘要冲突停止自动合并并转人工。 |
| DES-TST-015 | Java Controller/Service 合同测试 | `CommonParam` 请求、合法/非法状态和权限组合 | Controller 只解析序列化；Service 返回统一业务结果；所有状态变化经事务和审计。 |
| DES-TST-016 | DAO/数据库约束测试 | 双领、乐观锁、重复幂等键、追踪循环、审计前哈希错误 | 唯一约束和条件更新阻止竞争；历史不物理删除；事务失败整体回滚。 |
| DES-TST-017 | 状态机与 Gate 聚合测试 | 文件 PASS/FAIL/缺失、产物摘要变化、34 项发布验收 | 缺失即 FAIL；摘要变化使旧结果 INVALIDATED；全部固定摘要 Gate 通过后才可发布。 |
| DES-TST-018 | 安全与审计测试 | 令牌/密码/Cookie/私钥/绝对路径、跨任务读取、自审自批、审计写失败 | 敏感扫描违规数为 0；越权拒绝；关键写在审计故障时 fail-closed。 |
| DES-TST-019 | MVP 端到端试运行 | 一个低风险 SELPLAT 需求，经需求→要件→架构→设计→实现→测试→质量→发布材料 | 一个根任务贯穿独立阶段 Thread；两端 ID/版本/摘要一致；失败修复回原 Gate。 |
| DES-TST-020 | 非功能与恢复测试 | 30 分钟分段指标、并发领取、限流、两端重启、备份恢复、旧客户端 | 不跳 Gate；RPO/RTO 达批准值；游标、租约、outbox 可恢复；兼容字段不使旧客户端失败。 |
| DES-TST-024 | Python 常驻与连接池测试 | 重复 daemon、4 个连接、5 个运行、同连接双占、隔离连接和断线续传 | 单实例；连接按 run 独占；池满排队；异常连接隔离；Java和页面均不能启动 Agent。 |
| DES-TST-025 | task_id 目录与中文命名测试 | 两个 task_id、`RUL_中文/AGENT_中文/IDX_中文`、NFD/NFC、非法字符和源码污染样例 | 每任务文档/Agent/Gate/审计均在唯一中文任务根；NFC 正常；非法名和源码生成物被 Gate 阻断。 |

## 4. 测试执行分组

1. `memory-unit`：DES-TST-011～014、024～025，Python 常驻、连接池、文件沙箱、中文任务目录和本地 SQLite 测试。
2. `server-unit`：DES-TST-015～018，Java Service、DAO、MockMvc、H2 事务和安全测试。
3. `contract`：DES-TST-001～010、021～023，以固定 JSON/SSE fixture 同时验证 Python 客户端和 Java 服务。
4. `system-mvp`：DES-TST-019～020，在隔离的 SELPLAT 低风险样例工程执行，不使用生产凭据。

实现阶段必须把每次执行的环境、数据来源、命令、预期、实际、证据摘要和责任角色写入正式测试产物。仅有测试进程退出码 0、百分比 100 或聊天结论，均不得视为 Gate PASS。

## 5. Design Gate 入口条件

- 所有 API Schema 与数据库字段、Service 参数、Python DTO 一致。
- 每个写接口都有认证、授权、幂等、状态版本和 attempted 审计测试。
- 所有文件类型和 G001～G015 都有正负样例。
- 179 条 `ARC-*` 全部映射到详细设计和至少一个验证对象。
- 正式 RPO/RTO、保留期、服务器地址、证书与生产数据库仍属待批准值，不以 MVP 默认值替代审批。
