import { selectHanliAcceptanceContinuation, type HanliAcceptanceContinuation } from "./hanli-acceptance-continuation.policy.js";

/**
 * 验收会话状态门面。
 *
 * 模型回合编排只读取这个稳定接口；窗口工具不再直接决定是否需要补偿回合。
 */
export class HanliAcceptanceSessionFacade {
  #completed = false;
  #finishAttempted = false;
  #finishRejection = "";
  #finalizationAttempted = false;
  #correctionAttempted = false;
  #observationRecoveryAttempted = false;
  #mode: "interactive" | "finish-only" = "interactive";

  get completed(): boolean {
    return this.#completed;
  }

  get finishAttempted(): boolean {
    return this.#finishAttempted;
  }

  get finishRejection(): string {
    return this.#finishRejection;
  }

  get onlyFinishAllowed(): boolean {
    return this.#mode === "finish-only";
  }

  markFinishAttempted(): void {
    this.#finishAttempted = true;
  }

  rejectFinish(reason: string): void {
    this.#finishRejection = reason;
  }

  complete(): void {
    this.#completed = true;
  }

  nextContinuation(hasArchivedScreenshot: boolean): HanliAcceptanceContinuation | null {
    const continuation = selectHanliAcceptanceContinuation({
      completed: this.#completed,
      hasArchivedScreenshot,
      finishAttempted: this.#finishAttempted,
      finishRejection: this.#finishRejection,
      finalizationAttempted: this.#finalizationAttempted,
      correctionAttempted: this.#correctionAttempted,
      observationRecoveryAttempted: this.#observationRecoveryAttempted,
    });
    if (continuation?.kind === "retry-observation") {
      this.#observationRecoveryAttempted = true;
      this.#mode = "interactive";
    } else if (continuation?.kind === "finish-only") {
      this.#finalizationAttempted = true;
      this.#mode = "finish-only";
    } else if (continuation?.kind === "correction") {
      this.#correctionAttempted = true;
      this.#mode = "finish-only";
    }
    return continuation;
  }
}
