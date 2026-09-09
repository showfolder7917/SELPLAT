
  applications/developer
  ├─ DeveloperApplication.tsx
  ├─ explorer
  │  ├─ DeveloperExplorer.tsx
  │  ├─ TaskExplorerFeature.tsx
  │  ├─ OperatingModeSwitch.tsx
  │  ├─ SingleConversationTaskSummary.tsx
  │  └─ CollaborationTaskNavigation.tsx
  ├─ workspace
  │  ├─ DeveloperWorkspace.tsx
  │  └─ DeveloperWorkspaceRouter.tsx
  └─ layout
     ├─ DeveloperShell.tsx
     ├─ DeveloperActivityBar.tsx
     └─ DeveloperStatusBar.tsx

  主要入口：

  - 左侧任务导航：apps/ai-desktop/src/applications/developer/explorer/TaskExplorerFeature.tsx:54
  - 协作入口和人物列表：apps/ai-desktop/src/applications/developer/explorer/CollaborationTaskNavigation.tsx:43
  - 右侧页面路由：apps/ai-desktop/src/applications/developer/workspace/DeveloperWorkspaceRouter.tsx:273
  - 总装配关系：apps/ai-desktop/src/applications/developer/DeveloperApplication.tsx:290

  原来的 CollaborationExplorerFeature.tsx 已退役，协作 Feature 现在只负责右侧协作页面和协作状态。

  验证结果：

  - 目录结构、模块边界、协作页面和 SEL UI 静态回归：30 项通过。
  - git diff --check：通过。
  - 类型检查和正式启动被已有损坏依赖缓存 .broken-20260903 阻断，npm 报错 Exit handler never called，尚未进入 tsc。
  - 已登记到OPTION/测试文档.01a0844b-6bd9-7663-9964-95216b27230f.md，待统一测试时恢复依赖缓存后补跑。
