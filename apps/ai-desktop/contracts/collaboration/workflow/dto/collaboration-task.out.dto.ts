/**
 * Workflow 协作任务、执行记录与集成批次输出协议。
 * 生产者：Workflow 协作存储和版本集成服务；消费者：Renderer、令狐和发布能力。
 * 数据方向：Workflow -> 协作消费者。
 * 本文件只表达已发生事实，不执行工作树、合并或统一测试。
 */
import type { CollaborationFlowEvent } from "./collaboration-flow-event.out.dto.js";
import type { CollaborationParticipantSnapshot, CollaborationTaskSnapshot, CollaborationWorkerPhase } from "./collaboration-member.out.dto.js";

export type CollaborationMergeStrategy = "INDEPENDENT" | "ATOMIC_GROUP" | "DEPENDENCY_CHAIN";
export type CollaborationPlanStatus = "ready-for-execution";
export type CollaborationExecutionStatus = "assigned" | "analyzing" | "executing" | "code-verified" | "transferred" | "blocked" | "cancelled";
export type CollaborationResultOutcome = "pending-integration" | "succeeded" | "incomplete" | "cancelled";
export type CollaborationAutomationSource = "linghu-safeguard";
export type CollaborationTaskState = "queued-executor" | "preparing-worktree" | "analyzing" | "executing" | "repairing-execution" | "returned-to-nangong" | "ready-for-integration" | "queued-integration" | "integrating" | "unified-testing" | "awaiting-restart" | "test-failed" | "integrated" | "blocked" | "recovering" | "cancelled";

export interface CollaborationRequirementPlan {
  version: number;
  ownerMemberId: string;
  ownerDisplayName: string;
  status: CollaborationPlanStatus;
  text: string;
  contentHash: string;
  createdAt: string;
}

export interface CollaborationExecutionRecord {
  assignmentId: string;
  executor: CollaborationParticipantSnapshot;
  workerGeneration: number;
  status: CollaborationExecutionStatus;
  assignedAt: string;
  executionStartedAt: string | null;
  completedAt: string | null;
  transferFromAssignmentId: string | null;
  handoffType: "initial" | "resume" | "transfer";
  result: string | null;
  blockingReason: string | null;
  changedFiles?: string[];
}

export interface CollaborationRepairDiagnosis {
  diagnosedAt: string;
  diagnosedBy: CollaborationParticipantSnapshot;
  failureStage: string;
  failureSummary: string;
  technicalEvidence: string[];
  repairInstruction: string;
  originalExecutor: CollaborationParticipantSnapshot | null;
}

export interface CollaborationResultSummary {
  outcome: CollaborationResultOutcome;
  finalResult: string;
  originalProblem: string;
  solvedProblem: string;
  changes: string;
  remaining: string;
  success: boolean;
  generatedAt: string;
}

export interface CollaborationVersionWorkspace {
  workspaceId: string;
  rootPath: string;
  branchName: string;
  baseSha: string;
  resultSha: string | null;
  createdAt: string;
  retiredAt: string | null;
}

export type CollaborationIntegrationFailureKind = "merge-conflict" | "local-change-ownership" | "candidate-branch-conflict" | "verification" | "infrastructure";

export interface CollaborationIntegrationFailure {
  kind: CollaborationIntegrationFailureKind;
  phase?: "preparation" | "verification" | "release";
  summary?: string;
  impact?: string;
  recoveryAction?: string;
  detail: string;
  conflictFiles: string[];
  baseSha: string | null;
  resultSha: string | null;
  generation: number | null;
  occurredAt: string;
}

export interface CollaborationTask {
  taskId: string;
  taskRevision: number;
  assignmentId: string | null;
  workerGeneration: number;
  state: CollaborationTaskState;
  phase: CollaborationWorkerPhase;
  executorMemberId: string | null;
  preferredExecutorMemberId?: string | null;
  originalExecutor?: CollaborationParticipantSnapshot | null;
  currentHandler?: CollaborationParticipantSnapshot | null;
  repairKind?: "execution" | null;
  repairFailureReason?: string | null;
  repairDiagnosis?: CollaborationRepairDiagnosis | null;
  repairResult?: string | null;
  unifiedTest?: {
    status: "pending" | "running" | "passed" | "failed";
    owner: CollaborationParticipantSnapshot;
    failureReason: string | null;
    startedAt: string | null;
    completedAt: string | null;
  } | null;
  currentPlanVersion: number;
  infrastructureFailureCount: number;
  mergeStrategy: CollaborationMergeStrategy;
  atomicGroupId: string | null;
  dependencyTaskIds: string[];
  integrationGeneration: number | null;
  initiator: CollaborationParticipantSnapshot | null;
  automationSource: CollaborationAutomationSource | null;
  evolutionProposalId: string | null;
  evolutionRoundId: string | null;
  returnedToNangongAt: string | null;
  selfUpgradeTargetMemberId: string | null;
  selfUpgradeCapabilityScope: string | null;
  sourceEvolutionApprovalId: string | null;
  historyCompleteness: "complete" | "legacy-partial";
  snapshot: CollaborationTaskSnapshot;
  plans: CollaborationRequirementPlan[];
  executionRecords: CollaborationExecutionRecord[];
  flowEvents: CollaborationFlowEvent[];
  versionWorkspace: CollaborationVersionWorkspace | null;
  integrationFailure?: CollaborationIntegrationFailure | null;
  finalResult: string | null;
  resultSummary: CollaborationResultSummary | null;
  blockingReason: string | null;
  recoveryTargetState: CollaborationTaskState | null;
  startedAt: string;
  codeVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface CollaborationIntegrationBatch {
  generation: number;
  taskIds: string[];
  state: "frozen" | "integrating" | "verified" | "completed" | "failed";
  createdAt: string;
  completedAt: string | null;
  integrationSha: string | null;
  failureReason: string | null;
  failureKind?: CollaborationIntegrationFailureKind | null;
  conflictFiles?: string[];
}
