import { useState } from "react";

import type { CollaborationMember, EvolutionStateOutDto } from "../../../../contracts/desktop/desktop";
import { evolutionMutationRequest } from "../model/evolution-workbench";

/** 原提交人依据审批意见形成不可覆盖的新版本，继续返回韩立审批。 */
export function MemberSelfUpgradePanel({ member, state, onState, onError }: { member: CollaborationMember; state: EvolutionStateOutDto; onState(state: EvolutionStateOutDto): void; onError(message: string): void }) {
  const returned = state.proposals.filter((proposal) => proposal.submitterMemberId === member.memberId && ["supplement-required", "rejected"].includes(proposal.status));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ content: "", evidence: "", impactScope: "", risks: "", rollbackPlan: "", acceptanceCriteria: "" });
  const [busy, setBusy] = useState(false);
  const selected = returned.find((proposal) => proposal.proposalId === selectedId) || returned[0] || null;
  if (!selected) return null;
  const latest = selected.approvals.at(-1);
  const updateDraft = (field: keyof typeof draft, value: string) => setDraft((current) => ({ ...current, [field]: value }));
  const submit = async () => {
    const evidence = splitList(draft.evidence); const impactScope = splitList(draft.impactScope); const risks = splitList(draft.risks); const acceptanceCriteria = splitList(draft.acceptanceCriteria);
    if (!draft.content.trim() || !evidence.length || !impactScope.length || !risks.length || !draft.rollbackPlan.trim() || !acceptanceCriteria.length) return onError("重新提交必须写清具体方案、补充事实、修改位置、风险、回退和预期结果。");
    setBusy(true);
    try {
      const next = await window.desktop?.reviseEvolutionProposal(selected.proposalId, { mutation: evolutionMutationRequest(state), submitterMemberId: member.memberId, content: draft.content, evidence, impactScope, risks, rollbackPlan: draft.rollbackPlan, acceptanceCriteria });
      if (next) onState(next);
      setDraft({ content: "", evidence: "", impactScope: "", risks: "", rollbackPlan: "", acceptanceCriteria: "" });
      setSelectedId(null);
    } catch (error) { onError(readableError(error, "重新提交方案失败。")); } finally { setBusy(false); }
  };
  return <section className="linghu-repair-proposals member-self-upgrade-panel" aria-label={`${member.displayName}重新提交方案`}><header><div><strong>依据审批意见重新提交</strong><span>{latest?.feedbackTarget === "submitter-capability" ? `本次同时升级自身能力：${latest.capabilityScope}` : "补充当前方案"}</span></div>{returned.length > 1 && <select aria-label="选择待修订提案" value={selected.proposalId} onChange={(event) => setSelectedId(event.currentTarget.value)}>{returned.map((proposal) => <option key={proposal.proposalId} value={proposal.proposalId}>{proposal.title} · v{proposal.version}</option>)}</select>}</header><p>用户意见：{latest?.advice || "未填写"}</p><div className="selform-root"><label>修订后的具体方案<textarea aria-label="修订后的具体方案" value={draft.content} onChange={(event) => updateDraft("content", event.currentTarget.value)} /></label><label>补充调查事实<input aria-label="补充调查事实" placeholder="多项用逗号分隔" value={draft.evidence} onChange={(event) => updateDraft("evidence", event.currentTarget.value)} /></label><label>修改位置和影响范围<input aria-label="修改位置和影响范围" placeholder="多项用逗号分隔" value={draft.impactScope} onChange={(event) => updateDraft("impactScope", event.currentTarget.value)} /></label><label>风险<input aria-label="修订风险" placeholder="多项用逗号分隔" value={draft.risks} onChange={(event) => updateDraft("risks", event.currentTarget.value)} /></label><label>回退方案<textarea aria-label="修订回退方案" value={draft.rollbackPlan} onChange={(event) => updateDraft("rollbackPlan", event.currentTarget.value)} /></label><label>预期结果和验收条件<input aria-label="预期结果和验收条件" placeholder="多项用逗号分隔" value={draft.acceptanceCriteria} onChange={(event) => updateDraft("acceptanceCriteria", event.currentTarget.value)} /></label><button type="button" className="primary" disabled={busy} onClick={() => void submit()}>重新提交韩立审批</button></div></section>;
}

function splitList(value: string): string[] { return [...new Set(value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean))]; }
function readableError(error: unknown, fallback: string): string { return (error instanceof Error ? error.message : fallback).replace(/^Error invoking remote method '[^']+':\s*/, ""); }
