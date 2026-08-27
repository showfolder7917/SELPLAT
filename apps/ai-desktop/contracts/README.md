# AI Desktop 应用私有协议

`contracts` 只保存 Electron 主进程、preload 与 Renderer 之间共享的纯 TypeScript 数据协议。这里不放业务实现、文件系统访问、SQLite 操作、React 组件或 Electron 对象。

## 分层

| 目录 | 职责 | 主要生产者 | 主要消费者 |
|---|---|---|---|
| `foundation/` | 稳定枚举、基础值对象和运行环境描述 | 主进程配置 | 全部协议域 |
| `desktop/` | 桌面壳、工作区、设置、截图、数据库状态和 preload 白名单 | 主进程桌面服务、preload | Renderer 桌面功能 |
| `codex/` | Codex 运行、流事件、审批、用户输入和对话调度 | Codex 主进程服务 | Renderer 对话功能 |
| `collaboration/` | 协作任务、记忆、演进、自动化、测试资源和版本发布 | 主进程协作服务 | Renderer 协作与治理功能 |
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
- `desktop/desktop.ts` 是既有调用方的组合出口；新代码应优先从所属领域文件导入。

## 注释要求

每个文件必须说明业务域、职责、生产者、消费者、数据方向和禁止职责。公开类型必须说明业务含义；关键字段需说明来源、格式、可空含义、安全性或生命周期。方法协议应按“作用、真实传参、真实返回、异常或副作用”说明。

关键行注释用于 IPC 安全边界、状态迁移、脱敏裁剪、兼容处理和路径防护，禁止机械复述 TypeScript 语法。
