export const FILE_OPERATION_TIMEOUT_MS = 12_000;

export class FileOperationTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileOperationTimeoutError";
  }
}

/** 页面等待只收口本地状态，不会取消已经发送给主进程的文件操作。 */
export function waitForFileOperation<T>(request: Promise<T>, message: string, timeoutMs = FILE_OPERATION_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => reject(new FileOperationTimeoutError(message)), timeoutMs);
    // finally 会沿用原请求的拒绝结果；显式消费其派生 Promise，避免迟到失败成为未处理拒绝。
    void request.then(resolve, reject).finally(() => globalThis.clearTimeout(timer)).catch(() => undefined);
  });
}
