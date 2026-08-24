import { BrowserWindow, dialog, ipcMain } from "electron";

import { WORKSPACE_PERMISSIONS, type WorkspacePermission } from "../../../contracts/base.js";
import type { BusinessAuditLog } from "../../services/business-audit-log.js";
import type { WorkspaceStore } from "../../services/workspace-store.js";

/** 工作区领域独立登记目录选择、权限和主目录通道，避免系统对话框逻辑混入总注册器。 */
export function registerWorkspaceIpc(workspaces: WorkspaceStore, audit: BusinessAuditLog): void {
  ipcMain.handle("desktop:get-workspaces", () => workspaces.read());
  ipcMain.handle("desktop:add-workspace", async (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    const options = { properties: ["openDirectory", "createDirectory"] as ("openDirectory" | "createDirectory")[] };
    const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return workspaces.read();
    const state = workspaces.add(result.filePaths[0]);
    audit.recordEvent("workspace.added", { path: result.filePaths[0] });
    return state;
  });
  ipcMain.handle("desktop:update-workspace-permission", (_event, id: string, permission: WorkspacePermission) => {
    if (!WORKSPACE_PERMISSIONS.includes(permission)) throw new Error("Invalid workspace permission.");
    const state = workspaces.updatePermission(id, permission);
    audit.recordEvent("workspace.permission_updated", { id, permission });
    return state;
  });
  ipcMain.handle("desktop:set-primary-workspace", (_event, id: string) => {
    const state = workspaces.setPrimary(id);
    audit.recordEvent("workspace.primary_updated", { id });
    return state;
  });
  ipcMain.handle("desktop:remove-workspace", (_event, id: string) => {
    const state = workspaces.remove(id);
    audit.recordEvent("workspace.removed", { id });
    return state;
  });
  ipcMain.handle("desktop:list-workspace-entries", (_event, id: string) => workspaces.listEntries(id));
}
