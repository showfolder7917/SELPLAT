import { parentPort, workerData } from "node:worker_threads";

import { initializeAiMemoryDatabase } from "../../../../platform/persistence/index.js";
import { CodexConversationCorpusIngestion } from "./codex-conversation-corpus.ingestion.js";

type WorkerRequest = { id: number; operation: string; payload: Record<string, unknown> };
type WorkerOptions = { projectRoot: string; runtimeMarkerPath: string; migrationSqlRoot?: string };

const port = parentPort;
if (!port) throw new Error("后台持久化 Worker 缺少消息端口。");
const initialization = initializeAiMemoryDatabase(workerData as WorkerOptions);
if (!initialization.database) throw new Error(initialization.status.message || "AI Memory 数据库不可用。");
const database = initialization.database;

port.on("message", async (request: WorkerRequest) => {
  try {
    if (request.operation === "ingest-rollouts") {
      const sessionsRoot = requiredText(request.payload.sessionsRoot, "sessionsRoot");
      const policy = request.payload.policy as ConstructorParameters<typeof CodexConversationCorpusIngestion>[2];
      const result = await new CodexConversationCorpusIngestion(database, sessionsRoot, policy).ingestPendingRolloutsIncrementally();
      port.postMessage({ id: request.id, result });
      return;
    }
    if (request.operation === "read-corpus-ingestion-status") {
      const result = database.withConnection((connection) => connection.prepare(`SELECT state, message, lastSucceededAt, retryable FROM AiDesktopCorpusIngestionJob WHERE jobId='codex-app'`).get() || null);
      port.postMessage({ id: request.id, result });
      return;
    }
    if (request.operation === "set-corpus-ingestion-status") {
      const now = new Date().toISOString();
      database.transaction((connection) => connection.prepare(`
        INSERT INTO AiDesktopCorpusIngestionJob (jobId, state, message, lastSucceededAt, retryable, updatedAt)
        VALUES ('codex-app', $state, $message, $lastSucceededAt, $retryable, $updatedAt)
        ON CONFLICT(jobId) DO UPDATE SET state=excluded.state, message=excluded.message, lastSucceededAt=excluded.lastSucceededAt, retryable=excluded.retryable, updatedAt=excluded.updatedAt
      `).run({ $state: requiredText(request.payload.state, "state"), $message: requiredText(request.payload.message, "message"), $lastSucceededAt: typeof request.payload.lastSucceededAt === "string" ? request.payload.lastSucceededAt : null, $retryable: request.payload.retryable === true ? 1 : 0, $updatedAt: now }));
      port.postMessage({ id: request.id, result: null });
      return;
    }
    throw new Error(`未知后台持久化操作：${request.operation}`);
  } catch (error) {
    port.postMessage({ id: request.id, error: error instanceof Error ? error.message : String(error) });
  }
});

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`后台持久化请求缺少 ${field}。`);
  return value;
}
