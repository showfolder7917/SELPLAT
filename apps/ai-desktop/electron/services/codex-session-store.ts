import { readFileSync, renameSync, writeFileSync } from "node:fs";

export interface LegacyStoredCodexSession {
  version: 1;
  threadId: string;
  workspaceSignature: string;
}

export interface StoredCodexSession {
  version: 2;
  storageDomain: "ai-desktop";
  threadId: string;
  workspaceSignature: string;
}

export type ReadableCodexSession = LegacyStoredCodexSession | StoredCodexSession;

/** 只保存当前活动线程的恢复凭据；用户新建任务后立即清空，不维护历史会话列表。 */
export class CodexSessionStore {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  read(): ReadableCodexSession | null {
    try {
      const value = JSON.parse(readFileSync(this.#filePath, "utf8")) as {
        version?: unknown;
        storageDomain?: unknown;
        threadId?: unknown;
        workspaceSignature?: unknown;
      };
      if ((value.version !== 1 && value.version !== 2) || typeof value.threadId !== "string" || !value.threadId.trim()) return null;
      if (typeof value.workspaceSignature !== "string" || !value.workspaceSignature) return null;
      if (value.version === 1) return { version: 1, threadId: value.threadId, workspaceSignature: value.workspaceSignature };
      if (value.storageDomain !== "ai-desktop") return null;
      return { version: 2, storageDomain: "ai-desktop", threadId: value.threadId, workspaceSignature: value.workspaceSignature };
    } catch {
      return null;
    }
  }

  write(threadId: string, workspaceSignature: string): StoredCodexSession {
    const value: StoredCodexSession = { version: 2, storageDomain: "ai-desktop", threadId, workspaceSignature };
    const temporaryPath = `${this.#filePath}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    renameSync(temporaryPath, this.#filePath);
    return value;
  }

  clear(): void {
    // 用空状态原子覆盖而不是删除文件，避免启动器或杀毒软件占用时留下半写 JSON。
    const temporaryPath = `${this.#filePath}.tmp`;
    writeFileSync(temporaryPath, "{}\n", "utf8");
    renameSync(temporaryPath, this.#filePath);
  }
}
