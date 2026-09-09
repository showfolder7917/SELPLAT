import type { ReactNode } from "react";

/** Developer 右侧工作区只提供内容舞台，具体页面由同目录路由选择。 */
export function DeveloperWorkspace({ children }: { children: ReactNode }) {
  return <div className="workspace-stage-single"><main className="dev-main">{children}</main></div>;
}
