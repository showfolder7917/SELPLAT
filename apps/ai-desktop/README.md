# AI Desktop 源码导航

这个工程不是“两棵应当互相复制的目录”。它由三个运行边界共同完成一次桌面调用：

```text
src/ Renderer 页面
  → contracts/ 纯类型白名单
  → electron/system/preload 安全桥接
  → electron/system/ipc 主进程入口
  → electron/services 业务实现
```

## 新手从一个按钮找到后端

以“读取协同状态”为例，按下面顺序打开文件：

```text
src/features/collaboration/
  → src/foundation/desktop-api/domains/collaboration.desktop-api.ts
  → contracts/system/desktop/api/domains/collaboration.desktop-api.ts
  → electron/system/preload/domains/collaboration-bridge.cts
  → electron/system/ipc/domains/register-collaboration-ipc.ts
  → electron/services/workflow/index.ts
  → electron/services/workflow/collaboration-workflow.facade.ts
```

业务组件不得直接调用 `window.desktop`。看到 `getCollaborationDesktopApi()`、`getSystemDesktopApi()` 等领域入口后，继续打开同名 Contract、bridge 和 IPC 文件即可。

## 六条跨进程主链

| 领域 | Renderer 入口 | Contract 领域视图 | preload | IPC | Electron 主要实现 |
| --- | --- | --- | --- | --- | --- |
| `collaboration` | `src/features/collaboration`、人物与演化 Feature | `collaboration.desktop-api.ts` | `collaboration-bridge.cts` | `register-collaboration-ipc.ts` | `services/workflow`、`services/evolution`、`services/personas` |
| `conversation` | `src/features/conversation` | `conversation.desktop-api.ts` | `conversation-bridge.cts` | `register-conversation-ipc.ts` | `services/support/capabilities/conversation`、`execution` |
| `codex` | 会话登录、审批与测试预检 | `codex.desktop-api.ts` | `codex-bridge.cts` | `register-codex-ipc.ts` | `services/support/platform/codex`、`security` |
| `screenshot` | `src/features/screenshot`、截图窗口 | `screenshot.desktop-api.ts` | `screenshot-bridge.cts` | `register-desktop-ipc.ts` 中的截图注册入口 | `services/support/platform/attachments`、`system/window` |
| `rules` | `src/features/rules` | `rules.desktop-api.ts` | `rules-bridge.cts` | `register-rules-ipc.ts` | `services/support/capabilities/rules` |
| `system` | Shell、Settings、Workspace | `system.desktop-api.ts` | `system-bridge.cts` | `register-system/settings/workspace-ipc.ts` | `services/support/platform` 与 Electron 宿主能力 |

`screenshot` 目前仍由总注册器持有较长的窗口与平台取帧编排，但 Renderer、Contract 和 preload 已经拥有同名入口；后续拆分时不得改变这条业务名称链。

## 每层只回答一个问题

- `src/applications`：当前打开哪个真实窗口，怎样组合布局和 Feature。
- `src/features`：页面展示什么状态，用户动作怎样组织。
- `src/foundation/desktop-api/domains`：Renderer 可以调用哪个领域；这是前端向后找代码的起点。
- `contracts/system/desktop/api/domains`：该领域允许跨进程的全部方法名。
- `electron/system/preload/domains`：方法名对应哪个白名单 IPC channel。
- `electron/system/ipc/domains`：参数怎样校验，调用哪个公开 Facade。
- `electron/services`：业务状态、判断、持久化和平台实现。

更完整的边界说明见 `ARCHITECTURE.md`、`src/README.md`、`contracts/README.md` 和 `electron/README.md`。

## 常用命令

```text
npm run typecheck
npm run build
npm test
```

本工程的测试按任务线程先登记，只有用户明确提出“统一测试”后才集中执行。
