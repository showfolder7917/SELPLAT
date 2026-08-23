import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow } from "electron";
import { resolveApplicationDataPaths } from "@selplat/node-common-core/path";

import { resolveApplicationName, resolveAppVariant, resolveProjectRoot } from "./config/app-config.js";
import { registerDesktopIpc } from "./ipc/register-desktop-ipc.js";
import { BusinessAuditLog } from "./services/business-audit-log.js";
import { CodexService } from "./services/codex-service.js";
import { CodexSessionStore } from "./services/codex-session-store.js";
import { ConversationDispatchStore } from "./services/conversation-dispatch-store.js";
import { CodexCollaborationSessionFactory, CollaborationCodexRegistry } from "./services/collaboration/collaboration-codex-sessions.js";
import { CollaborationCoordinator } from "./services/collaboration/collaboration-coordinator.js";
import { CollaborationDurationLog } from "./services/collaboration/collaboration-duration-log.js";
import { CollaborationStore } from "./services/collaboration/collaboration-store.js";
import { LinghuAutomationFacade } from "./services/collaboration/linghu-automation-facade.js";
import { LinghuAutomationStore } from "./services/collaboration/linghu-automation-store.js";
import { LinghuUnifiedTestRunner } from "./services/collaboration/linghu-unified-test-runner.js";
import { verifyCollaborationIntegration } from "./services/collaboration/integration-verifier.js";
import { VersionWorkspaceManager } from "./services/collaboration/version-workspace-manager.js";
import { TaskWorktreeTestRunner } from "./services/collaboration/task-worktree-test-runner.js";
import { TestResourceCoordinatorFacade } from "./services/collaboration/test-resource-coordinator-facade.js";
import { IntegrationReleaseCoordinatorFacade } from "./services/collaboration/integration-release-coordinator-facade.js";
import { ReleaseBatchStore } from "./services/collaboration/release-batch-store.js";
import { resolveVerifiedDeveloperExecutable, stageVerifiedDeveloperExecutable } from "./services/collaboration/verified-package-release.js";
import { ScreenshotStore } from "./services/screenshot-store.js";
import { SettingsStore } from "./services/settings-store.js";
import { WorkspaceStore } from "./services/workspace-store.js";
import { TrustedCommandStore } from "./services/trusted-command-store.js";
import { createMainWindow } from "./window/create-main-window.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const preloadPath = path.join(currentDirectory, "preload.cjs");

let codex: CodexService | undefined;
let collaboration: CollaborationCoordinator | undefined;
let linghuAutomation: LinghuAutomationFacade | undefined;

// 开发启动、正式包与重启交接共用同一数据域，确保所有人物任务在版本切换后继续执行。
const healthCheckFile = process.argv.find((argument) => argument.startsWith("--ai-desktop-health-check-file="))?.slice("--ai-desktop-health-check-file=".length) || null;
const isolatedUserData = process.argv.find((argument) => argument.startsWith("--ai-desktop-user-data-dir="))?.slice("--ai-desktop-user-data-dir=".length) || null;
app.setPath("userData", isolatedUserData ? path.resolve(isolatedUserData) : path.join(app.getPath("appData"), resolveApplicationName()));

app.whenReady().then(() => {
  const variant = resolveAppVariant();
  const projectRoot = resolveProjectRoot();
  const applicationName = resolveApplicationName();
  const projectPaths = resolveApplicationDataPaths({ selplatRoot: projectRoot, applicationName });
  const rendererRoot = variant === "office"
    ? path.join(projectPaths.buildRoot, "sites", "client")
    : path.join(projectPaths.buildRoot, "renderer", "developer");
  const appRoot = projectPaths.sourceRoot;
  const releaseVersion = (JSON.parse(readFileSync(path.join(appRoot, "package.json"), "utf8")) as { version: string }).version;
  const audit = new BusinessAuditLog(projectPaths.sourceRoot, projectPaths.buildRoot, projectPaths.archiveLogRoot);
  audit.recordApplicationStart({ variant, projectRoot, rendererRoot });
  const trustedCommands = new TrustedCommandStore(path.join(app.getPath("userData"), "trusted-project-commands.json"));
  const codexSessions = new CodexSessionStore(path.join(app.getPath("userData"), "active-codex-session.json"));
  const settings = new SettingsStore(path.join(app.getPath("userData"), "desktop-settings.json"));
  // 主会话与所有协同成员共用 AI Desktop 自己的数据域，和 Codex App 的默认 ~/.codex 完全隔离。
  const codexHome = path.join(app.getPath("userData"), "codex-home");
  mkdirSync(codexHome, { recursive: true });
  const dispatch = new ConversationDispatchStore(
    path.join(app.getPath("userData"), "conversation-dispatch.json"),
    (type, details, taskId) => audit.recordEvent(type, details, taskId),
  );
  codex = new CodexService(
    projectRoot,
    trustedCommands,
    codexSessions,
    {
      codexHome,
      serviceName: "selplat_ai_desktop",
      threadSource: "ai-desktop",
      migrateLegacySession: true,
      sessionStorage: "ai-desktop",
      validationOwner: "codex",
      readSettings: () => settings.read(),
    },
    (details) => audit.recordEvent("trusted_command.decision", details),
    (details) => audit.recordEvent("thread.lifecycle", details),
  );
  const collaborationRoot = path.join(app.getPath("userData"), "collaboration");
  const screenshots = new ScreenshotStore(path.join(projectPaths.temporaryMaterialsRoot, "截图"));
  const workspaces = new WorkspaceStore(path.join(app.getPath("userData"), "workspace-profiles.json"), projectRoot);
  const collaborationStore = new CollaborationStore(path.join(collaborationRoot, "collaboration-state.json"));
  const collaborationDurations = new CollaborationDurationLog(projectPaths.collaborationArchiveRoot);
  const collaborationRegistry = new CollaborationCodexRegistry(collaborationDurations);
  const versionWorkspaces = new VersionWorkspaceManager(projectRoot, path.join(collaborationRoot, "worktrees"));
  const testResources = new TestResourceCoordinatorFacade({
    coordinationRoot: path.join(projectPaths.runningTestRoot, "_资源协调"),
    recordEvent: (type, details, taskId) => audit.recordEvent(type, details, taskId),
  });
  const integrationReleases = new IntegrationReleaseCoordinatorFacade({
    coordinationRoot: path.join(projectPaths.runningExecutionRoot, "_集成与发布协调"),
    recordEvent: (type, details) => audit.recordEvent(type, details),
  });
  const releaseBatches = new ReleaseBatchStore(projectPaths.runningExecutionRoot, projectPaths.archiveLogRoot);
  const linghuUnifiedTests = new LinghuUnifiedTestRunner(projectRoot, applicationName, projectPaths.buildRoot, (type, details) => audit.recordEvent(type, details), testResources);
  const taskTests = new TaskWorktreeTestRunner(
    projectRoot,
    applicationName,
    path.join(projectPaths.cacheRoot, "test-runtime"),
    (type, details, taskId) => audit.recordEvent(type, details, taskId),
    testResources,
  );
  const collaborationSessions = new CodexCollaborationSessionFactory({
    projectRoot,
    sessionRoot: path.join(collaborationRoot, "sessions"),
    codexHome,
    trustedCommands,
    registry: collaborationRegistry,
    resolveAttachmentPaths: (attachmentIds) => screenshots.resolveAttachmentPaths(attachmentIds),
    runCodeValidation: async (task, emit) => {
      const worktreeRoot = await versionWorkspaces.validateTaskWorkspace(task);
      await taskTests.run({ taskId: task.taskId, worktreeRoot, emit });
    },
    readSettings: () => settings.read(),
    recordEvent: (type, details, taskId) => audit.recordEvent(type, details, taskId),
  });
  collaboration = new CollaborationCoordinator({
    store: collaborationStore,
    durations: collaborationDurations,
    workspaces: versionWorkspaces,
    sessions: collaborationSessions,
    emitState: (state, reason, taskIds) => {
      // 单任务事件写入顶层 taskId；批量集成同时保留 taskIds，确保每条流程和错误都能反查所属任务。
      audit.recordEvent("collaboration.state.changed", { reason, mode: state.mode, taskIds }, taskIds.length === 1 ? taskIds[0] : undefined);
      for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("desktop:collaboration-state", { state, reason, taskIds });
    },
    emitStream: (taskId, memberId, event) => {
      audit.recordEvent(`collaboration.harness.${event.type}`, { memberId, turnId: event.turnId, status: event.status || null }, taskId);
      for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("desktop:collaboration-stream", { taskId, memberId, event });
    },
    verifyIntegration: async (rootPath, taskIds, releaseBatchId) => {
      await testResources.run({
      runId: `integration-${taskIds.join("-")}`,
      taskId: taskIds.length === 1 ? taskIds[0] : null,
      initiatorMemberId: "collaboration-integrator",
      kind: "integration-validation",
      port: 4197,
      buildRoot: path.join(path.resolve(rootPath), "build", applicationName),
      }, () => verifyCollaborationIntegration(rootPath, taskIds, projectRoot, applicationName));
      const candidateExecutable = await linghuUnifiedTests.run(rootPath);
      return stageVerifiedDeveloperExecutable(candidateExecutable, projectPaths.buildRoot, releaseBatchId);
    },
    acquireIntegrationRelease: (request) => integrationReleases.acquire(request),
    releaseVersion,
    releaseBatches,
    publishIntegration: (executable, releaseBatchId) => {
      audit.recordEvent("application.controlled_restart_scheduled", { reason: "integration_release_published", executable, releaseBatchId });
      app.relaunch({ execPath: executable, args: [`--selplat-root=${projectRoot}`, "--ai-desktop-variant=developer"] });
      app.exit(0);
    },
  });
  const linghuStore = new LinghuAutomationStore(path.join(collaborationRoot, "linghu-automation.json"));
  linghuAutomation = new LinghuAutomationFacade({
    store: linghuStore,
    collaboration,
    readWorkspaceState: () => workspaces.read(),
    locale: () => settings.read().locale,
    recordEvent: (type, details, taskId) => audit.recordEvent(type, details, taskId),
    readTestResourceState: () => testResources.state(),
    runUnifiedTestAndRestart: async (onVerified) => {
      await linghuUnifiedTests.run();
      onVerified();
      const executable = resolveVerifiedDeveloperExecutable(projectPaths.buildRoot);
      audit.recordEvent("application.controlled_restart_scheduled", { reason: "linghu_unified_test_completed", executable });
      app.relaunch({ execPath: executable, args: [`--selplat-root=${projectRoot}`, "--ai-desktop-variant=developer"] });
      app.exit(0);
    },
  });
  linghuAutomation.subscribe((event) => {
    audit.recordEvent("linghu.automation.state_changed", { reason: event.reason, enabled: event.state.enabled, cycle: event.state.cycle, module: event.state.currentModule }, event.state.activeTaskId || undefined);
    for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("desktop:linghu-automation-state", event);
  });

  registerDesktopIpc({
    codex,
    screenshots,
    settings,
    workspaces,
    trustedCommands,
    dispatch,
    collaboration,
    linghuAutomation,
    collaborationRegistry,
    audit,
    projectRoot,
    appRoot,
    variant,
    preloadPath,
    rendererRoot,
  });

  const mainWindow = createMainWindow({ preloadPath, rendererRoot, variant });
  if (healthCheckFile) {
    const safeHealthRoot = path.join(projectPaths.temporaryMaterialsRoot, "候选包健康检查");
    const resolvedHealthFile = path.resolve(healthCheckFile);
    if (!resolvedHealthFile.startsWith(`${path.resolve(safeHealthRoot)}${path.sep}`)) throw new Error("候选包健康检查文件超出工程临时目录。");
    mainWindow.webContents.once("did-finish-load", () => {
      mkdirSync(path.dirname(resolvedHealthFile), { recursive: true });
      writeFileSync(resolvedHealthFile, `${JSON.stringify({ status: "ready", variant, recordedAt: new Date().toISOString() })}\n`, "utf8");
      app.quit();
    });
    return;
  }
  collaboration.resumePendingWork();
  linghuAutomation.start();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow({ preloadPath, rendererRoot, variant });
  });
});

app.on("before-quit", () => {
  linghuAutomation?.stop();
  void collaboration?.dispose();
  codex?.dispose();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
