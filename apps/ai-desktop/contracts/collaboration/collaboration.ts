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
/** Coordinator 可写入的协作流程事件名称；新增流程必须先在这里登记，再由时间线投影决定可见语义。 */
export type CollaborationFlowEventType =
  | "task.submitted"
  | "task.legacy_imported"
  | "executor.assigned"
  | "executor.reassigned"
  | "technical_analysis.ready"
  | "execution.started"
  | `worker.phase.${Exclude<CollaborationWorkerPhase, null>}`
  | "task.code_verified"
  | "task.blocked"
  | "task.cancelled"
  | "task.interrupted"
  | "task.recovery_requested"
  | "execution.repair_started"
  | "execution.repair_completed"
  | "execution.repair_waiting"
  | "integration.local_changes_transferred"
  | "integration.batch_frozen"
  | "integration.local_change_ownership_blocked"
  | "integration.merge_conflict"
  | "integration.candidate_preparation_failed"
  | "integration.conflict_correction_requested"
  | "evolution.task_collected"
  | "unified_test.started"
  | "unified_test.passed"
  | "unified_test.failed"
  | "unified_test.retry_requested"
  | "unified_test.repair_started"
  | "unified_test.repair_completed"
  | "unified_test.repair_failed"
  | "release.restart_healthy";
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
  type: CollaborationFlowEventType;
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

export type CollaborationIntegrationFailureKind = "merge-conflict" | "local-change-ownership" | "candidate-branch-conflict" | "verification";

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
  /** 主进程在分片入库时确定的不可变时间线节点；为空表示该分片不属于专题时间线。 */
  timelineNodeId?: string | null;
  event: CodexStreamEvent;
}

/** 任务协作群统一时间线节点；主进程按真实业务事实生成，Renderer 不再猜测人物和顺序。 */
export interface CollaborationTimelineNode {
  nodeId: string;
  taskId: string | null;
  kind: "approval-application" | "approval-decision" | "distribution" | "analysis" | "execution" | "verification" | "repair" | "result";
  actor: CollaborationParticipantSnapshot;
  recipients: CollaborationParticipantSnapshot[];
  status: "completed" | "current" | "waiting" | "failed";
  action: string;
  summary: string;
  content: string;
  detail: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number;
  automaticOpen: boolean;
  manualApprovalProposalId: string | null;
}

/** 一个专题对应一张可折叠任务卡；并行人物仍按分配顺序保存在同一纵向节点列表中。 */
export interface CollaborationTimelineGroup {
  groupId: string;
  topicId: string | null;
  proposalId: string | null;
  title: string;
  status: "waiting-approval" | "running" | "verifying" | "blocked" | "completed" | "cancelled";
  summary: string;
  nodes: CollaborationTimelineNode[];
  executingCount: number;
  verifyingCount: number;
  waitingCount: number;
  completedCount: number;
  startedAt: string;
  updatedAt: string;
  durationMs: number;
  nextStep: string;
}

/** 主进程一次返回完整、稳定、有序的任务协作群投影。 */
export interface CollaborationTimelineSnapshot {
  version: 1;
  groups: CollaborationTimelineGroup[];
  updatedAt: string;
}
