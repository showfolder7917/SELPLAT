import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Codex } from "@openai/codex-sdk";
import { app, BrowserWindow, ipcMain } from "electron";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const rendererDirectory = path.resolve(currentDirectory, "../dist/client");
const preloadPath = path.join(currentDirectory, "preload.cjs");
const projectRoot = path.resolve(process.env.SELPLAT_ROOT || path.join(app.getAppPath(), "../.."));

type Locale = "ja" | "zh-CN";
type SandboxMode = "read-only" | "workspace-write";
type SendRequest = { message: string; locale: Locale; sandboxMode: SandboxMode };

const codex = new Codex();
let thread: ReturnType<Codex["startThread"]> | undefined;
let threadSandbox: SandboxMode | undefined;
let activeController: AbortController | undefined;

function requireProjectRoot(): string {
  if (!existsSync(projectRoot) || !existsSync(path.join(projectRoot, ".git"))) {
    throw new Error(`SELPLAT project root is unavailable: ${projectRoot}`);
  }
  return projectRoot;
}

function responseLanguage(locale: Locale): string {
  return locale === "ja"
    ? "Reply in natural Japanese unless the user explicitly requests another language."
    : "除非用户明确要求其他语言，否则请使用自然、清晰的简体中文回答。";
}

function getThread(sandboxMode: SandboxMode) {
  if (!thread || threadSandbox !== sandboxMode) {
    thread = codex.startThread({
      workingDirectory: requireProjectRoot(),
      sandboxMode,
      approvalPolicy: "never",
      networkAccessEnabled: false,
    });
    threadSandbox = sandboxMode;
  }
  return thread;
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1000,
    minHeight: 700,
    frame: false,
    show: false,
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once("ready-to-show", () => window.show());
  const developmentUrl = process.env.VITE_DEV_SERVER_URL;
  if (developmentUrl) void window.loadURL(developmentUrl);
  else void window.loadFile(path.join(rendererDirectory, "index.html"));
  return window;
}

ipcMain.handle("desktop:get-environment", () => ({ projectRoot, platform: process.platform }));
ipcMain.handle("desktop:new-chat", () => {
  activeController?.abort();
  activeController = undefined;
  thread = undefined;
  threadSandbox = undefined;
});
ipcMain.handle("desktop:cancel", () => {
  activeController?.abort(new Error("Cancelled by user."));
  return true;
});
ipcMain.handle("desktop:send-message", async (_event, request: SendRequest) => {
  const message = request.message.trim();
  if (!message || message.length > 20_000) throw new Error("Message must contain 1-20000 characters.");
  activeController?.abort();
  activeController = new AbortController();
  try {
    const result = await getThread(request.sandboxMode).run(
      `${responseLanguage(request.locale)}\n\n${message}`,
      { signal: activeController.signal },
    );
    return { text: result.finalResponse, itemCount: result.items.length };
  } finally {
    activeController = undefined;
  }
});

ipcMain.on("window:control", (event, action: "minimize" | "maximize" | "close") => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return;
  if (action === "minimize") window.minimize();
  if (action === "maximize") window.isMaximized() ? window.unmaximize() : window.maximize();
  if (action === "close") window.close();
});

app.whenReady().then(() => {
  createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
