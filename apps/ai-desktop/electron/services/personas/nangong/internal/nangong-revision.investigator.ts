import type { EvolutionState } from "../../../../../contracts/collaboration/evolution/index.js";

export interface RevisionInvestigation {
  content: string;
  evidence: string[];
  impactScope: string[];
  exclusions: string[];
  risks: string[];
  rollbackPlan: string;
  acceptanceCriteria: string[];
}

/** 生成只读返修调查指令；审批意见只能作为核查目标，不能冒充新的事实证据。 */
export function revisionInvestigationPrompt(topic: EvolutionState["topics"][number], proposal: EvolutionState["proposals"][number], advice: string, feedbackTarget: string, capabilityScope: string | null): string {
  return [
    "你是南宫婉。韩立已经退回当前提案；先只读检查实际工作区，再决定是否存在足以重新提交的新事实。不得修改文件、启动构建或把审批意见改写成事实。",
    "重点核对韩立指出的实际组件、选择器或文件位置，当前可用、悬停、忙碌或禁用状态，明确影响范围与排除项，具体风险与回退边界，以及能在真实应用中观察的验收条件。",
    "只写亲自从源码、配置或可重复读取结果中核实的内容；每条 evidence 必须带可定位对象和观察结果。若没有新事实，evidence 返回空数组，程序不会创建新版本。",
    `反馈目标：${feedbackTarget}${capabilityScope ? `；能力范围：${capabilityScope}` : ""}`,
    `韩立退回意见：${advice}`,
    `课题：${JSON.stringify({ title: topic.title, goal: topic.goal, scope: topic.scope, exclusions: topic.exclusions, evidence: topic.evidence, acceptanceCriteria: topic.acceptanceCriteria })}`,
    `当前提案：${JSON.stringify({ version: proposal.version, content: proposal.content, evidence: proposal.evidence, impactScope: proposal.impactScope, exclusions: proposal.exclusions, risks: proposal.risks, rollbackPlan: proposal.rollbackPlan, acceptanceCriteria: proposal.acceptanceCriteria })}`,
    "仅返回 JSON：{\"content\":\"基于本次实查形成的完整修订方案\",\"evidence\":[\"文件/组件/状态 + 实际观察\"],\"impactScope\":[\"明确影响范围\"],\"exclusions\":[\"明确不改内容\"],\"risks\":[\"具体风险和缓解方式\"],\"rollbackPlan\":\"限定到本次改动的回退方案\",\"acceptanceCriteria\":[\"可在真实应用观察的结果\"]}。不要返回 Markdown。",
  ].join("\n\n");
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
export function hasMaterialRevisionEvidence(proposal: EvolutionState["proposals"][number], investigation: RevisionInvestigation, advice: string): boolean {
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
