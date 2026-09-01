import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { IntegrationReleaseEventTypeValue, IntegrationReleaseHolderOutDto, IntegrationReleaseInDto } from "../../../../../contracts/services/support/capabilities/release/index.js";

interface Options {
  coordinationRoot: string;
  recordEvent(type: string, details: Record<string, unknown>): void;
  acquireTimeoutMs?: number;
  staleHeartbeatMs?: number;
  heartbeatIntervalMs?: number;
}

/** 集成与发布共用的跨进程单一入口；编码任务可继续，但任何时刻只允许一个候选批次合并或发布。 */
export class IntegrationReleaseCoordinatorFacade {
  readonly #root: string;
  readonly #lockRoot: string;
  readonly #ownerFile: string;
  readonly #recordEvent: Options["recordEvent"];
  readonly #acquireTimeoutMs: number;
  readonly #staleHeartbeatMs: number;
  readonly #heartbeatIntervalMs: number;
  #queue: Promise<void> = Promise.resolve();

  constructor(options: Options) {
    this.#root = path.resolve(options.coordinationRoot);
    this.#lockRoot = path.join(this.#root, "集成发布.lock");
    this.#ownerFile = path.join(this.#lockRoot, "owner.json");
    this.#recordEvent = options.recordEvent;
    this.#acquireTimeoutMs = positive(options.acquireTimeoutMs, 30 * 60_000);
    this.#staleHeartbeatMs = positive(options.staleHeartbeatMs, 30_000);
    this.#heartbeatIntervalMs = positive(options.heartbeatIntervalMs, 5_000);
    mkdirSync(this.#root, { recursive: true });
  }

  holder(): IntegrationReleaseHolderOutDto | null { return readJson<IntegrationReleaseHolderOutDto>(this.#ownerFile); }

  run<T>(request: IntegrationReleaseInDto, operation: () => Promise<T>): Promise<T> {
    validate(request);
    this.#emit("queued", request, { queuedAt: new Date().toISOString() });
    const result = this.#queue.then(async () => {
      const release = await this.#acquireInternal(request);
      try { return await operation(); }
      catch (error) {
        this.#emit("failed", request, { detail: error instanceof Error ? error.message.slice(0, 2_000) : String(error).slice(0, 2_000) });
        throw error;
      } finally { release(); }
    });
    this.#queue = result.then(() => undefined, () => undefined);
    return result;
  }

  /** 供已有集成状态机取得同一把跨进程租约；调用方必须在 finally 中执行返回的释放函数。 */
  acquire(request: IntegrationReleaseInDto): Promise<() => void> {
    validate(request);
    this.#emit("queued", request, { queuedAt: new Date().toISOString() });
    return this.#acquireInternal(request);
  }

  async #acquireInternal(request: IntegrationReleaseInDto): Promise<() => void> {
    const leaseId = randomUUID();
    const queuedAt = new Date().toISOString();
    let contentionLeaseId: string | null = null;
    while (true) {
      try {
        mkdirSync(this.#lockRoot);
        const acquiredAt = new Date().toISOString();
        const holder: IntegrationReleaseHolderOutDto = { ...request, leaseId, processId: process.pid, queuedAt, acquiredAt, heartbeatAt: acquiredAt };
        writeJson(this.#ownerFile, holder);
        this.#emit("acquired", request, { leaseId, processId: process.pid, acquiredAt, waitDurationMs: Date.now() - Date.parse(queuedAt) });
        const heartbeat = setInterval(() => {
          const current = readJson<IntegrationReleaseHolderOutDto>(this.#ownerFile);
          if (current?.leaseId !== leaseId) return;
          holder.heartbeatAt = new Date().toISOString();
          writeJson(this.#ownerFile, holder);
        }, this.#heartbeatIntervalMs);
        heartbeat.unref?.();
        return () => {
          clearInterval(heartbeat);
          if (readJson<IntegrationReleaseHolderOutDto>(this.#ownerFile)?.leaseId === leaseId) rmSync(this.#lockRoot, { recursive: true, force: true });
          this.#emit("released", request, { leaseId, processId: process.pid, releasedAt: new Date().toISOString() });
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      const holder = this.holder();
      if (holder?.leaseId !== contentionLeaseId) {
        contentionLeaseId = holder?.leaseId || null;
        this.#emit("contended", request, { holder });
      }
      if (holder && Date.now() - Date.parse(holder.heartbeatAt) >= this.#staleHeartbeatMs && !isProcessAlive(holder.processId)) {
        const staleRoot = `${this.#lockRoot}.stale-${holder.leaseId}`;
        try {
          renameSync(this.#lockRoot, staleRoot);
          rmSync(staleRoot, { recursive: true, force: true });
          this.#emit("stale-recovered", request, { staleHolder: holder });
        } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      } else if (!holder && olderThan(this.#lockRoot, this.#staleHeartbeatMs)) {
        rmSync(this.#lockRoot, { recursive: true, force: true });
        this.#emit("stale-recovered", request, { staleHolder: null, reason: "owner_record_missing" });
      }
      if (Date.now() - Date.parse(queuedAt) >= this.#acquireTimeoutMs) {
        this.#emit("timeout", request, { holder: this.holder() });
        throw new Error(`等待集成发布资源超时：${request.releaseBatchId}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  #emit(type: IntegrationReleaseEventTypeValue, request: IntegrationReleaseInDto, details: Record<string, unknown>): void {
    this.#recordEvent(`integration.release.${type}`, { ...request, ...details, occurredAt: new Date().toISOString() });
  }
}

function validate(request: IntegrationReleaseInDto): void {
  if (!/^[a-zA-Z0-9._-]+$/.test(request.releaseBatchId)) throw new Error("发布批次 ID 不安全。");
  if (!/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(request.version)) throw new Error("发布版本号不符合语义化版本格式。");
  if (!Number.isInteger(request.generation) || request.generation < 1 || request.taskIds.length === 0) throw new Error("发布批次必须绑定有效代次和任务。");
}

function positive(value: number | undefined, fallback: number): number { return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback; }
function olderThan(target: string, milliseconds: number): boolean { try { return Date.now() - statSync(target).mtimeMs >= milliseconds; } catch { return false; } }
function isProcessAlive(processId: number): boolean { try { process.kill(processId, 0); return true; } catch (error) { return (error as NodeJS.ErrnoException).code !== "ESRCH"; } }
function readJson<T>(filePath: string): T | null { try { return JSON.parse(readFileSync(filePath, "utf8")) as T; } catch { return null; } }
function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporary, filePath);
}
