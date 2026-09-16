/** 后台端口只传递结构化数据；主进程不能把闭包或 SQLite 对象交给 Worker。 */
export type BackgroundPersistenceOperation =
  | "ingest-rollouts"
  | "read-corpus-ingestion-status"
  | "set-corpus-ingestion-status"
  | "collaboration-memory"
  | "semantic-message-exists"
  | "write-semantic-summary";

export type BackgroundPersistenceRequest = {
  operation: BackgroundPersistenceOperation;
  payload: Record<string, unknown>;
};

/** Worker 是语料与检查点写入的唯一所有者，调用方只能等待队列结果。 */
export interface BackgroundPersistencePort {
  request<TResult>(request: BackgroundPersistenceRequest): Promise<TResult>;
  close(): Promise<void>;
}
