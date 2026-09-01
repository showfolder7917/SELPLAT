/** 一键清空完成后的受控重启回执；不暴露数据库路径、表名或删除语句。 */
export interface TestDataResetResultOutDto {
  cleared: true;
  clearedRecordCount: number;
  clearedCandidateBranchCount: number;
  clearedCandidateWorktreeCount: number;
  candidateCleanupWarnings: string[];
  restartScheduled: true;
}
