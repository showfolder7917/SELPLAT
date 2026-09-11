import type { CodexHarnessStatusOutDto } from "../../../../contracts/system/desktop/index";
import type { useWorkspaceRegistry } from "../../workspace";
import type { useDesktopDiagnostics } from "../model/useDesktopDiagnostics";
import type { useDesktopSettings } from "../model/useDesktopSettings";

/** 设置页面使用的应用级中日文文案。 */
export type DeveloperSettingsText = {
  account: string;
  signedOut: string;
  signOut: string;
  signIn: string;
  tempFiles: string;
  openTemp: string;
  clearTemp: string;
  clearConfirm: string;
  trustedCommands: string;
  trustHint: string;
  clearTrustedCommands: string;
  clearTrustedConfirm: string;
  auditLogs: string;
  openAuditLogs: string;
  noAuditTask: string;
  readOnly: string;
  write: string;
  workspaces: string;
  addWorkspace: string;
  primary: string;
  makePrimary: string;
  minimumWorkspace: string;
  remove: string;
  readOnlyTip: string;
  writeTip: string;
};

/** Developer 应用交给设置 Section 的公开输入。 */
export type DeveloperSettingsFeatureProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: CodexHarnessStatusOutDto;
  loginHint: string;
  text: DeveloperSettingsText;
  settings: ReturnType<typeof useDesktopSettings>;
  diagnostics: ReturnType<typeof useDesktopDiagnostics>;
  workspace: ReturnType<typeof useWorkspaceRegistry>;
  onLogin: () => void;
  onLogout: () => void;
  onTempFilesCleared: () => void;
};
