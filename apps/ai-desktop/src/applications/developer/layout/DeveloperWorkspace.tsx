import type { ReactNode } from "react";

/** 主工作区布局只提供内容舞台，具体会话、协作和人物页面由 feature 决定。 */
export function DeveloperWorkspace({ children }: { children: ReactNode }) {
  return <div className="workspace-stage-single"><main className="dev-main">{children}</main></div>;
}
