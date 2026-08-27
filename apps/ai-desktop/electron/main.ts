import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow, protocol } from "electron";
import { resolveApplicationDataPaths } from "@selplat/node-common-core/path";

import type { AiMemoryDatabaseStatus, TestDataResetResult } from "../contracts/desktop/database.js";
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
import { VersionIntegrationPipeline } from "./services/collaboration/version-integration-pipeline.js";
import { TaskWorktreeTestRunner } from "./services/collaboration/task-worktree-test-runner.js";
import { TestResourceCoordinatorFacade } from "./services/collaboration/test-resource-coordinator-facade.js";
import { IntegrationReleaseCoordinatorFacade } from "./services/collaboration/integration-release-coordinator-facade.js";
import { ReleaseBatchStore } from "./services/collaboration/release-batch-store.js";
import { resolveVerifiedDeveloperExecutable, stageVerifiedDeveloperExecutable } from "./services/collaboration/verified-package-release.js";
import { ScreenshotStore } from "./services/screenshot-store.js";
import { SettingsStore } from "./services/settings-store.js";
import { WorkspaceStore } from "./services/workspace-store.js";
import { TrustedCommandStore } from "./services/trusted-command-store.js";
import { initializeAiMemoryDatabase, type SqliteDatabase } from "./services/event-center/persistence/sqlite-database.js";
import { WorkflowRepository } from "./services/event-center/workflow-repository.js";
import { WorkflowSupervisor } from "./services/event-center/workflow-supervisor.js";
import { EventCenterFacade } from "./services/event-center/event-center-facade.js";
import { CollaborationMemoryService } from "./services/event-center/collaboration-memory-service.js";
import { RuleBundleService } from "./services/rules/rule-bundle-service.js";
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
let hanLiCodex: CodexService | undefined;
let nangongDeliberationCodex: CodexService | undefined;
let nangongDistributionCodex: CodexService | undefined;
let linghuDistributionAuditCodex: CodexService | undefined;
let collaboration: CollaborationCoordinator | undefined;
let linghuAutomation: LinghuAutomationFacade | undefined;
let nangongEvolution: NangongEvolutionFacade | undefined;
let aiMemoryDatabase: SqliteDatabase | null = null;
let workflowRepository: WorkflowRepository | null = null;
let workflowSupervisor: WorkflowSupervisor | null = null;
let collaborationMemory: CollaborationMemoryService | null = null;
let aiMemoryDatabaseStatus: AiMemoryDatabaseStatus = {
  state: "unavailable",
  schemaVersion: null,
  message: "AI Memory 数据库尚未初始化。",
};

function closeAiMemoryDatabase(): void {
  try {
    aiMemoryDatabase?.close();
  } catch (error) {
    eventCenter.recordException({ kind: "technical", sourceType: "launcher", sourceId: "ai-memory", operation: "database_close", error });
  } finally {
    aiMemoryDatabase = null;
  }
}

function prepareAiMemoryShutdown(): void {
  try {
    workflowSupervisor?.stop();
  } catch (error) {
    eventCenter.recordException({ kind: "technical", sourceType: "launcher", sourceId: "workflow-supervisor", operation: "runtime_session_stop", error });
  } finally {
    workflowSupervisor = null;
  }
  closeAiMemoryDatabase();
}

// 开发启动、正式包与重启交接共用同一数据域，确保所有人物任务在版本切换后继续执行。
const healthCheckFile = process.argv.find((argument) => argument.startsWith("--ai-desktop-health-check-file="))?.slice("--ai-desktop-health-check-file=".length)
  || process.env.AI_DESKTOP_HEALTH_CHECK_FILE
  || null;
const isolatedUserData = process.argv.find((argument) => argument.startsWith("--ai-desktop-user-data-dir="))?.slice("--ai-desktop-user-data-dir=".length) || null;
app.setPath("userData", isolatedUserData ? path.resolve(isolatedUserData) : path.join(app.getPath("appData"), resolveApplicationName()));
const startupVariant = resolveAppVariant();
const startupProjectRoot = resolveProjectRoot();
const startupApplicationName = resolveApplicationName();
const startupProjectPaths = resolveApplicationDataPaths({ selplatRoot: startupProjectRoot, applicationName: startupApplicationName });
const eventCenter = new EventCenterFacade(new BusinessAuditLog(startupProjectPaths.sourceRoot, startupProjectPaths.buildRoot, startupProjectPaths.archiveLogRoot));
eventCenter.installProcessExceptionBoundary();
// 压缩包版必须在远程桌面、虚拟机和无可用 GPU 环境中保持可启动。
if (resolveDistributionMode() === "archive") app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const variant = startupVariant;
  const distributionMode = resolveDistributionMode();
  const projectRoot = startupProjectRoot;
  const aiMemoryInitialization = initializeAiMemoryDatabase({
    projectRoot,
    runtimeMarkerPath: path.join(app.getPath("userData"), "ai-memory-database-state.json"),
  });
  aiMemoryDatabase = aiMemoryInitialization.database;
  aiMemoryDatabaseStatus = aiMemoryInitialization.status;
  const applicationName = startupApplicationName;
  const projectPaths = startupProjectPaths;
  const archiveRuntime = distributionMode === "archive";
  const rendererRoot = archiveRuntime
    ? path.join(path.dirname(process.execPath), "dist", "developer")
    : app.isPackaged ? path.join(app.getAppPath(), "dist", "developer") : path.join(projectPaths.buildRoot, "renderer", "developer");
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
  const appRoot = app.isPackaged ? app.getAppPath() : projectPaths.sourceRoot;
  const releaseVersion = (JSON.parse(readFileSync(path.join(appRoot, "package.json"), "utf8")) as { version: string }).version;
  workflowRepository = aiMemoryDatabase ? new WorkflowRepository(aiMemoryDatabase) : null;
  collaborationMemory = aiMemoryDatabase ? new CollaborationMemoryService(aiMemoryDatabase) : null;
  eventCenter.attachRepository(workflowRepository);
  eventCenter.recordApplicationStart({ variant, projectRoot, rendererRoot });
  const trustedCommands = new TrustedCommandStore(path.join(app.getPath("userData"), "trusted-project-commands.json"));
  const codexSessions = new CodexSessionStore(path.join(app.getPath("userData"), "active-codex-session.json"));
  const settings = new SettingsStore(path.join(app.getPath("userData"), "desktop-settings.json"));
  const rules = new RuleBundleService(
    app.isPackaged ? path.join(process.resourcesPath, "ruleengine") : path.join(projectPaths.buildRoot, "rule-bundle"),
    path.join(app.getPath("userData"), "ruleengine", "overrides"),
  );
  const readRuleInstructions = () => rules.renderDeveloperInstructions();
  // 主会话与所有协同成员共用 AI Desktop 自己的数据域，和 Codex App 的默认 ~/.codex 完全隔离。
  const codexHome = path.join(app.getPath("userData"), "codex-home");
  mkdirSync(codexHome, { recursive: true });
  const dispatch = new ConversationDispatchStore(
    path.join(app.getPath("userData"), "conversation-dispatch.json"),
    (type, details, taskId) => eventCenter.recordEvent(type, details, taskId),
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
      readRuleInstructions,
    },
    (details) => eventCenter.recordEvent("trusted_command.decision", details),
    (details) => eventCenter.recordEvent("thread.lifecycle", details),
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
      readRuleInstructions,
    },
    (details) => eventCenter.recordEvent("nangong.conversation.trusted_command.decision", details),
    (details) => eventCenter.recordEvent("nangong.conversation.thread.lifecycle", details),
  );
  const hanLiSessions = new CodexSessionStore(path.join(app.getPath("userData"), "han-li-evolution-session.json"));
  hanLiCodex = new CodexService(
    projectRoot, trustedCommands, hanLiSessions,
    {
      codexHome, serviceName: "selplat_ai_desktop_han_li_evolution", threadSource: "ai-desktop-han-li-evolution",
      migrateLegacySession: false, sessionStorage: "ai-desktop", validationOwner: "desktop", readSettings: () => settings.read(), readRuleInstructions,
    },
    (details) => eventCenter.recordEvent("han-li.evolution.trusted_command.decision", details),
    (details) => eventCenter.recordEvent("han-li.evolution.thread.lifecycle", details),
  );
  const nangongDeliberationSessions = new CodexSessionStore(path.join(app.getPath("userData"), "nangong-deliberation-session.json"));
  nangongDeliberationCodex = new CodexService(
    projectRoot, trustedCommands, nangongDeliberationSessions,
    {
      codexHome, serviceName: "selplat_ai_desktop_nangong_deliberation", threadSource: "ai-desktop-nangong-deliberation",
      migrateLegacySession: false, sessionStorage: "ai-desktop", validationOwner: "desktop", readSettings: () => settings.read(), readRuleInstructions,
    },
    (details) => eventCenter.recordEvent("nangong.deliberation.trusted_command.decision", details),
    (details) => eventCenter.recordEvent("nangong.deliberation.thread.lifecycle", details),
  );
  const nangongDistributionSessions = new CodexSessionStore(path.join(app.getPath("userData"), "nangong-distribution-session.json"));
  nangongDistributionCodex = new CodexService(
    projectRoot, trustedCommands, nangongDistributionSessions,
    {
      codexHome, serviceName: "selplat_ai_desktop_nangong_distribution", threadSource: "ai-desktop-nangong-distribution",
      migrateLegacySession: false, sessionStorage: "ai-desktop", validationOwner: "desktop", readSettings: () => settings.read(), readRuleInstructions,
    },
    (details) => eventCenter.recordEvent("nangong.distribution.trusted_command.decision", details),
    (details) => eventCenter.recordEvent("nangong.distribution.thread.lifecycle", details),
  );
  const linghuDistributionAuditSessions = new CodexSessionStore(path.join(app.getPath("userData"), "linghu-distribution-audit-session.json"));
  linghuDistributionAuditCodex = new CodexService(
    projectRoot, trustedCommands, linghuDistributionAuditSessions,
    {
      codexHome, serviceName: "selplat_ai_desktop_linghu_distribution_audit", threadSource: "ai-desktop-linghu-distribution-audit",
      migrateLegacySession: false, sessionStorage: "ai-desktop", validationOwner: "desktop", readSettings: () => settings.read(), readRuleInstructions,
    },
    (details) => eventCenter.recordEvent("linghu.distribution_audit.trusted_command.decision", details),
    (details) => eventCenter.recordEvent("linghu.distribution_audit.thread.lifecycle", details),
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
    recordEvent: (type, details, taskId) => eventCenter.recordEvent(type, details, taskId),
  });
  const integrationReleases = new IntegrationReleaseCoordinatorFacade({
    coordinationRoot: path.join(projectPaths.runningExecutionRoot, "_集成与发布协调"),
    recordEvent: (type, details) => eventCenter.recordEvent(type, details),
  });
  const releaseBatches = new ReleaseBatchStore(projectPaths.runningExecutionRoot, projectPaths.archiveLogRoot);
  const linghuUnifiedTests = new LinghuUnifiedTestRunner(projectRoot, applicationName, projectPaths.buildRoot, (type, details) => eventCenter.recordEvent(type, details), testResources);
  const taskTests = new TaskWorktreeTestRunner(
    projectRoot,
    applicationName,
    path.join(projectPaths.cacheRoot, "test-runtime"),
    (type, details, taskId) => eventCenter.recordEvent(type, details, taskId),
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
    readRuleInstructions,
    recordEvent: (type, details, taskId) => eventCenter.recordEvent(type, details, taskId),
  });
  const versionIntegration = new VersionIntegrationPipeline({
    store: collaborationStore,
    durations: collaborationDurations,
    workspaces: versionWorkspaces,
    actorMemberId: "linghu-ancestor",
    verifyCandidate: async (rootPath, taskIds, releaseBatchId) => {
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
    acquireRelease: (request) => integrationReleases.acquire(request),
    releaseVersion,
    releaseBatches,
    publishRelease: (executable, releaseBatchId) => {
      eventCenter.recordEvent("application.controlled_restart_scheduled", { reason: "integration_release_published", executable, releaseBatchId });
      app.relaunch({ execPath: executable, args: [`--selplat-root=${projectRoot}`, "--ai-desktop-variant=developer"] });
      prepareAiMemoryShutdown();
      app.exit(0);
    },
  });
  collaboration = new CollaborationCoordinator({
    store: collaborationStore,
    durations: collaborationDurations,
    workspaces: versionWorkspaces,
    sessions: collaborationSessions,
    integrationPipeline: versionIntegration,
    emitState: (state, reason, taskIds) => {
      // 单任务事件写入顶层 taskId；批量集成同时保留 taskIds，确保每条流程和错误都能反查所属任务。
      workflowRepository?.syncCollaborationState(state);
      eventCenter.recordEvent("collaboration.state.changed", { reason, mode: state.mode, taskIds }, taskIds.length === 1 ? taskIds[0] : undefined);
      for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("desktop:collaboration-state", { state, reason, taskIds });
    },
    emitStream: (taskId, memberId, event) => {
      eventCenter.recordEvent(`collaboration.harness.${event.type}`, { memberId, turnId: event.turnId, status: event.status || null }, taskId);
      for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("desktop:collaboration-stream", { taskId, memberId, event });
    },
  });
  const nangongStore = new NangongEvolutionStore(path.join(collaborationRoot, "nangong-evolution.json"));
  nangongEvolution = new NangongEvolutionFacade({
    store: nangongStore,
    collaboration,
    conversation: {
      send: async (request, context) => nangongCodex!.send([
        "你现在以南宫婉的专项演化调查者身份与用户讨论。只读调查和分析，不修改源码、不执行构建、不越过审批。",
        "语气克制、温和、有判断，不冷硬、不说教，也不故作亲昵。把尊重用户、认真倾听和允许纠偏作为南宫婉性格的一部分：先用“我了解到您的想法是：……”自然复述本轮理解，再说“如果我理解有偏差，您可以直接纠正我”，然后进入回答。复述必须贴合用户这次真正关心的内容，不能机械复制固定句子或擅自扩大用户意图。短问题直接短答；复杂问题按内容自然分段，不使用“结论：”“建议：”“1、2、3”这类模板化标题或编号。不要使用“我更希望”“就行”“可以考虑”等没有明确落点的表达。",
        "需要提出方向时，明确说清现在有什么问题、为什么会造成问题，以及什么做法更合理。把已证实事实、基于事实的推断和仍待验证内容自然写进句子，不把推断或用户陈述说成既定事实，也不要机械套固定栏目。",
        "这段聊天始终只是调查材料；不得声称已形成正式课题、已提交审批或将开始修改。只有用户在界面明确确认转换后，系统才会冻结对话材料为课题；即使提案获批，也不能替代工程写入授权或命令审批。",
        "你必须自行判断本轮是否仍在处理当前主题，并用一句清楚的话总结用户这条原话真正要推动的意图。回答正文最后另起一行输出 NANGONG_TOPIC_META={\"title\":\"本轮主题\",\"type\":\"自由判断的类型\",\"switchTopic\":false,\"userIntent\":\"用户意图摘要\"}。可见正文中的想法理解与 userIntent 必须语义一致；数据库摘要只写意图本身，不包含客套语。主题、类型和意图不受固定枚举约束；用户明显切换问题中心时 switchTopic 才为 true。该行只供程序登记，正文不得解释它。",
        `最近对话：\n${context}`,
        `用户最新消息：\n${request.message}`,
      ].join("\n\n"), request.locale, "read-only", request.workspaceState, await screenshots.resolveAttachmentPaths(request.attachmentIds || []), () => undefined, "conversation-managed"),
      newChat: () => nangongCodex!.newChat(),
    },
    hanLi: {
      send: async (prompt, state) => (await hanLiCodex!.send(prompt, state.automationContext.locale, "read-only", state.automationContext.workspaceState!, [], () => undefined, "conversation-managed")).text,
    },
    nangongDeliberation: {
      send: async (question, context, state) => (await nangongDeliberationCodex!.send([
        "你是南宫婉，正在参加由韩立发起的自动演化专题研讨。韩立是发问方，你只回答他当前提出的问题。",
        "回答必须区分已知事实、基于记录的判断和仍需调查的内容；不得自行确立专题、拆解任务或开始修改。",
        `研讨原记录：\n${context}`,
        `韩立当前问题：\n${question}`,
      ].join("\n\n"), state.automationContext.locale, "read-only", state.automationContext.workspaceState!, [], () => undefined, "conversation-managed")).text,
    },
    planDistribution: async (prompt, workspaceState, locale) => (await nangongDistributionCodex!.send(prompt, locale, "read-only", workspaceState, [], () => undefined, "conversation-managed")).text,
    auditDistribution: async (prompt, workspaceState, locale) => (await linghuDistributionAuditCodex!.send(prompt, locale, "read-only", workspaceState, [], () => undefined, "conversation-managed")).text,
    recordEvent: (type, details, taskId) => eventCenter.recordEvent(type, details, taskId),
    memory: collaborationMemory,
    readDossier: workflowRepository ? (topicId, state) => workflowRepository!.getEvolutionTopicDossier(topicId, state) : undefined,
  });
  nangongEvolution.subscribe((state, reason, topicId, proposalId) => {
    workflowRepository?.syncEvolutionState(state);
    collaborationMemory?.syncEvolutionState(state);
    eventCenter.recordEvent("nangong.evolution.state_changed", { reason, topicId, proposalId, activeTopicId: state.activeTopicId });
    for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("desktop:nangong-evolution-state", { state, reason, topicId, proposalId });
  });
  collaborationMemory?.syncEvolutionState(nangongEvolution.state());
  const linghuStore = new LinghuAutomationStore(path.join(collaborationRoot, "linghu-automation.json"));
  linghuAutomation = new LinghuAutomationFacade({
    store: linghuStore,
    collaboration,
    readWorkspaceState: () => workspaces.read(),
    locale: () => settings.read().locale,
    recordEvent: (type, details, taskId) => eventCenter.recordEvent(type, details, taskId),
    readTestResourceState: () => testResources.state(),
    runUnifiedTestAndRestart: async (onVerified) => {
      await linghuUnifiedTests.run();
      onVerified();
      const executable = resolveVerifiedDeveloperExecutable(projectPaths.buildRoot);
      eventCenter.recordEvent("application.controlled_restart_scheduled", { reason: "linghu_unified_test_completed", executable });
      app.relaunch({ execPath: executable, args: [`--selplat-root=${projectRoot}`, "--ai-desktop-variant=developer"] });
      prepareAiMemoryShutdown();
      app.exit(0);
    },
    submitRepairProposal: (request) => nangongEvolution!.createLinghuRepairProposal(request),
    readEvolutionState: () => nangongEvolution!.state(),
    reviseReturnedProposal: (proposalId) => nangongEvolution!.reviseReturnedProposalAutomatically(proposalId),
  });
  linghuAutomation.subscribe((event) => {
    workflowRepository?.syncLinghuState(event.state);
    eventCenter.recordEvent("linghu.automation.state_changed", { reason: event.reason, enabled: event.state.enabled, cycle: event.state.cycle, module: event.state.currentModule }, event.state.activeTaskId || undefined);
    for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("desktop:linghu-automation-state", event);
  });

  if (workflowRepository) {
    workflowSupervisor = new WorkflowSupervisor({
      repository: workflowRepository,
      readers: {
        collaboration: () => collaboration!.state(),
        evolution: () => nangongEvolution!.state(),
        linghu: () => linghuAutomation!.state(),
      },
      onStalledTasks: async (taskIds) => {
        eventCenter.recordEvent("workflow.stalled_tasks_detected", { taskIds, count: taskIds.length });
        await linghuAutomation!.checkNow();
      },
      onUnhandledExceptions: (events) => linghuAutomation!.handleUnifiedExceptions(events),
    });
  }

  let testDataResetInProgress = false;
  /** 停止所有写入者后清空应用内部测试态，保留账号与配置，并在 IPC 回执送达后受控重启。 */
  const clearTestData = async (): Promise<TestDataResetResult> => {
    if (testDataResetInProgress) throw new Error("测试数据正在清空，请等待应用重启。");
    testDataResetInProgress = true;
    let runtimeDisposed = false;
    try {
      workflowSupervisor?.stop();
      workflowSupervisor = null;
      linghuAutomation?.stop();
      nangongEvolution?.stop();

      // 官方线程删除必须全部成功才进入不可逆的数据清理，避免界面清空但 Harness 仍保留旧任务。
      await Promise.all([codex, nangongCodex, hanLiCodex, nangongDeliberationCodex, nangongDistributionCodex, linghuDistributionAuditCodex].map((service) => service!.newChat()));
      await collaboration?.dispose();
      runtimeDisposed = true;

      const repositoryToClear = workflowRepository;
      let clearedRecordCount = 0;
      dispatch.clear();
      clearedRecordCount += collaborationStore.clearTestData();
      clearedRecordCount += nangongStore.clearTestData();
      clearedRecordCount += linghuStore.clearTestData();
      clearedRecordCount += repositoryToClear?.clearTestData() || 0;
      eventCenter.attachRepository(null);
      workflowRepository = null;
      closeAiMemoryDatabase();

      const result: TestDataResetResult = { cleared: true, clearedRecordCount, restartScheduled: true };
      app.relaunch({ args: process.argv.slice(1) });
      setTimeout(() => app.exit(0), 180);
      return result;
    } catch (error) {
      testDataResetInProgress = false;
      if (runtimeDisposed) {
        // 协同连接已经释放后不能在同一进程伪恢复，重启可从仍然有效的持久状态重新装配。
        app.relaunch({ args: process.argv.slice(1) });
        setTimeout(() => app.exit(1), 180);
      } else {
        linghuAutomation?.start();
        nangongEvolution?.start();
        workflowSupervisor?.start();
      }
      throw error;
    }
  };

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
    eventCenter,
    workflowRepository,
    aiMemoryDatabaseStatus,
    projectRoot,
    appRoot,
    variant,
    preloadPath,
    rendererRoot,
    rules,
    clearTestData,
    prepareForApplicationExit: prepareAiMemoryShutdown,
  });

  let onRendererReady: (() => void) | undefined;
  let onRendererFailed: ((details: { errorCode: number; errorDescription: string; validatedURL: string }) => void) | undefined = (details) => eventCenter.recordException({
    kind: "technical", sourceType: "system", sourceId: "electron-renderer", operation: "renderer_load", error: new Error(details.errorDescription), details,
  });
  onRendererReady = () => {
    const confirmedGenerations = collaboration?.confirmPublishedRestart() || [];
    if (confirmedGenerations.length) eventCenter.recordEvent("application.release_restart_healthy", { confirmedGenerations });
  };
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
    onRendererFailed = (details) => {
      eventCenter.recordException({ kind: "technical", sourceType: "system", sourceId: "electron-renderer", operation: "renderer_health_load", error: new Error(details.errorDescription), details });
      finishHealthCheck({ status: "failed", ...details });
    };
    healthTimeout = setTimeout(() => finishHealthCheck({ status: "failed", errorDescription: "renderer-timeout" }), 15_000);
  }
  let mainApplicationWindow: BrowserWindow | null = createMainWindow({ preloadPath, rendererRoot, variant, distributionMode, onRendererReady, onRendererFailed });
  mainApplicationWindow.once("closed", () => { mainApplicationWindow = null; });
  if (healthCheckFile) {
    return;
  }
  collaboration.resumePendingWork();
  linghuAutomation.start();
  nangongEvolution.start();
  workflowSupervisor?.start();
  app.on("activate", () => {
    if (mainApplicationWindow && !mainApplicationWindow.isDestroyed()) {
      mainApplicationWindow.show();
      mainApplicationWindow.focus();
      return;
    }
    mainApplicationWindow = createMainWindow({ preloadPath, rendererRoot, variant, distributionMode, onRendererFailed });
    mainApplicationWindow.once("closed", () => { mainApplicationWindow = null; });
  });
}).catch((error) => {
  eventCenter.recordException({ kind: "technical", sourceType: "launcher", sourceId: "electron-main", operation: "application_ready", error, severity: "critical" });
  app.quit();
});

app.on("before-quit", () => {
  linghuAutomation?.stop();
  nangongEvolution?.stop();
  void collaboration?.dispose().catch((error) => eventCenter.recordException({ kind: "technical", sourceType: "launcher", sourceId: "collaboration", operation: "dispose", error }));
  codex?.dispose();
  nangongCodex?.dispose();
  hanLiCodex?.dispose();
  nangongDeliberationCodex?.dispose();
  nangongDistributionCodex?.dispose();
  linghuDistributionAuditCodex?.dispose();
  prepareAiMemoryShutdown();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
