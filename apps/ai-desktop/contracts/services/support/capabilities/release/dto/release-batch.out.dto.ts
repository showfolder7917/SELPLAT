/** 发布批次及任务的持久化只读快照。 */
export interface ReleaseBatchTaskSnapshotOutDto {
  taskId: string;
  title: string;
  branchName: string | null;
  resultSha: string | null;
}

/** 统一测试预检读取的候选事实；失败归档据此证明门禁实际检查了什么。 */
export interface ReleaseBatchCandidateEvidenceOutDto {
  candidateProjectRoot: string;
  candidateSha: string | null;
  loadedRuntimeSha: string | null;
  sourceBlobs: Array<{ source: "state" | "runtime" | "projection"; relativePath: string; sha256: string }>;
  acceptancePlanChecks: Array<{ capability: string; passed: boolean }>;
  readError: string | null;
}

/** 候选改动预检运行器时的运行包准备与恢复事实。 */
export interface ReleaseBatchRuntimeActivationOutDto {
  state: "preparing" | "relaunch-scheduled" | "resumed" | "failed";
  candidateRootPath: string;
  candidateBaseSha: string;
  candidateSha: string;
  executable: string | null;
  detail: string | null;
  updatedAt: string;
}

export interface ReleaseBatchDocumentOutDto {
  releaseBatchId: string;
  version: string;
  generation: number;
  state: "frozen" | "candidate-ready" | "activating" | "testing" | "verified" | "integrated" | "published" | "failed";
  initiatorMemberId: string;
  candidateBranch: string | null;
  candidateSha: string | null;
  candidateEvidence: ReleaseBatchCandidateEvidenceOutDto | null;
  runtimeActivation: ReleaseBatchRuntimeActivationOutDto | null;
  localMergeSha: string | null;
  executable: string | null;
  tasks: ReleaseBatchTaskSnapshotOutDto[];
  startedAt: string;
  completedAt: string | null;
  failureReason: string | null;
}
