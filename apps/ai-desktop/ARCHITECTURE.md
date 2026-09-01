# AI Desktop 架构导航

这份文档是代码阅读入口。第一次进入工程时先看本文件，再按目标模块的 `index.ts → Facade → internal Application Service → Port → 基础设施` 向内阅读。

## 1. 从哪里看起

按以下顺序可以看到一次真实请求如何完成流转：

1. `electron/main.ts`：唯一组合根，创建数据库、公共能力、人物 Runtime、Evolution 和 Workflow。
2. `electron/ipc/domains/register-collaboration-ipc.ts`：人物与协作 IPC 分发入口。
3. `electron/services/personas/<persona>/index.ts`：人物模块唯一公开入口。
4. `electron/services/personas/<persona>/<persona>.facade.ts`：人物公开能力。
5. `electron/services/personas/<persona>/internal/*-application.service.ts`：人物内部用例组合。
6. `electron/services/evolution/index.ts`：共享专题、提案、审批、验收状态入口。
7. `electron/services/workflow/index.ts`：跨人物轮转、分发、恢复和统一测试入口。
8. `contracts/<domain>/index.ts`：跨模块数据和端口的唯一类型入口。

不要从某个 `internal/*.service.ts` 开始猜全局流程。`internal` 文件只说明当前模块怎样完成自己的职责。

## 2. 完整调用流转

```text
Renderer Feature
    │ 调用 window.desktop 的类型化方法
    ▼
contracts/desktop/DesktopApi
    │
    ▼
electron/preload/domains/*-bridge.cts
    │ 白名单 IPC channel
    ▼
electron/ipc/domains/register-*-ipc.ts
    │ 只校验和分发
    ├── Persona Facade：人物自己的判断
    ├── Evolution Facade：共享专题事实
    └── Workflow Facade：跨人物顺序与恢复
             │
             ▼
       platform/capabilities 基础设施
             │
             ▼
      状态事件 → preload → Renderer
```

一次南宫婉演化的主路径：

```text
南宫婉会话
→ NangongFacade 整理对话与课题草稿
→ NangongFacade 创建提案
→ Evolution 保存专题和提案事实
→ HanliFacade 审批方向
→ Workflow 根据已持久化事实分发任务
→ 执行结果回流 Workflow
→ 令狐统一测试、修复与恢复
→ 韩立执行真实应用验收
→ Evolution 完成本轮并归档
```

## 3. 五个主进程区域

| 区域 | 唯一职责 | 不得承担 |
|---|---|---|
| `services/personas` | 南宫婉、韩立、令狐各自的业务判断 | 共享 Store、跨人物轮转 |
| `services/evolution` | 专题、提案、审批、验收和档案的唯一共享状态 | 人物对话实现、任务调度 |
| `services/workflow` | 跨人物顺序、分发、集成、恢复和生命周期 | 人物判断、人物内部解析 |
| `services/capabilities` | 会话、事件、测试、发布、规则等公共能力 | 人物专属业务语义 |
| `services/platform` | Codex、持久化、附件、设置、工作区和安全基础设施 | 反向依赖人物或 Workflow |

跨区域调用只能导入目标区域的 `index.ts`。禁止导入其他区域的 `internal` 或具体 Facade 文件。

## 4. 三个人物的边界

### 南宫婉

- 入口：`electron/services/personas/nangong/index.ts`
- 对外门面：`nangong.facade.ts`
- 内部能力：对话、草稿、专题作者、提案修订调查
- DTO 入口：`contracts/collaboration/nangong/index.ts`
- 不负责：韩立审批、令狐测试、Workflow 轮转、共享状态持久化

### 韩立

- 入口：`electron/services/personas/hanli/index.ts`
- 对外门面：`hanli.facade.ts`
- 内部能力：专题研讨、方向审批、结果验收、真实应用验收计划和运行
- DTO 入口：`contracts/collaboration/hanli/index.ts`
- 不负责：南宫婉会话、提案作者动作、令狐恢复、跨人物顺序

### 令狐

- 入口：`electron/services/personas/linghu/index.ts`
- 对外门面：`linghu-automation.facade.ts`
- 内部能力：故障调查、修正方案、统一测试、失败复测和恢复保障
- DTO 入口：`contracts/collaboration/linghu/index.ts`
- 不负责：常规任务规划、方向审批、共享 Evolution 状态

## 5. contracts 不是“全部 DTO”

`contracts` 是纯 TypeScript 边界协议根，按职责分为：

| 类型 | 目录/命名 | 含义 |
|---|---|---|
| 输入 DTO | `dto/*.in.dto.ts` | 数据进入当前模块 |
| 输出 DTO | `dto/*.out.dto.ts` | 数据离开当前模块 |
| 主动事件 | `dto/*.event.out.dto.ts` | 当前模块主动发布的事件 |
| 行为端口 | `port/*.port.ts` | 模块需要或提供的最小行为能力 |
| 稳定值 | `foundation` 或 `value` | 枚举、基础值对象和无方向稳定类型 |
| 桌面白名单 | `desktop` | Renderer 可调用的完整 `DesktopApi` 与能力注册表 |

这里禁止出现 Electron、React、文件系统、SQLite、Store、Repository、Runner 或业务 Service 实现。

## 6. 类型从哪里来

每个 contracts 领域的 `index.ts` 都使用显式符号导出，不使用 `export *` 或 `export type *`。

推荐导入：

```ts
import type {
  DecideHanliProposalInDto,
  HanliAcceptancePlanOutDto,
} from "../../contracts/collaboration/hanli/index.js";
```

定位方式：

1. 类型名中的人物或领域决定所属模块，例如 `HanliAcceptancePlanOutDto` 属于 `collaboration/hanli`。
2. 打开该模块 `index.ts`，显式导出语句会直接给出物理文件。
3. 跨模块只引用目标 `index.ts`；同一模块内部才允许引用自己的具体 DTO 文件。

Renderer 与 preload 是例外：它们通过 `contracts/desktop/desktop.ts` 使用完整桌面协议。主进程业务代码不得依赖这个聚合出口。

## 7. 关键协议位置

| 业务事实 | 权威文件 |
|---|---|
| Evolution 当前状态 | `contracts/collaboration/evolution/dto/evolution-state.out.dto.ts` |
| Evolution 状态事件 | `contracts/collaboration/evolution/dto/evolution-state.event.out.dto.ts` |
| 专题 | `contracts/collaboration/evolution/dto/evolution-topic.out.dto.ts` |
| 提案 | `contracts/collaboration/evolution/dto/evolution-proposal.out.dto.ts` |
| 审批事实 | `contracts/collaboration/evolution/dto/evolution-approval.out.dto.ts` |
| 南宫婉会话 | `contracts/collaboration/nangong/dto/conversation.out.dto.ts` |
| 韩立审批输入 | `contracts/collaboration/hanli/dto/decide-proposal.in.dto.ts` |
| 韩立验收计划 | `contracts/collaboration/hanli/dto/acceptance-plan.out.dto.ts` |
| Workflow 当前状态 | `contracts/collaboration/workflow/dto/collaboration-state.out.dto.ts` |
| Workflow 任务 | `contracts/collaboration/workflow/dto/collaboration-task.out.dto.ts` |
| Workflow 时间线 | `contracts/collaboration/workflow/dto/collaboration-timeline.out.dto.ts` |

## 8. 新增能力的固定步骤

1. 确认能力所有者是某个人物、Evolution、Workflow、公共能力还是平台。
2. 在所有者模块建立真实定义，禁止在调用方复制类型。
3. 如果跨边界传输，按所有者边界建立 `InDto / OutDto / EventOutDto`。
4. 在所有者 `index.ts` 显式导出。
5. 调用方只从所有者 `index.ts` 导入。
6. IPC 方法同步登记 `DesktopApi`、preload bridge 和 capability registry。
7. 更新边界测试和同线程测试文档。

## 9. 验证入口

任务托管阶段：

```powershell
npm run typecheck
npm run test:boundaries
```

统一测试阶段再执行构建、人物业务回归、preload 沙箱和真实 Electron 交互测试。构建或真实启动没有执行时，不得将它们表述为已经通过。
