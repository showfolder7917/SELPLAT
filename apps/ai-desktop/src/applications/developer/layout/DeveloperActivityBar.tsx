import type { ReactNode } from "react";

interface DeveloperActivityBarProps {
  settingsControl: ReactNode;
}

/** 左侧活动栏仅拥有布局入口；设置业务由传入的 feature 控件负责。 */
export function DeveloperActivityBar({ settingsControl }: DeveloperActivityBarProps) {
  return <aside className="dev-activitybar">
    {settingsControl}
  </aside>;
}
