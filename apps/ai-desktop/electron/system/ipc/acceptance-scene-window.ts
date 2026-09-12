import path from "node:path";
import type { BrowserWindow, BrowserWindowConstructorOptions } from "electron";
import type { AcceptanceScenePlanOutDto } from "../../../contracts/services/personas/hanli/index.js";
import type { AcceptanceEmptyTaskGroupSession } from "./acceptance-empty-task-group-session.js";

interface SceneWindowOptions {
  target: BrowserWindow;
  preloadPath: string;
  rendererRoot: string;
  sessions: AcceptanceEmptyTaskGroupSession;
  createWindow(options: BrowserWindowConstructorOptions): BrowserWindow;
}

/** 场景窗口拥有创建、就绪验证和回收，失败也不会留下注册或多余窗口。 */
export async function prepareAcceptanceSceneWindow(plan: AcceptanceScenePlanOutDto, options: SceneWindowOptions): Promise<{ window: BrowserWindow; dispose(): void }> {
  if (plan.kind === "blocked") throw new Error(`验收场景尚未就绪：${plan.reason}`);
  if (options.target.isDestroyed()) throw new Error("验收主窗口已经关闭。");
  if (plan.kind === "current-window") return { window: options.target, dispose() {} };
  const window = options.createWindow({
    ...options.target.getBounds(), frame: false, show: false, backgroundColor: "#080b12",
    title: plan.kind === "failure-recovery-timeline" ? "AI Desktop 独立失败恢复验收" : "AI Desktop 独立空状态验收",
    webPreferences: { preload: options.preloadPath, contextIsolation: true, nodeIntegration: false, sandbox: true,
      // 不使用 persist 前缀，关闭后不会向正式会话写入空状态。
      partition: `acceptance-empty-${Date.now()}`,
      additionalArguments: ["--hanli-empty-task-group-acceptance", `--hanli-acceptance-scene=${plan.kind}`] },
  });
  const contentsId = window.webContents.id;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    options.sessions.remove(contentsId);
    if (!window.isDestroyed()) window.close();
  };
  options.sessions.register(contentsId, plan.kind);
  window.once("closed", dispose);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    // loadFile 的拒绝和卡住都属于环境失败；放在回收边界内，绝不触发产品失败。
    await Promise.race([
      (async () => {
        await window.loadFile(path.join(options.rendererRoot, "index.html"));
        if (window.isDestroyed() || !options.sessions.isActive(contentsId)) throw new Error("独立验收窗口在准备期间关闭。");
        // 仅验证应用已挂载与数据投影已登记，控件布局和行为由韩立真实截图判断。
        const mounted = await window.webContents.executeJavaScript(`new Promise((resolve) => {
          const deadline = Date.now() + 10000;
          const check = () => {
            if (document.getElementById("root")?.childElementCount) return resolve(true);
            if (Date.now() >= deadline) return resolve(false);
            setTimeout(check, 100);
          };
          check();
        })`);
        if (mounted !== true) throw new Error("独立验收窗口未呈现应用页面。");
      })(),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("独立验收窗口准备超时。")), 15_000); }),
    ]);
    if (disposed || window.isDestroyed()) throw new Error("独立验收窗口在准备期间关闭。");
    window.show();
    return { window, dispose };
  } catch (error) {
    dispose();
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
