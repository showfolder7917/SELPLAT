import path from "node:path";

import { BrowserWindow } from "electron";

import type { AppVariant } from "../../shared/contracts/desktop.js";

interface MainWindowOptions {
  preloadPath: string;
  rendererRoot: string;
  variant: AppVariant;
}

export function createMainWindow(options: MainWindowOptions): BrowserWindow {
  const isDeveloper = options.variant === "developer";
  const window = new BrowserWindow({
    width: isDeveloper ? 1560 : 1440,
    height: isDeveloper ? 980 : 960,
    minWidth: 1000,
    minHeight: 700,
    frame: false,
    show: false,
    backgroundColor: isDeveloper ? "#080b12" : "#ffffff",
    webPreferences: {
      preload: options.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once("ready-to-show", () => window.show());
  const developmentUrl = process.env.VITE_DEV_SERVER_URL;
  if (developmentUrl) void window.loadURL(developmentUrl);
  else void window.loadFile(path.join(options.rendererRoot, "index.html"));
  return window;
}
