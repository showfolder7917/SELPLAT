import type { ReactNode } from "react";
import { ChevronDown16Regular, ChevronRight16Regular } from "@fluentui/react-icons";

interface DeveloperExplorerProps {
  expanded: boolean;
  label: string;
  expandLabel: string;
  collapseLabel: string;
  activeSection: string | null;
  onToggle(): void;
  children: ReactNode;
}

/** Explorer 布局拥有侧栏标题与活动分区容器，工作区树和任务树作为业务控件传入。 */
export function DeveloperExplorer({ expanded, label, expandLabel, collapseLabel, activeSection, onToggle, children }: DeveloperExplorerProps) {
  return <aside className="dev-explorer">
    <div className="dev-section-title explorer-title">
      <button className="section-toggle" aria-expanded={expanded} aria-controls="developer-explorer-sections" aria-label={`${expanded ? collapseLabel : expandLabel}${label}`} onClick={onToggle}>{expanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}<span>{label}</span></button>
    </div>
    <div id="developer-explorer-sections" className={`dev-explorer-sections active-${activeSection ?? "none"}`}>{children}</div>
  </aside>;
}
