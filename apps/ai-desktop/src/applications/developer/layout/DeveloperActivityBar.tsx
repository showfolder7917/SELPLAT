import type { ReactNode } from "react";
import { Branch24Regular, Bug24Regular, Folder24Regular, Search24Regular } from "@fluentui/react-icons";

interface DeveloperActivityBarProps {
  explorerExpanded: boolean;
  filesLabel: string;
  expandLabel: string;
  collapseLabel: string;
  onToggleExplorer(): void;
  settingsControl: ReactNode;
}

/** 左侧活动栏仅拥有布局入口；设置业务由传入的 feature 控件负责。 */
export function DeveloperActivityBar({ explorerExpanded, filesLabel, expandLabel, collapseLabel, onToggleExplorer, settingsControl }: DeveloperActivityBarProps) {
  const explorerAction = `${explorerExpanded ? collapseLabel : expandLabel}${filesLabel}`;
  return <aside className="dev-activitybar">
    <button className="active" title={explorerAction} aria-label={explorerAction} aria-pressed={explorerExpanded} onClick={onToggleExplorer}><Folder24Regular /></button>
    <button><Search24Regular /></button>
    <button><Branch24Regular /></button>
    <button><Bug24Regular /></button>
    {settingsControl}
  </aside>;
}
