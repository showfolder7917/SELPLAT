import { BrowserWindow, ipcMain } from "electron";

import { LOCALES, SANDBOX_MODES } from "../../shared/contracts/desktop.js";
import type {
  AppVariant,
  DesktopSettings,
  SendMessageRequest,
  WindowAction,
} from "../../shared/contracts/desktop.js";
import { CodexService } from "../services/codex-service.js";
import { SettingsStore } from "../services/settings-store.js";

interface DesktopIpcDependencies {
  codex: CodexService;
  settings: SettingsStore;
  projectRoot: string;
  variant: AppVariant;
}

export function registerDesktopIpc(dependencies: DesktopIpcDependencies): void {
  const { codex, settings, projectRoot, variant } = dependencies;

  ipcMain.handle("desktop:get-environment", () => ({ projectRoot, platform: process.platform, variant }));
  ipcMain.handle("desktop:get-settings", () => settings.read());
  ipcMain.handle("desktop:update-settings", (_event, patch: Partial<DesktopSettings>) => settings.update(patch));
  ipcMain.handle("desktop:new-chat", () => codex.newChat());
  ipcMain.handle("desktop:cancel", () => codex.cancel());
  ipcMain.handle("desktop:send-message", (_event, request: SendMessageRequest) => {
    if (!request || typeof request.message !== "string") throw new Error("Invalid message request.");
    if (!LOCALES.includes(request.locale)) throw new Error("Invalid locale.");
    if (!SANDBOX_MODES.includes(request.sandboxMode)) throw new Error("Invalid sandbox mode.");
    return codex.send(request.message, request.locale, request.sandboxMode);
  });

  ipcMain.on("window:control", (event, action: WindowAction) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    if (action === "minimize") window.minimize();
    if (action === "maximize") window.isMaximized() ? window.unmaximize() : window.maximize();
    if (action === "close") window.close();
  });
}
