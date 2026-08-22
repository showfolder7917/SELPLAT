import type { Locale, WorkspaceState } from "./desktop.js";
import type { CodexStreamEvent } from "./desktop.js";

export type DesktopOperatingMode = "single-conversation" | "collaboration";
export type CollaborationMemberKind = "conversation-owner" | "worker";
export type CollaborationMemberRole = "conversation" | "executor" | "reviewer" | null;
export type CollaborationMemberState = "idle" | "conversation" | "assigned" | "working" | "waiting-review" | "reviewing" | "retiring" | "recovering" | "draining" | "offline";
export type CollaborationWorkerPhase = "analyzing" | "planning" | "implementing" | "verifying" | "finalizing" | "ready" | "blocked" | "failed" | null;
export type CollaborationMergeStrategy = "INDEPENDENT" | "ATOMIC_GROUP" | "DEPENDENCY_CHAIN";
export type CollaborationTaskState =
  | "queued-executor"
  | "preparing-worktree"
  | "analyzing"
  | "queued-reviewer"
  | "reviewing"
  | "optimizing"
  | "approved"
  | "forced-after-review-limit"
  | "executing"
  | "ready-for-integration"
  | "queued-integration"
  | "integrating"
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
  text: string;
  contentHash: string;
  createdAt: string;
}

export interface CollaborationReview {
  reviewId: string;
  planVersion: number;
  reviewerMemberId: string;
  reviewerGeneration: number;
  decision: "passed" | "rejected";
  feedback: string;
  createdAt: string;
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

export interface CollaborationTask {
  taskId: string;
  taskRevision: number;
  assignmentId: string | null;
  workerGeneration: number;
  state: CollaborationTaskState;
  phase: CollaborationWorkerPhase;
  executorMemberId: string | null;
  currentReviewerMemberId: string | null;
  currentPlanVersion: number;
  explicitRejectionCount: number;
  infrastructureFailureCount: number;
  mergeStrategy: CollaborationMergeStrategy;
  atomicGroupId: string | null;
  dependencyTaskIds: string[];
  integrationGeneration: number | null;
  snapshot: CollaborationTaskSnapshot;
  plans: CollaborationRequirementPlan[];
  reviews: CollaborationReview[];
  versionWorkspace: CollaborationVersionWorkspace | null;
  finalResult: string | null;
  blockingReason: string | null;
  recoveryTargetState: CollaborationTaskState | null;
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
}

export interface CollaborationStateEvent {
  state: CollaborationState;
  reason: string;
}

export interface CollaborationStreamEnvelope {
  taskId: string;
  memberId: string;
  event: CodexStreamEvent;
}
