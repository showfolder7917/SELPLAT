# AI Desktop 架构

AI Desktop 按运行边界拆分为 Renderer、Electron 系统层、应用服务层和 Contracts。各目录的公开 `index.ts` 是跨模块协作入口，其他模块不得直接引用对方的 `internal` 实现。

新手查找一次跨进程调用时，从 `src/foundation/desktop-api/domains/<domain>.desktop-api.ts` 开始，再按同名领域依次进入 Contracts、preload、IPC 和 Electron Service。完整路径表见根 `README.md`。

## Renderer

- `src/applications` 只装配窗口、导航和 Feature 控制器。
- `src/applications/developer/explorer` 对应左侧任务导航，包含模式开关、单会话摘要、任务协作群入口和人物列表。
- `src/applications/developer/workspace` 对应右侧内容舞台与页面路由；具体页面实现仍由各业务 Feature 拥有。
- `src/features` 按会话、人物、协作、演化、设置、截图等能力维护界面与状态。
- `src/foundation/desktop-api/domains` 是 Renderer 访问主进程的唯一领域入口；业务代码不得直接读取 `window.desktop`。
- 韩立和南宫婉都通过 `usePersonaConversation(personaId)` 接入统一人物会话；人物组件只保留各自的提示、动作和展示差异。

## Electron

- `electron/system` 负责生命周期、窗口、IPC、preload 与应用启动装配。
- `electron/services/personas` 负责各人物业务门面，不直接操作文件、子进程或 SQLite。
- `electron/services/evolution` 与 `electron/services/workflow` 保存中立业务流程。
- `electron/services/support/capabilities` 提供会话、测试、事件中心等共享能力。
- `electron/services/support/platform` 封装 Codex、数据库、设置和工作区等外部平台。

## Contracts 与数据

- `contracts` 只保存跨进程和跨模块传递的显式输入、输出、端口和值对象。
- `contracts/system/desktop/api/domains` 按 `system`、`rules`、`codex`、`screenshot`、`collaboration`、`conversation` 列出可追踪能力清单。
- 人物会话统一使用 `contracts/services/personas/conversation`，并按 `ownerPersonaId` 隔离。
- SQLite 的统一人物会话表是业务会话的持久化事实；历史训练语料和归档数据不在新建会话时删除。

## 测试

`tests` 镜像生产所有者，静态契约验证边界和接线，运行时测试验证数据库、Electron 与真实交互。统一测试从当前源码和同线程测试文档执行，不消费不相关的历史测试批次。
