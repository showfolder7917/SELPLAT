# Node 工程结构标准

## 1. 适用范围

本标准适用于 SELPLAT 中使用 Node.js、TypeScript、React、Vite、Electron、Node Worker 或 Node 构建脚本的应用工程，目标是让源码、配置、依赖、构建产物、运行材料和长期审计各自只有一个明确归属。

本标准不重复定义两类已有规范：

- 源码外的 `cache`、`build`、`OPTION/temp` 和 `log` 生命周期，以《工程临时目录规范》为准。
- 跨应用复用的 Node 公共能力，以《Node共通能力规范》为准。

## 2. 总体原则

1. 应用源码根只保存能够被构建、运行、测试、打包或长期维护的正式材料。
2. 目录来自真实运行边界，不为“看起来整齐”预建空目录。
3. 根级文件只保留工具默认入口和用户需要直接发现的入口。
4. 可再生依赖和缓存不提交 Git，构建产物不返回源码树。
5. 删除文件必须有调用关系、替代关系或生成物证据，禁止按名称和观感猜测。
6. Windows、macOS 和 Linux 路径均使用 Node `path` API 处理，不用固定斜杠字符串判断正确性。

## 3. 标准应用结构

普通 Node.js 或 TypeScript 应用采用最小结构：

```text
apps/<工程名>/
├── src/                       # 正式运行源码
├── scripts/                   # 永久构建、启动、迁移和验证脚本
├── tests/                     # 永久自动测试与测试专用 fixture
├── package.json               # 唯一包清单和命令入口
├── package-lock.json          # 与包管理器匹配的唯一锁文件
├── tsconfig.json              # 使用 TypeScript 时保留
├── README.md                  # 使用、构建、测试与交付说明
└── AGENTS.md                  # 该应用的持久工程约束，可选
```

Electron 应用按运行安全边界扩展：

```text
apps/<工程名>/
├── src/                       # 渲染层源码
│   ├── main.tsx
│   ├── components/
│   ├── features/
│   └── styles/
├── electron/
│   ├── main.ts                # 主进程入口
│   ├── preload.cts            # preload 唯一受控桥接入口
│   ├── config/                # 应用配置解析
│   ├── ipc/                   # IPC 白名单、校验和编排
│   ├── services/              # 主进程业务能力
│   └── window/                # BrowserWindow 生命周期
├── shared/
│   └── contracts/             # 主进程与渲染层共享的纯类型/协议
├── worker/                    # 有真实独立 Worker 或托管入口时才建立
├── scripts/
├── tests/
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.electron.json
├── vite.config.mjs
├── index.html
├── README.md
└── AGENTS.md
```

没有对应运行时或调用方时，不得为了补齐示例创建 `electron`、`shared`、`worker`、`config` 或 `fixtures`。

## 4. 根目录文件边界

允许保留在应用根的文件：

- `package.json` 和一个匹配的锁文件。
- TypeScript、Vite、Playwright、Electron Builder 等工具真实读取的默认配置。
- `README.md`、`AGENTS.md` 和必要许可证。
- Windows/macOS 用户需要直接双击的启动器。
- `index.html` 等构建工具要求位于根目录的入口。

以下文件不得仅因“以后可能用”而留在根目录：

- 没有 package script、源码、测试或打包清单引用的配置副本。
- 一次性修复脚本、失败实验和临时导出。
- 已终结的测试报告、截图和人工验收记录。
- `*.bak`、`*.tmp`、`*.log` 和编辑器生成文件。

配置文件之间存在真实继承或工具默认查找约定时，可以继续留在根目录；不得为了减少文件数量而制造大量路径改动。

## 5. 源码职责

### `src/`

保存应用正式运行源码。单一 Node 服务、CLI 或 Worker 的入口和实现都从这里组织；Electron 工程中只保存渲染层源码。

### `electron/`

只属于 Electron 主进程侧：窗口、系统能力、文件访问、官方进程连接、IPC 注册和安全配置。渲染组件不得放入这里。

### `shared/contracts/`

只保存跨运行边界的纯类型、事件和消息协议，不保存文件系统访问、Electron 对象、React 组件或业务服务实现。

### `scripts/`

保存会被 package script、发布流程或维护流程重复调用的永久脚本。脚本必须从自身或清单稳定解析工程根，不得绑定某台机器的绝对路径。

一次性脚本进入：

```text
OPTION/temp/<工程名>/<taskId>/tools/
```

任务结束后删除；形成稳定重复职责时再经调用方、测试和生命周期核对后提升为永久脚本。

### `tests/`

保存自动测试和测试专用 fixture。测试运行报告、截图、trace、coverage 和临时数据库不得进入 `tests/`，而应进入 `build/<工程名>/reports` 或 `OPTION/temp/<工程名>/临时材料/测试证据`。

## 6. 模块和公共能力边界

- 应用私有实现保留在 `apps/<工程名>`。
- 两个以上应用真实复用或平台确认的公共能力进入 `shared/node/common-core`。
- 应用只能通过 `@selplat/node-common-core` 的 `exports` 入口使用公共能力。
- 禁止从应用跨目录导入公共包内部 `src` 文件。
- 公共包禁止反向依赖任何具体应用。
- 浏览器公共组件进入 `shared/frontend/sel-ui`，不能混入 Node 主进程公共包。

## 7. 依赖与锁文件

每个应用必须：

1. 只有一个权威 `package.json`。
2. 只有一个与实际包管理器匹配的锁文件。
3. 固定生产和打包关键依赖版本；范围版本必须有锁文件约束。
4. 不提交 `node_modules`。
5. 不在源码树长期保存 npm 下载缓存。

SELPLAT 可再生依赖根：

```text
cache/<工程名>/dependencies/<lockHash>/node_modules/
```

`<lockHash>` 必须由锁文件原始内容计算。构建或测试可在应用根建立临时 `node_modules` 符号链接或 Windows junction，但必须：

- 只指向当前锁哈希对应的依赖根。
- 建立前拒绝普通实体目录、旧哈希链接和路径逃逸。
- 禁止依赖根反向包含指向应用 `node_modules` 的递归链接。
- 命令成功、失败或取消后均回收临时链接。
- 临时链接由 SELPLAT 根 `.gitignore` 精确排除，不在应用内建立嵌套 `.gitignore`。

## 8. Package Scripts 标准

应用应按实际能力提供以下稳定入口：

| 入口 | 职责 |
| --- | --- |
| `dev` | 开发模式，不执行正式发布 |
| `typecheck` | 静态类型检查，不生成正式产物 |
| `build` | 从干净源码生成正式构建产物 |
| `test` 或命名明确的 `test:*` | 执行可重复自动测试 |
| `start` | 启动正式构建或明确的本地正式模式 |
| `package:*` / `dist:*` | 打包目录、压缩包或安装包 |
| `verify:*` | 验证真实构建或打包产物 |

复杂编排写入 `scripts/`，`package.json` 只保留可发现的调用入口。禁止在多个平台启动器中复制同一业务逻辑。

## 9. 构建、缓存、临时和归档

```text
cache/<工程名>/               # 依赖、下载和可再生缓存
build/<工程名>/               # 编译、测试报告、Sites、安装包和 ZIP
OPTION/temp/<工程名>/         # 待执行、运行中和一次性材料
log/<工程名>/归档日志/        # 已终结任务、测试、审批、协同和诊断记录
```

源码根禁止出现：

```text
node_modules/
dist/
dist-electron/
release/
coverage/
playwright-report/
test-results/
temp/
log/
*.tsbuildinfo
```

构建工具若默认写入上述目录，必须通过配置把输出重定向到 `build/<工程名>`；不能只靠 `.gitignore` 隐藏结构污染。

## 10. Electron 专项要求

1. 主进程、preload、渲染层和共享 IPC 契约必须分离。
2. 渲染层不得直接获得 Node、文件系统、令牌或未校验的系统能力。
3. preload 只暴露白名单接口，IPC 两端都校验参数和结果。
4. 打包配置只包含真实运行所需编译产物和依赖，禁止宽泛复制整个 `shared`、工程根或缓存目录。
5. 安装包验证必须检查真实产物，而不是只检查配置文本。
6. 平台启动器必须从自身路径解析工程，调用统一 package/script 入口，并正确传回退出码。

## 11. 文件删除与归类流程

删除或迁移前依次检查：

1. `package.json` scripts 和工具配置。
2. TypeScript/JavaScript 静态导入与动态加载。
3. Electron 编译后 `.js/.cjs` 入口。
4. 测试和 fixture 引用。
5. Electron Builder、Sites 或其他打包 `files` 清单。
6. Windows/macOS/Linux 启动器。
7. README、AGENTS 和规则中的保护约束。

分类结果只能是：

- **保留**：存在真实构建、运行、测试、打包或维护职责。
- **迁移**：职责有效但当前目录错误；迁移时同步全部调用方。
- **归档后移除**：终态记录不属于源码，但必须长期保留。
- **删除**：可再生生成物、已确认无调用方草稿，或存在完整替代关系的旧文件。
- **阻断待确认**：调用证据冲突或业务含义不清楚。

## 12. AI Desktop 落地示例

`apps/ai-desktop` 当前结构符合本标准：

- `src` 保存 React 渲染层。
- `electron` 保存主进程、preload、IPC、服务和窗口。
- `shared/contracts` 保存 IPC 协议。
- `scripts` 和 `tests` 均有 package 或测试调用关系。
- Electron Builder 配置存在真实继承、脚本和测试引用，因此保留在根目录。
- Windows/macOS 启动器属于用户可发现入口，因此保留在根目录。
- `node_modules` 只允许作为当前锁哈希缓存的短时链接，命令结束后不得残留。
- 已终结的 `design-qa.md` 已迁入 `log/ai-desktop/归档日志/诊断归档`。

## 13. 完成检查表

- [ ] 工程名来自包清单或中央登记，未写死示例名称。
- [ ] 根目录每个文件都有工具、用户或维护入口。
- [ ] 正式源码按真实运行边界组织，没有空占位目录。
- [ ] 只有一个包清单和一个匹配锁文件。
- [ ] `node_modules`、缓存、构建、报告和临时材料均离开源码树。
- [ ] 公共 Node 能力只通过登记包出口使用。
- [ ] package scripts 覆盖开发、类型检查、构建、测试和启动职责。
- [ ] Electron 工程完成主进程、preload、渲染层和 IPC 契约隔离。
- [ ] 删除或迁移文件前已核对全部调用和打包入口。
- [ ] 变更后的验证命令、预期结果和状态已登记到同线程测试文档。
