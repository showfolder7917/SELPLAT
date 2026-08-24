import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { WorkspaceState } from "../../contracts/desktop.js";

interface TrustedCommandEntry {
  id: string;
  projectRoot: string;
  cwd: string;
  command: string;
  scriptSignature: string;
  createdAt: string;
  scope?: "exact-command" | "automatic-test-document";
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
      && entry.scriptSignature === identity.scriptSignature
      && (entry.command === identity.command
        || (entry.scope === "automatic-test-document" && isAutomaticTestDocumentCommand(identity.command)))
    );
    return { trusted, projectRoot: identity.projectRoot };
  }

  trust(command: string, cwd: string | null, workspaces: WorkspaceState | null): TrustedCommandResult {
    const identity = this.#identity(command, cwd, workspaces);
    if (!identity) return { trusted: false, projectRoot: null };
    const entries = this.#read().filter((entry) => entry.id !== identity.id);
    this.#write([...entries, { ...identity, scope: "exact-command", createdAt: new Date().toISOString() }]);
    return { trusted: true, projectRoot: identity.projectRoot };
  }

  /** 用户开启自动测试时只登记无附加参数的共享测试入口，其他命令仍继续走官方逐次审批。 */
  trustAutomaticTestDocument(cwd: string, workspaces: WorkspaceState | null): TrustedCommandResult {
    const identity = this.#identity("npm run test:document", cwd, workspaces);
    if (!identity || identity.scriptSignature === "missing-package-script" || identity.scriptSignature === "invalid-package-script") {
      return { trusted: false, projectRoot: null };
    }
    const entries = this.#read().filter((entry) => !(entry.scope === "automatic-test-document"
      && entry.projectRoot === identity.projectRoot
      && entry.cwd === identity.cwd));
    this.#write([...entries, { ...identity, scope: "automatic-test-document", createdAt: new Date().toISOString() }]);
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
    && typeof entry.createdAt === "string"
    && (entry.scope === undefined || entry.scope === "exact-command" || entry.scope === "automatic-test-document");
}

/** 自动测试授权只接受一条无参数 npm 脚本，Shell 拼接、重定向或附加参数都会失去信任。 */
export function isAutomaticTestDocumentCommand(command: string): boolean {
  const normalized = command.trim();
  if (/^npm(?:\.cmd)?\s+run\s+test:document$/i.test(normalized)) return true;
  const macShell = normalized.match(/^\/bin\/(?:zsh|bash)\s+-lc\s+(["'])(.+)\1$/i);
  if (macShell) return /^npm(?:\.cmd)?\s+run\s+test:document$/i.test(macShell[2].trim());
  const windowsShell = normalized.match(/^cmd(?:\.exe)?\s+\/c\s+(["'])(.+)\1$/i);
  return Boolean(windowsShell && /^npm(?:\.cmd)?\s+run\s+test:document$/i.test(windowsShell[2].trim()));
}
