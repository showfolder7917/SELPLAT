# AI Desktop 应用私有协议

`contracts` 只保存 Electron 主进程、preload 与 Renderer 之间共享的纯 TypeScript 数据协议。这里不放业务实现、文件系统访问、SQLite 操作、React 组件或 Electron 对象。

## 分层

| 目录 | 职责 | 主要生产者 | 主要消费者 |
|---|---|---|---|
| `foundation/` | 跨领域稳定 Value | 主进程配置 | 全部协议域 |
| `system/` | DesktopApi、桌面环境 DTO 和能力注册表 | preload | Renderer 全部功能 |
| `services/personas/` | 南宫、韩立、令狐、Executor 的人物协议 | 对应人物服务 | Workflow 与 Renderer |
| `services/evolution/` | 专题、提案、审批、验收共享事实 | Evolution 服务 | 人物、Workflow 与 Renderer |
| `services/workflow/` | 跨人物任务、状态、事件与恢复协议 | Workflow 服务 | 人物与 Renderer |
| `services/support/application/` | 跨领域应用用例的输入输出 | Application Service | System/Desktop |
| `services/support/capabilities/` | 会话、事件、测试、发布和规则协议 | 公共能力服务 | Workflow、人物与 DesktopApi |
| `services/support/platform/` | Codex、工作区、设置、安全、附件和数据库协议 | 平台服务 | 公共能力与 DesktopApi |
| `governance/` | 工作流事件、异常、审计和审批记录 | 事件中心与审计服务 | Renderer 治理视图 |

## 数据边界

```text
Renderer Feature
      │ typed request/response
      ▼
DesktopApi contract
      │ contextBridge whitelist
      ▼
preload
      │ registered IPC channel
      ▼
Electron main handler → application service → infrastructure
```

- Renderer 只能通过 `DesktopApi` 使用主进程能力。
- preload 只桥接已登记能力，不包含业务判断。
- IPC handler 校验请求并调用应用服务，不直接操作复杂持久化或外部进程。
- `system/desktop/index.ts` 是 Renderer 的组合出口；主进程新代码必须从所属模块唯一 `index.ts` 导入。
- 所有领域 `index.ts` 必须显式列出符号及来源文件，禁止 `export *` 和 `export type *`。
- 跨模块只能从目标模块 `index.ts` 导入；模块内部才允许引用自己的具体 DTO 文件。

## DTO 方向

- `InDto`：数据进入文件所属模块。
- `OutDto`：数据离开文件所属模块。
- `EventOutDto`：文件所属模块主动发布事件。
- `Port`：带有可调用方法的行为边界；字符串联合类型不得命名为 Port。
- `Value`：无请求/响应方向的稳定值，文件和公开类型分别使用 `.value.ts`、`Value`。
- `Api`：面向调用方聚合能力，只允许组合公开 DTO、Value 与 Port。

## 路径同构

除 `foundation`、`governance` 和 `system` 三个跨领域边界外，Contracts 与 Electron 保持同一个业务所有者路径：

```text
electron/services/personas/nangong
contracts/services/personas/nangong

electron/services/support/platform/codex
contracts/services/support/platform/codex
```

看到实现路径即可把 `electron` 替换为 `contracts` 查找协议；看到协议路径也可反向定位服务。跨模块只引用所有者 `index.ts`，不要深层引用其 `dto/port/value`。

完整阅读顺序、人物职责和调用流转见 [`../ARCHITECTURE.md`](../ARCHITECTURE.md)。

## 注释要求

每个文件必须说明业务域、职责、生产者、消费者、数据方向和禁止职责。公开类型必须说明业务含义；关键字段需说明来源、格式、可空含义、安全性或生命周期。方法协议应按“作用、真实传参、真实返回、异常或副作用”说明。

关键行注释用于 IPC 安全边界、状态迁移、脱敏裁剪、兼容处理和路径防护，禁止机械复述 TypeScript 语法。
