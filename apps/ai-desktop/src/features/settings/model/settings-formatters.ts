import type { AuditTaskSummaryOutDto, LocaleValue, ReasoningEffortValue } from "../../../../contracts/system/desktop/index";

export function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function auditStatusText(status: AuditTaskSummaryOutDto["status"], locale: LocaleValue): string {
  const chinese = { running: "运行中", completed: "已完成", partial: "部分完成", failed: "失败", interrupted: "已中断" } as const;
  const japanese = { running: "実行中", completed: "完了", partial: "一部完了", failed: "失敗", interrupted: "中断" } as const;
  return (locale === "ja" ? japanese : chinese)[status];
}

export function reasoningEffortLabel(effort: ReasoningEffortValue, locale: LocaleValue): string {
  const chinese: Record<ReasoningEffortValue, string> = { none: "无", minimal: "最小", low: "低", medium: "中", high: "高", xhigh: "超高", max: "最大" };
  const japanese: Record<ReasoningEffortValue, string> = { none: "なし", minimal: "最小", low: "低", medium: "中", high: "高", xhigh: "最高", max: "最大" };
  return locale === "ja" ? japanese[effort] : chinese[effort];
}
