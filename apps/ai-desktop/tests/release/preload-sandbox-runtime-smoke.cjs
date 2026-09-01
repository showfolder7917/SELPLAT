const path = require("node:path");

const { app, BrowserWindow } = require("electron");

const preloadPath = path.resolve(__dirname, "../../../../build/ai-desktop/electron/electron/system/preload/preload.cjs");
const requiredCapabilities = [
  "getEnvironment",
  "getWorkspaces",
  "loginWithChatGPT",
  "prepareScreenCapture",
  "getCollaborationState",
  "getCollaborationTimeline",
  "onCollaborationTimelineChanged",
  "enqueueMessage",
  "windowControl",
];

// 冒烟测试必须在固定时间内返回；Electron 初始化卡住时给出明确阶段而不是无限等待。
const smokeTimeout = setTimeout(() => {
  console.error("Sandboxed desktop bridge timed out before the hidden window completed loading.");
  app.exit(1);
}, 20_000);

app.whenReady().then(async () => {
  console.log("Sandboxed desktop bridge app ready.");
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  try {
    await window.loadURL("data:text/html;charset=utf-8,<main>AI Desktop preload smoke</main>");
    console.log("Sandboxed desktop bridge page loaded.");
    const bridgeState = await window.webContents.executeJavaScript(`({
      available: typeof window.desktop === "object" && window.desktop !== null,
      methods: typeof window.desktop === "object" && window.desktop !== null ? Object.keys(window.desktop) : []
    })`);
    const missing = requiredCapabilities.filter((capability) => !bridgeState.methods.includes(capability));
    if (!bridgeState.available || missing.length > 0) {
      throw new Error(`Sandboxed desktop bridge is incomplete: ${missing.join(", ") || "window.desktop unavailable"}`);
    }
    console.log(`Sandboxed desktop bridge ready: ${bridgeState.methods.length} capabilities.`);
  } finally {
    clearTimeout(smokeTimeout);
    window.destroy();
    app.quit();
  }
}).catch((error) => {
  clearTimeout(smokeTimeout);
  console.error(error);
  app.exit(1);
});
