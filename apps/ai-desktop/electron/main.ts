/**
 * Electron 进程入口。
 *
 * 这里只处理 Electron 生命周期；系统装配位于 system，日常业务实现位于 services。
 */
import { app } from "electron";

import { disposeApplication, reportStartupFailure, startApplication } from "./system/bootstrap/application-runtime.js";

app.whenReady().then(startApplication).catch((error) => {
  reportStartupFailure(error);
  app.quit();
});

app.on("before-quit", disposeApplication);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
