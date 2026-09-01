import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import type {
  WorkspaceEntry,
  WorkspaceRoot,
  WorkspaceState,
} from "../../../../../contracts/platform/workspace/index.js";
import type { WorkspacePermission } from "../../../../../contracts/foundation/base.js";

const MAX_ROOTS = 24;
const MAX_ENTRIES = 80;
const CURRENT_PERMISSION_DEFAULTS_VERSION = 1;

type StoredWorkspaceState = Partial<WorkspaceState> & {
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

  read(): WorkspaceState {
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

  add(directoryPath: string): WorkspaceState {
    const state = this.read();
    const directory = validateDirectory(directoryPath);
    if (state.roots.some((root) => samePath(root.path, directory))) return state;
    if (state.roots.length >= MAX_ROOTS) throw new Error(`Workspace limit is ${MAX_ROOTS}.`);
    return this.#write({ ...state, roots: [...state.roots, createRoot(directory, "workspace-write")] });
  }

  updatePermission(id: string, permission: WorkspacePermission): WorkspaceState {
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

  setPrimary(id: string): WorkspaceState {
    const state = this.read();
    this.#requireRoot(state, id);
    return this.#write({ ...state, primaryId: id });
  }

  remove(id: string): WorkspaceState {
    const state = this.read();
    this.#requireRoot(state, id);
    if (state.roots.length === 1) throw new Error("At least one workspace is required.");
    const roots = state.roots.filter((root) => root.id !== id);
    return this.#write({ primaryId: state.primaryId === id ? roots[0].id : state.primaryId, roots });
  }

  listEntries(id: string): WorkspaceEntry[] {
    const root = this.#requireRoot(this.read(), id);
    return readdirSync(root.path, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith(".") && (entry.isDirectory() || entry.isFile()))
      .sort((left, right) => Number(right.isDirectory()) - Number(left.isDirectory()) || left.name.localeCompare(right.name))
      .slice(0, MAX_ENTRIES)
      .map((entry) => ({ name: entry.name, kind: entry.isDirectory() ? "directory" : "file" }));
  }

  #requireRoot(state: WorkspaceState, id: string): WorkspaceRoot {
    if (typeof id !== "string") throw new Error("Invalid workspace id.");
    const root = state.roots.find((candidate) => candidate.id === id);
    if (!root) throw new Error("Workspace is not registered.");
    return root;
  }

  #write(state: WorkspaceState): WorkspaceState {
    const temporaryPath = `${this.#filePath}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify({ permissionDefaultsVersion: CURRENT_PERMISSION_DEFAULTS_VERSION, ...state }, null, 2), "utf8");
    renameSync(temporaryPath, this.#filePath);
    return state;
  }
}

function normalizeStoredRoot(value: unknown): WorkspaceRoot[] {
  if (!value || typeof value !== "object") return [];
  const candidate = value as Partial<WorkspaceRoot>;
  if (typeof candidate.path !== "string") return [];
  try {
    const directory = validateDirectory(candidate.path);
    return [createRoot(directory, candidate.permission === "workspace-write" ? "workspace-write" : "read-only")];
  } catch {
    return [];
  }
}

function createRoot(directoryPath: string, permission: WorkspacePermission): WorkspaceRoot {
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

function deduplicateRoots(roots: WorkspaceRoot[]): WorkspaceRoot[] {
  return roots.filter((root, index) => roots.findIndex((candidate) => samePath(candidate.path, root.path)) === index);
}

function samePath(left: string, right: string): boolean {
  return normalizeForComparison(left) === normalizeForComparison(right);
}

function normalizeForComparison(value: string): string {
  const normalized = path.normalize(value);
  return process.platform === "win32" ? normalized.toLocaleLowerCase("en-US") : normalized;
}
