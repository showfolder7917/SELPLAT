/**
 * Electron 进程入口。
 *
 * 这里只处理 Electron 生命周期；数据库、公共能力、协作和人物模块的装配均位于 bootstrap 分层。
 */
import { app } from "electron";

import { disposeApplication, reportStartupFailure, startApplication } from "./bootstrap/application-runtime.js";

app.whenReady().then(startApplication).catch((error) => {
  reportStartupFailure(error);
  app.quit();
});

app.on("before-quit", disposeApplication);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
