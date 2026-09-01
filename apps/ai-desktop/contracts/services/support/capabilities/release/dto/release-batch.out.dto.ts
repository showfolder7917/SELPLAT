/** 发布批次及任务的持久化只读快照。 */
export interface ReleaseBatchTaskSnapshotOutDto {
  taskId: string;
  title: string;
  branchName: string | null;
  resultSha: string | null;
}

export interface ReleaseBatchDocumentOutDto {
  releaseBatchId: string;
  version: string;
  generation: number;
  state: "frozen" | "candidate-ready" | "testing" | "verified" | "integrated" | "published" | "failed";
  initiatorMemberId: string;
  candidateBranch: string | null;
  candidateSha: string | null;
  localMergeSha: string | null;
  executable: string | null;
  tasks: ReleaseBatchTaskSnapshotOutDto[];
  startedAt: string;
  completedAt: string | null;
  failureReason: string | null;
}
