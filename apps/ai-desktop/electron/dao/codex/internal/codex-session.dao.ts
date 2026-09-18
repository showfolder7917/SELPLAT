import type { CodexSessionPersistence, StoredCodexSession } from "../../../services/support/platform/codex/index.js";
import type { DatabasePort } from "../../platform/index.js";

/** 以固定人物键保存唯一活动线程；同一人物只更新一行，不累积临时会话。 */
export class SqliteCodexSessionDao implements CodexSessionPersistence {
  readonly #database: DatabasePort | null;
  readonly #sessionKey: string;

  constructor(database: DatabasePort | null, sessionKey: string) {
    this.#database = database;
    const normalized = sessionKey.trim();
    if (!normalized) throw new Error("人物 Codex 会话键不能为空。");
    this.#sessionKey = normalized;
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
