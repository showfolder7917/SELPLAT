/** 系统、设置与工作区桥接；路径选择和权限校验全部由主进程完成。 */
import { invoke, send } from "../ipc-client.cjs";

export function systemBridge() {
  return {
    getEnvironment: () => invoke("desktop:get-environment"),
    getAiMemoryDatabaseStatus: () => invoke("desktop:get-ai-memory-database-status"),
    getApprovalGovernance: () => invoke("desktop:get-approval-governance"),
    getSettings: () => invoke("desktop:get-settings"),
    updateSettings: (settings: unknown) => invoke("desktop:update-settings", settings),
    getWorkspaces: () => invoke("desktop:get-workspaces"),
    addWorkspace: () => invoke("desktop:add-workspace"),
    updateWorkspacePermission: (id: string, permission: "read-only" | "workspace-write") => invoke("desktop:update-workspace-permission", id, permission),
    setPrimaryWorkspace: (id: string) => invoke("desktop:set-primary-workspace", id),
    removeWorkspace: (id: string) => invoke("desktop:remove-workspace", id),
    listWorkspaceEntries: (id: string) => invoke("desktop:list-workspace-entries", id),
    openExternalUrl: (url: string) => invoke("desktop:open-external-url", url),
    getTempDirectoryInfo: () => invoke("desktop:get-temp-directory-info"),
    openTempDirectory: () => invoke("desktop:open-temp-directory"),
    clearTempFiles: () => invoke("desktop:clear-temp-files"),
    getAuditLogInfo: () => invoke("desktop:get-audit-log-info"),
    openAuditLogDirectory: () => invoke("desktop:open-audit-log-directory"),
    reportRendererException: (report: unknown) => send("desktop:renderer-exception", report),
    windowControl: (action: "minimize" | "maximize" | "close") => send("window:control", action),
  };
}
