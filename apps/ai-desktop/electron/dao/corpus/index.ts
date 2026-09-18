export {
  SqliteCodexConversationCorpusDao,
  type CorpusIngestionPolicy,
  type CorpusIngestionSummary,
} from "./internal/codex-conversation-corpus.dao.js";

/** 系统组合根通过稳定 URL 启动唯一后台数据库 Worker。 */
export function createCodexCorpusPersistenceWorkerUrl(): URL {
  return new URL("./internal/background-persistence.worker.js", import.meta.url);
}
