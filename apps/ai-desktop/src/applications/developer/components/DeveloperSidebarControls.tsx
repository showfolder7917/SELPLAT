import { PanelLeft24Regular } from "@fluentui/react-icons";

import type { DeveloperSidebarViewModel } from "../model/developerViewModelTypes";

type DeveloperSidebarControlsProps = {
  /** 侧栏显示模型包含当前宽度和全部无业务副作用的界面事件。 */
  viewModel: DeveloperSidebarViewModel;
};

/** 显示左侧栏开关和可拖动分隔线，不读取任何应用 Controller。 */
export function DeveloperSidebarControls({ viewModel }: DeveloperSidebarControlsProps) {
  return (
    <>
      {/* 固定在最左侧的按钮负责展开或收起导航栏。 */}
      <button
        className="sidebar-toggle"
        type="button"
        aria-controls="collaboration-sidebar"
        aria-expanded={!viewModel.collapsed}
        aria-label={viewModel.toggleLabel}
        onClick={viewModel.onToggle}
      >
        <PanelLeft24Regular />
      </button>

      {/* 收起侧栏时同时移除分隔线，避免不可见控件继续接收键盘焦点。 */}
      {!viewModel.collapsed && (
        <div
          className="sidebar-resizer"
          role="separator"
          aria-label={viewModel.resizeLabel}
          aria-orientation="vertical"
          aria-valuemin={viewModel.minimumWidth}
          aria-valuemax={viewModel.maximumWidth}
          aria-valuenow={viewModel.width}
          tabIndex={0}
          onPointerDown={viewModel.onPointerResize}
          onDoubleClick={viewModel.onResetWidth}
          onKeyDown={viewModel.onKeyboardResize}
        />
      )}
    </>
  );
}
