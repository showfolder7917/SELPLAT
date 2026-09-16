import { Worker } from "node:worker_threads";

import type { BackgroundPersistencePort, BackgroundPersistenceRequest } from "./background-persistence.port.js";

type WorkerOptions = { workerUrl: URL; projectRoot: string; runtimeMarkerPath: string; migrationSqlRoot?: string };
type PendingRequest = { resolve: (value: unknown) => void; reject: (error: Error) => void };

/** 主进程只维护请求关联；SQLite 连接、扫描和事务全部由 Worker 处理。 */
export class BackgroundPersistenceWorkerPort implements BackgroundPersistencePort {
  readonly #worker: Worker;
  readonly #pending = new Map<number, PendingRequest>();
  #nextId = 1;
  #closed = false;

  constructor(options: WorkerOptions) {
    this.#worker = new Worker(options.workerUrl, { workerData: {
      projectRoot: options.projectRoot,
      runtimeMarkerPath: options.runtimeMarkerPath,
      migrationSqlRoot: options.migrationSqlRoot,
    } });
    this.#worker.on("message", (message: { id: number; result?: unknown; error?: string }) => {
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error));
      else pending.resolve(message.result);
    });
    this.#worker.on("error", (error) => this.#failPending(error));
    this.#worker.on("exit", (code) => {
      if (!this.#closed && code !== 0) this.#failPending(new Error(`后台持久化 Worker 异常退出：${code}`));
    });
  }

  request<TResult>(request: BackgroundPersistenceRequest): Promise<TResult> {
    if (this.#closed) return Promise.reject(new Error("后台持久化 Worker 已关闭。"));
    const id = this.#nextId++;
    return new Promise<TResult>((resolve, reject) => {
      this.#pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      this.#worker.postMessage({ id, ...request });
    });
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    this.#failPending(new Error("后台持久化 Worker 已关闭。"));
    await this.#worker.terminate();
  }

  #failPending(error: Error): void {
    for (const pending of this.#pending.values()) pending.reject(error);
    this.#pending.clear();
  }
}
