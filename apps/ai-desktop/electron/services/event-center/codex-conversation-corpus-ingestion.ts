import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, readdirSync, statSync, watch, type FSWatcher } from "node:fs";
import type { DatabaseSync, StatementSync } from "node:sqlite";
import path from "node:path";
import { createInterface } from "node:readline";

import type { SqliteDatabase } from "./persistence/sqlite-database.js";
import { runSqliteTransaction } from "./persistence/sqlite-transaction.js";

type JsonObject = Record<string, unknown>;

type CorpusTopic = {
  topicId: string;
  turnId: string;
  title: string;
  type: string;
  intent: string | null;
  tags: string[];
  definitionSource: "pending" | "ai-confirmed";
};

type CorpusMessage = {
  messageId: string;
  threadId: string;
  turnId: string;
  sequenceNumber: number;
  sourceRole: "user" | "codex";
  content: string;
  contentRetention: "exact" | "preview-300";
  topic: CorpusTopic;
  createdAt: string;
};

type CorpusStatements = {
  checkpoint: StatementSync;
  upsertTopic: StatementSync;
  upsertMessage: StatementSync;
  upsertCheckpoint: StatementSync;
};

export type CorpusIngestionSummary = {
  scannedFileCount: number;
  changedFileCount: number;
  ingestedMessageCount: number;
  skippedInternalFileCount: number;
};

export type CorpusIngestionPolicy = {
  sourceKeyPrefix?: string;
  eligibleThreadSources?: readonly string[];
  requiredWorkspaceRoot?: string;
  requiredOriginator?: string;
  requireCompletedTurns?: boolean;
};

/**
 * 把 AI Desktop 主人物会话的 Codex rollout 自动归档到训练语料表。
 *
 * 真实传参示例：sessionsRoot 为应用 userData/codex-home/sessions，数据库为当前唯一 AI Memory 连接。
 * 真实返回示例：一个新增会话含 2 条可见消息时返回 changedFileCount=1、ingestedMessageCount=2。
 * 异常或副作用示例：rollout 尾行损坏或数据库写入失败时抛错且不更新检查点，下次启动或回合完成后会重试。
 */
export class CodexConversationCorpusIngestion {
  readonly #database: SqliteDatabase;
  readonly #sessionsRoot: string;
  readonly #policy: Required<Omit<CorpusIngestionPolicy, "requiredWorkspaceRoot" | "requiredOriginator">>
    & Pick<CorpusIngestionPolicy, "requiredWorkspaceRoot" | "requiredOriginator">;

  constructor(database: SqliteDatabase, sessionsRoot: string, policy: CorpusIngestionPolicy = {}) {
    this.#database = database;
    this.#sessionsRoot = path.resolve(sessionsRoot);
    this.#policy = {
      sourceKeyPrefix: policy.sourceKeyPrefix || "",
      eligibleThreadSources: policy.eligibleThreadSources || ["ai-desktop"],
      requiredWorkspaceRoot: policy.requiredWorkspaceRoot ? path.resolve(policy.requiredWorkspaceRoot) : undefined,
      requiredOriginator: policy.requiredOriginator,
      requireCompletedTurns: policy.requireCompletedTurns ?? false,
    };
  }

  ingestPendingRollouts(): CorpusIngestionSummary {
    const summary: CorpusIngestionSummary = { scannedFileCount: 0, changedFileCount: 0, ingestedMessageCount: 0, skippedInternalFileCount: 0 };
    if (!existsSync(this.#sessionsRoot)) return summary;
    return this.#database.withConnection((connection) => {
      const statements = prepareCorpusStatements(connection);
      for (const rolloutPath of listRolloutFiles(this.#sessionsRoot)) this.#ingestRollout(connection, statements, rolloutPath, summary);
      return summary;
    });
  }

  /** 大批量历史补录每处理一个文件就让出主进程事件循环，避免首次开启时冻结桌面窗口。 */
  async ingestPendingRolloutsIncrementally(): Promise<CorpusIngestionSummary> {
    const summary: CorpusIngestionSummary = { scannedFileCount: 0, changedFileCount: 0, ingestedMessageCount: 0, skippedInternalFileCount: 0 };
    if (!existsSync(this.#sessionsRoot)) return summary;
    for (const rolloutPath of listRolloutFiles(this.#sessionsRoot)) {
      await this.#ingestRolloutIncrementally(rolloutPath, summary);
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    return summary;
  }

  async #ingestRolloutIncrementally(rolloutPath: string, summary: CorpusIngestionSummary): Promise<void> {
    summary.scannedFileCount += 1;
    const relativeSourceKey = path.relative(this.#sessionsRoot, rolloutPath).split(path.sep).join("/");
    const sourceKey = this.#policy.sourceKeyPrefix ? `${this.#policy.sourceKeyPrefix}/${relativeSourceKey}` : relativeSourceKey;
    const sourceSize = statSync(rolloutPath).size;
    const checkpoint = this.#database.withConnection((connection) => connection.prepare(`
      SELECT sourceContentHash, sourceSize FROM AiDesktopCorpusIngestionCheckpoint WHERE sourceKey = $sourceKey
    `).get({ $sourceKey: sourceKey }) as { sourceContentHash?: string; sourceSize?: number | bigint } | undefined);
    if (checkpoint && Number(checkpoint.sourceSize) === sourceSize) return;

    const parsed = await parseRolloutStream(rolloutPath);
    if (checkpoint?.sourceContentHash === parsed.sourceContentHash) return;
    const eligible = this.#policy.eligibleThreadSources.includes(parsed.threadSource)
      && (!this.#policy.requiredOriginator || parsed.originator === this.#policy.requiredOriginator)
      && (!this.#policy.requiredWorkspaceRoot || belongsToWorkspace(parsed.cwd, this.#policy.requiredWorkspaceRoot));
    const messages = eligible
      ? parsed.messages.slice(0, this.#policy.requireCompletedTurns ? parsed.completedMessageCount : undefined)
      : [];
    const now = new Date().toISOString();
    const insertedCount = this.#database.withConnection((connection) => {
      const statements = prepareCorpusStatements(connection);
      let inserted = 0;
      runSqliteTransaction(connection, () => {
        inserted = writeCorpusMessages(statements, messages, now);
        statements.upsertCheckpoint.run({
          $sourceKey: sourceKey,
          $sourceThreadId: parsed.threadId || null,
          $sourceContentHash: parsed.sourceContentHash,
          $sourceSize: sourceSize,
          $ingestedMessageCount: messages.length,
          $updatedAt: now,
        });
      });
      return inserted;
    });
    summary.changedFileCount += 1;
    summary.ingestedMessageCount += insertedCount;
    if (!eligible) summary.skippedInternalFileCount += 1;
  }

  #ingestRollout(connection: DatabaseSync, statements: CorpusStatements, rolloutPath: string, summary: CorpusIngestionSummary): void {
    summary.scannedFileCount += 1;
    const relativeSourceKey = path.relative(this.#sessionsRoot, rolloutPath).split(path.sep).join("/");
    const sourceKey = this.#policy.sourceKeyPrefix ? `${this.#policy.sourceKeyPrefix}/${relativeSourceKey}` : relativeSourceKey;
    const sourceSize = statSync(rolloutPath).size;
    const checkpoint = statements.checkpoint.get({ $sourceKey: sourceKey }) as { sourceContentHash?: string; sourceSize?: number | bigint } | undefined;
    // rollout 只追加写；大小未变化时无需重复读取和计算哈希，目录轮询不会随历史会话数量放大磁盘读取。
    if (checkpoint && Number(checkpoint.sourceSize) === sourceSize) return;
    const source = readFileSync(rolloutPath, "utf8");
    const sourceContentHash = createHash("sha256").update(source, "utf8").digest("hex");
    if (checkpoint?.sourceContentHash === sourceContentHash) return;

    const parsed = parseRollout(source);
    const eligible = this.#policy.eligibleThreadSources.includes(parsed.threadSource)
      && (!this.#policy.requiredOriginator || parsed.originator === this.#policy.requiredOriginator)
      && (!this.#policy.requiredWorkspaceRoot || belongsToWorkspace(parsed.cwd, this.#policy.requiredWorkspaceRoot));
    const completedRecords = this.#policy.requireCompletedTurns ? recordsThroughLastCompletedTurn(parsed.records) : parsed.records;
    const messages = eligible ? collectVisibleMessages(completedRecords, parsed.threadId) : [];
    const now = new Date().toISOString();
    let insertedCount = 0;
    runSqliteTransaction(connection, () => {
      if (eligible) {
        insertedCount = writeCorpusMessages(statements, messages, now);
      }
      statements.upsertCheckpoint.run({
        $sourceKey: sourceKey,
        $sourceThreadId: parsed.threadId || null,
        $sourceContentHash: sourceContentHash,
        $sourceSize: sourceSize,
        $ingestedMessageCount: messages.length,
        $updatedAt: now,
      });
    });
    summary.changedFileCount += 1;
    summary.ingestedMessageCount += insertedCount;
    if (!eligible) summary.skippedInternalFileCount += 1;
  }
}

function prepareCorpusStatements(connection: DatabaseSync): CorpusStatements {
  return {
    checkpoint: connection.prepare(`
      SELECT sourceContentHash, sourceSize FROM AiDesktopCorpusIngestionCheckpoint WHERE sourceKey = $sourceKey
    `),
    upsertTopic: connection.prepare(`
      INSERT INTO AiDesktopTrainingCorpusTopic
        (corpusTopicId, source, sourceConversationId, sourceTurnId, title, topicType, inferredIntent,
         tagsJson, definitionSource, createdAt, updatedAt)
      VALUES ($corpusTopicId, 'codex', $threadId, $turnId, $title, $topicType, $inferredIntent,
        $tagsJson, $definitionSource, $createdAt, $updatedAt)
      ON CONFLICT(corpusTopicId) DO UPDATE SET
        title=excluded.title, topicType=excluded.topicType, inferredIntent=excluded.inferredIntent,
        tagsJson=excluded.tagsJson, definitionSource=excluded.definitionSource, updatedAt=excluded.updatedAt
      WHERE AiDesktopTrainingCorpusTopic.definitionSource = 'pending'
        AND excluded.definitionSource = 'ai-confirmed'
    `),
    upsertMessage: connection.prepare(`
      INSERT INTO AiDesktopTrainingCorpusMessage
        (corpusMessageId, corpusTopicId, source, sourceConversationId, sourceTurnId, sourceMessageId,
         sequenceNumber, speakerRole, content, contentRetention, evidenceTier, createdAt, recordedAt)
      VALUES ($corpusMessageId, $corpusTopicId, 'codex', $threadId, $turnId, $messageId,
        $sequenceNumber, $sourceRole, $content, $contentRetention, $evidenceTier, $createdAt, $recordedAt)
      ON CONFLICT(corpusMessageId) DO NOTHING
    `),
    upsertCheckpoint: connection.prepare(`
      INSERT INTO AiDesktopCorpusIngestionCheckpoint
        (sourceKey, sourceThreadId, sourceContentHash, sourceSize, ingestedMessageCount, updatedAt)
      VALUES ($sourceKey, $sourceThreadId, $sourceContentHash, $sourceSize, $ingestedMessageCount, $updatedAt)
      ON CONFLICT(sourceKey) DO UPDATE SET
        sourceThreadId=excluded.sourceThreadId, sourceContentHash=excluded.sourceContentHash,
        sourceSize=excluded.sourceSize, ingestedMessageCount=excluded.ingestedMessageCount,
        updatedAt=excluded.updatedAt
    `),
  };
}

function writeCorpusMessages(statements: CorpusStatements, messages: CorpusMessage[], recordedAt: string): number {
  const topics = new Map(messages.map((message) => [message.topic.topicId, { ...message.topic, createdAt: message.createdAt, threadId: message.threadId }]));
  for (const topic of topics.values()) statements.upsertTopic.run({
    $corpusTopicId: topic.topicId,
    $threadId: topic.threadId,
    $turnId: topic.turnId,
    $title: topic.title,
    $topicType: topic.type,
    $inferredIntent: topic.intent,
    $tagsJson: JSON.stringify(topic.tags),
    $definitionSource: topic.definitionSource,
    $createdAt: topic.createdAt,
    $updatedAt: recordedAt,
  });
  let inserted = 0;
  for (const message of messages) {
    const result = statements.upsertMessage.run({
      $corpusMessageId: `corpus:codex:${message.messageId}`,
      $corpusTopicId: message.topic.topicId,
      $threadId: message.threadId,
      $turnId: message.turnId,
      $messageId: message.messageId,
      $sequenceNumber: message.sequenceNumber,
      $sourceRole: message.sourceRole,
      $content: message.content,
      $contentRetention: message.contentRetention,
      $evidenceTier: message.sourceRole === "user" ? "primary" : "supporting",
      $createdAt: message.createdAt,
      $recordedAt: recordedAt,
    });
    inserted += Number(result.changes);
  }
  return inserted;
}

async function parseRolloutStream(rolloutPath: string): Promise<{
  threadId: string;
  threadSource: string;
  cwd: string;
  originator: string;
  sourceContentHash: string;
  messages: CorpusMessage[];
  completedMessageCount: number;
}> {
  const sourceHash = createHash("sha256");
  const input = createReadStream(rolloutPath);
  input.on("data", (chunk) => { sourceHash.update(chunk); });
  const lines = createInterface({ input, crlfDelay: Infinity });
  let threadId = "";
  let threadSource = "";
  let cwd = "";
  let originator = "";
  let lineNumber = 0;
  let completedMessageCount = 0;
  const turnState: TurnCollectionState = { currentTurnId: null, currentTopic: null };
  const messages: CorpusMessage[] = [];
  for await (const line of lines) {
    const recordIndex = lineNumber;
    lineNumber += 1;
    if (!line) continue;
    // 巨型 rollout 主要由工具输出构成；先按可见记录特征筛选，避免解析数 GB 的内部输出对象。
    const envelope = line.slice(0, 4_096);
    const mayBeMetadata = envelope.includes('"type":"session_meta"');
    const mayBeCompleted = envelope.includes('"type":"event_msg"') && envelope.includes('"type":"task_complete"');
    const mayBeVisibleMessage = envelope.includes('"type":"response_item"') && envelope.includes('"type":"message"')
      && (envelope.includes('"role":"user"') || envelope.includes('"role":"assistant"'));
    if (!mayBeMetadata && !mayBeCompleted && !mayBeVisibleMessage) continue;
    let record: JsonObject;
    try {
      record = JSON.parse(line) as JsonObject;
    } catch (error) {
      // 历史 Codex 文件可能残留被中断写入的超长行；元数据损坏仍阻断，普通旧行跳过后继续补录其余完整回合。
      if (!mayBeMetadata) continue;
      throw new Error(`Codex rollout 第 ${lineNumber} 行无法解析：${error instanceof Error ? error.message : String(error)}`);
    }
    if (record.type === "session_meta") {
      const payload = asObject(record.payload);
      threadId = stringValue(payload.session_id) || stringValue(payload.id);
      threadSource = stringValue(payload.thread_source);
      cwd = stringValue(payload.cwd);
      originator = stringValue(payload.originator);
      continue;
    }
    if (record.type === "event_msg" && asObject(record.payload).type === "task_complete") {
      completedMessageCount = messages.length;
      turnState.currentTurnId = null;
      turnState.currentTopic = null;
      continue;
    }
    appendVisibleRecord(record, recordIndex, threadId, messages, turnState);
  }
  return {
    threadId, threadSource, cwd, originator,
    sourceContentHash: sourceHash.digest("hex"),
    messages,
    completedMessageCount,
  };
}

type TurnCollectionState = {
  currentTurnId: string | null;
  currentTopic: CorpusTopic | null;
};

function appendVisibleRecord(
  record: JsonObject,
  recordIndex: number,
  threadId: string,
  messages: CorpusMessage[],
  state: TurnCollectionState,
): void {
  if (!threadId || record.type !== "response_item") return;
  const payload = asObject(record.payload);
  if (payload.type !== "message") return;
  const role = stringValue(payload.role);
  if (role !== "user" && role !== "assistant") return;
  const rawContent = Array.isArray(payload.content)
    ? payload.content.map((item) => stringValue(asObject(item).text)).join("").trim()
    : "";
  if (!rawContent || (role === "user" && isPlatformContext(rawContent))) return;
  const responsePhase = role === "assistant" ? stringValue(payload.phase) : "";
  if (role === "assistant" && responsePhase !== "final_answer") return;
  const ordinal = Number(record.ordinal);
  const messageId = `codex-${threadId}-${Number.isSafeInteger(ordinal) ? ordinal : stringValue(payload.id) || recordIndex}`;
  if (role === "user") {
    const userContent = stripInjectedWorkspaceContext(rawContent);
    if (!userContent) return;
    if (!state.currentTurnId) {
      state.currentTurnId = messageId;
      state.currentTopic = pendingTopic(threadId, messageId);
    }
    messages.push({
      messageId,
      threadId,
      turnId: state.currentTurnId,
      sequenceNumber: messages.length,
      sourceRole: "user",
      content: userContent,
      contentRetention: "exact",
      topic: state.currentTopic!,
      createdAt: stringValue(record.timestamp) || new Date(0).toISOString(),
    });
    return;
  }
  if (!state.currentTurnId || !state.currentTopic) return;
  const metadata = extractAiCorpusMetadata(rawContent);
  if (!metadata) return;
  const confirmedTopic: CorpusTopic = {
    topicId: state.currentTopic.topicId,
    turnId: state.currentTurnId,
    title: metadata.title,
    type: metadata.type,
    intent: metadata.intent,
    tags: metadata.tags,
    definitionSource: "ai-confirmed",
  };
  state.currentTopic = confirmedTopic;
  for (const message of messages) if (message.turnId === state.currentTurnId) message.topic = confirmedTopic;
  messages.push({
    messageId,
    threadId,
    turnId: state.currentTurnId,
    sequenceNumber: messages.length,
    sourceRole: "codex",
    content: metadata.summary,
    contentRetention: "preview-300",
    topic: confirmedTopic,
    createdAt: stringValue(record.timestamp) || new Date(0).toISOString(),
  });
}

function pendingTopic(threadId: string, turnId: string): CorpusTopic {
  return {
    topicId: `corpus-topic:codex:${threadId}:${turnId}`,
    turnId,
    title: "待 AI 归类",
    type: "待归类",
    intent: null,
    tags: [],
    definitionSource: "pending",
  };
}

function extractAiCorpusMetadata(content: string): { title: string; type: string; intent: string; tags: string[]; summary: string } | null {
  const marker = "<!-- SELPLAT_CORPUS_META ";
  const start = content.lastIndexOf(marker);
  if (start < 0) return null;
  const end = content.indexOf(" -->", start + marker.length);
  if (end < 0) return null;
  try {
    const value = asObject(JSON.parse(content.slice(start + marker.length, end)));
    const title = normalizedMetadataText(value.title, 120);
    const type = normalizedMetadataText(value.type, 60);
    const intent = normalizedMetadataText(value.intent, 500);
    const summary = normalizedMetadataText(value.summary, 300);
    if (!title || !type || !intent || !summary || !Array.isArray(value.tags)) return null;
    const tags = [...new Map(value.tags
      .map((tag) => normalizedMetadataText(tag, 30))
      .filter(Boolean)
      .slice(0, 12)
      .map((tag) => [tag.toLocaleLowerCase("zh-CN"), tag])).values()];
    if (!tags.length) return null;
    return { title, type, intent, tags, summary };
  } catch {
    return null;
  }
}

function normalizedMetadataText(value: unknown, maximumCharacters: number): string {
  if (typeof value !== "string") return "";
  const normalized = value.replaceAll(/\s+/gu, " ").trim();
  return Array.from(normalized).length <= maximumCharacters ? normalized : "";
}

/**
 * 监听 Codex 桌面持久记录并在每轮完成后触发增量入库，同时用低频扫描弥补文件系统事件丢失。
 *
 * 真实传参示例：roots 为 ~/.codex/sessions 与 archived_sessions，onChanged 调用语料入库器。
 * 真实返回示例：start 后新一轮 task_complete 最迟在防抖或30秒兜底扫描时触发一次回调。
 * 异常或副作用示例：目录尚不存在时跳过监听；回调失败由入库水位保留机制在下一次事件重试。
 */
export class CodexConversationCorpusWatcher {
  readonly #roots: string[];
  readonly #onChanged: () => void;
  #watchers: FSWatcher[] = [];
  #debounceTimer: NodeJS.Timeout | null = null;
  #fallbackTimer: NodeJS.Timeout | null = null;

  constructor(roots: string[], onChanged: () => void) {
    this.#roots = roots.map((root) => path.resolve(root));
    this.#onChanged = onChanged;
  }

  start(): void {
    this.stop();
    for (const root of this.#roots) {
      if (!existsSync(root)) continue;
      try {
        this.#watchers.push(watch(root, { recursive: true }, (_event, fileName) => {
          if (!fileName || String(fileName).endsWith(".jsonl")) this.#schedule();
        }));
      } catch { /* 低频兜底扫描继续覆盖暂不支持递归监听的平台。 */ }
    }
    this.#fallbackTimer = setInterval(() => this.#onChanged(), 30_000);
  }

  stop(): void {
    for (const watcher of this.#watchers) watcher.close();
    this.#watchers = [];
    if (this.#debounceTimer) clearTimeout(this.#debounceTimer);
    if (this.#fallbackTimer) clearInterval(this.#fallbackTimer);
    this.#debounceTimer = null;
    this.#fallbackTimer = null;
  }

  #schedule(): void {
    if (this.#debounceTimer) clearTimeout(this.#debounceTimer);
    this.#debounceTimer = setTimeout(() => {
      this.#debounceTimer = null;
      this.#onChanged();
    }, 800);
  }
}

function listRolloutFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(candidate);
      else if (entry.isFile() && entry.name.startsWith("rollout-") && entry.name.endsWith(".jsonl")) files.push(candidate);
    }
  };
  visit(root);
  return files.sort();
}

function parseRollout(source: string): { threadId: string; threadSource: string; cwd: string; originator: string; records: JsonObject[] } {
  const records = source.split(/\r?\n/u).filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line) as JsonObject;
    } catch (error) {
      throw new Error(`Codex rollout 第 ${index + 1} 行无法解析：${error instanceof Error ? error.message : String(error)}`);
    }
  });
  const metadata = records.find((record) => record.type === "session_meta")?.payload;
  const payload = asObject(metadata);
  return {
    threadId: stringValue(payload.session_id) || stringValue(payload.id),
    threadSource: stringValue(payload.thread_source),
    cwd: stringValue(payload.cwd),
    originator: stringValue(payload.originator),
    records,
  };
}

function collectVisibleMessages(records: JsonObject[], threadId: string): CorpusMessage[] {
  if (!threadId) return [];
  const messages: CorpusMessage[] = [];
  const turnState: TurnCollectionState = { currentTurnId: null, currentTopic: null };
  records.forEach((record, recordIndex) => {
    if (record.type === "event_msg" && asObject(record.payload).type === "task_complete") {
      turnState.currentTurnId = null;
      turnState.currentTopic = null;
      return;
    }
    appendVisibleRecord(record, recordIndex, threadId, messages, turnState);
  });
  return messages;
}

function recordsThroughLastCompletedTurn(records: JsonObject[]): JsonObject[] {
  let lastCompletedIndex = -1;
  records.forEach((record, index) => {
    if (record.type === "event_msg" && asObject(record.payload).type === "task_complete") lastCompletedIndex = index;
  });
  return lastCompletedIndex < 0 ? [] : records.slice(0, lastCompletedIndex + 1);
}

function belongsToWorkspace(candidate: string, workspaceRoot: string): boolean {
  if (!candidate) return false;
  const relative = path.relative(workspaceRoot, path.resolve(candidate));
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

function stripInjectedWorkspaceContext(content: string): string {
  return content.replace(/\n\nRegistered workspace roots:\n(?:- .*\n?)+$/u, "").trim();
}

function isPlatformContext(content: string): boolean {
  return content.startsWith("<recommended_plugins>")
    || content.startsWith("<environment_context>")
    || content.startsWith("<app-context>")
    || content.startsWith("<permissions instructions>")
    || content.startsWith("<skills_instructions>")
    || content.startsWith("<collaboration_mode>")
    || content.startsWith("<multi_agent_role>")
    || content.startsWith("# AGENTS.md instructions");
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
