import type { AuditTaskSummaryOutDto, LocaleValue, ReasoningEffortValue } from "../../../../contracts/system/desktop/index";
import { fixedUiText, type FixedUiTextKey } from "../../../../contracts/foundation/index";

export function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function auditStatusText(status: AuditTaskSummaryOutDto["status"], locale: LocaleValue): string {
  const keys: Record<AuditTaskSummaryOutDto["status"], FixedUiTextKey> = { running: "auditRunning", completed: "auditCompleted", partial: "auditPartial", failed: "auditFailed", interrupted: "auditInterrupted" };
  return fixedUiText(locale, keys[status]);
}

export function reasoningEffortLabel(effort: ReasoningEffortValue, locale: LocaleValue): string {
  const keys: Record<ReasoningEffortValue, FixedUiTextKey> = { none: "reasoningNone", minimal: "reasoningMinimal", low: "reasoningLow", medium: "reasoningMedium", high: "reasoningHigh", xhigh: "reasoningXhigh", max: "reasoningMax", ultra: "reasoningUltra" };
  return fixedUiText(locale, keys[effort]);
}
