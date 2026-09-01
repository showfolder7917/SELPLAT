import type { CollaborationStateOutDto } from "../../../../contracts/collaboration/workflow/index.js";
import type { WorkflowExceptionRecord, WorkflowStateReaders } from "../../../../contracts/governance/workflow.js";
import type { WorkflowRepository } from "./workflow.repository.js";

export interface WorkflowSupervisorOptions {
  repository: WorkflowRepository;
  readers: WorkflowStateReaders;
  projectCollaborationTimeline(state: CollaborationStateOutDto): void;
  onStalledTasks(taskIds: string[]): void | Promise<void>;
  onUnhandledExceptions?(events: WorkflowExceptionRecord[]): void | Promise<void>;
  intervalMs?: number;
  now?: () => Date;
}

/** 独立于任何人物任务的主进程监督器；同步全流程快照、运行心跳并把无进展任务交给令狐入口。 */
export class WorkflowSupervisor {
  readonly #repository: WorkflowRepository;
  readonly #readers: WorkflowStateReaders;
  readonly #projectCollaborationTimeline: WorkflowSupervisorOptions["projectCollaborationTimeline"];
  readonly #onStalledTasks: WorkflowSupervisorOptions["onStalledTasks"];
  readonly #onUnhandledExceptions: WorkflowSupervisorOptions["onUnhandledExceptions"];
  readonly #intervalMs: number;
  readonly #now: () => Date;
  #timer: ReturnType<typeof setInterval> | null = null;
  #checking = false;

  constructor(options: WorkflowSupervisorOptions) {
    this.#repository = options.repository;
    this.#readers = options.readers;
    this.#projectCollaborationTimeline = options.projectCollaborationTimeline;
    this.#onStalledTasks = options.onStalledTasks;
    this.#onUnhandledExceptions = options.onUnhandledExceptions;
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
      // 三个业务域必须相互隔离；某一份状态损坏时仍要让其他领域和卡住检测继续推进。
      this.#syncDomain("evolution", () => this.#repository.syncEvolutionState(this.#readers.evolution()), now);
      this.#syncDomain("collaboration", () => {
        const collaboration = this.#readers.collaboration();
        this.#repository.syncCollaborationState(collaboration);
        // 启动和监督轮询都补投影尚未消费的不可变事件，确保升级后旧阻塞事实无需重新执行任务即可显示。
        this.#projectCollaborationTimeline(collaboration);
      }, now);
      this.#syncDomain("linghu", () => this.#repository.syncLinghuState(this.#readers.linghu()), now);
      const stalled = this.#repository.detectStalledTasks(now);
      if (stalled.length > 0) await this.#onStalledTasks(stalled.map((item) => item.taskId));
      if (this.#onUnhandledExceptions && this.#readers.linghu().enabled) {
        const open = this.#repository.listUnhandledExceptions().filter((event) => event.status === "open");
        const claimedIds = this.#repository.claimExceptions(open.map((event) => event.eventId), "linghu-ancestor", now);
        const claimed = open.filter((event) => claimedIds.includes(event.eventId)).map((event) => ({
          ...event, status: "processing" as const, handlingOwnerId: "linghu-ancestor", handlingStartedAt: now,
        }));
        if (claimed.length) await this.#onUnhandledExceptions(claimed);
      }
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

  /** 单域同步失败进入统一技术异常队列，但不能让令狐失去对其余流程的监督能力。 */
  #syncDomain(domain: "evolution" | "collaboration" | "linghu", operation: () => void, now: string): void {
    try {
      operation();
    } catch (error) {
      try {
        this.#repository.recordEvent({
          sourceType: "launcher",
          sourceId: "workflow-supervisor",
          eventType: `workflow.supervisor.${domain}_sync_failed`,
          category: "technical-error",
          severity: "error",
          status: "open",
          message: error instanceof Error ? error.message : String(error),
          payload: { domain },
          occurredAt: now,
        });
      } catch {
        // SQLite 自身不可用时由外层文件审计保留证据，监督循环仍不能被单域失败中断。
      }
    }
  }
}
