/**
 * AI Memory 后台持久化的唯一异步边界。
 * 语料、摘要和人物记忆只能提交可序列化命令；后台所有者独占 SQLite 连接。
 */
export interface BackgroundPersistencePort {
  execute<TResult>(command: BackgroundPersistenceCommand<TResult>): Promise<TResult>;
  close(): Promise<void>;
}

/** 命令不允许携带主进程闭包、DatabaseSync 或 StatementSync。 */
export interface BackgroundPersistenceCommand<TResult> {
  readonly kind: string;
  readonly payload: unknown;
  readonly decode: (value: unknown) => TResult;
}
