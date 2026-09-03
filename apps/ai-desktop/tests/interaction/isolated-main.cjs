const path = require("node:path");
const { pathToFileURL } = require("node:url");

const { app, BrowserWindow, ipcMain } = require("electron");
const { MAIN_WINDOW_LAYOUT, mainWindowInitialSize } = require(path.resolve(
  __dirname,
  "../../../../build/ai-desktop/electron/electron/system/window/main-window-layout.cjs",
));

app.whenReady().then(async () => {
  // 交互夹具必须读取生产 Store 的唯一默认文案，避免职责升级后继续展示测试专用旧副本。
  const linghuStore = await import(pathToFileURL(path.resolve(
    __dirname,
    "../../../../build/ai-desktop/electron/electron/services/personas/linghu/internal/linghu-automation.store.js",
  )).href);
  process.env.AI_DESKTOP_INTERACTION_LINGHU_DEFAULT = JSON.stringify({
    title: linghuStore.DEFAULT_LINGHU_STARTUP_PROMPT_TITLE,
    content: linghuStore.DEFAULT_LINGHU_STARTUP_PROMPT,
  });
  // 主进程负责路径解析，沙箱 preload 只接收已验证的字符串，保持和生产安全边界一致。
  process.env.AI_DESKTOP_INTERACTION_PROJECT_ROOT = path.resolve(__dirname, "../../../..");
  const initialSize = mainWindowInitialSize("developer");
  // 隔离窗口复用正式桌面尺寸并加载生产构建，不替换、不重启用户正在使用的 AI Desktop。
  const window = new BrowserWindow({
    width: initialSize.width,
    height: initialSize.height,
    minWidth: MAIN_WINDOW_LAYOUT.minimum.width,
    minHeight: MAIN_WINDOW_LAYOUT.minimum.height,
    show: false,
    backgroundColor: "#080b12",
    webPreferences: {
      preload: path.join(__dirname, "isolated-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const productionFile = process.env.AI_DESKTOP_INTERACTION_FILE;
  if (!productionFile) throw new Error("生产桌面交互测试缺少 AI_DESKTOP_INTERACTION_FILE。 ");
  await window.loadFile(productionFile);
});

app.on("window-all-closed", () => app.quit());
