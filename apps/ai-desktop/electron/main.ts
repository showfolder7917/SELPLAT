import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow, protocol } from "electron";
import { resolveApplicationDataPaths } from "@selplat/node-common-core/path";

import type { AiMemoryDatabaseStatus, CorpusSemanticBackfillStatus, TestDataResetResult } from "../contracts/platform/persistence/index.js";
import type { WorkspaceState } from "../contracts/platform/workspace/index.js";
import type { EvolutionMutationRequest } from "../contracts/collaboration/evolution/index.js";
import type { CollaborationTimelineBusinessEvent } from "../contracts/collaboration/workflow/index.js";
import { resolveApplicationName, resolveAppVariant, resolveDistributionMode, resolveProjectRoot } from "./config/app-config.js";
import { registerDesktopIpc } from "./ipc/register-desktop-ipc.js";
import {
  createBusinessAuditArchive,
  createCodexConversationCorpusIngestion,
  createCodexConversationCorpusWatcher,
  createCodexConversationSemanticBackfill,
  createCollaborationMemory,
  createCollaborationTimeline,
  EventCenterFacade,
  buildCodexSemanticBackfillPrompt,
  parseCodexSemanticBackfillResponse,
  type CorpusIngestion,
  type CorpusSemanticBackfill,
  type CorpusWatcher,
  type EventCenterMemory,
  type EventCenterTimeline,
} from "./services/capabilities/event-center/index.js";
import {
  CodexFacade as CodexService,
  createFileCodexSessionRepository,
  createSqliteCodexSessionRepository,
} from "./services/platform/codex/index.js";
import { ConversationFacade as ConversationDispatchStore } from "./services/capabilities/conversation/index.js";
import { CodexCollaborationSessionFactory, CollaborationCodexRegistry } from "./services/capabilities/conversation/index.js";
import {
  CollaborationWorkflowFacade as CollaborationCoordinator,
  createCollaborationDurationLog,
  createCollaborationState,
  createWorkflowRepository,
  createWorkflowSupervisor,
  createPersonaCapabilityRegistry,
  createPersonaWorkflowRuntime,
  type WorkflowRepositoryPort as WorkflowRepository,
  type WorkflowSupervisorPort as WorkflowSupervisor,
} from "./services/workflow/index.js";
import { createLinghuRuntime, LinghuAutomationFacade, type LinghuRuntime } from "./services/personas/linghu/index.js";
import { createHanliRuntime } from "./services/personas/hanli/index.js";
import { buildEvolutionWorkbenchChange, createEvolutionRuntime, createEvolutionState } from "./services/evolution/index.js";
import { PersonaEvolutionRuntime } from "./services/workflow/index.js";
import {
  createReleaseBatchStore,
  createVersionIntegrationPipeline,
  createVersionWorkspaceManager,
  IntegrationReleaseCoordinatorFacade,
  stageVerifiedDeveloperExecutable,
  verifyCollaborationIntegration,
} from "./services/capabilities/release/index.js";
import { createTaskWorktreeTestRunner, TestResourceCoordinatorFacade } from "./services/capabilities/testing/index.js";
import { AttachmentFacade as ScreenshotStore } from "./services/platform/attachments/index.js";
import { SettingsFacade as SettingsStore } from "./services/platform/settings/index.js";
import { WorkspaceFacade as WorkspaceStore } from "./services/platform/workspace/index.js";
import { CommandGovernanceFacade as TrustedCommandStore } from "./services/platform/security/index.js";
import { createAtomicJsonPersistence, initializeAiMemoryDatabase, type DatabasePort as SqliteDatabase } from "./services/platform/persistence/index.js";
import { RuleBundleFacade as RuleBundleService } from "./services/capabilities/rules/index.js";
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
let corpusSemanticBackfillCodex: CodexService | undefined;
let collaboration: CollaborationCoordinator | undefined;
let linghuAutomation: LinghuAutomationFacade | undefined;
let personaEvolution: PersonaEvolutionRuntime | undefined;
let aiMemoryDatabase: SqliteDatabase | null = null;
let workflowRepository: WorkflowRepository | null = null;
let collaborationTimeline: EventCenterTimeline | null = null;
let workflowSupervisor: WorkflowSupervisor | null = null;
let collaborationMemory: EventCenterMemory | null = null;
let codexAppCorpusWatcher: CorpusWatcher | null = null;
let aiMemoryDatabaseStatus: AiMemoryDatabaseStatus = {
  state: "unavailable",
  schemaVersion: null,
  message: "AI Memory 数据库尚未初始化。",
};

/** 当前工作区注册表是唯一入口；任务快照只决定主目录，不覆盖后来新增的工程根。 */
function mergeWorkspaceState(configured: WorkspaceState, requested: WorkspaceState): WorkspaceState {
  const requestedPrimary = requested.roots.find((root) => root.id === requested.primaryId);
  const roots = [...(requestedPrimary ? [requestedPrimary] : []), ...configured.roots, ...requested.roots]
    .filter((root, index, values) => values.findIndex((candidate) => path.resolve(candidate.path) === path.resolve(root.path)) === index);
  return { primaryId: requestedPrimary?.id || configured.primaryId, roots };
}

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
  codexAppCorpusWatcher?.stop();
  codexAppCorpusWatcher = null;
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
const startupApplicationName = resolveApplicationName();
const configuredProjectRoot = resolveProjectRoot();
const startupWorkspaces = new WorkspaceStore(path.join(app.getPath("userData"), "workspace-profiles.json"), configuredProjectRoot);
const startupWorkspaceState = startupWorkspaces.read();
const selectedStartupWorkspace = startupWorkspaceState.roots.find((root) => root.id === startupWorkspaceState.primaryId);
if (!selectedStartupWorkspace || !path.isAbsolute(selectedStartupWorkspace.path)
  || !existsSync(path.join(selectedStartupWorkspace.path, "apps", startupApplicationName, "package.json"))) {
  throw new Error("工作区中没有工程，请添加工程");
}
const startupProjectRoot = path.resolve(selectedStartupWorkspace.path);
const startupProjectPaths = resolveApplicationDataPaths({ selplatRoot: startupProjectRoot, applicationName: startupApplicationName });
const eventCenter = new EventCenterFacade(createBusinessAuditArchive(startupProjectPaths.sourceRoot, startupProjectPaths.buildRoot, startupProjectPaths.archiveLogRoot));
eventCenter.installProcessExceptionBoundary();
const ownsApplicationInstance = app.requestSingleInstanceLock();
if (!ownsApplicationInstance) app.quit();
else app.on("second-instance", () => {
  const window = BrowserWindow.getAllWindows()[0];
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.focus();
});
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
  workflowRepository = aiMemoryDatabase ? createWorkflowRepository(aiMemoryDatabase) : null;
  collaborationTimeline = aiMemoryDatabase ? createCollaborationTimeline(aiMemoryDatabase) : null;
  collaborationTimeline?.subscribeTimelineChanged((event) => {
    for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) {
      window.webContents.send("desktop:collaboration-timeline-changed", event);
    }
  });
  collaborationMemory = aiMemoryDatabase ? createCollaborationMemory(aiMemoryDatabase) : null;
  eventCenter.attachRepository(workflowRepository);
  eventCenter.recordApplicationStart({ variant, projectRoot, rendererRoot });
  const trustedCommands = new TrustedCommandStore(path.join(app.getPath("userData"), "trusted-project-commands.json"));
  const codexSessions = createFileCodexSessionRepository(path.join(app.getPath("userData"), "active-codex-session.json"));
  const settings = new SettingsStore(path.join(app.getPath("userData"), "desktop-settings.json"));
  const rules = new RuleBundleService(
    app.isPackaged ? path.join(process.resourcesPath, "ruleengine") : path.join(projectPaths.buildRoot, "rule-bundle"),
    path.join(app.getPath("userData"), "ruleengine", "overrides"),
  );
  const readRuleInstructions = () => rules.renderDeveloperInstructions();
  // 主会话与所有协同成员共用 AI Desktop 自己的数据域，和 Codex App 的默认 ~/.codex 完全隔离。
  const codexHome = path.join(app.getPath("userData"), "codex-home");
  mkdirSync(codexHome, { recursive: true });
  const corpusIngestion = aiMemoryDatabase
    ? createCodexConversationCorpusIngestion(aiMemoryDatabase, path.join(codexHome, "sessions"))
    : null;
  const externalCodexHome = path.resolve(process.env.CODEX_HOME || path.join(app.getPath("home"), ".codex"));
  const externalCorpusIngestions = aiMemoryDatabase ? [
    createCodexConversationCorpusIngestion(aiMemoryDatabase, path.join(externalCodexHome, "sessions"), {
      sourceKeyPrefix: "codex-app/active",
      eligibleThreadSources: ["user"],
      requiredWorkspaceRoot: projectRoot,
      requiredOriginator: "codex_work_desktop",
      requireCompletedTurns: true,
    }),
    createCodexConversationCorpusIngestion(aiMemoryDatabase, path.join(externalCodexHome, "archived_sessions"), {
      sourceKeyPrefix: "codex-app/archived",
      eligibleThreadSources: ["user"],
      requiredWorkspaceRoot: projectRoot,
      requiredOriginator: "codex_work_desktop",
      requireCompletedTurns: true,
    }),
  ] : [];
  /** rollout 本身是持久重试源；只有完整入库后才更新检查点，失败会在下一回合或启动时重试。 */
  let corpusIngestionRunning = false;
  let corpusIngestionRequested = false;
  let latestCorpusTrigger: "startup" | "turn-completed" | "codex-app-changed" | "codex-app-enabled" = "startup";
  const ingestTrainingCorpus = (trigger: "startup" | "turn-completed" | "codex-app-changed" | "codex-app-enabled"): void => {
    if (!corpusIngestion) return;
    latestCorpusTrigger = trigger;
    if (corpusIngestionRunning) {
      corpusIngestionRequested = true;
      return;
    }
    corpusIngestionRunning = true;
    void (async () => {
      try {
        const summaries = [await corpusIngestion.ingestPendingRolloutsIncrementally()];
        if (settings.read().codexAppCorpusIngestionEnabled) {
          for (const ingestion of externalCorpusIngestions) summaries.push(await ingestion.ingestPendingRolloutsIncrementally());
        }
        const summary = summaries.reduce((total, current) => ({
          scannedFileCount: total.scannedFileCount + current.scannedFileCount,
          changedFileCount: total.changedFileCount + current.changedFileCount,
          ingestedMessageCount: total.ingestedMessageCount + current.ingestedMessageCount,
          skippedInternalFileCount: total.skippedInternalFileCount + current.skippedInternalFileCount,
        }), { scannedFileCount: 0, changedFileCount: 0, ingestedMessageCount: 0, skippedInternalFileCount: 0 });
        eventCenter.recordEvent("training_corpus.ingested", { trigger, ...summary });
      } catch (error) {
        // 数据库或尾行暂不可用时保留 rollout 与旧水位；事件登记失败也不能覆盖原始会话。
        try { eventCenter.recordEvent("training_corpus.ingestion_failed", { trigger, message: error instanceof Error ? error.message : String(error) }); } catch { /* AI Memory 故障由启动状态统一回显。 */ }
      } finally {
        corpusIngestionRunning = false;
        if (corpusIngestionRequested) {
          corpusIngestionRequested = false;
          ingestTrainingCorpus(latestCorpusTrigger);
        }
      }
    })();
  };
  ingestTrainingCorpus("startup");
  settings.subscribe((next) => {
    if (next.codexAppCorpusIngestionEnabled) ingestTrainingCorpus("codex-app-enabled");
  });
  // 只监听 Codex 的持久会话目录；开关关闭时回调不读取外部会话，开启后下一次变化或30秒兜底扫描立即补录。
  codexAppCorpusWatcher = createCodexConversationCorpusWatcher(
    [path.join(externalCodexHome, "sessions"), path.join(externalCodexHome, "archived_sessions")],
    () => {
      if (settings.read().codexAppCorpusIngestionEnabled) ingestTrainingCorpus("codex-app-changed");
    },
  );
  codexAppCorpusWatcher.start();
  const dispatch = new ConversationDispatchStore(
    path.join(app.getPath("userData"), "conversation-dispatch.json"),
    (type, details, taskId) => eventCenter.recordEvent(type, details, taskId),
  );
  const workspaces = startupWorkspaces;
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
      onConversationTurnCompleted: () => ingestTrainingCorpus("turn-completed"),
    },
    (details) => eventCenter.recordEvent("trusted_command.decision", details),
    (details) => eventCenter.recordEvent("thread.lifecycle", details),
  );
  const nangongSessions = createSqliteCodexSessionRepository(aiMemoryDatabase, "nangong");
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
      preserveThreadAcrossWorkspaceChanges: true,
    },
    (details) => eventCenter.recordEvent("nangong.conversation.trusted_command.decision", details),
    (details) => eventCenter.recordEvent("nangong.conversation.thread.lifecycle", details),
  );
  const hanLiSessions = createSqliteCodexSessionRepository(aiMemoryDatabase, "han-li");
  hanLiCodex = new CodexService(
    projectRoot, trustedCommands, hanLiSessions,
    {
      codexHome, serviceName: "selplat_ai_desktop_han_li_evolution", threadSource: "ai-desktop-han-li-evolution",
      migrateLegacySession: false, sessionStorage: "ai-desktop", validationOwner: "desktop", readSettings: () => settings.read(), readRuleInstructions,
      preserveThreadAcrossWorkspaceChanges: true,
    },
    (details) => eventCenter.recordEvent("han-li.evolution.trusted_command.decision", details),
    (details) => eventCenter.recordEvent("han-li.evolution.thread.lifecycle", details),
  );
  // 南宫婉的聊天、研讨和分发共享同一人物线程，业务节点仍由各自领域事件区分。
  nangongDeliberationCodex = nangongCodex;
  nangongDistributionCodex = nangongCodex;
  // 令狐固定会话仅服务故障兜底和统一测试修复；常规分发由南宫婉规划并交给程序做确定性冲突校验。
  const linghuSessions = createSqliteCodexSessionRepository(aiMemoryDatabase, "linghu");
  const collaborationRoot = path.join(app.getPath("userData"), "collaboration");
  const screenshots = new ScreenshotStore(path.join(projectPaths.temporaryMaterialsRoot, "截图"));
  const corpusSemanticWorkspaceRoot = path.join(app.getPath("userData"), "corpus-semantic-backfill-workspace");
  mkdirSync(corpusSemanticWorkspaceRoot, { recursive: true });
  const corpusSemanticWorkspace = {
    primaryId: "corpus-semantic-backfill",
    roots: [{ id: "corpus-semantic-backfill", name: "会话语义整理", path: corpusSemanticWorkspaceRoot, permission: "read-only" as const }],
  };
  const corpusSemanticBackfillSessions = createFileCodexSessionRepository(path.join(app.getPath("userData"), "corpus-semantic-backfill-session.json"));
  corpusSemanticBackfillCodex = new CodexService(
    corpusSemanticWorkspaceRoot,
    trustedCommands,
    corpusSemanticBackfillSessions,
    {
      codexHome,
      serviceName: "selplat_ai_desktop_corpus_semantic_backfill",
      threadSource: "ai-desktop-corpus-semantic-backfill",
      migrateLegacySession: false,
      sessionStorage: "ai-desktop",
      validationOwner: "desktop",
      readSettings: () => settings.read(),
      // 历史语义整理只接收固定 JSON 协议，禁止把工程规则正文注入原始对话分析。
      readRuleInstructions: () => "",
    },
    (details) => eventCenter.recordEvent("training_corpus.semantic_backfill.trusted_command.decision", details),
    (details) => eventCenter.recordEvent("training_corpus.semantic_backfill.thread.lifecycle", details),
  );
  const corpusSemanticBackfill = aiMemoryDatabase ? createCodexConversationSemanticBackfill({
    database: aiMemoryDatabase,
    roots: [path.join(externalCodexHome, "sessions"), path.join(externalCodexHome, "archived_sessions")],
    requiredWorkspaceRoot: projectRoot,
    analyzer: async (candidates) => {
      if (!corpusSemanticBackfillCodex) throw new Error("Codex 历史语义整理服务尚未就绪。");
      const response = await corpusSemanticBackfillCodex.send(
        buildCodexSemanticBackfillPrompt(candidates),
        "zh-CN",
        "read-only",
        corpusSemanticWorkspace,
      );
      return parseCodexSemanticBackfillResponse(response.text);
    },
  }) : null;
  const collaborationStore = createCollaborationState(path.join(collaborationRoot, "collaboration-state.json"));
  const collaborationDurations = createCollaborationDurationLog(projectPaths.collaborationArchiveRoot);
  const collaborationRegistry = new CollaborationCodexRegistry(collaborationDurations);
  const versionWorkspaces = createVersionWorkspaceManager(projectRoot, path.join(collaborationRoot, "worktrees"));
  const testResources = new TestResourceCoordinatorFacade({
    coordinationRoot: path.join(projectPaths.runningTestRoot, "_资源协调"),
    recordEvent: (type, details, taskId) => eventCenter.recordEvent(type, details, taskId),
  });
  const integrationReleases = new IntegrationReleaseCoordinatorFacade({
    coordinationRoot: path.join(projectPaths.runningExecutionRoot, "_集成与发布协调"),
    recordEvent: (type, details) => eventCenter.recordEvent(type, details),
  });
  const releaseBatches = createReleaseBatchStore(projectPaths.runningExecutionRoot, projectPaths.archiveLogRoot);
  // 版本集成闭包稍后通过令狐 Runtime 的受控能力执行统一测试，不直接持有内部 Runner。
  let linghuRuntime: LinghuRuntime | undefined;
  const taskTests = createTaskWorktreeTestRunner(
    projectRoot,
    applicationName,
    path.join(projectPaths.cacheRoot, "test-runtime"),
    (type, details, taskId) => eventCenter.recordEvent(type, details, taskId),
    testResources,
  );
  const collaborationSessions = new CodexCollaborationSessionFactory({
    projectRoot,
    applicationName,
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
    readWorkspaceState: () => workspaces.read(),
    personaSessionStore: (memberId) => memberId === "linghu-ancestor" ? linghuSessions : null,
    recordEvent: (type, details, taskId) => eventCenter.recordEvent(type, details, taskId),
  });
  const versionIntegration = createVersionIntegrationPipeline({
    store: collaborationStore,
    durations: collaborationDurations,
    workspaces: versionWorkspaces,
    actorMemberId: "linghu-ancestor",
    verifyCandidate: async (candidate, taskIds, releaseBatchId) => {
      const rootPath = candidate.rootPath;
      await testResources.run({
        runId: `integration-${taskIds.join("-")}`,
        taskId: taskIds.length === 1 ? taskIds[0] : null,
        initiatorMemberId: "collaboration-integrator",
        kind: "integration-validation",
        port: 4197,
        buildRoot: projectPaths.buildRoot,
      }, () => verifyCollaborationIntegration(rootPath, taskIds, projectRoot, applicationName, candidate));
      const candidateExecutable = await linghuRuntime!.runUnifiedTests(rootPath);
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
      try {
        workflowRepository?.syncCollaborationState(state);
        collaborationTimeline?.appendTaskFlowEvents(state, taskIds);
      }
      catch (error) {
        eventCenter.recordException({ kind: "technical", sourceType: "system", sourceId: "collaboration-timeline", operation: "sync_collaboration_state", error, correlationId: taskIds.length === 1 ? taskIds[0] : undefined, details: { reason, taskIds } });
      }
      eventCenter.recordEvent("collaboration.state.changed", { reason, mode: state.mode, taskIds }, taskIds.length === 1 ? taskIds[0] : undefined);
      for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("desktop:collaboration-state", { state, reason, taskIds });
      personaEvolution?.notifyWorkflowChanged();
    },
    emitStream: (taskId, memberId, event) => {
      eventCenter.recordEvent(`collaboration.harness.${event.type}`, { memberId, turnId: event.turnId, status: event.status || null }, taskId);
      let timelineNodeId: string | null = null;
      try { timelineNodeId = collaborationTimeline?.appendStream(taskId, memberId, event) || null; }
      catch (error) {
        eventCenter.recordException({ kind: "technical", sourceType: "system", sourceId: "collaboration-timeline", operation: "append_stream_chunk", error, correlationId: taskId, details: { memberId, eventType: event.type, turnId: event.turnId } });
      }
      for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("desktop:collaboration-stream", { taskId, memberId, timelineNodeId, event });
    },
  });
  // 旧 nangong-evolution.json 仅作为可恢复的历史取证文件保留，生产运行不再读取、写入或回退。
  const evolutionStateStore = createEvolutionState(aiMemoryDatabase);
  const beginEvolutionMutation = workflowRepository ? (topicId: string, action: string, request: EvolutionMutationRequest, currentStateVersion: string) => workflowRepository!.beginEvolutionMutation(topicId, action, request, currentStateVersion) : undefined;
  const completeEvolutionMutation = workflowRepository ? (idempotencyKey: string, resultStateVersion: string) => workflowRepository!.completeEvolutionMutation(idempotencyKey, resultStateVersion) : undefined;
  const failEvolutionMutation = workflowRepository ? (idempotencyKey: string, error: unknown) => workflowRepository!.failEvolutionMutation(idempotencyKey, error) : undefined;
  const recordEvolutionTimelineEvent = collaborationTimeline ? (event: CollaborationTimelineBusinessEvent) => {
    try { collaborationTimeline!.appendTimelineEvent(event); }
    catch (error) {
      eventCenter.recordException({
        kind: "technical", sourceType: "system", sourceId: "collaboration-timeline",
        operation: "append_business_event", error, correlationId: event.fact.taskId || event.fact.proposalId || undefined,
        details: { eventId: event.eventId, sourceFactKey: event.fact.sourceFactKey, action: event.fact.action },
      });
      throw error;
    }
  } : undefined;
  // 韩立 Runtime 在人物模块内组装研讨、审批和验收；Workflow 只接收公开 Facade。
  const hanliRuntime = createHanliRuntime({
    store: evolutionStateStore,
    memory: collaborationMemory,
    askHanli: async (prompt, state) => (await hanLiCodex!.send(prompt, state.automationContext.locale, "read-only", mergeWorkspaceState(workspaces.read(), state.automationContext.workspaceState!), [], () => undefined, "conversation-managed")).text,
    askNangong: async (question, context, state) => (await nangongDeliberationCodex!.send([
      "你是南宫婉，正在参加由韩立发起的自动演化专题研讨。韩立是发问方，你只回答他当前提出的问题。",
      "回答必须区分已知事实、基于记录的判断和仍需调查的内容；不得自行确立专题、拆解任务或开始修改。",
      `研讨原记录：\n${context}`,
      `韩立当前问题：\n${question}`,
    ].join("\n\n"), state.automationContext.locale, "read-only", mergeWorkspaceState(workspaces.read(), state.automationContext.workspaceState!), [], () => undefined, "conversation-managed")).text,
    planAcceptance: async (prompt, workspaceState, locale) => (await hanLiCodex!.send(prompt, locale, "read-only", mergeWorkspaceState(workspaces.read(), workspaceState), [], () => undefined, "conversation-managed")).text,
    recordEvent: (type, details, taskId) => eventCenter.recordEvent(type, details, taskId),
    recordTimelineEvent: recordEvolutionTimelineEvent,
    beginMutation: beginEvolutionMutation,
    completeMutation: completeEvolutionMutation,
    failMutation: failEvolutionMutation,
    screenshots,
  });
  personaEvolution = new PersonaEvolutionRuntime({
    store: evolutionStateStore,
    collaboration,
    hanli: hanliRuntime.facade,
    conversation: {
      send: async (request, context) => nangongCodex!.send([
        "你现在以南宫婉的专项演化调查者身份与用户讨论。只读调查和分析，不修改源码、不执行构建、不越过审批。",
        "语气克制、温和、有判断，不冷硬、不说教，也不故作亲昵。直接回答用户真正关心的内容；不要复述、改写或冒充用户原话，也不要添加固定的意图确认套话。短问题直接短答；复杂问题按内容自然分段，不使用“结论：”“建议：”“1、2、3”这类模板化标题或编号。不要使用“我更希望”“就行”“可以考虑”等没有明确落点的表达。",
        "需要提出方向时，明确说清现在有什么问题、为什么会造成问题，以及什么做法更合理。把已证实事实、基于事实的推断和仍待验证内容自然写进句子，不把推断或用户陈述说成既定事实，也不要机械套固定栏目。",
        "这段聊天始终只是调查材料；不得声称已形成正式课题、已提交审批或将开始修改。只有用户在界面明确确认转换后，系统才会冻结对话材料为课题；即使提案获批，也不能替代工程写入授权或命令审批。不得提示用户回复 1 直接修改源码。你必须语义判断事实、范围和验收条件是否足以整理课题；成熟时在正文最后原样显示“若确认启动本轮完整演化，请回复 1。”，由程序登记可恢复的等待确认状态；用户已明确要求修正且对话中已有事实、范围和验收条件时，不要重复停留在只读边界说明。条件不足时说明唯一缺口，不得要求用户发送 1。",
        "你必须自行判断本轮是否仍在处理当前主题，并在隐藏元数据中用一句清楚的话总结用户这条原话真正要推动的意图。回答正文最后另起一行输出 NANGONG_TOPIC_META={\"title\":\"本轮主题\",\"type\":\"自由判断的类型\",\"switchTopic\":false,\"userIntent\":\"用户意图摘要\",\"tags\":[\"AI理解后给出的标签\"],\"summary\":\"本轮回答核心主旨，最多300字\"}。正文直接回答，userIntent 只供内部检索；主题、类型、标签、意图和摘要必须基于本轮语义判断，不得用关键词规则机械填写。用户明显切换问题中心时 switchTopic 才为 true。该行只供程序登记，正文不得解释它。",
        `最近对话：\n${context}`,
        `用户最新消息：\n${request.message}`,
      ].join("\n\n"), request.locale, "read-only", mergeWorkspaceState(workspaces.read(), request.workspaceState), await screenshots.resolveAttachmentPaths(request.attachmentIds || []), () => undefined, "conversation-managed"),
      newChat: () => nangongCodex!.newChat(),
    },
    investigateRevision: async (prompt, workspaceState, locale) => (await nangongDeliberationCodex!.send(prompt, locale, "read-only", mergeWorkspaceState(workspaces.read(), workspaceState), [], () => undefined, "conversation-managed")).text,
    planDistribution: async (prompt, workspaceState, locale, emit) => (await nangongDistributionCodex!.send(prompt, locale, "read-only", mergeWorkspaceState(workspaces.read(), workspaceState), [], emit, "conversation-managed")).text,
    recordEvent: (type, details, taskId) => eventCenter.recordEvent(type, details, taskId),
    recordFailure: (input) => eventCenter.recordException(input),
    memory: collaborationMemory,
    readDossier: workflowRepository ? (topicId, state) => workflowRepository!.getEvolutionTopicDossier(topicId, state) : undefined,
    queryWorkbench: workflowRepository ? (request) => workflowRepository!.queryEvolutionWorkbench(request) : undefined,
    getWorkbenchPreference: workflowRepository ? (perspective, nodeId) => workflowRepository!.getEvolutionWorkbenchPreference(perspective, nodeId) : undefined,
    saveWorkbenchPreference: workflowRepository ? (request) => workflowRepository!.saveEvolutionWorkbenchPreference(request) : undefined,
    beginMutation: beginEvolutionMutation,
    completeMutation: completeEvolutionMutation,
    failMutation: failEvolutionMutation,
    recordTimelineEvent: recordEvolutionTimelineEvent,
    recordTimelineStream: collaborationTimeline ? (taskId, memberId, event) => {
      try { collaborationTimeline!.appendStream(taskId, memberId, event); }
      catch (error) {
        eventCenter.recordException({ kind: "technical", sourceType: "system", sourceId: "collaboration-timeline", operation: "append_distribution_stream", error, correlationId: taskId });
        throw error;
      }
    } : undefined,
  });
  // 三个人物和两个共享模块分别取得受控 Facade；完整运行实例只留在组合根，不再传给 IPC。
  const nangongRuntime = personaEvolution.nangongRuntime;
  const evolutionRuntime = createEvolutionRuntime(personaEvolution);
  const personaWorkflowRuntime = createPersonaWorkflowRuntime(personaEvolution);
  evolutionRuntime.facade.subscribe((state, reason, topicId, proposalId, previousState) => {
    try { workflowRepository?.syncEvolutionState(state); }
    catch (error) {
      eventCenter.recordException({ kind: "technical", sourceType: "system", sourceId: "collaboration-timeline", operation: "sync_evolution_state", error, correlationId: topicId || proposalId || undefined, details: { reason, topicId, proposalId } });
    }
    eventCenter.recordEvent("nangong.evolution.state_changed", { reason, topicId, proposalId, activeTopicId: state.activeTopicId });
    const workbenchChange = buildEvolutionWorkbenchChange(previousState, state, reason, topicId, proposalId);
    for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) {
      window.webContents.send("desktop:evolution-workbench-changed", workbenchChange);
      window.webContents.send("desktop:evolution-state", { state, reason, topicId, proposalId });
    }
  });
  collaborationMemory?.syncEvolutionState(evolutionRuntime.facade.state());
  // 令狐内部的 Store、Facade 和状态订阅由功能模块一次性装配，main 只提供跨领域端口。
  linghuRuntime = createLinghuRuntime({
    // Platform 绑定真实状态路径，令狐人物只接收不含路径信息的 JSON 持久化 Port。
    persistence: createAtomicJsonPersistence(path.join(collaborationRoot, "linghu-automation.json")),
    collaboration,
    readWorkspaceState: () => workspaces.read(),
    locale: () => settings.read().locale,
    recordEvent: (type, details, taskId) => eventCenter.recordEvent(type, details, taskId),
    readTestResourceState: () => testResources.state(),
    unifiedTest: {
      sourceProjectRoot: projectRoot,
      applicationName,
      buildRoot: projectPaths.buildRoot,
      testResources,
      onVerified: (executable) => {
        eventCenter.recordEvent("application.controlled_restart_scheduled", { reason: "linghu_unified_test_completed", executable });
        app.relaunch({ execPath: executable, args: [`--selplat-root=${projectRoot}`, "--ai-desktop-variant=developer"] });
        prepareAiMemoryShutdown();
        app.exit(0);
      },
    },
    submitRepairProposal: (request) => personaEvolution!.createLinghuRepairProposal(request),
    readEvolutionState: () => personaEvolution!.state(),
    reviseReturnedProposal: (proposalId) => personaEvolution!.nangongRuntime.facade.investigateAndReviseReturnedProposal(proposalId),
    onStateChanged: (event) => {
      workflowRepository?.syncLinghuState(event.state);
      eventCenter.recordEvent("linghu.automation.state_changed", { reason: event.reason, enabled: event.state.enabled, cycle: event.state.cycle, module: event.state.currentModule }, event.state.activeTaskId || undefined);
      for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("desktop:linghu-automation-state", event);
    },
  });
  // 业务调用方只持有 Facade；测试清理通过 Runtime 受控能力完成，Store 不离开令狐边界。
  linghuAutomation = linghuRuntime.facade;
  // Workflow 只登记人物身份、生命周期和稳定能力，不保存任何人物内部 Store。
  const personaRegistry = createPersonaCapabilityRegistry();
  personaRegistry.register({ memberId: nangongRuntime.memberId, displayName: "南宫婉", runtime: nangongRuntime, capabilities: ["investigation", "proposal-authoring"] });
  personaRegistry.register({ memberId: hanliRuntime.memberId, displayName: "韩立", runtime: hanliRuntime, capabilities: ["deliberation", "proposal-review", "acceptance"] });
  personaRegistry.register({ memberId: linghuRuntime.memberId, displayName: "令狐老祖", runtime: linghuRuntime, capabilities: ["flow-guard", "unified-test"] });
  // 独占能力在启动时完成核对；重复负责人会立即阻断，而不是运行中随机选择。
  personaRegistry.requireCapability("proposal-review");
  personaRegistry.requireCapability("unified-test");

  if (workflowRepository) {
    workflowSupervisor = createWorkflowSupervisor({
      repository: workflowRepository,
      readers: {
        collaboration: () => collaboration!.state(),
        evolution: () => personaEvolution!.state(),
        linghu: () => linghuAutomation!.state(),
      },
      projectCollaborationTimeline: (state) => collaborationTimeline?.appendTaskFlowEvents(state, state.tasks.map((task) => task.taskId)),
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
      codexAppCorpusWatcher?.stop();
      personaRegistry.stopAll();
      personaWorkflowRuntime.stop();

      // 固定人物线程是长期会话事实；清空测试数据只清流程运行态，不重置南宫婉、韩立和令狐老祖。
      await collaboration?.dispose();
      runtimeDisposed = true;

      // 候选证据回收与核心测试态清理是两条独立线路；Git 局部失败必须回传，但不能再次留下旧数据库任务。
      const candidateCleanup = await versionWorkspaces.clearFailedTestReleaseCandidates(releaseBatches.failedCandidateBranches())
        .catch((error) => ({ branchCount: 0, worktreeCount: 0, failures: [error instanceof Error ? error.message : String(error)] }));
      const repositoryToClear = workflowRepository;
      let clearedRecordCount = 0;
      dispatch.clear();
      clearedRecordCount += collaborationStore.clearTestData();
      clearedRecordCount += evolutionStateStore.clearTestData();
      clearedRecordCount += linghuRuntime!.clearTestData();
      clearedRecordCount += repositoryToClear?.clearTestData() || 0;
      collaborationStore.assertTestDataCleared();
      evolutionStateStore.assertTestDataCleared();
      linghuRuntime!.assertTestDataCleared();
      eventCenter.attachRepository(null);
      workflowRepository = null;
      closeAiMemoryDatabase();

      const result: TestDataResetResult = {
        cleared: true, clearedRecordCount,
        clearedCandidateBranchCount: candidateCleanup.branchCount,
        clearedCandidateWorktreeCount: candidateCleanup.worktreeCount,
        candidateCleanupWarnings: candidateCleanup.failures,
        restartScheduled: true,
      };
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
        codexAppCorpusWatcher?.start();
        personaRegistry.startAll();
        personaWorkflowRuntime.start();
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
    nangong: nangongRuntime.facade,
    hanli: hanliRuntime.facade,
    evolution: evolutionRuntime.facade,
    personaWorkflow: personaWorkflowRuntime.facade,
    collaborationRegistry,
    eventCenter,
    workflowRepository,
    collaborationTimeline,
    aiMemoryDatabaseStatus,
    projectRoot,
    appRoot,
    variant,
    preloadPath,
    rendererRoot,
    rules,
    clearTestData,
    corpusSemanticBackfillStatus: () => corpusSemanticBackfill?.status() || ({
      state: "failed", targetCount: 0, discoveredCount: 0, processedCount: 0, insertedCount: 0,
      failedCount: 1, message: "AI Memory 数据库不可用，无法补齐历史摘要。", startedAt: null, completedAt: null,
    } satisfies CorpusSemanticBackfillStatus),
    startCorpusSemanticBackfill: (limit?: number) => {
      if (!corpusSemanticBackfill) throw new Error("AI Memory 数据库不可用，无法补齐历史摘要。");
      return corpusSemanticBackfill.start(limit);
    },
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
  personaRegistry.startAll();
  personaWorkflowRuntime.start();
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
  personaEvolution?.stop();
  void collaboration?.dispose().catch((error) => eventCenter.recordException({ kind: "technical", sourceType: "launcher", sourceId: "collaboration", operation: "dispose", error }));
  codex?.dispose();
  nangongCodex?.dispose();
  hanLiCodex?.dispose();
  // 南宫婉研讨与分发引用同一服务，不重复关闭。
  corpusSemanticBackfillCodex?.dispose();
  prepareAiMemoryShutdown();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
