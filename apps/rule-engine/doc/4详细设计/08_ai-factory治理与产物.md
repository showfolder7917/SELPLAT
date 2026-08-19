# 分包 08：ai-factory 治理与产物详细设计

## 1. 计划文件

- `.../governance/service/AiGovernanceService.java`、`impl/AiGovernanceServiceImpl.java`
- `.../artifact/service/AiArtifactService.java`、`impl/AiArtifactServiceImpl.java`
- `.../gate/service/AiGateService.java`、`impl/AiGateServiceImpl.java`
- `.../trace/service/AiTraceService.java`、`impl/AiTraceServiceImpl.java`
- `.../agentregistry/service/AiAgentRegistryService.java`、`impl/AiAgentRegistryServiceImpl.java`
- 对应最小 DAO 标记接口与公共 DAO 实现绑定。

## 2. Service 方法合同

| DES ID | 文件 / 方法 | 方法作用与真实传参 | 真实返回 | 异常或副作用 |
| --- | --- | --- | --- | --- |
| DES-GOV-001 | `AiGovernanceService#submitCandidate(CommonParam)` | 输入 candidateId、type、scope、manifestDigest、contentDigest、evidenceRefs。 | `CommonResult data={candidateId:GOV-C-1,status:PENDING_APPROVAL}`。 | 不生成/修改包；重复 ID 不同摘要返回冲突。 |
| DES-GOV-002 | `AiGovernanceService#approveCandidate(CommonParam)` | 输入 approvalId、candidateId、expectedDigest。 | 返回 version=`1.2.0`、published=false。 | 证据不足、规则数>30或审批不完整拒绝；内容不可改。 |
| DES-GOV-003 | `AiGovernanceService#publish(CommonParam)` | 输入 version、expectedStatus=APPROVED。 | 返回 publishedAt、digest、supersedesVersion。 | 在途任务不切换；只影响后续任务。 |
| DES-GOV-004 | `AiGovernanceService#getSnapshot(CommonParam)` | 输入 stage、taskId。 | 返回固定规则/Gate/Process 版本、摘要和下载策略。 | 未批准或过期版本不返回。 |
| DES-GOV-005 | `AiArtifactService#register(CommonParam)` | 输入 task/run/type/name/path/digest/size。 | 返回 artifactId、version、gateStatus=PENDING。 | logicalPath 含绝对路径或 `..` 拒绝。 |
| DES-GOV-006 | `AiArtifactService#registerNewVersion(CommonParam)` | 输入 artifactId、新摘要、previousVersion。 | 返回 version+1 并列出失效结果。 | 乐观锁冲突拒绝；副作用调用追踪失效。 |
| DES-GOV-007 | `AiTraceService#link(CommonParam)` | 输入 sourceType/Id/Version、targetType/Id/Version、relation。 | 返回 traceLinkId。 | 循环所有权或引用未批准要件拒绝。 |
| DES-GOV-008 | `AiTraceService#impact(CommonParam)` | 输入 changedType=REQUIREMENT、id=REQ-REQ-001。 | 返回受影响 ARC/DES/TASK/TEST/GATE ID。 | 只读；图不完整时返回明确缺口。 |
| DES-GOV-009 | `AiGateService#registerEvidence(CommonParam)` | 输入 gate/definition/runner/artifact 摘要、PASS/FAIL、violations。 | 返回 gateResultId。 | Runner/定义/产物摘要不匹配按 FAIL 登记。 |
| DES-GOV-010 | `AiGateService#aggregateFileGates(CommonParam)` | 输入 artifactId/version。 | 返回全部必需 Gate 及 aggregate PASS/FAIL。 | 缺结果、超时或 Runner 故障均 FAIL。 |
| DES-GOV-011 | `AiGateService#aggregateStageGate(CommonParam)` | 输入 stageId、artifactVersions。 | 返回 stageGateResultId 和 PASS/FAIL。 | 任一文件未 PASS 不运行或直接 FAIL。 |
| DES-GOV-012 | `AiGateService#invalidateByArtifact(artifactId,version)` | 产物变化。 | 返回 invalidated result IDs。 | 历史结果保留、状态置 INVALIDATED。 |
| DES-GOV-013 | `AiGovernanceService#recordRetrospective(CommonParam)` | 输入事实引用、failureDomain、improvementTarget、ruleSentence。 | 返回 retrospectiveId。 | 无事实证据拒绝；NONE 合法。 |
| DES-GOV-014 | `AiGovernanceService#recordProposal(CommonParam)` | 输入 RULE/GATE/PROCESS 候选元数据。 | 返回 proposalId、status=DRAFT。 | 未批准提案不进入 published registry。 |

## 3. Agent 登记边界

角色、Agent 版本、逻辑地址、协议、能力和角色绑定由 ai-factory 登记；运行时地址只能返回给有 scope 的 Python 客户端。服务端不连接 Agent、不维护 Codex 连接池，也不把 Agent 地址当作服务器可访问位置。Python取得登记后负责启动、心跳、停止和本地审计。

## 4. Controller 边界

Controller 不补 msg、affectedRows、moduleCode 或错误结构；Service/全局异常处理一次性生成 `CommonResult`。服务端不提供“修改候选规则内容”“启动 Agent”或“执行 Gate”接口。
