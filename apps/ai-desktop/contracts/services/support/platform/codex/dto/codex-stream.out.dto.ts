export interface CodexStreamPlanStepOutDto {
  step: string;
  status: "pending" | "inProgress" | "completed";
}

export interface CodexStreamActivityOutDto {
  id: string;
  itemType: string;
  phase: "started" | "completed" | "output";
  status: string | null;
  summary: string | null;
  detail: string | null;
  exitCode?: number;
}
