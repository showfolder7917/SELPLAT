# AI Desktop Governance 协议按所有者拆分方案

## 1. 文档状态

- 文档性质：实施方案，不代表代码已经迁移完成。
- 适用范围：`apps/ai-desktop/contracts/governance` 及其直接导入方、公开聚合出口和说明文档。
- 当前结论：顶层 `contracts/governance` 没有对应的 Electron 业务模块，属于按“治理主题”形成的跨所有者聚合，应拆回真实业务所有者。
- 目标：Contracts 顶层只保留 `foundation`、`system`、`services`；除真正跨域的基础 Value 和系统 API 聚合外，协议路径与 Electron 业务所有者路径保持同构。
- 非目标：本方案不新建虚假的 `electron/services/governance`，不改变审批、审计、异常处理和工作流恢复的业务行为。

## 2. 为什么现状无法一眼定位

当前分类混用了三种不同维度：

1. 业务主题：“审批、异常、审计都属于治理”。
2. 页面视角：Renderer 在同一个治理视图展示多类数据。
3. 实现所有权：Workflow 和 Event Center 分别生产、维护并兼容不同协议。

目录采用了前两种维度，而代码实际按照第三种维度运行，所以从：

```text
contracts/governance
```

无法通过替换路径直接找到：

```text
electron/.../governance
```

因为这个 Electron 所有者并不存在。Renderer 把多种数据展示在一个页面，只能说明它是聚合消费者，不能决定底层协议归属。

## 3. 当前源码证据

### 3.1 Workflow 的真实职责

`electron/services/workflow/internal/workflow.repository.ts` 当前负责：

- 写入、查询 `AiDesktopApprovalGovernance`；
- 写入工作流事件；
- 查询未处理异常；
- 检测停滞任务；
- 把审批、异常和工作流事实投影到 SQLite。

`electron/services/workflow/internal/workflow.supervisor.ts` 当前负责：

- 读取人物、演化和协作状态；
- 检测停滞任务；
- 拉取未处理异常并交给令狐；
- 更新异常处理状态。

因此审批治理读模型、工作流事件、异常记录、停滞检测和状态读取 Port 的真实所有者是 Workflow。

### 3.2 Event Center 的真实职责

`electron/services/support/capabilities/event-center/event-center.facade.ts` 当前负责：

- 接收统一业务事件；
- 规范化技术异常、业务异常和停滞异常；
- 接收 Renderer 异常；
- 把事件投影给持久化端口。

`electron/services/support/capabilities/event-center/internal/audit/business-audit-log.ts` 当前负责：

- 记录业务审计日志；
- 汇总审计任务；
- 生成审计原因和审计信息。

因此异常入口和审计输出的真实所有者是 Event Center。

### 3.3 System 和 Renderer 的职责

`contracts/system/desktop/api/desktop.api.ts` 与 `contracts/system/desktop/index.ts` 只是跨进程 API 和 Renderer 类型聚合出口。它们可以组合、引用并转发真实所有者的公开协议，但不能反过来成为审批、审计或工作流事件的业务所有者。

## 4. 所有者判定规则

每个协议按照以下顺序确定唯一所有者：

1. 谁定义字段语义和状态变化。
2. 谁生产数据并负责版本兼容。
3. 谁提供对应的 Facade、Service、Supervisor 或 Repository。
4. 谁负责持久化和恢复该事实。
5. 页面和调用方只决定消费方向，不决定所有者。

禁止用以下理由创建顶层业务协议目录：

- 多个页面都使用；
- 名称听起来像一个公共主题；
- 为减少相对路径层级；
- 为了让 Renderer 一次导入多个类型。

跨领域页面需要组合数据时，应在 `system/desktop` 或 `services/support/application` 定义组合 API；底层协议仍保留在各自所有者目录。

## 5. 文件与公开类型迁移映射

### 5.1 迁入 Workflow

| 当前文件或类型 | 目标文件 | 理由 |
|---|---|---|
| `governance/dto/approval-governance-record.out.dto.ts` | `services/workflow/dto/approval-governance-record.out.dto.ts` | Workflow Repository 写入并查询审批治理投影 |
| `ApprovalGovernanceRecordOutDto` | 类型名不变 | 方向仍然是离开 Workflow |
| `governance/value/approval-governance-domain.value.ts` | `services/workflow/value/approval-governance-domain.value.ts` | 该 Value 约束 Workflow 的统一审批投影域 |
| `ApprovalGovernanceDomainValue` | 类型名不变 | 语义仍然稳定且无请求方向 |
| `governance/dto/workflow-event.in.dto.ts` 中的 `WorkflowEventInDto` | `services/workflow/dto/workflow-event.in.dto.ts` | 数据进入 Workflow 的事件持久化和监督边界 |
| `governance/dto/workflow-event.out.dto.ts` | `services/workflow/dto/workflow-event.out.dto.ts` | 异常记录和停滞检测结果由 Workflow 输出 |
| `WorkflowExceptionRecordOutDto`、`StalledTaskDetectionOutDto` | 类型名不变 | 当前名称和方向与 Workflow 所有权一致 |
| `governance/port/workflow-state-reader.port.ts` | `services/workflow/port/workflow-state-reader.port.ts` | 该行为边界只服务 Workflow Supervisor |
| `WorkflowStateReaderPort` | 类型名不变 | Port 含可调用方法，角色正确 |
| `WorkflowEventCategoryValue`、`WorkflowEventStatusValue` | `services/workflow/value/workflow-event.value.ts` | 分类和处理状态由 Workflow 事件表及监督流程维护 |

### 5.2 迁入 Event Center

| 当前文件或类型 | 目标文件 | 理由 |
|---|---|---|
| `governance/dto/audit.out.dto.ts` | `services/support/capabilities/event-center/dto/audit.out.dto.ts` | BusinessAuditLog 生产并维护这些输出 |
| `AuditReasonOutDto`、`AuditTaskSummaryOutDto`、`AuditLogInfoOutDto` | 类型名不变 | 方向仍然是离开 Event Center |
| `EventCenterExceptionInDto` | `services/support/capabilities/event-center/dto/event-center-exception.in.dto.ts` | 数据直接进入 EventCenterFacade |
| `RendererExceptionInDto` | `services/support/capabilities/event-center/dto/renderer-exception.in.dto.ts` | Renderer 报告由 Event Center 接收和处理 |

原 `workflow-event.in.dto.ts` 必须拆成三个单一方向、单一所有者的文件，禁止把拆开的类型继续放进一个“公共异常”文件。

### 5.3 提升为跨域基础 Value

`WorkflowEventSeverityValue` 同时被 Workflow 事件记录和 Event Center 异常入口使用。为了避免支撑能力反向依赖业务 Workflow，应迁移并改名：

```text
contracts/governance/value/workflow-event.value.ts
  WorkflowEventSeverityValue

→ contracts/foundation/value/event-severity.value.ts
  EventSeverityValue
```

迁移后：

- Workflow 的事件 DTO 从 `foundation/index.ts` 导入 `EventSeverityValue`；
- Event Center 的异常输入 DTO 从 `foundation/index.ts` 导入 `EventSeverityValue`；
- 删除旧 `WorkflowEventSeverityValue`，不保留转发别名或第二权威定义；
- `WorkflowEventCategoryValue` 和 `WorkflowEventStatusValue` 继续归 Workflow。

## 6. 目标目录结构

```text
contracts/
├─ foundation/
│  ├─ index.ts
│  └─ value/
│     └─ event-severity.value.ts
│
├─ system/
│  └─ desktop/
│     ├─ api/
│     ├─ dto/
│     ├─ value/
│     └─ index.ts
│
└─ services/
   ├─ workflow/
   │  ├─ dto/
   │  │  ├─ approval-governance-record.out.dto.ts
   │  │  ├─ workflow-event.in.dto.ts
   │  │  └─ workflow-event.out.dto.ts
   │  ├─ port/
   │  │  └─ workflow-state-reader.port.ts
   │  ├─ value/
   │  │  ├─ approval-governance-domain.value.ts
   │  │  └─ workflow-event.value.ts
   │  └─ index.ts
   │
   └─ support/
      └─ capabilities/
         └─ event-center/
            ├─ dto/
            │  ├─ audit.out.dto.ts
            │  ├─ event-center-exception.in.dto.ts
            │  └─ renderer-exception.in.dto.ts
            ├─ port/
            └─ index.ts
```

拆分完成后：

```text
contracts/governance
```

必须不存在，且全工程不得残留 `contracts/governance` 导入。

## 7. 依赖方向

目标依赖关系为：

```text
foundation
   ▲
   ├──────── workflow contracts
   └──────── event-center contracts

workflow implementation ───────► workflow contracts
event-center implementation ───► event-center contracts

system/desktop API ─────────────► 两个所有者的公开 index
Renderer ───────────────────────► system/desktop 聚合出口
```

禁止出现：

```text
event-center contracts ──► workflow contracts
workflow contracts ──────► event-center internal
contracts ───────────────► Electron 实现
```

## 8. 导入与公开出口修正

### 8.1 Electron 主进程

主进程必须从真实所有者的 `index.ts` 导入：

```ts
import type {
  ApprovalGovernanceRecordOutDto,
  WorkflowEventInDto,
  WorkflowExceptionRecordOutDto,
  WorkflowStateReaderPort,
} from "../../../../contracts/services/workflow/index.js";

import type {
  EventCenterExceptionInDto,
} from "../../../../../contracts/services/support/capabilities/event-center/index.js";
```

相对路径层级以调用文件实际位置为准；示例只表达所有者入口，实施时不得复制错误层级。

### 8.2 DesktopApi

`contracts/system/desktop/api/desktop.api.ts` 应分别从：

- `services/workflow/index.ts` 导入审批治理输出；
- `services/support/capabilities/event-center/index.ts` 导入审计和 Renderer 异常协议。

`contracts/system/desktop/index.ts` 可以继续显式聚合 Renderer 所需类型，但必须逐项标明真实来源，禁止重新创建治理领域转发层。

### 8.3 Renderer

Renderer 继续只从 `contracts/system/desktop` 聚合出口导入，不直接跨越 DesktopApi 依赖 Electron 服务协议。这样页面使用方式稳定，同时协议物理所有权仍然清晰。

## 9. 七步实施顺序

### 第一步：建立目标基础 Value

- 新建 `foundation/value/event-severity.value.ts`；
- 在 `foundation/index.ts` 显式导出 `EventSeverityValue`；
- 暂不删除旧定义，先完成所有调用点清单。

### 第二步：迁移 Workflow 协议

- 移动审批治理 DTO、工作流事件 DTO、状态读取 Port 和 Workflow 专属 Value；
- 更新 `services/workflow/index.ts`；
- 更新 Workflow Repository、Supervisor、令狐异常接手等导入。

### 第三步：迁移 Event Center 协议

- 移动审计输出 DTO；
- 把两类异常输入拆成独立文件；
- 更新 Event Center、BusinessAuditLog、南宫和运行时异常端口的导入；
- 更新 `event-center/index.ts`。

### 第四步：修正跨进程聚合

- 更新 `desktop.api.ts` 的所有者导入；
- 更新 `system/desktop/index.ts` 的显式导出来源；
- 保持 preload IPC 名称与 Renderer 调用 API 不变。

### 第五步：删除旧 Governance 根

- 删除 `contracts/governance/index.ts`；
- 删除已迁空的 `dto`、`port`、`value`；
- 删除 `contracts/governance`；
- 全工程确认旧路径、旧严重级别类型和兼容别名均为零。

### 第六步：同步结构说明和架构门禁

- 更新 `contracts/README.md`，移除 Governance 顶层例外；
- 更新 `apps/ai-desktop/ARCHITECTURE.md` 的阅读路径；
- 更新相关迁移文档，把本方案标记为 Governance 归属修正的权威补充；
- 架构规则明确禁止没有 Electron 真实所有者的 Contracts 主题根目录。

### 第七步：登记并执行统一验证

源码修改完成后先登记测试文档，不自动重复执行完整测试。用户明确要求“统一测试”后执行：

1. Contracts 旧路径和旧公开类型归零检查；
2. Contracts 同构和公开 `index.ts` 静态门禁；
3. TypeScript 类型检查；
4. Electron 主进程构建；
5. Renderer 构建；
6. IPC 契约回归；
7. 审批治理查询、审计信息读取、Renderer 异常上报、停滞任务检测和令狐异常接手回归。

## 10. 静态验收标准

以下检查必须全部满足：

```text
contracts/governance 目录不存在
contracts/governance 导入数量 = 0
WorkflowEventSeverityValue 定义和引用数量 = 0
ApprovalGovernanceRecordOutDto 唯一定义位于 services/workflow
WorkflowStateReaderPort 唯一定义位于 services/workflow
AuditLogInfoOutDto 唯一定义位于 event-center
EventCenterExceptionInDto 唯一定义位于 event-center
RendererExceptionInDto 唯一定义位于 event-center
EventSeverityValue 唯一定义位于 foundation
```

还必须确认：

- 每个目标模块只有一个公开 `index.ts`；
- 跨模块没有深层导入 `dto/port/value`；
- 没有 `export *` 或 `export type *`；
- 没有为了兼容保留第二份 DTO、Value 或假入口；
- DesktopApi 方法签名和 IPC channel 不因物理迁移而改变。

## 11. 业务回归验收

| 场景 | 预期结果 |
|---|---|
| 查询审批治理记录 | 返回 Evolution、协作评审和 Codex 命令授权的统一读模型 |
| 查询审计日志信息 | 返回路径、任务数量和最新审计任务 |
| Renderer 上报异常 | Event Center 接收、裁剪并记录异常，不暴露 Electron 内部对象 |
| Workflow 检测停滞任务 | 输出停滞任务并写入待处理异常事件 |
| 令狐接手异常 | 能读取 Workflow 输出的未处理异常并进入既有处理流程 |
| 应用启动与退出 | Event Center 的持久化投影仍按既有生命周期挂载和释放 |

## 12. 风险与控制

### 风险一：只移动文件，不拆分混合类型

控制：`workflow-event.in.dto.ts` 必须按所有者拆文件，禁止整体搬到任意一方。

### 风险二：为避免改导入而保留旧 Governance 转发入口

控制：一次性更新全部引用并删除旧入口；不保留兼容别名。

### 风险三：Event Center 反向依赖 Workflow

控制：把跨域稳定严重级别提升到 `foundation/EventSeverityValue`，两方只依赖基础层。

### 风险四：物理迁移误改业务行为

控制：第一轮只改变协议物理归属、公开出口和类型名称，不改数据库表、IPC channel、Facade 行为和状态机。

### 风险五：文档声称完成但代码尚未迁移

控制：本文件保持“方案”状态；只有七步实施、统一测试和静态归零全部完成后，才能标记为“已实施并验证”。

## 13. 完成定义

只有同时满足以下条件，Governance 拆分才算完成：

1. 顶层 `contracts/governance` 已删除；
2. 每个协议只有一个真实所有者和一个权威定义；
3. Contracts 与 Electron 的 Workflow、Event Center 路径可以双向定位；
4. `foundation` 只保存真正跨域稳定 Value；
5. DesktopApi 只聚合，不夺取业务所有权；
6. 架构说明和规则已同步；
7. 测试文档中的全部门禁经用户触发统一测试后通过。

