import type { CollaborationTask } from "../../../../contracts/collaboration/collaboration.js";

/** 把执行人的结构化标题转换为首页短摘要；缺少标题时使用已确认任务事实兜底。 */
export function createCollaborationResultSummary(task: CollaborationTask, text: string, pendingActions: string[] = []): NonNullable<CollaborationTask["resultSummary"]> {
  const sections = parseResultSections(text);
  const fallback = compactResultText(text);
  return {
    outcome: pendingActions.length > 0 ? "incomplete" : "pending-integration",
    finalResult: sections.get("最终执行结果") || fallback || "执行人未提供最终结果摘要。",
    originalProblem: sections.get("原来存在的问题") || task.snapshot.problemStatement,
    solvedProblem: sections.get("本次解决的问题") || fallback || "执行人未提供解决内容摘要。",
    changes: sections.get("具体修正或改变") || fallback || "执行人未提供改动摘要。",
    remaining: sections.get("遗留内容") || pendingActions.join("；") || "等待协同集成完成。",
    success: false,
    generatedAt: new Date().toISOString(),
  };
}

function parseResultSections(text: string): Map<string, string> {
  const headings = ["最终执行结果", "原来存在的问题", "本次解决的问题", "具体修正或改变", "完成状态", "遗留内容"];
  const sections = new Map<string, string>();
  let current: string | null = null;
  for (const line of text.split("\n")) {
    const normalized = line.trim().replace(/^#{1,6}\s*/, "").replace(/^\*\*(.+)\*\*$/, "$1").replace(/[：:]$/, "").trim();
    if (headings.includes(normalized)) {
      current = normalized;
      sections.set(current, "");
      continue;
    }
    if (!current) continue;
    sections.set(current, `${sections.get(current) || ""}${sections.get(current) ? "\n" : ""}${line}`.trim());
  }
  return sections;
}

function compactResultText(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 800);
}
