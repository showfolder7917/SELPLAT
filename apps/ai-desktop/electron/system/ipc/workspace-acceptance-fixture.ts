import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { WorkspaceFacade as WorkspaceStore } from "../../services/support/platform/workspace/index.js";

type ReservedFixture = { directory: string; consumed: boolean };

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
  reserve(): void {
    this.cleanup();
    const directory = mkdtempSync(path.join(this.#temporaryRoot, "hanli-workspace-acceptance-"));
    writeFileSync(path.join(directory, "README.md"), "# 验收工作区\n\n用于验证左侧工作区的目录展开与只读文件预览。\n", "utf8");
    this.#reserved = { directory, consumed: false };
  }

  /** 原工作区添加按钮只能消费一次主进程预备的目录，未预备时仍走正常系统目录选择器。 */
  takeDirectory(): string | null {
    if (!this.#reserved || this.#reserved.consumed) return null;
    this.#reserved.consumed = true;
    return this.#reserved.directory;
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
}
