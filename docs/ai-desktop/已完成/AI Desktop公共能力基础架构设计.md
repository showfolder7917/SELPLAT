# AI Desktop 公共能力基础架构设计

## 1. 文档状态

- 文档性质：目标架构与分阶段迁移设计，不代表源码已经完成迁移。
- 适用工程：`apps/ai-desktop`。
- 适用边界：Contracts、Electron 主进程、preload、Renderer。
- 当前目标：把人物业务、公共应用能力和底层技术实现分开，降低多人并行修改时的文件交叉。
- 前置设计：`docs/ai-desktop/待完成文档/南宫韩立令狐并列模块拆分设计.md`。
- 本轮范围：只编写设计文档，不移动或修改业务源码。

## 2. 为什么需要公共能力区

当前 `electron/services` 同时存在三种不同性质的代码：

1. 南宫、韩立、令狐等人物业务。
2. 会话执行、事件中心、测试、发布等公共应用能力。
3. Codex、SQLite、工作区、设置、安全等底层技术实现。

这些代码目前部分位于目录中，部分平铺在 `electron/services` 根层。例如：

```text
electron/services/
├─ codex-service.ts
├─ codex-runtime.ts
├─ codex-session-store.ts
├─ conversation-dispatch-store.ts
├─ managed-task-executor.ts
├─ workspace-store.ts
├─ settings-store.ts
├─ screenshot-store.ts
├─ trusted-command-store.ts
├─ automatic-test-preflight.ts
├─ business-audit-log.ts
├─ codex/
├─ collaboration/
├─ event-center/
└─ rules/
```

这种结构存在以下问题：

- 文件名能说明局部职责，但不能说明所属架构层。
- 人物模块容易直接引用具体 Store、Runner 或 Codex 实现。
- `collaboration` 逐渐同时容纳人物、流程、测试和发布。
- 根目录平铺文件会随着能力增加持续膨胀。
- 多人修改同一个组合文件或大型 Service 时容易产生合并冲突。
- 未来替换 Codex、SQLite 或文件存储时，业务调用方可能被迫一起修改。

## 3. 核心结论

AI Desktop 的主进程服务划分为五个平行区域：

```text
personas      = 人物自己的业务判断与行为
evolution     = 多人物共同处理的演化业务数据
workflow      = 跨人物业务流程编排
capabilities  = 多个业务模块复用的应用能力
platform      = 外部程序、数据库、文件和操作系统适配
```

调用方向固定为：

```text
Renderer
   ↓
DesktopApi / preload / IPC
   ↓
人物、Evolution、Workflow
   ↓
公共应用能力 capabilities
   ↓
技术基础设施 platform
```

下层不得反向依赖上层：

```text
platform     -X-> capabilities
platform     -X-> workflow
platform     -X-> personas
capabilities -X-> 具体人物 internal
```

## 4. 不建立巨大 common 目录

公共能力不等于全部放进 `common`。

`common` 容易逐渐变成无法判断归属的杂物目录，因此本设计使用两个含义明确的区域：

| 区域 | 判断问题 | 示例 |
|---|---|---|
| `capabilities` | 这是应用提供的什么可复用能力 | 会话、执行、测试、发布、事件中心 |
| `platform` | 这项能力依赖什么外部技术 | Codex、SQLite、文件系统、工作区、系统设置 |

判断是否属于公共能力时，不以“有几个文件调用它”为唯一标准，而应判断：

> 去掉南宫、韩立、令狐的具体人物业务后，这项能力是否仍有独立、稳定的意义。

例如：

- Codex 登录、模型、会话和流事件仍有意义，属于 `platform/codex`。
- 工作区安全校验与人物无关，属于 `platform/workspace`。
- 统一测试可以被多个流程触发，属于 `capabilities/testing`。
- 韩立审批即使被 Workflow 调用，仍是韩立业务判断，属于 `personas/hanli`。
- 令狐故障分析即使使用公共日志，仍是令狐人物能力，属于 `personas/linghu`。

## 5. 目标 Electron 主进程目录

```text
apps/ai-desktop/electron/services/
├─ personas/
│  ├─ nangong/
│  │  ├─ index.ts
│  │  ├─ nangong.facade.ts
│  │  └─ internal/
│  ├─ hanli/
│  │  ├─ index.ts
│  │  ├─ hanli.facade.ts
│  │  └─ internal/
│  └─ linghu/
│     ├─ index.ts
│     ├─ linghu-automation.facade.ts
│     └─ internal/
│
├─ evolution/
│  ├─ index.ts
│  ├─ evolution.facade.ts
│  └─ internal/
│
├─ workflow/
│  ├─ index.ts
│  ├─ collaboration-workflow.facade.ts
│  └─ internal/
│
├─ capabilities/
│  ├─ conversation/
│  ├─ execution/
│  ├─ event-center/
│  ├─ testing/
│  ├─ release/
│  └─ rules/
│
└─ platform/
   ├─ codex/
   ├─ persistence/
   ├─ workspace/
   ├─ settings/
   ├─ security/
   └─ attachments/
```

这里的 `personas` 只是人物模块的父目录，不允许在该父目录存放人物共同业务状态。共同数据仍由 `evolution` 所有，共同流程仍由 `workflow` 编排。

## 6. Personas 人物业务区

人物模块负责“这个人物怎样理解和处理业务”，不负责通用技术实现。

### 6.1 南宫

南宫负责：

- 用户对话和需求澄清。
- 调查现状。
- 形成专题。
- 创建、补充和返修提案。
- 输出南宫人物状态和人物事件。

南宫不负责：

- 启动 Codex 子进程。
- 保存公共工作区。
- 实现 SQLite 事务。
- 替韩立作出审批判断。
- 决定完整跨人物流程的下一节点。

### 6.2 韩立

韩立负责：

- 研讨提案。
- 审批方向。
- 生成验收计划。
- 判断真实应用验收结果。
- 输出韩立人物状态和人物事件。

韩立不负责：

- 直接读取 Codex 底层 JSON-RPC。
- 保存完整 Evolution 聚合副本。
- 直接调用令狐 internal Runner。
- 维护公共测试资源锁。

### 6.3 令狐

令狐负责：

- 分析流程停点。
- 形成故障诊断。
- 发起修正提案。
- 检查测试漏点。
- 触发受控统一测试。
- 执行有限恢复。

令狐可以调用公共测试 Facade，但公共测试的锁、进程、端口和资源租约不应成为令狐私有实现。

## 7. Evolution 中立业务数据区

Evolution 保存多个人物共同处理的业务事实：

- 专题。
- 提案和提案版本。
- 方向审批和结果审批。
- 分发计划。
- 验收计划和验收结果。
- 任务关联。
- 演化档案。
- 工作台投影。

Evolution 是业务域，不属于 `capabilities` 或 `platform`。

虽然多个人物都会访问 Evolution，但它拥有明确的演化业务语义，并不是任意模块都能复用的通用工具。

## 8. Workflow 流程编排区

Workflow 负责：

- 判断当前流程节点。
- 判断下一位处理人物。
- 调用人物公开 Port。
- 调用 Evolution 读取和提交共同状态。
- 处理暂停、恢复、停止和人工接管。
- 防止同一节点重复执行。
- 记录跨人物流程事实。

Workflow 不负责：

- 生成人物自己的业务结论。
- 操作人物私有 Store。
- 直接启动 Codex 子进程。
- 直接执行 Shell、测试或发布命令。
- 实现 SQLite 文件读写。

## 9. Capabilities 公共应用能力区

Capabilities 表示 AI Desktop 自己向各业务模块提供的可复用能力。

### 9.1 Conversation 会话能力

目标目录：

```text
capabilities/conversation/
├─ index.ts
├─ conversation.facade.ts
└─ internal/
   ├─ conversation-dispatch.store.ts
   ├─ conversation-queue.service.ts
   └─ conversation-recovery.service.ts
```

负责：

- 发送请求排队。
- 当前活动会话状态。
- Electron 重启后的可恢复状态。
- 显式补充消息。
- 队列去重。

不负责：

- 决定南宫或韩立应该说什么。
- 直接实现 Codex app-server 协议。
- 保存训练语料。

### 9.2 Execution 受管执行能力

目标目录：

```text
capabilities/execution/
├─ index.ts
├─ managed-execution.facade.ts
└─ internal/
   ├─ managed-task.executor.ts
   ├─ execution-stage.policy.ts
   └─ execution-progress.projector.ts
```

负责：

- 管理需求分析、代码执行和验证等多轮阶段。
- 输出统一执行进度。
- 处理完成、继续和阻塞状态。
- 通过 Port 调用具体 AI Runtime。

不负责：

- 写死 Codex 安装路径。
- 直接操作人物私有提示词。
- 代替 Workflow 决定人物业务顺序。

### 9.3 Event Center 事件中心

目标目录：

```text
capabilities/event-center/
├─ index.ts
├─ event-center.facade.ts
└─ internal/
   ├─ audit/
   ├─ timeline/
   ├─ corpus/
   └─ projection/
```

负责：

- 接收应用事件和异常。
- 写入审计归档。
- 形成协作时间线。
- 形成会话训练语料投影。
- 在事务提交后通知 Renderer。

事件中心是统一入口，但不是所有业务状态的所有者。它保存事件事实和投影，不能替代 Evolution、Workflow 或人物 Store。

### 9.4 Testing 测试能力

目标目录：

```text
capabilities/testing/
├─ index.ts
├─ test-resource-coordinator.facade.ts
├─ automatic-test-preflight.facade.ts
└─ internal/
   ├─ test-resource-lease.store.ts
   ├─ task-worktree-test.runner.ts
   └─ test-environment.validator.ts
```

负责：

- 测试前置检查。
- 测试资源锁和跨进程租约。
- 测试端口、构建目录和工作树隔离。
- 执行登记的固定测试。
- 输出测试事实和结果。

令狐是统一测试流程的业务发起者之一，但测试资源协调是公共能力，未来其他人物和人工入口也可以通过同一 Facade 使用。

### 9.5 Release 版本集成与发布能力

目标目录：

```text
capabilities/release/
├─ index.ts
├─ integration-release.facade.ts
└─ internal/
   ├─ version-integration.pipeline.ts
   ├─ version-workspace.manager.ts
   ├─ release-batch.store.ts
   ├─ integration.verifier.ts
   └─ verified-package.release.ts
```

负责：

- 汇总已冻结的任务结果。
- 串行集成版本。
- 创建发布候选。
- 验证候选工作区。
- 打包和发布已验证产物。
- 保存发布批次事实。

人物可以申请或触发发布流程，但人物模块不能自己拼接 Git、构建和发布实现。

### 9.6 Rules 规则能力

目标目录：

```text
capabilities/rules/
├─ index.ts
├─ rule-bundle.facade.ts
└─ internal/
   ├─ rule-bundle.loader.ts
   ├─ customer-overlay.validator.ts
   └─ effective-rule.assembler.ts
```

负责：

- 加载内置生产规则包。
- 校验客户覆盖。
- 组装实际生效规则。
- 为 Codex 会话提供开发约束。
- 提供只读来源查询。

## 10. Platform 技术基础设施区

Platform 负责把外部技术转换成应用可使用的稳定接口。

### 10.1 Codex 平台适配

目标目录：

```text
platform/codex/
├─ index.ts
├─ codex.facade.ts
└─ internal/
   ├─ codex-app-server.client.ts
   ├─ codex-runtime.resolver.ts
   ├─ codex-session.repository.ts
   ├─ codex-stream-event.mapper.ts
   ├─ codex-approval.gateway.ts
   └─ codex-model-catalog.gateway.ts
```

负责：

- 定位、校验和启动指定版本 Codex。
- 与 Codex app-server 通信。
- 管理登录、模型、审批和用户输入。
- 创建、恢复和清理线程。
- 将底层流事件转换为稳定应用事件。

Codex 是公共底层 AI 执行引擎，不是南宫、韩立、令狐之外的第四个业务人物。

人物通过公共 AI 执行 Port 使用 Codex：

```text
NangongFacade ─┐
HanliFacade   ─┼─> AiConversationPort ─> CodexFacade
LinghuFacade  ─┘
```

这样未来增加第二种 AI Runtime 时，不需要修改每个人物的业务代码。

### 10.2 Persistence 持久化平台

目标目录：

```text
platform/persistence/
├─ index.ts
├─ database.facade.ts
└─ internal/
   ├─ sqlite-database.ts
   ├─ sqlite-migration.runner.ts
   ├─ sqlite-transaction.ts
   └─ file-storage.adapter.ts
```

负责：

- SQLite 连接和生命周期。
- 数据库迁移。
- 事务边界。
- 通用文件原子写入能力。

不负责：

- 决定专题、提案或审批表结构的业务含义。
- 暴露任意 SQL 给 Renderer。
- 把所有 Repository 都集中到 platform。

业务 Repository 仍应留在所属业务模块，只通过数据库 Port 使用 SQLite。

### 10.3 Workspace 工作区平台

目标目录：

```text
platform/workspace/
├─ index.ts
├─ workspace.facade.ts
└─ internal/
   ├─ workspace.store.ts
   ├─ workspace-path.validator.ts
   └─ workspace-id.resolver.ts
```

负责可信工作区登记、路径校验和 ID 到真实路径的受控解析。

### 10.4 Settings 设置平台

目标目录：

```text
platform/settings/
├─ index.ts
├─ settings.facade.ts
└─ internal/
   ├─ settings.store.ts
   └─ settings.validator.ts
```

负责应用设置的默认值、读取、校验和保存。

### 10.5 Security 安全平台

目标目录：

```text
platform/security/
├─ index.ts
├─ command-governance.facade.ts
└─ internal/
   ├─ trusted-command.store.ts
   ├─ command-policy.validator.ts
   └─ approval-scope.resolver.ts
```

负责命令审批、信任范围和项目边界校验，不负责决定业务流程是否应该执行某条命令。

### 10.6 Attachments 附件平台

目标目录：

```text
platform/attachments/
├─ index.ts
├─ attachment.facade.ts
└─ internal/
   ├─ screenshot.store.ts
   ├─ attachment-path.validator.ts
   └─ attachment-cleanup.service.ts
```

负责截图和附件 ID、受控路径、临时生命周期及清理。

## 11. Facade、Port、Adapter 和 internal

这四个概念的关系如下：

| 名称 | 用途 | 谁可以调用 |
|---|---|---|
| Facade | 模块对外唯一业务入口 | 其他模块、IPC 组合层 |
| Port | 调用方需要的最小能力接口 | 上层模块依赖 |
| Adapter | 对 Port 的具体技术实现 | Runtime 组合层 |
| internal | 模块私有实现 | 仅所属模块内部 |

示例调用关系：

```text
NangongFacade
    ↓ 依赖接口
AiConversationPort
    ↓ Runtime 注入实现
CodexFacadeAdapter
    ↓
Codex app-server
```

南宫只知道“可以发送人物对话”，不需要知道：

- Codex 可执行文件在哪里。
- app-server 使用什么 JSON-RPC 方法。
- Thread ID 保存到文件还是 SQLite。
- 原始流事件怎样裁剪。

## 12. 每个模块的唯一公开出口

每个目录根层只保留：

- `index.ts`。
- 一个或少量职责明确的 Facade。
- 必要的公开 Port 和 Runtime 类型。

`index.ts` 只重新导出允许外部使用的 API。

禁止通过 index 公开：

- Store。
- Repository 具体实现。
- Runner 具体实现。
- Analyzer 具体实现。
- Mapper。
- 内部异常类。
- 底层路径常量。
- 数据库连接对象。
- 子进程对象。

外部也禁止绕过 index 直接导入：

```text
platform/codex/internal/codex-session.repository
capabilities/testing/internal/task-worktree-test.runner
personas/linghu/internal/linghu-flow.analyzer
```

## 13. Contracts 目标结构

Contracts 只保存 Electron 主进程、preload 和 Renderer 共同使用的纯 TypeScript 数据协议，不保存业务实现。

目标结构：

```text
apps/ai-desktop/contracts/
├─ foundation/
├─ desktop/
├─ platform/
│  ├─ codex/
│  ├─ workspace/
│  ├─ settings/
│  ├─ security/
│  └─ attachments/
├─ capabilities/
│  ├─ conversation/
│  ├─ execution/
│  ├─ event-center/
│  ├─ testing/
│  ├─ release/
│  └─ rules/
├─ collaboration/
│  ├─ nangong/
│  ├─ hanli/
│  ├─ linghu/
│  ├─ evolution/
│  └─ workflow/
└─ governance/
```

说明：

- `foundation` 只保存稳定枚举和基础值对象。
- `desktop` 保存 DesktopApi 组合出口和桌面壳协议。
- `platform` 保存技术能力跨进程协议。
- `capabilities` 保存公共应用能力协议。
- `collaboration` 保存人物、Evolution 和 Workflow 协议。
- `governance` 保存审计、异常和治理投影协议。

DTO 继续使用直观方向命名：

```text
进入模块       XxxInDto
离开模块       XxxOutDto
模块主动通知   XxxEventOutDto
```

方向始终站在所属模块边界判断。例如：

```text
SendCodexMessageInDto
CodexMessageResultOutDto
CodexStreamEventOutDto
```

## 14. Preload 和 IPC 边界

完整跨进程调用固定为：

```text
Renderer Feature
      ↓ typed DesktopApi
preload 领域桥接
      ↓ 白名单 IPC channel
IPC handler
      ↓ 请求校验与简单编排
Facade
      ↓ Port
internal / platform adapter
```

### 14.1 Preload 只负责

- 暴露登记过的 DesktopApi 方法。
- 转发请求。
- 订阅和取消订阅事件。
- 维持 Electron 沙箱边界。

### 14.2 IPC handler 只负责

- 校验输入结构。
- 获取已组合的 Facade。
- 调用一个明确应用入口。
- 转换已知错误为稳定返回。

### 14.3 IPC handler 禁止负责

- 执行复杂业务状态机。
- 直接访问 SQLite。
- 直接操作 Store。
- 拼装人物提示词。
- 启动测试或发布子进程。

## 15. Renderer 目标结构

Renderer 按用户看到的功能组织，不复制主进程技术目录：

```text
apps/ai-desktop/src/features/
├─ nangong/
├─ hanli/
├─ linghu/
├─ evolution/
├─ workflow/
├─ conversation/
├─ testing/
├─ release/
├─ governance/
├─ settings/
└─ workspace/
```

Renderer 不需要创建 `codex/internal` 或 `persistence` 页面目录，因为 Codex 和 SQLite 是技术实现，不是必须直接暴露给用户的页面信息架构。

## 16. 当前文件到目标区域的迁移映射

| 当前文件或目录 | 目标位置 | 归属理由 |
|---|---|---|
| `services/codex-service.ts` | `platform/codex/codex.facade.ts` 与 internal client | Codex 统一技术入口 |
| `services/codex-runtime.ts` | `platform/codex/internal/codex-runtime.resolver.ts` | Codex 程序解析与安装 |
| `services/codex-session-store.ts` | `platform/codex/internal/codex-session.repository.ts` | Codex Thread 恢复 |
| `services/codex/stream-event-mapper.ts` | `platform/codex/internal/codex-stream-event.mapper.ts` | 外部事件适配 |
| `services/conversation-dispatch-store.ts` | `capabilities/conversation/internal/` | 会话排队和恢复 |
| `services/managed-task-executor.ts` | `capabilities/execution/internal/` | 公共多轮执行 |
| `services/automatic-test-preflight.ts` | `capabilities/testing/` | 测试前置检查 |
| `services/workspace-store.ts` | `platform/workspace/internal/` | 工作区技术状态 |
| `services/settings-store.ts` | `platform/settings/internal/` | 设置持久化 |
| `services/trusted-command-store.ts` | `platform/security/internal/` | 安全授权持久化 |
| `services/screenshot-store.ts` | `platform/attachments/internal/` | 附件技术存储 |
| `services/business-audit-log.ts` | `capabilities/event-center/internal/audit/` | 统一审计输出 |
| `services/event-center/*` | `capabilities/event-center/` | 公共事件与投影 |
| `services/event-center/persistence/sqlite-*` | `platform/persistence/internal/` | SQLite 通用实现 |
| `services/rules/rule-bundle-service.ts` | `capabilities/rules/` | 规则包应用能力 |
| `collaboration/test-resource-coordinator-facade.ts` | `capabilities/testing/` | 跨人物测试资源 |
| `collaboration/task-worktree-test-runner.ts` | `capabilities/testing/internal/` | 固定测试执行 |
| `collaboration/integration-release-coordinator-facade.ts` | `capabilities/release/` | 公共集成发布入口 |
| `collaboration/version-integration-pipeline.ts` | `capabilities/release/internal/` | 发布流水线 |
| `collaboration/version-workspace-manager.ts` | `capabilities/release/internal/` | 候选工作区管理 |
| `collaboration/release-batch-store.ts` | `capabilities/release/internal/` | 发布批次状态 |
| `collaboration/integration-verifier.ts` | `capabilities/release/internal/` | 集成验证 |
| `collaboration/verified-package-release.ts` | `capabilities/release/internal/` | 已验证包发布 |

该表是职责映射，不代表可以直接剪切文件。迁移前必须逐个核对调用方、状态所有权、IPC 注册、测试和运行时组合。

## 17. 不应错误迁移的文件

以下文件即使当前被多个模块调用，也不能仅凭复用次数移入公共区：

| 文件或职责 | 保留区域 | 原因 |
|---|---|---|
| 南宫调查与提案 | `personas/nangong` | 人物业务判断 |
| 韩立审批与验收 | `personas/hanli` | 人物业务判断 |
| 令狐故障分析 | `personas/linghu` | 人物业务判断 |
| Evolution 提案 Repository | `evolution/internal` | 演化业务数据所有权 |
| Workflow 状态机 | `workflow/internal` | 跨人物业务编排 |
| 人物提示词 | 各人物模块 | 人物私有数据 |
| 人物私有会话游标 | 各人物模块 | 人物私有状态 |

## 18. Runtime 组合根

Electron `main.ts` 或专门 Composition Root 负责创建对象和注入依赖，但不实现业务。

目标组合顺序：

```text
1. 创建 Platform
   - Persistence
   - Workspace
   - Settings
   - Security
   - Attachments
   - Codex

2. 创建 Capabilities
   - Event Center
   - Conversation
   - Execution
   - Testing
   - Release
   - Rules

3. 创建业务模块
   - Evolution
   - Nangong
   - Hanli
   - Linghu

4. 创建 Workflow
   - 注入人物 Port
   - 注入 Evolution Port
   - 注入所需公共能力 Port

5. 注册 IPC
   - 只传入受控 Facade
```

组合根可以知道所有具体实现，但任何具体模块都不能反向依赖组合根。

## 19. 公共能力之间的依赖规则

允许：

```text
capabilities/conversation -> platform/codex Port
capabilities/testing      -> platform/workspace Port
capabilities/testing      -> platform/security Port
capabilities/release      -> platform/workspace Port
capabilities/event-center -> platform/persistence Port
capabilities/rules        -> platform/persistence 或只读文件 Port
```

禁止：

```text
platform/codex       -> capabilities/conversation
platform/persistence -> capabilities/event-center
capabilities/testing -> personas/linghu/internal
capabilities/release -> personas/hanli/internal
```

当两个公共能力互相需要时，优先检查是否存在职责混合。确实需要协作时，通过更小的 Port 或由上层 Workflow/Composition Root 编排，不能直接形成循环 import。

## 20. 命名规范

文件名使用职责明确的小写 kebab-case，并通过后缀表达角色：

| 角色 | 文件示例 |
|---|---|
| 门面 | `codex.facade.ts` |
| 服务 | `conversation-queue.service.ts` |
| 存储抽象实现 | `codex-session.repository.ts` |
| 状态存储 | `conversation-dispatch.store.ts` |
| 执行器 | `managed-task.executor.ts` |
| Runner | `task-worktree-test.runner.ts` |
| 转换器 | `codex-stream-event.mapper.ts` |
| 校验器 | `workspace-path.validator.ts` |
| 组装器 | `effective-rule.assembler.ts` |
| 解析器 | `codex-runtime.resolver.ts` |

不要把所有文件统一命名为 `xxx-service.ts`。文件名应让学习者在不打开代码时也能判断它负责执行、存储、转换、校验还是对外协调。

## 21. TypeScript 业务注释要求

后续实施时，公开类型和方法必须优先解释业务，而不是逐字翻译语法。

每个公开方法依次说明：

1. 方法作用。
2. 真实传参示例。
3. 真实返回示例。
4. 异常或副作用示例。

关键代码行应解释：

- 为什么需要这一步安全检查。
- 为什么此处进行状态迁移。
- 为什么需要事件裁剪或脱敏。
- 为什么兼容旧状态。
- 为什么必须限制路径。

不应写没有学习价值的注释，例如：

```ts
// 把 enabled 设置为 true。
enabled = true;
```

应该解释真实业务原因，例如：

```ts
// 只有用户显式开启自动运行后才保存开关，应用重启不能自行扩大执行权限。
enabled = true;
```

## 22. 推荐迁移阶段

### 阶段 0：冻结现有行为

- 记录当前 IPC 能力。
- 记录 Codex 登录、会话、审批和流事件行为。
- 记录工作区、设置、截图和命令信任行为。
- 记录测试、发布和事件中心行为。
- 建立静态依赖扫描基线。

### 阶段 1：建立目录壳层

- 建立 `platform` 和 `capabilities`。
- 为每个模块建立唯一 `index.ts`。
- 暂时使用兼容转发，保持运行对象不变。
- 不在本阶段修改业务语义。

### 阶段 2：收拢 Codex

- 先迁移 Runtime、Session Repository 和 Event Mapper。
- 再将 `CodexService` 收敛为 Facade 与 internal client。
- 让现有调用方只从 `platform/codex/index.ts` 导入。
- 保持原登录、审批、线程恢复和流事件编码。

### 阶段 3：收拢桌面 Platform

- 迁移 Workspace。
- 迁移 Settings。
- 迁移 Security。
- 迁移 Attachments。
- 提取最小 Port，禁止外部直接持有 Store。

### 阶段 4：收拢 Conversation 与 Execution

- 分离会话队列和 Codex 技术实现。
- 分离多轮执行状态和人物业务流程。
- 保持队列恢复与取消语义。

### 阶段 5：收拢 Event Center 与 Persistence

- Event Center 保持统一应用入口。
- SQLite 技术实现进入 Platform。
- 业务 Repository 保持在所属业务模块。
- 保持事务提交后通知页面的顺序。

### 阶段 6：收拢 Testing、Release 和 Rules

- 把测试资源协调与令狐人物判断分开。
- 把版本集成与人物协调分开。
- 把规则能力作为公共应用服务公开。
- 保持现有锁、恢复、审计和发布门禁。

### 阶段 7：整理 Contracts

- 先建立新目录和新 index。
- 按模块边界拆分 InDto、OutDto 和 EventOutDto。
- 逐调用方迁移。
- 确认不存在两个权威 DTO 后删除兼容别名。

### 阶段 8：收紧 import 边界

- 禁止外部直接导入 internal。
- 禁止人物直接导入 Platform 具体实现。
- 禁止 Platform 反向导入业务模块。
- 禁止 IPC handler 直接导入 Store、Runner 或 Repository。

### 阶段 9：统一测试和删除兼容层

用户明确提出统一测试后：

- 执行登记的全部静态和运行测试。
- 执行真实 Electron 沙箱测试。
- 执行 Codex 会话与流事件回归。
- 执行数据库迁移和重启恢复回归。
- 执行统一测试、集成与发布回归。
- 删除旧路径和兼容转发。

## 23. 测试门禁

### 23.1 静态目录门禁

- `electron/services` 根层不再平铺具体 Service。
- 每个模块只从自己的 `index.ts` 对外公开。
- 外部不能导入任意 `internal`。
- Platform 不能依赖 Personas、Evolution 或 Workflow。
- Capabilities 不能依赖具体人物 internal。
- Renderer 不能导入 Electron 主进程实现。

### 23.2 Contracts 门禁

- Contracts 保持纯 TypeScript 数据协议。
- Contracts 不依赖 Electron、React、文件系统或 SQLite。
- DTO 文件写明生产者、消费者和数据方向。
- InDto、OutDto 和 EventOutDto 方向一致。
- DesktopApi 与 preload 白名单一致。

### 23.3 Codex 回归

- 登录和退出。
- 模型列表。
- 新建会话和恢复线程。
- 发送、取消和补充消息。
- 命令与文件修改审批。
- 用户补充问题。
- 流消息、计划、命令输出和文件变化事件。
- Codex 退出和错误恢复。

### 23.4 公共能力回归

- 会话排队和重启恢复。
- 工作区路径安全。
- 设置读写。
- 命令信任范围。
- 截图附件生命周期。
- 事件中心事务后通知。
- 测试资源互斥。
- 发布候选串行集成。
- 规则包和客户覆盖加载。

### 23.5 人物业务回归

公共能力迁移后，南宫、韩立、令狐的业务结果必须保持一致：

- 人物身份不串线。
- 人物会话不串线。
- 提案和审批状态不丢失。
- Workflow 节点不重复执行。
- 令狐测试和恢复不扩大权限。

## 24. 多人协作规则

拆分后的目录应支持按职责分支并行：

- 人物开发者主要修改自己的 `personas/<name>`。
- Codex 维护者主要修改 `platform/codex`。
- 工作区和安全维护者修改相应 Platform 模块。
- 测试维护者修改 `capabilities/testing`。
- 发布维护者修改 `capabilities/release`。
- 流程维护者修改 `workflow`。

跨模块变更按以下顺序拆分：

1. 先修改公开 Port 或 DTO。
2. 再修改提供方实现。
3. 再逐个迁移消费方。
4. 最后删除兼容入口。

禁止多人同时在一个巨大 Facade 中修改不同职责。

## 25. 风险与控制

### 25.1 过度公共化

风险：任何被两处使用的函数都被移入公共区，导致业务含义丢失。

控制：必须证明能力离开具体人物后仍有独立语义，并拥有明确责任人和公开入口。

### 25.2 巨大 Platform

风险：Platform 变成新的 common。

控制：Platform 按外部技术边界拆分，每个模块保持独立 index 和 internal。

### 25.3 循环依赖

风险：Capabilities 和 Platform 相互引用，或者人物模块彼此引用。

控制：固定单向依赖，交叉协作由 Port、事件或上层组合完成。

### 25.4 状态所有权变化

风险：移动 Store 时把一份状态拆成多个权威副本。

控制：迁移前先确认唯一状态所有者；目录拆分不等于状态复制。

### 25.5 一次性大迁移

风险：大量 import、IPC、数据库和运行行为同时变化，难以定位回退原因。

控制：按照阶段迁移，每阶段保持兼容出口并形成独立回滚点。

### 25.6 名称与职责不一致

风险：文件虽然移动了，但内部仍然承担旧的混合职责。

控制：按业务能力和状态所有权拆分，不按文件行数机械切割。

## 26. 回滚策略

每个迁移阶段必须可以单独回滚：

1. 目录壳层阶段只回滚 import 和 re-export。
2. Codex 阶段保留旧 Facade 转发，直到会话和审批回归完成。
3. Platform 阶段保持原数据路径和格式兼容。
4. Capabilities 阶段保持原事件编码和恢复点。
5. Contracts 阶段保留短期类型别名，但不维护两套运行数据模型。
6. 统一测试通过后才删除旧文件和兼容出口。

## 27. 最终验收标准

满足以下条件才表示公共能力基础架构完成：

1. 南宫、韩立、令狐保持并列人物模块。
2. Evolution 是共同演化业务数据的唯一逻辑所有者。
3. Workflow 是跨人物流程的唯一编排者。
4. Codex 完整收拢到 `platform/codex`。
5. 工作区、设置、安全和附件分别拥有独立 Platform 模块。
6. 会话、执行、事件、测试、发布和规则分别拥有独立 Capability 模块。
7. `electron/services` 根层不再平铺具体业务 Service。
8. 每个模块只有一个受控公开 index。
9. 外部不能直接导入 internal。
10. 人物不依赖 Codex、SQLite、文件路径或子进程具体实现。
11. Platform 不反向依赖人物或 Workflow。
12. IPC handler 不直接访问 Store、Runner 或 Repository。
13. Contracts 与主进程目标模块边界能够对应。
14. Renderer 只通过 DesktopApi 使用主进程能力。
15. 现有会话、审批、测试、发布和持久化行为完成回归。
16. 旧状态可以兼容读取或完成受控迁移。
17. 静态依赖违规数为零。
18. 旧路径和临时兼容层已经删除。

## 28. 一句话架构规则

```text
人物负责业务判断，Evolution 负责共同业务数据，Workflow 负责编排，Capabilities 提供公共应用能力，Platform 隔离外部技术实现。
```
