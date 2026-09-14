const ACCEPTANCE_OPERATIONS = new Set([
  "run_real_application_acceptance",
  "repair_failed_real_application_acceptance",
  "review_acceptance_failure_scope",
]);

/** 真实验收及其范围处理共享同一组操作身份。 */
export function isAcceptanceFailureOperation(value: unknown): value is string {
  return typeof value === "string" && ACCEPTANCE_OPERATIONS.has(value);
}

export interface OneShotFailureIdentity {
  runId: string | null;
  proposalId: string | null;
  operation: string;
  occurrenceId?: string | null;
}

/**
 * 普通步骤按运行和操作去重；每次真实验收使用独立发生身份。
 * 这样轮询不会重复登记同一故障，而后续复验的新失败也不会被旧记录吞掉。
 */
export function createOneShotFailureFingerprint(identity: OneShotFailureIdentity): string {
  const base = `nangong-one-shot:${identity.runId || "unknown"}:${identity.operation}:${identity.proposalId || "none"}`;
  if (!isAcceptanceFailureOperation(identity.operation)) return base;
  if (!identity.occurrenceId) throw new Error("真实验收失败缺少本轮发生身份。");
  return `${base}:${identity.occurrenceId}`;
}
