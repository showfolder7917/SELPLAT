import type { ReactNode } from "react";

interface DeveloperExplorerProps {
  /** 左侧栏内部由应用装配的任务导航区域。 */
  children: ReactNode;
}

/** Developer 左侧栏只提供导航容器，具体任务入口由同目录的 TaskExplorerFeature 负责。 */
export function DeveloperExplorer({ children }: DeveloperExplorerProps) {
  return <aside id="collaboration-sidebar" className="dev-explorer">
    <div className="dev-explorer-sections">{children}</div>
  </aside>;
}
