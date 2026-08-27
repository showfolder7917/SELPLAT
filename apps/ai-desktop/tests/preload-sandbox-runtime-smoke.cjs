const path = require("node:path");

const { app, BrowserWindow } = require("electron");

const preloadPath = path.resolve(__dirname, "../../../build/ai-desktop/electron/electron/preload.cjs");
const requiredCapabilities = [
  "getEnvironment",
  "getWorkspaces",
  "loginWithChatGPT",
  "prepareScreenCapture",
  "getCollaborationState",
  "enqueueMessage",
  "windowControl",
];

app.whenReady().then(async () => {
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
    window.destroy();
    app.quit();
  }
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
