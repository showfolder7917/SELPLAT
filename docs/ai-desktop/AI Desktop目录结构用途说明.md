# AI Desktop 目录结构用途说明

生成日期：2026-08-27  
说明对象：`C:/opt/workspace/SELPLAT/apps/ai-desktop`  
依据：当前真实目录、`package.json`、Electron/React 入口、打包白名单、应用 README 与 SELPLAT 目录规则。

## 1. 总体结构

AI Desktop 是一个 Electron + React + TypeScript 桌面应用，主要调用关系是：

```text
contracts（跨进程协议）
    ├── electron（主进程、preload、IPC、系统服务）
    └── src（React 渲染进程）

electron ──安全 IPC──> src
    ├── Codex Harness、工作区、设置、截图、协同
    ├── db 中的 SQLite 结构与迁移
    └── build/cache/OPTION/log/userData 中的运行数据

ruleengine（按任务运行的规则与 Python 能力）
    └── 不进入 Electron 正式打包内容
```

应用目录只保存正式源码、配置、永久脚本、永久测试、依赖清单、启动器和说明。编译产物、依赖缓存、临时现场与归档日志不应写入本目录。

## 2. 顶层目录

| 目录 | 用途 | 可以放什么 | 不应放什么 |
|---|---|---|---|
| `contracts/` | AI Desktop 私有的跨进程协议层 | IPC 参数、返回值、事件、状态类型 | 业务实现、文件读写、数据库连接 |
| `db/` | AI Memory SQLite 的路径配置、表结构和迁移 | `ai-memory-paths.json`、版本化 SQL、加载顺序 | 测试库、缓存、报告；运行数据库只保留受控的 `events.sqlite3*` |
| `electron/` | Electron 主进程、preload、IPC 和系统能力 | Codex、SQLite、文件系统、窗口、截图、协同等主进程实现 | React 页面和渲染层 DOM 逻辑 |
| `ruleengine/` | 并入 AI Desktop 的规则引擎、规则资产与 Python 能力 | 协议、规则索引、当前用户规则、按任务执行的 Python 能力、离线测试 | Electron 页面、常驻 HTTP 服务、Gradle 子项目运行入口 |
| `scripts/` | 永久工程脚本 | 构建、启动、打包、签名、依赖缓存、迁移、测试编排 | 一次性实验脚本、运行结果 |
| `src/` | React 渲染进程源码 | 页面、业务组件、主题、渲染状态和交互 | Node/Electron 特权调用、SQLite 连接、Codex SDK 直连 |
| `tests/` | 永久自动化测试和夹具 | Node 合同测试、服务测试、Playwright 交互测试、测试 fixture | 运行报告、失败截图、生产数据 |

## 3. `contracts/`：跨进程协议

该目录是 Electron 主进程、preload 和 React 渲染进程共同使用的纯协议层。

- `foundation/`：语言、沙箱、执行模式等最小稳定值对象。
- `desktop/`：工作区、设置、截图、数据库状态、`DesktopApi` 和统一能力类型注册表。
- `codex/`：Codex 会话、模型、审批、流式事件和对话队列协议。
- `collaboration/`：成员、任务、协同记忆、演化、自动保障、发布与测试资源协议。
- `governance/`：工作流、审计、审批治理和生产规则运行状态。
- `README.md`：分层职责、生产者/消费者、数据方向、依赖和注释规则。

根 `contracts/` 不再平铺 `.ts` 文件；`desktop/desktop.ts` 只作为迁移期兼容聚合出口，新代码优先从真实领域文件导入。

这里的文件应保持纯类型和纯数据结构，不承担实际业务处理。

## 4. `db/`：AI Memory SQLite

```text
db/
├── README.md
├── ai-memory-paths.json
└── sql/
    ├── load-order.txt
    ├── schema-*.sql
    └── migration-*.sql
```

- `ai-memory-paths.json`：只登记可移植文件名，不允许用户名、盘符或机器绝对路径。
- `sql/load-order.txt`：唯一 SQL 执行顺序清单。
- `schema-*.sql`：基础表结构。
- `migration-*.sql`：已发布后的增量升级；已发布版本不能直接改写，只能追加新迁移。
- `events.sqlite3`、`events.sqlite3-wal`、`events.sqlite3-shm`：开发环境的权威运行数据库，是本目录的窄例外，但由根 `.gitignore` 精确排除。

数据库连接和迁移执行代码不在这里，而在 `electron/services/event-center/persistence/`。

## 5. `electron/`：Electron 主进程

### 5.1 根入口

- `main.ts`：主进程装配入口；初始化窗口、Codex、SQLite、事件中心、协同、设置、工作区和退出清理。
- `preload.cts`：在上下文隔离下向渲染进程暴露白名单 API。
- `preload/domains/`：按 system、rules、codex、screenshot、collaboration、conversation 组合桥接能力。
- `packaged-bootstrap.ts`：正式打包后的启动引导。

### 5.2 `electron/config/`

- `app-config.ts`：应用变体、工程根、发布模式和应用名解析。
- `ai-memory-path-resolver.ts`：AI Memory 数据库唯一合法路径解析器。

### 5.3 `electron/ipc/`

- `register-desktop-ipc.ts`：桌面 IPC 总装配入口。
- `event-center-ipc.ts`：事件中心相关 IPC。
- `domains/`：按工作区、设置、协同等业务域拆分 IPC 注册。

IPC 层负责参数校验、权限边界和服务编排，不应复制底层业务实现。

### 5.4 `electron/services/`

- 根服务文件：Codex、会话、设置、工作区、截图、可信命令、审计和托管任务执行。
- `codex/`：Codex app-server 流事件转换等内部实现。
- `collaboration/`：成员会话、任务协调、工作树、版本集成、发布批次、统一测试和恢复。
  - `review/`：审核结论解析。
  - `result/`：任务结果摘要。
- `event-center/`：统一事件、工作流、协同记忆和监督器。
  - `persistence/`：SQLite 连接、事务和迁移执行。
- `rules/`：安装态生产规则包校验、客户覆盖事务合并和 Codex 规则快照。

`electron/policies/` 保存不产生文件副作用的授权决定；当前 `rule-overlay-policy.ts` 统一判断未知、锁定和重复客户覆盖。

该目录拥有文件系统、进程、数据库和 Codex 等特权能力，渲染进程只能经白名单 IPC 使用。

### 5.5 `electron/window/`

- `create-main-window.ts`：安全创建主窗口并配置 preload、隔离和页面入口。
- `main-window-layout.cts`：窗口布局相关事实。

## 6. `ruleengine/`：规则引擎

```text
ruleengine/
├── backend/
│   ├── src/main/python/       # Python 执行器、abilities、util
│   ├── src/main/resources/    # 协议、规则、索引、注册表、模板
│   └── src/test/python/       # ruleengine 离线测试
├── doc/                       # 历史设计背景和规则引擎说明
└── manifest/                  # 模块声明、生产白名单和客户覆盖示例
```

- 它按稳定逻辑 ID、当前作用域和稳定用户加载最少必要规则。
- `backend/src/main/resources/RULE_INDEX.md` 是唯一根规则索引。
- `local/core` 是冻结基线，`local/common` 是空预留提升层，活跃业务规则属于当前用户层。
- `backend/src/main/python/com/sp/selplat/ruleengine/` 保存新执行器、能力和公共路径配置实现。
- `backend/src/main/python/com/sp/selplat/local/code/` 保存尚未迁完的 core 与当前用户能力分层。
- 它不注册为 Gradle 子项目、不启动 HTTP 服务，只由 Codex、根门禁或明确 Python 命令按任务调用。
- `manifest/production-rules.json` 是生产规则的显式白名单；构建只生成客户运行所需的 `manifest.json` 和 `rules.json`。
- Electron Builder 把规则构建产物复制到 `resources/ruleengine/`，但不会把 `ruleengine` 源码、Python、历史归档和测试打入客户包。
- 客户覆盖位于 `userData/ruleengine/overrides/`，只能覆盖清单中显式允许的稳定逻辑 ID。

## 7. `scripts/`：永久工程脚本

主要职责分组：

- 依赖：`dependency-cache.mjs`、`ensure-dependency-cache.mjs`、`migrate-dependencies-to-cache.mjs`、`run-with-dependencies.mjs`。
- 构建：`build-node-common.mjs`、`sync-node-common-runtime.mjs`、`build-rule-bundle.mjs`。
- 启动：`start-developer-desktop.mjs`、`start-variant.bat`。
- 打包发布：`build-developer-archive-release.mjs`、`sign-mac-developer-app.mjs`、`verify-*.mjs`；客户包使用独立 `electron-builder.customer.config.cjs`，不携带构建机工程根。
- 测试：`run-interaction-tests.mjs`、`test-document-runner.mjs`、`interaction-test-paths.mjs`。
- 数据维护：`migrate-project-data-layout.mjs`、`backfill-codex-conversation.mjs`、`reset-collaboration-runtime-data.mjs`。
- 路径诊断：`resolve-application-paths.mjs`。

复杂、可重复、长期维护的工程命令进入这里；一次性工具应进入工程根 `OPTION/temp/ai-desktop/<task>/tools`。

## 8. `src/`：React 渲染进程

### 8.1 根入口

- `main.tsx`：渲染进程入口；应用主题、错误边界和 Developer/截图/演化窗口模式选择。
- `electron.d.ts`：声明 preload 暴露给浏览器上下文的 `window.desktop` 类型。

### 8.2 `src/variants/developer/`

- `DeveloperApp.tsx`：AI Desktop Developer 主界面和主要交互装配。
- `ScreenshotWindowApp.tsx`：截图窗口入口。
- `MarkdownMessage.tsx`：安全 Markdown 消息显示。
- `developer.css`：AI Desktop 应用级布局与业务几何样式。
- `collaboration-task-progress.ts`：协同任务阶段展示模型。

当前只有一个 Developer 产品线，不应再创建平行产品变体。

### 8.3 `src/features/`

- `conversation/`：对话消息模型和公共对话组件。
- `screenshot/`：截图编辑器、标注几何、Canvas 绘制和标注数据模型。

按稳定业务能力拆分，组件、模型、几何和绘制职责分别存放。

### 8.4 `src/theme/`

- `SelUiProvider.tsx`：SELUI React Provider。
- `selUiTheme.ts`：AI Desktop 对公共 SELUI 主题的应用级适配。

公共视觉控件属于根 `shared/frontend/sel-ui`；这里仅保存 AI Desktop 的装配和应用级适配。

## 9. `tests/`：永久测试

- 根 `*.test.mjs`：主进程服务、路径、数据库、Codex、协同、托管、组件边界等 Node 测试。
- `fixtures/`：只供自动测试使用的稳定输入，不是生产数据入口。
- `interaction/`：Playwright 交互测试和专用 Harness。

测试生成的报告、截图和 trace 不写在 `tests/`，而是进入工程根 `OPTION/temp/ai-desktop/临时材料/测试证据/` 或 `build/ai-desktop/reports/`。

## 10. 应用根文件

| 文件 | 用途 |
|---|---|
| `package.json`、`package-lock.json` | 唯一 Node 依赖清单、锁文件和开发/构建/测试/打包入口 |
| `index.html` | Vite 渲染页面壳 |
| `tsconfig.json` | React 渲染层 TypeScript 配置 |
| `tsconfig.electron.json` | Electron、preload 和 contracts 的 TypeScript 配置 |
| `vite.config.mjs` | renderer 构建及缓存输出位置 |
| `electron-builder.*` | Developer 安装包、压缩包和打包白名单 |
| `playwright.interaction.config.ts` | 隔离交互测试配置和证据输出位置 |
| `.npmrc` | npm 行为配置 |
| `README.md` | 使用、启动和打包入口说明 |
| `AGENTS.md` | AI Desktop 局部工程约束 |
| `启动开发版.bat` | Windows 用户可发现启动入口 |
| `启动开发版.command` | macOS 用户可发现启动入口 |

## 11. 不在 `apps/ai-desktop` 内的相关目录

| 工程根目录 | 用途 | 是否可重建/清理 |
|---|---|---|
| `build/ai-desktop/` | TypeScript 编译、renderer 构建、安装包、测试报告 | 可重建；清理前确认无活动进程且交付物已转移 |
| `cache/ai-desktop/` | 锁文件专属依赖、Vite 变换缓存、可再生运行资源 | 可重建；离线来源不可用时不能盲目删除 |
| `OPTION/temp/ai-desktop/` | 待执行、运行中、截图、测试证据、下载和一次性材料 | 只在无活动任务、无有效锁且终态已归档后清理 |
| `log/ai-desktop/归档日志/` | 长期审计、任务、协同、审批和诊断终态记录 | 长期保留，不按普通临时文件清理 |
| Electron `userData` | 用户设置、认证状态、可信命令、活动 Codex 会话和用户协同状态 | 用户私有状态；不是工程缓存，也不提交 Git |

`build`、`cache`、`OPTION/temp` 的职责不同，禁止合并或用链接指向同一个物理目录。

## 12. 新文件放置判断

1. 只是主进程、preload、renderer 共用的数据协议：放 `contracts/`。
2. 需要文件、进程、数据库、Codex 或操作系统权限：放 `electron/`。
3. 是用户可见 React 页面、组件或渲染状态：放 `src/`。
4. 是永久构建、测试、迁移或发布编排：放 `scripts/`。
5. 是永久自动测试：放 `tests/`；测试输出不能放这里。
6. 是规则、协议、规则能力或规则资产：放 `ruleengine/` 对应分层。
7. 是 SQLite 结构或迁移：放 `db/sql/`；数据库执行实现放 Electron persistence。
8. 是编译结果、缓存、任务现场或归档记录：按职责放工程根 `build/cache/OPTION/log`，不能放回应用源码目录。
