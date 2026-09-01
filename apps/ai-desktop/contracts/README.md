# AI Desktop 应用私有协议

`contracts` 只保存 Electron 主进程、preload 与 Renderer 之间共享的纯 TypeScript 数据协议。这里不放业务实现、文件系统访问、SQLite 操作、React 组件或 Electron 对象。

## 分层

| 目录 | 职责 | 主要生产者 | 主要消费者 |
|---|---|---|---|
| `foundation/` | 稳定枚举、基础值对象和运行环境描述 | 主进程配置 | 全部协议域 |
| `desktop/` | DesktopApi 组合出口、能力注册表和桌面壳白名单 | preload | Renderer 全部功能 |
| `platform/` | Codex、工作区、设置、安全、附件和数据库状态 | 主进程平台服务 | 公共能力与 DesktopApi |
| `capabilities/` | 会话、事件中心、测试、发布和规则包协议 | 主进程公共能力 | Workflow、人物与 DesktopApi |
| `collaboration/` | Workflow、Evolution 与人物协议 | 主进程人物和流程服务 | Renderer 协作与演化功能 |
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
- `desktop/desktop.ts` 是 Renderer 的组合出口；主进程新代码必须从所属模块唯一 `index.ts` 导入。
- 所有领域 `index.ts` 必须显式列出符号及来源文件，禁止 `export *` 和 `export type *`。
- 跨模块只能从目标模块 `index.ts` 导入；模块内部才允许引用自己的具体 DTO 文件。

## DTO 方向

- `InDto`：数据进入文件所属模块。
- `OutDto`：数据离开文件所属模块。
- `EventOutDto`：文件所属模块主动发布事件。
- `Port`：行为边界，不是 DTO。
- `foundation` 中的稳定枚举和值对象没有请求/响应方向，不强行改成 DTO。

完整阅读顺序、人物职责和调用流转见 [`../ARCHITECTURE.md`](../ARCHITECTURE.md)。

## 注释要求

每个文件必须说明业务域、职责、生产者、消费者、数据方向和禁止职责。公开类型必须说明业务含义；关键字段需说明来源、格式、可空含义、安全性或生命周期。方法协议应按“作用、真实传参、真实返回、异常或副作用”说明。

关键行注释用于 IPC 安全边界、状态迁移、脱敏裁剪、兼容处理和路径防护，禁止机械复述 TypeScript 语法。
