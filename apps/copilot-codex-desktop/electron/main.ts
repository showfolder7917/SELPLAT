import path from "node:path";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow } from "electron";

import { resolveAppVariant, resolveProjectRoot } from "./config/app-config.js";
import { registerDesktopIpc } from "./ipc/register-desktop-ipc.js";
import { CodexService } from "./services/codex-service.js";
import { SettingsStore } from "./services/settings-store.js";
import { createMainWindow } from "./window/create-main-window.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const preloadPath = path.join(currentDirectory, "preload.cjs");

app.whenReady().then(() => {
  const variant = resolveAppVariant();
  const projectRoot = resolveProjectRoot();
  const rendererRoot = path.resolve(currentDirectory, `../../dist/${variant === "office" ? "client" : "developer"}`);

  registerDesktopIpc({
    codex: new CodexService(projectRoot),
    settings: new SettingsStore(path.join(app.getPath("userData"), "desktop-settings.json")),
    projectRoot,
    variant,
  });

  createMainWindow({ preloadPath, rendererRoot, variant });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow({ preloadPath, rendererRoot, variant });
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
