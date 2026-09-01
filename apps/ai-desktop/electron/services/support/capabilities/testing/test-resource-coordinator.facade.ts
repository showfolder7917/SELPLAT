import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import type {
  TestResourceCoordinatorStateOutDto,
  TestResourceEventTypeValue,
  TestResourceHolderOutDto,
  TestResourceInDto,
  TestResourceWaiterOutDto,
} from "../../../../../contracts/services/support/capabilities/testing/index.js";

interface TestResourceCoordinatorOptions {
  coordinationRoot: string;
  recordEvent(type: string, details: Record<string, unknown>, taskId?: string): void;
  acquireTimeoutMs?: number;
  staleHeartbeatMs?: number;
  heartbeatIntervalMs?: number;
  pollIntervalMs?: number;
}

interface LeaseRuntime {
  holder: TestResourceHolderOutDto;
  waitDurationMs: number;
  contentionCount: number;
  release(): void;
}

const DEFAULT_ACQUIRE_TIMEOUT_MS = 30 * 60_000;
const DEFAULT_STALE_HEARTBEAT_MS = 30_000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 5_000;
const DEFAULT_POLL_INTERVAL_MS = 50;

/** 所有桌面测试共享的跨进程单一入口；调用方只提交资源事实，不直接操作锁文件或测试占用状态。 */
export class TestResourceCoordinatorFacade {
  readonly #coordinationRoot: string;
  readonly #lockRoot: string;
  readonly #ownerFile: string;
  readonly #lastEventFile: string;
  readonly #waitersRoot: string;
  readonly #recordEvent: TestResourceCoordinatorOptions["recordEvent"];
  readonly #acquireTimeoutMs: number;
  readonly #staleHeartbeatMs: number;
  readonly #heartbeatIntervalMs: number;
  readonly #pollIntervalMs: number;
  #queue: Promise<void> = Promise.resolve();
  #localQueueDepth = 0;
  #lastEvent: TestResourceCoordinatorStateOutDto["lastEvent"] = null;

  constructor(options: TestResourceCoordinatorOptions) {
    this.#coordinationRoot = path.resolve(options.coordinationRoot);
    this.#lockRoot = path.join(this.#coordinationRoot, "全局测试资源.lock");
    this.#ownerFile = path.join(this.#lockRoot, "owner.json");
    this.#lastEventFile = path.join(this.#coordinationRoot, "最近事件.json");
    this.#waitersRoot = path.join(this.#coordinationRoot, "等待队列");
    this.#recordEvent = options.recordEvent;
    this.#acquireTimeoutMs = positive(options.acquireTimeoutMs, DEFAULT_ACQUIRE_TIMEOUT_MS);
    this.#staleHeartbeatMs = positive(options.staleHeartbeatMs, DEFAULT_STALE_HEARTBEAT_MS);
    this.#heartbeatIntervalMs = positive(options.heartbeatIntervalMs, DEFAULT_HEARTBEAT_INTERVAL_MS);
    this.#pollIntervalMs = positive(options.pollIntervalMs, DEFAULT_POLL_INTERVAL_MS);
    mkdirSync(this.#waitersRoot, { recursive: true });
  }

  state(): TestResourceCoordinatorStateOutDto {
    return {
      holder: readJson<TestResourceHolderOutDto>(this.#ownerFile),
      waiters: readWaiters(this.#waitersRoot, this.#staleHeartbeatMs),
      localQueueDepth: this.#localQueueDepth,
      lastEvent: readJson<TestResourceCoordinatorStateOutDto["lastEvent"]>(this.#lastEventFile)
        || (this.#lastEvent ? structuredClone(this.#lastEvent) : null),
    };
  }

  run<T>(request: TestResourceInDto, operation: () => Promise<T>): Promise<T> {
    validateRequest(request);
    const leaseId = randomUUID();
    const queuedAt = new Date().toISOString();
    const waiter: TestResourceWaiterOutDto = { ...request, leaseId, processId: process.pid, queuedAt };
    const waiterFile = path.join(this.#waitersRoot, `${leaseId}.json`);
    writeJson(waiterFile, waiter);
    this.#localQueueDepth += 1;
    this.#emit("queued", request, queuedAt, 0, null, 0, { leaseId, processId: process.pid, queueDepth: this.state().waiters.length });

    const result = this.#queue.then(async () => {
      const lease = await this.#acquire(waiter, waiterFile);
      const executionStartedAt = Date.now();
      try {
        return await operation();
      } catch (error) {
        this.#emit("failed", request, new Date().toISOString(), lease.waitDurationMs, Date.now() - executionStartedAt, lease.contentionCount, {
          leaseId,
          detail: error instanceof Error ? error.message.slice(0, 2_000) : String(error).slice(0, 2_000),
        });
        throw error;
      } finally {
        lease.release();
        this.#localQueueDepth = Math.max(0, this.#localQueueDepth - 1);
      }
    }, (error) => {
      rmSync(waiterFile, { force: true });
      this.#localQueueDepth = Math.max(0, this.#localQueueDepth - 1);
      throw error;
    });
    this.#queue = result.then(() => undefined, () => undefined);
    return result;
  }

  async #acquire(waiter: TestResourceWaiterOutDto, waiterFile: string): Promise<LeaseRuntime> {
    const queuedAtMs = Date.parse(waiter.queuedAt);
    let contentionCount = 0;
    let lastHolderLeaseId: string | null = null;
    let pollDelayMs = this.#pollIntervalMs;
    while (true) {
      try {
        mkdirSync(this.#lockRoot);
        const acquiredAt = new Date().toISOString();
        const holder: TestResourceHolderOutDto = { ...waiter, acquiredAt, heartbeatAt: acquiredAt };
        writeJson(this.#ownerFile, holder);
        rmSync(waiterFile, { force: true });
        const waitDurationMs = Date.now() - queuedAtMs;
        this.#emit("acquired", waiter, acquiredAt, waitDurationMs, null, contentionCount, { leaseId: waiter.leaseId, processId: process.pid });
        const heartbeat = setInterval(() => this.#heartbeat(holder), this.#heartbeatIntervalMs);
        heartbeat.unref?.();
        let released = false;
        return {
          holder,
          waitDurationMs,
          contentionCount,
          release: () => {
            if (released) return;
            released = true;
            clearInterval(heartbeat);
            const current = readJson<TestResourceHolderOutDto>(this.#ownerFile);
            const releasedAt = new Date().toISOString();
            if (current?.leaseId === holder.leaseId) rmSync(this.#lockRoot, { recursive: true, force: true });
            this.#emit("released", waiter, releasedAt, waitDurationMs, Date.parse(releasedAt) - Date.parse(acquiredAt), contentionCount, { leaseId: waiter.leaseId, processId: process.pid });
          },
        };
      } catch (error) {
        if (!isAlreadyExists(error)) {
          rmSync(waiterFile, { force: true });
          this.#localQueueDepth = Math.max(0, this.#localQueueDepth - 1);
          throw error;
        }
      }

      const holder = readJson<TestResourceHolderOutDto>(this.#ownerFile);
      if (holder && holder.leaseId !== lastHolderLeaseId) {
        contentionCount += 1;
        lastHolderLeaseId = holder.leaseId;
        this.#emit("contended", waiter, new Date().toISOString(), Date.now() - queuedAtMs, null, contentionCount, { holder });
      }
      if (holder && isRecoverableStaleHolder(holder, this.#staleHeartbeatMs)) this.#recoverStaleHolder(holder, waiter);
      if (!holder && isPathOlderThan(this.#lockRoot, this.#staleHeartbeatMs)) this.#recoverOrphanLock(waiter);

      const waitDurationMs = Date.now() - queuedAtMs;
      if (waitDurationMs >= this.#acquireTimeoutMs) {
        rmSync(waiterFile, { force: true });
        this.#localQueueDepth = Math.max(0, this.#localQueueDepth - 1);
        this.#emit("timeout", waiter, new Date().toISOString(), waitDurationMs, null, contentionCount, { holder: readJson<TestResourceHolderOutDto>(this.#ownerFile) });
        throw new Error(`等待全局测试资源超时：${waiter.runId}`);
      }
      await delay(pollDelayMs);
      pollDelayMs = Math.min(250, Math.max(this.#pollIntervalMs, Math.round(pollDelayMs * 1.5)));
    }
  }

  #heartbeat(holder: TestResourceHolderOutDto): void {
    const current = readJson<TestResourceHolderOutDto>(this.#ownerFile);
    if (current?.leaseId !== holder.leaseId) return;
    holder.heartbeatAt = new Date().toISOString();
    writeJson(this.#ownerFile, holder);
  }

  #recoverStaleHolder(holder: TestResourceHolderOutDto, waiter: TestResourceWaiterOutDto): void {
    const staleRoot = `${this.#lockRoot}.stale-${holder.leaseId}`;
    try {
      renameSync(this.#lockRoot, staleRoot);
      rmSync(staleRoot, { recursive: true, force: true });
      this.#emit("stale-recovered", waiter, new Date().toISOString(), Date.now() - Date.parse(waiter.queuedAt), null, 1, { staleHolder: holder });
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }

  #recoverOrphanLock(waiter: TestResourceWaiterOutDto): void {
    const staleRoot = `${this.#lockRoot}.orphan-${waiter.leaseId}`;
    try {
      renameSync(this.#lockRoot, staleRoot);
      rmSync(staleRoot, { recursive: true, force: true });
      this.#emit("stale-recovered", waiter, new Date().toISOString(), Date.now() - Date.parse(waiter.queuedAt), null, 1, { staleHolder: null, reason: "owner_record_missing" });
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }

  #emit(
    type: TestResourceEventTypeValue,
    request: TestResourceInDto,
    occurredAt: string,
    waitDurationMs: number,
    executionDurationMs: number | null,
    contentionCount: number,
    extra: Record<string, unknown>,
  ): void {
    this.#lastEvent = { type, runId: request.runId, taskId: request.taskId, occurredAt, waitDurationMs, executionDurationMs, contentionCount };
    writeJson(this.#lastEventFile, this.#lastEvent);
    this.#recordEvent(`test.resource.${type}`, {
      ...request,
      ...extra,
      occurredAt,
      waitDurationMs,
      executionDurationMs,
      contentionCount,
    }, request.taskId || undefined);
  }
}

function validateRequest(request: TestResourceInDto): void {
  if (!request.runId.trim()) throw new Error("测试资源 runId 不能为空。");
  if (!request.initiatorMemberId.trim()) throw new Error("测试资源发起人不能为空。");
  if (!path.isAbsolute(request.buildRoot)) throw new Error("测试资源 buildRoot 必须是已解析绝对路径。");
}

function readWaiters(root: string, staleAfterMs: number): TestResourceWaiterOutDto[] {
  try {
    return readdirSync(root)
      .filter((name) => name.endsWith(".json"))
      .map((name) => {
        const filePath = path.join(root, name);
        const waiter = readJson<TestResourceWaiterOutDto>(filePath);
        if (waiter && Date.now() - Date.parse(waiter.queuedAt) >= staleAfterMs && !isProcessAlive(waiter.processId)) {
          rmSync(filePath, { force: true });
          return null;
        }
        return waiter;
      })
      .filter((value): value is TestResourceWaiterOutDto => Boolean(value))
      .sort((left, right) => Date.parse(left.queuedAt) - Date.parse(right.queuedAt));
  } catch {
    return [];
  }
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporary, filePath);
}

function readJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function isRecoverableStaleHolder(holder: TestResourceHolderOutDto, staleHeartbeatMs: number): boolean {
  if (Date.now() - Date.parse(holder.heartbeatAt) < staleHeartbeatMs) return false;
  return !isProcessAlive(holder.processId);
}

function isProcessAlive(processId: number): boolean {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

function isPathOlderThan(targetPath: string, milliseconds: number): boolean {
  try {
    return Date.now() - statSync(targetPath).mtimeMs >= milliseconds;
  } catch {
    return false;
  }
}

function isAlreadyExists(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === "EEXIST";
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === "ENOENT";
}

function positive(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
