/** 页面可展示的测试运行数据清理分类；不暴露数据库路径、表名或删除语句。 */
export interface TestDataResetCategoryOutDto {
  category: "collaboration" | "evolution" | "linghu" | "workflow";
  clearedRecordCount: number;
}

/** 一键清空完成后的待确认重启回执；不暴露数据库路径、表名或删除语句。 */
export interface TestDataResetResultOutDto {
  cleared: true;
  clearedRecordCount: number;
  clearedCategories: TestDataResetCategoryOutDto[];
  clearedCandidateBranchCount: number;
  clearedCandidateWorktreeCount: number;
  candidateCleanupWarnings: string[];
  restartRequired: true;
}
