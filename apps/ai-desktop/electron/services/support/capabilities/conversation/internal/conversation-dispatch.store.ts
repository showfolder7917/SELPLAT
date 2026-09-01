import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import type {
  ConversationDispatchStateOutDto,
  ConversationQueueItemOutDto,
  SendMessageInDto,
} from "../../../../../../contracts/services/support/capabilities/conversation/index.js";

interface StoredDispatchState extends ConversationDispatchStateOutDto {
  version: 1;
}

const EMPTY_STATE: StoredDispatchState = { version: 1, activeTask: null, queue: [] };

/**
 * 持久化当前发送、显式补充和后续队列；Electron 重建后把未收尾的运行项标为可恢复，禁止静默重复执行。
 */
export class ConversationDispatchStore {
  readonly #filePath: string;
  readonly #record: (type: string, details?: Record<string, unknown>, taskId?: string) => void;
  #state: StoredDispatchState;

  constructor(
    filePath: string,
    record: (type: string, details?: Record<string, unknown>, taskId?: string) => void = () => undefined,
  ) {
    this.#filePath = filePath;
    this.#record = record;
    this.#state = this.#read();
    if (this.#state.activeTask?.status === "running") {
      this.#state.activeTask.status = "recoverable";
      this.#write();
      this.#record("dispatch.recovery_detected", {
        dispatchId: this.#state.activeTask.id,
        startedAt: this.#state.activeTask.startedAt,
      });
    }
  }

  state(): ConversationDispatchStateOutDto {
    return structuredClone({ activeTask: this.#state.activeTask, queue: this.#state.queue });
  }

  begin(request: SendMessageInDto, dispatchId: string = randomUUID()): string {
    if (this.#state.activeTask) throw new Error("当前任务尚未结束，新消息必须先进入队列。");
    this.#state.activeTask = {
      id: dispatchId,
      request: normalizeRequest(request),
      startedAt: new Date().toISOString(),
      status: "running",
    };
    this.#write();
    this.#record("dispatch.started", { dispatchId, executionMode: request.executionMode });
    return dispatchId;
  }

  finish(dispatchId: string, outcome: "completed" | "failed" | "interrupted"): void {
    if (this.#state.activeTask?.id !== dispatchId) return;
    this.#state.activeTask = null;
    this.#write();
    this.#record("dispatch.finished", { dispatchId, outcome });
  }

  enqueue(request: SendMessageInDto, displayText?: string, automatic = false): ConversationQueueItemOutDto {
    const item: ConversationQueueItemOutDto = {
      id: randomUUID(),
      request: normalizeRequest(request),
      displayText: (displayText || request.message).slice(0, 20_000),
      createdAt: new Date().toISOString(),
      automatic,
    };
    this.#state.queue.push(item);
    this.#write();
    this.#record("dispatch.queued", {
      dispatchId: item.id,
      position: this.#state.queue.length,
      executionMode: item.request.executionMode,
      automatic,
    });
    return structuredClone(item);
  }

  queueItem(itemId: string): ConversationQueueItemOutDto | null {
    const item = this.#state.queue.find((candidate) => candidate.id === itemId);
    return item ? structuredClone(item) : null;
  }

  takeQueued(itemId: string): ConversationQueueItemOutDto {
    const index = this.#state.queue.findIndex((candidate) => candidate.id === itemId);
    if (index < 0) throw new Error("排队消息已被处理或不存在。");
    const [item] = this.#state.queue.splice(index, 1);
    this.#write();
    this.#record("dispatch.dequeued", { dispatchId: item.id, remaining: this.#state.queue.length });
    return structuredClone(item);
  }

  removeQueued(itemId: string, reason: "supplemented" | "discarded"): ConversationQueueItemOutDto {
    const item = this.takeQueued(itemId);
    this.#record(`dispatch.${reason}`, { dispatchId: item.id });
    return item;
  }

  recover(): ConversationQueueItemOutDto {
    const active = this.#state.activeTask;
    if (!active || active.status !== "recoverable") throw new Error("没有可以继续执行的任务。");
    const item: ConversationQueueItemOutDto = {
      id: active.id,
      request: normalizeRequest({
        ...active.request,
        message: `继续执行上次未完成的任务。\n\n原任务：${active.request.message}`,
      }),
      displayText: "继续执行未完成任务",
      createdAt: new Date().toISOString(),
      automatic: false,
    };
    this.#state.activeTask = null;
    this.#state.queue.unshift(item);
    this.#write();
    this.#record("dispatch.recovery_queued", { dispatchId: item.id });
    return structuredClone(item);
  }

  discardRecovery(): void {
    const active = this.#state.activeTask;
    if (!active || active.status !== "recoverable") return;
    this.#state.activeTask = null;
    this.#write();
    this.#record("dispatch.recovery_discarded", { dispatchId: active.id });
  }

  clear(): void {
    const queuedCount = this.#state.queue.length;
    const activeId = this.#state.activeTask?.id || null;
    this.#state = structuredClone(EMPTY_STATE);
    this.#write();
    this.#record("dispatch.cleared", { activeId, queuedCount });
  }

  #read(): StoredDispatchState {
    try {
      const value = JSON.parse(readFileSync(this.#filePath, "utf8")) as Partial<StoredDispatchState>;
      const queue = Array.isArray(value.queue) ? value.queue.filter(isQueueItem).map((item) => ({ ...item, request: normalizeRequest(item.request) })) : [];
      const activeTask = isActiveTask(value.activeTask) ? { ...value.activeTask, request: normalizeRequest(value.activeTask.request) } : null;
      return { version: 1, activeTask, queue };
    } catch {
      return structuredClone(EMPTY_STATE);
    }
  }

  #write(): void {
    const temporary = `${this.#filePath}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(this.#state, null, 2)}\n`, "utf8");
    renameSync(temporary, this.#filePath);
  }
}

function normalizeRequest(request: SendMessageInDto): SendMessageInDto {
  return {
    message: request.message.slice(0, 20_000),
    locale: request.locale === "ja" ? "ja" : "zh-CN",
    sandboxMode: request.sandboxMode === "read-only" ? "read-only" : "workspace-write",
    attachmentIds: Array.isArray(request.attachmentIds) ? request.attachmentIds.filter((id) => typeof id === "string").slice(0, 20) : [],
    executionMode: request.executionMode,
  };
}

function isQueueItem(value: unknown): value is ConversationQueueItemOutDto {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ConversationQueueItemOutDto>;
  return typeof candidate.id === "string" && typeof candidate.createdAt === "string" && typeof candidate.displayText === "string" && Boolean(candidate.request);
}

function isActiveTask(value: unknown): value is NonNullable<ConversationDispatchStateOutDto["activeTask"]> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<NonNullable<ConversationDispatchStateOutDto["activeTask"]>>;
  return typeof candidate.id === "string" && typeof candidate.startedAt === "string"
    && (candidate.status === "running" || candidate.status === "recoverable") && Boolean(candidate.request);
}
