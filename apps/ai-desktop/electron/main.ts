import path from "node:path";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow } from "electron";

import { resolveAppVariant, resolveProjectRoot } from "./config/app-config.js";
import { registerDesktopIpc } from "./ipc/register-desktop-ipc.js";
import { CodexService } from "./services/codex-service.js";
import { SettingsStore } from "./services/settings-store.js";
import { WorkspaceStore } from "./services/workspace-store.js";
import { createMainWindow } from "./window/create-main-window.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const preloadPath = path.join(currentDirectory, "preload.cjs");

let codex: CodexService | undefined;

app.whenReady().then(() => {
  const variant = resolveAppVariant();
  const projectRoot = resolveProjectRoot();
  const rendererRoot = path.resolve(currentDirectory, `../../dist/${variant === "office" ? "client" : "developer"}`);
  codex = new CodexService(projectRoot);

  registerDesktopIpc({
    codex,
    settings: new SettingsStore(path.join(app.getPath("userData"), "desktop-settings.json")),
    workspaces: new WorkspaceStore(path.join(app.getPath("userData"), "workspace-profiles.json"), projectRoot),
    projectRoot,
    variant,
  });

  createMainWindow({ preloadPath, rendererRoot, variant });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow({ preloadPath, rendererRoot, variant });
  });
});

app.on("before-quit", () => codex?.dispose());

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
