import type { WorkflowExceptionRecordOutDto } from "../../../../../contracts/services/workflow/index.js";
import { isAcceptanceFailureOperation } from "../evolution/one-shot-failure-identity.js";

/**
 * 主卡点只保存恢复关系；修复内容必须来自同一提案最近一次真实验收失败。
 * 旧执行或解析异常不能覆盖后来已经发生的页面验收事实。
 */
export function selectCurrentAcceptanceFailure(
  fallback: WorkflowExceptionRecordOutDto,
  relatedEvents: WorkflowExceptionRecordOutDto[],
  proposalId: string,
): WorkflowExceptionRecordOutDto {
  return relatedEvents
    .filter((event) => event.flowImpact === "blocked"
      && event.payload.proposalId === proposalId
      && isAcceptanceFailureOperation(event.payload.operation))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0] || fallback;
}

/** 只按同一提案两次有独立运行标识、分类和原始事实的韩立验收失败触发能力复查。 */
export function selectRepeatedAcceptanceFailures(
  events: WorkflowExceptionRecordOutDto[],
  proposalId: string,
): WorkflowExceptionRecordOutDto[] {
  const distinctRuns = new Set<string>();
  const latest = events.filter((event) => event.flowImpact === "blocked" && event.payload.proposalId === proposalId
    && isAcceptanceFailureOperation(event.payload.operation))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.eventId.localeCompare(left.eventId))[0];
  const currentFamily = latest ? acceptanceFailureFamily(latest) : null;
  if (!currentFamily) return [];
  const classified = events
    .filter((event) => event.flowImpact === "blocked" && event.payload.proposalId === proposalId
      && isAcceptanceFailureOperation(event.payload.operation)
      && typeof event.payload.acceptanceRunId === "string" && Boolean(event.payload.acceptanceRunId.trim())
      && Boolean(event.message.trim()) && Boolean(acceptanceFailureFamily(event)))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.eventId.localeCompare(left.eventId));
  return classified
    .filter((event) => acceptanceFailureFamily(event) === currentFamily)
    .filter((event) => {
      const runId = String(event.payload.acceptanceRunId);
      if (distinctRuns.has(runId)) return false;
      distinctRuns.add(runId);
      return true;
    })
    .slice(0, 2)
    .reverse();
}

/** 两轮必须指向同一类能力阻塞或同一组原验收条件，避免旧问题覆盖新故障。 */
function acceptanceFailureFamily(event: WorkflowExceptionRecordOutDto): string | null {
  if (event.payload.acceptanceFailureKind === "acceptance-capability-blocked") return "acceptance-capability-blocked";
  if (event.payload.acceptanceFailureKind !== "product-defect") return null;
  const scope = event.payload.acceptanceFailureScope as { decision?: unknown; defects?: unknown } | undefined;
  if (scope?.decision !== "within-original-acceptance" || !Array.isArray(scope.defects)) return null;
  const conditionIds = scope.defects.map((item) => (item as { checkId?: unknown }).checkId)
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
  return conditionIds.length ? `product-defect:${[...new Set(conditionIds)].sort().join(",")}` : null;
}
