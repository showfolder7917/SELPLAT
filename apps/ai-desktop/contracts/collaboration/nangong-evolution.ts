/**
 * 南宫演进协议，描述议题研讨、提案、审批、分发、执行、验收和归档证据。
 *
 * 生产者：主进程 NangongEvolutionFacade、Store 和协作记忆服务。
 * 消费者：Renderer 演进工作台、韩立审批流程和灵狐修复入口。
 * 数据方向：renderer <-> preload <-> main，自动化状态由 main 推送。
 * 本文件只描述状态与命令，不直接分配 Agent、修改规则或操作版本库。
 */
import type { Locale } from "../foundation/base.js";
import type { WorkspaceState } from "../desktop/workspace.js";

export type EvolutionProposalType = "规则演进" | "规则优化" | "规则重构" | "目录演进" | "代码修正" | "Bug修复";
export type EvolutionProposalOrigin = "nangong" | "linghu";
export type EvolutionTopicStatus = "registered" | "investigating" | "pending-approval" | "supplement-required" | "rejected" | "approved" | "executing" | "verifying" | "pending-acceptance" | "completed" | "blocked";
export type EvolutionApprovalDecision = "approved" | "rejected" | "supplement-required";
export type EvolutionApprovalSource = "manual-user" | "automatic-han-li";
export type EvolutionApprovalStage = "direction" | "result";
export type EvolutionFeedbackTarget = "proposal-content" | "submitter-capability";
export type EvolutionProposalPurpose = "work-proposal" | "self-capability-upgrade";
export type EvolutionArchiveActor = "han-li" | "nangong-wan" | "codex" | "linghu-ancestor" | "system" | "user";
export type EvolutionArchiveCategory = "source" | "deliberation" | "topic" | "proposal" | "approval" | "distribution" | "execution" | "test" | "release" | "acceptance" | "recovery";
export type HanLiDeliberationStatus = "questioning" | "ready-to-establish" | "established" | "blocked";

/** 对话库原文在研讨开始时冻结；来源表以后迁移或清理也不能破坏专题证据。 */
export interface EvolutionSourceMessageSnapshot {
  snapshotId: string;
  deliberationId: string;
  source: "nangong" | "codex";
  conversationId: string;
  sourceMessageId: string;
  sequenceNumber: number;
  role: string;
  responsePhase: string | null;
  content: string;
  originalCreatedAt: string;
  capturedAt: string;
}

/** 每轮同时保存韩立原问题、南宫婉原回答和韩立判断，禁止只保留最终摘要。 */
export interface HanLiDeliberationRound {
  roundId: string;
  roundNumber: number;
  question: string;
  questionReason: string;
  answer: string | null;
  assessment: string | null;
  decision: "continue" | "establish-topic" | "blocked" | null;
  createdAt: string;
  answeredAt: string | null;
  assessedAt: string | null;
}

export interface HanLiTopicCandidate {
  title: string;
  goal: string;
  scope: string[];
  exclusions: string[];
  evidence: string[];
  acceptanceCriteria: string[];
  establishmentReason: string;
}

export interface HanLiEvolutionDeliberation {
  deliberationId: string;
  topicId: string | null;
  status: HanLiDeliberationStatus;
  sourceSnapshots: EvolutionSourceMessageSnapshot[];
  rounds: HanLiDeliberationRound[];
  candidate: HanLiTopicCandidate | null;
  createdAt: string;
  updatedAt: string;
}

/** 原始档案事件只追加；页面概览和当前状态均由这些记录与业务投影组合得到。 */
export interface EvolutionArchiveRecord {
  recordId: string;
  deliberationId: string | null;
  topicId: string | null;
  proposalId: string | null;
  taskId: string | null;
  sequenceNumber: number;
  category: EvolutionArchiveCategory;
  eventType: string;
  actor: EvolutionArchiveActor;
  title: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface EvolutionTopicDossier {
  topic: EvolutionTopic;
  deliberation: HanLiEvolutionDeliberation | null;
  proposals: EvolutionProposal[];
  archiveRecords: EvolutionArchiveRecord[];
  executionRecords: EvolutionArchiveRecord[];
}

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
  deliberationId: string | null;
  continuationOfTopicId: string | null;
  nextTopicId: string | null;
  seriesId: string;
  roundNumber: number;
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
  stage: EvolutionApprovalStage;
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
  distributionPlan: EvolutionDistributionPlan | null;
  status: Exclude<EvolutionTopicStatus, "registered" | "investigating">;
  approvals: EvolutionApproval[];
  distributedTaskIds: string[];
  resultSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EvolutionDistributionUnit {
  title: string;
  scope: string;
  acceptanceCriteria: string[];
  expectedFiles: string[];
  independentReason: string;
}

export interface EvolutionDistributionAudit {
  decision: "passed" | "revise";
  reason: string;
  findings: string[];
  auditedAt: string;
}

export interface EvolutionDistributionPlan {
  version: 1;
  summary: string;
  units: EvolutionDistributionUnit[];
  audit: EvolutionDistributionAudit;
  plannedAt: string;
}

export interface NangongEvolutionState {
  version: 8;
  automaticEvolutionEnabled: boolean;
  automaticNangongApprovalEnabled: boolean;
  automaticLinghuApprovalEnabled: boolean;
  automaticExecutionEnabled: boolean;
  automationSettings: EvolutionAutomationSettings;
  automationRuntime: EvolutionAutomationRuntime;
  automationContext: { workspaceState: WorkspaceState | null; locale: Locale };
  preferenceSnapshotVersion: number;
  activeTopicId: string | null;
  topics: EvolutionTopic[];
  proposals: EvolutionProposal[];
  deliberations: HanLiEvolutionDeliberation[];
  archiveRecords: EvolutionArchiveRecord[];
  conversation: NangongConversation;
  updatedAt: string;
}

export interface EvolutionAutomationSettings {
  /** null 表示研讨无限模式；轮次数只控制韩立发问过程，不能代替专题确立判断。 */
  maxRoundsPerTopic: number | null;
  maxCorrectionRounds: number;
}

export interface EvolutionAutomationRuntime {
  status: "idle" | "running" | "paused" | "stopped" | "blocked";
  completedRounds: number;
  correctionRounds: number;
  stopReason: string | null;
  startedAt: string | null;
  pausedAt: string | null;
}

export interface ConfigureEvolutionAutomationRequest {
  maxRoundsPerTopic: number | null;
  maxCorrectionRounds: number;
  workspaceState?: WorkspaceState;
  locale?: Locale;
}

export type EvolutionAutomationAction = "start" | "pause" | "resume" | "stop";

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
}

export interface DecideEvolutionProposalRequest {
  decision: EvolutionApprovalDecision;
  advice?: string;
  feedbackTarget?: EvolutionFeedbackTarget;
  capabilityScope?: string;
}

export interface DecideEvolutionResultRequest {
  decision: EvolutionApprovalDecision;
  advice?: string;
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
