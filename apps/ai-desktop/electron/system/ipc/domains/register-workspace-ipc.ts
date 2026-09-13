import { BrowserWindow, dialog } from "electron";

import { WORKSPACE_PERMISSIONS, type WorkspacePermissionValue } from "../../../../contracts/foundation/index.js";
import type { WorkspaceDirectoryOutDto, WorkspaceStateOutDto } from "../../../../contracts/services/support/platform/workspace/index.js";
import type { EventCenterFacade } from "../../../services/support/capabilities/event-center/index.js";
import type { WorkspaceFacade as WorkspaceStore } from "../../../services/support/platform/workspace/index.js";
import { registerEventCenterIpcHandler } from "../event-center-ipc.js";

interface WorkspaceAcceptanceFixturePort {
  takeDirectory(): string | null;
  registerWorkspace(directory: string, state: WorkspaceStateOutDto): void;
  readDirectory(workspaceId: string, relativePath: string): { scenario: string; result: Promise<WorkspaceDirectoryOutDto> } | null;
}

/** 工作区领域独立登记目录选择、权限和主目录通道，避免系统对话框逻辑混入总注册器。 */
export function registerWorkspaceIpc(workspaces: WorkspaceStore, eventCenter: EventCenterFacade, acceptanceFixture?: WorkspaceAcceptanceFixturePort): void {
  const handle = <Arguments extends unknown[]>(channel: string, handler: Parameters<typeof registerEventCenterIpcHandler<Arguments>>[2]): void => registerEventCenterIpcHandler(eventCenter, channel, handler, "business");
  handle("desktop:get-workspaces", () => workspaces.read());
  handle("desktop:add-workspace", async (event) => {
    // 韩立验收只能消费主进程预备的一次性目录；不存在预备目录时保留用户原生选择流程。
    const acceptanceDirectory = acceptanceFixture?.takeDirectory() || null;
    if (acceptanceDirectory) {
      const state = workspaces.add(acceptanceDirectory);
      acceptanceFixture?.registerWorkspace(acceptanceDirectory, state);
      eventCenter.recordEvent("workspace.added", { path: acceptanceDirectory, source: "hanli-acceptance-fixture" });
      return state;
    }
    const parent = BrowserWindow.fromWebContents(event.sender);
    const options = { properties: ["openDirectory", "createDirectory"] as ("openDirectory" | "createDirectory")[] };
    const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return workspaces.read();
    const state = workspaces.add(result.filePaths[0]);
    eventCenter.recordEvent("workspace.added", { path: result.filePaths[0] });
    return state;
  });
  handle("desktop:update-workspace-permission", (_event, id: string, permission: WorkspacePermissionValue) => {
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
  handle("desktop:list-workspace-directory", async (_event, id: string, relativePath: string = "") => {
    const fixtureRead = acceptanceFixture?.readDirectory(id, relativePath);
    if (!fixtureRead) return workspaces.listDirectory(id, relativePath);
    eventCenter.recordEvent("workspace.directory_read", { source: "hanli-acceptance-fixture", scenario: fixtureRead.scenario, relativePath });
    return fixtureRead.result;
  });
  handle("desktop:read-workspace-file", (_event, id: string, relativePath: string) => workspaces.readFilePreview(id, relativePath));
}
