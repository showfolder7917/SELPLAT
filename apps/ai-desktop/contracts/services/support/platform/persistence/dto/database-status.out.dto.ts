/**
 * AI Memory 数据库健康状态协议。
 *
 * 生产者：主进程 SQLite 初始化和迁移器。
 * 消费者：Renderer 诊断界面与启动阻断逻辑。
 * 数据方向：main -> preload -> renderer。
 * 本文件不暴露数据库绝对路径、连接对象或 SQL 内容。
 */
import type { AiMemoryDatabaseStateValue, CorpusIngestionStateValue, CorpusSemanticBackfillStateValue } from "../value/database-state.value.js";

export interface AiMemoryDatabaseStatusOutDto {
  state: AiMemoryDatabaseStateValue;
  schemaVersion: string | null;
  message: string | null;
}

/** Codex 历史 AI 摘要补齐进度；只暴露计数和业务提示，不暴露原始会话正文。 */
export interface CorpusSemanticBackfillStatusOutDto {
  state: CorpusSemanticBackfillStateValue;
  targetCount: number;
  discoveredCount: number;
  processedCount: number;
  insertedCount: number;
  failedCount: number;
  message: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

/** 自动入库只返回后台生命周期和汇总结果；页面不读取会话文件、检查点或原始对话内容。 */
export interface CorpusIngestionStatusOutDto {
  state: CorpusIngestionStateValue;
  message: string | null;
  lastSucceededAt: string | null;
  retryable: boolean;
}
