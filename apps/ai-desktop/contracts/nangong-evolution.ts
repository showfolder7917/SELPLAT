import type { Locale } from "./base.js";
import type { WorkspaceState } from "./workspace.js";

export type EvolutionProposalType = "规则演进" | "规则优化" | "规则重构" | "目录演进" | "代码修正" | "Bug修复";
export type EvolutionProposalOrigin = "nangong" | "linghu";
export type EvolutionTopicStatus = "registered" | "investigating" | "pending-approval" | "supplement-required" | "rejected" | "approved" | "executing" | "verifying" | "completed" | "blocked";
export type EvolutionApprovalDecision = "approved" | "rejected" | "supplement-required";
export type EvolutionApprovalSource = "manual-user" | "automatic-han-li";

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
  status: EvolutionTopicStatus;
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
  submitterMemberId: "nangong-wan" | "linghu-ancestor";
  submitterDisplayName: "南宫婉" | "令狐老祖";
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
  version: 2;
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
  title: string;
  goal: string;
  scope: string[];
  exclusions?: string[];
  acceptanceCriteria: string[];
  workspaceState: WorkspaceState;
  locale: Locale;
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
}

export interface NangongEvolutionStateEvent {
  state: NangongEvolutionState;
  reason: string;
  topicId: string | null;
  proposalId: string | null;
}
