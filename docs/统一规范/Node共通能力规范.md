# Node 共通能力规范

本规范只定义跨应用公共 Node 能力。应用自身的 Node.js/TypeScript 工程根、源码组织、依赖、脚本和交付结构见同目录的《Node工程结构标准》。

## 1. 目标

本规范定义 SELPLAT 中跨应用复用的 Node.js/TypeScript 公共能力的唯一源码位置、进入条件、依赖方式、构建输出和打包边界。

目标是：

- 公共方法不在多个应用内复制。
- 工程名、工程根和业务标识通过参数传入，禁止写死。
- Node 公共代码与 Java、Python、前端组件保持语言和职责隔离。
- Electron 安装包只包含所需 Node 编译产物，不携带 Java、Python 或整个 `shared` 目录。

## 2. 唯一目录

跨两个及以上应用复用的 Node.js/TypeScript 公共能力统一进入：

```text
SELPLAT/shared/node/common-core/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts
│   ├── path/
│   ├── validation/
│   └── lifecycle/
└── tests/
```

职责边界：

```text
shared/node/common-core   Node.js/TypeScript 公共运行能力
shared/contracts          跨模块契约，不放运行实现
shared/frontend/sel-ui    浏览器公共组件，不放 Node 主进程能力
shared/backend            Java 后端公共能力
rule-engine Python 根     Python 规则和能力
apps/<工程名>             应用私有业务实现
```

禁止在 `shared/` 下建立第二个平行 Node 公共根，例如：

```text
shared/typescript/
shared/common-node/
shared/utils/
shared/node-utils/
```

## 3. 进入共通层的条件

能力同时满足以下条件时才能进入 `shared/node/common-core`：

1. 已有两个以上应用真实复用，或者已确认属于平台级基础能力。
2. 删除任意一个业务应用后，该能力仍然成立。
3. 不依赖具体应用页面、人物、任务文案或业务状态。
4. 输入、输出和异常边界可以独立定义并测试。
5. 不需要反向引用 `apps/<工程名>` 内部源码。

以下内容不得进入共通层：

- 只服务一个应用的临时封装。
- 应用页面、业务流程和专属状态机。
- 为减少几行代码而抽取的无业务边界工具。
- 尚未确认语义的实验实现。
- 包含固定应用名、固定用户目录或固定机器绝对路径的代码。

单应用暂时使用、但未来可能复用的实现应先留在应用内部；第二个真实调用方出现时再迁入共通层。

## 4. 包和导出规范

公共包名固定为：

```text
@selplat/node-common-core
```

应用只能通过公共导出入口使用能力：

```ts
import { resolveApplicationDataPaths } from "@selplat/node-common-core/path";
```

禁止：

```ts
import { something } from "../../../shared/node/common-core/src/internal/file.js";
```

要求：

- `package.json` 必须通过 `exports` 明确公开入口。
- 未登记到 `exports` 的文件视为内部实现。
- 应用不得引用公共包的 `src`、`dist` 内部相对路径。
- 公共 API 发生不兼容修改时必须升级主版本。
- 新增兼容能力升级次版本，缺陷修复升级补丁版本。

## 5. 路径公共能力

工程路径解析必须由公共方法统一完成，不允许每个应用自行拼接：

```ts
resolveApplicationDataPaths({
  selplatRoot,
  applicationName,
});
```

返回值至少包括：

```text
sourceRoot
cacheRoot
dependencyCacheRoot
buildRoot
tempRoot
executionLogRoot
pendingExecutionRoot
pendingTestRoot
runningExecutionRoot
runningTestRoot
temporaryMaterialsRoot
archiveLogRoot
executionArchiveRoot
testArchiveRoot
collaborationArchiveRoot
approvalArchiveRoot
diagnosticArchiveRoot
```

公共方法必须：

1. 从调用方接收已验证的 `SELPLAT_ROOT` 和真实工程名。
2. 校验工程名只能包含字母、数字、短横线和下划线。
3. 拒绝 `/`、`\`、`..` 和绝对路径。
4. 对最终路径执行根内检查，禁止路径逃逸。
5. 只返回路径，不在解析阶段创建目录、删除文件或迁移数据。

`taskId`、`runId`、`approvalId` 等动态标识必须复用同一安全标识校验方法。

## 6. 依赖规则

应用通过包依赖使用 Node 共通能力，禁止把公共源码复制进应用：

```json
{
  "dependencies": {
    "@selplat/node-common-core": "workspace:*"
  }
}
```

如果当前包管理器尚未启用 workspace，必须建立等价的根级包登记后再接入，禁止使用跨目录源码相对引用作为长期替代方案。

公共包依赖要求：

- 优先使用 Node 标准库。
- 新增第三方生产依赖必须说明跨应用价值和安装包影响。
- 禁止依赖 Electron 渲染层、React 或具体业务应用。
- Electron 专属能力应通过适配器由应用注入，公共核心不得直接读取全局 Electron 状态。
- 禁止读取用户主目录、环境秘密或未登记配置作为隐式默认值。

## 7. 构建输出

公共 Node 包的编译产物统一进入：

```text
SELPLAT/build/shared/node/common-core/
```

源码目录不得生成：

```text
dist/
build/
coverage/
*.tsbuildinfo
```

构建要求：

- TypeScript 配置必须声明独立 `rootDir` 和工程根外的统一 `outDir`。
- 类型声明、JavaScript 和 source map 按实际运行需要生成。
- 公共包测试报告进入 `build/shared/node/common-core/reports/`。
- 编译缓存进入 `cache/shared/node/common-core/`。
- 公共包构建失败必须阻断依赖它的应用打包。

## 8. Electron 打包边界

公共代码位于 `shared/` 不代表打包整个 `shared`。Electron 只能包含应用真实依赖的 Node 编译产物。

允许进入 Electron 安装包：

- `@selplat/node-common-core` 的运行时 JavaScript。
- 必要的 JSON 元数据。
- 应用运行确实需要的第三方 Node 依赖。

禁止进入 Electron 安装包：

- `shared/backend/`。
- Java 源码、class、jar 和 Gradle 文件。
- rule-engine Python 源码。
- `.py`、`.pyc` 和 `__pycache__`。
- `shared/frontend/` 中未被应用构建消费的源码。
- 公共包测试、覆盖率、构建缓存和临时材料。
- 整个 `shared/**/*` 宽泛文件匹配。

打包配置必须使用编译产物白名单，禁止通过扩大文件通配符解决缺文件问题。

## 9. 安装包门禁

每个使用 Node 共通包的 Electron 应用必须增加安装包内容检查，至少验证：

1. 公共包运行入口存在。
2. 应用能够从打包结果加载公共包。
3. 安装包不存在 `.java`、`.class`、`.py`、`.pyc`。
4. 安装包不存在 `__pycache__`、`build.gradle`、Gradle 缓存。
5. 安装包不存在 `shared/backend` 和 rule-engine 源码路径。
6. 未使用的公共模块没有进入安装包。
7. 打包结果不包含公共包测试和临时证据。

源码正则检查不能代替真实安装包内容检查。

## 10. 测试要求

公共包必须具备独立测试：

- 正常路径解析。
- 不同工程名隔离。
- 非法工程名和路径逃逸拒绝。
- Windows、macOS 和 Linux 路径语义。
- 动态标识校验。
- 公共 API 导出边界。

应用接入后还必须验证：

- 应用不再保留重复路径拼接逻辑。
- 应用只传真实工程名和工程根。
- 应用构建能加载公共包。
- Electron 安装包内容符合白名单。
- Java 和 Python 文件没有被打入安装包。

## 11. 变更流程

新增或修改 Node 共通能力时必须：

1. 查找现有近义能力，优先升级而不是重复创建。
2. 确认调用方至少两个或能力确属平台基础设施。
3. 更新公共 API 和版本。
4. 更新全部真实调用方。
5. 执行公共包独立测试。
6. 执行应用构建和集成测试。
7. 对 Electron 应用执行真实安装包内容检查。
8. 删除应用内已被替代的重复实现，禁止保留兼容代码误导后续 AI。

## 12. 完成标准

- Node 共通能力只存在一个正式源码根。
- 应用不存在公共实现副本或跨目录源码引用。
- 工程名和文件路径没有固定写死。
- 公共包可以独立构建和测试。
- 构建产物、缓存和报告全部离开源码目录。
- Electron 仅包含所需 Node 运行产物。
- Java、Python、Gradle 和测试临时数据未进入安装包。
- 公共规则索引可以命中本规范。
