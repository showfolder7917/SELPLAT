# 分包 07：Rule、Gate、Process 工厂架构要件

## 1. 目标

本分包定义位于 memory 的本地治理工厂，以及 ai-factory 对候选包的审批、正式版本登记、分发和 Gate 结果聚合。Rule/Gate/Process 的生成、索引检查、包构建、Codex 联动验证和文件型 Runner 全部在本地完成。长期治理资产只有 Log、Rule、Gate、Process 四类。

## 2. 组件边界

- memory / Rule Authoring & Compiler：中文原则生成、唯一索引、依赖、冲突、范围、替代关系和 30 条容量检查。
- memory / Gate Definition Builder & Runner：定义构建、Runner 选择、只读执行、证据和本地环境验证。
- memory / Process Proposal Builder：流程、角色、状态和修复路由候选内容。
- memory / Governance Bundle Builder：构建不可变候选包、清单和摘要，并保存批准快照。
- ai-factory / Published Governance Registry：审批、正式版本、摘要、替代关系和受控分发。
- ai-factory / Gate Result Orchestrator：校验本地 Runner 证据、关联产物摘要、失效和聚合。

## 3. 架构要件

| ARC ID | 来源要件 | 所属 | 架构约束 | 验收方式 |
| --- | --- | --- | --- | --- |
| ARC-GOV-001 | REQ-GAT-001～REQ-GAT-002 | memory | 本地 Rule Factory 生成单原则中文 Rule、范围和依赖，并在候选包构建时强制有效 Rule 不超过 30。 | 本地 Rule 内容与容量 Gate。 |
| ARC-GOV-002 | REQ-GAT-003 | memory | 本地唯一根索引按逻辑 ID 递归解析，重复、循环、失效路径和作用域冲突必须阻断候选包生成。 | 本地索引异常测试。 |
| ARC-GOV-003 | REQ-GAT-004 | memory/服务 | memory 构建阶段治理包及摘要；服务端只审批并登记正式版本，memory 仅激活内容摘要与批准记录一致的快照。 | 候选包、批准记录和快照篡改测试。 |
| ARC-GOV-004 | REQ-GAT-005 | memory/服务 | Gate Definition 在 memory 构建并验证唯一 ID、输入、算法、阶段、成本、结果和证据 Schema；服务端只登记批准版本。 | 本地 Definition Gate 与服务登记对账。 |
| ARC-GOV-005 | REQ-GAT-006 | memory | Gate Definition Builder、Runner 和产物修复使用不同本地权限；Runner 对受检快照只读，不能写受检文件。 | 本地 Runner 沙箱测试。 |
| ARC-GOV-006 | REQ-GAT-007 | 两端 | memory 的 Gate 证据绑定 definition_version、artifact_digest 和 runner_digest；服务端校验并登记，超时、故障或缺证据统一 FAIL。 | 固定版本故障与上报测试。 |
| ARC-GOV-007 | REQ-GAT-008 | memory/服务 | G001～G015 的定义、Runner 和正负样例由 memory 规则工厂构建验证，服务端登记其批准版本和适用阶段。 | 基础 Gate 候选包与注册验收。 |
| ARC-GOV-008 | REQ-GAT-009～REQ-GAT-011 | memory | memory 按批准治理包选择并执行文件、源码、配置、SQL、PPT 和测试 Gate；未登记类型直接 FAIL。 | 本地多制品类型测试。 |
| ARC-GOV-009 | REQ-GAT-012～REQ-GAT-013 | 两端 | memory 上报不可改 Runner 结果和证据；服务端在全部文件结果登记后运行阶段聚合，Quality Gate 不补缺失结果。 | 本地结果与服务聚合对账。 |
| ARC-GOV-010 | REQ-EVO-001～REQ-EVO-003 | memory/服务 | memory 的治理工厂只生成四类长期资产；服务端注册模型同样只允许四类，双方禁止第五类知识资产。 | 双端资产类型 Gate。 |
| ARC-GOV-011 | REQ-EVO-004～REQ-EVO-007 | memory/服务 | memory 基于本地事实和 Codex 生成复盘、分类与一句话建议；服务端保存摘要和审批链，建议不能直接成为 Rule。 | 事实/分析隔离测试。 |
| ARC-GOV-012 | REQ-EVO-008～REQ-EVO-010 | memory | Rule/Gate/Process 提案、影响分析、工程适配和候选包验证全部由本地规则工厂完成。 | 三类本地提案 Gate。 |
| ARC-GOV-013 | REQ-EVO-011 | 两端 | memory 提交内容不可变的候选包；服务端经重复检查、独立审批后登记正式版本，默认只影响后续任务。 | 候选到发布版本生效测试。 |
| ARC-GOV-014 | REQ-EVO-012～REQ-EVO-013 | 两端 | 服务端提供事实趋势，memory 的规则工厂决定是否形成本地提案并允许 improvement_target=NONE。 | 趋势输入、权限与 NONE 路径测试。 |
| ARC-GOV-015 | REQ-NFR-007～REQ-NFR-008 | memory/服务 | 新 Rule/Gate/Process/产物类型由 memory 以包扩展，服务端只登记兼容版本、摘要和替代关系。 | 独立扩展与版本兼容测试。 |

## 4. Runner 布局

- 文件、源码、配置、SQL、PPT、测试和需要 Codex/本地环境的 Gate：只在 memory 执行。
- 服务端数据库状态、审批完整性和 HTTP 合同等不依赖本地文件的控制面检查可以在 ai-factory 执行，但不属于规则工厂。
- 阶段聚合 Gate：只在服务端基于已登记证据执行。
- 任一本地 Runner 不得同时拥有产物写权限和 Gate 结果审批权限；服务端不得远程读取本地文件补做 Runner。
