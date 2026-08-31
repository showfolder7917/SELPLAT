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

/** 工作台叶节点使用统一数据库读模型；业务动作仍由原有审批、分发和恢复命令处理。 */
export type EvolutionWorkbenchView =
  | "topics"
  | "deliberations"
  | "pending-approvals"
  | "approvals"
  | "proposals"
  | "tasks"
  | "releases"
  | "archives"
  | "automation-runs"
  | "recovery"
  | "exceptions";

export interface QueryEvolutionWorkbenchRequest {
  view: EvolutionWorkbenchView;
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
  sortField?: "updatedAt" | "createdAt" | "title" | "status";
  sortDirection?: "asc" | "desc";
}

/** 每行只公开人可读字段和稳定业务关联，不把原始 JSON、内部路径或机器字段交给页面。 */
export interface EvolutionWorkbenchRow {
  id: string;
  topicId: string | null;
  proposalId: string | null;
  taskId: string | null;
  title: string;
  status: string;
  stage: string;
  owner: string;
  blockedReason: string | null;
  recoveryPoint: string | null;
  nextStep: string;
  updatedAt: string;
}

export interface EvolutionWorkbenchPage {
  view: EvolutionWorkbenchView;
  page: number;
  pageSize: number;
  total: number;
  rows: EvolutionWorkbenchRow[];
  stateVersion: string;
  generatedAt: string;
}

/**
 * 工作台只消费受影响实体的轻量变化；完整专题对象继续由既有状态事件服务审批和执行页面。
 * previousStateVersion 与当前页版本不一致时，页面必须重新查询当前页，禁止用旧状态覆盖新事实。
 */
export interface EvolutionWorkbenchChangeEvent {
  entityType: "topic" | "deliberation" | "proposal" | "automation" | "workspace" | "conversation";
  entityId: string;
  topicId: string | null;
  proposalId: string | null;
  reason: string;
  previousState: string | null;
  currentState: string | null;
  currentStage: string | null;
  currentOwner: string | null;
  blockingReason: string | null;
  nextAction: string | null;
  previousStateVersion: string;
  stateVersion: string;
  updatedAt: string;
  affectedViews: EvolutionWorkbenchView[];
}

export interface EvolutionWorkbenchPreference {
  perspective: "nangong" | "hanli";
  nodeId: string;
  page: number;
  pageSize: number;
  keyword: string;
  status: string;
  selectedRowId: string | null;
  updatedAt: string;
}

export type SaveEvolutionWorkbenchPreferenceRequest = Omit<EvolutionWorkbenchPreference, "updatedAt">;

/** 独立工作台的稳定位置同时描述人物、树节点、列表查询和当前记录，可写入窗口地址并在复用窗口时重新定位。 */
export interface EvolutionWorkspaceLocation {
  perspective: "nangong" | "hanli";
  nodeId: string | null;
  page: number;
  pageSize: number;
  keyword: string;
  status: string;
  selectedRowId: string | null;
}

/** 专题写动作必须携带页面读取到的全局版本和一次性幂等键。 */
export interface EvolutionMutationRequest {
  expectedStateVersion: string;
  idempotencyKey: string;
}

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

export interface EvolutionDistributionValidation {
  decision: "passed" | "revise";
  reason: string;
  findings: string[];
  validatedAt: string;
}

export interface EvolutionDistributionPlan {
  version: 1;
  summary: string;
  units: EvolutionDistributionUnit[];
  validation: EvolutionDistributionValidation;
  plannedAt: string;
}

/** 韩立依据专题事实生成的真实界面检查项；字段保持开放语义，不用固定枚举替代判断。 */
export interface HanLiAcceptanceCheck {
  checkId: string;
  category: string;
  target: string;
  action: string;
  expected: string;
  evidenceRequired: string;
  operations: HanLiAcceptanceOperation[];
}

export type HanLiAcceptanceOperation =
  | { type: "focus-window" }
  | { type: "resize-window"; width: number; height: number }
  | { type: "click"; target: string }
  | { type: "scroll"; target: string; direction: "up" | "down"; amount: number }
  | { type: "press-key"; target?: string; key: "Tab" | "Enter" | "Escape" | "ArrowDown" | "ArrowUp" | "PageDown" | "PageUp" }
  | { type: "inspect-text"; text: string }
  | { type: "capture"; label: string };

/** 验收计划只描述待执行检查，不等同于测试通过或结果验收。 */
export interface HanLiAcceptancePlan {
  version: 1;
  planId: string;
  topicId: string;
  proposalId: string;
  summary: string;
  concerns: string[];
  checks: HanLiAcceptanceCheck[];
  generatedAt: string;
}

export interface HanLiAcceptanceStepResult {
  checkId: string;
  operationIndex: number;
  operation: HanLiAcceptanceOperation;
  status: "passed" | "failed" | "blocked";
  actual: string;
  screenshotAttachmentId: string | null;
  occurredAt: string;
}

/** 真实应用检查运行只保存事实证据，失败不会直接改变审批结果。 */
export interface HanLiAcceptanceRun {
  version: 1;
  runId: string;
  planId: string;
  topicId: string;
  proposalId: string;
  status: "passed" | "failed" | "blocked";
  windowTitle: string;
  initialBounds: { x: number; y: number; width: number; height: number };
  finalBounds: { x: number; y: number; width: number; height: number };
  stepResults: HanLiAcceptanceStepResult[];
  evidenceAttachmentIds: string[];
  startedAt: string;
  completedAt: string;
}

/** 真实检查失败返还南宫婉时使用结构化证据，避免只剩一句无法复现的审批意见。 */
export interface HanLiAcceptanceFailureEvidence {
  evidenceId: string;
  runId: string;
  planId: string;
  checkId: string;
  target: string;
  severity: "blocking" | "major";
  reproductionOperations: HanLiAcceptanceOperation[];
  actual: string;
  expected: string;
  screenshotAttachmentIds: string[];
}

/** 修复并复验成功只形成项目候选经验；没有跨场景治理前不得冒充稳定规则。 */
export interface HanLiAcceptanceExperienceCandidate {
  candidateId: string;
  status: "candidate" | "validated" | "degraded" | "retired";
  title: string;
  applicableScope: string[];
  sourceFailureEvidenceIds: string[];
  failedProposalId: string;
  correctionProposalId: string;
  failedRunId: string;
  passedRetestRunId: string;
  counterexampleCount: number;
  createdAt: string;
}

export interface NangongEvolutionState {
  version: 8;
  automaticEvolutionEnabled: boolean;
  automaticNangongApprovalEnabled: boolean;
  automaticLinghuApprovalEnabled: boolean;
  automaticExecutionEnabled: boolean;
  automationSettings: EvolutionAutomationSettings;
  automationRuntime: EvolutionAutomationRuntime;
  /** 南宫婉已经在可见正文中明确邀请启动本轮流程；应用重启后仍可继续等待用户确认。 */
  oneShotConfirmation?: EvolutionOneShotConfirmation | null;
  /** 当前对话经用户一次确认后启动的单轮托管；不改变四个长期自动开关。 */
  oneShotRun?: EvolutionOneShotRun | null;
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

export type EvolutionOneShotPhase = "preparing-topic" | "forming-proposal" | "approving" | "revising" | "distributing" | "executing" | "testing" | "accepting" | "completed" | "blocked";

/** 可见邀请形成的待确认事实；不使用模型隐藏字段推断用户是否能够回复 1。 */
export interface EvolutionOneShotConfirmation {
  conversationId: string;
  invitationMessageId: string;
  status: "awaiting-user-confirmation";
  createdAt: string;
}

/** 一次性运行状态随专题状态共同持久化，并通过既有状态事件实时投影到人物界面。 */
export interface EvolutionOneShotRun {
  runId: string;
  topicId: string | null;
  proposalId: string | null;
  status: "running" | "completed" | "blocked";
  phase: EvolutionOneShotPhase;
  actor: EvolutionArchiveActor;
  actorName: string;
  action: string;
  blockingReason: string | null;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface ConfigureEvolutionAutomationRequest {
  maxRoundsPerTopic: number | null;
  maxCorrectionRounds: number;
  workspaceState?: WorkspaceState;
  locale?: Locale;
}

export type EvolutionAutomationAction = "start" | "pause" | "resume" | "stop" | "handover";

export interface NangongConversationMessage {
  messageId: string;
  sequenceNumber: number;
  role: "user" | "nangong";
  content: string;
  replyToMessageId: string | null;
  deliveryStatus: "sending" | "completed" | "failed";
  inferredIntent?: string;
  attachmentIds?: string[];
  createdAt: string;
  completedAt: string | null;
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
  /** Renderer 在点击发送时生成，运行态确认和失败必须原位更新同一消息。 */
  clientMessageId?: string;
  message: string;
  attachmentIds?: string[];
  /** 从专题执行群发言时只保存稳定专题关联；普通南宫婉对话保持为空。 */
  topicId?: string;
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

export interface CreateEvolutionProposalRequest {
  type: EvolutionProposalType;
  content: string;
  risks: string[];
  rollbackPlan: string;
}

export interface DecideEvolutionProposalRequest {
  mutation: EvolutionMutationRequest;
  decision: EvolutionApprovalDecision;
  advice?: string;
  feedbackTarget?: EvolutionFeedbackTarget;
  capabilityScope?: string;
}

export interface DecideEvolutionResultRequest {
  mutation: EvolutionMutationRequest;
  decision: EvolutionApprovalDecision;
  advice?: string;
}

/** 原提交人依据人工意见补充调查，并以不可覆盖的新版本重新提交。 */
export interface ReviseEvolutionProposalRequest {
  mutation: EvolutionMutationRequest;
  submitterMemberId: string;
  content: string;
  evidence: string[];
  impactScope: string[];
  exclusions?: string[];
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
