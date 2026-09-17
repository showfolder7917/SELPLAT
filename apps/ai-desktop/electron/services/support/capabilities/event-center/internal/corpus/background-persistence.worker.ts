import { parentPort, workerData, type MessagePort } from "node:worker_threads";

import { initializeAiMemoryDatabase } from "../../../../platform/persistence/index.js";
import { CodexConversationCorpusIngestion } from "./codex-conversation-corpus.ingestion.js";
import { CollaborationMemoryService } from "../projection/collaboration-memory.service.js";
import { collaborationMemoryMethodNames } from "../projection/collaboration-memory-methods.js";

type WorkerRequest = { id: number; operation: string; payload: Record<string, unknown> };
type WorkerOptions = { projectRoot: string; runtimeMarkerPath: string; migrationSqlRoot?: string };

const workerPort = requireWorkerPort();
const initialization = initializeAiMemoryDatabase(workerData as WorkerOptions);
if (!initialization.database) throw new Error(initialization.status.message || "AI Memory 数据库不可用。");
const database = initialization.database;
const collaborationMemory = new CollaborationMemoryService(database);
const collaborationMemoryMethods = new Set<string>(collaborationMemoryMethodNames);
let queue: Promise<void> = Promise.resolve();

workerPort.on("message", (request: WorkerRequest) => {
  queue = queue.then(() => handle(request), () => handle(request));
});

async function handle(request: WorkerRequest): Promise<void> {
  try {
    if (request.operation === "collaboration-memory") {
      const method = requiredText(request.payload.method, "method");
      if (!collaborationMemoryMethods.has(method)) throw new Error("不支持的人物记忆操作：" + method);
      const args = Array.isArray(request.payload.args) ? request.payload.args : [];
      const operation = collaborationMemory[method as keyof CollaborationMemoryService] as (...values: unknown[]) => unknown;
      workerPort.postMessage({ id: request.id, result: operation.apply(collaborationMemory, args) });
      return;
    }
    if (request.operation === "semantic-message-exists") {
      const sourceMessageId = requiredText(request.payload.sourceMessageId, "sourceMessageId");
      const result = database.withConnection((connection) => Boolean(connection.prepare(
        "SELECT 1 FROM AiDesktopTrainingCorpusMessage WHERE source='codex' AND sourceMessageId=$sourceMessageId",
      ).get({ $sourceMessageId: sourceMessageId })));
      workerPort.postMessage({ id: request.id, result });
      return;
    }
    if (request.operation === "write-semantic-summary") {
      const candidate = requiredObject(request.payload.candidate, "candidate");
      const metadata = requiredObject(request.payload.metadata, "metadata");
      const threadId = requiredText(candidate.threadId, "candidate.threadId");
      const turnId = requiredText(candidate.turnId, "candidate.turnId");
      const sourceMessageId = requiredText(candidate.assistantMessageId, "candidate.assistantMessageId");
      const createdAt = requiredText(candidate.createdAt, "candidate.createdAt");
      const now = new Date().toISOString();
      const topicId = "corpus-topic:codex:" + threadId + ":" + turnId;
      const result = database.transaction((connection) => {
        connection.prepare("INSERT INTO AiDesktopTrainingCorpusTopic (corpusTopicId, source, sourceConversationId, sourceTurnId, title, topicType, inferredIntent, tagsJson, definitionSource, createdAt, updatedAt) VALUES ($topicId, 'codex', $threadId, $turnId, $title, $type, $intent, $tagsJson, 'ai-confirmed', $createdAt, $updatedAt) ON CONFLICT(corpusTopicId) DO UPDATE SET title=excluded.title, topicType=excluded.topicType, inferredIntent=excluded.inferredIntent, tagsJson=excluded.tagsJson, definitionSource='ai-confirmed', updatedAt=excluded.updatedAt").run({ $topicId: topicId, $threadId: threadId, $turnId: turnId, $title: requiredText(metadata.title, "metadata.title"), $type: requiredText(metadata.type, "metadata.type"), $intent: requiredText(metadata.intent, "metadata.intent"), $tagsJson: JSON.stringify(Array.isArray(metadata.tags) ? metadata.tags : []), $createdAt: createdAt, $updatedAt: now });
        const sequence = connection.prepare("SELECT COALESCE(MAX(sequenceNumber), -1) AS value FROM AiDesktopTrainingCorpusMessage WHERE source='codex' AND sourceConversationId=$threadId").get({ $threadId: threadId }) as { value: number | bigint };
        return Number(connection.prepare("INSERT INTO AiDesktopTrainingCorpusMessage (corpusMessageId, corpusTopicId, source, sourceConversationId, sourceTurnId, sourceMessageId, sequenceNumber, speakerRole, content, contentRetention, evidenceTier, createdAt, recordedAt) VALUES ($corpusMessageId, $topicId, 'codex', $threadId, $turnId, $sourceMessageId, $sequenceNumber, 'codex', $content, $retention, 'supporting', $createdAt, $recordedAt) ON CONFLICT(source, sourceMessageId) DO NOTHING").run({ $corpusMessageId: "corpus:codex:" + sourceMessageId, $topicId: topicId, $threadId: threadId, $turnId: turnId, $sourceMessageId: sourceMessageId, $sequenceNumber: Number(sequence.value) + 1, $content: requiredText(metadata.summary, "metadata.summary"), $retention: requiredText(request.payload.retention, "retention"), $createdAt: createdAt, $recordedAt: now }).changes);
      });
      workerPort.postMessage({ id: request.id, result });
      return;
    }
    if (request.operation === "ingest-rollouts") {
      const sessionsRoot = requiredText(request.payload.sessionsRoot, "sessionsRoot");
      const policy = request.payload.policy as ConstructorParameters<typeof CodexConversationCorpusIngestion>[2];
      const result = await new CodexConversationCorpusIngestion(database, sessionsRoot, policy).ingestPendingRolloutsIncrementally();
      workerPort.postMessage({ id: request.id, result });
      return;
    }
    if (request.operation === "read-corpus-ingestion-status") {
      const result = database.withConnection((connection) => connection.prepare(`SELECT state, message, lastSucceededAt, retryable FROM AiDesktopCorpusIngestionJob WHERE jobId='codex-app'`).get() || null);
      workerPort.postMessage({ id: request.id, result });
      return;
    }
    if (request.operation === "set-corpus-ingestion-status") {
      const now = new Date().toISOString();
      database.transaction((connection) => connection.prepare(`
        INSERT INTO AiDesktopCorpusIngestionJob (jobId, state, message, lastSucceededAt, retryable, updatedAt)
        VALUES ('codex-app', $state, $message, $lastSucceededAt, $retryable, $updatedAt)
        ON CONFLICT(jobId) DO UPDATE SET state=excluded.state, message=excluded.message, lastSucceededAt=excluded.lastSucceededAt, retryable=excluded.retryable, updatedAt=excluded.updatedAt
      `).run({ $state: requiredText(request.payload.state, "state"), $message: requiredText(request.payload.message, "message"), $lastSucceededAt: typeof request.payload.lastSucceededAt === "string" ? request.payload.lastSucceededAt : null, $retryable: request.payload.retryable === true ? 1 : 0, $updatedAt: now }));
      workerPort.postMessage({ id: request.id, result: null });
      return;
    }
    throw new Error(`未知后台持久化操作：${request.operation}`);
  } catch (error) {
    workerPort.postMessage({ id: request.id, error: error instanceof Error ? error.message : String(error) });
  }
}

function requiredObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("后台持久化请求缺少对象：" + field);
  return value as Record<string, unknown>;
}

/** 把 Node 的可空导出收敛在 Worker 启动边界，后续异步回包始终持有可用端口。 */
function requireWorkerPort(): MessagePort {
  if (!parentPort) throw new Error("后台持久化 Worker 缺少消息端口。");
  return parentPort;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`后台持久化请求缺少 ${field}。`);
  return value;
}
