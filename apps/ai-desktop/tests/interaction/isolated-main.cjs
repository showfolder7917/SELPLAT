const path = require("node:path");

const { app, BrowserWindow } = require("electron");

app.whenReady().then(async () => {
  // 交互测试使用独立隐藏窗口加载开发服务器，不替换、不重启用户正在使用的 AI Desktop。
  const window = new BrowserWindow({
    width: 1280,
    height: 900,
    show: false,
    backgroundColor: "#080b12",
    webPreferences: {
      preload: path.join(__dirname, "isolated-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  await window.loadURL(process.env.AI_DESKTOP_INTERACTION_URL || "http://127.0.0.1:4197");
});

app.on("window-all-closed", () => app.quit());
