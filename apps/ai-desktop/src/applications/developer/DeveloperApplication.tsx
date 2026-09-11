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
  // 第一步：创建应用控制器。它保存窗口当前状态，并提供点击、拖动和请求等操作。
  const controller = useDeveloperApplicationController();

  // 第二步：把控制器中的复杂数据整理成窗口各区域可以直接使用的显示模型。
  const viewModel = createDeveloperViewModel(controller);

  // 第三步：给每个可见区域取一个直观名称。
  // 后面的 JSX 只使用这些区域变量，新手可以从上到下追踪每块界面的数据来源。
  const shell = viewModel.shell;
  const sidebar = viewModel.sidebar;
  const titleBar = viewModel.titleBar;
  const activityBar = viewModel.activity;
  const explorer = viewModel.explorer;
  const workspace = viewModel.workspace;
  const statusBar = viewModel.statusBar;
  const approvalDialog = viewModel.approvalDialog;

  // 第四步：按照用户实际看到的窗口结构，从外到内、从上到下组合页面。
  return (
    <DeveloperShell
      // shellRef 指向窗口最外层 DOM，SELUI 工具提示需要通过它查找页面元素。
      shellRef={shell.shellRef}
      // locale 会写入最外层 lang 属性，表示当前页面使用中文还是日文。
      locale={shell.locale}
      // collapsed 决定左侧导航列是否收起。
      collapsed={shell.collapsed}
      // style 中包含当前侧栏宽度，CSS Grid 会用它计算左右布局。
      style={shell.style}
    >
      {/* 左侧栏控制：显示展开按钮，以及侧栏展开时的宽度分隔线。 */}
      <DeveloperSidebarControls viewModel={sidebar} />

      {/* 顶部标题栏：显示应用名称、工程目录和系统窗口按钮。 */}
      <DeveloperTitleBar
        projectRoot={titleBar.projectRoot}
        title={titleBar.title}
      />

      {/* 最左侧活动栏：承载功能入口和底部设置按钮。 */}
      <DeveloperActivitySection viewModel={activityBar} />

      {/* 左侧导航栏：显示运行模式、任务协作群和人物入口。 */}
      <DeveloperExplorerSection viewModel={explorer} />

      {/* 右侧主工作区：占据窗口剩余空间并展示当前页面。 */}
      <DeveloperWorkspaceSection viewModel={workspace} />

      {/* 底部状态栏：持续显示沙箱模式和数据库状态。 */}
      <DeveloperStatusBar
        sandboxMode={statusBar.sandboxMode}
        memoryStatus={statusBar.memoryStatus}
        locale={statusBar.locale}
      />

      {/* 审批对话框以模态方式覆盖整个窗口，不占据网格位置。 */}
      <CodexApprovalDialog
        controller={approvalDialog.controller}
        locale={approvalDialog.locale}
      />
    </DeveloperShell>
  );
}
