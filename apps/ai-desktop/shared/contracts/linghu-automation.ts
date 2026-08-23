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

export interface LinghuAutomationState {
  version: 1;
  enabled: boolean;
  pollIntervalMs: 30_000;
  cycle: number;
  currentModule: LinghuAutomationModule;
  activePromptId: string | null;
  activeTaskId: string | null;
  recoveryAttemptCount: number;
  lastDispatchAt: string | null;
  lastCompletedAt: string | null;
  lastCheckedAt: string | null;
  blockingReason: string | null;
  lastFeedback: LinghuAutomationFeedback | null;
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
