import type { ManagedExecutionMode } from "./base.js";

export interface ManagedExecutionUpdate {
  mode: ManagedExecutionMode;
  stage: "conversation" | "requirement-analysis" | "task-execution" | "code-validation" | "interaction-validation" | "build-validation" | "runtime-restart" | "completed";
  status: "started" | "continuing" | "completed" | "blocked";
  round: number;
  maximumRounds: number;
  message: string;
}

export interface CodexStreamPlanStep {
  step: string;
  status: "pending" | "inProgress" | "completed";
}

export interface CodexStreamActivity {
  id: string;
  itemType: string;
  phase: "started" | "completed" | "output";
  status: string | null;
  summary: string | null;
  detail: string | null;
  exitCode?: number;
}

export interface CodexStreamEvent {
  type: "turn-started" | "message-delta" | "message-completed" | "reasoning-summary-delta" | "activity" | "plan-updated" | "diff-updated" | "turn-completed" | "managed-execution" | "error";
  turnId: string;
  segmentId?: string;
  itemId?: string;
  delta?: string;
  text?: string;
  activity?: CodexStreamActivity;
  plan?: CodexStreamPlanStep[];
  changedFiles?: string[];
  status?: string;
  error?: string;
  managedExecution?: ManagedExecutionUpdate;
}
