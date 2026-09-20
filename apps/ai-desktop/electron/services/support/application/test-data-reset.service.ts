import type { TestDataResetCategoryOutDto, TestDataResetResultOutDto } from "../../../../contracts/services/support/application/index.js";

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
  clearStores(): TestDataResetCategoryOutDto[];
  assertStoresCleared(): void;
  detachPersistence(): void;
  scheduleRestart(exitCode: number): void;
}

/** 清空测试运行态的应用用例；它协调端口，不读取数据库实现或人物 internal。 */
export class TestDataResetService {
  #inProgress = false;
  #pendingRestart: TestDataResetResultOutDto | null = null;

  constructor(private readonly options: TestDataResetServiceOptions) {}

  async clear(): Promise<TestDataResetResultOutDto> {
    if (this.#inProgress || this.#pendingRestart) throw new Error("测试数据已经清空，请先确认重启应用。");
    this.#inProgress = true;
    let runtimeDisposed = false;
    try {
      this.options.stopWriters();
      await this.options.disposeRuntime();
      runtimeDisposed = true;
      const candidateCleanup = await this.options.cleanupCandidates()
        .catch((error) => ({ branchCount: 0, worktreeCount: 0, failures: [error instanceof Error ? error.message : String(error)] }));
      const clearedCategories = this.options.clearStores();
      this.options.assertStoresCleared();
      this.options.detachPersistence();
      const result: TestDataResetResultOutDto = {
        cleared: true,
        clearedRecordCount: clearedCategories.reduce((total, category) => total + category.clearedRecordCount, 0),
        clearedCategories,
        clearedCandidateBranchCount: candidateCleanup.branchCount,
        clearedCandidateWorktreeCount: candidateCleanup.worktreeCount,
        candidateCleanupWarnings: candidateCleanup.failures,
        restartRequired: true,
      };
      this.#pendingRestart = result;
      return result;
    } catch (error) {
      this.#inProgress = false;
      if (runtimeDisposed) this.options.scheduleRestart(1);
      else this.options.resumeWriters();
      throw error;
    }
  }

  /** 仅在页面已展示成功清理结果且用户再次确认后，沿既有受控路径重启。 */
  confirmRestart(): void {
    if (!this.#pendingRestart) throw new Error("尚未完成可重启的测试数据清理。");
    this.options.scheduleRestart(0);
  }
}
