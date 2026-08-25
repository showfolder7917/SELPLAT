# 分包 04：需求分析与 Agent 入口架构要件

## 1. 目标

本分包定义 memory 中同时生成需求文档与需求要件的需求分析师、五个治理入口，以及服务端对角色版本、阶段和审批的权威登记。每个入口是职责路由，不代表只有五个运行时 Agent。

## 2. 入口结构

```text
已退役本地驱动应用/
├─ AGENTS_AI产出工厂总入口.md
├─ IDX_AI产出工厂总索引.md
├─ 需求文档/AGENTS_需求文档入口.md
├─ 设计文档/AGENTS_设计文档入口.md
├─ 测试文档/AGENTS_测试文档入口.md
└─ 审计日志/AGENTS_审计日志入口.md
```

根 `AGENTS.md` 或专用启动器必须显式进入总入口，再由唯一索引路由；禁止扫描目录猜测入口。

## 3. 架构要件

| ARC ID | 来源要件 | 所属 | 架构约束 | 验收方式 |
| --- | --- | --- | --- | --- |
| ARC-ENT-001 | REQ-MVP-001、REQ-AGT-011 | memory | 五个治理入口和唯一根索引必须位于 memory，使用稳定 role_id、章节锚点和版本摘要。 | 入口索引 Gate。 |
| ARC-ENT-002 | REQ-REQ-001～REQ-REQ-003 | 两端 | Intake 先调用服务端创建根任务/需求阶段，本地 Requirement Agent 再生成文档，服务端 Gate/审批后才能创建要件阶段。 | 顺序集成测试。 |
| ARC-ENT-003 | REQ-REQ-004～REQ-REQ-009 | memory/服务 | 本地 Requirement Agent 继续按按钮动作、批处理调用或监听事件处理等独立功能生成完整类别和稳定 ID；服务端解析对账并运行要件 Gate。 | 功能边界及 158 条样例结构测试。 |
| ARC-ENT-004 | REQ-REQ-010～REQ-REQ-012 | 两端 | 要件修复使用独立 Agent；优先级、粒度和批准角色未确认时由服务端保持 BLOCKED。 | 修复和审批测试。 |
| ARC-ENT-005 | REQ-AGT-001～REQ-AGT-002 | memory/服务 | 服务端登记 role_version，本地每次运行绑定唯一 role/agent/context/permission/stage_run。 | 角色对账测试。 |
| ARC-ENT-006 | REQ-AGT-003～REQ-AGT-007 | 两端 | 生产、门禁、修复、进化和支撑角色使用互斥权限集；服务端拒绝同层自审自批。 | 权限矩阵 Gate。 |
| ARC-ENT-007 | REQ-AGT-008～REQ-AGT-010 | memory | 架构脑和执行脑通过 Architecture Package 交接；并行 Agent 在启动前声明依赖和写集合。 | 交接与并发测试。 |
| ARC-ENT-008 | REQ-SCP-001～REQ-SCP-004 | memory | 需求入口必须能处理源码、配置、文档、PPT 和数据交付物，并选择对应产物类型。 | 多类型需求测试。 |
| ARC-ENT-009 | REQ-SCP-005～REQ-SCP-006 | memory | 需求分析师必须明确非范围、高风险和人工节点，不得承诺无人值守或自动规则批准。 | 需求文档 Gate。 |
| ARC-ENT-010 | REQ-ART-005～REQ-ART-007 | memory/服务 | 本地生成中文标准文件名，服务端登记 artifact_type、版本和摘要；聊天不能替代正式产物。 | 产物对账测试。 |
| ARC-ENT-011 | REQ-MVP-002～REQ-MVP-003 | 两端 | MVP 必须注册五套逻辑角色体系，并用一个根任务贯穿独立阶段 Thread 和同一本地工作空间。 | 端到端角色树查询。 |
| ARC-ENT-012 | REQ-MVP-007 | 两端 | 首个试运行必须选择低风险 SELPLAT 需求，由本地入口发起并在服务端形成完整审计链。 | 试运行验收。 |

## 4. 输入与输出

- 输入：用户需求、稳定用户、目标工程、服务连接和风险信息。
- 输出：服务端根任务、需求/要件阶段、本地正式文档、Gate/审批状态和下一阶段创建许可。
- 异常：服务不可用时只产生本地草稿；重大歧义、角色版本失效、要件冲突或 Gate FAIL 时不得创建架构阶段。
