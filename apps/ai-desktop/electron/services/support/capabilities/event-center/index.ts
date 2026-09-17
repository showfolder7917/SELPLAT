// 应用事件门面是审计、异常与页面通知的唯一业务入口。
export { EventCenterFacade } from "./event-center.facade.js";
import { BusinessAuditLog } from "./internal/audit/business-audit-log.js";
import {
  CodexConversationCorpusIngestion,
  CodexConversationCorpusWatcher,
  type CorpusIngestionPolicy,
} from "./internal/corpus/codex-conversation-corpus.ingestion.js";
import {
  CodexConversationSemanticBackfill,
  buildCodexSemanticBackfillPrompt,
  parseCodexSemanticBackfillResponse,
  type CodexSemanticAnalyzer,
} from "./internal/corpus/codex-conversation-semantic-backfill.js";
import { createBackgroundCollaborationMemory } from "./internal/projection/background-collaboration-memory.proxy.js";
import type { AsyncCollaborationMemoryPort } from "../../../../../contracts/services/support/capabilities/event-center/index.js";
import { CollaborationTimelineFacade } from "./internal/timeline/collaboration-timeline.facade.js";
import type { BackgroundPersistencePort, DatabasePort } from "../../platform/persistence/index.js";

// 审计归档由事件中心自己创建；调用方只提供三个已治理的数据根。
export function createBusinessAuditArchive(...arguments_: ConstructorParameters<typeof BusinessAuditLog>): BusinessAuditLog {
  return new BusinessAuditLog(...arguments_);
}

// 时间线门面保证数据库事务提交后才向 Renderer 发布变化。
export function createCollaborationTimeline(database: DatabasePort): CollaborationTimelineFacade {
  return new CollaborationTimelineFacade(database);
}

// 主进程人物记忆只经 Worker 端口访问，禁止重新建立同步数据库回退。
export function createCollaborationMemory(persistence: BackgroundPersistencePort): AsyncCollaborationMemoryPort {
  return createBackgroundCollaborationMemory(persistence);
}

// 语料入口只读取已完成回合，并通过来源策略阻断内部自动化内容。
export function createCodexConversationCorpusIngestion(
  database: DatabasePort,
  sessionsRoot: string,
  policy?: CorpusIngestionPolicy,
): CodexConversationCorpusIngestion {
  return new CodexConversationCorpusIngestion(database, sessionsRoot, policy);
}

/** 组合根用此 URL 启动语料 Worker；平台端口不需要知道能力模块的内部文件结构。 */
export function createCodexCorpusPersistenceWorkerUrl(): URL {
  return new URL("./internal/corpus/background-persistence.worker.js", import.meta.url);
}

// 文件监听器只触发增量扫描，真正的去重和水位提交仍由语料入口负责。
export function createCodexConversationCorpusWatcher(
  ...arguments_: ConstructorParameters<typeof CodexConversationCorpusWatcher>
): CodexConversationCorpusWatcher {
  return new CodexConversationCorpusWatcher(...arguments_);
}

// 语义回填门面把 AI 分析限制在待整理语料，不修改原始用户消息。
export function createCodexConversationSemanticBackfill(
  ...arguments_: ConstructorParameters<typeof CodexConversationSemanticBackfill>
): CodexConversationSemanticBackfill {
  return new CodexConversationSemanticBackfill(...arguments_);
}

// 组合根需要的只读类型不会暴露 Repository 或 SQLite 连接实现。
export type EventCenterTimeline = CollaborationTimelineFacade;
export type EventCenterMemory = AsyncCollaborationMemoryPort;
export type CorpusIngestion = CodexConversationCorpusIngestion;
export type CorpusWatcher = CodexConversationCorpusWatcher;
export type CorpusSemanticBackfill = CodexConversationSemanticBackfill;
export { buildCodexSemanticBackfillPrompt, parseCodexSemanticBackfillResponse };
