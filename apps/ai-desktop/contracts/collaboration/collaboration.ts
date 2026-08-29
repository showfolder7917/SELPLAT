/**
 * 多成员协作任务协议，描述成员、计划、执行、复核、工作树和集成批次的完整状态链。
 *
 * 生产者：主进程 CollaborationCoordinator 及其领域存储。
 * 消费者：Renderer 协作工作台、事件中心和版本集成流程。
 * 数据方向：renderer <-> preload <-> main，执行进度由 main 持续推送。
 * 本文件不启动 Agent、不操作 Git 工作树，也不执行合并。
 */
import type { Locale } from "../foundation/base.js";
import type { CodexStreamEvent } from "../codex/codex-stream.js";
import type { WorkspaceState } from "../desktop/workspace.js";

export type DesktopOperatingMode = "single-conversation" | "collaboration";
export type CollaborationMemberKind = "conversation-owner" | "worker";
export type CollaborationMemberRole = "conversation" | "executor" | null;
export type CollaborationMemberState = "idle" | "conversation" | "assigned" | "working" | "retiring" | "recovering" | "draining" | "offline";
export type CollaborationWorkerPhase = "analyzing" | "planning" | "implementing" | "verifying" | "finalizing" | "ready" | "blocked" | "failed" | null;
export type CollaborationMergeStrategy = "INDEPENDENT" | "ATOMIC_GROUP" | "DEPENDENCY_CHAIN";
export type CollaborationPlanStatus = "ready-for-execution";
export type CollaborationExecutionStatus = "assigned" | "analyzing" | "executing" | "code-verified" | "transferred" | "blocked" | "cancelled";
export type CollaborationResultOutcome = "pending-integration" | "succeeded" | "incomplete" | "cancelled";
export type CollaborationAutomationSource = "linghu-safeguard";
export type CollaborationTaskState =
  | "queued-executor"
  | "preparing-worktree"
  | "analyzing"
  | "executing"
  | "repairing-execution"
  | "returned-to-nangong"
  | "ready-for-integration"
  | "queued-integration"
  | "integrating"
  | "unified-testing"
  | "awaiting-restart"
  | "test-failed"
  | "integrated"
  | "blocked"
  | "recovering"
  | "cancelled";

export interface CollaborationMember {
  memberId: string;
  displayName: string;
  kind: CollaborationMemberKind;
  protected: boolean;
  enabled: boolean;
  state: CollaborationMemberState;
  role: CollaborationMemberRole;
  phase: CollaborationWorkerPhase;
  generation: number;
  currentTaskId: string | null;
  blockingReason: string | null;
  lastHeartbeatAt: string | null;
  lastProtocolProgressAt: string | null;
  lastAssignedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CollaborationParticipantSnapshot {
  memberId: string;
  displayName: string;
}

export interface CollaborationTaskSnapshot {
  title: string;
  problemStatement: string;
  confirmedIntent: string;
  constraints: string[];
  acceptanceCriteria: string[];
  sourceMessageIds: number[];
  attachmentIds: string[];
  workspaceState: WorkspaceState;
  locale: Locale;
  contentHash: string;
}

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

export interface CollaborationFlowEvent {
  eventId: string;
  type: string;
  stage: "task" | "analysis" | "execution" | "integration" | "recovery";
  status: "started" | "completed" | "failed" | "waiting" | "cancelled";
  actor: CollaborationParticipantSnapshot | null;
  summary: string;
  occurredAt: string;
  error: boolean;
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

export type CollaborationIntegrationFailureKind = "merge-conflict" | "local-change-ownership" | "verification";

export interface CollaborationIntegrationFailure {
  kind: CollaborationIntegrationFailureKind;
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

export interface CollaborationState {
  version: 1;
  mode: DesktopOperatingMode;
  selectedMemberId: string;
  members: CollaborationMember[];
  tasks: CollaborationTask[];
  integrationBatches: CollaborationIntegrationBatch[];
  nextIntegrationGeneration: number;
  updatedAt: string;
}

export interface CreateCollaborationMemberRequest {
  displayName: string;
}

export interface UpdateCollaborationMemberRequest {
  displayName?: string;
  enabled?: boolean;
}

export interface SubmitCollaborationTaskRequest {
  title: string;
  problemStatement: string;
  confirmedIntent: string;
  constraints?: string[];
  acceptanceCriteria?: string[];
  sourceMessageIds?: number[];
  attachmentIds?: string[];
  workspaceState: WorkspaceState;
  locale: Locale;
  mergeStrategy?: CollaborationMergeStrategy;
  atomicGroupId?: string;
  dependencyTaskIds?: string[];
  initiatorMemberId?: string;
  preferredExecutorMemberId?: string;
  automationSource?: CollaborationAutomationSource;
  evolutionProposalId?: string;
  evolutionRoundId?: string;
  selfUpgradeTargetMemberId?: string;
  selfUpgradeCapabilityScope?: string;
  sourceEvolutionApprovalId?: string;
}

export interface CollaborationStateEvent {
  state: CollaborationState;
  reason: string;
  taskIds: string[];
}

export interface CollaborationStreamEnvelope {
  taskId: string;
  memberId: string;
  event: CodexStreamEvent;
}
