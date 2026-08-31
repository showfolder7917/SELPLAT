import { BrowserWindow, dialog } from "electron";

import { WORKSPACE_PERMISSIONS, type WorkspacePermission } from "../../../contracts/foundation/base.js";
import type { EventCenterFacade } from "../../services/capabilities/event-center/index.js";
import type { WorkspaceFacade as WorkspaceStore } from "../../services/platform/workspace/index.js";
import { registerEventCenterIpcHandler } from "../event-center-ipc.js";

/** 工作区领域独立登记目录选择、权限和主目录通道，避免系统对话框逻辑混入总注册器。 */
export function registerWorkspaceIpc(workspaces: WorkspaceStore, eventCenter: EventCenterFacade): void {
  const handle = <Arguments extends unknown[]>(channel: string, handler: Parameters<typeof registerEventCenterIpcHandler<Arguments>>[2]): void => registerEventCenterIpcHandler(eventCenter, channel, handler, "business");
  handle("desktop:get-workspaces", () => workspaces.read());
  handle("desktop:add-workspace", async (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    const options = { properties: ["openDirectory", "createDirectory"] as ("openDirectory" | "createDirectory")[] };
    const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return workspaces.read();
    const state = workspaces.add(result.filePaths[0]);
    eventCenter.recordEvent("workspace.added", { path: result.filePaths[0] });
    return state;
  });
  handle("desktop:update-workspace-permission", (_event, id: string, permission: WorkspacePermission) => {
    if (!WORKSPACE_PERMISSIONS.includes(permission)) throw new Error("Invalid workspace permission.");
    const state = workspaces.updatePermission(id, permission);
    eventCenter.recordEvent("workspace.permission_updated", { id, permission });
    return state;
  });
  handle("desktop:set-primary-workspace", (_event, id: string) => {
    const state = workspaces.setPrimary(id);
    eventCenter.recordEvent("workspace.primary_updated", { id });
    return state;
  });
  handle("desktop:remove-workspace", (_event, id: string) => {
    const state = workspaces.remove(id);
    eventCenter.recordEvent("workspace.removed", { id });
    return state;
  });
  handle("desktop:list-workspace-entries", (_event, id: string) => workspaces.listEntries(id));
}
