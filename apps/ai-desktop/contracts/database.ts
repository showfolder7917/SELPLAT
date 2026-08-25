export type AiMemoryDatabaseState = "ready" | "recovery-required" | "unavailable";

export interface AiMemoryDatabaseStatus {
  state: AiMemoryDatabaseState;
  schemaVersion: string | null;
  message: string | null;
}

