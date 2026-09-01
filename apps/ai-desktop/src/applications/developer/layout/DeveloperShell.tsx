import type { CSSProperties, ReactNode, RefObject } from "react";
import { Code24Regular, Search24Regular } from "@fluentui/react-icons";

import { WindowControls } from "../../../features/shell/components/DesktopChrome";

interface DeveloperShellProps {
  shellRef: RefObject<HTMLDivElement | null>;
  explorerExpanded: boolean;
  locale: string;
  style: CSSProperties;
  children: ReactNode;
}

/** Developer Application 的顶层网格，只定义布局区域，不持有业务状态。 */
export function DeveloperShell({ shellRef, explorerExpanded, locale, style, children }: DeveloperShellProps) {
  return <div ref={shellRef} className={`developer-shell ${explorerExpanded ? "" : "explorer-collapsed"}`} lang={locale} style={style}>{children}</div>;
}

interface DeveloperTitleBarProps {
  projectRoot: string;
  title: string;
  archiveDistribution: boolean;
}

/** Developer 标题栏布局控件；窗口动作继续由 shell feature 统一提供。 */
export function DeveloperTitleBar({ projectRoot, title, archiveDistribution }: DeveloperTitleBarProps) {
  return <header className="dev-titlebar">
    <div className="dev-brand"><Code24Regular /><strong>AI Desktop</strong><span>{title}</span>{archiveDistribution && <span>压缩包版</span>}</div>
    <div className="dev-command"><Search24Regular /><span>{projectRoot}</span></div>
    <WindowControls />
  </header>;
}
