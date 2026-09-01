import type { ReactNode } from "react";

import type { EvolutionStateOutDto } from "../../../../contracts/desktop/desktop";
import { MarkdownMessage } from "../../../variants/developer/MarkdownMessage";
import { evolutionStatusLabel } from "../model/evolution-workbench";

type EvolutionProposal = EvolutionStateOutDto["proposals"][number];

/** 展示选中提案的事实、范围、风险、回退和审批记录，业务动作由 children 注入。 */
export function EvolutionProposalDetail({ proposal, compact = false, children }: { proposal: EvolutionProposal; compact?: boolean; children?: ReactNode }) {
  return <article className={`evolution-proposal-detail ${compact ? "compact" : ""}`}><header><div><span>{proposal.type}{proposal.purpose === "self-capability-upgrade" ? " · 自身能力升级" : ""}</span><h3>{proposal.title} · v{proposal.version}</h3></div><strong>{evolutionStatusLabel(proposal.status)}</strong></header>{proposal.targetMemberDisplayName && <p className="proposal-approval-note">升级对象：{proposal.targetMemberDisplayName} · {proposal.capabilityScope}</p>}<MarkdownMessage text={proposal.content} /><dl><div><dt>事实证据</dt><dd>{proposal.evidence.join("；") || "—"}</dd></div><div><dt>影响范围</dt><dd>{proposal.impactScope.join("；") || "—"}</dd></div><div><dt>风险</dt><dd>{proposal.risks.join("；") || "—"}</dd></div><div><dt>回退</dt><dd>{proposal.rollbackPlan || "—"}</dd></div></dl>{proposal.approvals.map((approval) => <p key={approval.approvalId} className="proposal-approval-note">{approval.approverDisplayName} · {evolutionStatusLabel(approval.decision)}{approval.feedbackTarget === "submitter-capability" ? ` · 升级提交能力：${approval.capabilityScope}` : ""} · {approval.advice}</p>)}{children && <div className="evolution-proposal-actions">{children}</div>}</article>;
}
