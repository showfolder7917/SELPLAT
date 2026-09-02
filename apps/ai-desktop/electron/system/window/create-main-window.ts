import path from "node:path";
import { BrowserWindow } from "electron";

import type { AppVariantValue } from "../../../contracts/foundation/index.js";
import { MAIN_WINDOW_LAYOUT, mainWindowInitialSize } from "./main-window-layout.cjs";

interface MainWindowOptions {
  preloadPath: string;
  rendererRoot: string;
  variant: AppVariantValue;
  onRendererReady?: () => void;
  onRendererFailed?: (details: { errorCode: number; errorDescription: string; validatedURL: string }) => void;
}

export function createMainWindow(options: MainWindowOptions): BrowserWindow {
  const initialSize = mainWindowInitialSize(options.variant);
  const window = new BrowserWindow({
    width: initialSize.width,
    height: initialSize.height,
    minWidth: MAIN_WINDOW_LAYOUT.minimum.width,
    minHeight: MAIN_WINDOW_LAYOUT.minimum.height,
    frame: false,
    show: false,
    backgroundColor: "#080b12",
    title: "AI Desktop",
    webPreferences: {
      preload: options.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once("ready-to-show", () => window.show());
  if (options.onRendererReady) window.webContents.once("did-finish-load", options.onRendererReady);
  if (options.onRendererFailed) {
    window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (isMainFrame) options.onRendererFailed?.({ errorCode, errorDescription, validatedURL });
    });
  }
  const rendererTarget = path.join(options.rendererRoot, "index.html");
  void window.loadFile(rendererTarget).catch((error) => options.onRendererFailed?.({
    errorCode: -1,
    errorDescription: error instanceof Error ? error.message : String(error),
    validatedURL: rendererTarget,
  }));
  return window;
}
