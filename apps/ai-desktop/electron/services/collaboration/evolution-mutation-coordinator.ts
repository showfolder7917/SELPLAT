import type { EvolutionMutationRequest } from "../../../contracts/collaboration/nangong-evolution.js";

export interface EvolutionMutationCoordinatorOptions {
  begin?: (topicId: string, action: string, request: EvolutionMutationRequest, currentStateVersion: string) => "started" | "completed";
  complete?: (idempotencyKey: string, resultStateVersion: string) => void;
  fail?: (idempotencyKey: string, error: unknown) => void;
}

/**
 * 统一专题写入口，在执行业务动作前取得同专题互斥锁并校验页面版本。
 * 真实传参示例：run("topic-1", "人工审批", { expectedStateVersion: "2026-08-29T01:00:00Z", idempotencyKey: "uuid" }, ...)。
 * 真实返回示例：首次执行返回业务动作产生的新状态；已完成的相同幂等键返回 readCurrent() 的当前事实。
 * 异常或副作用示例：旧版本、重复处理中或同专题并发会在业务动作前失败；业务异常会释放锁并登记失败，允许原键安全重试。
 */
export class EvolutionMutationCoordinator {
  readonly #begin: EvolutionMutationCoordinatorOptions["begin"];
  readonly #complete: EvolutionMutationCoordinatorOptions["complete"];
  readonly #fail: EvolutionMutationCoordinatorOptions["fail"];
  readonly #localMutations = new Map<string, "processing" | "resolved" | "open">();
  readonly #localTopicLocks = new Map<string, string>();

  constructor(options: EvolutionMutationCoordinatorOptions = {}) {
    this.#begin = options.begin;
    this.#complete = options.complete;
    this.#fail = options.fail;
  }

  run<State>(topicId: string, action: string, request: EvolutionMutationRequest, readVersion: () => string, readCurrent: () => State, operation: () => State): State {
    if (this.#start(topicId, action, request, readVersion()) === "completed") return readCurrent();
    try {
      const result = operation();
      this.#finish(topicId, request, readVersion());
      return result;
    } catch (error) {
      this.#abort(topicId, request, error);
      throw error;
    }
  }

  async runAsync<State>(topicId: string, action: string, request: EvolutionMutationRequest, readVersion: () => string, readCurrent: () => State, operation: () => Promise<State>): Promise<State> {
    if (this.#start(topicId, action, request, readVersion()) === "completed") return readCurrent();
    try {
      const result = await operation();
      this.#finish(topicId, request, readVersion());
      return result;
    } catch (error) {
      this.#abort(topicId, request, error);
      throw error;
    }
  }

  #start(topicId: string, action: string, request: EvolutionMutationRequest, currentStateVersion: string): "started" | "completed" {
    if (this.#begin) return this.#begin(topicId, action, request, currentStateVersion);
    const existing = this.#localMutations.get(request.idempotencyKey);
    if (existing === "resolved") return "completed";
    if (existing === "processing") throw new Error("当前操作正在处理中，请勿重复提交。");
    if (request.expectedStateVersion !== currentStateVersion) throw new Error("状态已更新，请重新确认后再执行。");
    const activeKey = this.#localTopicLocks.get(topicId);
    if (activeKey && activeKey !== request.idempotencyKey) throw new Error("当前专题正在执行其他推进或恢复操作，请等待完成后重试。");
    this.#localMutations.set(request.idempotencyKey, "processing");
    this.#localTopicLocks.set(topicId, request.idempotencyKey);
    return "started";
  }

  #finish(topicId: string, request: EvolutionMutationRequest, resultStateVersion: string): void {
    if (this.#complete) this.#complete(request.idempotencyKey, resultStateVersion);
    else this.#localMutations.set(request.idempotencyKey, "resolved");
    if (this.#localTopicLocks.get(topicId) === request.idempotencyKey) this.#localTopicLocks.delete(topicId);
  }

  #abort(topicId: string, request: EvolutionMutationRequest, error: unknown): void {
    if (this.#fail) this.#fail(request.idempotencyKey, error);
    else this.#localMutations.set(request.idempotencyKey, "open");
    if (this.#localTopicLocks.get(topicId) === request.idempotencyKey) this.#localTopicLocks.delete(topicId);
  }
}
