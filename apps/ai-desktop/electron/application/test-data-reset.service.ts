import type { TestDataResetResult } from "../../contracts/platform/persistence/index.js";

export interface CandidateCleanupResult {
  branchCount: number;
  worktreeCount: number;
  failures: string[];
}

export interface TestDataResetServiceOptions {
  stopWriters(): void;
  resumeWriters(): void;
  disposeRuntime(): Promise<void>;
  cleanupCandidates(): Promise<CandidateCleanupResult>;
  clearStores(): number;
  assertStoresCleared(): void;
  detachPersistence(): void;
  scheduleRestart(exitCode: number): void;
}

/** 清空测试运行态的应用用例；它协调端口，不读取数据库实现或人物 internal。 */
export class TestDataResetService {
  #inProgress = false;

  constructor(private readonly options: TestDataResetServiceOptions) {}

  async clear(): Promise<TestDataResetResult> {
    if (this.#inProgress) throw new Error("测试数据正在清空，请等待应用重启。");
    this.#inProgress = true;
    let runtimeDisposed = false;
    try {
      this.options.stopWriters();
      await this.options.disposeRuntime();
      runtimeDisposed = true;
      const candidateCleanup = await this.options.cleanupCandidates()
        .catch((error) => ({ branchCount: 0, worktreeCount: 0, failures: [error instanceof Error ? error.message : String(error)] }));
      const clearedRecordCount = this.options.clearStores();
      this.options.assertStoresCleared();
      this.options.detachPersistence();
      const result: TestDataResetResult = {
        cleared: true,
        clearedRecordCount,
        clearedCandidateBranchCount: candidateCleanup.branchCount,
        clearedCandidateWorktreeCount: candidateCleanup.worktreeCount,
        candidateCleanupWarnings: candidateCleanup.failures,
        restartScheduled: true,
      };
      this.options.scheduleRestart(0);
      return result;
    } catch (error) {
      this.#inProgress = false;
      if (runtimeDisposed) this.options.scheduleRestart(1);
      else this.options.resumeWriters();
      throw error;
    }
  }
}
