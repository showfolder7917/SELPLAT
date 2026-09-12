/** 韩立设计审批门禁：缺少架构、布局或用户路径检查时退回方案，不派发技术排障。 */
export interface HanliDesignCheck {
  status: "passed" | "needs-work" | "not-applicable";
  reason: string;
  evidence: string[];
  acceptanceCriteria: string[];
}

/** 只接受本提案既有证据与验收条件的精确引用；设计判断由韩立负责。 */
export function reviewDesignCoverage(
  value: unknown,
  facts: { evidence: string[]; acceptanceCriteria: string[] },
): { complete: boolean; notes: string } {
  const review = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const labels = { architecture: "整体架构", layout: "页面布局", userJourney: "用户操作路径" };
  const notes: string[] = [];
  let complete = true;
  for (const [key, label] of Object.entries(labels)) {
    const check = review[key] as Partial<HanliDesignCheck> | undefined;
    if (!check || !["passed", "needs-work", "not-applicable"].includes(check.status || "")
      || typeof check.reason !== "string" || !check.reason.trim()) {
      complete = false;
      notes.push(`${label}：缺少明确设计检查，请南宫婉补齐对应方案后交韩立复核。`);
      continue;
    }
    const cited = Array.isArray(check.evidence) && check.evidence.length > 0
      && check.evidence.every((item) => typeof item === "string" && facts.evidence.includes(item));
    const testable = Array.isArray(check.acceptanceCriteria) && check.acceptanceCriteria.length > 0
      && check.acceptanceCriteria.every((item) => typeof item === "string" && facts.acceptanceCriteria.includes(item));
    // 架构不能跳过；非界面任务可以说明布局或用户路径不适用，但仍须有本轮事实支持。
    const passed = check.status === "passed" && cited && testable;
    const notApplicable = key !== "architecture" && check.status === "not-applicable" && cited;
    if (!passed && !notApplicable) complete = false;
    notes.push(`${label}：${check.reason.trim()}${!cited ? "；缺少本轮已登记依据" : ""}${check.status === "passed" && !testable ? "；缺少对应验收条件" : ""}`);
  }
  return { complete, notes: notes.join("\n") };
}
