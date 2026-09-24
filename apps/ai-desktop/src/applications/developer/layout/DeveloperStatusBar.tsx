import { Branch24Regular } from "@fluentui/react-icons";

import { fixedUiText } from "../../../../contracts/foundation";
import type { AiMemoryDatabaseStatusOutDto, LocaleValue, SandboxModeValue } from "../../../../contracts/system/desktop/index";

interface DeveloperStatusBarProps {
  sandboxMode: SandboxModeValue;
  memoryStatus: AiMemoryDatabaseStatusOutDto | null;
  locale: LocaleValue;
}

/** 状态栏只展示运行摘要，不发起桌面操作。 */
export function DeveloperStatusBar({ sandboxMode, memoryStatus, locale }: DeveloperStatusBarProps) {
  const memoryLabel = memoryStatus?.state === "ready"
    ? `v${memoryStatus.schemaVersion || "-"} · ${fixedUiText(locale, "memoryEventCenter")}`
    : fixedUiText(locale, "memoryRecovery");
  return <footer className="dev-statusbar"><span><Branch24Regular /> main*</span><span>0 errors</span><span>{sandboxMode}</span><span>AI Memory {memoryLabel}</span><span>UTF-8</span></footer>;
}
