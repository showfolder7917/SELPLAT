export type AiMemoryDatabaseStateValue = "ready" | "recovery-required" | "unavailable";
export type CorpusSemanticBackfillStateValue = "idle" | "running" | "completed" | "failed";
/** 外部 Codex 会话自动入库的后台状态；停止不是失败，重新开启后从检查点继续扫描。 */
export type CorpusIngestionStateValue = "stopped" | "running" | "completed" | "failed";
