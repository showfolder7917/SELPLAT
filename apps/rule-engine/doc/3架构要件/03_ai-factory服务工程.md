# 分包 03：ai-factory 服务工程架构要件

## 1. 工程定位

逻辑产品名为 `ai-factory`，当前空目录为 `apps/ai-factiory`。该工程是未来服务器部署的 Java HTTP 服务，负责集中控制面、权威业务数据、治理包审批与登记、Gate 结果聚合、SSE 和查询；不生成规则、不运行 Codex，也不直接操作本地工作空间。

## 2. 建议组件

| 组件 ID | 组件 | 职责 |
| --- | --- | --- |
| CMP-SRV-001 | API Gateway | 版本化 HTTP、认证、授权、限流、幂等和错误合同 |
| CMP-SRV-002 | Task/Workflow Service | 根任务、阶段、运行、状态机、租约和恢复 |
| CMP-SRV-003 | Role/Approval Service | 角色版本、权限、人工审批和高风险控制 |
| CMP-SRV-004 | Published Governance Registry | 接收本地候选包及证据，完成人工审批、正式版本登记、摘要校验和受控分发 |
| CMP-SRV-005 | Artifact/Trace Service | 产物元数据、摘要、需求/架构/测试/Gate 追踪 |
| CMP-SRV-006 | Gate Result Orchestrator | 登记本地 Runner 证据，执行结果失效、阶段聚合和状态守卫，不读取本地源码 |
| CMP-SRV-007 | Audit Service | 追加写事件、哈希链、manifest、查询和脱敏 |
| CMP-SRV-008 | Progress Service | 心跳、进度事件、STALE、SSE 和页面快照 |

## 3. 架构要件

| ARC ID | 来源要件 | 组件 | 架构约束 | 验收方式 |
| --- | --- | --- | --- | --- |
| ARC-SRV-001 | REQ-RUN-001、REQ-DAT-001～REQ-DAT-012 | CMP-SRV-002/005 | Java 服务必须作为业务数据库唯一写入者，并在事务内维护根任务、阶段、产物、追踪和版本。 | 数据写入者扫描与事务测试。 |
| ARC-SRV-002 | REQ-RUN-003 | CMP-SRV-001 | 对本地提供创建/查询任务、领取、心跳、产物、错误、完成、快照、Gate 和事件接口。 | OpenAPI 合同 Gate。 |
| ARC-SRV-003 | REQ-RUN-004、REQ-WFL-009 | CMP-SRV-002 | 阶段领取必须以原子租约防止双领，并保存 Worker、阶段 Thread、尝试和有效期。 | 并发领取测试。 |
| ARC-SRV-004 | REQ-RUN-006、REQ-WFL-001～REQ-WFL-004 | CMP-SRV-002 | 只有服务端根据持久状态、审计、文件 Gate 和阶段 Gate转换权威状态。 | 非法跳转测试。 |
| ARC-SRV-005 | REQ-RUN-007～REQ-RUN-010 | CMP-SRV-008 | 进度持久化、顺序事件、心跳、STALE、数据库快照和 SSE 断点续传统一由服务端提供。 | 断线与 STALE 测试。 |
| ARC-SRV-006 | REQ-GAT-001～REQ-GAT-004 | CMP-SRV-004 | 服务端只接收 memory 生成并本地验证的治理候选包、摘要和容量/依赖证据，经审批后分配正式版本并登记发布状态；不得生成或改写包内容。 | 候选包不可变性与发布审批测试。 |
| ARC-SRV-007 | REQ-GAT-005～REQ-GAT-013 | CMP-SRV-004/006 | 服务端登记 Gate Definition/Runner 版本和本地执行证据，负责结果失效与阶段聚合；不得执行需要本地源码、文件或 Codex 的 Runner。 | 15 Gate 证据对账与聚合测试。 |
| ARC-SRV-008 | REQ-AGT-004、REQ-AGT-006、REQ-AGT-012 | CMP-SRV-003/004/006 | 本地规则生产、服务端审批、Gate 结果聚合和发布必须权限隔离，未批准候选包和未通过 Gate 的发布请求均拒绝。 | 权限与审批测试。 |
| ARC-SRV-009 | REQ-WFL-005～REQ-WFL-012 | CMP-SRV-002/003 | 服务端实现失败分类路由、人工接管、审批、并发、幂等、流程版本、取消和恢复的控制合同。 | 状态机场景测试。 |
| ARC-SRV-010 | REQ-AUD-001～REQ-AUD-012 | CMP-SRV-007 | 集中审计服务保存追加事件、哈希链、manifest、attempted/recovery 和按任务查询。 | 篡改与审计故障测试。 |
| ARC-SRV-011 | REQ-EVO-001～REQ-EVO-013 | CMP-SRV-004/007 | 本地生成四类治理候选资产；服务端只保存其审批、正式版本、摘要、替代关系和发布状态，复盘与提案独立登记。 | 本地候选到服务发布生命周期测试。 |
| ARC-SRV-012 | REQ-MVP-004～REQ-MVP-006 | 全部 | MVP 必须提供管理面、数据库、规则快照、Gate、审计、错误和本地 Worker 通信的最小闭环。 | 端到端试运行。 |
| ARC-SRV-013 | REQ-NFR-005、REQ-NFR-007～REQ-NFR-008 | CMP-SRV-001/008 | 服务端通过注册扩展 Agent/Gate/产物类型并提供完整可观测查询，不修改无关合同。 | 扩展性测试。 |
| ARC-SRV-014 | REQ-NFR-010～REQ-NFR-012 | CMP-SRV-003/007 | 服务端负责集中数据保护、审计可靠性、备份和恢复策略。 | 安全与灾备演练。 |

## 4. 服务端禁止事项

1. 远程扫描或修改 memory 的工作空间。
2. 接受没有 task_id、stage_run_id、幂等键、合同版本和摘要的写请求。
3. 因 Worker 报告“成功”直接跳过 Gate。
4. 在同一权限上下文中同时定义 Gate、执行 Gate、修改受检产物和批准结果。
5. 生成或修改 Rule/Gate/Process 内容、运行 Codex，或执行需要本地源码和工作空间的 Gate Runner。

## 5. 目录名称决定

逻辑名称固定为 `ai-factory`。物理目录是否从 `apps/ai-factiory` 更正为 `apps/ai-factory` 记录为 `ADEC-001`；在决定前，本轮只生成文档，不移动目录。
