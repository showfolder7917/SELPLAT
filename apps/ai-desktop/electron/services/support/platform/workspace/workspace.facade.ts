import path from "node:path";

import type { WorkspaceDirectoryOutDto, WorkspaceFileOpenOutDto, WorkspaceStateOutDto, WorkspaceSystemFileOpenFailedOutDto } from "../../../../../contracts/services/support/platform/workspace/index.js";
import type { WorkspacePermissionValue } from "../../../../../contracts/foundation/index.js";
import { WorkspaceStore } from "./internal/workspace.store.js";

/** 由主进程组合根提供的系统文件打开能力；只接收门面已完成边界校验的真实文件。 */
export type OpenWorkspaceSystemFile = (filePath: string) => Promise<void>;

/**
 * 工作区平台的唯一文件入口。
 *
 * 生产者：Electron 主进程工作区平台。
 * 消费者：工作区 IPC 和 Codex 工作区配置。
 * 数据方向：受控相对路径进入，预览或系统打开结果返回。
 * 禁止职责：不向 Renderer 公开真实路径，也不让 Renderer 判断文件类型或调用系统 shell。
 */
export class WorkspaceFacade {
  readonly #store: WorkspaceStore;
  readonly #openSystemFile: OpenWorkspaceSystemFile;

  constructor(filePath: string, defaultRoot: string, openSystemFile: OpenWorkspaceSystemFile) {
    this.#store = new WorkspaceStore(filePath, defaultRoot);
    this.#openSystemFile = openSystemFile;
  }

  read(): WorkspaceStateOutDto { return this.#store.read(); }
  add(directoryPath: string): WorkspaceStateOutDto { return this.#store.add(directoryPath); }
  updatePermission(id: string, permission: WorkspacePermissionValue): WorkspaceStateOutDto { return this.#store.updatePermission(id, permission); }
  setPrimary(id: string): WorkspaceStateOutDto { return this.#store.setPrimary(id); }
  remove(id: string): WorkspaceStateOutDto { return this.#store.remove(id); }
  listDirectory(id: string, relativePath = ""): WorkspaceDirectoryOutDto { return this.#store.listDirectory(id, relativePath); }

  /**
   * 按已登记根打开一个文件。
   * 传参示例：openFile("workspace-a", "需求/演示.pptx")。
   * 返回示例：文本返回 kind="preview"，演示文稿返回 kind="system-opened"。
   * 副作用：仅 PPT/PPTX 会调用受控系统默认应用；失败不会泄露真实路径。
   */
  async openFile(id: string, relativePath: string): Promise<WorkspaceFileOpenOutDto | WorkspaceSystemFileOpenFailedOutDto> {
    const resolvedFilePath = this.#store.resolveFile(id, relativePath);
    if (!isPresentationFile(resolvedFilePath)) return this.#store.readFilePreview(id, relativePath);
    try {
      await this.#openSystemFile(resolvedFilePath);
      return { kind: "system-opened", workspaceId: id, relativePath };
    } catch {
      return { kind: "system-open-failed", workspaceId: id, relativePath, message: "无法使用系统默认应用打开该演示文稿。" };
    }
  }
}

function isPresentationFile(filePath: string): boolean {
  const extension = path.extname(filePath).toLocaleLowerCase("en-US");
  return extension === ".ppt" || extension === ".pptx";
}
