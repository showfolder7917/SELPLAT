/**
 * 集成发布资源协议，描述一个版本批次对独占发布资源的申请、持有和终态记录。
 *
 * 生产者：主进程 IntegrationReleaseCoordinatorFacade。
 * 消费者：版本集成流水线、协作状态视图和审计记录。
 * 数据方向：主进程内部协调，必要状态通过 preload 返回 Renderer。
 * 本文件不加锁、不创建进程，也不执行版本发布。
 */
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
