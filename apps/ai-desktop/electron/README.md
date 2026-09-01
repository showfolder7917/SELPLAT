# AI Desktop Electron 目录说明

`electron` 是 AI Desktop 主进程和安全 preload 的源码根。目录固定收敛为两个主要区域：

- `system/`：让 Electron 程序安全启动、通信、显示和退出。
- `services/`：实现 AI Desktop 的应用能力，日常业务开发主要从这里进入。

## 1. 完整结构

```text
electron
├─ README.md
├─ main.ts
├─ packaged-bootstrap.ts
│
├─ system/
│  ├─ bootstrap/
│  │  ├─ application-runtime.ts
│  │  ├─ startup-context.ts
│  │  ├─ persistence.bootstrap.ts
│  │  ├─ capabilities.bootstrap.ts
│  │  ├─ collaboration.bootstrap.ts
│  │  ├─ personas.bootstrap.ts
│  │  └─ ipc.bootstrap.ts
│  ├─ config/
│  ├─ ipc/
│  │  └─ domains/
│  ├─ preload/
│  │  └─ domains/
│  ├─ policies/
│  └─ window/
│
└─ services/
   ├─ personas/
   │  ├─ nangong/
   │  ├─ hanli/
   │  ├─ linghu/
   │  └─ executor/
   ├─ evolution/
   ├─ workflow/
   └─ support/
      ├─ application/
      ├─ capabilities/
      └─ platform/
```

禁止在 `electron` 根下重新建立平行的 `bootstrap/config/ipc/preload/policies/window/application`，也禁止增加含义宽泛的 `common/utils/helpers/managers` 目录。

## 2. 根入口

### `main.ts`

只登记 Electron 顶层生命周期：

- ready 后调用 `startApplication()`；
- 启动失败时记录并退出；
- before-quit 调用 `disposeApplication()`；
- 所有窗口关闭时按平台规则退出。

数据库、人物、Workflow、IPC 和窗口参数不得回迁到 `main.ts`。

### `packaged-bootstrap.ts`

只负责发布包加载自身已经验证的主进程入口，不提供工程外运行时兼容逻辑。

## 3. `system`：Electron 系统层

系统层回答“程序怎样运行”，不回答“人物和业务怎样判断”。这里允许依赖 Electron API，并通过公开入口装配 services。

### `system/bootstrap`

应用组合根，按以下顺序建立稳定运行上下文：

```text
StartupContext
→ PersistenceContext
→ CapabilityContext
→ CollaborationContext
→ PersonaApplicationContext
→ IPC Application Ports
→ BrowserWindow
```

`application-runtime.ts` 统一持有长期资源并提供 `startApplication()`、`disposeApplication()`；其他 Bootstrap 按职责返回 Context 或公开 Facade 集合。

Bootstrap 只能导入 `services` 的公开 `index.ts` 或 Facade，不得导入其他模块 `internal`。

### `system/config`

解析应用名称、工程根、运行变体、发布模式和数据库路径。启动参数只在这里和 StartupContext 中解析一次，后续服务不得自行推断另一套路径。

### `system/ipc`

```text
ipc
├─ register-desktop-ipc.ts
├─ event-center-ipc.ts
└─ domains/register-<domain>-ipc.ts
```

IPC 只负责输入校验、调用公开 Facade、返回 Contracts 数据和登记异常。不得直接持有人物 Store、写 SQL 或实现业务判断。

### `system/preload`

```text
preload
├─ preload.cts
├─ ipc-client.cts
└─ domains/<domain>-bridge.cts
```

preload 只通过 `contextBridge` 暴露白名单。领域源码在构建时合并为 `system/preload/preload.cjs`，Renderer 不直接访问 Node.js 或 Electron Service。

### `system/policies`

保存 Electron 宿主级安全策略和覆盖授权判断。策略保持纯判断，不混入文件读写或业务流程。

### `system/window`

集中维护 BrowserWindow 安全配置、窗口尺寸和 Renderer 加载方式。业务 Feature 不直接创建主窗口。

## 4. `services`：应用服务层

服务层回答“AI Desktop 能做什么”。新业务代码首先判断所有者，再进入以下区域。

| 区域 | 唯一职责 | 禁止职责 |
|---|---|---|
| `personas` | 南宫、韩立、令狐和 Executor 各自能力 | 共享 Store、跨人物流程顺序 |
| `evolution` | 专题、提案、审批、验收和档案共享事实 | 人物提示词、任务调度 |
| `workflow` | 跨人物顺序、任务状态、恢复和监督 | 人物判断、人物 internal |
| `support/application` | 协调多个公开领域完成一个应用用例 | 人物判断、SQL 实现、Electron 生命周期 |
| `support/capabilities` | 会话、事件、执行、测试、发布、规则等复用能力 | 人物专属语义 |
| `support/platform` | Codex、数据库、设置、附件、工作区和安全基础设施 | 反向依赖人物或 Workflow |

### `services/support/application`

适合放置测试数据重置、受控重启等需要协调多个公开 Port 的用例。文件使用 `<use-case>.service.ts`，不得成为新的公共杂物区。

### `services/personas`

人物固定为并列模块：

```text
personas/<persona>
├─ index.ts
├─ <persona>.facade.ts
└─ internal/
   ├─ <persona>-application.service.ts
   ├─ <persona>-application.ports.ts
   └─ <specific-capability>.<role>.ts
```

人物之间不得导入对方 `internal`。动态普通执行成员统一使用 Executor Runtime，不按姓名复制目录。

### `services/evolution` 与 `services/workflow`

- Evolution 是共同专题事实的唯一所有者。
- Workflow 只根据公开人物能力和持久化事实决定流转顺序。
- 南宫负责任务规划，Executor 负责实际执行，令狐负责测试与恢复，韩立负责审批和验收。

### `services/support/capabilities`

只有被多个独立业务域复用、同时仍带有应用语义的能力才能进入这里。当前包括 conversation、event-center、execution、testing、release 和 rules。

### `services/support/platform`

提供可注入的技术能力。Platform 不认识具体人物、专题或 Workflow；它和 `system` 的区别是：

- `system` 管 Electron 宿主机制，例如窗口、IPC、preload 和启动。
- `platform` 给业务提供技术服务，例如 SQLite、Codex、设置和附件。

## 5. 固定依赖方向

```text
main.ts
  → system/bootstrap
  → services/personas | services/evolution | services/workflow
  → services/support/application | services/support/capabilities
  → services/support/platform

Renderer
  → Contracts DesktopApi
  → system/preload
  → system/ipc
  → services 公开 Facade
```

必须遵守：

1. `system` 可以装配 services，但不得实现人物业务。
2. `services/support/platform` 不得反向依赖其他服务区。
3. `services/support/capabilities` 可以依赖 platform，不得拥有人物专属语义。
4. 人物之间不得跨模块导入 `internal`。
5. Workflow 不得读取人物提示词、解析器或会话缓存。
6. IPC 不得导入 Store、Repository、Runner 或人物 internal。
7. 跨服务区只能从目标模块 `index.ts` 导入。
8. `internal` 永远不是跨模块入口。

## 6. 日常开发从哪里进入

### 修改某个人物能力

```text
services/personas/<persona>/index.ts
→ <persona>.facade.ts
→ internal/<persona>-application.service.ts
→ 具体内部能力
```

### 修改跨人物流程

```text
services/workflow/index.ts
→ Workflow Facade
→ internal runtime/orchestrator/repository
```

### 修改数据库、Codex 或设置

```text
services/support/platform/<domain>/index.ts
→ Facade
→ internal Store/Repository/Adapter
```

### 修改页面到主进程的调用

```text
contracts/desktop
→ system/preload/domains
→ system/ipc/domains
→ services 公开 Facade
```

### 修改启动装配

```text
main.ts
→ system/bootstrap/application-runtime.ts
→ 对应的 *.bootstrap.ts
```

## 7. 新文件放置判断

1. Electron 生命周期、窗口、IPC、preload、启动配置：放 `system`。
2. 跨多个领域协调一个用户用例：放 `services/support/application`。
3. 人物自己的提示词、解析和判断：放 `services/personas/<persona>`。
4. 共同专题事实：放 `services/evolution`。
5. 跨人物顺序和恢复：放 `services/workflow`。
6. 多个业务域复用的应用能力：放 `services/support/capabilities`。
7. 数据库、Codex、设置、附件等技术实现：放 `services/support/platform`。

若仍无法判断，先回答“谁拥有状态、谁做判断、谁消费结果”，禁止先放入 `common` 或 `utils`。
