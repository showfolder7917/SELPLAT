import { readFileSync, renameSync, writeFileSync } from "node:fs";
import type { DatabasePort } from "../../persistence/index.js";

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

export interface CodexSessionPersistence {
  read(): ReadableCodexSession | null;
  write(threadId: string, workspaceSignature: string): StoredCodexSession;
  clear(): void;
}

/** 只保存当前活动线程的恢复凭据；用户新建任务后立即清空，不维护历史会话列表。 */
export class CodexSessionStore implements CodexSessionPersistence {
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

/**
 * 以固定人物键保存唯一活动线程；同一人物只更新一行，不按任务累积临时会话。
 */
export class SqliteCodexSessionStore implements CodexSessionPersistence {
  readonly #database: DatabasePort | null;
  readonly #sessionKey: "nangong" | "han-li" | "linghu";

  constructor(database: DatabasePort | null, sessionKey: "nangong" | "han-li" | "linghu") {
    this.#database = database;
    this.#sessionKey = sessionKey;
  }

  read(): StoredCodexSession | null {
    if (!this.#database) return null;
    const row = this.#database.withConnection((connection) => connection.prepare(`
      SELECT threadId, workspaceSignature FROM AiDesktopPersonaSession WHERE sessionKey=$sessionKey
    `).get({ $sessionKey: this.#sessionKey }) as { threadId: string; workspaceSignature: string } | undefined);
    return row ? { version: 2, storageDomain: "ai-desktop", threadId: row.threadId, workspaceSignature: row.workspaceSignature } : null;
  }

  write(threadId: string, workspaceSignature: string): StoredCodexSession {
    if (!this.#database) throw new Error("AI Memory 数据库不可用，固定人物会话不能启动；请先恢复数据库。");
    const value: StoredCodexSession = { version: 2, storageDomain: "ai-desktop", threadId, workspaceSignature };
    this.#database.withConnection((connection) => connection.prepare(`
      INSERT INTO AiDesktopPersonaSession (sessionKey, threadId, workspaceSignature, updatedAt)
      VALUES ($sessionKey, $threadId, $workspaceSignature, $updatedAt)
      ON CONFLICT(sessionKey) DO UPDATE SET threadId=excluded.threadId,
        workspaceSignature=excluded.workspaceSignature, updatedAt=excluded.updatedAt
    `).run({ $sessionKey: this.#sessionKey, $threadId: threadId, $workspaceSignature: workspaceSignature, $updatedAt: new Date().toISOString() }));
    return value;
  }

  clear(): void {
    if (!this.#database) return;
    this.#database.withConnection((connection) => connection.prepare(
      "DELETE FROM AiDesktopPersonaSession WHERE sessionKey=$sessionKey",
    ).run({ $sessionKey: this.#sessionKey }));
  }
}
