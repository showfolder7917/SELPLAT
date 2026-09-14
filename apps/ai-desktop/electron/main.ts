/** Electron 生命周期入口；系统装配位于 system，日常业务实现位于 services。 */
// Electron 的 app 对象负责应用就绪、退出和窗口全部关闭等主进程生命周期事件。
import { app } from "electron";

let disposeApplication = (): void => undefined;
let reportStartupFailure = (error: unknown): void => console.error("AI Desktop startup failed", error);

app.whenReady()
  .then(async () => {
    // 延迟装载运行时，让启动上下文异常也进入统一失败出口，避免 Electron 弹出阻塞父进程的原生错误框。
    const runtime = await import("./system/bootstrap/application-runtime.js");
    disposeApplication = runtime.disposeApplication;
    reportStartupFailure = runtime.reportStartupFailure;
    await runtime.startApplication();
  })
  .catch((error) => {
    // 保留原始异常后退出，避免留下半初始化的窗口和后台进程。
    reportStartupFailure(error);
    app.exit(1);
  });

// 用户或系统准备退出应用时，先释放所有由运行时持有的长期资源。
app.on("before-quit", disposeApplication);

// 最后一个窗口关闭后，根据操作系统习惯决定主进程是否继续驻留。
app.on("window-all-closed", () => {
  // macOS 保留进程以支持从 Dock 再次激活。
  if (process.platform !== "darwin") app.quit();
});
