import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { WorkspaceDirectoryEntryOutDto, WorkspaceDirectoryOutDto, WorkspaceFilePreviewOutDto, WorkspaceRootOutDto, WorkspaceStateOutDto } from "../../../../../../contracts/services/support/platform/workspace/index.js";
import type { WorkspacePermissionValue } from "../../../../../../contracts/foundation/index.js";

const MAX_ROOTS = 24;
const CURRENT_PERMISSION_DEFAULTS_VERSION = 1;
const MAX_PREVIEW_BYTES = 512 * 1024;

type StoredWorkspaceState = Partial<WorkspaceStateOutDto> & {
  permissionDefaultsVersion?: number;
};

/** 在 Electron 主进程维护可信目录清单，渲染层只能使用 ID，不能自行提交任意文件路径。 */
export class WorkspaceStore {
  readonly #filePath: string;
  readonly #defaultRoot: string;

  constructor(filePath: string, defaultRoot: string) {
    this.#filePath = filePath;
    this.#defaultRoot = validateDirectory(defaultRoot);
  }

  read(): WorkspaceStateOutDto {
    const fallbackRoot = createRoot(this.#defaultRoot, "workspace-write");
    try {
      const value = JSON.parse(readFileSync(this.#filePath, "utf8")) as StoredWorkspaceState;
      const migrateLegacyPermissions = value.permissionDefaultsVersion !== CURRENT_PERMISSION_DEFAULTS_VERSION;
      const roots = Array.isArray(value.roots)
        ? value.roots.flatMap((root) => normalizeStoredRoot(root)).slice(0, MAX_ROOTS)
        : [];
      const uniqueRoots = deduplicateRoots(roots).map((root) => migrateLegacyPermissions
        ? { ...root, permission: "workspace-write" as const }
        : root);
      if (!uniqueRoots.some((root) => samePath(root.path, fallbackRoot.path))) uniqueRoots.unshift(fallbackRoot);
      const primaryId = uniqueRoots.some((root) => root.id === value.primaryId)
        ? String(value.primaryId)
        : uniqueRoots[0].id;
      const state = { primaryId, roots: uniqueRoots };
      return migrateLegacyPermissions ? this.#write(state) : state;
    } catch {
      return { primaryId: fallbackRoot.id, roots: [fallbackRoot] };
    }
  }

  add(directoryPath: string): WorkspaceStateOutDto {
    const state = this.read();
    const directory = validateDirectory(directoryPath);
    if (state.roots.some((root) => samePath(root.path, directory))) return state;
    if (state.roots.length >= MAX_ROOTS) throw new Error(`Workspace limit is ${MAX_ROOTS}.`);
    return this.#write({ ...state, roots: [...state.roots, createRoot(directory, "workspace-write")] });
  }

  updatePermission(id: string, permission: WorkspacePermissionValue): WorkspaceStateOutDto {
    if (permission !== "read-only" && permission !== "workspace-write") {
      throw new Error("Invalid workspace permission.");
    }
    const state = this.read();
    this.#requireRoot(state, id);
    return this.#write({
      ...state,
      roots: state.roots.map((root) => root.id === id ? { ...root, permission } : root),
    });
  }

  setPrimary(id: string): WorkspaceStateOutDto {
    const state = this.read();
    this.#requireRoot(state, id);
    return this.#write({ ...state, primaryId: id });
  }

  remove(id: string): WorkspaceStateOutDto {
    const state = this.read();
    this.#requireRoot(state, id);
    if (state.roots.length === 1) throw new Error("At least one workspace is required.");
    const roots = state.roots.filter((root) => root.id !== id);
    return this.#write({ primaryId: state.primaryId === id ? roots[0].id : state.primaryId, roots });
  }

  /** 列出登记根内的一层目录；符号链接不作为可浏览项返回，避免跨根追踪。 */
  listDirectory(id: string, relativePath = ""): WorkspaceDirectoryOutDto {
    const directory = this.#resolveInsideWorkspace(id, relativePath, "directory");
    const entries: WorkspaceDirectoryEntryOutDto[] = readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) => {
        if (!entry.isDirectory() && !entry.isFile()) return [];
        return [{
          name: entry.name,
          relativePath: relativePath ? `${relativePath}/${entry.name}` : entry.name,
          kind: entry.isDirectory() ? "directory" as const : "file" as const,
        }];
      })
      .sort((left, right) => left.kind === right.kind
        ? left.name.localeCompare(right.name)
        : left.kind === "directory" ? -1 : 1);
    return { workspaceId: id, relativePath, entries };
  }

  /** 读取登记根内的 UTF-8 常规文件；大文件和二进制文件不会进入 Renderer。 */
  readFilePreview(id: string, relativePath: string): WorkspaceFilePreviewOutDto {
    const filePath = this.#resolveInsideWorkspace(id, relativePath, "file");
    const bytes = readFileSync(filePath);
    if (bytes.byteLength > MAX_PREVIEW_BYTES) throw new Error("文件超过应用内预览大小限制。");
    if (bytes.includes(0)) throw new Error("该文件不是可预览的文本文件。");
    let content: string;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Error("该文件不是 UTF-8 文本，无法在应用内预览。");
    }
    return { kind: "preview", workspaceId: id, relativePath, content };
  }

  /** 仅供工作区门面在执行受控系统动作前取得已校验的真实普通文件。 */
  resolveFile(id: string, relativePath: string): string {
    return this.#resolveInsideWorkspace(id, relativePath, "file");
  }

  #requireRoot(state: WorkspaceStateOutDto, id: string): WorkspaceRootOutDto {
    if (typeof id !== "string") throw new Error("Invalid workspace id.");
    const root = state.roots.find((candidate) => candidate.id === id);
    if (!root) throw new Error("Workspace is not registered.");
    return root;
  }

  /** 把 Renderer 提供的相对位置绑定到已登记根，并在解析符号链接后再次验证边界。 */
  #resolveInsideWorkspace(id: string, relativePath: string, expectedKind: "directory" | "file"): string {
    if (typeof relativePath !== "string" || path.isAbsolute(relativePath)) throw new Error("工作区路径必须是相对路径。");
    const segments = relativePath.split(/[\\/]/u).filter(Boolean);
    if (segments.some((segment) => segment === "." || segment === "..")) throw new Error("工作区路径包含不允许的层级。");
    const root = this.#requireRoot(this.read(), id);
    const rootPath = realpathSync.native(root.path);
    const candidate = path.resolve(rootPath, ...segments);
    assertInsideRoot(rootPath, candidate);
    const resolved = realpathSync.native(candidate);
    assertInsideRoot(rootPath, resolved);
    const stats = lstatSync(resolved);
    if (expectedKind === "directory" && !stats.isDirectory()) throw new Error("目标不是目录。");
    if (expectedKind === "file" && !stats.isFile()) throw new Error("目标不是普通文件。");
    return resolved;
  }

  #write(state: WorkspaceStateOutDto): WorkspaceStateOutDto {
    const temporaryPath = `${this.#filePath}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify({ permissionDefaultsVersion: CURRENT_PERMISSION_DEFAULTS_VERSION, ...state }, null, 2), "utf8");
    renameSync(temporaryPath, this.#filePath);
    return state;
  }
}

function normalizeStoredRoot(value: unknown): WorkspaceRootOutDto[] {
  if (!value || typeof value !== "object") return [];
  const candidate = value as Partial<WorkspaceRootOutDto>;
  if (typeof candidate.path !== "string") return [];
  try {
    const directory = validateDirectory(candidate.path);
    return [createRoot(directory, candidate.permission === "workspace-write" ? "workspace-write" : "read-only")];
  } catch {
    return [];
  }
}

function createRoot(directoryPath: string, permission: WorkspacePermissionValue): WorkspaceRootOutDto {
  return {
    id: createHash("sha256").update(normalizeForComparison(directoryPath)).digest("hex").slice(0, 16),
    name: path.basename(directoryPath) || directoryPath,
    path: directoryPath,
    permission,
  };
}

function validateDirectory(directoryPath: string): string {
  if (typeof directoryPath !== "string" || !path.isAbsolute(directoryPath) || !existsSync(directoryPath)) {
    throw new Error("Workspace must be an existing absolute directory.");
  }
  const resolved = realpathSync.native(directoryPath);
  if (!lstatSync(resolved).isDirectory()) throw new Error("Workspace must be a directory.");
  const parsed = path.parse(resolved);
  if (resolved === parsed.root || samePath(resolved, os.homedir())) {
    throw new Error("Filesystem root and home directory cannot be registered as a workspace.");
  }
  return resolved;
}

function deduplicateRoots(roots: WorkspaceRootOutDto[]): WorkspaceRootOutDto[] {
  return roots.filter((root, index) => roots.findIndex((candidate) => samePath(candidate.path, root.path)) === index);
}

function samePath(left: string, right: string): boolean {
  return normalizeForComparison(left) === normalizeForComparison(right);
}

function normalizeForComparison(value: string): string {
  const normalized = path.normalize(value);
  return process.platform === "win32" ? normalized.toLocaleLowerCase("en-US") : normalized;
}

function assertInsideRoot(rootPath: string, candidatePath: string): void {
  const relative = path.relative(rootPath, candidatePath);
  if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) return;
  throw new Error("工作区读取路径超出已登记目录。");
}
