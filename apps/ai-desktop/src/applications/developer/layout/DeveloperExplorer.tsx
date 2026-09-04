import type { ReactNode } from "react";
interface DeveloperExplorerProps {
  children: ReactNode;
}

/** Explorer 布局拥有侧栏标题与活动分区容器，工作区树和任务树作为业务控件传入。 */
export function DeveloperExplorer({ children }: DeveloperExplorerProps) {
  return <aside id="collaboration-sidebar" className="dev-explorer">
    <div className="dev-explorer-sections">{children}</div>
  </aside>;
}
