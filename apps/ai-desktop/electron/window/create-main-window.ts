import path from "node:path";

import { BrowserWindow } from "electron";

import type { AppVariant } from "../../shared/contracts/desktop.js";
import { MAIN_WINDOW_LAYOUT, mainWindowInitialSize } from "./main-window-layout.cjs";

interface MainWindowOptions {
  preloadPath: string;
  rendererRoot: string;
  variant: AppVariant;
}

export function createMainWindow(options: MainWindowOptions): BrowserWindow {
  const isDeveloper = options.variant === "developer";
  const initialSize = mainWindowInitialSize(options.variant);
  const window = new BrowserWindow({
    width: initialSize.width,
    height: initialSize.height,
    minWidth: MAIN_WINDOW_LAYOUT.minimum.width,
    minHeight: MAIN_WINDOW_LAYOUT.minimum.height,
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
