/**
 * 灵狐自动化协议，描述流程补全、测试覆盖和审计完整性模块的运行状态。
 *
 * 生产者：主进程 LinghuAutomationFacade 与 Store。
 * 消费者：Renderer 自动化面板、协作协调器和事件中心。
 * 数据方向：renderer <-> preload <-> main，状态事件由 main 推送。
 * 本文件不执行测试、不修改源码，也不自行批准修复方案。
 */
import type { CollaborationTaskState } from "./collaboration.js";
import type { TestResourceCoordinatorState } from "./test-resource.js";

export type LinghuAutomationModule = "flow-completion" | "test-coverage" | "audit-completeness";

export interface LinghuStartupPrompt {
  promptId: string;
  title: string;
  content: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LinghuAutomationFeedback {
  cycle: number;
  module: LinghuAutomationModule;
  taskId: string;
  taskState: CollaborationTaskState;
  summary: string;
  recordedAt: string;
}

export type LinghuFlowHealth = "healthy" | "waiting" | "stalled" | "repairing" | "testing" | "recovering" | "human-blocked" | "completed";
export type LinghuBlockingKind = "none" | "infrastructure" | "data" | "code" | "test" | "business";

/** 自动保障每轮持久化的流程事实；页面、审计和恢复逻辑共享同一份快照。 */
export interface LinghuAutomaticFlowSnapshot {
  flowId: string;
  sourceTaskId: string;
  health: LinghuFlowHealth;
  state: CollaborationTaskState;
  phase: string | null;
  executorMemberId: string | null;
  workerGeneration: number;
  lastHeartbeatAt: string | null;
  lastProtocolProgressAt: string | null;
  lastStateChangedAt: string;
  waitingPoint: string | null;
  completionConditions: string[];
  completedConditions: string[];
  recoveryCheckpoint: string | null;
  blockingReason: string | null;
  blockingKind: LinghuBlockingKind;
}

export interface LinghuModuleCompletionReport {
  cycle: number;
  module: LinghuAutomationModule;
  evidence: string[];
  tasks: Array<{ taskId: string; type: string; action: string; executorMemberId: string; result: string }>;
  tests: { status: "passed" | "failed" | "not-run" | "not-applicable"; summary: string };
  restartRecovery: { status: "passed" | "failed" | "not-run" | "not-applicable"; checkpoint: string | null; summary: string };
  blocking: { blocked: boolean; reason: string | null; resumeCondition: string | null };
  nextSuggestion: string;
  completedAt: string;
}

export interface LinghuAutomationState {
  version: 2;
  enabled: boolean;
  pollIntervalMs: 30_000;
  cycle: number;
  currentModule: LinghuAutomationModule;
  activePromptId: string | null;
  activeTaskId: string | null;
  pendingRepairProposalId: string | null;
  recoveryAttemptCount: number;
  currentFaultFingerprint: string | null;
  /** 每个故障指纹独立计数，避免一条流程的恢复次数阻塞其他人物。 */
  recoveryAttemptsByFingerprint: Record<string, number>;
  detectionCursor: string | null;
  flowSnapshots: LinghuAutomaticFlowSnapshot[];
  testResourceState: TestResourceCoordinatorState | null;
  recoveryCheckpoint: string | null;
  lastDispatchAt: string | null;
  lastCompletedAt: string | null;
  lastCheckedAt: string | null;
  blockingReason: string | null;
  lastFeedback: LinghuAutomationFeedback | null;
  lastModuleReport: LinghuModuleCompletionReport | null;
  prompts: LinghuStartupPrompt[];
  updatedAt: string;
}

export interface CreateLinghuStartupPromptRequest {
  title: string;
  content: string;
}

export interface UpdateLinghuStartupPromptRequest {
  title?: string;
  content?: string;
  enabled?: boolean;
}

export interface LinghuAutomationStateEvent {
  state: LinghuAutomationState;
  reason: string;
}
