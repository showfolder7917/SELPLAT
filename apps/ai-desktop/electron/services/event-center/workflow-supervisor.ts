import type { WorkflowStateReaders } from "../../../contracts/workflow.js";
import type { WorkflowRepository } from "./workflow-repository.js";

export interface WorkflowSupervisorOptions {
  repository: WorkflowRepository;
  readers: WorkflowStateReaders;
  onStalledTasks(taskIds: string[]): void | Promise<void>;
  intervalMs?: number;
  now?: () => Date;
}

/** 独立于任何人物任务的主进程监督器；同步全流程快照、运行心跳并把无进展任务交给令狐入口。 */
export class WorkflowSupervisor {
  readonly #repository: WorkflowRepository;
  readonly #readers: WorkflowStateReaders;
  readonly #onStalledTasks: WorkflowSupervisorOptions["onStalledTasks"];
  readonly #intervalMs: number;
  readonly #now: () => Date;
  #timer: ReturnType<typeof setInterval> | null = null;
  #checking = false;

  constructor(options: WorkflowSupervisorOptions) {
    this.#repository = options.repository;
    this.#readers = options.readers;
    this.#onStalledTasks = options.onStalledTasks;
    this.#intervalMs = options.intervalMs || 30_000;
    this.#now = options.now || (() => new Date());
  }

  start(): void {
    if (this.#timer) return;
    this.#repository.startRuntimeSession(process.pid, this.#now().toISOString());
    void this.checkNow();
    this.#timer = setInterval(() => void this.checkNow(), this.#intervalMs);
  }

  stop(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
    this.#repository.stopRuntimeSession(this.#now().toISOString());
  }

  async checkNow(): Promise<void> {
    if (this.#checking) return;
    this.#checking = true;
    try {
      const now = this.#now().toISOString();
      this.#repository.heartbeatRuntimeSession(now);
      this.#repository.syncEvolutionState(this.#readers.evolution());
      this.#repository.syncCollaborationState(this.#readers.collaboration());
      this.#repository.syncLinghuState(this.#readers.linghu());
      const stalled = this.#repository.detectStalledTasks(now);
      if (stalled.length > 0) await this.#onStalledTasks(stalled.map((item) => item.taskId));
    } catch (error) {
      try {
        this.#repository.recordEvent({
          sourceType: "launcher",
          sourceId: "workflow-supervisor",
          eventType: "workflow.supervisor.failed",
          category: "technical-error",
          severity: "error",
          status: "open",
          message: error instanceof Error ? error.message : String(error),
        });
      } catch {
        // 数据库自身不可用时不能递归写入同一数据库；启动状态和文件审计仍保留真实失败。
      }
    } finally {
      this.#checking = false;
    }
  }
}
