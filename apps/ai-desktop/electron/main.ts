import path from "node:path";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow } from "electron";

import { resolveAppVariant, resolveProjectRoot } from "./config/app-config.js";
import { registerDesktopIpc } from "./ipc/register-desktop-ipc.js";
import { BusinessAuditLog } from "./services/business-audit-log.js";
import { CodexService } from "./services/codex-service.js";
import { CodexSessionStore } from "./services/codex-session-store.js";
import { ScreenshotStore } from "./services/screenshot-store.js";
import { SettingsStore } from "./services/settings-store.js";
import { WorkspaceStore } from "./services/workspace-store.js";
import { TrustedCommandStore } from "./services/trusted-command-store.js";
import { createMainWindow } from "./window/create-main-window.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const preloadPath = path.join(currentDirectory, "preload.cjs");

let codex: CodexService | undefined;

app.whenReady().then(() => {
  const variant = resolveAppVariant();
  const projectRoot = resolveProjectRoot();
  const rendererRoot = path.resolve(currentDirectory, `../../dist/${variant === "office" ? "client" : "developer"}`);
  const appRoot = path.join(projectRoot, "apps", "ai-desktop");
  const audit = new BusinessAuditLog(appRoot);
  audit.recordApplicationStart({ variant, projectRoot, rendererRoot });
  const trustedCommands = new TrustedCommandStore(path.join(app.getPath("userData"), "trusted-project-commands.json"));
  const codexSessions = new CodexSessionStore(path.join(app.getPath("userData"), "active-codex-session.json"));
  codex = new CodexService(
    projectRoot,
    trustedCommands,
    codexSessions,
    (details) => audit.recordEvent("trusted_command.decision", details),
    (details) => audit.recordEvent("thread.lifecycle", details),
  );

  registerDesktopIpc({
    codex,
    screenshots: new ScreenshotStore(appRoot),
    settings: new SettingsStore(path.join(app.getPath("userData"), "desktop-settings.json")),
    workspaces: new WorkspaceStore(path.join(app.getPath("userData"), "workspace-profiles.json"), projectRoot),
    trustedCommands,
    audit,
    projectRoot,
    variant,
    preloadPath,
    rendererRoot,
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
