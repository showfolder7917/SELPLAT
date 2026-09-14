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
