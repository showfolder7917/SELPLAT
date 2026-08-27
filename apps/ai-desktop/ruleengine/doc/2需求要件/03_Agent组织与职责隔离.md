# 分包 03：Agent 组织与职责隔离需求要件

## 1. 独立交付说明

本分包定义逻辑 Agent 的组织结构、角色版本、脑区归属、权限和禁止事项。实现可由同一底层模型承载多个角色，但每次运行必须形成真实隔离身份，不能只更换称呼。

## 2. 组织模型

- 生产体系：Requirement、Requirements Definition、Architecture、Design、Development、Test。
- 门禁体系：各生产阶段对应的独立 Gate，以及 Quality Gate。
- 修复体系：Requirement、Requirements Definition、Architecture、Design、Code、Test 及治理资产修复角色。
- 进化体系：Quality Monitor、Retrospective、Rule/Gate Evolution、Process Improvement。
- 支撑体系：Intake、Planning、Process、Workspace、Diagnosis、Review、Audit、Release。
- 三方隔离：架构脑、执行脑、独立控制面。

## 3. 正式要件

| ID | 类型 | 来源 | 要件与理由 | 优先级/状态 | 验收标准 | 验证方式 | 后续追踪 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-AGT-001 | 组织 | SRC-MAIN-7.1、SRC-ORG-1 | 一个业务角色必须对应一个稳定 `role_id` 和一个逻辑 Agent 职责域；一次运行不得切换角色。 | Must / draft | 每次运行只有一个 role_id，跨职责动作被拒绝。 | 权限负向测试。 | 待建 |
| REQ-AGT-002 | 隔离 | SRC-MAIN-7.1.3 | 同一模型承载多个角色时，必须使用不同 `agent_id`、上下文、权限、角色版本、阶段运行和审计链。 | Must / draft | 两角色运行记录可独立查询且权限不同。 | 多角色隔离测试。 | 待建 |
| REQ-AGT-003 | 职责 | SRC-MAIN-7.2 | 生产 Agent 只能创造本层产物，不能批准自己的产物、修正规则/Gate/流程或兼任同层修复者。 | Must / draft | 自审、自批或越层修改均被 G013 阻断。 | 越权场景测试。 | 待建 |
| REQ-AGT-004 | 门禁 | SRC-MAIN-7.3 | 每个生产阶段必须由独立 Gate Agent 对固定产物快照裁决；Quality Gate 只能汇总，不能代替缺失前置 Gate。 | Must / draft | 缺任一前置 Gate 时 Quality Gate 必须 FAIL。 | 聚合 Gate 测试。 | 待建 |
| REQ-AGT-005 | 修复 | SRC-MAIN-7.4、SRC-ORG-5 | 每个 Fix Agent 只能修改明确归属对象，修复后重跑受影响验证并回原 Gate。 | Must / draft | 超出对象范围的写入被拒绝，原 Gate 复验链完整。 | 修复权限集成测试。 | 待建 |
| REQ-AGT-006 | 进化 | SRC-MAIN-7.5 | 进化 Agent 只能生成提案；任何 Rule、Gate、Process 新版本都需影响分析、独立 Gate 和审批后才能生效。 | Must / draft | 未批准提案无法进入有效版本或当前快照。 | 状态与权限测试。 | 待建 |
| REQ-AGT-007 | 支撑 | SRC-MAIN-7.6 | Intake、Planning、Process、Workspace、Diagnosis、Review、Audit、Release 必须各自遵守声明的单一职责和禁止事项。 | Must / draft | 角色权限矩阵覆盖读、写、执行、审批、发布等独立动作。 | 矩阵完整性 Gate。 | 待建 |
| REQ-AGT-008 | 双脑 | SRC-MAIN-8.1、FR-019、SRC-BRAIN-2～3 | 架构脑定义需求和合同但不得修改业务代码；执行脑按批准合同实施但不得修改上游合同；控制面裁决但不得修复受检产物。 | Must / draft | 三类越权动作均被阻断并记录审计。 | G013 正负测试。 | 待建 |
| REQ-AGT-009 | 交接 | SRC-MAIN-8.1 | 脑区和角色之间必须通过版本化文档及结构化合同交接，不得依赖未声明共享内存或口头结论。 | Must / draft | 每次阶段运行均引用输入产物版本和摘要。 | 交接完整性检查。 | 待建 |
| REQ-AGT-010 | 汇总 | SRC-MAIN-FR-018 | 无依赖任务可受控并行；存在依赖或重叠写集合时必须串行或由唯一所有者合并，父 Agent 不得把子 Agent 结论当成已验证事实。 | Must / draft | 并行计划含依赖和写集合；重叠写被阻断。 | 并发计划测试。 | 待建 |
| REQ-AGT-011 | 角色版本 | SRC-MAIN-FR-023、25.5 | 角色权威定义必须位于五个治理 AGENTS 入口之一，数据库只登记角色路径、章节、版本、摘要、权限和状态。 | Must / draft | 阶段只引用已批准固定角色版本；运行中变化不影响当前运行。 | 版本冻结测试。 | 待建 |
| REQ-AGT-012 | 发布 | SRC-MAIN-7.6、21 | Release Agent 只能在前置条件满足后生成发布材料，不能自行批准、推送、合并或生产发布。 | Must / draft | 无审批时外部发布动作被拒绝。 | 发布权限负向测试。 | 待建 |

## 4. 关键交互

1. 架构脑发布批准的 Architecture Package；执行脑只消费该版本。
2. 执行脑发现上游问题，提交架构变更请求并进入 BLOCKED。
3. Gate Runner 输出 PASS/FAIL、违规与证据，不写受检文件。
4. Diagnosis Agent 只分类路由，不直接修复。
5. Audit Agent 只追加、校验、查询事实，不能改写历史。

## 5. 输入、输出与异常

- 输入：固定角色版本、阶段记录、规则快照、允许工具、批准产物。
- 输出：带 agent_id、role_id、阶段 Thread、实际动作和结果的运行记录。
- 前置：角色版本已批准、阶段允许启动、权限可验证。
- 异常：角色缺失、版本过期、权限冲突或尝试切换角色时拒绝启动或立即阻断。

## 6. 分包验收

架构交付必须包含角色目录、三方边界、读写执行审批发布权限矩阵、角色版本生命周期、交接合同、越权阻断和多 Agent 并发所有权模型，并覆盖所有本分包角色。

