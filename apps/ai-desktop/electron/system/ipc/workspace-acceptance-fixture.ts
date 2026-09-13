import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { WorkspaceDirectoryOutDto, WorkspaceStateOutDto } from "../../../contracts/services/support/platform/workspace/index.js";
import type { WorkspaceFacade as WorkspaceStore } from "../../services/support/platform/workspace/index.js";

type FixtureMode = "basic" | "scenarios";
type FixtureReservation = { displayName: string };
type FixtureRegistration = { displayName: string; workspaceId: string };
type ReservedFixture = { directory: string; displayName: string; consumed: boolean; mode: FixtureMode; workspaceId: string | null; failedPaths: Set<string> };
const FIXTURE_MARKER_NAME = ".hanli-workspace-acceptance-fixture.json";
const FIXTURE_MARKER = { kind: "hanli-workspace-acceptance-fixture", version: 1 };
// 受控点击会在输入后很快截取画面；该窗口只用于验收夹具，确保首张截图仍能观察到目录读取中。
const SCENARIO_DIRECTORY_DELAY_MS = 2_000;

export interface WorkspaceAcceptanceDirectoryRead {
  fixtureLabel: string;
  scenario: "delayed" | "retry-once" | "retry-once-retry";
  result: Promise<WorkspaceDirectoryOutDto>;
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
  }

  /**
   * 为当前验收准备唯一目录与可预览文本，重复准备会先释放前一轮，避免跨专题复用选择。
   *
   * 真实传参示例：传入应用临时目录；真实返回示例：后续 takeDirectory 返回该目录一次。
   * 异常或副作用示例：创建失败会阻断验收；成功后目录只在 cleanup 前存在。
   */
  reserve(mode: FixtureMode = "basic"): FixtureReservation {
    this.cleanup();
    this.#cleanupStaleFixtures();
    const directory = mkdtempSync(path.join(this.#temporaryRoot, "韩立验收工作区-"));
    const displayName = path.basename(directory);
    // 标记只供主进程回收异常中断的夹具，避免按目录前缀误删用户工作区。
    writeFileSync(path.join(directory, FIXTURE_MARKER_NAME), JSON.stringify(FIXTURE_MARKER), "utf8");
    writeFileSync(path.join(directory, "README.md"), "# 验收工作区\n\n用于验证左侧工作区的目录展开与只读文件预览。\n", "utf8");
    if (mode === "scenarios") {
      for (const name of ["empty", "slow-a", "slow-b", "retry-once", "工作区资源浏览-窄窗口超长目录名称验证-保持树和主查看区边界稳定"]) mkdirSync(path.join(directory, name));
      writeFileSync(path.join(directory, "slow-a", "README.md"), "# 延迟目录 A\n", "utf8");
      writeFileSync(path.join(directory, "slow-b", "README.md"), "# 延迟目录 B\n", "utf8");
      writeFileSync(path.join(directory, "retry-once", "README.md"), "# 重试目录\n", "utf8");
    }
    this.#reserved = { directory, displayName, consumed: false, mode, workspaceId: null, failedPaths: new Set() };
    return { displayName };
  }

  /** 原工作区添加按钮只能消费一次主进程预备的目录，未预备时仍走正常系统目录选择器。 */
  takeDirectory(): string | null {
    if (!this.#reserved || this.#reserved.consumed) return null;
    this.#reserved.consumed = true;
    return this.#reserved.directory;
  }

  /** 夹具目录被原登记 IPC 接纳后才允许为这个根提供受控目录响应。 */
  registerWorkspace(directory: string, state: WorkspaceStateOutDto): FixtureRegistration | null {
    if (!this.#reserved || this.#reserved.directory !== directory) return null;
    const workspaceId = state.roots.find((root) => root.path === directory)?.id || null;
    if (!workspaceId) return null;
    this.#reserved.workspaceId = workspaceId;
    return { displayName: this.#reserved.displayName, workspaceId };
  }

  /**
   * 仅为已签发的夹具根制造可观察的异步读取边界；普通工作区继续由真实存储同步读取。
   * 首次 retry-once 故意失败，后续重试回到真实目录读取，确保界面验证的仍是产品重试路径。
   */
  readDirectory(workspaceId: string, relativePath: string): WorkspaceAcceptanceDirectoryRead | null {
    const fixture = this.#reserved;
    if (!fixture || fixture.mode !== "scenarios" || fixture.workspaceId !== workspaceId) return null;
    if (relativePath === "slow-a" || relativePath === "slow-b") {
      return {
        fixtureLabel: fixture.displayName,
        scenario: "delayed",
        result: new Promise((resolve) => setTimeout(() => resolve(this.#workspaces.listDirectory(workspaceId, relativePath)), SCENARIO_DIRECTORY_DELAY_MS)),
      };
    }
    if (relativePath === "retry-once" && !fixture.failedPaths.has(relativePath)) {
      fixture.failedPaths.add(relativePath);
      return { fixtureLabel: fixture.displayName, scenario: "retry-once", result: Promise.reject(new Error("验收夹具模拟目录读取失败，请在原位置重试。")) };
    }
    if (relativePath === "retry-once") {
      return {
        // 重试仍调用真实存储；保留场景身份只为让验收审计能区分首次失败与恢复成功。
        fixtureLabel: fixture.displayName,
        scenario: "retry-once-retry",
        result: Promise.resolve(this.#workspaces.listDirectory(workspaceId, relativePath)),
      };
    }
    return null;
  }

  /** 验收结束后撤销临时登记并删除目录，不把验收夹具留在用户工作区列表。 */
  cleanup(): void {
    const fixture = this.#reserved;
    if (!fixture) return;
    const root = this.#workspaces.read().roots.find((candidate) => candidate.path === fixture.directory);
    if (root) this.#workspaces.remove(root.id);
    rmSync(fixture.directory, { recursive: true, force: true });
    this.#reserved = null;
  }

  /**
   * 仅在新一轮验收开始前回收应用临时根中带私有标记的遗留夹具。
   * 这样异常退出不会让下一轮错误复用旧根，也不会影响任何未被本夹具标记的用户目录。
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
        const root = this.#workspaces.read().roots.find((item) => path.normalize(item.path) === path.normalize(directory));
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
      const marker = JSON.parse(readFileSync(path.join(directory, FIXTURE_MARKER_NAME), "utf8")) as { kind?: unknown; version?: unknown };
      return marker.kind === FIXTURE_MARKER.kind && marker.version === FIXTURE_MARKER.version;
    } catch {
      return false;
    }
  }
}
