const path = require("node:path");
const { pathToFileURL } = require("node:url");

const { app, BrowserWindow, ipcMain } = require("electron");
const { MAIN_WINDOW_LAYOUT, mainWindowInitialSize } = require(path.resolve(
  __dirname,
  "../../../../build/ai-desktop/electron/electron/window/main-window-layout.cjs",
));

app.whenReady().then(async () => {
  // 交互夹具必须读取生产 Store 的唯一默认文案，避免职责升级后继续展示测试专用旧副本。
  const linghuStore = await import(pathToFileURL(path.resolve(
    __dirname,
    "../../../../build/ai-desktop/electron/electron/services/collaboration/linghu-automation-store.js",
  )).href);
  process.env.AI_DESKTOP_INTERACTION_LINGHU_DEFAULT = JSON.stringify({
    title: linghuStore.DEFAULT_LINGHU_STARTUP_PROMPT_TITLE,
    content: linghuStore.DEFAULT_LINGHU_STARTUP_PROMPT,
  });
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
      sandbox: false,
    },
  });
  const productionFile = process.env.AI_DESKTOP_INTERACTION_FILE;
  if (!productionFile) throw new Error("生产桌面交互测试缺少 AI_DESKTOP_INTERACTION_FILE。 ");
  let evolutionWindow = null;
  ipcMain.handle("desktop:test-open-evolution-workspace", async (_event, perspective) => {
    if (perspective !== "nangong" && perspective !== "hanli") throw new Error("Invalid evolution perspective.");
    if (evolutionWindow && !evolutionWindow.isDestroyed()) {
      evolutionWindow.webContents.send("desktop:evolution-workspace-perspective", perspective);
      evolutionWindow.show();
      evolutionWindow.focus();
      return;
    }
    evolutionWindow = new BrowserWindow({
      width: 1320,
      height: 880,
      minWidth: 980,
      minHeight: 680,
      show: false,
      backgroundColor: "#080b12",
      webPreferences: { preload: path.join(__dirname, "isolated-preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: false },
    });
    evolutionWindow.once("closed", () => { evolutionWindow = null; });
    await evolutionWindow.loadFile(productionFile, { query: { mode: "evolution-workspace", perspective } });
    evolutionWindow.show();
  });
  await window.loadFile(productionFile);
});

app.on("window-all-closed", () => app.quit());
