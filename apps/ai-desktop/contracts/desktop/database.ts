/**
 * AI Memory 数据库健康状态协议。
 *
 * 生产者：主进程 SQLite 初始化和迁移器。
 * 消费者：Renderer 诊断界面与启动阻断逻辑。
 * 数据方向：main -> preload -> renderer。
 * 本文件不暴露数据库绝对路径、连接对象或 SQL 内容。
 */
export type AiMemoryDatabaseState = "ready" | "recovery-required" | "unavailable";

export interface AiMemoryDatabaseStatus {
  state: AiMemoryDatabaseState;
  schemaVersion: string | null;
  message: string | null;
}

/** 一键清空完成后的受控重启回执；不暴露数据库路径、表名或删除语句。 */
export interface TestDataResetResult {
  cleared: true;
  clearedRecordCount: number;
  restartScheduled: true;
}
