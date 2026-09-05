import type { EvolutionStateOutDto } from "../../../../../../contracts/services/evolution/index.js";

export interface RevisionInvestigation {
  content: string;
  evidence: string[];
  impactScope: string[];
  exclusions: string[];
  risks: string[];
  rollbackPlan: string;
  acceptanceCriteria: string[];
}

/** 校验返修调查的完整结构；缺少范围、风险、回退或验收时拒绝创建版本。 */
export function parseRevisionInvestigation(text: string): RevisionInvestigation {
  const value = parseJsonObject(text);
  const content = typeof value.content === "string" ? value.content.trim().slice(0, 30_000) : "";
  const evidence = normalizeList(value.evidence);
  const impactScope = normalizeList(value.impactScope);
  const exclusions = normalizeList(value.exclusions);
  const risks = normalizeList(value.risks);
  const rollbackPlan = typeof value.rollbackPlan === "string" ? value.rollbackPlan.trim().slice(0, 8_000) : "";
  const acceptanceCriteria = normalizeList(value.acceptanceCriteria);
  if (!content || !impactScope.length || !risks.length || !rollbackPlan || !acceptanceCriteria.length) throw new Error("南宫婉返修调查没有形成完整的范围、风险、回退和验收结构。");
  return { content, evidence, impactScope, exclusions, risks, rollbackPlan, acceptanceCriteria };
}

/** 只有新增可定位证据并且方案结构真实变化时，才允许形成下一版提案。 */
export function hasMaterialRevisionEvidence(proposal: EvolutionStateOutDto["proposals"][number], investigation: RevisionInvestigation, advice: string): boolean {
  const oldEvidence = new Set(proposal.evidence.map(normalizedComparisonText));
  const approvalText = normalizedComparisonText(advice);
  const hasNewEvidence = investigation.evidence.some((item) => {
    const normalized = normalizedComparisonText(item);
    return normalized.length >= 12 && !oldEvidence.has(normalized) && normalized !== approvalText && !normalized.startsWith("人工审批事实");
  });
  if (!hasNewEvidence) return false;
  const nextStructure = normalizedComparisonText(JSON.stringify({ content: investigation.content, impactScope: investigation.impactScope, exclusions: investigation.exclusions, risks: investigation.risks, rollbackPlan: investigation.rollbackPlan, acceptanceCriteria: investigation.acceptanceCriteria }));
  const previousStructure = normalizedComparisonText(JSON.stringify({ content: proposal.content, impactScope: proposal.impactScope, exclusions: proposal.exclusions, risks: proposal.risks, rollbackPlan: proposal.rollbackPlan, acceptanceCriteria: proposal.acceptanceCriteria }));
  return nextStructure !== previousStructure;
}

function normalizeList(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 100) : [];
}

function parseJsonObject(text: string): Record<string, unknown> {
  const candidate = text.match(/\{[\s\S]*\}/)?.[0];
  if (!candidate) throw new Error("AI 没有返回可解析的结构化判断。 ");
  try { return JSON.parse(candidate) as Record<string, unknown>; } catch { throw new Error("AI 返回的结构化判断不是有效 JSON。 "); }
}

function normalizedComparisonText(value: string): string { return value.normalize("NFKC").replaceAll(/\s+/gu, "").toLowerCase(); }
