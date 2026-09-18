import type { CodexSessionPersistence } from "../../services/support/platform/codex/index.js";
import type { DatabasePort } from "../platform/index.js";
import { SqliteCodexSessionDao } from "./internal/codex-session.dao.js";

/** 为系统组合根创建按人物隔离的 Codex 会话 DAO。 */
export function createSqliteCodexSessionDao(database: DatabasePort | null, owner: string): CodexSessionPersistence {
  return new SqliteCodexSessionDao(database, owner);
}
