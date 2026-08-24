export type CollaborationReviewDecisionSource = "tag" | "legacy-marker" | "explicit-chinese" | "clarification";

export type CollaborationReviewSessionResult =
  | { outcome: "decided"; decision: "passed" | "rejected"; decisionSource: CollaborationReviewDecisionSource; feedback: string; rawOutput: string; clarificationOutput: string | null }
  | { outcome: "decision-unrecognized"; feedback: string; rawOutput: string; clarificationOutput: string; error: string };

export class CollaborationReviewTransportError extends Error {
  readonly rawOutput: string;
  readonly clarificationOutput: string | null = null;

  constructor(rawOutput: string, cause: unknown) {
    super(`补取审核结论时连接异常：${cause instanceof Error ? cause.message : String(cause)}`, { cause });
    this.name = "CollaborationReviewTransportError";
    this.rawOutput = rawOutput;
  }
}

/** 原审核输出无法机器识别时只补取一次结论；无论补取成败都保留原始审核正文。 */
export async function resolveCollaborationReviewDecision(rawOutput: string, requestClarification: () => Promise<string>): Promise<CollaborationReviewSessionResult> {
  const normalized = rawOutput.trim();
  const parsed = parseCollaborationReviewDecision(normalized);
  if (parsed) return { outcome: "decided", ...parsed, feedback: normalized, rawOutput: normalized, clarificationOutput: null };
  const clarificationOutput = (await requestClarification()).trim();
  const clarified = parseCollaborationReviewDecision(clarificationOutput);
  if (clarified) return { outcome: "decided", decision: clarified.decision, decisionSource: "clarification", feedback: normalized || clarificationOutput, rawOutput: normalized, clarificationOutput };
  return { outcome: "decision-unrecognized", feedback: normalized, rawOutput: normalized, clarificationOutput, error: "审核正文已生成，但原始输出和一次结论补取都没有包含唯一、明确的审核决定。" };
}

/** 只接受唯一且明确的审核结论，兼容结构化标签、旧协议和明确中文结论，不从普通正文猜测。 */
export function parseCollaborationReviewDecision(text: string): { decision: "passed" | "rejected"; decisionSource: Exclude<CollaborationReviewDecisionSource, "clarification"> } | null {
  const normalized = text.replace(/^\uFEFF/, "").trim();
  if (!normalized) return null;
  const taggedValues = [...normalized.matchAll(/<review_decision>\s*(PASSED|REJECTED)\s*<\/review_decision>/gi)].map((match) => match[1]);
  if (taggedValues.length > 0) {
    const tagged = uniqueDecision(taggedValues);
    return tagged ? { decision: tagged, decisionSource: "tag" } : null;
  }
  const semanticLines = normalized.split(/\r?\n/).map(normalizeDecisionLine).filter(Boolean);
  const legacyValues = semanticLines.flatMap((line) => {
    const match = line.match(/^DECISION\s*[:：]\s*(PASSED|REJECTED)\s*[.!。！]?$/i);
    return match ? [match[1]] : [];
  });
  if (legacyValues.length > 0) {
    const legacy = uniqueDecision(legacyValues);
    return legacy ? { decision: legacy, decisionSource: "legacy-marker" } : null;
  }
  const chineseValues = semanticLines.flatMap((line) => {
    const match = line.match(/^(?:审核)?结论\s*[:：]\s*(通过|不通过|驳回|拒绝)\s*[。！!]?$/);
    return match ? [match[1] === "通过" ? "PASSED" : "REJECTED"] : [];
  });
  const chinese = uniqueDecision(chineseValues);
  return chinese ? { decision: chinese, decisionSource: "explicit-chinese" } : null;
}

function normalizeDecisionLine(line: string): string {
  return line.trim().replace(/^```\w*\s*$/i, "").replace(/^(?:[-*+>#]|\d+[.)])\s*/, "").replace(/[*_`]/g, "").trim();
}

function uniqueDecision(values: Array<string | undefined>): "passed" | "rejected" | null {
  const decisions = new Set(values.filter((value): value is string => Boolean(value)).map((value) => value.toUpperCase() === "PASSED" ? "passed" : "rejected"));
  return decisions.size === 1 ? [...decisions][0] : null;
}
