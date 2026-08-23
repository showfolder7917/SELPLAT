import path from "node:path";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow } from "electron";

import { resolveAppVariant, resolveProjectRoot } from "./config/app-config.js";
import { registerDesktopIpc } from "./ipc/register-desktop-ipc.js";
import { BusinessAuditLog } from "./services/business-audit-log.js";
import { CodexService } from "./services/codex-service.js";
import { CodexSessionStore } from "./services/codex-session-store.js";
import { ConversationDispatchStore } from "./services/conversation-dispatch-store.js";
import { CodexCollaborationSessionFactory, CollaborationCodexRegistry } from "./services/collaboration/collaboration-codex-sessions.js";
import { CollaborationCoordinator } from "./services/collaboration/collaboration-coordinator.js";
import { CollaborationDurationLog } from "./services/collaboration/collaboration-duration-log.js";
import { CollaborationStore } from "./services/collaboration/collaboration-store.js";
import { verifyCollaborationIntegration } from "./services/collaboration/integration-verifier.js";
import { VersionWorkspaceManager } from "./services/collaboration/version-workspace-manager.js";
import { ScreenshotStore } from "./services/screenshot-store.js";
import { SettingsStore } from "./services/settings-store.js";
import { WorkspaceStore } from "./services/workspace-store.js";
import { TrustedCommandStore } from "./services/trusted-command-store.js";
import { createMainWindow } from "./window/create-main-window.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const preloadPath = path.join(currentDirectory, "preload.cjs");

let codex: CodexService | undefined;
let collaboration: CollaborationCoordinator | undefined;

app.whenReady().then(() => {
  const variant = resolveAppVariant();
  const projectRoot = resolveProjectRoot();
  const rendererRoot = path.resolve(currentDirectory, `../../dist/${variant === "office" ? "client" : "developer"}`);
  const appRoot = path.join(projectRoot, "apps", "ai-desktop");
  const audit = new BusinessAuditLog(appRoot);
  audit.recordApplicationStart({ variant, projectRoot, rendererRoot });
  const trustedCommands = new TrustedCommandStore(path.join(app.getPath("userData"), "trusted-project-commands.json"));
  const codexSessions = new CodexSessionStore(path.join(app.getPath("userData"), "active-codex-session.json"));
  const dispatch = new ConversationDispatchStore(
    path.join(app.getPath("userData"), "conversation-dispatch.json"),
    (type, details, taskId) => audit.recordEvent(type, details, taskId),
  );
  codex = new CodexService(
    projectRoot,
    trustedCommands,
    codexSessions,
    (details) => audit.recordEvent("trusted_command.decision", details),
    (details) => audit.recordEvent("thread.lifecycle", details),
  );
  const collaborationRoot = path.join(app.getPath("userData"), "collaboration");
  const screenshots = new ScreenshotStore(appRoot);
  const collaborationStore = new CollaborationStore(path.join(collaborationRoot, "collaboration-state.json"));
  const collaborationDurations = new CollaborationDurationLog(audit.ensure());
  const collaborationRegistry = new CollaborationCodexRegistry(collaborationDurations);
  const collaborationSessions = new CodexCollaborationSessionFactory({
    projectRoot,
    sessionRoot: path.join(collaborationRoot, "sessions"),
    trustedCommands,
    registry: collaborationRegistry,
    resolveAttachmentPaths: (attachmentIds) => screenshots.resolveAttachmentPaths(attachmentIds),
    recordEvent: (type, details, taskId) => audit.recordEvent(type, details, taskId),
  });
  collaboration = new CollaborationCoordinator({
    store: collaborationStore,
    durations: collaborationDurations,
    workspaces: new VersionWorkspaceManager(projectRoot, path.join(collaborationRoot, "worktrees")),
    sessions: collaborationSessions,
    emitState: (state, reason) => {
      audit.recordEvent("collaboration.state.changed", { reason, mode: state.mode });
      for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("desktop:collaboration-state", { state, reason });
    },
    emitStream: (taskId, memberId, event) => {
      audit.recordEvent(`collaboration.harness.${event.type}`, { memberId, turnId: event.turnId, status: event.status || null }, taskId);
      for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("desktop:collaboration-stream", { taskId, memberId, event });
    },
    verifyIntegration: (rootPath, taskIds) => verifyCollaborationIntegration(rootPath, taskIds, projectRoot),
  });

  registerDesktopIpc({
    codex,
    screenshots,
    settings: new SettingsStore(path.join(app.getPath("userData"), "desktop-settings.json")),
    workspaces: new WorkspaceStore(path.join(app.getPath("userData"), "workspace-profiles.json"), projectRoot),
    trustedCommands,
    dispatch,
    collaboration,
    collaborationRegistry,
    audit,
    projectRoot,
    variant,
    preloadPath,
    rendererRoot,
  });

  createMainWindow({ preloadPath, rendererRoot, variant });
  collaboration.resumePendingWork();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow({ preloadPath, rendererRoot, variant });
  });
});

app.on("before-quit", () => {
  void collaboration?.dispose();
  codex?.dispose();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
