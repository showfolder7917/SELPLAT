/**
 * Developer 窗口的总布局入口。
 *
 * 新手可以直接从 return 开始，按照顶部、左侧、右侧、底部理解界面。
 * 状态计算和事件细节统一放在 model/useDeveloperApplicationController.ts 中。
 */

import { CodexApprovalDialog } from "../../features/conversation";
import { DeveloperSidebarControls } from "./components/DeveloperSidebarControls";
import { DeveloperShell, DeveloperTitleBar } from "./layout/DeveloperShell";
import { DeveloperStatusBar } from "./layout/DeveloperStatusBar";
import { createDeveloperViewModel } from "./model/createDeveloperViewModel";
import { useDeveloperApplicationController } from "./model/useDeveloperApplicationController";
import { DeveloperActivitySection } from "./sections/DeveloperActivitySection";
import { DeveloperExplorerSection } from "./sections/DeveloperExplorerSection";
import { DeveloperWorkspaceSection } from "./sections/DeveloperWorkspaceSection";

// Developer 窗口使用的 SELUI 基础控件和交互样式。
import "@selplat/sel-ui/core/kernel";
import "@selplat/sel-ui/components/floating-panel";
import "@selplat/sel-ui/components/floating-panel/styles";
import "@selplat/sel-ui/components/tooltip";
import "@selplat/sel-ui/components/tooltip/styles";
import "@selplat/sel-ui/components/context-menu";
import "@selplat/sel-ui/components/context-menu/styles";
import "@selplat/sel-ui/components/disclosure";
import "@selplat/sel-ui/components/disclosure/styles";
import "@selplat/sel-ui/components/tree";
import "@selplat/sel-ui/components/tree/styles";
import "@selplat/sel-ui/components/grid";
import "@selplat/sel-ui/components/grid/styles";
import "@selplat/sel-ui/components/search";
import "@selplat/sel-ui/components/search/styles";
import "@selplat/sel-ui/components/switch/styles";
import "../styles/desktop-applications.css";

/** DeveloperShell 按三行三列装配完整的 Developer 窗口。 */
export function DeveloperApplication() {
  // 应用控制器负责请求、状态变化和跨 Feature 协调。
  const controller = useDeveloperApplicationController();
  // 显示模型把复杂状态转换为各窗口区域可以直接使用的输入。
  const viewModel = createDeveloperViewModel(controller);

  return (
    // 第一层：整个 Developer 窗口，负责顶部、主体和底部总体网格。
    <DeveloperShell {...viewModel.shell}>
      {/* 侧栏纯组件只负责开关和宽度分隔线。 */}
      <DeveloperSidebarControls viewModel={viewModel.sidebar} />

      {/* 顶部标题栏：显示应用名称、工程目录和系统窗口按钮。 */}
      <DeveloperTitleBar {...viewModel.titleBar} />

      {/* 最左侧活动栏：承载功能入口和底部设置按钮。 */}
      <DeveloperActivitySection viewModel={viewModel.activity} />

      {/* 左侧导航栏：显示运行模式、任务协作群和人物入口。 */}
      <DeveloperExplorerSection viewModel={viewModel.explorer} />

      {/* 右侧主工作区：占据窗口剩余空间并展示当前页面。 */}
      <DeveloperWorkspaceSection viewModel={viewModel.workspace} />

      {/* 底部状态栏：持续显示沙箱模式和数据库状态。 */}
      <DeveloperStatusBar {...viewModel.statusBar} />

      {/* 审批对话框以模态方式覆盖整个窗口，不占据网格位置。 */}
      <CodexApprovalDialog {...viewModel.approvalDialog} />
    </DeveloperShell>
  );
}
