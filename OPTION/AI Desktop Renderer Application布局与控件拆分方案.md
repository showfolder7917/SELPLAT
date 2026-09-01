# AI Desktop Renderer Application 布局与控件拆分方案

## 1. 文档状态

- 文档性质：本轮 `apps/ai-desktop/src` 重构的唯一实施方案。
- 实施目标：把 Renderer 收敛为 `Application → Layout → Feature Control` 三级结构，解除 `DeveloperApp.tsx` 对主会话、协作、人物、工作区、设置与截图流程的集中持有。
- 保持不变：DesktopApi、IPC 名称、持久化格式、业务状态机、窗口查询参数、现有用户可见行为和单一生产 CSS 输出。
- 切换策略：目标组件接入后直接删除原文件中的旧定义，不保留兼容组件、转发副本或双写状态。

## 2. 当前入口与主要问题

Renderer 当前通过 `src/main.tsx` 选择三个生产 Application：

1. `DeveloperApp`：主桌面窗口。
2. `EvolutionWorkspaceWindowApp`：南宫婉与韩立共用的专题演化工作台。
3. `ScreenshotWindowApp`：截图选择、标注与保存窗口。

其中 `DeveloperApp.tsx` 同时持有：

- 主桌面 Application 和专题演化 Application；
- ActivityBar、Explorer、Workspace、StatusBar 等布局区域；
- 韩立主会话、南宫婉会话、协作人物页、任务详情和执行归档；
- 会话发送、流式事件、确认门、截图、自动测试、工作区和设置控制；
- 多个可独立测试的业务控件与格式化函数。

这使页面布局、业务状态和跨进程操作集中在一个文件，修改单一控件也容易触发无关冲突。

## 3. 目标结构

```text
src/
├─ applications/
│  ├─ developer/
│  │  ├─ DeveloperApplication.tsx
│  │  └─ layout/
│  │     ├─ DeveloperShell.tsx
│  │     ├─ DeveloperActivityBar.tsx
│  │     ├─ DeveloperExplorer.tsx
│  │     ├─ DeveloperWorkspace.tsx
│  │     └─ DeveloperStatusBar.tsx
│  ├─ evolution-workspace/
│  │  └─ EvolutionWorkspaceApplication.tsx
│  └─ screenshot/
│     └─ ScreenshotApplication.tsx
├─ features/
│  ├─ collaboration/
│  │  ├─ components/
│  │  └─ model/
│  ├─ conversation/
│  │  ├─ components/
│  │  ├─ hooks/
│  │  └─ model/
│  ├─ evolution/
│  ├─ hanli/
│  ├─ linghu/
│  ├─ nangong/
│  ├─ rules/
│  ├─ screenshot/
│  ├─ settings/
│  ├─ shell/
│  └─ workspace/
├─ foundation/
│  └─ desktop-api/
├─ theme/
└─ main.tsx
```

目录表达两种互补事实：

- `applications` 表达真实窗口及其布局装配。
- `features` 表达可独立维护、测试和复用的业务控件及交互控制。

## 4. Application 职责

### 4.1 DeveloperApplication

只负责：

- 装配标题栏、ActivityBar、Explorer、Workspace 和 StatusBar；
- 持有当前顶层导航位置；
- 把 Feature Controller 返回的 ViewModel 和动作传给布局组件；
- 组合全局 Dialog。

禁止继续定义人物页面、任务进度、会话输入区、工作区树或截图业务流程。

### 4.2 EvolutionWorkspaceApplication

南宫婉和韩立继续共用一个 Application，只切换人物视角。Application 负责读取工作台启动状态，并把左侧演化树和右侧内容交给 `EvolutionControlWorkspace`。禁止复制两套工作台。

### 4.3 ScreenshotApplication

只负责截图窗口生命周期、原生帧接收和 `ScreenshotEditor` 装配；标注几何与绘制继续归 `features/screenshot`。

## 5. 布局拆分

Developer 主窗口采用：

```text
TitleBar
├─ ActivityBar
├─ ExplorerTreePane
└─ WorkspacePane
StatusBar
```

- `DeveloperShell` 只定义网格和插槽，不读取 DesktopApi。
- `DeveloperActivityBar` 只显示模式入口和设置入口。
- `DeveloperExplorer` 组合工作区树和任务树。
- `DeveloperWorkspace` 根据顶层导航选择韩立会话、协作群、人物页、演化入口、执行归档或任务详情。
- `DeveloperStatusBar` 只显示运行环境的只读摘要。

专题演化窗口继续使用已验证的左树右内容布局：

```text
TitleBar + PerspectiveSwitch
├─ EvolutionTreePane
└─ EvolutionContentPane
```

## 6. 控件迁移映射

| 当前 `DeveloperApp.tsx` 内容 | 目标所有者 |
|---|---|
| `CollaborationExecutionList` | `features/collaboration/components/CollaborationExecutionList.tsx` |
| `CollaborationTaskDetail` | `features/collaboration/components/CollaborationTaskDetail.tsx` |
| `CollaborationMemberPage` | `features/collaboration/components/CollaborationMemberPage.tsx` |
| `CollaborationTaskProgressView`、`CollaborationStageContent`、`ChangedFileList` | `features/collaboration/components/CollaborationTaskProgressView.tsx` |
| 协作状态标签、时间和执行人格式化 | `features/collaboration/model/collaboration-formatters.ts` |
| `NangongConversationWorkspace` | `features/nangong/components/NangongConversationWorkspace.tsx` |
| `CodexUserInputPanel` | `features/conversation/components/CodexUserInputPanel.tsx` |
| `ManagedStageAction` | `features/conversation/components/ManagedStageAction.tsx` |
| `CollaborationStatusChain` | `features/conversation/components/CollaborationStatusChain.tsx` |
| `StreamDetails` 及流状态标签 | `features/conversation/components/StreamDetails.tsx` |
| Explorer 工作区与任务树 | `features/workspace/components/WorkspaceExplorer.tsx` 与 `applications/developer/layout/DeveloperExplorer.tsx` |
| 主工作区条件渲染 | `applications/developer/layout/DeveloperWorkspace.tsx` |
| 主窗口外框 | `applications/developer/layout/DeveloperShell.tsx` |
| 专题演化 Application | `applications/evolution-workspace/EvolutionWorkspaceApplication.tsx` |
| 截图 Application | `applications/screenshot/ScreenshotApplication.tsx` |

## 7. Controller 与状态边界

本轮优先迁移已经稳定的控件和布局，避免一次性重写所有运行状态。跨控件状态遵循：

- IPC 只能通过 `DesktopApi`；Feature 不直接导入 Electron 实现。
- 仅服务一个控件的展开、输入、忙碌状态留在该控件。
- 会话流、截图准备和顶层订阅仍由 Application Controller 统一持有，后续按独立测试边界迁入 `hooks`。
- 不为减少 props 创建无业务边界的全局 Context。
- 组件参数超过可读范围时使用具名 Props 或 ViewModel，不传递匿名巨型对象。

## 8. 公共控件与业务控件边界

- Disclosure、Dialog、Window、Switch、Tooltip 等稳定交互继续消费 SELUI。
- `developer.css` 只保存 Application 布局和 AI Desktop 业务外观，不复制 SELUI 控件皮肤。
- 本轮不新增公共控件；拆出的 React 组件仍是 AI Desktop 业务控件。
- CSS 源码可按 Application/Feature 拆分，但必须同步静态导入，生产构建仍输出一个 CSS 文件。

## 9. 实施顺序

1. 建立三个 Application 入口并修改 `main.tsx` 指向新入口。
2. 迁移专题演化和截图 Application，删除 `variants/developer` 中对应旧入口。
3. 抽取协作任务、人物、进度和归档控件。
4. 抽取南宫婉会话与通用会话附属控件。
5. 抽取 Developer Shell、Explorer、Workspace 和 StatusBar。
6. 删除 `DeveloperApp.tsx` 中已迁移定义，使其退役或仅保留临时装配后再迁为 `DeveloperApplication.tsx`。
7. 扫描旧导入、重复组件、跨 Electron 引用和生产 CSS 分块，违规必须为零。

## 10. 验收门禁

- `DeveloperApp.tsx` 不再同时定义多个 Application 和业务页面。
- `variants/developer` 不再作为业务组件所有者。
- `main.tsx` 只选择 `applications/*` 入口。
- Renderer 不直接导入 `electron` 或 `contracts/services`。
- `npm run typecheck` 通过。
- `npm run test:boundaries` 通过且违规数为零。
- `npm run test:collaboration` 通过。
- `npm run test:interaction` 通过，并验证主桌面与专题演化真实布局。
- `npm run build:developer` 通过且只生成一个生产 CSS。
- `npm run package:mac:developer` 与 `npm run verify:mac:developer` 通过。
- 提交后主工作区无未登记修改，最终运行进程携带本次提交 SHA。

## 11. 完成判定

只有目标入口、控件迁移、旧实现删除、静态边界、真实交互、构建、打包、提交和运行版本确认全部完成，才可把本方案标记为已实施。仅移动文件、保留旧定义或只通过类型检查均不算完成。
