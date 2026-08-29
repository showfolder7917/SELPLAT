import { execFile } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { app, BrowserWindow, desktopCapturer, ipcMain, nativeImage, screen, shell, systemPreferences } from "electron";

import { LOCALES, SANDBOX_MODES } from "../../contracts/desktop/desktop.js";
import type {
  AiMemoryDatabaseStatus,
  AppVariant,
  EnqueueMessageRequest,
  ManagedExecutionMode,
  ScreenCaptureFrameRequest,
  ScreenCaptureFrameResult,
  ScreenCapturePreparationResult,
  ScreenCaptureRequest,
  ScreenshotAnnotationWindowRequest,
  ScreenshotSaveRequest,
  SendMessageRequest,
  WindowAction,
  TestDataResetResult,
  CorpusSemanticBackfillStatus,
  EvolutionWorkspaceLocation,
} from "../../contracts/desktop/desktop.js";
import { registerCollaborationIpc } from "./domains/register-collaboration-ipc.js";
import { registerSettingsIpc } from "./domains/register-settings-ipc.js";
import { registerWorkspaceIpc } from "./domains/register-workspace-ipc.js";
import { registerRulesIpc } from "./domains/register-rules-ipc.js";
import { registerCodexIpc } from "./domains/register-codex-ipc.js";
import { registerSystemIpc } from "./domains/register-system-ipc.js";
import { registerEventCenterIpcHandler } from "./event-center-ipc.js";
import { CodexService } from "../services/codex-service.js";
import { ConversationDispatchStore } from "../services/conversation-dispatch-store.js";
import { CollaborationCodexRegistry } from "../services/collaboration/collaboration-codex-sessions.js";
import { CollaborationCoordinator } from "../services/collaboration/collaboration-coordinator.js";
import { LinghuAutomationFacade } from "../services/collaboration/linghu-automation-facade.js";
import { HanLiRealAppAcceptanceExecutor } from "../services/collaboration/hanli-real-app-acceptance-executor.js";
import { NangongEvolutionFacade } from "../services/collaboration/nangong-evolution-facade.js";
import { ManagedTaskExecutor } from "../services/managed-task-executor.js";
import { ScreenshotStore } from "../services/screenshot-store.js";
import { SettingsStore } from "../services/settings-store.js";
import { TrustedCommandStore } from "../services/trusted-command-store.js";
import { EventCenterFacade } from "../services/event-center/event-center-facade.js";
import type { WorkflowRepository } from "../services/event-center/workflow-repository.js";
import { WorkspaceStore } from "../services/workspace-store.js";
import { RuleBundleService } from "../services/rules/rule-bundle-service.js";

interface DesktopIpcDependencies {
  aiMemoryDatabaseStatus: AiMemoryDatabaseStatus;
  codex: CodexService;
  screenshots: ScreenshotStore;
  settings: SettingsStore;
  workspaces: WorkspaceStore;
  trustedCommands: TrustedCommandStore;
  dispatch: ConversationDispatchStore;
  collaboration: CollaborationCoordinator;
  linghuAutomation: LinghuAutomationFacade;
  nangongEvolution: NangongEvolutionFacade;
  collaborationRegistry: CollaborationCodexRegistry;
  eventCenter: EventCenterFacade;
  workflowRepository: WorkflowRepository | null;
  projectRoot: string;
  appRoot: string;
  variant: AppVariant;
  preloadPath: string;
  prepareForApplicationExit: () => void;
  rendererRoot: string;
  rules: RuleBundleService;
  clearTestData: () => Promise<TestDataResetResult>;
  corpusSemanticBackfillStatus: () => CorpusSemanticBackfillStatus;
  startCorpusSemanticBackfill: (limit?: number) => CorpusSemanticBackfillStatus;
}

interface ScreenshotWindowSession {
  active: boolean;
  attemptId: number;
  captureReady: boolean;
  displayId: string;
  frameRequestId: number;
  rejectFrameReady?(error: Error): void;
  resolveFrameReady?(): void;
  ownerWebContentsId: number;
  rendererReady: Promise<void>;
  resolveRendererReady(): void;
  selectionBounds: { x: number; y: number; width: number; height: number };
  restoreOwnerOnClose: boolean;
}

const screenshotWindowSessions = new Map<number, ScreenshotWindowSession>();
const execFileAsync = promisify(execFile);

type ScreenCaptureFailureReason = Extract<ScreenCapturePreparationResult, { status: "blocked" }>["reason"];

class ScreenCapturePreparationError extends Error {
  constructor(readonly reason: ScreenCaptureFailureReason) {
    super(reason === "permission-required"
      ? "无法截取屏幕，请先允许 AI Desktop 使用屏幕录制权限，返回应用后重试。"
      : "无法读取屏幕来源，请检查屏幕录制权限后重试。");
  }
}

/** 为原生截图、隐藏渲染器和视频流握手提供硬退出，避免渲染层按钮永久停在执行状态。 */
async function waitForScreenCaptureStage<T>(operation: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    operation,
    new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    }),
  ]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

/** 将 Renderer 请求限制为可写入窗口地址的稳定工作台位置；旧的字符串视角请求直接拒绝，不保留兼容分支。 */
function normalizeEvolutionWorkspaceLocation(value: unknown): EvolutionWorkspaceLocation {
  if (!value || typeof value !== "object") throw new Error("专题演化工作台必须提供完整位置对象。");
  const request = value as Partial<EvolutionWorkspaceLocation>;
  if (request.perspective !== "nangong" && request.perspective !== "hanli") throw new Error("无效的专题演化工作台视角。");
  const text = (candidate: unknown, maximum: number): string => typeof candidate === "string" ? candidate.trim().slice(0, maximum) : "";
  const pageSize = Number(request.pageSize);
  return {
    perspective: request.perspective,
    nodeId: text(request.nodeId, 100) || null,
    page: Math.max(1, Math.floor(Number(request.page) || 1)),
    pageSize: [20, 50, 100].includes(pageSize) ? pageSize : 20,
    keyword: text(request.keyword, 120),
    status: text(request.status, 80),
    selectedRowId: text(request.selectedRowId, 200) || null,
  };
}

/** 将完整位置写入独立窗口查询参数，便于复制地址、重启恢复和真实界面验收。 */
function evolutionWorkspaceLocationQuery(location: EvolutionWorkspaceLocation): Record<string, string> {
  return {
    mode: "evolution-workspace",
    perspective: location.perspective,
    node: location.nodeId || "",
    page: String(location.page),
    pageSize: String(location.pageSize),
    keyword: location.keyword,
    status: location.status,
    selected: location.selectedRowId || "",
  };
}

export function registerDesktopIpc(dependencies: DesktopIpcDependencies): void {
  const { aiMemoryDatabaseStatus, codex, screenshots, settings, workspaces, trustedCommands, dispatch, collaboration, linghuAutomation, nangongEvolution, collaborationRegistry, eventCenter, workflowRepository, projectRoot, appRoot, variant, preloadPath, prepareForApplicationExit, rendererRoot, rules } = dependencies;
  const audit = eventCenter;
  const handle = <Arguments extends unknown[]>(channel: string, handler: Parameters<typeof registerEventCenterIpcHandler<Arguments>>[2], boundary: "business" | "technical" | "auto" = "auto"): void => registerEventCenterIpcHandler(eventCenter, channel, handler, boundary);
  const activeAuditTasks = new Map<number, string>();
  const managedExecutor = new ManagedTaskExecutor();
  const acceptanceExecutor = new HanLiRealAppAcceptanceExecutor(screenshots);
  let screenCaptureAttemptId = 0;
  let evolutionWorkspaceWindow: BrowserWindow | null = null;
  let evolutionWorkspaceLocation: EvolutionWorkspaceLocation = { perspective: "nangong", nodeId: null, page: 1, pageSize: 20, keyword: "", status: "", selectedRowId: null };

  registerRulesIpc(rules, eventCenter);

  const publishDispatchState = () => {
    const state = dispatch.state();
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send("desktop:conversation-dispatch-state", state);
    }
    return state;
  };

  handle("desktop:open-evolution-workspace", async (_event, requestedLocation: unknown) => {
    const location = normalizeEvolutionWorkspaceLocation(requestedLocation);
    evolutionWorkspaceLocation = location;
    if (evolutionWorkspaceWindow && !evolutionWorkspaceWindow.isDestroyed()) {
      evolutionWorkspaceWindow.webContents.send("desktop:evolution-workspace-location", location);
      if (evolutionWorkspaceWindow.isMinimized()) evolutionWorkspaceWindow.restore();
      evolutionWorkspaceWindow.show();
      evolutionWorkspaceWindow.focus();
      audit.recordEvent("evolution.workspace.focused", { ...location });
      return;
    }
    evolutionWorkspaceWindow = new BrowserWindow({
      width: 1320,
      height: 880,
      minWidth: 980,
      minHeight: 680,
      frame: false,
      show: false,
      backgroundColor: "#080b12",
      title: "AI Desktop · 专题演化工作台",
      webPreferences: { preload: preloadPath, contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    evolutionWorkspaceWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    evolutionWorkspaceWindow.once("ready-to-show", () => {
      evolutionWorkspaceWindow?.show();
      evolutionWorkspaceWindow?.focus();
    });
    evolutionWorkspaceWindow.once("closed", () => {
      evolutionWorkspaceWindow = null;
      audit.recordEvent("evolution.workspace.closed", { ...evolutionWorkspaceLocation });
    });
    const target = path.join(rendererRoot, "index.html");
    await evolutionWorkspaceWindow.loadFile(target, { query: evolutionWorkspaceLocationQuery(location) });
    audit.recordEvent("evolution.workspace.opened", { ...location });
  });

  handle("desktop:execute-han-li-acceptance-plan", async (_event, planId: string) => {
    if (!evolutionWorkspaceWindow || evolutionWorkspaceWindow.isDestroyed()) throw new Error("请先打开专题演化工作台，再执行韩立真实界面验收。 ");
    const plan = nangongEvolution.acceptancePlan(planId);
    const run = await acceptanceExecutor.execute(plan, evolutionWorkspaceWindow);
    nangongEvolution.recordAcceptanceRun(run);
    audit.recordEvent("hanli.acceptance.real_app_checked", { runId: run.runId, planId, topicId: run.topicId, proposalId: run.proposalId, status: run.status, evidenceCount: run.evidenceAttachmentIds.length });
    return run;
  });

  const recordScreenCaptureStage = (
    stage: string,
    screenshotSession?: ScreenshotWindowSession,
    details: Record<string, unknown> = {},
  ) => audit.recordEvent("screen_capture.stage", {
    attemptId: screenshotSession?.attemptId ?? null,
    stage,
    ...details,
  });

  const getScreenCaptureAccessStatus = () => process.platform === "darwin"
    ? systemPreferences.getMediaAccessStatus("screen")
    : "granted";

  const toScreenCapturePreparationResult = (error: unknown): ScreenCapturePreparationResult => ({
    status: "blocked",
    reason: error instanceof ScreenCapturePreparationError ? error.reason : "source-unavailable",
    canOpenSettings: process.platform === "darwin",
  });

  const resolveScreenCaptureSource = async (
    display: Electron.Display,
    thumbnailSize: Electron.Size = { width: 0, height: 0 },
  ): Promise<Electron.DesktopCapturerSource> => {
    const displayKey = String(display.id);
    // 系统权限状态可能在用户刚从设置页返回时仍是旧值；始终以一次真实源枚举作为最终判断，
    // 枚举失败后再读取权限状态并转换为业务错误，既避免假阴性，也不向渲染层泄露 Electron 原始异常。
    let sources: Electron.DesktopCapturerSource[];
    try {
      sources = await desktopCapturer.getSources({
        types: ["screen"],
        // 预检传入 0×0 只确认目标显示器可枚举；Windows 正式取帧传入显示器物理像素尺寸。
        thumbnailSize,
        fetchWindowIcons: false,
      });
    } catch {
      // 首次请求可能在系统提示后被拒绝；再次读取状态才能给出准确且可恢复的业务提示。
      const currentAccessStatus = getScreenCaptureAccessStatus();
      if (currentAccessStatus === "denied" || currentAccessStatus === "restricted" || currentAccessStatus === "not-determined") {
        throw new ScreenCapturePreparationError("permission-required");
      }
      throw new ScreenCapturePreparationError("source-unavailable");
    }
    if (sources.length === 0) throw new ScreenCapturePreparationError("source-unavailable");
    return sources.find((item) => item.display_id === displayKey) || sources[0];
  };

  /** 调用 macOS 自带非交互截图；不传 -C，因此系统鼠标指针不会写入 PNG。 */
  const captureNativeMacScreen = async (
    display: Electron.Display,
    attemptId: number,
  ): Promise<ScreenCaptureFrameRequest["capture"]> => {
    if (process.platform !== "darwin") throw new Error("当前无光标截图后端仅支持 macOS。");
    const tempRoot = await screenshots.ensure();
    // screencapture 会拒绝点号开头的目标文件且仍可能返回退出码 0，因此必须使用普通文件名并随后真实读取校验。
    const scratchPath = path.join(tempRoot, `native-screen-${process.pid}-${attemptId}.png`);
    const displays = screen.getAllDisplays();
    const displayNumber = Math.max(1, displays.findIndex((candidate) => candidate.id === display.id) + 1);
    try {
      await execFileAsync("/usr/sbin/screencapture", ["-x", "-t", "png", "-D", String(displayNumber), scratchPath], {
        timeout: 8_000,
        maxBuffer: 1024 * 1024,
      });
      const png = await readFile(scratchPath);
      const image = nativeImage.createFromBuffer(png);
      const size = image.getSize();
      if (image.isEmpty() || size.width < 1 || size.height < 1) throw new Error("macOS 返回了空截图。");
      return { dataUrl: `data:image/png;base64,${png.toString("base64")}`, width: size.width, height: size.height };
    } finally {
      await unlink(scratchPath).catch(() => {});
    }
  };

  /** Windows 通过 Electron 的显示器源取得一次 PNG；后续框选、标注和保存继续复用统一截图窗口。 */
  const captureNativeWindowsScreen = async (
    display: Electron.Display,
  ): Promise<ScreenCaptureFrameRequest["capture"]> => {
    if (process.platform !== "win32") throw new Error("Windows 截图后端只能在 Windows 使用。");
    const thumbnailSize = {
      width: Math.max(1, Math.round(display.size.width * display.scaleFactor)),
      height: Math.max(1, Math.round(display.size.height * display.scaleFactor)),
    };
    const source = await resolveScreenCaptureSource(display, thumbnailSize);
    const image = source.thumbnail;
    const size = image.getSize();
    if (image.isEmpty() || size.width < 1 || size.height < 1) throw new Error("Windows 返回了空截图。");
    return { dataUrl: image.toDataURL(), width: size.width, height: size.height };
  };

  /** 平台差异只收敛在取帧适配器；渲染层和截图编辑流程不建立操作系统分支。 */
  const captureNativeScreen = async (
    display: Electron.Display,
    attemptId: number,
  ): Promise<ScreenCaptureFrameRequest["capture"]> => {
    if (process.platform === "darwin") return captureNativeMacScreen(display, attemptId);
    if (process.platform === "win32") return captureNativeWindowsScreen(display);
    throw new Error(`当前平台暂不支持截图：${process.platform}`);
  };

  const parkScreenshotWindow = (screenshotWindow: BrowserWindow, session: ScreenshotWindowSession): void => {
    // 空闲截图窗口收缩为 1×1 且鼠标穿透，避免残留编辑窗或抢占焦点。
    screenshotWindow.setOpacity(0);
    screenshotWindow.setIgnoreMouseEvents(true);
    if (process.platform === "darwin" && screenshotWindow.isSimpleFullScreen()) screenshotWindow.setSimpleFullScreen(false);
    screenshotWindow.setAlwaysOnTop(false);
    screenshotWindow.setVisibleOnAllWorkspaces(false);
    screenshotWindow.setMinimumSize(1, 1);
    screenshotWindow.setResizable(false);
    screenshotWindow.setSkipTaskbar(true);
    screenshotWindow.setBounds({ x: session.selectionBounds.x, y: session.selectionBounds.y, width: 1, height: 1 }, false);
    screenshotWindow.showInactive();
  };

  registerSystemIpc({
    aiMemoryDatabaseStatus, projectRoot, variant, screenshots, workflowRepository, eventCenter,
    clearTestData: dependencies.clearTestData,
    corpusSemanticBackfillStatus: dependencies.corpusSemanticBackfillStatus,
    startCorpusSemanticBackfill: dependencies.startCorpusSemanticBackfill,
  });
  registerSettingsIpc(settings, eventCenter);
  registerWorkspaceIpc(workspaces, eventCenter);
  registerCollaborationIpc(collaboration, linghuAutomation, nangongEvolution, eventCenter);
  registerCodexIpc({ appRoot, codex, collaborationRegistry, trustedCommands, settings, workspaces, dispatch, workflowRepository, eventCenter, activeAuditTasks, publishDispatchState });
  handle("desktop:prepare-screen-capture", async (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    const display = parent ? screen.getDisplayMatching(parent.getBounds()) : screen.getPrimaryDisplay();
    // 两个截图入口统一预热同一个显示器源；本次进程内再次调用直接命中缓存。
    try {
      recordScreenCaptureStage("main-source-preflight-started", undefined, { displayId: String(display.id) });
      await waitForScreenCaptureStage(resolveScreenCaptureSource(display), 8_000, "读取屏幕来源超时，请重试。");
      recordScreenCaptureStage("main-source-preflight-ready", undefined, { displayId: String(display.id) });
      return { status: "ready" } satisfies ScreenCapturePreparationResult;
    } catch (error) {
      recordScreenCaptureStage("main-source-preflight-failed", undefined, {
        displayId: String(display.id),
        error: error instanceof Error ? error.message : "source-unavailable",
      });
      return toScreenCapturePreparationResult(error);
    }
  });
  handle("desktop:open-screen-recording-settings", async () => {
    if (process.platform !== "darwin") throw new Error("Screen recording settings are only available on macOS.");
    // 固定打开 macOS 屏幕录制隐私页，不接受渲染层提供的任意系统设置地址。
    await shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
  });
  handle("desktop:restart-for-screen-recording-permission", async () => {
    if (process.platform !== "darwin") throw new Error("Screen recording permission restart is only available on macOS.");
    recordScreenCaptureStage("main-permission-restart-requested");
    // 只响应渲染层明确的权限恢复按钮；先让 IPC 正常返回，再由 Electron 使用同一应用身份重建进程。
    setTimeout(() => {
      app.relaunch();
      prepareForApplicationExit();
      app.exit(0);
    }, 120);
  });
  handle("desktop:capture-screen", async (event, request?: ScreenCaptureRequest) => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    if (request && typeof request.hideOwnerWindow !== "undefined" && typeof request.hideOwnerWindow !== "boolean") {
      throw new Error("Invalid screenshot capture mode.");
    }
    const display = parent ? screen.getDisplayMatching(parent.getBounds()) : screen.getPrimaryDisplay();
    const hideOwnerWindow = request?.hideOwnerWindow === true;
    if (!parent) throw new Error("无法识别截图发起窗口。");
    const attemptId = ++screenCaptureAttemptId;
    let screenshotWindow = BrowserWindow.getAllWindows().find((window) =>
      screenshotWindowSessions.get(window.webContents.id)?.ownerWebContentsId === parent.webContents.id,
    );
    let session = screenshotWindow && screenshotWindowSessions.get(screenshotWindow.webContents.id);
    if (session?.active) {
      recordScreenCaptureStage("main-capture-already-active", session);
      screenshotWindow?.show();
      screenshotWindow?.focus();
      return null;
    }
    if (!screenshotWindow || !session) {
      // 第一次建立可长期复用的隐藏截图壳；后续截图不再重建 BrowserWindow、React、CSS 和蒙版资源。
      screenshotWindow = new BrowserWindow({
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
        frame: false,
        show: false,
        opacity: 0,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        hasShadow: false,
        backgroundColor: "#000000",
        webPreferences: {
          preload: preloadPath,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          // 常驻截图壳隐藏缓存期间仍需完成更新后的两帧绘制确认，否则 Electron 会节流 rAF 导致第二次截图无法显示。
          backgroundThrottling: false,
        },
      });
      const screenshotWebContentsId = screenshotWindow.webContents.id;
      let resolveRendererReady: () => void = () => {};
      const rendererReady = new Promise<void>((resolve) => { resolveRendererReady = resolve; });
      session = {
        active: true,
        attemptId,
        captureReady: false,
        displayId: String(display.id),
        frameRequestId: 0,
        ownerWebContentsId: parent.webContents.id,
        rendererReady,
        resolveRendererReady,
        selectionBounds: { ...display.bounds },
        restoreOwnerOnClose: hideOwnerWindow,
      };
      screenshotWindowSessions.set(screenshotWebContentsId, session);
      recordScreenCaptureStage("main-screenshot-shell-created", session, { screenshotWebContentsId, displayId: String(display.id) });
      screenshotWindow.once("closed", () => {
        const closingSession = screenshotWindowSessions.get(screenshotWebContentsId);
        screenshotWindowSessions.delete(screenshotWebContentsId);
        if (!closingSession?.restoreOwnerOnClose) return;
        const owner = BrowserWindow.getAllWindows().find((window) => window.webContents.id === closingSession.ownerWebContentsId);
        if (owner && !owner.isDestroyed()) { owner.show(); owner.focus(); }
      });
      parent.once("closed", () => {
        if (screenshotWindow && !screenshotWindow.isDestroyed()) screenshotWindow.close();
      });
      await screenshotWindow.loadFile(path.join(rendererRoot, "index.html"), { query: { mode: "screenshot" } }).catch((error) => {
        screenshotWindow?.close();
        throw error;
      });
    } else {
      // 复用已加载截图壳时只重置本轮状态，禁止把上一轮选区或红色标注带入新截图。
      session.active = true;
      session.attemptId = attemptId;
      session.captureReady = false;
      session.selectionBounds = { ...display.bounds };
      session.restoreOwnerOnClose = hideOwnerWindow;
      screenshotWindow.webContents.send("desktop:screen-capture-reset");
      session.displayId = String(display.id);
    }
    if (screenshotWindow.isMaximized()) screenshotWindow.unmaximize();
    if (process.platform === "darwin" && screenshotWindow.isSimpleFullScreen()) screenshotWindow.setSimpleFullScreen(false);
    screenshotWindow.setMinimumSize(1, 1);
    screenshotWindow.setResizable(false);
    screenshotWindow.setMovable(false);
    screenshotWindow.setMaximizable(false);
    screenshotWindow.setFullScreenable(false);
    screenshotWindow.setSkipTaskbar(true);
    screenshotWindow.setHasShadow(false);
    screenshotWindow.setBounds(display.bounds, false);
    screenshotWindow.setAlwaysOnTop(true, "screen-saver");
    screenshotWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    try {
      await waitForScreenCaptureStage(session.rendererReady, 5_000, "截图窗口初始化超时，请重试。");
      recordScreenCaptureStage("main-renderer-ready", session);
      screenshotWindow.setOpacity(0);
      screenshotWindow.setIgnoreMouseEvents(true);
      if (!screenshotWindow.isVisible()) screenshotWindow.showInactive();
    } catch (error) {
      recordScreenCaptureStage("main-renderer-failed", session, {
        error: error instanceof Error ? error.message : "renderer-unavailable",
      });
      // 初始化失败的截图壳不可复用；立即关闭并让下一次点击建立全新窗口。
      session.active = false;
      session.restoreOwnerOnClose = false;
      if (!screenshotWindow.isDestroyed()) screenshotWindow.close();
      if (hideOwnerWindow && !parent.isDestroyed()) parent.show();
      if (!parent.isDestroyed()) { parent.moveTop(); parent.focus(); }
      throw error;
    }
    if (hideOwnerWindow) {
      // 截图壳和蒙版资源全部就绪后才隐藏主窗口。
      parent.hide();
    }
    const requestId = ++session.frameRequestId;
    const frameReady = new Promise<void>((resolve, reject) => {
      session.resolveFrameReady = resolve;
      session.rejectFrameReady = reject;
    });
    try {
      // Computer Use 等自动化工具会把点击指针实现为普通置顶窗口；两个平台都等待短暂覆盖层消退后再冻结桌面。
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      recordScreenCaptureStage("main-automation-pointer-overlay-settled", session, { waitMs: 1_200 });
      const captureBackend = process.platform === "darwin" ? "macos-screencapture" : process.platform === "win32" ? "windows-desktop-capturer" : "unsupported";
      recordScreenCaptureStage("main-native-screen-capture-requested", session, { requestId, hideOwnerWindow, captureBackend });
      const capture = await waitForScreenCaptureStage(
        captureNativeScreen(display, attemptId),
        10_000,
        "系统截图超时，请重试。",
      );
      recordScreenCaptureStage("main-native-screen-capture-ready", session, {
        requestId,
        captureBackend,
        width: capture.width,
        height: capture.height,
      });
      screenshotWindow.webContents.send("desktop:screen-capture-frame-requested", { requestId, capture } satisfies ScreenCaptureFrameRequest);
      recordScreenCaptureStage("main-native-frame-sent", session, { requestId });
      let timeout: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        frameReady,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error("等待屏幕画面超时，请重试。")), 5_000);
        }),
      ]).finally(() => {
        if (timeout) clearTimeout(timeout);
      });
    } catch (error) {
      recordScreenCaptureStage("main-frame-failed", session, {
        requestId,
        error: error instanceof Error ? error.message : "frame-unavailable",
      });
      session.active = false;
      session.restoreOwnerOnClose = false;
      // 原生截图或帧确认失败时丢弃缓存壳，避免下一次复用坏会话。
      if (!screenshotWindow.isDestroyed()) screenshotWindow.close();
      if (hideOwnerWindow && !parent.isDestroyed()) parent.show();
      if (!parent.isDestroyed()) { parent.moveTop(); parent.focus(); }
      throw error;
    } finally {
      session.resolveFrameReady = undefined;
      session.rejectFrameReady = undefined;
    }
    return null;
  });
  handle("desktop:screen-capture-stage", (event, stage: string, detail?: string) => {
    const session = screenshotWindowSessions.get(event.sender.id);
    if (!session || typeof stage !== "string" || !/^renderer-[a-z-]{1,80}$/.test(stage)) {
      throw new Error("Invalid screenshot diagnostic stage.");
    }
    if (typeof detail !== "undefined" && (typeof detail !== "string" || detail.length > 256)) {
      throw new Error("Invalid screenshot diagnostic detail.");
    }
    recordScreenCaptureStage(stage, session, typeof detail === "string" ? { detail } : {});
  });
  handle("desktop:screen-capture-frame-result", (event, result: ScreenCaptureFrameResult) => {
    const session = screenshotWindowSessions.get(event.sender.id);
    if (!session || !result || !Number.isSafeInteger(result.requestId) || result.requestId !== session.frameRequestId) {
      throw new Error("Invalid screenshot frame result.");
    }
    if (result.error) {
      recordScreenCaptureStage("renderer-frame-result-failed", session, { requestId: result.requestId, error: result.error });
      session.rejectFrameReady?.(new Error(result.error));
      return;
    }
    if (!Number.isFinite(result.width) || !Number.isFinite(result.height) || result.width < 1 || result.height < 1) {
      session.rejectFrameReady?.(new Error("截图画面尺寸无效。"));
      return;
    }
    session.captureReady = true;
    recordScreenCaptureStage("renderer-frame-result-ready", session, {
      requestId: result.requestId,
      width: result.width,
      height: result.height,
    });
    session.resolveFrameReady?.();
  });
  handle("desktop:show-screenshot-window", (event) => {
    const session = screenshotWindowSessions.get(event.sender.id);
    if (!session) throw new Error("Invalid screenshot window.");
    const screenshotWindow = BrowserWindow.fromWebContents(event.sender);
    if (!screenshotWindow) throw new Error("Screenshot window is unavailable.");
    // 第一次调用只确认后台截图界面已经完成绘制；隐藏模式取得主窗口后方画面前禁止提前显示。
    session.resolveRendererReady();
    if (!session.active || !session.captureReady) return;
    // macOS 普通无边框窗口仍会避让菜单栏和 Dock；透明状态下进入无动画简单全屏，再显示完整蒙版。
    if (process.platform === "darwin" && !screenshotWindow.isSimpleFullScreen()) {
      screenshotWindow.setFullScreenable(true);
      screenshotWindow.setSimpleFullScreen(true);
    }
    // 冻结画面和蒙版完成两帧渲染后才恢复不透明，避免加载背景或全屏切换产生瞬时黑屏。
    screenshotWindow.setOpacity(1);
    screenshotWindow.setIgnoreMouseEvents(false);
    screenshotWindow.show();
    screenshotWindow.focus();
  });
  handle("desktop:enter-screenshot-annotation", (event, request: ScreenshotAnnotationWindowRequest) => {
    if (!screenshotWindowSessions.has(event.sender.id)) throw new Error("Invalid screenshot window.");
    const screenshotWindow = BrowserWindow.fromWebContents(event.sender);
    if (!screenshotWindow) throw new Error("Screenshot window is unavailable.");
    if (!request || !Number.isFinite(request.width) || !Number.isFinite(request.height) || request.width < 1 || request.height < 1) {
      throw new Error("Invalid screenshot annotation size.");
    }
    const display = screen.getDisplayMatching(screenshotWindow.getBounds());
    const workArea = display.workArea;
    const chromeHeight = 134;
    const maximumCanvasWidth = workArea.width;
    const maximumCanvasHeight = Math.max(1, workArea.height - chromeHeight);
    // 默认按截图原始像素 1:1 展示；只有图片超出当前屏幕可用区域时才按同一比例整体缩小。
    const imageScale = Math.min(1, maximumCanvasWidth / request.width, maximumCanvasHeight / request.height);
    const canvasWidth = Math.max(1, Math.round(request.width * imageScale));
    const canvasHeight = Math.max(1, Math.round(request.height * imageScale));
    const width = Math.max(520, canvasWidth);
    const height = Math.max(340, canvasHeight + chromeHeight);
    const x = workArea.x + Math.round((workArea.width - width) / 2);
    const y = workArea.y + Math.round((workArea.height - height) / 2);

    // 框选完成后透明退出简单全屏，再转为可移动、可缩放的普通标注窗口；主编辑器窗口始终不变。
    screenshotWindow.setOpacity(0);
    if (process.platform === "darwin" && screenshotWindow.isSimpleFullScreen()) screenshotWindow.setSimpleFullScreen(false);
    screenshotWindow.setAlwaysOnTop(false);
    screenshotWindow.setVisibleOnAllWorkspaces(false);
    screenshotWindow.setMinimumSize(520, 340);
    screenshotWindow.setResizable(true);
    screenshotWindow.setMovable(true);
    screenshotWindow.setMaximizable(true);
    screenshotWindow.setFullScreenable(true);
    screenshotWindow.setSkipTaskbar(false);
    screenshotWindow.setHasShadow(true);
    screenshotWindow.setBounds({ x, y, width, height }, false);
    screenshotWindow.setOpacity(1);
    screenshotWindow.focus();
  });
  handle("desktop:return-screenshot-selection", (event) => {
    const session = screenshotWindowSessions.get(event.sender.id);
    const screenshotWindow = BrowserWindow.fromWebContents(event.sender);
    if (!session || !screenshotWindow) throw new Error("Invalid screenshot window.");

    // 返回重新框选时恢复最初显示器的全屏冻结蒙版，不重新抓屏，也不改变主编辑器窗口。
    screenshotWindow.setOpacity(0);
    if (screenshotWindow.isMaximized()) screenshotWindow.unmaximize();
    screenshotWindow.setMinimumSize(1, 1);
    screenshotWindow.setResizable(false);
    screenshotWindow.setMovable(false);
    screenshotWindow.setMaximizable(false);
    screenshotWindow.setFullScreenable(false);
    screenshotWindow.setSkipTaskbar(true);
    screenshotWindow.setHasShadow(false);
    screenshotWindow.setBounds(session.selectionBounds, false);
    screenshotWindow.setAlwaysOnTop(true, "screen-saver");
    screenshotWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    if (process.platform === "darwin" && !screenshotWindow.isSimpleFullScreen()) {
      screenshotWindow.setFullScreenable(true);
      screenshotWindow.setSimpleFullScreen(true);
    }
    screenshotWindow.setOpacity(1);
    screenshotWindow.setIgnoreMouseEvents(false);
    screenshotWindow.show();
    screenshotWindow.focus();
  });
  handle("desktop:end-screenshot-editing", (event) => {
    const session = screenshotWindowSessions.get(event.sender.id);
    const screenshotWindow = BrowserWindow.fromWebContents(event.sender);
    if (!session || !screenshotWindow) return;
    // macOS 必须先恢复主窗口再隐藏常驻截图壳，避免瞬间没有可见窗口后应用无法重新激活。
    const owner = BrowserWindow.getAllWindows().find((window) => window.webContents.id === session.ownerWebContentsId);
    if (session.restoreOwnerOnClose) {
      if (owner && !owner.isDestroyed()) owner.showInactive();
    }
    // 完成或取消后转为零透明、鼠标穿透状态；保持窗口的视频流活跃，供下一次两个截图入口直接复用。
    parkScreenshotWindow(screenshotWindow, session);
    if (owner && !owner.isDestroyed()) { owner.show(); owner.moveTop(); owner.focus(); }
    session.active = false;
    session.captureReady = false;
    session.restoreOwnerOnClose = false;
    screenshotWindow.webContents.send("desktop:screen-capture-reset");
  });
  handle("desktop:save-screenshot", async (event, request: ScreenshotSaveRequest) => {
    const saved = await screenshots.save(request);
    const session = screenshotWindowSessions.get(event.sender.id);
    if (session) {
      const owner = BrowserWindow.getAllWindows().find((window) => window.webContents.id === session.ownerWebContentsId);
      if (owner && !owner.isDestroyed()) {
        owner.webContents.send("desktop:screenshot-completed", {
          attachment: saved,
          dataUrl: request.annotatedDataUrl,
          hasAnnotations: request.hasAnnotations === true,
        });
      }
    }
    return saved;
  });
  handle("desktop:get-conversation-dispatch-state", () => dispatch.state());
  handle("desktop:enqueue-message", (_event, value: EnqueueMessageRequest) => {
    if (!value?.request || typeof value.request.message !== "string") throw new Error("Invalid queued message request.");
    dispatch.enqueue(value.request, value.displayText, value.automatic === true);
    return publishDispatchState();
  });
  handle("desktop:supplement-queued-message", async (_event, itemId: string) => {
    const item = dispatch.queueItem(itemId);
    if (!item) throw new Error("排队消息已被处理或不存在。");
    const active = dispatch.state().activeTask;
    if (!active || active.status !== "running") throw new Error("当前没有正在执行、可以接收补充的任务。");
    const attachmentPaths = await screenshots.resolveAttachmentPaths(item.request.attachmentIds || []);
    await codex.steer(item.request.message, attachmentPaths);
    dispatch.removeQueued(itemId, "supplemented");
    audit.recordEvent("task.supplement_delivered", {
      dispatchId: item.id,
      attachmentCount: attachmentPaths.length,
    }, activeAuditTasks.values().next().value);
    return publishDispatchState();
  });
  handle("desktop:discard-queued-message", (_event, itemId: string) => {
    dispatch.removeQueued(itemId, "discarded");
    return publishDispatchState();
  });
  handle("desktop:recover-conversation-task", () => {
    dispatch.recover();
    return publishDispatchState();
  });
  handle("desktop:discard-conversation-recovery", () => {
    dispatch.discardRecovery();
    return publishDispatchState();
  });
  handle("desktop:cancel", async (event) => {
    const taskId = activeAuditTasks.get(event.sender.id);
    audit.recordEvent("task.cancel_requested", {}, taskId);
    return codex.cancel();
  });
  handle("desktop:send-message", async (ipcEvent, request: SendMessageRequest) => {
    if (!request || typeof request.message !== "string") throw new Error("Invalid message request.");
    if (!LOCALES.includes(request.locale)) throw new Error("Invalid locale.");
    if (!SANDBOX_MODES.includes(request.sandboxMode)) throw new Error("Invalid sandbox mode.");
    if (dispatch.state().activeTask) {
      const queued = dispatch.enqueue(request, request.message);
      publishDispatchState();
      return { text: "消息已进入等待队列。", itemCount: 0, disposition: "queued" as const, queueItemId: queued.id };
    }
    let effectiveRequest = request;
    let dispatchId = request.queueItemId;
    if (dispatchId) effectiveRequest = dispatch.takeQueued(dispatchId).request;
    dispatchId = dispatch.begin(effectiveRequest, dispatchId);
    publishDispatchState();
    let taskId: string | undefined;
    try {
      const executionMode: ManagedExecutionMode = isManagedExecutionMode(effectiveRequest.executionMode)
        ? effectiveRequest.executionMode
        : "conversation-managed";
      const attachmentPaths = await screenshots.resolveAttachmentPaths(effectiveRequest.attachmentIds || []);
      const workspaceState = workspaces.read();
      const previousTask = audit.info().latestTask;
      const appRelativeRoot = path.relative(projectRoot, appRoot).replaceAll(path.sep, "/");
      const restartRequired = executionMode === "test-managed" && Boolean(previousTask?.changedFiles.some((file) => {
        const normalized = file.replaceAll("\\", "/").replace(/^\.\//, "");
        return normalized.startsWith(`${appRelativeRoot}/src/`)
          || normalized.startsWith(`${appRelativeRoot}/electron/`)
          || normalized.startsWith(`${appRelativeRoot}/contracts/`)
          || normalized === `${appRelativeRoot}/package.json`
          || normalized === `${appRelativeRoot}/vite.config.mjs`;
      }));
      taskId = audit.startTask({
        message: effectiveRequest.message,
        locale: effectiveRequest.locale,
        sandboxMode: effectiveRequest.sandboxMode,
        workspaces: workspaceState,
        attachmentCount: attachmentPaths.length,
        managedMode: executionMode,
      });
      activeAuditTasks.set(ipcEvent.sender.id, taskId);
      let firstTurn = true;
      const emit = (streamEvent: Parameters<typeof audit.recordStreamEvent>[1]) => {
        audit.recordStreamEvent(taskId!, streamEvent);
        // 进度只回送给发起本轮任务的窗口，避免多窗口之间串流或泄露任务上下文。
        if (!ipcEvent.sender.isDestroyed()) ipcEvent.sender.send("desktop:codex-stream-event", streamEvent);
      };
      const response = await managedExecutor.run({
        mode: executionMode,
        message: effectiveRequest.message,
        restartRequired,
        emit,
        runTurn: async (message, onEvent, mode) => {
          const currentAttachments = firstTurn ? attachmentPaths : [];
          firstTurn = false;
          const effectiveSandbox = mode === "conversation-managed" || mode === "requirement-managed" ? "read-only" : effectiveRequest.sandboxMode;
          return codex.send(message, effectiveRequest.locale, effectiveSandbox, workspaceState, currentAttachments, onEvent, mode);
        },
      });
      audit.finishTask(taskId, "completed", undefined, response.managedStatus, response.pendingActions);
      dispatch.finish(dispatchId, "completed");
      publishDispatchState();
      if (response.restartRequired) {
        audit.recordEvent("application.controlled_restart_scheduled", { reason: "test_managed_completed" }, taskId);
        setTimeout(() => { app.relaunch(); prepareForApplicationExit(); app.exit(0); }, 1_200);
      }
      return { ...response, disposition: "completed" as const };
    } catch (error) {
      if (taskId) audit.finishTask(taskId, "failed", error instanceof Error ? error.message : "Codex task failed.");
      dispatch.finish(dispatchId, "failed");
      publishDispatchState();
      throw error;
    } finally {
      activeAuditTasks.delete(ipcEvent.sender.id);
    }
  });

  ipcMain.on("window:control", (event, action: WindowAction) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    if (action === "minimize") window.minimize();
    if (action === "maximize") window.isMaximized() ? window.unmaximize() : window.maximize();
    if (action === "close") window.close();
  });
  ipcMain.on("desktop:renderer-exception", (_event, report: unknown) => {
    if (!report || typeof report !== "object") {
      eventCenter.recordIpcException("desktop:renderer-exception", new Error("Invalid renderer exception report."), "business");
      return;
    }
    const value = report as Record<string, unknown>;
    eventCenter.recordRendererException({
      operation: typeof value.operation === "string" ? value.operation : "window.error",
      message: typeof value.message === "string" ? value.message : "Unknown renderer exception.",
      stack: typeof value.stack === "string" ? value.stack : null,
      componentStack: typeof value.componentStack === "string" ? value.componentStack : null,
      url: typeof value.url === "string" ? value.url : null,
    });
  });
}

function isManagedExecutionMode(value: unknown): value is ManagedExecutionMode {
  return value === "conversation-managed" || value === "requirement-managed" || value === "task-managed" || value === "test-managed";
}
