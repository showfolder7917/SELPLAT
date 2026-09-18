// 应用事件门面是审计、异常与页面通知的唯一业务入口。
export { EventCenterFacade } from "./event-center.facade.js";
import { BusinessAuditLog } from "./internal/audit/business-audit-log.js";
import { CodexConversationCorpusWatcher } from "./internal/corpus/codex-conversation-corpus.watcher.js";
import {
  CodexConversationSemanticBackfill,
  buildCodexSemanticBackfillPrompt,
  parseCodexSemanticBackfillResponse,
  type CodexSemanticAnalyzer,
} from "./internal/corpus/codex-conversation-semantic-backfill.js";
import { createBackgroundCollaborationMemory } from "./internal/projection/background-collaboration-memory.proxy.js";
import type { AsyncCollaborationMemoryPort } from "../../../../../contracts/services/support/capabilities/event-center/index.js";
import { CollaborationTimelineFacade } from "./internal/timeline/collaboration-timeline.facade.js";
import type { BackgroundPersistencePort } from "../../platform/persistence/index.js";
import type { CollaborationTimelinePersistencePort } from "./collaboration-timeline.persistence.port.js";
export { collaborationMemoryMethodNames, isCollaborationMemoryMethod } from "./internal/projection/collaboration-memory-methods.js";

// 审计归档由事件中心自己创建；调用方只提供三个已治理的数据根。
export function createBusinessAuditArchive(...arguments_: ConstructorParameters<typeof BusinessAuditLog>): BusinessAuditLog {
  return new BusinessAuditLog(...arguments_);
}

// 时间线门面保证数据库事务提交后才向 Renderer 发布变化。
export function createCollaborationTimeline(persistence: CollaborationTimelinePersistencePort): CollaborationTimelineFacade {
  return new CollaborationTimelineFacade(persistence);
}

// 主进程人物记忆只经 Worker 端口访问，禁止重新建立同步数据库回退。
export function createCollaborationMemory(persistence: BackgroundPersistencePort): AsyncCollaborationMemoryPort {
  return createBackgroundCollaborationMemory(persistence);
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
export type CorpusWatcher = CodexConversationCorpusWatcher;
export type CorpusSemanticBackfill = CodexConversationSemanticBackfill;
export type { CollaborationTimelineCommit, CollaborationTimelinePersistencePort, CollaborationTimelineStreamCommit } from "./collaboration-timeline.persistence.port.js";
export { buildCodexSemanticBackfillPrompt, parseCodexSemanticBackfillResponse };
