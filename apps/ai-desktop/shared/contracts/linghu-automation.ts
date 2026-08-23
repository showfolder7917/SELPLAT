import type { CollaborationTaskState } from "./collaboration.js";

export type LinghuAutomationModule = "flow-completion" | "log-diagnosis" | "architecture-recovery" | "unified-test-restart";

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
  scores: { before: number | null; after: number | null; reason: string };
  tests: { status: "passed" | "failed" | "not-run" | "not-applicable"; summary: string };
  restartRecovery: { status: "passed" | "failed" | "not-run" | "not-applicable"; checkpoint: string | null; summary: string };
  blocking: { blocked: boolean; reason: string | null; resumeCondition: string | null };
  nextSuggestion: string;
  completedAt: string;
}

export interface LinghuAutomationState {
  version: 1;
  enabled: boolean;
  pollIntervalMs: 30_000;
  cycle: number;
  currentModule: LinghuAutomationModule;
  activePromptId: string | null;
  activeTaskId: string | null;
  recoveryAttemptCount: number;
  currentFaultFingerprint: string | null;
  /** 每个故障指纹独立计数，避免一个流程的恢复次数阻塞其它自动流程。 */
  recoveryAttempts: Record<string, number>;
  detectionCursor: string | null;
  flowSnapshots: LinghuAutomaticFlowSnapshot[];
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
