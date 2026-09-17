import { Worker } from "node:worker_threads";

import type { AiMemoryDatabaseStatusOutDto } from "../../../../../contracts/services/support/platform/persistence/index.js";
import type { BackgroundPersistencePort, BackgroundPersistenceRequest } from "./background-persistence.port.js";

type WorkerOptions = { workerUrl: URL; projectRoot: string; runtimeMarkerPath: string; workflowRuntimeMarkerPath: string; migrationSqlRoot?: string };
type PendingRequest = { resolve: (value: unknown) => void; reject: (error: Error) => void };

/** 主进程只维护请求关联；SQLite 连接、扫描和事务全部由 Worker 处理。 */
export class BackgroundPersistenceWorkerPort implements BackgroundPersistencePort {
  readonly #worker: Worker;
  readonly #pending = new Map<number, PendingRequest>();
  readonly #ready: Promise<AiMemoryDatabaseStatusOutDto>;
  #settleReady: ((status: AiMemoryDatabaseStatusOutDto) => void) | null;
  #nextId = 1;
  #closed = false;

  constructor(options: WorkerOptions) {
    let settleReady: ((status: AiMemoryDatabaseStatusOutDto) => void) | null = null;
    this.#ready = new Promise((resolve) => { settleReady = resolve; });
    this.#settleReady = settleReady;
    this.#worker = new Worker(options.workerUrl, { workerData: {
      projectRoot: options.projectRoot,
      runtimeMarkerPath: options.runtimeMarkerPath,
      workflowRuntimeMarkerPath: options.workflowRuntimeMarkerPath,
      migrationSqlRoot: options.migrationSqlRoot,
    } });
    this.#worker.on("message", (message: { id?: number; type?: string; status?: AiMemoryDatabaseStatusOutDto; result?: unknown; error?: string }) => {
      if (message.type === "ready" && message.status) {
        this.#settleReady?.(message.status);
        this.#settleReady = null;
        return;
      }
      if (typeof message.id !== "number") return;
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error));
      else pending.resolve(message.result);
    });
    this.#worker.on("error", (error) => {
      this.#settleReady?.({ state: "unavailable", schemaVersion: null, message: error.message });
      this.#settleReady = null;
      this.#failPending(error);
    });
    this.#worker.on("exit", (code) => {
      if (!this.#closed && code !== 0) {
        const error = new Error(`后台持久化 Worker 异常退出：${code}`);
        this.#settleReady?.({ state: "unavailable", schemaVersion: null, message: error.message });
        this.#settleReady = null;
        this.#failPending(error);
      }
    });
  }

  ready(): Promise<AiMemoryDatabaseStatusOutDto> {
    return this.#ready;
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
