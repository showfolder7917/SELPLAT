/**
 * Electron 进程入口。
 *
 * 这里只处理 Electron 生命周期；系统装配位于 system，日常业务实现位于 services。
 */
// Electron 的 app 对象负责应用就绪、退出和窗口全部关闭等主进程生命周期事件。
import { app } from "electron";

import {
  // 应用退出前按依赖顺序停止后台任务、Codex 子进程并释放数据库等长期资源。
  disposeApplication,
  // 启动失败时把异常写入统一事件中心，保留可诊断证据。
  reportStartupFailure,
  // Electron 就绪后创建配置、持久化、业务服务、IPC 和主窗口组成的完整运行时。
  startApplication,
} from "./system/bootstrap/application-runtime.js";

// 等待 Electron 完成初始化，避免在宿主尚未就绪时创建服务或 BrowserWindow。
app.whenReady()
  // 宿主就绪后启动一次完整应用运行时，页面与 IPC 都由该入口统一装配。
  .then(startApplication)
  // 任一启动步骤失败都进入统一失败路径，避免留下半初始化的桌面进程。
  .catch((error) => {
    // 先记录原始异常，确保退出应用后仍能调查具体失败原因。
    reportStartupFailure(error);
    // 启动不完整时主动退出，防止用户看到无法正常工作的窗口或后台进程。
    app.quit();
  });

// 用户或系统准备退出应用时，先释放所有由运行时持有的长期资源。
app.on("before-quit", disposeApplication);

// 最后一个窗口关闭后，根据操作系统习惯决定主进程是否继续驻留。
app.on("window-all-closed", () => {
  // Windows 和 Linux 关闭全部窗口即退出；macOS 保留进程以支持从 Dock 再次激活。
  if (process.platform !== "darwin") app.quit();
});
