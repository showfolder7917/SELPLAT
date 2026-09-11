import type { ReactNode } from "react";

interface DeveloperActivityBarProps {
  testConsoleControl: ReactNode;
  settingsControl: ReactNode;
}

/** 左侧活动栏仅拥有布局入口；测试台和设置业务由各自 Feature 负责。 */
export function DeveloperActivityBar({ testConsoleControl, settingsControl }: DeveloperActivityBarProps) {
  return <aside className="dev-activitybar">
    {testConsoleControl}
    {settingsControl}
  </aside>;
}
