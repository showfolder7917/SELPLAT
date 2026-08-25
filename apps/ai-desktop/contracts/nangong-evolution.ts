import type { Locale } from "./base.js";
import type { WorkspaceState } from "./workspace.js";

export type EvolutionProposalType = "规则演进" | "规则优化" | "规则重构" | "目录演进" | "代码修正" | "Bug修复";
export type EvolutionProposalOrigin = "nangong" | "linghu";
export type EvolutionTopicStatus = "registered" | "investigating" | "pending-approval" | "supplement-required" | "rejected" | "approved" | "executing" | "verifying" | "completed" | "blocked";
export type EvolutionApprovalDecision = "approved" | "rejected" | "supplement-required";
export type EvolutionApprovalSource = "manual-user" | "automatic-han-li";
export type EvolutionFeedbackTarget = "proposal-content" | "submitter-capability";
export type EvolutionProposalPurpose = "work-proposal" | "self-capability-upgrade";

export interface EvolutionTopic {
  topicId: string;
  title: string;
  goal: string;
  scope: string[];
  exclusions: string[];
  evidence: string[];
  acceptanceCriteria: string[];
  workspaceState: WorkspaceState;
  locale: Locale;
  origin: EvolutionProposalOrigin;
  sourceConversationMessageIds: string[];
  continuationOfTopicId: string | null;
  nextTopicId: string | null;
  status: EvolutionTopicStatus;
  /** 课题保存修订号用于拒绝基于过期界面的覆盖写入。 */
  topicRevision: number;
  currentProposalVersion: number;
  recoveryPoint: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvolutionApproval {
  approvalId: string;
  proposalId: string;
  decision: EvolutionApprovalDecision;
  source: EvolutionApprovalSource;
  approverMemberId: "han-li" | "user";
  approverDisplayName: "韩立" | "用户";
  advice: string;
  feedbackTarget: EvolutionFeedbackTarget;
  capabilityScope: string | null;
  referencedApprovalIds: string[];
  preferenceSnapshotVersion: number;
  createdAt: string;
}

export interface EvolutionProposal {
  proposalId: string;
  topicId: string;
  version: number;
  title: string;
  type: EvolutionProposalType;
  origin: EvolutionProposalOrigin;
  submitterMemberId: string;
  submitterDisplayName: string;
  purpose: EvolutionProposalPurpose;
  targetMemberId: string | null;
  targetMemberDisplayName: string | null;
  capabilityScope: string | null;
  supersedesProposalId: string | null;
  revisionFeedbackApprovalId: string | null;
  content: string;
  evidence: string[];
  impactScope: string[];
  exclusions: string[];
  risks: string[];
  rollbackPlan: string;
  acceptanceCriteria: string[];
  distributionUnits: Array<{ title: string; scope: string; acceptanceCriteria: string[] }>;
  status: Exclude<EvolutionTopicStatus, "registered" | "investigating">;
  approvals: EvolutionApproval[];
  distributedTaskIds: string[];
  resultSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NangongEvolutionState {
  version: 5;
  automaticEvolutionEnabled: boolean;
  automaticNangongApprovalEnabled: boolean;
  automaticLinghuApprovalEnabled: boolean;
  automaticExecutionEnabled: boolean;
  preferenceSnapshotVersion: number;
  activeTopicId: string | null;
  topics: EvolutionTopic[];
  proposals: EvolutionProposal[];
  conversation: NangongConversation;
  updatedAt: string;
}

export interface NangongConversationMessage {
  messageId: string;
  role: "user" | "nangong";
  content: string;
  inferredIntent?: string;
  attachmentIds?: string[];
  createdAt: string;
}

export interface NangongConversation {
  conversationId: string;
  messages: NangongConversationMessage[];
  updatedAt: string;
}

export interface CreateEvolutionTopicRequest {
  title: string;
  goal: string;
  scope: string[];
  exclusions?: string[];
  evidence: string[];
  acceptanceCriteria: string[];
  workspaceState: WorkspaceState;
  locale: Locale;
}

export interface SendNangongConversationMessageRequest {
  message: string;
  attachmentIds?: string[];
  workspaceState: WorkspaceState;
  locale: Locale;
}

export interface ConvertNangongConversationToTopicRequest {
  /** 只有用户在界面中明确确认后，当前对话材料才允许冻结为正式课题。 */
  confirmedByUser: true;
  title: string;
  goal: string;
  scope: string[];
  exclusions?: string[];
  evidence: string[];
  acceptanceCriteria: string[];
  workspaceState: WorkspaceState;
  locale: Locale;
}

/** 南宫婉仅从当前会话归纳、尚未保存的课题表单初值。 */
export interface NangongTopicDraft {
  title: string;
  goal: string;
  scope: string[];
  evidence: string[];
  acceptanceCriteria: string[];
}

export interface GenerateNangongTopicDraftRequest {
  workspaceState: WorkspaceState;
  locale: Locale;
}

/** 只允许在首个提案提交前更新已保存课题，并要求携带读取时的修订号。 */
export interface UpdateEvolutionTopicRequest {
  expectedTopicRevision: number;
  title: string;
  goal: string;
  scope: string[];
  exclusions?: string[];
  evidence: string[];
  acceptanceCriteria: string[];
}

export interface CreateLinghuRepairProposalRequest {
  title: string;
  content: string;
  evidence: string[];
  impactScope: string[];
  risks: string[];
  rollbackPlan: string;
  acceptanceCriteria: string[];
  workspaceState: WorkspaceState;
  locale: Locale;
}

export interface CreateEvolutionProposalRequest {
  type: EvolutionProposalType;
  content: string;
  risks: string[];
  rollbackPlan: string;
  distributionUnits?: Array<{ title: string; scope: string; acceptanceCriteria: string[] }>;
}

export interface DecideEvolutionProposalRequest {
  decision: EvolutionApprovalDecision;
  advice?: string;
  feedbackTarget?: EvolutionFeedbackTarget;
  capabilityScope?: string;
}

/** 原提交人依据人工意见补充调查，并以不可覆盖的新版本重新提交。 */
export interface ReviseEvolutionProposalRequest {
  submitterMemberId: string;
  content: string;
  evidence: string[];
  impactScope: string[];
  risks: string[];
  rollbackPlan: string;
  acceptanceCriteria: string[];
}

export interface NangongEvolutionStateEvent {
  state: NangongEvolutionState;
  reason: string;
  topicId: string | null;
  proposalId: string | null;
}
