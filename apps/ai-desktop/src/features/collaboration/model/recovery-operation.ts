import type { CollaborationTimelineSnapshotOutDto } from "../../../../contracts/system/desktop/index";

export const RECOVERY_REQUEST_TIMEOUT_MS = 12_000;
export const RECOVERY_RECHECK_TIMEOUT_MS = 4_000;

export type RecoveryOperationResult = {
  kind: "confirmed" | "queued" | "unavailable";
  message: string;
};

export class RecoveryTimeoutError extends Error {}

/** 页面等待只结束本地忙碌状态，绝不取消已提交的主进程恢复请求。 */
export function waitForRecovery<T>(request: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => reject(new RecoveryTimeoutError()), timeoutMs);
    // 原请求可能在超时后才失败；消费 finally 派生 Promise，避免迟到拒绝成为未处理异常。
    void request.then(resolve, reject).finally(() => globalThis.clearTimeout(timer)).catch(() => undefined);
  });
}

type RecoveryOperationDependencies = {
  continueTask: (taskId: string) => Promise<unknown>;
  refreshRecoveryState: () => Promise<{ timeline: CollaborationTimelineSnapshotOutDto }>;
  requestTimeoutMs?: number;
  recheckTimeoutMs?: number;
};

/**
 * 编排任务恢复的页面等待、权威复查和可读结果。
 * 正常返回不等待时间线投影；超时才限时复查主进程状态与时间线。
 */
export async function continueTaskWithRecovery(
  taskId: string,
  dependencies: RecoveryOperationDependencies,
): Promise<RecoveryOperationResult> {
  const requestTimeoutMs = dependencies.requestTimeoutMs ?? RECOVERY_REQUEST_TIMEOUT_MS;
  const recheckTimeoutMs = dependencies.recheckTimeoutMs ?? RECOVERY_RECHECK_TIMEOUT_MS;
  try {
    await waitForRecovery(dependencies.continueTask(taskId), requestTimeoutMs);
    void dependencies.refreshRecoveryState().catch(() => undefined);
    return { kind: "confirmed", message: "" };
  } catch (error) {
    if (!(error instanceof RecoveryTimeoutError)) throw error;
    try {
      const snapshot = await waitForRecovery(dependencies.refreshRecoveryState(), recheckTimeoutMs);
      const queued = snapshot.timeline.groups.some((group) => group.nodes.some((node) => {
        return node.taskId === taskId && node.eventType === "task.recovery_requested";
      }));
      return queued
        ? { kind: "queued", message: "恢复请求已提交，正在排队。" }
        : { kind: "unavailable", message: "恢复请求未取消，但暂时无法确认状态。" };
    } catch {
      return { kind: "unavailable", message: "恢复请求未取消，但状态确认未返回。" };
    }
  }
}
