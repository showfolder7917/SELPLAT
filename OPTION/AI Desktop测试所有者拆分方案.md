# AI Desktop 测试所有者拆分方案

## 1. 目标

AI Desktop 生产源码已经形成 `applications → layout → features` 的 Renderer 所有权，以及 `electron/services` 的主进程所有权。本方案把测试同步调整为相同的业务边界，解决测试全部平铺在 `tests/` 根目录、路径变化引发大面积连锁修改以及静态契约和真实交互混跑的问题。

本次只改变测试文件所有权、测试入口和路径解析，不改变生产业务行为、测试断言语义或统一测试范围。

## 2. 目标结构

```text
tests/
├── applications/                 # Renderer 窗口、页面组合与布局契约
│   ├── developer/
│   ├── evolution-workspace/
│   └── screenshot/
├── features/                     # Renderer 业务控件与前端状态
│   ├── collaboration/
│   └── conversation/
├── services/                     # Electron 业务及 support 能力，镜像真实所有者
│   ├── evolution/
│   ├── workflow/
│   └── support/
│       ├── application/
│       ├── capabilities/
│       └── platform/
├── contracts/                    # 跨模块边界、SELUI 和静态治理门禁
├── interaction/                  # 真实 Electron/Playwright 用户流程
├── release/                      # 构建、依赖、规则包、平台包与启动验收
└── support/                      # 测试路径、worker 和 fixture，不承载业务断言
```

## 3. 所有权判断顺序

1. 验证一个真实 Renderer 窗口或页面组合时，归入 `applications/<application>`。
2. 验证可复用 Renderer 控件、前端状态或用户输入时，归入 `features/<feature>`。
3. 验证 Electron 业务服务、Store、Repository、Facade 或平台能力时，归入与 `electron/services` 同构的 `services` 路径。
4. 验证跨模块禁止关系、目录结构、公开入口或设计系统采用时，归入 `contracts`。
5. 必须启动真实 Electron 并执行用户操作时，归入 `interaction`。
6. 验证构建工具、依赖缓存、生产规则包、平台包、签名和启动器时，归入 `release`。
7. 仅提供路径、worker、fixture 或 harness 支撑时，归入 `support`；不得伪装成业务测试。

## 4. 迁移映射

### 4.1 Applications

| 目标目录 | 测试文件 |
| --- | --- |
| `applications/developer` | `developer-explorer-collapse`、`developer-settings-panel`、`model-settings-contract` |
| `applications/evolution-workspace` | `evolution-topic-group-contract` |
| `applications/screenshot` | `user-input-and-screenshot-contract` |

### 4.2 Features

| 目标目录 | 测试文件 |
| --- | --- |
| `features/collaboration` | `collaboration-progress-contract`、`collaboration-status-chain-contract`、`managed-task-executor-contract` |

### 4.3 Services

| 目标目录 | 测试文件 |
| --- | --- |
| `services/evolution` | `nangong-evolution` |
| `services/workflow` | `collaboration-mode`、`collaboration-timeline` |
| `services/support/application` | `conversation-dispatch-store` |
| `services/support/capabilities/event-center` | `business-audit-log`、`workflow-event-center` |
| `services/support/platform/attachments` | `screenshot-store` |
| `services/support/platform/codex` | `codex-runtime`、`codex-stream` |
| `services/support/platform/persistence` | `ai-memory-database`、`ai-memory-path-resolver` |
| `services/support/platform/security` | `trusted-command-store` |
| `services/support/platform/workspace` | `selected-workspace-root`、`workspace-store` |

### 4.4 Contracts、Interaction、Release 与 Support

| 目标目录 | 测试文件 |
| --- | --- |
| `contracts` | `module-boundaries`、`sel-ui-adoption` |
| `interaction` | 保留现有 Playwright spec、主进程、preload 和截图 Harness |
| `release` | `application-paths-command`、`codex-platform-dependencies`、`dependency-cache-self-heal`、`developer-package-root`、`interaction-test-bootstrap`、`rule-bundle-service`、`test-document-and-mac-launcher-contract` 及三个运行 smoke/diagnostic 文件 |
| `support` | `test-paths.mjs` 与两个 worker fixture |

## 5. 路径与入口约束

- 测试不得根据自身目录层级反推应用根；统一通过 `tests/support/test-paths.mjs` 提供 `appRoot`、`projectRoot` 和受控测试根。
- 构建产物路径必须从 `projectRoot/build/ai-desktop` 解析，禁止在各测试中复制 `../../../build` 层级。
- `package.json` 的命名测试脚本必须指向新所有者路径；完整 `npm test` 必须递归发现所有 `*.test.mjs`。
- 测试内部读取其他测试支撑文件时，只能读取 `interaction` 或 `support` 的明确路径。
- `tests/` 根目录不得继续放置业务测试文件；只允许所有者目录与说明文档。

## 6. 测试层级

| 层级 | 责任 | 是否构建 | 是否启动真实应用 |
| --- | --- | --- | --- |
| 静态契约 | 目录、公开入口、源码所有权、样式与脚本契约 | 否 | 否 |
| 服务测试 | Store、Repository、Facade、状态迁移和异常边界 | 按需构建 Electron | 否 |
| Application 测试 | 页面组合、布局槽位和控件接线 | 按需构建 Renderer | 否 |
| Interaction | 真实窗口、输入、导航、截图、滚动和可视状态 | 是 | 是 |
| Release | 构建产物、依赖、签名、包身份和启动 SHA | 是 | 是 |

## 7. 验收门禁

1. 所有旧根级业务测试文件归零，`package.json` 不再引用旧路径。
2. 每个迁移文件仍保留原断言，不通过空壳转发文件兼容旧路径。
3. `npm run typecheck`、全部命名测试入口、递归完整测试和真实交互测试通过。
4. `npm run build:developer` 通过，Renderer 仍只输出一份生产 CSS。
5. macOS Developer 包重新生成并通过身份、稳定指定要求、Codex 与隔离启动验证。
6. 最终提交后工作区干净，并以完整提交 SHA 启动应用。

## 8. 防回退门禁

- `module-boundaries` 增加测试目录所有权契约：根级 `*.test.mjs` 数量必须为零。
- 命名脚本必须只引用登记后的所有者路径。
- 新测试先判断真实生产所有者，再选择目录；禁止按临时任务名称或执行人创建目录。
- 同一行为只保留一个权威测试，静态契约不得替代真实交互，真实交互也不得复制服务内部断言。
