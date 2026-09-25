const path = require("node:path");
const { pathToFileURL } = require("node:url");

const { app, BrowserWindow, ipcMain } = require("electron");
const { MAIN_WINDOW_LAYOUT, mainWindowInitialSize } = require(path.resolve(
  __dirname,
  "../../../../build/ai-desktop/electron/electron/system/window/main-window-layout.cjs",
));

const isolatedUserDataRoot = process.env.AI_DESKTOP_INTERACTION_USER_DATA_ROOT;
if (!isolatedUserDataRoot) throw new Error("隔离桌面测试缺少独立用户数据目录。 ");
// 每个 Electron 进程使用独立目录，禁止上一次测试的会话和 localStorage 污染本轮。
app.setPath("userData", path.join(isolatedUserDataRoot, String(process.pid)));

// 首窗出现不等于 Renderer 已挂载；保留启动期间的真实异常供 Playwright 报告。
const launchDiagnostics = {
  documentLoaded: false,
  loadFailures: [],
  rendererConsole: [],
  renderProcessGone: null,
};

ipcMain.handle("interaction:get-launch-diagnostics", () => structuredClone(launchDiagnostics));

// 设置夹具放在隔离主进程，避免 Renderer 重挂载时重新执行 preload 而丢失 API DTO。
// 这只模拟生产的主进程到 preload 边界；真实磁盘持久化仍由 SettingsStore 测试覆盖。
let interactionDesktopSettings = {
  locale: "zh-CN",
  sandboxMode: "workspace-write",
  defaultModel: "gpt-5.6-terra",
  reasoningEffort: "medium",
  serviceTier: "default",
  codexAppCorpusIngestionEnabled: false,
};
let interactionSettingsReadSource = "stored";
let interactionSettingsReadFailure = null;
let interactionSettingsUpdateFailure = null;
let interactionSettingsUpdateDelayMs = 0;
let interactionScreenshotWindow = null;
let productionRendererFile = null;

function publishInteractionSettingsChanged() {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send("desktop:settings-changed", structuredClone(interactionDesktopSettings));
  }
}

ipcMain.handle("interaction:settings-get", () => ({
  settings: structuredClone(interactionDesktopSettings),
  source: interactionSettingsReadSource,
  recoveryError: interactionSettingsReadSource === "recovered" ? interactionSettingsReadFailure : null,
}));
ipcMain.handle("interaction:settings-update", async (_event, settings) => {
  if (interactionSettingsUpdateDelayMs) await new Promise((resolve) => setTimeout(resolve, interactionSettingsUpdateDelayMs));
  if (interactionSettingsUpdateFailure) throw new Error(interactionSettingsUpdateFailure);
  interactionDesktopSettings = { ...interactionDesktopSettings, ...settings };
  publishInteractionSettingsChanged();
  return structuredClone(interactionDesktopSettings);
});
ipcMain.handle("interaction:settings-read-source", (_event, source) => {
  interactionSettingsReadSource = source === "recovered" ? "recovered" : "stored";
});
ipcMain.handle("interaction:settings-read-failure", (_event, message) => {
  interactionSettingsReadFailure = message || null;
});
ipcMain.handle("interaction:settings-update-failure", (_event, message) => {
  interactionSettingsUpdateFailure = message || null;
});
ipcMain.handle("interaction:settings-update-delay", (_event, milliseconds) => {
  interactionSettingsUpdateDelayMs = Math.max(0, Number(milliseconds) || 0);
});
ipcMain.handle("interaction:open-screenshot-window", async () => {
  if (!productionRendererFile) throw new Error("生产桌面交互测试缺少 AI_DESKTOP_INTERACTION_FILE。 ");
  if (interactionScreenshotWindow && !interactionScreenshotWindow.isDestroyed()) return interactionScreenshotWindow.webContents.id;
  interactionScreenshotWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "isolated-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  interactionScreenshotWindow.once("closed", () => { interactionScreenshotWindow = null; });
  await interactionScreenshotWindow.loadFile(productionRendererFile, { query: { mode: "screenshot" } });
  return interactionScreenshotWindow.webContents.id;
});
ipcMain.handle("interaction:close-screenshot-window", () => {
  if (interactionScreenshotWindow && !interactionScreenshotWindow.isDestroyed()) interactionScreenshotWindow.close();
});

function recordRendererConsole(event, level, message, line, sourceId) {
  const details = event && typeof event === "object" && "message" in event
    ? event
    : { level, message, lineNumber: line, sourceId };
  launchDiagnostics.rendererConsole.push({
    level: details.level,
    message: details.message,
    lineNumber: details.lineNumber,
    sourceId: details.sourceId,
  });
  // 只保留最近的异常，避免单个失败页面使测试诊断无限增长。
  if (launchDiagnostics.rendererConsole.length > 50) launchDiagnostics.rendererConsole.shift();
}

app.whenReady().then(async () => {
  // 主进程负责路径解析，沙箱 preload 只接收已验证的字符串，保持和生产安全边界一致。
  process.env.AI_DESKTOP_INTERACTION_PROJECT_ROOT = path.resolve(__dirname, "../../../..");
  const initialSize = mainWindowInitialSize("developer");
  // 隔离窗口复用正式桌面尺寸并加载生产构建，不替换、不重启用户正在使用的 AI Desktop。
  const window = new BrowserWindow({
    width: initialSize.width,
    height: initialSize.height,
    minWidth: MAIN_WINDOW_LAYOUT.minimum.width,
    minHeight: MAIN_WINDOW_LAYOUT.minimum.height,
    // 几何验收必须使用正式主窗口相同的无边框内容视口；否则 680×700 外窗会被系统标题栏缩短。
    frame: false,
    show: false,
    backgroundColor: "#080b12",
    webPreferences: {
      preload: path.join(__dirname, "isolated-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.on("did-finish-load", () => {
    launchDiagnostics.documentLoaded = true;
  });
  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    launchDiagnostics.loadFailures.push({ errorCode, errorDescription, validatedURL, isMainFrame });
  });
  window.webContents.on("console-message", recordRendererConsole);
  window.webContents.on("render-process-gone", (_event, details) => {
    launchDiagnostics.renderProcessGone = { reason: details.reason, exitCode: details.exitCode };
  });
  productionRendererFile = process.env.AI_DESKTOP_INTERACTION_FILE;
  if (!productionRendererFile) throw new Error("生产桌面交互测试缺少 AI_DESKTOP_INTERACTION_FILE。 ");
  await window.loadFile(productionRendererFile);
});

app.on("window-all-closed", () => app.quit());
