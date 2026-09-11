# AI Desktop Renderer 源码阅读指南

Renderer 展示层采用单向依赖：

```text
Controller → ViewModel → Section → Pure UI Component
```

这是按复杂度采用的边界规则，不要求每个目录机械凑齐四层。只有确实存在状态协调、显示转换、区域编排或可复用视觉单元时，才建立对应层。

## 四层职责

- **Controller**：读取 Hook、Desktop API 和外部状态，处理副作用与用户动作。
- **ViewModel**：把原始状态转换成可直接显示的数据、文案和回调，不返回 JSX。
- **Section**：表达页面区域和布局关系，只做少量区域级条件渲染。
- **Pure UI Component**：只消费 Props 并触发传入的回调，不读取业务 Hook 或 Desktop API。

依赖只能沿箭头向右。纯 UI 不能反向读取 Controller，ViewModel 也不能负责 JSX 拼装。

## Developer 主窗口

```text
applications/developer/
├─ DeveloperApplication.tsx                 # 窗口装配入口
├─ model/
│  ├─ useDeveloperApplicationController.ts  # 状态、命令和副作用
│  ├─ createDeveloperViewModel.ts            # 窗口显示模型
│  ├─ useDeveloperWorkspaceRouterController.ts # 工作区页签导航
│  ├─ createDeveloperWorkspaceRouterViewModel.ts # 页签页面显示模型
│  ├─ useLinghuDisplayConversationController.ts # 令狐页签动作副作用
│  └─ developerViewModelTypes.ts             # 各区域显示模型类型
├─ sections/
│  ├─ DeveloperActivitySection.tsx           # 左侧活动栏区域
│  ├─ DeveloperExplorerSection.tsx           # 资源管理器区域
│  ├─ DeveloperWorkspaceSection.tsx          # 主工作区区域
│  └─ DeveloperWorkspacePageSection.tsx      # 单个页签页面区域
├─ components/
│  ├─ DeveloperSidebarControls.tsx           # 侧栏开关和拖动条
│  ├─ DeveloperWorkspaceTabAction.tsx        # 页签纯 UI 动作按钮
│  └─ AiMemoryRecoveryBanner.tsx             # AI 记忆恢复提示
├─ layout/                                   # 窗口布局骨架
├─ explorer/                                 # 左侧任务导航
└─ workspace/                                # 右侧页面路由
```

从 `DeveloperApplication.tsx` 开始阅读。它按视觉顺序列出外壳、侧栏、标题栏、活动栏、资源管理器、工作区、状态栏和审批对话框；了解行为再进入 Controller，了解显示转换再进入 ViewModel。

## 其他已分层对象

- `applications/screenshot`：入口装配 Controller、ViewModel 和 `ScreenshotApplicationSection`；Canvas、坐标换算和标注算法留在专业模块。
- `features/collaboration`：Feature 是 Section，ViewModel 转换协作任务和成员页面数据。
- `features/conversation`：Workspace 是 Section，ViewModel 提供显示文案和自动测试对话框数据，`AutomaticTestDialog` 是纯 UI。
- `features/settings`：Feature 是适配 Section，Controller 负责确认框和 Desktop API，ViewModel 转换设置项，View 负责纯展示。

## 不机械拆层的对象

- `features/hanli` 和 `features/nangong` 已有“控制 Hook + View + 叶子组件”边界，再增加同义层只会制造转发，因此保留现状。
- 截图 Canvas、geometry、editor 属于专业交互和算法模块，不作为普通 Section 拆散。
- `foundation`、`theme`、通用 `model`、契约和工具函数不是页面展示层，不套用四层目录。
- 简单静态组件保持纯组件；没有显示转换时不创建空 ViewModel。

## 新手判断方法

1. 读取状态、调用 API 或执行副作用：放进 Controller。
2. 把业务数据变成标题、标签、列表项或禁用状态：放进 ViewModel。
3. 表达一个可独立理解的页面区域：放进 Section。
4. 只根据 Props 画界面并上报点击：放进 Pure UI Component。

某一步没有真实职责就跳过该层。`tests/contracts/module-boundaries.test.mjs` 会持续校验关键边界。
