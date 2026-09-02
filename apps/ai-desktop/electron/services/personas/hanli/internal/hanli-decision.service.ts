import { randomUUID } from "node:crypto";

import type { CollaborationMemoryPort } from "../../../../../contracts/services/support/capabilities/event-center/index.js";
import type { EvolutionProposalOutDto, EvolutionStateOutDto } from "../../../../../contracts/services/evolution/index.js";
import type { HanliAcceptanceOperationValue, HanliAcceptancePlanOutDto } from "../../../../../contracts/services/personas/hanli/index.js";
import type { EvolutionStatePort } from "../../../evolution/index.js";
import type { PromptLibraryPort } from "../../../support/capabilities/prompts/index.js";

export interface HanliDecisionDependencies {
  store: EvolutionStatePort;
  prompts: PromptLibraryPort;
  memory: CollaborationMemoryPort | null;
  askHanli(prompt: string, state: EvolutionStateOutDto): Promise<string>;
  readStableUserId(): string;
  readProjectScope(state: EvolutionStateOutDto): string;
}

/** 韩立只保留提案判断与验收规划；旧的原始会话研讨状态机已经退役。 */
export class HanliDecisionService {
  constructor(private readonly dependencies: HanliDecisionDependencies) {}

  async reviewOneShotProposal(proposal: EvolutionProposalOutDto): Promise<{ decision: "approved" | "rejected" | "supplement-required"; advice: string }> {
    const state = this.dependencies.store.state();
    const semanticContext = this.dependencies.memory?.readHanliSemanticContext(this.dependencies.readStableUserId(), this.dependencies.readProjectScope(state), proposal.title, 12) || null;
    const response = await this.dependencies.askHanli(this.dependencies.prompts.render("hanli.proposal-review", {
      proposalContextJson: JSON.stringify({ proposal, topic: state.topics.find((item) => item.topicId === proposal.topicId) }),
      semanticContextJson: JSON.stringify(semanticContext),
    }), state);
    const value = parseJsonObject(response);
    const decision = value.decision;
    const advice = typeof value.advice === "string" ? value.advice.trim().slice(0, 8_000) : "";
    if (!("approved,rejected,supplement-required".split(",") as unknown[]).includes(decision) || !advice) throw new Error("韩立一次性方向审批缺少有效决定或具体意见。");
    return { decision: decision as "approved" | "rejected" | "supplement-required", advice };
  }

  async createAcceptancePlan(
    topic: EvolutionStateOutDto["topics"][number],
    proposal: EvolutionProposalOutDto,
    priorFindings: Record<string, unknown>[],
    semanticContext: Record<string, unknown>,
    requestPlan: (prompt: string, workspaceState: typeof topic.workspaceState, locale: typeof topic.locale) => Promise<string>,
  ): Promise<HanliAcceptancePlanOutDto> {
    const response = await requestPlan(this.dependencies.prompts.render("hanli.acceptance-plan", {
      topicJson: JSON.stringify({ title: topic.title, goal: topic.goal, scope: topic.scope, exclusions: topic.exclusions, evidence: topic.evidence, acceptanceCriteria: topic.acceptanceCriteria }),
      proposalJson: JSON.stringify({ title: proposal.title, content: proposal.content, impactScope: proposal.impactScope, risks: proposal.risks, resultSummary: proposal.resultSummary }),
      priorFindingsJson: JSON.stringify(priorFindings),
      semanticContextJson: JSON.stringify(semanticContext),
    }), topic.workspaceState, topic.locale);
    return parseAcceptancePlan(response, topic.topicId, proposal.proposalId);
  }
}

function parseJsonObject(text: string): Record<string, unknown> {
  const candidate = text.match(/\{[\s\S]*\}/u)?.[0];
  if (!candidate) throw new Error("AI 没有返回可解析的结构化判断。");
  try { return JSON.parse(candidate) as Record<string, unknown>; }
  catch { throw new Error("AI 返回的结构化判断不是有效 JSON。"); }
}

function normalizeList(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 100) : [];
}

function parseAcceptancePlan(text: string, topicId: string, proposalId: string): HanliAcceptancePlanOutDto {
  const value = parseJsonObject(text);
  const summary = typeof value.summary === "string" ? value.summary.trim().slice(0, 2_000) : "";
  const concerns = normalizeList(value.concerns).slice(0, 20);
  const checks = (Array.isArray(value.checks) ? value.checks.slice(0, 30) : []).flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const category = typeof item.category === "string" ? item.category.trim().slice(0, 120) : "";
    const target = typeof item.target === "string" ? item.target.trim().slice(0, 300) : "";
    const action = typeof item.action === "string" ? item.action.trim().slice(0, 2_000) : "";
    const expected = typeof item.expected === "string" ? item.expected.trim().slice(0, 2_000) : "";
    const evidenceRequired = typeof item.evidenceRequired === "string" ? item.evidenceRequired.trim().slice(0, 1_000) : "";
    const operations = Array.isArray(item.operations) ? item.operations.slice(0, 20).flatMap(parseAcceptanceOperation) : [];
    return category && target && action && expected && evidenceRequired && operations.length ? [{ checkId: `check-${index + 1}`, category, target, action, expected, evidenceRequired, operations }] : [];
  });
  if (!summary || !concerns.length || checks.length < 2) throw new Error("韩立没有形成包含用户关注点和真实操作证据的有效验收计划。");
  return { version: 1, planId: `hanli-acceptance-plan-${randomUUID()}`, topicId, proposalId, summary, concerns, checks, generatedAt: new Date().toISOString() };
}

function parseAcceptanceOperation(raw: unknown): HanliAcceptanceOperationValue[] {
  if (!raw || typeof raw !== "object") return [];
  const item = raw as Record<string, unknown>;
  if (item.type === "focus-window") return [{ type: "focus-window" }];
  if (item.type === "resize-window" && Number.isInteger(item.width) && Number.isInteger(item.height)) return [{ type: "resize-window", width: Number(item.width), height: Number(item.height) }];
  if (item.type === "click" && typeof item.target === "string" && item.target.trim()) return [{ type: "click", target: item.target.trim().slice(0, 200) }];
  if (item.type === "scroll" && typeof item.target === "string" && (item.direction === "up" || item.direction === "down") && Number.isFinite(item.amount)) return [{ type: "scroll", target: item.target.trim().slice(0, 200), direction: item.direction, amount: Math.max(40, Math.min(2_000, Math.round(Number(item.amount)))) }];
  if (item.type === "press-key" && ["Tab", "Enter", "Escape", "ArrowDown", "ArrowUp", "PageDown", "PageUp"].includes(String(item.key))) return [{ type: "press-key", target: typeof item.target === "string" ? item.target.trim().slice(0, 200) : undefined, key: item.key as "Tab" | "Enter" | "Escape" | "ArrowDown" | "ArrowUp" | "PageDown" | "PageUp" }];
  if (item.type === "inspect-text" && typeof item.text === "string" && item.text.trim()) return [{ type: "inspect-text", text: item.text.trim().slice(0, 500) }];
  if (item.type === "inspect-layout" && typeof item.target === "string" && item.target.trim()) return [{ type: "inspect-layout", target: item.target.trim().slice(0, 200) }];
  if (item.type === "capture" && typeof item.label === "string" && item.label.trim()) return [{ type: "capture", label: item.label.trim().slice(0, 160) }];
  return [];
}
