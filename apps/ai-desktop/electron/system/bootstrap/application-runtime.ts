/**
 * AI Desktop 应用运行时组合根。
 *
 * 新手阅读地图：
 * 1. 本文件先确定运行目录、用户数据目录和当前 SELPLAT 工作区。
 * 2. Electron 就绪后，依次创建数据库、设置、Codex、协作、人物和规则服务。
 * 3. 所有服务通过 registerDesktopIpc 暴露给 preload；React 页面不能直接访问 Node.js。
 * 4. createMainWindow 创建桌面窗口，并加载 Vite 已构建的本地 index.html。
 * 5. 应用退出前统一停止监听器、人物流程、Codex 子进程和数据库连接。
 *
 * 本文件负责装配应用模块；Electron 进程入口位于 electron/main.ts。
 */

// Node.js 子进程 API：发布前只读核对 Git 提交与工作区洁净状态，不执行任何修改命令。
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
// Node.js 文件系统 API：检查工程、创建运行目录、读取版本以及写健康检查结果。
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
// 跨平台路径 API：避免手写 Windows 或 macOS 的路径分隔符。
import path from "node:path";
// ES Module 没有 __dirname；它把 import.meta.url 转换为真实磁盘路径。

// app 管理 Electron 生命周期，BrowserWindow 表示桌面窗口。
import { app, BrowserWindow } from "electron";
// SELPLAT 公共路径解析器：从工程根派生 build、cache、日志和临时目录。

/**
 * contracts 目录只定义“跨模块传递的数据长什么样”，不连接数据库、不访问文件，也不执行 Electron 操作。
 * import type 表示这些名字只供 TypeScript 检查：开发时可发现字段缺失或类型写错，编译后的 main.js 会删除这些导入。
 * 每个 index.js 都是对应领域的公开出口；源码是 index.ts，NodeNext 构建后生成运行时使用的 index.js。
 */
import type {
  // 来源：contracts/services/support/platform/persistence/index.ts → dto/database-status.out.dto.ts。
  // 含义：AI Memory 数据库健康状态，包含 ready/recovery-required/unavailable、结构版本和提示消息。
  // 用法：main.ts 保存初始化结果，并通过 IPC 交给诊断界面；不会把数据库路径、连接或 SQL 暴露给页面。
  AiMemoryDatabaseStatusOutDto,
  // 来源：同一个 persistence/database.ts。
  // 含义：历史语料语义补齐任务的进度 DTO，包含目标数、处理数、成功数、失败数和起止时间。
  // 用法：IPC 查询补齐状态时约束返回结构；数据库不可用时也必须返回同样完整的失败结构。
  CorpusSemanticBackfillStatusOutDto,
} from "../../../contracts/services/support/platform/persistence/index.js";
import type { SendPersonaConversationMessageInDto } from "../../../contracts/services/personas/conversation/index.js";
import type {
  // 来源：contracts/services/support/platform/workspace/index.ts → dto/workspace.out.dto.ts。
  // 含义：当前工作区快照，由 primaryId 和多个 { id、name、path、permission } 工程根组成。
  // 用法：mergeWorkspaceState() 合并任务快照和最新工作区配置，再交给 Codex 决定可访问目录与读写权限。
  WorkspaceStateOutDto,
} from "../../../contracts/services/support/platform/workspace/index.js";
import type {
  // 来源：contracts/services/evolution/dto/evolution-mutation.in.dto.ts。
  // 含义：专题写入的并发控制请求，携带页面看到的状态版本和防重复提交的 idempotencyKey。
  // 用法：专题变更开始前交给 Repository；版本落后或幂等键重复时，持久化层可以拒绝错误写入。
  EvolutionMutationInDto,
} from "../../../contracts/services/evolution/index.js";
import type {
  // 来源：contracts/services/workflow/index.ts → dto/collaboration-timeline-business.event.out.dto.ts。
  // 含义：审批申请、审批决定、分发计划等已经发生且不可变的专题业务事实，不是当前状态快照。
  // 用法：recordEvolutionTimelineEvent() 把事件写入 SQLite 时间线，失败时记录异常并向调用方抛出。
  CollaborationTimelineBusinessEventOutDto,
} from "../../../contracts/services/workflow/index.js";
/**
 * Event Center（事件中心）不是一个单纯的“点击事件”工具，而是一组主进程公共能力：
 * - 审计：把应用启动、任务、命令、审批和异常写入 JSONL/摘要文件，并可投影到 SQLite；
 * - 时间线：把多人协作状态和流式输出保存成可查询节点，再通知 Renderer 刷新；
 * - 记忆：保存南宫婉对话原文、专题关联和审批证据，供后续人物读取；
 * - 训练语料：增量读取 Codex 持久会话，并为缺少主题元数据的历史回合做 AI 语义补齐。
 *
 * 这里从 event-center/index.js 统一导入，而不直接进入 internal：
 * - 源码真实出口是 services/support/capabilities/event-center/index.ts；
 * - TypeScript 的 NodeNext/ESM 写法要求 import 使用运行时扩展名 .js；
 * - 编译开发时会解析到 index.ts，构建后才真正生成并加载 index.js。
 */
import {
  // 来源：index.ts → internal/corpus/codex-conversation-corpus.ingestion.ts。
  // 作用：创建“会话增量入库器”，扫描 sessions 里的 rollout 文件，去重后写入训练语料 SQLite 表。
  createCodexConversationCorpusIngestion,
  // 来源：同一个 corpus ingestion 文件中的 CodexConversationCorpusWatcher。
  // 作用：监听 Codex sessions/archived_sessions 目录变化；它只发出“需要扫描”信号，不直接解析或写数据库。
  createCodexConversationCorpusWatcher,
  // 来源：index.ts → internal/corpus/codex-conversation-semantic-backfill.ts。
  // 作用：创建历史语料补齐任务，找出缺少标题、类型、意图、标签和摘要的旧回合，并批量提交给分析器。
  createCodexConversationSemanticBackfill,
  // 来源：internal/corpus/codex-conversation-semantic-backfill.ts。
  // 作用：把待补齐的历史回合组装成固定 JSON 协议提示词，交给隔离的只读 Codex 分析。
  buildCodexSemanticBackfillPrompt,
  // 来源：同一个 semantic-backfill 文件。
  // 作用：严格解析 Codex 返回文本并校验结构，得到可写入数据库的标题、类型、意图、标签和摘要。
  parseCodexSemanticBackfillResponse,
  // 下面都是 type-only 类型别名：只帮助编辑器和编译器理解对象能力，运行时不会导入任何值。
  // CorpusIngestion 对应 CodexConversationCorpusIngestion；当前 main.ts 未直接标注这个别名。
  type CorpusIngestion,
  // CorpusSemanticBackfill 对应 CodexConversationSemanticBackfill；当前 main.ts 未直接标注这个别名。
  type CorpusSemanticBackfill,
  // CorpusWatcher 对应目录监听器；外层变量 codexAppCorpusWatcher 用它声明“可 start/stop 的 watcher”。
  type CorpusWatcher,
  // EventCenterMemory 对应 CollaborationMemoryService；外层变量 collaborationMemory 用它声明人物记忆能力。
  type EventCenterMemory,
  // EventCenterTimeline 对应 CollaborationTimelineFacade；外层变量 collaborationTimeline 用它声明时间线能力。
  type EventCenterTimeline,
} from "../../services/support/capabilities/event-center/index.js";
// Codex 平台服务启动官方 app-server，并保存主会话或人物会话的线程 ID。
import {
  CodexFacade as CodexService,
  createFileCodexSessionRepository,
  createSqliteCodexSessionRepository,
} from "../../services/support/platform/codex/index.js";
// Workflow 负责跨人物流程、恢复和监督，不承载某个人物自己的判断。
import {
  type CollaborationWorkflowFacade as CollaborationCoordinator,
  type WorkflowRepositoryPort as WorkflowRepository,
  type WorkflowSupervisorPort as WorkflowSupervisor,
} from "../../services/workflow/index.js";
// 三个人物模块只通过公开入口向组合根提供 Runtime 或 Facade。
import { createLinghuRuntime, LinghuAutomationFacade, type LinghuRuntime } from "../../services/personas/linghu/index.js";
import { createHanliRuntime } from "../../services/personas/hanli/index.js";
import { PersonaConversationFacade } from "../../services/personas/conversation/index.js";
import { buildEvolutionWorkbenchChange, createEvolutionRuntime, createEvolutionState } from "../../services/evolution/index.js";
import { PersonaEvolutionRuntime } from "../../services/workflow/index.js";
// Platform 服务提供截图、设置、工作区、安全和数据库等底层能力。
import { createAtomicJsonPersistence, type DatabasePort as SqliteDatabase } from "../../services/support/platform/persistence/index.js";
// 规则服务读取构建后的规则包，并合并用户允许的覆盖项。
// 窗口工厂集中维护 BrowserWindow 安全配置和 Renderer 加载方式。
import { createMainWindow } from "../window/create-main-window.js";
import { createStartupContext } from "./startup-context.js";
import { createPersistenceContext, type PersistenceContext } from "./persistence.bootstrap.js";
import { createCapabilityContext } from "./capabilities.bootstrap.js";
import { createCollaborationContext } from "./collaboration.bootstrap.js";
import { createPersonaApplicationContext } from "./personas.bootstrap.js";
import { registerApplicationIpc } from "./ipc.bootstrap.js";
import { TestDataResetService } from "../../services/support/application/test-data-reset.service.js";

const startup = createStartupContext();
const { applicationName: startupApplicationName, variant: startupVariant,
  projectRoot: startupProjectRoot, projectPaths: startupProjectPaths, preloadPath, healthCheckFile,
  workspaces: startupWorkspaces, eventCenter } = startup;

// 这些对象在 app.whenReady() 内创建，却要在 before-quit 中释放，因此在外层保存引用。
// 主聊天 Codex：处理用户在 Developer 主窗口发起的普通会话。
let codex: CodexService | undefined;
// 南宫婉与韩立各有长期会话，避免不同人物的上下文互相污染。
let nangongCodex: CodexService | undefined;
let hanLiCodex: CodexService | undefined;
// 研讨和分发当前复用南宫婉会话；不同变量用于表达不同业务场景。
let nangongDeliberationCodex: CodexService | undefined;
let nangongDistributionCodex: CodexService | undefined;
// 历史语料语义补齐使用隔离的只读 Codex，不污染主聊天和人物线程。
let corpusSemanticBackfillCodex: CodexService | undefined;
// 跨人物协作协调器，负责任务状态、工作树和集成流程。
let collaboration: CollaborationCoordinator | undefined;
// 令狐公开门面只暴露检查、恢复和统一测试等受控能力。
let linghuAutomation: LinghuAutomationFacade | undefined;
// 人物演化总运行时连接南宫、韩立、专题状态和 Workflow。
let personaEvolution: PersonaEvolutionRuntime | undefined;
// 数据库故障时部分界面仍可启动，因此这些持久化服务允许暂时为 null。
let aiMemoryDatabase: SqliteDatabase | null = null;
let persistenceContext: PersistenceContext | null = null;
let workflowRepository: WorkflowRepository | null = null;
let collaborationTimeline: EventCenterTimeline | null = null;
let workflowSupervisor: WorkflowSupervisor | null = null;
let collaborationMemory: EventCenterMemory | null = null;
let codexAppCorpusWatcher: CorpusWatcher | null = null;
// 韩立语义提取计时器必须先于 SQLite 关闭；运行时创建后替换为空操作。
let stopHanliRuntime: () => void = () => undefined;
// 数据库初始化前先提供稳定状态，Renderer 不会收到含义不明的 undefined。
let aiMemoryDatabaseStatus: AiMemoryDatabaseStatusOutDto = {
  state: "unavailable",
  schemaVersion: null,
  message: "AI Memory 数据库尚未初始化。",
};

/** 当前工作区注册表是唯一入口；任务快照只决定主目录，不覆盖后来新增的工程根。 */
function mergeWorkspaceState(configured: WorkspaceStateOutDto, requested: WorkspaceStateOutDto): WorkspaceStateOutDto {
  // 任务快照指定的主工作区排在首位，保证 Codex 仍在任务原始主目录执行。
  const requestedPrimary = requested.roots.find((root) => root.id === requested.primaryId);
  // 合并任务快照与当前配置，并按规范化后的真实路径去重。
  const roots = [...(requestedPrimary ? [requestedPrimary] : []), ...configured.roots, ...requested.roots]
    .filter((root, index, values) => values.findIndex((candidate) => path.resolve(candidate.path) === path.resolve(root.path)) === index);
  return { primaryId: requestedPrimary?.id || configured.primaryId, roots };
}

/** 关闭 SQLite；即使关闭失败也记录异常并清空引用，防止复用失效连接。 */
function closeAiMemoryDatabase(): void {
  persistenceContext?.close();
  persistenceContext = null;
  aiMemoryDatabase = null;
}

/** 停止所有可能继续写数据库的后台任务，再关闭数据库；退出和受控重启都会调用。 */
function prepareAiMemoryShutdown(): void {
  stopHanliRuntime();
  stopHanliRuntime = () => undefined;
  // 文件监听器可能触发语料写入，所以必须先停止。
  codexAppCorpusWatcher?.stop();
  codexAppCorpusWatcher = null;
  try {
    // 任务监督器会周期扫描和写事件，也必须在数据库前停止。
    workflowSupervisor?.stop();
  } catch (error) {
    eventCenter.recordException({ kind: "technical", sourceType: "launcher", sourceId: "workflow-supervisor", operation: "runtime_session_stop", error });
  } finally {
    workflowSupervisor = null;
  }
  closeAiMemoryDatabase();
}

/** Electron ready 后创建完整应用运行时。 */
export async function startApplication(): Promise<void> {
  // 复用启动前已解析的稳定值，确保全部服务属于同一工程和产品变体。
  const variant = startupVariant;
  const projectRoot = startupProjectRoot;
  const applicationName = startupApplicationName;
  const projectPaths = startupProjectPaths;
  persistenceContext = createPersistenceContext({
    projectRoot,
    runtimeMarkerPath: path.join(app.getPath("userData"), "ai-memory-database-state.json"),
    eventCenter,
    onTimelineChanged: (event) => {
      for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) {
        window.webContents.send("desktop:collaboration-timeline-changed", event);
      }
    },
  });
  aiMemoryDatabase = persistenceContext.database;
  aiMemoryDatabaseStatus = persistenceContext.status;
  workflowRepository = persistenceContext.workflowRepository;
  collaborationTimeline = persistenceContext.collaborationTimeline;
  collaborationMemory = persistenceContext.collaborationMemory;
  // Renderer 只从安装包内部或开发态 build 目录加载。
  const rendererRoot = app.isPackaged
    ? path.join(app.getAppPath(), "dist", "developer")
    : path.join(projectPaths.buildRoot, "renderer", "developer");
  // 开发态从源码根读版本；安装态从 Electron 应用包内部读版本。
  const appRoot = app.isPackaged ? app.getAppPath() : projectPaths.sourceRoot;
  const releaseVersion = (JSON.parse(readFileSync(path.join(appRoot, "package.json"), "utf8")) as { version: string }).version;
  eventCenter.recordApplicationStart({ variant, projectRoot, rendererRoot });
  const capabilityContext = createCapabilityContext({
    userDataRoot: app.getPath("userData"),
    projectRoot,
    buildRoot: projectPaths.buildRoot,
    temporaryMaterialsRoot: projectPaths.temporaryMaterialsRoot,
    packaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    eventCenter,
  });
  const { trustedCommands, codexSessions, settings, rules, ruleWorkspace, ruleUploads, prompts, codexHome, collaborationRoot, screenshots, dispatch } = capabilityContext;
  // 无源码规则工作区只在启动后异步尝试一次上传；失败保留 outbox 且不阻塞窗口和人物运行。
  if (ruleWorkspace.descriptor.mode === "local") void ruleUploads.uploadLatestPendingOnce();
  // Codex 开始任务时读取最新有效规则，避免把启动时状态永久缓存。
  const readRuleInstructions = () => rules.renderRoleInstructions("executor");
  const readNangongRuleInstructions = () => rules.renderRoleInstructions("nangong");
  const readHanliRuleInstructions = () => {
    const instructions = rules.renderRoleInstructions("hanli");
    if (!collaborationMemory) return instructions;
    try {
      const workspaceState = startupWorkspaces.read();
      const primary = workspaceState.roots.find((root) => root.id === workspaceState.primaryId);
      const context = collaborationMemory.readHanliSemanticContext(rules.activeUserId(), primary?.path || projectRoot, "", 12);
      return `${instructions}\n\n# 韩立当前客户认知与需求轨迹\n${JSON.stringify(context)}`;
    } catch {
      // 数据库恢复或首次提取尚未完成时只使用人物规则，不能阻断韩立会话。
      return instructions;
    }
  };
  // AI Desktop 自己的会话只有在数据库可用时才进入训练语料库。
  const corpusIngestion = aiMemoryDatabase
    ? createCodexConversationCorpusIngestion(aiMemoryDatabase, path.join(codexHome, "sessions"))
    : null;
  // 外部 Codex App 使用用户默认 CODEX_HOME；只有设置明确开启后才读取。
  const externalCodexHome = path.resolve(process.env.CODEX_HOME || path.join(app.getPath("home"), ".codex"));
  // 活跃与已归档会话分别登记来源前缀，方便追踪语料来自哪个物理目录。
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
  // running 防止并发扫描；requested 表示扫描期间又收到了一次触发，需要结束后再补跑。
  let corpusIngestionRunning = false;
  let corpusIngestionRequested = false;
  let requestHanliSemanticRefresh: () => void = () => undefined;
  let startHanliInternalDeliberation: (request: SendPersonaConversationMessageInDto) => Promise<{ continuous: boolean }> = async () => { throw new Error("韩立与南宫婉内部研讨运行时尚未就绪。"); };
  let latestCorpusTrigger: "startup" | "turn-completed" | "codex-app-changed" | "codex-app-enabled" = "startup";
  /** 按触发来源增量导入尚未处理的会话；本函数后台执行，不阻塞界面启动。 */
  const ingestTrainingCorpus = (trigger: "startup" | "turn-completed" | "codex-app-changed" | "codex-app-enabled"): void => {
    // 没有数据库就没有可写入的语料仓库，直接保持降级运行。
    if (!corpusIngestion) return;
    latestCorpusTrigger = trigger;
    if (corpusIngestionRunning) {
      // 不并行启动第二个扫描，只记住“结束后还要再扫一次”。
      corpusIngestionRequested = true;
      return;
    }
    corpusIngestionRunning = true;
    void (async () => {
      try {
        // AI Desktop 自身会话始终导入；外部 Codex App 会话受用户设置控制。
        const summaries = [await corpusIngestion.ingestPendingRolloutsIncrementally()];
        if (settings.read().codexAppCorpusIngestionEnabled) {
          for (const ingestion of externalCorpusIngestions) summaries.push(await ingestion.ingestPendingRolloutsIncrementally());
        }
        const summary = summaries.reduce((total, current) => ({
          // 合并多个来源的计数，审计中只记录一次完整导入结果。
          scannedFileCount: total.scannedFileCount + current.scannedFileCount,
          changedFileCount: total.changedFileCount + current.changedFileCount,
          ingestedMessageCount: total.ingestedMessageCount + current.ingestedMessageCount,
          skippedInternalFileCount: total.skippedInternalFileCount + current.skippedInternalFileCount,
        }), { scannedFileCount: 0, changedFileCount: 0, ingestedMessageCount: 0, skippedInternalFileCount: 0 });
        eventCenter.recordEvent("training_corpus.ingested", { trigger, ...summary });
        requestHanliSemanticRefresh();
      } catch (error) {
        // 数据库或尾行暂不可用时保留 rollout 与旧水位；事件登记失败也不能覆盖原始会话。
        try { eventCenter.recordEvent("training_corpus.ingestion_failed", { trigger, message: error instanceof Error ? error.message : String(error) }); } catch { /* AI Memory 故障由启动状态统一回显。 */ }
      } finally {
        // 无论成功失败都释放运行锁；若期间收到新触发，则立刻按最新来源补扫。
        corpusIngestionRunning = false;
        if (corpusIngestionRequested) {
          corpusIngestionRequested = false;
          ingestTrainingCorpus(latestCorpusTrigger);
        }
      }
    })();
  };
  // 启动时先补录应用关闭期间新增或未完成的持久会话。
  ingestTrainingCorpus("startup");
  // 用户刚打开外部语料开关时立即导入，不必等待目录下一次变化。
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
  // watcher 是长期后台资源，引用保存在外层以便退出时停止。
  codexAppCorpusWatcher.start();
  // 启动阶段创建的 WorkspaceStore 成为本次运行唯一工作区注册表。
  const workspaces = startupWorkspaces;
  // 主 Codex 使用文件会话仓库，并允许迁移旧版主会话记录。
  codex = new CodexService(
    projectRoot,
    trustedCommands,
    codexSessions,
    {
      codexHome,
      // serviceName/threadSource 会进入 Codex 会话元数据，用来区分调用来源。
      serviceName: "selplat_ai_desktop",
      threadSource: "ai-desktop",
      migrateLegacySession: true,
      sessionStorage: "ai-desktop",
      validationOwner: "codex",
      readSettings: () => settings.read(),
      readRuleInstructions,
      onAccountRead: (account) => {
        if (!account.authenticated || !account.accountSubject) return;
        const stableUserId = `U_${createHash("sha256").update(`${account.authMode || "account"}:${account.accountSubject}`, "utf8").digest("hex").slice(0, 16).toUpperCase()}`;
        rules.setAuthenticatedStableUserId(stableUserId);
      },
      // 一轮正常结束后触发增量入库，而不是在流式输出中反复扫描。
      onConversationTurnCompleted: () => ingestTrainingCorpus("turn-completed"),
    },
    (details) => eventCenter.recordEvent("trusted_command.decision", details),
    (details) => eventCenter.recordEvent("thread.lifecycle", details),
  );
  // 人物会话 ID 存在 SQLite 中；数据库不可用时仓库实现负责提供受控降级。
  const nangongSessions = createSqliteCodexSessionRepository(aiMemoryDatabase, "nangong");
  // 南宫婉拥有独立、跨工作区保持的长期线程，用于连续调查同一演化主题。
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
      readRuleInstructions: readNangongRuleInstructions,
      preserveThreadAcrossWorkspaceChanges: true,
    },
    (details) => eventCenter.recordEvent("nangong.conversation.trusted_command.decision", details),
    (details) => eventCenter.recordEvent("nangong.conversation.thread.lifecycle", details),
  );
  const hanLiSessions = createSqliteCodexSessionRepository(aiMemoryDatabase, "han-li");
  // 韩立使用另一条长期线程，确保审批意见不混入南宫婉的调查上下文。
  hanLiCodex = new CodexService(
    projectRoot, trustedCommands, hanLiSessions,
    {
      codexHome, serviceName: "selplat_ai_desktop_han_li_evolution", threadSource: "ai-desktop-han-li-evolution",
      migrateLegacySession: false, sessionStorage: "ai-desktop", validationOwner: "desktop", readSettings: () => settings.read(), readRuleInstructions: readHanliRuleInstructions,
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
  // 历史语义补齐只允许看到这个隔离的只读工作区，不能读取或修改真实工程源码。
  const corpusSemanticWorkspaceRoot = path.join(app.getPath("userData"), "corpus-semantic-backfill-workspace");
  mkdirSync(corpusSemanticWorkspaceRoot, { recursive: true });
  const corpusSemanticWorkspace = {
    primaryId: "corpus-semantic-backfill",
    roots: [{ id: "corpus-semantic-backfill", name: "会话语义整理", path: corpusSemanticWorkspaceRoot, permission: "read-only" as const }],
  };
  const corpusSemanticBackfillSessions = createFileCodexSessionRepository(path.join(app.getPath("userData"), "corpus-semantic-backfill-session.json"));
  // 语义补齐使用专门 Codex 实例，固定 JSON 输入输出且不注入工程开发规则。
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
  // 历史摘要与韩立认知提取共用隔离线程；串行化模型调用，避免同一线程出现并发 writer 冲突。
  let corpusSemanticAnalysisQueue: Promise<void> = Promise.resolve();
  const runCorpusSemanticAnalysis = <Result>(analysis: () => Promise<Result>): Promise<Result> => {
    const current = corpusSemanticAnalysisQueue.then(analysis, analysis);
    corpusSemanticAnalysisQueue = current.then(() => undefined, () => undefined);
    return current;
  };
  // 数据库存在时才创建补齐任务；analyzer 把候选对话交给隔离 Codex，再严格解析返回协议。
  const corpusSemanticBackfill = aiMemoryDatabase ? createCodexConversationSemanticBackfill({
    database: aiMemoryDatabase,
    roots: [path.join(externalCodexHome, "sessions"), path.join(externalCodexHome, "archived_sessions")],
    requiredWorkspaceRoot: projectRoot,
    analyzer: async (candidates) => {
      // 非空断言前先做运行时检查，启动装配异常时给出明确原因。
      if (!corpusSemanticBackfillCodex) throw new Error("Codex 历史语义整理服务尚未就绪。");
      const response = await runCorpusSemanticAnalysis(() => corpusSemanticBackfillCodex!.send(
        buildCodexSemanticBackfillPrompt(prompts, candidates),
        "zh-CN",
        "read-only",
        corpusSemanticWorkspace,
      ));
      return parseCodexSemanticBackfillResponse(response.text);
    },
  }) : null;
  let linghuRuntime: LinghuRuntime | undefined;
  const collaborationContext = createCollaborationContext({
    startup,
    capabilities: capabilityContext,
    linghuSessions,
    releaseVersion,
    readRuleInstructions: (memberId, task) => {
      if (memberId !== "linghu-ancestor" && task.snapshot.ruleContext) {
        return rules.renderTaskRuleSnapshot(task.snapshot.ruleContext);
      }
      return rules.renderRoleInstructions(memberId === "linghu-ancestor" ? "linghu" : "executor");
    },
    runUnifiedTests: (rootPath) => {
      if (!linghuRuntime) throw new Error("令狐运行时尚未初始化，不能执行统一测试。");
      return linghuRuntime.runUnifiedTests(rootPath);
    },
    publishRelease: (executable, releaseBatchId, runtimeSourceSha) => {
      eventCenter.recordEvent("application.controlled_restart_scheduled", { reason: "integration_release_published", executable, releaseBatchId, runtimeSourceSha });
      app.relaunch({ execPath: executable, args: [`--selplat-root=${projectRoot}`, "--ai-desktop-variant=developer", `--ai-desktop-runtime-sha=${runtimeSourceSha}`] });
      prepareAiMemoryShutdown();
      app.exit(0);
    },
    onStateChanged: (state, reason, taskIds) => {
      try {
        workflowRepository?.syncCollaborationState(state);
        collaborationTimeline?.appendTaskFlowEvents(state, taskIds);
      } catch (error) {
        eventCenter.recordException({ kind: "technical", sourceType: "system", sourceId: "collaboration-timeline", operation: "sync_collaboration_state", error, correlationId: taskIds.length === 1 ? taskIds[0] : undefined, details: { reason, taskIds } });
      }
      eventCenter.recordEvent("collaboration.state.changed", { reason, mode: state.mode, taskIds }, taskIds.length === 1 ? taskIds[0] : undefined);
      for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("desktop:collaboration-state", { state, reason, taskIds });
      personaEvolution?.notifyWorkflowChanged();
    },
    onStream: (taskId, memberId, event) => {
      eventCenter.recordEvent(`collaboration.harness.${event.type}`, { memberId, turnId: event.turnId, status: event.status || null }, taskId);
      let timelineNodeId: string | null = null;
      try { timelineNodeId = collaborationTimeline?.appendStream(taskId, memberId, event) || null; }
      catch (error) {
        eventCenter.recordException({ kind: "technical", sourceType: "system", sourceId: "collaboration-timeline", operation: "append_stream_chunk", error, correlationId: taskId, details: { memberId, eventType: event.type, turnId: event.turnId } });
      }
      for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("desktop:collaboration-stream", { taskId, memberId, timelineNodeId, event });
    },
  });
  const { collaborationStore, collaborationRegistry, versionWorkspaces, testResources, releaseBatches } = collaborationContext;
  collaboration = collaborationContext.collaboration;
  // 旧 nangong-evolution.json 仅作为可恢复的历史取证文件保留，生产运行不再读取、写入或回退。
  // 当前专题演化状态以 SQLite 为唯一生产来源。
  const evolutionStateStore = createEvolutionState(aiMemoryDatabase);
  // 三个可选端口把专题写操作登记为幂等 mutation；数据库不可用时不伪造持久化成功。
  const beginEvolutionMutation = workflowRepository ? (topicId: string, action: string, request: EvolutionMutationInDto, currentStateVersion: string) => workflowRepository!.beginEvolutionMutation(topicId, action, request, currentStateVersion) : undefined;
  const completeEvolutionMutation = workflowRepository ? (idempotencyKey: string, resultStateVersion: string) => workflowRepository!.completeEvolutionMutation(idempotencyKey, resultStateVersion) : undefined;
  const failEvolutionMutation = workflowRepository ? (idempotencyKey: string, error: unknown) => workflowRepository!.failEvolutionMutation(idempotencyKey, error) : undefined;
  const recordEvolutionTimelineEvent = collaborationTimeline ? (event: CollaborationTimelineBusinessEventOutDto) => {
    // 时间线失败必须向上抛出，不能把“业务完成但审计丢失”当成成功。
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
  // 韩立 Runtime 在人物模块内组装自由讨论、审批和验收；Workflow 只接收公开 Facade。
  const hanliRuntime = createHanliRuntime({
    // 韩立和南宫只取得只读 Codex 端口，人物模块不能直接访问 Electron 或文件系统。
    store: evolutionStateStore,
    prompts,
    memory: collaborationMemory,
    askHanli: async (prompt, state) => (await hanLiCodex!.send(prompt, state.automationContext.locale, "read-only", mergeWorkspaceState(workspaces.read(), state.automationContext.workspaceState!), [], () => undefined, null)).text,
    conversation: {
      send: async (request, prompt) => hanLiCodex!.send(prompt, request.locale, "read-only", mergeWorkspaceState(workspaces.read(), request.workspaceState), await screenshots.resolveAttachmentPaths(request.attachmentIds || []), () => undefined, null),
      newChat: () => hanLiCodex!.newChat(),
      activeConversationId: () => hanLiCodex!.activeSession().threadId,
    },
    refreshSemanticMemory: () => requestHanliSemanticRefresh(),
    startInternalDeliberation: (request) => startHanliInternalDeliberation(request),
    analyzeCorpus: async (prompt) => {
      if (!corpusSemanticBackfillCodex) throw new Error("韩立客户认知提取服务尚未就绪。");
      return (await runCorpusSemanticAnalysis(() => corpusSemanticBackfillCodex!.send(prompt, "zh-CN", "read-only", corpusSemanticWorkspace))).text;
    },
    readStableUserId: () => rules.activeUserId(),
    readProjectScope: () => {
      const current = workspaces.read();
      return current.roots.find((root) => root.id === current.primaryId)?.path || projectRoot;
    },
    planAcceptance: async (prompt, workspaceState, locale) => (await hanLiCodex!.send(prompt, locale, "read-only", mergeWorkspaceState(workspaces.read(), workspaceState), [], () => undefined, null)).text,
    recordEvent: (type, details, taskId) => eventCenter.recordEvent(type, details, taskId),
    recordTimelineEvent: recordEvolutionTimelineEvent,
    beginMutation: beginEvolutionMutation,
    completeMutation: completeEvolutionMutation,
    failMutation: failEvolutionMutation,
    screenshots,
  });
  stopHanliRuntime = () => hanliRuntime.stop();
  requestHanliSemanticRefresh = () => hanliRuntime.refreshSemanticMemory();
  // 总运行时组合南宫婉、韩立、共享专题状态和协作任务，是人物演化流程入口。
  personaEvolution = new PersonaEvolutionRuntime({
    store: evolutionStateStore,
    prompts,
    collaboration,
    hanli: hanliRuntime.facade,
    conversation: {
      // 用户与南宫婉聊天时固定为只读调查；聊天确认不等于工程写入授权。
      send: async (request, context) => nangongCodex!.send(prompts.render("nangong.conversation", {
        recentConversation: context,
        userMessage: request.message,
      }), request.locale, "read-only", mergeWorkspaceState(workspaces.read(), request.workspaceState), await screenshots.resolveAttachmentPaths(request.attachmentIds || []), () => undefined, null),
      // 新聊天只重置人物 Codex 线程，不删除已经持久化的专题事实。
      newChat: () => nangongCodex!.newChat(),
    },
    investigateRevision: async (prompt, workspaceState, locale) => (await nangongDeliberationCodex!.send(prompt, locale, "read-only", mergeWorkspaceState(workspaces.read(), workspaceState), [], () => undefined, null)).text,
    planDistribution: async (prompt, workspaceState, locale, emit) => (await nangongDistributionCodex!.send(prompt, locale, "read-only", mergeWorkspaceState(workspaces.read(), workspaceState), [], emit, null)).text,
    refreshSemanticMemory: () => requestHanliSemanticRefresh(),
    askHanliDeliberation: async (prompt, state) => (await hanLiCodex!.send(prompt, state.automationContext.locale, "read-only", mergeWorkspaceState(workspaces.read(), state.automationContext.workspaceState!), [], () => undefined, null)).text,
    askNangongDeliberation: async (prompt, state) => (await nangongDeliberationCodex!.send(prompt, state.automationContext.locale, "read-only", mergeWorkspaceState(workspaces.read(), state.automationContext.workspaceState!), [], () => undefined, null)).text,
    readStableUserId: () => rules.activeUserId(),
    readProjectScope: () => {
      const current = workspaces.read();
      return current.roots.find((root) => root.id === current.primaryId)?.path || projectRoot;
    },
    // 内部研讨关联统一业务会话 ID；Codex threadId 只属于平台会话，不再兼作人物会话主键。
    readHanliConversationId: () => collaborationMemory?.readPersonaConversation("han-li").conversationId || null,
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
      // 分发流式文本也属于可审计时间线；写入失败时记录并阻断当前调用。
      try { collaborationTimeline!.appendStream(taskId, memberId, event); }
      catch (error) {
        eventCenter.recordException({ kind: "technical", sourceType: "system", sourceId: "collaboration-timeline", operation: "append_distribution_stream", error, correlationId: taskId });
        throw error;
      }
    } : undefined,
  });
  startHanliInternalDeliberation = async (request) => {
    const state = personaEvolution!.startHanliNangongDeliberation(request.workspaceState, request.locale);
    return { continuous: state.automaticEvolutionEnabled };
  };
  // 三个人物和两个共享模块分别取得受控 Facade；完整运行实例只留在组合根，不再传给 IPC。
  const nangongRuntime = personaEvolution.nangongRuntime;
  // 统一人物会话注册表是 IPC 的唯一入口。人物自己的服务仍可保留专属业务能力，但会话读写必须在这里登记。
  const personaConversations = new PersonaConversationFacade();
  personaConversations.register("han-li", hanliRuntime.facade);
  personaConversations.register("nangong-wan", {
    // 南宫婉页面状态还包含专题信息，这里只抽取统一会话 DTO 交给通用 IPC。
    conversation: () => personaEvolution!.state().conversation,
    sendConversationMessage: async (request) => (await nangongRuntime.facade.sendConversationMessage(request)).conversation,
    newConversation: async () => (await nangongRuntime.facade.newConversation()).conversation,
  });
  // Evolution Facade 面向专题页面，Workflow Facade 面向跨人物调度。
  const evolutionRuntime = createEvolutionRuntime(personaEvolution);
  evolutionRuntime.facade.subscribe((state, reason, topicId, proposalId, previousState) => {
    // 状态变化先同步持久化投影和审计，再计算发给前端的最小增量。
    try { workflowRepository?.syncEvolutionState(state); }
    catch (error) {
      eventCenter.recordException({ kind: "technical", sourceType: "system", sourceId: "collaboration-timeline", operation: "sync_evolution_state", error, correlationId: topicId || proposalId || undefined, details: { reason, topicId, proposalId } });
    }
    eventCenter.recordEvent("nangong.evolution.state_changed", { reason, topicId, proposalId, activeTopicId: state.activeTopicId });
    const workbenchChange = buildEvolutionWorkbenchChange(previousState, state, reason, topicId, proposalId);
    for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) {
      // 一个事件用于局部刷新工作台，另一个保留完整状态供现有页面消费。
      window.webContents.send("desktop:evolution-workbench-changed", workbenchChange);
      window.webContents.send("desktop:evolution-state", { state, reason, topicId, proposalId });
    }
  });
  // 启动时把当前专题快照投影到对话记忆，后续人物才能查到已批准事实。
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
        // 统一测试成功后只发布已提交的源码版本，避免新进程无法证明自己实际装载了哪次修复。
        const runtimeSourceSha = resolveCleanRuntimeSourceSha(projectRoot);
        eventCenter.recordEvent("application.controlled_restart_scheduled", { reason: "linghu_unified_test_completed", executable, runtimeSourceSha });
        app.relaunch({ execPath: executable, args: [`--selplat-root=${projectRoot}`, "--ai-desktop-variant=developer", `--ai-desktop-runtime-sha=${runtimeSourceSha}`] });
        prepareAiMemoryShutdown();
        app.exit(0);
      },
    },
    submitRepairProposal: (request) => personaEvolution!.createLinghuRepairProposal(request),
    readEvolutionState: () => personaEvolution!.state(),
    reviseReturnedProposal: (proposalId) => personaEvolution!.nangongRuntime.facade.investigateAndReviseReturnedProposal(proposalId),
    onStateChanged: (event) => {
      // 令狐状态同步到数据库、审计和全部窗口，保证重启恢复与界面显示一致。
      workflowRepository?.syncLinghuState(event.state);
      eventCenter.recordEvent("linghu.automation.state_changed", { reason: event.reason, enabled: event.state.enabled, cycle: event.state.cycle, module: event.state.currentModule }, event.state.activeTaskId || undefined);
      for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("desktop:linghu-automation-state", event);
    },
  });
  // 业务调用方只持有 Facade；测试清理通过 Runtime 受控能力完成，Store 不离开令狐边界。
  linghuAutomation = linghuRuntime.facade;
  const personaContext = createPersonaApplicationContext({
    personaEvolution,
    hanliRuntime,
    linghuRuntime,
    collaboration,
    collaborationTimeline,
    workflowRepository,
    recordEvent: (type, details, taskId) => eventCenter.recordEvent(type, details, taskId),
  });
  const { personaWorkflowRuntime, personaRegistry } = personaContext;
  workflowSupervisor = personaContext.workflowSupervisor;

  const testDataReset = new TestDataResetService({
    stopWriters: () => {
      workflowSupervisor?.stop();
      workflowSupervisor = null;
      codexAppCorpusWatcher?.stop();
      personaRegistry.stopAll();
      personaWorkflowRuntime.stop();
    },
    resumeWriters: () => {
      codexAppCorpusWatcher?.start();
      personaRegistry.startAll();
      personaWorkflowRuntime.start();
      workflowSupervisor?.start();
    },
    disposeRuntime: () => collaboration!.dispose(),
    cleanupCandidates: () => versionWorkspaces.clearFailedTestReleaseCandidates(releaseBatches.failedCandidateBranches()),
    clearStores: () => {
      dispatch.clear();
      return collaborationStore.clearTestData()
        + evolutionStateStore.clearTestData()
        + linghuRuntime!.clearTestData()
        + (workflowRepository?.clearTestData() || 0);
    },
    assertStoresCleared: () => {
      collaborationStore.assertTestDataCleared();
      evolutionStateStore.assertTestDataCleared();
      linghuRuntime!.assertTestDataCleared();
    },
    detachPersistence: () => {
      eventCenter.attachRepository(null);
      workflowRepository = null;
      closeAiMemoryDatabase();
    },
    scheduleRestart: (exitCode) => {
      app.relaunch({ args: process.argv.slice(1) });
      setTimeout(() => app.exit(exitCode), 180);
    },
  });
  const clearTestData = () => testDataReset.clear();

  // 到这里全部服务已装配完成；IPC 只取得公开 Facade 和必要配置，不取得人物内部 Store。
  registerApplicationIpc({
    // 主聊天及平台能力。
    codex,
    screenshots,
    settings,
    workspaces,
    trustedCommands,
    dispatch,
    // 协作与人物能力。
    collaboration,
    linghuAutomation,
    nangong: nangongRuntime.facade,
    hanli: hanliRuntime.facade,
    personaConversations,
    evolution: evolutionRuntime.facade,
    personaWorkflow: personaWorkflowRuntime.facade,
    // 审计、持久化状态和运行路径。
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
    // 规则查询、测试数据清理和历史语义补齐等专项能力。
    rules,
    prompts,
    clearTestData,
    corpusSemanticBackfillStatus: () => corpusSemanticBackfill?.status() || ({
      // 功能未创建时返回完整失败 DTO，Renderer 无需猜测 null 的含义。
      state: "failed", targetCount: 0, discoveredCount: 0, processedCount: 0, insertedCount: 0,
      failedCount: 1, message: "AI Memory 数据库不可用，无法补齐历史摘要。", startedAt: null, completedAt: null,
    } satisfies CorpusSemanticBackfillStatusOutDto),
    startCorpusSemanticBackfill: (limit?: number) => {
      // 用户主动启动补齐时，数据库不可用属于明确业务失败，不能静默忽略。
      if (!corpusSemanticBackfill) throw new Error("AI Memory 数据库不可用，无法补齐历史摘要。");
      return corpusSemanticBackfill.start(limit);
    },
    prepareForApplicationExit: prepareAiMemoryShutdown,
  });

  // 窗口工厂通过这两个回调报告 Renderer 是否真正加载成功。
  let onRendererReady: (() => void) | undefined;
  let onRendererFailed: ((details: { errorCode: number; errorDescription: string; validatedURL: string }) => void) | undefined = (details) => eventCenter.recordException({
    kind: "technical", sourceType: "system", sourceId: "electron-renderer", operation: "renderer_load", error: new Error(details.errorDescription), details,
  });
  onRendererReady = () => {
    // 新版本页面成功加载后，才确认“发布并重启”闭环健康。
    const confirmedGenerations = collaboration?.confirmPublishedRestart() || [];
    if (confirmedGenerations.length) eventCenter.recordEvent("application.release_restart_healthy", { confirmedGenerations });
  };
  if (healthCheckFile) {
    // 健康检查结果只能写入工程临时材料下的固定目录，防止命令参数任意写文件。
    const safeHealthRoot = path.join(projectPaths.temporaryMaterialsRoot, "候选包健康检查");
    const resolvedHealthFile = path.resolve(healthCheckFile);
    if (!resolvedHealthFile.startsWith(`${path.resolve(safeHealthRoot)}${path.sep}`)) throw new Error("候选包健康检查文件超出工程临时目录。");
    let healthTimeout: NodeJS.Timeout;
    // 无论成功、加载失败或超时，都只写一次 JSON 结果并退出候选进程。
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
      // 加载失败既进入统一异常审计，也进入外部健康检查结果文件。
      eventCenter.recordException({ kind: "technical", sourceType: "system", sourceId: "electron-renderer", operation: "renderer_health_load", error: new Error(details.errorDescription), details });
      finishHealthCheck({ status: "failed", ...details });
    };
    // 页面 15 秒仍未 ready 就判定候选包失败，避免发布流程无限等待。
    healthTimeout = setTimeout(() => finishHealthCheck({ status: "failed", errorDescription: "renderer-timeout" }), 15_000);
  }
  // 真正创建 Electron BrowserWindow；它会使用 preloadPath 并加载 rendererRoot/index.html。
  let mainApplicationWindow: BrowserWindow | null = createMainWindow({ preloadPath, rendererRoot, variant, onRendererReady, onRendererFailed });
  // 窗口关闭后清空引用，否则 activate 会误以为旧窗口仍然可用。
  mainApplicationWindow.once("closed", () => { mainApplicationWindow = null; });
  if (healthCheckFile) {
    // 健康检查只验证页面启动，不启动人物、协作恢复和后台监督任务。
    return;
  }
  // 普通启动在窗口创建完成后恢复持久任务，再启动人物和监督循环。
  collaboration.resumePendingWork();
  personaRegistry.startAll();
  personaWorkflowRuntime.start();
  workflowSupervisor?.start();
  // macOS 点击 Dock 图标会触发 activate：已有窗口则聚焦，没有窗口则重新创建。
  app.on("activate", () => {
    if (mainApplicationWindow && !mainApplicationWindow.isDestroyed()) {
      mainApplicationWindow.show();
      mainApplicationWindow.focus();
      return;
    }
    mainApplicationWindow = createMainWindow({ preloadPath, rendererRoot, variant, onRendererFailed });
    mainApplicationWindow.once("closed", () => { mainApplicationWindow = null; });
  });
}

/** 发布包只能绑定当前干净工作区的 HEAD；存在未提交修改时停止重启，防止再次形成无归属版本。 */
function resolveCleanRuntimeSourceSha(projectRoot: string): string {
  const environment = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  const status = execFileSync("git", ["status", "--porcelain"], { cwd: projectRoot, encoding: "utf8", env: environment }).trim();
  if (status) throw new Error("统一测试已通过，但源码尚未提交；为避免工作区不干净，已停止发布重启。");
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectRoot, encoding: "utf8", env: environment }).trim();
  if (!/^[0-9a-f]{40,64}$/.test(sha)) throw new Error("无法取得已提交源码版本，已停止发布重启。");
  return sha;
}

/** 把启动失败送入统一事件中心。 */
export function reportStartupFailure(error: unknown): void {
  eventCenter.recordException({ kind: "technical", sourceType: "launcher", sourceId: "electron-main", operation: "application_ready", error, severity: "critical" });
}

/** 统一停止人物、协作、Codex 和持久化资源；可被退出与受控重启共同调用。 */
export function disposeApplication(): void {
  linghuAutomation?.stop();
  personaEvolution?.stop();
  void collaboration?.dispose().catch((error) => eventCenter.recordException({ kind: "technical", sourceType: "launcher", sourceId: "collaboration", operation: "dispose", error }));
  // 每个独立 Codex 实例都可能持有 app-server 子进程，需要分别释放。
  codex?.dispose();
  nangongCodex?.dispose();
  hanLiCodex?.dispose();
  // 南宫婉研讨与分发引用同一服务，不重复关闭。
  corpusSemanticBackfillCodex?.dispose();
  prepareAiMemoryShutdown();
}
