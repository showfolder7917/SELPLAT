import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { BrowserWindow } from "electron";

import type { WorkspaceDirectoryOutDto, WorkspaceStateOutDto } from "../../../contracts/services/support/platform/workspace/index.js";
import type { WorkspaceFacade as WorkspaceStore } from "../../services/support/platform/workspace/index.js";

type FixtureMode = "basic" | "scenarios";
type FixtureReservation = { displayName: string };
export type WorkspaceAcceptanceEnvironment = FixtureReservation & { dispose(): void };
type FixtureRegistration = { displayName: string; workspaceId: string };
type FixtureReadPath = "slow-a" | "slow-b" | "retry-once";
type FixtureReadState = { requestCount: number; pending: boolean; outcome: "not-requested" | "started" | "succeeded" | "failed" };
type ReservedFixture = { directory: string; displayName: string; consumed: boolean; mode: FixtureMode; trustedWebContentsId: number; sceneActive: boolean; workspaceId: string | null; failedPaths: Set<string>; reads: Map<FixtureReadPath, FixtureReadState> };
export const WORKSPACE_ACCEPTANCE_FIXTURE_MARKER_NAME = ".hanli-workspace-acceptance-fixture.json";
export const WORKSPACE_ACCEPTANCE_FIXTURE_MARKER = { kind: "hanli-workspace-acceptance-fixture", version: 1 } as const;
// 受控点击会在输入后很快截取画面；该窗口只用于验收夹具，确保首张截图仍能观察到目录读取中。
const SCENARIO_DIRECTORY_DELAY_MS = 2_000;

/** macOS 会把 /var 中的临时目录登记为 /private/var；夹具和工作区必须按同一真实路径识别。 */
function resolvesToSameDirectory(left: string, right: string): boolean {
  try {
    return realpathSync.native(left) === realpathSync.native(right);
  } catch {
    return path.normalize(left) === path.normalize(right);
  }
}

export interface WorkspaceAcceptanceDirectoryRead {
  fixtureLabel: string;
  scenario: "delayed" | "retry-once" | "retry-once-retry";
  result: Promise<WorkspaceDirectoryOutDto>;
}

/** 仅供当前正式夹具阶段核对请求去重的摘要，不含工作区绝对路径、目录内容或用户数据。 */
export interface WorkspaceAcceptanceDirectoryReadEvidence {
  relativePath: FixtureReadPath;
  requestCount: number;
  pending: boolean;
  outcome: FixtureReadState["outcome"];
}

/**
 * 为已获授权的真实验收临时提供一个可由原工作区登记 IPC 选择的目录。
 *
 * 生产者：桌面 IPC 组合根；消费者：工作区登记 IPC 与韩立验收会话。
 * 数据方向：主进程临时目录 -> 一次性 IPC 选择 -> 验收结束清理；禁止职责：不向 Renderer 暴露路径，也不改变正常用户目录选择。
 */
export class WorkspaceAcceptanceFixture {
  readonly #workspaces: WorkspaceStore;
  readonly #temporaryRoot: string;
  #reserved: ReservedFixture | null = null;

  constructor(workspaces: WorkspaceStore, temporaryRoot: string) {
    this.#workspaces = workspaces;
    this.#temporaryRoot = temporaryRoot;
    // 该服务在主进程启动阶段、Renderer 首次读取工作区之前创建；此处回收上次异常退出留下的私有夹具。
    this.#cleanupStaleFixtures();
  }

  /**
   * 一次准备验收所需的临时目录、真实工作区登记和页面可见状态，并返回唯一清理句柄。
   *
   * 真实传参示例：传入当前 AI Desktop 主窗口和 scenarios；真实返回示例：返回可见标签与 dispose；
   * 异常或副作用示例：任一准备步骤失败会撤销已登记根和私有目录，韩立验收不会启动。
   */
  async prepare(mode: FixtureMode, targetWindow: BrowserWindow): Promise<WorkspaceAcceptanceEnvironment> {
    if (targetWindow.isDestroyed()) throw new Error("验收主窗口已经关闭，不能准备临时工作区。");
    const reservation = this.reserve(mode, targetWindow.webContents.id);
    try {
      this.setSceneActive(true);
      await this.#addFixtureThroughVisibleWorkspacePage(targetWindow, reservation.displayName);
      if (!this.#reserved?.workspaceId) throw new Error("临时工作区未完成登记，不能开始韩立验收。");
      this.setSceneActive(false);
      let disposed = false;
      return {
        ...reservation,
        dispose: () => {
          if (disposed) return;
          disposed = true;
          this.cleanup();
        },
      };
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  /**
   * 为当前验收准备唯一目录与可预览文本，重复准备会先释放前一轮，避免跨专题复用选择。
   *
   * 真实传参示例：传入应用临时目录；真实返回示例：后续 takeDirectory 返回该目录一次。
   * 异常或副作用示例：创建失败会阻断验收；成功后目录只在 cleanup 前存在。
   */
  reserve(mode: FixtureMode = "basic", trustedWebContentsId: number): FixtureReservation {
    if (!Number.isSafeInteger(trustedWebContentsId) || trustedWebContentsId <= 0) throw new Error("验收窗口身份无效，不能签发工作区夹具。");
    this.cleanup();
    const directory = realpathSync.native(mkdtempSync(path.join(this.#temporaryRoot, "韩立验收工作区-")));
    const displayName = path.basename(directory);
    // 标记只供主进程回收异常中断的夹具，避免按目录前缀误删用户工作区。
    writeFileSync(path.join(directory, WORKSPACE_ACCEPTANCE_FIXTURE_MARKER_NAME), JSON.stringify(WORKSPACE_ACCEPTANCE_FIXTURE_MARKER), "utf8");
    writeFileSync(path.join(directory, "README.md"), "# 验收工作区\n\n用于验证左侧工作区的目录展开与只读文件预览。\n", "utf8");
    if (mode === "scenarios") {
      for (const name of ["empty", "slow-a", "slow-b", "retry-once", "工作区资源浏览-窄窗口超长目录名称验证-保持树和主查看区边界稳定"]) mkdirSync(path.join(directory, name));
      // 固定数量的尾部目录让根目录在窄窗口中必然纵向溢出，且不会遮挡前置的加载与重试场景目录。
      for (let index = 1; index <= 48; index += 1) {
        mkdirSync(path.join(directory, `z-滚动验收目录-${String(index).padStart(2, "0")}`));
      }
      writeFileSync(path.join(directory, "slow-a", "README.md"), "# 延迟目录 A\n", "utf8");
      writeFileSync(path.join(directory, "slow-b", "README.md"), "# 延迟目录 B\n", "utf8");
      writeFileSync(path.join(directory, "retry-once", "README.md"), "# 重试目录\n", "utf8");
    }
    this.#reserved = { directory, displayName, consumed: false, mode, trustedWebContentsId, sceneActive: false, workspaceId: null, failedPaths: new Set(), reads: new Map() };
    return { displayName };
  }

  /** 通过当前页面已有的“添加工作区”动作完成登记，并确认 React 页面已经显示本轮夹具标签。 */
  async #addFixtureThroughVisibleWorkspacePage(targetWindow: BrowserWindow, displayName: string): Promise<void> {
    const result = await targetWindow.webContents.executeJavaScript(`new Promise((resolve) => {
      const deadline = Date.now() + 10_000;
      let clicked = false;
      const fixtureLabel = ${JSON.stringify(displayName)};
      const check = () => {
        const pageRoot = document.getElementById("root");
        const workspaceTree = document.getElementById("developer-workspace-tree");
        if (!pageRoot?.childElementCount || !workspaceTree) {
          if (Date.now() >= deadline) return resolve("page-not-ready");
          return setTimeout(check, 50);
        }
        if (!clicked) {
          const addButton = document.querySelector('.workspace-pane .section-action[aria-label="添加"], .workspace-pane .section-action[aria-label="追加"]');
          if (!addButton) {
            if (Date.now() >= deadline) return resolve("workspace-action-missing");
            return setTimeout(check, 50);
          }
          clicked = true;
          addButton.click();
        }
        const visible = [...workspaceTree.querySelectorAll(".workspace-root-header span")]
          .some((element) => element.textContent?.trim() === fixtureLabel);
        if (visible) return resolve("ready");
        if (Date.now() >= deadline) return resolve("workspace-not-visible");
        return setTimeout(check, 50);
      };
      check();
    })`);
    if (result !== "ready") {
      throw new Error(result === "page-not-ready"
        ? "验收页面未就绪，不能开始韩立验收。"
        : result === "workspace-action-missing"
          ? "验收页面缺少工作区添加入口，不能开始韩立验收。"
          : "临时工作区未显示在验收页面，不能开始韩立验收。");
    }
  }

  /** 只有正式夹具阶段能够消费临时目录，前置真实窗口阶段必须保留夹具的初始观察状态。 */
  setSceneActive(active: boolean): void {
    if (this.#reserved) this.#reserved.sceneActive = active;
  }

  /** 已预备但尚未进入正式夹具阶段时，阻止同一验收窗口意外打开原生目录选择器。 */
  isDirectorySelectionBlocked(senderWebContentsId: number): boolean {
    const fixture = this.#reserved;
    return !!fixture && fixture.trustedWebContentsId === senderWebContentsId && (!fixture.sceneActive || fixture.consumed);
  }

  /** 原工作区添加按钮只能消费一次主进程预备的目录，未预备时仍走正常系统目录选择器。 */
  takeDirectory(senderWebContentsId: number): string | null {
    if (!this.#reserved || this.#reserved.consumed || !this.#reserved.sceneActive || this.#reserved.trustedWebContentsId !== senderWebContentsId) return null;
    this.#reserved.consumed = true;
    return this.#reserved.directory;
  }

  /** 夹具目录被原登记 IPC 接纳后才允许为这个根提供受控目录响应。 */
  registerWorkspace(senderWebContentsId: number, directory: string, state: WorkspaceStateOutDto): FixtureRegistration | null {
    if (!this.#reserved || !this.#reserved.sceneActive || this.#reserved.trustedWebContentsId !== senderWebContentsId || !resolvesToSameDirectory(this.#reserved.directory, directory)) return null;
    const workspaceId = state.roots.find((root) => resolvesToSameDirectory(root.path, directory))?.id || null;
    if (!workspaceId) return null;
    this.#reserved.workspaceId = workspaceId;
    return { displayName: this.#reserved.displayName, workspaceId };
  }

  /**
   * 仅为已签发的夹具根制造可观察的异步读取边界；普通工作区继续由真实存储同步读取。
   * 首次 retry-once 故意失败，后续重试回到真实目录读取，确保界面验证的仍是产品重试路径。
   */
  readDirectory(senderWebContentsId: number, workspaceId: string, relativePath: string): WorkspaceAcceptanceDirectoryRead | null {
    const fixture = this.#reserved;
    if (!fixture || !fixture.sceneActive || fixture.trustedWebContentsId !== senderWebContentsId || fixture.mode !== "scenarios" || fixture.workspaceId !== workspaceId) return null;
    if (relativePath === "slow-a" || relativePath === "slow-b") {
      return {
        fixtureLabel: fixture.displayName,
        scenario: "delayed",
        result: this.#trackRead(fixture, relativePath, new Promise((resolve) => setTimeout(() => resolve(this.#workspaces.listDirectory(workspaceId, relativePath)), SCENARIO_DIRECTORY_DELAY_MS))),
      };
    }
    if (relativePath === "retry-once" && !fixture.failedPaths.has(relativePath)) {
      fixture.failedPaths.add(relativePath);
      return { fixtureLabel: fixture.displayName, scenario: "retry-once", result: this.#trackRead(fixture, relativePath, Promise.reject(new Error("验收夹具模拟目录读取失败，请在原位置重试。"))) };
    }
    if (relativePath === "retry-once") {
      return {
        // 重试仍调用真实存储，并保持受控延迟，使截图能稳定观察原位“正在读取…”状态。
        fixtureLabel: fixture.displayName,
        scenario: "retry-once-retry",
        result: this.#trackRead(fixture, relativePath, new Promise((resolve) => setTimeout(() => resolve(this.#workspaces.listDirectory(workspaceId, relativePath)), SCENARIO_DIRECTORY_DELAY_MS))),
      };
    }
    return null;
  }

  /** 当前韩立窗口只能读取已签发夹具的固定目录请求摘要，用于验证重复点击未产生第二次读取。 */
  getDirectoryReadEvidence(senderWebContentsId: number, relativePath: FixtureReadPath): WorkspaceAcceptanceDirectoryReadEvidence | null {
    const fixture = this.#reserved;
    if (!fixture || !fixture.sceneActive || fixture.mode !== "scenarios" || fixture.trustedWebContentsId !== senderWebContentsId) return null;
    const state: FixtureReadState = fixture.reads.get(relativePath) || { requestCount: 0, pending: false, outcome: "not-requested" };
    return { relativePath, ...state };
  }

  /** 将夹具实际进入 IPC 的请求数与 Promise 生命周期绑定，避免截图外的推断成为验收依据。 */
  #trackRead(fixture: ReservedFixture, relativePath: FixtureReadPath, result: Promise<WorkspaceDirectoryOutDto>): Promise<WorkspaceDirectoryOutDto> {
    const state: FixtureReadState = fixture.reads.get(relativePath) || { requestCount: 0, pending: false, outcome: "not-requested" };
    state.requestCount += 1;
    state.pending = true;
    state.outcome = "started";
    fixture.reads.set(relativePath, state);
    return result.then(
      (value) => {
        state.pending = false;
        state.outcome = "succeeded";
        return value;
      },
      (error: unknown) => {
        state.pending = false;
        state.outcome = "failed";
        throw error;
      },
    );
  }

  /** 验收结束后撤销临时登记并删除目录，不把验收夹具留在用户工作区列表。 */
  cleanup(): void {
    const fixture = this.#reserved;
    if (!fixture) return;
    const root = this.#workspaces.read().roots.find((candidate) => resolvesToSameDirectory(candidate.path, fixture.directory));
    if (root) this.#workspaces.remove(root.id);
    rmSync(fixture.directory, { recursive: true, force: true });
    this.#reserved = null;
  }

  /**
   * 在主进程启动服务装配时回收应用临时根中带私有标记的遗留夹具。
   * Renderer 首次读取工作区前已经完成回收，同时不会影响任何未被本夹具标记的用户目录。
   */
  #cleanupStaleFixtures(): void {
    let temporaryRoot: string;
    try {
      temporaryRoot = realpathSync(this.#temporaryRoot);
    } catch {
      return;
    }
    for (const entry of readdirSync(temporaryRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const candidate = path.join(temporaryRoot, entry.name);
      try {
        const directory = realpathSync(candidate);
        if (path.dirname(directory) !== temporaryRoot || !this.#hasFixtureMarker(directory)) continue;
        const root = this.#workspaces.read().roots.find((item) => resolvesToSameDirectory(item.path, directory));
        if (root) this.#workspaces.remove(root.id);
        rmSync(directory, { recursive: true, force: true });
      } catch {
        // 遗留路径不可读或已被并发清理时跳过，后续新夹具仍由自身生命周期负责。
      }
    }
  }

  /** 私有标记是遗留回收的唯一授权，不接受目录前缀或外部路径作为删除依据。 */
  #hasFixtureMarker(directory: string): boolean {
    try {
      const marker = JSON.parse(readFileSync(path.join(directory, WORKSPACE_ACCEPTANCE_FIXTURE_MARKER_NAME), "utf8")) as { kind?: unknown; version?: unknown };
      return marker.kind === WORKSPACE_ACCEPTANCE_FIXTURE_MARKER.kind && marker.version === WORKSPACE_ACCEPTANCE_FIXTURE_MARKER.version;
    } catch {
      return false;
    }
  }
}
