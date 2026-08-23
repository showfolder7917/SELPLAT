/** 所有桌面测试共享的单一入口；避免任务签发、集成验证和统一测试同时争用构建产物与 Electron。 */
export class TestExecutionGate {
  #queue: Promise<void> = Promise.resolve();

  run<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#queue.then(operation);
    this.#queue = result.then(() => undefined, () => undefined);
    return result;
  }
}
