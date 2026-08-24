export type IntegrationReleaseEventType = "queued" | "acquired" | "contended" | "released" | "timeout" | "failed" | "stale-recovered";

export interface IntegrationReleaseRequest {
  releaseBatchId: string;
  version: string;
  generation: number;
  taskIds: string[];
  initiatorMemberId: string;
}

export interface IntegrationReleaseHolder extends IntegrationReleaseRequest {
  leaseId: string;
  processId: number;
  queuedAt: string;
  acquiredAt: string;
  heartbeatAt: string;
}

export interface ReleaseBatchTaskSnapshot {
  taskId: string;
  title: string;
  branchName: string | null;
  resultSha: string | null;
}

export interface ReleaseBatchDocument {
  releaseBatchId: string;
  version: string;
  generation: number;
  state: "frozen" | "candidate-ready" | "testing" | "verified" | "integrated" | "published" | "failed";
  initiatorMemberId: string;
  candidateBranch: string | null;
  candidateSha: string | null;
  localMergeSha: string | null;
  executable: string | null;
  tasks: ReleaseBatchTaskSnapshot[];
  startedAt: string;
  completedAt: string | null;
  failureReason: string | null;
}
