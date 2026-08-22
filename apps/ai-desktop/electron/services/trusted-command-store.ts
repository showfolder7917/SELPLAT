import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { WorkspaceState } from "../../shared/contracts/desktop.js";

interface TrustedCommandEntry {
  id: string;
  projectRoot: string;
  cwd: string;
  command: string;
  scriptSignature: string;
  createdAt: string;
}

export interface TrustedCommandResult {
  trusted: boolean;
  projectRoot: string | null;
}

/** 只持久化用户明确允许的项目内固定命令，避免把一次允许扩张成全局 Shell 放行。 */
export class TrustedCommandStore {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  isTrusted(command: string, cwd: string | null, workspaces: WorkspaceState | null): TrustedCommandResult {
    const identity = this.#identity(command, cwd, workspaces);
    if (!identity) return { trusted: false, projectRoot: null };
    const trusted = this.#read().some((entry) =>
      entry.projectRoot === identity.projectRoot
      && entry.cwd === identity.cwd
      && entry.command === identity.command
      && entry.scriptSignature === identity.scriptSignature,
    );
    return { trusted, projectRoot: identity.projectRoot };
  }

  trust(command: string, cwd: string | null, workspaces: WorkspaceState | null): TrustedCommandResult {
    const identity = this.#identity(command, cwd, workspaces);
    if (!identity) return { trusted: false, projectRoot: null };
    const entries = this.#read().filter((entry) => entry.id !== identity.id);
    this.#write([...entries, { ...identity, createdAt: new Date().toISOString() }]);
    return { trusted: true, projectRoot: identity.projectRoot };
  }

  canTrust(command: string | null, cwd: string | null, workspaces: WorkspaceState | null): boolean {
    return Boolean(command && this.#identity(command, cwd, workspaces));
  }

  count(): number {
    return this.#read().length;
  }

  clear(): void {
    this.#write([]);
  }

  #identity(command: string, cwd: string | null, workspaces: WorkspaceState | null): Omit<TrustedCommandEntry, "createdAt"> | null {
    if (!cwd || !workspaces || !command.trim() || command.length > 20_000 || isAlwaysReviewCommand(command)) return null;
    let resolvedCwd: string;
    try {
      resolvedCwd = realpathSync.native(cwd);
    } catch {
      return null;
    }
    const workspace = workspaces.roots.find((root) => isInside(resolvedCwd, root.path));
    if (!workspace) return null;
    // 命令文本必须逐字匹配；引号内空白也可能改变真实参数，不能为了展示而折叠。
    const normalizedCommand = command.trim();
    const scriptSignature = commandScriptSignature(normalizedCommand, resolvedCwd, workspace.path);
    const id = createHash("sha256")
      .update(`${workspace.path}\0${resolvedCwd}\0${normalizedCommand}\0${scriptSignature}`)
      .digest("hex");
    return { id, projectRoot: workspace.path, cwd: resolvedCwd, command: normalizedCommand, scriptSignature };
  }

  #read(): TrustedCommandEntry[] {
    try {
      const value = JSON.parse(readFileSync(this.#filePath, "utf8"));
      if (!Array.isArray(value)) return [];
      return value.filter(isStoredEntry).slice(-500);
    } catch {
      return [];
    }
  }

  #write(entries: TrustedCommandEntry[]): void {
    mkdirSync(path.dirname(this.#filePath), { recursive: true });
    const temporaryPath = `${this.#filePath}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify(entries, null, 2), "utf8");
    renameSync(temporaryPath, this.#filePath);
  }
}

/** 删除、提权、权限扩张和破坏 Git 状态的命令即使曾允许也必须继续逐次审批。 */
export function isAlwaysReviewCommand(command: string): boolean {
  return /(?:^|[^a-zA-Z0-9_./-])(?:sudo|su|doas|rm|rmdir|del|erase|chmod|chown|takeown|icacls|Remove-Item)(?=\s|["']|$)|\bgit\s+(?:reset\s+--hard|clean\s+-|checkout\s+--)\b/i.test(command);
}

function commandScriptSignature(command: string, cwd: string, projectRoot: string): string {
  const scriptName = /\b(?:npm(?:\.cmd)?|pnpm|yarn)\s+(?:run\s+)?([a-zA-Z0-9:_-]+)/i.exec(command)?.[1];
  if (!scriptName) return createHash("sha256").update(command).digest("hex");
  let directory = cwd;
  while (isInside(directory, projectRoot)) {
    const manifestPath = path.join(directory, "package.json");
    if (existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { scripts?: Record<string, unknown> };
        const script = manifest.scripts?.[scriptName];
        if (typeof script === "string") {
          return createHash("sha256").update(`${scriptName}\0${script}`).digest("hex");
        }
      } catch {
        return "invalid-package-script";
      }
    }
    if (samePath(directory, projectRoot)) break;
    directory = path.dirname(directory);
  }
  return "missing-package-script";
}

function isInside(candidate: string, parent: string): boolean {
  let resolvedParent: string;
  try {
    resolvedParent = realpathSync.native(parent);
  } catch {
    return false;
  }
  const relative = path.relative(resolvedParent, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function samePath(left: string, right: string): boolean {
  const normalize = (value: string) => process.platform === "win32" ? path.normalize(value).toLowerCase() : path.normalize(value);
  return normalize(left) === normalize(right);
}

function isStoredEntry(value: unknown): value is TrustedCommandEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<TrustedCommandEntry>;
  return typeof entry.id === "string"
    && typeof entry.projectRoot === "string"
    && typeof entry.cwd === "string"
    && typeof entry.command === "string"
    && typeof entry.scriptSignature === "string"
    && typeof entry.createdAt === "string";
}
