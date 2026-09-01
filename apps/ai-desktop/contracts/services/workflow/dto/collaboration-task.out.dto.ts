import type { CollaborationMergeStrategyValue, CollaborationPlanStatusValue, CollaborationExecutionStatusValue, CollaborationResultOutcomeValue, CollaborationAutomationSourceValue, CollaborationTaskStateValue, CollaborationIntegrationFailureKindValue } from "../value/collaboration-task.value.js";
/**
 * Workflow 协作任务、执行记录与集成批次输出协议。
 * 生产者：Workflow 协作存储和版本集成服务；消费者：Renderer、令狐和发布能力。
 * 数据方向：Workflow -> 协作消费者。
 * 本文件只表达已发生事实，不执行工作树、合并或统一测试。
 */
import type { CollaborationFlowEventOutDto } from "./collaboration-flow-event.out.dto.js";
import type { CollaborationParticipantSnapshotOutDto, CollaborationTaskSnapshotOutDto } from "./collaboration-member.out.dto.js";
import type { CollaborationWorkerPhaseValue } from "../value/collaboration-member.value.js";


export interface CollaborationRequirementPlanOutDto {
  version: number;
  ownerMemberId: string;
  ownerDisplayName: string;
  status: CollaborationPlanStatusValue;
  text: string;
  contentHash: string;
  createdAt: string;
}

export interface CollaborationExecutionRecordOutDto {
  assignmentId: string;
  executor: CollaborationParticipantSnapshotOutDto;
  workerGeneration: number;
  status: CollaborationExecutionStatusValue;
  assignedAt: string;
  executionStartedAt: string | null;
  completedAt: string | null;
  transferFromAssignmentId: string | null;
  handoffType: "initial" | "resume" | "transfer";
  result: string | null;
  blockingReason: string | null;
  changedFiles?: string[];
}

export interface CollaborationRepairDiagnosisOutDto {
  diagnosedAt: string;
  diagnosedBy: CollaborationParticipantSnapshotOutDto;
  failureStage: string;
  failureSummary: string;
  technicalEvidence: string[];
  repairInstruction: string;
  originalExecutor: CollaborationParticipantSnapshotOutDto | null;
}

export interface CollaborationResultSummaryOutDto {
  outcome: CollaborationResultOutcomeValue;
  finalResult: string;
  originalProblem: string;
  solvedProblem: string;
  changes: string;
  remaining: string;
  success: boolean;
  generatedAt: string;
}

export interface CollaborationVersionWorkspaceOutDto {
  workspaceId: string;
  rootPath: string;
  branchName: string;
  baseSha: string;
  resultSha: string | null;
  createdAt: string;
  retiredAt: string | null;
}


export interface CollaborationIntegrationFailureOutDto {
  kind: CollaborationIntegrationFailureKindValue;
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

export interface CollaborationTaskOutDto {
  taskId: string;
  taskRevision: number;
  assignmentId: string | null;
  workerGeneration: number;
  state: CollaborationTaskStateValue;
  phase: CollaborationWorkerPhaseValue;
  executorMemberId: string | null;
  preferredExecutorMemberId?: string | null;
  originalExecutor?: CollaborationParticipantSnapshotOutDto | null;
  currentHandler?: CollaborationParticipantSnapshotOutDto | null;
  repairKind?: "execution" | null;
  repairFailureReason?: string | null;
  repairDiagnosis?: CollaborationRepairDiagnosisOutDto | null;
  repairResult?: string | null;
  unifiedTest?: {
    status: "pending" | "running" | "passed" | "failed";
    owner: CollaborationParticipantSnapshotOutDto;
    failureReason: string | null;
    startedAt: string | null;
    completedAt: string | null;
  } | null;
  currentPlanVersion: number;
  infrastructureFailureCount: number;
  mergeStrategy: CollaborationMergeStrategyValue;
  atomicGroupId: string | null;
  dependencyTaskIds: string[];
  integrationGeneration: number | null;
  initiator: CollaborationParticipantSnapshotOutDto | null;
  automationSource: CollaborationAutomationSourceValue | null;
  evolutionProposalId: string | null;
  evolutionRoundId: string | null;
  returnedToNangongAt: string | null;
  selfUpgradeTargetMemberId: string | null;
  selfUpgradeCapabilityScope: string | null;
  sourceEvolutionApprovalId: string | null;
  historyCompleteness: "complete" | "legacy-partial";
  snapshot: CollaborationTaskSnapshotOutDto;
  plans: CollaborationRequirementPlanOutDto[];
  executionRecords: CollaborationExecutionRecordOutDto[];
  flowEvents: CollaborationFlowEventOutDto[];
  versionWorkspace: CollaborationVersionWorkspaceOutDto | null;
  integrationFailure?: CollaborationIntegrationFailureOutDto | null;
  finalResult: string | null;
  resultSummary: CollaborationResultSummaryOutDto | null;
  blockingReason: string | null;
  recoveryTargetState: CollaborationTaskStateValue | null;
  startedAt: string;
  codeVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface CollaborationIntegrationBatchOutDto {
  generation: number;
  taskIds: string[];
  state: "frozen" | "integrating" | "verified" | "completed" | "failed";
  createdAt: string;
  completedAt: string | null;
  integrationSha: string | null;
  failureReason: string | null;
  failureKind?: CollaborationIntegrationFailureKindValue | null;
  conflictFiles?: string[];
}
