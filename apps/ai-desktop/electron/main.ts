import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow, protocol } from "electron";
import { resolveApplicationDataPaths } from "@selplat/node-common-core/path";

import { resolveApplicationName, resolveAppVariant, resolveDistributionMode, resolveProjectRoot } from "./config/app-config.js";
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
import { NangongEvolutionFacade } from "./services/collaboration/nangong-evolution-facade.js";
import { NangongEvolutionStore } from "./services/collaboration/nangong-evolution-store.js";
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
const archiveScheme = "selplat-archive";

if (resolveDistributionMode() === "archive") {
  protocol.registerSchemesAsPrivileged([{
    scheme: archiveScheme,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  }]);
}

let codex: CodexService | undefined;
let nangongCodex: CodexService | undefined;
let collaboration: CollaborationCoordinator | undefined;
let linghuAutomation: LinghuAutomationFacade | undefined;
let nangongEvolution: NangongEvolutionFacade | undefined;

// 开发启动、正式包与重启交接共用同一数据域，确保所有人物任务在版本切换后继续执行。
const healthCheckFile = process.argv.find((argument) => argument.startsWith("--ai-desktop-health-check-file="))?.slice("--ai-desktop-health-check-file=".length)
  || process.env.AI_DESKTOP_HEALTH_CHECK_FILE
  || null;
const isolatedUserData = process.argv.find((argument) => argument.startsWith("--ai-desktop-user-data-dir="))?.slice("--ai-desktop-user-data-dir=".length) || null;
app.setPath("userData", isolatedUserData ? path.resolve(isolatedUserData) : path.join(app.getPath("appData"), resolveApplicationName()));
// 压缩包版必须在远程桌面、虚拟机和无可用 GPU 环境中保持可启动。
if (resolveDistributionMode() === "archive") app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const variant = resolveAppVariant();
  const distributionMode = resolveDistributionMode();
  const projectRoot = resolveProjectRoot();
  const applicationName = resolveApplicationName();
  const projectPaths = resolveApplicationDataPaths({ selplatRoot: projectRoot, applicationName });
  const archiveRuntime = distributionMode === "archive";
  const rendererRoot = archiveRuntime
    ? path.join(path.dirname(process.execPath), "dist", "developer")
    : path.join(projectPaths.buildRoot, "renderer", "developer");
  if (archiveRuntime) {
    await protocol.handle(archiveScheme, (request) => {
      const relativePath = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, "");
      const resourcePath = path.resolve(rendererRoot, relativePath || "index.html");
      const safeRendererRoot = `${path.resolve(rendererRoot)}${path.sep}`;
      if (!resourcePath.startsWith(safeRendererRoot)) return new Response("Not found", { status: 404 });
      try {
        const extension = path.extname(resourcePath).toLowerCase();
        const contentType = extension === ".html"
          ? "text/html; charset=utf-8"
          : extension === ".js"
            ? "text/javascript; charset=utf-8"
            : extension === ".css"
              ? "text/css; charset=utf-8"
              : "application/octet-stream";
        return new Response(new Uint8Array(readFileSync(resourcePath)), { headers: { "content-type": contentType } });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    });
  }
  const appRoot = archiveRuntime ? app.getAppPath() : projectPaths.sourceRoot;
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
  const nangongSessions = new CodexSessionStore(path.join(app.getPath("userData"), "nangong-conversation-session.json"));
  nangongCodex = new CodexService(
    projectRoot,
    trustedCommands,
    nangongSessions,
    {
      codexHome,
      serviceName: "selplat_ai_desktop_nangong",
      threadSource: "ai-desktop-nangong-evolution",
      migrateLegacySession: false,
      sessionStorage: "ai-desktop",
      validationOwner: "desktop",
      readSettings: () => settings.read(),
    },
    (details) => audit.recordEvent("nangong.conversation.trusted_command.decision", details),
    (details) => audit.recordEvent("nangong.conversation.thread.lifecycle", details),
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
  const nangongStore = new NangongEvolutionStore(path.join(collaborationRoot, "nangong-evolution.json"));
  nangongEvolution = new NangongEvolutionFacade({
    store: nangongStore,
    collaboration,
    conversation: {
      send: async (request, context) => nangongCodex!.send([
        "你现在以南宫婉的专项演化调查者身份与用户讨论。只读调查和分析，不修改源码、不执行构建、不越过审批。",
        "语气克制、温和、有判断，不冷硬、不说教，也不故作亲昵。短问题直接短答；复杂问题按内容自然分段，不使用“结论：”“建议：”“1、2、3”这类模板化标题或编号。不要使用“我更希望”“就行”“可以考虑”等没有明确落点的表达。",
        "需要提出方向时，明确说清现在有什么问题、为什么会造成问题，以及什么做法更合理。把已证实事实、基于事实的推断和仍待验证内容自然写进句子，不把推断或用户陈述说成既定事实，也不要机械套固定栏目。",
        "这段聊天始终只是调查材料；不得声称已形成正式课题、已提交审批或将开始修改。只有用户在界面明确确认转换后，系统才会冻结对话材料为课题；即使提案获批，也不能替代工程写入授权或命令审批。",
        `最近对话：\n${context}`,
        `用户最新消息：\n${request.message}`,
      ].join("\n\n"), request.locale, "read-only", request.workspaceState, await screenshots.resolveAttachmentPaths(request.attachmentIds || []), () => undefined, "conversation-managed"),
      newChat: () => nangongCodex!.newChat(),
    },
    recordEvent: (type, details, taskId) => audit.recordEvent(type, details, taskId),
  });
  nangongEvolution.subscribe((state, reason, topicId, proposalId) => {
    audit.recordEvent("nangong.evolution.state_changed", { reason, topicId, proposalId, activeTopicId: state.activeTopicId });
    for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("desktop:nangong-evolution-state", { state, reason, topicId, proposalId });
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
    submitRepairProposal: (request) => nangongEvolution!.createLinghuRepairProposal(request),
    readEvolutionState: () => nangongEvolution!.state(),
    reviseReturnedProposal: (proposalId) => nangongEvolution!.reviseReturnedProposalAutomatically(proposalId),
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
    nangongEvolution,
    collaborationRegistry,
    audit,
    projectRoot,
    appRoot,
    variant,
    preloadPath,
    rendererRoot,
  });

  let onRendererReady: (() => void) | undefined;
  let onRendererFailed: ((details: { errorCode: number; errorDescription: string; validatedURL: string }) => void) | undefined;
  if (healthCheckFile) {
    const safeHealthRoot = path.join(projectPaths.temporaryMaterialsRoot, "候选包健康检查");
    const resolvedHealthFile = path.resolve(healthCheckFile);
    if (!resolvedHealthFile.startsWith(`${path.resolve(safeHealthRoot)}${path.sep}`)) throw new Error("候选包健康检查文件超出工程临时目录。");
    let healthTimeout: NodeJS.Timeout;
    const finishHealthCheck = (payload: Record<string, unknown>) => {
      clearTimeout(healthTimeout);
      mkdirSync(path.dirname(resolvedHealthFile), { recursive: true });
      writeFileSync(resolvedHealthFile, `${JSON.stringify({ ...payload, variant, recordedAt: new Date().toISOString() })}\n`, "utf8");
      app.quit();
    };
    onRendererReady = () => {
      finishHealthCheck({ status: "ready" });
    };
    onRendererFailed = (details) => finishHealthCheck({ status: "failed", ...details });
    healthTimeout = setTimeout(() => finishHealthCheck({ status: "failed", errorDescription: "renderer-timeout" }), 15_000);
  }
  createMainWindow({ preloadPath, rendererRoot, variant, distributionMode, onRendererReady, onRendererFailed });
  if (healthCheckFile) {
    return;
  }
  collaboration.resumePendingWork();
  linghuAutomation.start();
  nangongEvolution.start();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow({ preloadPath, rendererRoot, variant, distributionMode });
  });
});

app.on("before-quit", () => {
  linghuAutomation?.stop();
  nangongEvolution?.stop();
  void collaboration?.dispose();
  codex?.dispose();
  nangongCodex?.dispose();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
