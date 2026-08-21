import { BrowserWindow, dialog, ipcMain, shell } from "electron";

import { LOCALES, SANDBOX_MODES, WORKSPACE_PERMISSIONS } from "../../shared/contracts/desktop.js";
import type {
  AppVariant,
  DesktopSettings,
  SendMessageRequest,
  WorkspacePermission,
  WindowAction,
} from "../../shared/contracts/desktop.js";
import { CodexService } from "../services/codex-service.js";
import { SettingsStore } from "../services/settings-store.js";
import { WorkspaceStore } from "../services/workspace-store.js";

interface DesktopIpcDependencies {
  codex: CodexService;
  settings: SettingsStore;
  workspaces: WorkspaceStore;
  projectRoot: string;
  variant: AppVariant;
}

export function registerDesktopIpc(dependencies: DesktopIpcDependencies): void {
  const { codex, settings, workspaces, projectRoot, variant } = dependencies;

  ipcMain.handle("desktop:get-environment", () => ({ projectRoot, platform: process.platform, variant }));
  ipcMain.handle("desktop:get-settings", () => settings.read());
  ipcMain.handle("desktop:update-settings", (_event, patch: Partial<DesktopSettings>) => settings.update(patch));
  ipcMain.handle("desktop:get-workspaces", () => workspaces.read());
  ipcMain.handle("desktop:add-workspace", async (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    const options = { properties: ["openDirectory", "createDirectory"] as ("openDirectory" | "createDirectory")[] };
    const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
    return result.canceled || !result.filePaths[0] ? workspaces.read() : workspaces.add(result.filePaths[0]);
  });
  ipcMain.handle("desktop:update-workspace-permission", (_event, id: string, permission: WorkspacePermission) => {
    if (!WORKSPACE_PERMISSIONS.includes(permission)) throw new Error("Invalid workspace permission.");
    return workspaces.updatePermission(id, permission);
  });
  ipcMain.handle("desktop:set-primary-workspace", (_event, id: string) => workspaces.setPrimary(id));
  ipcMain.handle("desktop:remove-workspace", (_event, id: string) => workspaces.remove(id));
  ipcMain.handle("desktop:list-workspace-entries", (_event, id: string) => workspaces.listEntries(id));
  ipcMain.handle("desktop:get-codex-status", () => codex.getStatus());
  ipcMain.handle("desktop:login-with-chatgpt", async () => {
    const login = await codex.loginWithChatGPT();
    await shell.openExternal(login.authUrl);
    return login;
  });
  ipcMain.handle("desktop:logout-codex", () => codex.logout());
  ipcMain.handle("desktop:get-codex-approvals", () => codex.pendingApprovals());
  ipcMain.handle("desktop:resolve-codex-approval", (_event, requestId: number, decision: "accept" | "decline") => {
    if (!Number.isSafeInteger(requestId) || (decision !== "accept" && decision !== "decline")) {
      throw new Error("Invalid Codex approval response.");
    }
    codex.resolveApproval(requestId, decision);
  });
  ipcMain.handle("desktop:new-chat", () => codex.newChat());
  ipcMain.handle("desktop:cancel", () => codex.cancel());
  ipcMain.handle("desktop:send-message", (_event, request: SendMessageRequest) => {
    if (!request || typeof request.message !== "string") throw new Error("Invalid message request.");
    if (!LOCALES.includes(request.locale)) throw new Error("Invalid locale.");
    if (!SANDBOX_MODES.includes(request.sandboxMode)) throw new Error("Invalid sandbox mode.");
    return codex.send(request.message, request.locale, request.sandboxMode, workspaces.read());
  });

  ipcMain.on("window:control", (event, action: WindowAction) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    if (action === "minimize") window.minimize();
    if (action === "maximize") window.isMaximized() ? window.unmaximize() : window.maximize();
    if (action === "close") window.close();
  });
}
