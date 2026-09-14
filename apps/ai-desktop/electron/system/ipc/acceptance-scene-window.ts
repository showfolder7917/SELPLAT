import path from "node:path";
import type { BrowserWindow, BrowserWindowConstructorOptions } from "electron";
import type { AcceptanceSceneSegmentOutDto, CollaborationStateProjectionFixtureContextOutDto, CrossTaskMemberOccupancyFixtureContextOutDto, MemberIdleFixtureContextOutDto } from "../../../contracts/services/personas/hanli/index.js";
import type { AcceptanceEmptyTaskGroupSession } from "./acceptance-empty-task-group-session.js";
import type { CollaborationTimelineSnapshotOutDto } from "../../../contracts/services/workflow/index.js";

interface SceneWindowOptions {
  /** 只有复用真实页面时才需要持续持有主窗口；独立场景只使用规划前冻结的尺寸。 */
  target?: BrowserWindow;
  targetBounds: { x: number; y: number; width: number; height: number };
  preloadPath: string;
  rendererRoot: string;
  sessions: AcceptanceEmptyTaskGroupSession;
  createWindow(options: BrowserWindowConstructorOptions): BrowserWindow;
  taskHandoff?: CollaborationTimelineSnapshotOutDto;
  crossTaskMemberOccupancyFixture?: CrossTaskMemberOccupancyFixtureContextOutDto;
  memberIdleFixture?: MemberIdleFixtureContextOutDto;
  collaborationStateProjectionFixture?: CollaborationStateProjectionFixtureContextOutDto;
}

/** 场景窗口拥有创建、就绪验证和回收，失败也不会留下注册或多余窗口。 */
export async function prepareAcceptanceSceneWindow(plan: AcceptanceSceneSegmentOutDto, options: SceneWindowOptions): Promise<{ window: BrowserWindow; dispose(): void }> {
  if (plan.kind === "blocked") throw new Error(`验收场景尚未就绪：${plan.reason}`);
  if (plan.kind === "persona-conversation-with-task-handoff" && !options.taskHandoff?.groups.length) {
    throw new Error("人物会话与任务交接复合场景缺少当前专题的只读交接记录。");
  }
  if (plan.kind === "current-window" || plan.kind === "workspace-explorer-fixture" || plan.kind === "workspace-lifecycle-review") {
    if (!options.target || options.target.isDestroyed()) throw new Error("验收主窗口已经关闭。");
    return { window: options.target, dispose() {} };
  }
  const window = options.createWindow({
    // 场景规划可能等待模型响应；独立窗口沿用开始时的可见尺寸，不读取已关闭的主窗口对象。
    ...options.targetBounds, frame: false, show: false, backgroundColor: "#080b12",
    title: plan.kind === "completed-recovery-timeline" ? "AI Desktop 独立完成恢复验收" : plan.kind === "member-idle" ? "AI Desktop 独立人物空闲验收" : plan.kind === "inspection-lifecycle-timeline" ? "AI Desktop 独立巡检生命周期验收" : plan.kind === "user-language-detail-timeline" ? "AI Desktop 独立任务卡详情验收" : plan.kind === "recovery-action-lifecycle" ? "AI Desktop 独立恢复入口验收" : plan.kind === "persona-conversation-lifecycle" || plan.kind === "persona-conversation-with-task-handoff" ? "AI Desktop 独立人物会话验收" : "AI Desktop 独立空状态验收",
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
  options.sessions.register(contentsId, plan.kind, options.taskHandoff, options.crossTaskMemberOccupancyFixture, options.collaborationStateProjectionFixture, options.memberIdleFixture);
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
