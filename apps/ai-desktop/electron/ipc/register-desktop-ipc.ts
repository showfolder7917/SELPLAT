import path from "node:path";

import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, screen, shell, systemPreferences } from "electron";

import { LOCALES, SANDBOX_MODES, WORKSPACE_PERMISSIONS } from "../../shared/contracts/desktop.js";
import type {
  AppVariant,
  DesktopSettings,
  ManagedExecutionMode,
  ResolveCodexUserInputRequest,
  ScreenCaptureFrameResult,
  ScreenCapturePreparationResult,
  ScreenCaptureRequest,
  ScreenCaptureStreamSource,
  ScreenshotAnnotationWindowRequest,
  ScreenshotSaveRequest,
  SendMessageRequest,
  WorkspacePermission,
  WindowAction,
} from "../../shared/contracts/desktop.js";
import { CodexService } from "../services/codex-service.js";
import { BusinessAuditLog } from "../services/business-audit-log.js";
import { ManagedTaskExecutor } from "../services/managed-task-executor.js";
import { ScreenshotStore } from "../services/screenshot-store.js";
import { SettingsStore } from "../services/settings-store.js";
import { WorkspaceStore } from "../services/workspace-store.js";
import { TrustedCommandStore } from "../services/trusted-command-store.js";

interface DesktopIpcDependencies {
  codex: CodexService;
  screenshots: ScreenshotStore;
  settings: SettingsStore;
  workspaces: WorkspaceStore;
  trustedCommands: TrustedCommandStore;
  audit: BusinessAuditLog;
  projectRoot: string;
  variant: AppVariant;
  preloadPath: string;
  rendererRoot: string;
}

interface ScreenshotWindowSession {
  active: boolean;
  captureReady: boolean;
  frameRequestId: number;
  rejectFrameReady?(error: Error): void;
  resolveFrameReady?(): void;
  ownerWebContentsId: number;
  rendererReady: Promise<void>;
  resolveRendererReady(): void;
  selectionBounds: { x: number; y: number; width: number; height: number };
  restoreOwnerOnClose: boolean;
  streamReady: Promise<void>;
  streamSource: ScreenCaptureStreamSource;
  resolveStreamReady(): void;
}

const screenshotWindowSessions = new Map<number, ScreenshotWindowSession>();
const screenCaptureSources = new Map<string, ScreenCaptureStreamSource>();

type ScreenCaptureFailureReason = Extract<ScreenCapturePreparationResult, { status: "blocked" }>["reason"];

class ScreenCapturePreparationError extends Error {
  constructor(readonly reason: ScreenCaptureFailureReason) {
    super(reason === "permission-required"
      ? "无法截取屏幕，请先允许 AI Desktop 使用屏幕录制权限并重新启动应用。"
      : "无法读取屏幕来源，请检查屏幕录制权限后重试。");
  }
}

export function registerDesktopIpc(dependencies: DesktopIpcDependencies): void {
  const { codex, screenshots, settings, workspaces, trustedCommands, audit, projectRoot, variant, preloadPath, rendererRoot } = dependencies;
  const activeAuditTasks = new Map<number, string>();
  const seenApprovalRequests = new Set<number>();
  const approvalAuditTasks = new Map<number, string>();
  const managedExecutor = new ManagedTaskExecutor();

  const getScreenCaptureAccessStatus = () => process.platform === "darwin"
    ? systemPreferences.getMediaAccessStatus("screen")
    : "granted";

  const toScreenCapturePreparationResult = (error: unknown): ScreenCapturePreparationResult => ({
    status: "blocked",
    reason: error instanceof ScreenCapturePreparationError ? error.reason : "source-unavailable",
    canOpenSettings: process.platform === "darwin",
  });

  const resolveScreenCaptureSource = async (display: Electron.Display): Promise<ScreenCaptureStreamSource> => {
    const displayKey = String(display.id);
    const cached = screenCaptureSources.get(displayKey);
    if (cached) return cached;
    const accessStatus = getScreenCaptureAccessStatus();
    // macOS 已明确拒绝或限制权限时不再调用原生枚举，避免把 Electron 内部错误直接回显到输入框。
    if (accessStatus === "denied" || accessStatus === "restricted") {
      throw new ScreenCapturePreparationError("permission-required");
    }
    // 只枚举桌面流 ID，不生成缩略图；真实像素由隔离截图窗口中的长期 MediaStream 读取。
    let sources: Electron.DesktopCapturerSource[];
    try {
      sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width: 0, height: 0 },
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
    const source = sources.find((item) => item.display_id === displayKey) || sources[0];
    const streamSource = {
      sourceId: source.id,
      width: Math.max(1, Math.round(display.size.width * display.scaleFactor)),
      height: Math.max(1, Math.round(display.size.height * display.scaleFactor)),
    };
    screenCaptureSources.set(displayKey, streamSource);
    return streamSource;
  };

  const parkScreenshotWindow = (screenshotWindow: BrowserWindow, session: ScreenshotWindowSession): void => {
    // 空闲截图窗口保持可见以维持 MediaStream，但收缩到 1×1；即使 macOS 延迟应用透明度也不会留下黑色编辑窗。
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

  ipcMain.handle("desktop:get-environment", () => ({ projectRoot, platform: process.platform, variant }));
  ipcMain.handle("desktop:get-settings", () => settings.read());
  ipcMain.handle("desktop:update-settings", (_event, patch: Partial<DesktopSettings>) => {
    const result = settings.update(patch);
    audit.recordEvent("settings.updated", { locale: result.locale, sandboxMode: result.sandboxMode });
    return result;
  });
  ipcMain.handle("desktop:get-workspaces", () => workspaces.read());
  ipcMain.handle("desktop:add-workspace", async (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    const options = { properties: ["openDirectory", "createDirectory"] as ("openDirectory" | "createDirectory")[] };
    const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return workspaces.read();
    const state = workspaces.add(result.filePaths[0]);
    audit.recordEvent("workspace.added", { path: result.filePaths[0] });
    return state;
  });
  ipcMain.handle("desktop:update-workspace-permission", (_event, id: string, permission: WorkspacePermission) => {
    if (!WORKSPACE_PERMISSIONS.includes(permission)) throw new Error("Invalid workspace permission.");
    const state = workspaces.updatePermission(id, permission);
    audit.recordEvent("workspace.permission_updated", { id, permission });
    return state;
  });
  ipcMain.handle("desktop:set-primary-workspace", (_event, id: string) => {
    const state = workspaces.setPrimary(id);
    audit.recordEvent("workspace.primary_updated", { id });
    return state;
  });
  ipcMain.handle("desktop:remove-workspace", (_event, id: string) => {
    const state = workspaces.remove(id);
    audit.recordEvent("workspace.removed", { id });
    return state;
  });
  ipcMain.handle("desktop:list-workspace-entries", (_event, id: string) => workspaces.listEntries(id));
  ipcMain.handle("desktop:get-codex-status", () => codex.getStatus());
  ipcMain.handle("desktop:get-active-codex-session", () => codex.activeSession());
  ipcMain.handle("desktop:login-with-chatgpt", async () => {
    const login = await codex.loginWithChatGPT();
    await shell.openExternal(login.authUrl);
    return login;
  });
  ipcMain.handle("desktop:logout-codex", () => codex.logout());
  ipcMain.handle("desktop:get-codex-approvals", () => {
    const approvals = codex.pendingApprovals();
    for (const approval of approvals) {
      if (seenApprovalRequests.has(approval.requestId)) continue;
      seenApprovalRequests.add(approval.requestId);
      const taskId = [...activeAuditTasks.values()].at(-1);
      if (taskId) approvalAuditTasks.set(approval.requestId, taskId);
      audit.recordEvent("approval.requested", {
        requestId: approval.requestId,
        kind: approval.kind,
        title: approval.title,
        command: approval.command,
        cwd: approval.cwd,
      }, taskId);
    }
    return approvals;
  });
  ipcMain.handle("desktop:resolve-codex-approval", (_event, requestId: number, decision: "accept" | "decline") => {
    if (!Number.isSafeInteger(requestId) || (decision !== "accept" && decision !== "decline")) {
      throw new Error("Invalid Codex approval response.");
    }
    // “允许”对满足安全边界的项目内固定命令默认同时建立信任；文件修改和高风险命令不会进入持久信任。
    const trustResult = codex.resolveApproval(requestId, decision, decision === "accept");
    audit.recordApproval(approvalAuditTasks.get(requestId), requestId, decision, trustResult.trusted);
    seenApprovalRequests.delete(requestId);
    approvalAuditTasks.delete(requestId);
  });
  ipcMain.handle("desktop:get-trusted-command-info", () => ({ count: trustedCommands.count() }));
  ipcMain.handle("desktop:clear-trusted-commands", () => {
    trustedCommands.clear();
    audit.recordEvent("trusted_commands.cleared");
    return { count: 0 };
  });
  ipcMain.handle("desktop:get-codex-user-inputs", () => codex.pendingUserInputs());
  ipcMain.handle("desktop:resolve-codex-user-input", (_event, request: ResolveCodexUserInputRequest) => {
    codex.resolveUserInput(request);
    // 业务日志只记录协议生命周期，不记录可能包含敏感内容的答案正文。
    audit.recordEvent("user_input.resolved", { requestId: request.requestId, answerCount: Object.keys(request.answers || {}).length });
  });
  ipcMain.handle("desktop:new-chat", () => codex.newChat());
  ipcMain.handle("desktop:open-external-url", async (_event, value: string) => {
    if (typeof value !== "string" || value.length > 2_048) throw new Error("Invalid external URL.");
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only HTTP(S) links can be opened.");
    await shell.openExternal(url.toString());
  });
  ipcMain.handle("desktop:prepare-screen-capture", async (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    const display = parent ? screen.getDisplayMatching(parent.getBounds()) : screen.getPrimaryDisplay();
    // 两个截图入口统一预热同一个显示器源；本次进程内再次调用直接命中缓存。
    try {
      await resolveScreenCaptureSource(display);
      return { status: "ready" } satisfies ScreenCapturePreparationResult;
    } catch (error) {
      return toScreenCapturePreparationResult(error);
    }
  });
  ipcMain.handle("desktop:open-screen-recording-settings", async () => {
    if (process.platform !== "darwin") throw new Error("Screen recording settings are only available on macOS.");
    // 固定打开 macOS 屏幕录制隐私页，不接受渲染层提供的任意系统设置地址。
    await shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
  });
  ipcMain.handle("desktop:capture-screen", async (event, request?: ScreenCaptureRequest) => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    if (request && typeof request.hideOwnerWindow !== "undefined" && typeof request.hideOwnerWindow !== "boolean") {
      throw new Error("Invalid screenshot capture mode.");
    }
    const display = parent ? screen.getDisplayMatching(parent.getBounds()) : screen.getPrimaryDisplay();
    const hideOwnerWindow = request?.hideOwnerWindow === true;
    if (!parent) throw new Error("无法识别截图发起窗口。");
    const streamSource = await resolveScreenCaptureSource(display);
    let screenshotWindow = BrowserWindow.getAllWindows().find((window) =>
      screenshotWindowSessions.get(window.webContents.id)?.ownerWebContentsId === parent.webContents.id,
    );
    let session = screenshotWindow && screenshotWindowSessions.get(screenshotWindow.webContents.id);
    if (session?.active) {
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
      let resolveStreamReady: () => void = () => {};
      const streamReady = new Promise<void>((resolve) => { resolveStreamReady = resolve; });
      session = {
        active: true,
        captureReady: false,
        frameRequestId: 0,
        ownerWebContentsId: parent.webContents.id,
        rendererReady,
        resolveRendererReady,
        selectionBounds: { ...display.bounds },
        restoreOwnerOnClose: hideOwnerWindow,
        streamReady,
        streamSource,
        resolveStreamReady,
      };
      screenshotWindowSessions.set(screenshotWebContentsId, session);
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
      session.captureReady = false;
      session.selectionBounds = { ...display.bounds };
      session.restoreOwnerOnClose = hideOwnerWindow;
      screenshotWindow.webContents.send("desktop:screen-capture-reset");
      if (session.streamSource.sourceId !== streamSource.sourceId) {
        let resolveStreamReady: () => void = () => {};
        session.streamReady = new Promise<void>((resolve) => { resolveStreamReady = resolve; });
        session.resolveStreamReady = resolveStreamReady;
        session.streamSource = streamSource;
        screenshotWindow.webContents.send("desktop:screen-capture-stream-configured", streamSource);
      }
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
    await session.rendererReady;
    // Electron 会暂停完全隐藏窗口中的桌面视频帧；保持零透明且鼠标穿透的后台可见窗口，流才能跨轮次持续更新。
    screenshotWindow.setOpacity(0);
    screenshotWindow.setIgnoreMouseEvents(true);
    if (!screenshotWindow.isVisible()) screenshotWindow.showInactive();
    await session.streamReady;
    if (hideOwnerWindow) {
      // 截图流和蒙版资源全部就绪后才隐藏主窗口；截图渲染器会等待隐藏后的新视频帧，不使用固定延时猜测合成器状态。
      parent.hide();
    }
    const requestId = ++session.frameRequestId;
    const frameReady = new Promise<void>((resolve, reject) => {
      session.resolveFrameReady = resolve;
      session.rejectFrameReady = reject;
    });
    screenshotWindow.webContents.send("desktop:screen-capture-frame-requested", { requestId, waitForOwnerHidden: hideOwnerWindow });
    try {
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
      session.active = false;
      session.restoreOwnerOnClose = false;
      parkScreenshotWindow(screenshotWindow, session);
      if (hideOwnerWindow) parent.show();
      parent.moveTop();
      parent.focus();
      throw error;
    } finally {
      session.resolveFrameReady = undefined;
      session.rejectFrameReady = undefined;
    }
    return null;
  });
  ipcMain.handle("desktop:get-screen-capture-stream-source", (event) => {
    return screenshotWindowSessions.get(event.sender.id)?.streamSource || null;
  });
  ipcMain.handle("desktop:screen-capture-stream-ready", (event, sourceId: string) => {
    const session = screenshotWindowSessions.get(event.sender.id);
    if (!session || typeof sourceId !== "string" || session.streamSource.sourceId !== sourceId) {
      throw new Error("Invalid screenshot stream source.");
    }
    session.resolveStreamReady();
  });
  ipcMain.handle("desktop:screen-capture-frame-result", (event, result: ScreenCaptureFrameResult) => {
    const session = screenshotWindowSessions.get(event.sender.id);
    if (!session || !result || !Number.isSafeInteger(result.requestId) || result.requestId !== session.frameRequestId) {
      throw new Error("Invalid screenshot frame result.");
    }
    if (result.error) {
      session.rejectFrameReady?.(new Error(result.error));
      return;
    }
    if (!Number.isFinite(result.width) || !Number.isFinite(result.height) || result.width < 1 || result.height < 1) {
      session.rejectFrameReady?.(new Error("截图画面尺寸无效。"));
      return;
    }
    session.captureReady = true;
    session.resolveFrameReady?.();
  });
  ipcMain.handle("desktop:show-screenshot-window", (event) => {
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
  ipcMain.handle("desktop:enter-screenshot-annotation", (event, request: ScreenshotAnnotationWindowRequest) => {
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
  ipcMain.handle("desktop:return-screenshot-selection", (event) => {
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
  ipcMain.handle("desktop:end-screenshot-editing", (event) => {
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
  ipcMain.handle("desktop:save-screenshot", async (event, request: ScreenshotSaveRequest) => {
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
  ipcMain.handle("desktop:get-temp-directory-info", () => screenshots.info());
  ipcMain.handle("desktop:open-temp-directory", async () => {
    const directory = await screenshots.ensure();
    const error = await shell.openPath(directory);
    if (error) throw new Error(error);
  });
  ipcMain.handle("desktop:clear-temp-files", () => screenshots.clear());
  ipcMain.handle("desktop:get-audit-log-info", () => audit.info());
  ipcMain.handle("desktop:open-audit-log-directory", async () => {
    const error = await shell.openPath(audit.ensure());
    if (error) throw new Error(error);
  });
  ipcMain.handle("desktop:cancel", async (event) => {
    const taskId = activeAuditTasks.get(event.sender.id);
    audit.recordEvent("task.cancel_requested", {}, taskId);
    return codex.cancel();
  });
  ipcMain.handle("desktop:send-message", async (ipcEvent, request: SendMessageRequest) => {
    if (!request || typeof request.message !== "string") throw new Error("Invalid message request.");
    if (!LOCALES.includes(request.locale)) throw new Error("Invalid locale.");
    if (!SANDBOX_MODES.includes(request.sandboxMode)) throw new Error("Invalid sandbox mode.");
    const executionMode: ManagedExecutionMode = isManagedExecutionMode(request.executionMode)
      ? request.executionMode
      : "conversation-managed";
    const attachmentPaths = await screenshots.resolveAttachmentPaths(request.attachmentIds || []);
    const workspaceState = workspaces.read();
    const previousTask = audit.info().latestTask;
    const restartRequired = executionMode === "test-managed" && Boolean(previousTask?.changedFiles.some((file) =>
      /(^|\/)apps\/ai-desktop\/(src|electron|shared|package\.json|vite\.config)/.test(file),
    ));
    const taskId = audit.startTask({
      message: request.message,
      locale: request.locale,
      sandboxMode: request.sandboxMode,
      workspaces: workspaceState,
      attachmentCount: attachmentPaths.length,
      managedMode: executionMode,
    });
    activeAuditTasks.set(ipcEvent.sender.id, taskId);
    try {
      let firstTurn = true;
      const emit = (streamEvent: Parameters<typeof audit.recordStreamEvent>[1]) => {
        audit.recordStreamEvent(taskId, streamEvent);
        // 进度只回送给发起本轮任务的窗口，避免多窗口之间串流或泄露任务上下文。
        if (!ipcEvent.sender.isDestroyed()) ipcEvent.sender.send("desktop:codex-stream-event", streamEvent);
      };
      const response = await managedExecutor.run({
        mode: executionMode,
        message: request.message,
        restartRequired,
        emit,
        runTurn: async (message, onEvent, mode) => {
          const currentAttachments = firstTurn ? attachmentPaths : [];
          firstTurn = false;
          const effectiveSandbox = mode === "conversation-managed" || mode === "requirement-managed" ? "read-only" : request.sandboxMode;
          return codex.send(message, request.locale, effectiveSandbox, workspaceState, currentAttachments, onEvent, mode);
        },
      });
      audit.finishTask(taskId, "completed", undefined, response.managedStatus, response.pendingActions);
      if (response.restartRequired) {
        audit.recordEvent("application.controlled_restart_scheduled", { reason: "test_managed_completed" }, taskId);
        setTimeout(() => { app.relaunch(); app.exit(0); }, 1_200);
      }
      return response;
    } catch (error) {
      audit.finishTask(taskId, "failed", error instanceof Error ? error.message : "Codex task failed.");
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
}

function isManagedExecutionMode(value: unknown): value is ManagedExecutionMode {
  return value === "conversation-managed" || value === "requirement-managed" || value === "task-managed" || value === "test-managed";
}
