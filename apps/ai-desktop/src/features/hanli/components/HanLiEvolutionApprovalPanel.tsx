import { useEffect, useState } from "react";

import type { ApprovalGovernanceRecordOutDto, HanliAcceptancePlanOutDto, HanliAcceptanceRunOutDto, LocaleValue, EvolutionStateOutDto } from "../../../../contracts/system/desktop/desktop";
import { evolutionMutationRequest } from "../../evolution/model/evolution-workbench";
import { EvolutionProposalDetail } from "../../evolution/components/EvolutionProposalDetail";
import { EvolutionProposalGrid } from "../../evolution/components/EvolutionProposalGrid";

/**
 * 韩立审批工作区：统一处理方向审批、结果验收和真实应用验收。
 *
 * 真实传参示例：待审批的专题状态、人工审批视图以及当前选中的提案编号。
 * 真实返回示例：React 渲染审批意见、验收计划及运行结果，不直接返回业务对象。
 * 异常或副作用示例：通过 desktop 门面提交韩立决定；失败时保留输入并把可读原因交给 onError。
 */
export function HanLiEvolutionApprovalPanel({ state, locale, view, selectedProposalId, databaseManaged, onState, onError }: { state: EvolutionStateOutDto; locale: LocaleValue; view: "manual" | "automatic"; selectedProposalId: string | null; databaseManaged: boolean; onState(state: EvolutionStateOutDto): void; onError(message: string): void }) {
  const proposals = [...state.proposals].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const [selectedId, setSelectedId] = useState<string | null>(proposals[0]?.proposalId || null);
  const [advice, setAdvice] = useState("");
  const [feedbackTarget, setFeedbackTarget] = useState<"proposal-content" | "submitter-capability">("proposal-content");
  const [capabilityScope, setCapabilityScope] = useState("");
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<HanliAcceptancePlanOutDto | null>(null);
  const [runBusy, setRunBusy] = useState(false);
  const [generatedRun, setGeneratedRun] = useState<HanliAcceptanceRunOutDto | null>(null);
  const [governance, setGovernance] = useState<ApprovalGovernanceRecordOutDto[]>([]);
  const selected = proposals.find((proposal) => proposal.proposalId === selectedId) || (databaseManaged ? null : proposals[0]) || null;
  useEffect(() => { if (databaseManaged) setSelectedId(selectedProposalId); }, [databaseManaged, selectedProposalId]);
  useEffect(() => { void window.desktop?.getApprovalGovernance().then(setGovernance).catch(() => setGovernance([])); }, [state.updatedAt]);
  const update = async (operation: () => Promise<EvolutionStateOutDto> | undefined) => {
    if (decisionBusy) return;
    setDecisionBusy(true);
    try { const pending = operation(); if (pending) onState(await pending); } catch (error) { onError(readableError(error, "演化审批操作失败。")); }
    finally { setDecisionBusy(false); }
  };
  const decide = async (proposalId: string, decision: "approved" | "rejected" | "supplement-required") => {
    if (decisionBusy) return;
    if (decision !== "approved" && !advice.trim()) return onError("退回或驳回必须写明具体问题和预期结果。");
    if (selected?.status !== "pending-acceptance" && decision !== "approved" && feedbackTarget === "submitter-capability" && !capabilityScope.trim()) return onError("请写明需要升级的提交能力范围。");
    setDecisionBusy(true); setDecisionError(null);
    try {
      const next = selected?.status === "pending-acceptance"
        ? await window.desktop?.decideEvolutionResult(proposalId, { mutation: evolutionMutationRequest(state), decision, advice })
        : await window.desktop?.decideEvolutionProposal(proposalId, { mutation: evolutionMutationRequest(state), decision, advice, feedbackTarget, capabilityScope });
      if (next) onState(next);
      setAdvice(""); setFeedbackTarget("proposal-content"); setCapabilityScope("");
    } catch (error) { const message = readableError(error, "演化审批操作失败。"); setDecisionError(message); onError(message); }
    finally { setDecisionBusy(false); }
  };
  const latest = selected?.approvals.at(-1);
  const archivedPlan = selected ? latestAcceptancePlan(state, selected.proposalId) : null;
  const acceptancePlan = generatedPlan?.proposalId === selected?.proposalId ? generatedPlan : archivedPlan;
  const archivedRun = acceptancePlan ? latestAcceptanceRun(state, acceptancePlan.planId) : null;
  const acceptanceRun = generatedRun?.planId === acceptancePlan?.planId ? generatedRun : archivedRun;
  const generatePlan = async () => {
    if (!selected || planBusy) return;
    setPlanBusy(true);
    try { setGeneratedPlan(await window.desktop!.generateHanLiAcceptancePlan(selected.proposalId)); }
    catch (error) { onError(readableError(error, "韩立验收计划生成失败。")); }
    finally { setPlanBusy(false); }
  };
  const executePlan = async () => {
    if (!acceptancePlan || runBusy) return;
    setRunBusy(true);
    try { setGeneratedRun(await window.desktop!.executeHanLiAcceptancePlan(acceptancePlan.planId)); }
    catch (error) { onError(readableError(error, "韩立真实应用检查失败。")); }
    finally { setRunBusy(false); }
  };
  const canDecide = Boolean(selected && (["pending-approval", "supplement-required", "pending-acceptance"].includes(selected.status) || (latest?.source === "automatic-han-li" && selected.distributedTaskIds.length === 0)));
  return <aside className={`person-workspace-rail hanli-evolution-approval view-${view}`} aria-label="韩立统一演化审批">
    <header><div><span>审批工作台</span><h2>统一审批治理</h2><p>统一查看审批事实，方向、方案评审和命令授权仍保持各自边界。</p></div><strong>{proposals.length}</strong></header>
    <section className="person-rail-section hanli-automation-control"><h3>自动审批</h3><div className="nangong-automation-switches"><button type="button" role="switch" className="selswitch" aria-checked={state.automaticNangongApprovalEnabled} onClick={() => void update(() => window.desktop?.setEvolutionAutomationEnabled("nangong-approval", !state.automaticNangongApprovalEnabled))}><span>南宫婉提案</span><i className="selswitch-track" aria-hidden="true"><i className="selswitch-thumb" /></i></button><button type="button" role="switch" className="selswitch" aria-checked={state.automaticLinghuApprovalEnabled} onClick={() => void update(() => window.desktop?.setEvolutionAutomationEnabled("linghu-approval", !state.automaticLinghuApprovalEnabled))}><span>令狐修正</span><i className="selswitch-track" aria-hidden="true"><i className="selswitch-thumb" /></i></button></div></section>
    {!databaseManaged && <section className="person-rail-section approval-grid-section"><div className="person-rail-heading"><h3>审批列表</h3><span>{proposals.length}</span></div><EvolutionProposalGrid id="hanli-evolution-approvals" proposals={proposals} selectedId={selected?.proposalId || null} locale={locale} mode="approval" onSelect={setSelectedId} /></section>}
    {selected && <EvolutionProposalDetail proposal={selected}>{selected.status === "pending-acceptance" && <section className="hanli-acceptance-plan" aria-label="韩立真实界面验收计划"><header><div><strong>真实界面验收计划</strong><span>依据专题事实、用户关注点和已验证经验生成</span></div><nav><button type="button" disabled={planBusy || runBusy || decisionBusy} onClick={() => void generatePlan()}>{planBusy ? "韩立正在分析…" : acceptancePlan ? "重新生成计划" : "生成验收计划"}</button>{acceptancePlan && <button type="button" className="primary" disabled={planBusy || runBusy || decisionBusy} onClick={() => void executePlan()}>{runBusy ? "正在检查真实应用…" : "执行真实应用检查"}</button>}</nav></header>{acceptancePlan ? <><p>{acceptancePlan.summary}</p><p><strong>关注点：</strong>{acceptancePlan.concerns.join("、")}</p><ol>{acceptancePlan.checks.map((check) => <li key={check.checkId}><strong>{check.category} · {check.target}</strong><p>操作：{check.action}</p><p>预期：{check.expected}</p><small>证据：{check.evidenceRequired} · {check.operations.length} 个受控操作</small></li>)}</ol>{acceptanceRun && <section className="hanli-acceptance-run" aria-label="韩立真实应用检查结果"><header><strong>真实检查结果</strong><span>{acceptanceRun.status === "passed" ? "已通过" : acceptanceRun.status === "blocked" ? "已阻止" : "发现问题"}</span></header><p>{acceptanceRun.windowTitle} · {acceptanceRun.stepResults.length} 步 · {acceptanceRun.evidenceAttachmentIds.length} 份截图证据</p><ol>{acceptanceRun.stepResults.map((step) => <li key={`${step.checkId}-${step.operationIndex}`}><strong>{step.status === "passed" ? "通过" : step.status === "blocked" ? "阻止" : "失败"}</strong><span>{step.actual}</span></li>)}</ol></section>}</> : <p>尚未生成。计划只定义待执行检查，不代表已经打开应用或验收通过。</p>}</section>}{canDecide && <div className="selform-root"><label>{selected.status === "pending-acceptance" ? "验收意见" : "审批建议"}<textarea aria-label="审批建议" placeholder="写明检查位置、实际操作、发现的问题和预期结果" value={advice} onChange={(event) => setAdvice(event.currentTarget.value)} /></label>{selected.status !== "pending-acceptance" && <label><input type="checkbox" checked={feedbackTarget === "submitter-capability"} onChange={(event) => setFeedbackTarget(event.currentTarget.checked ? "submitter-capability" : "proposal-content")} />同时升级{selected.submitterDisplayName}自身的提交与调查能力</label>}{selected.status !== "pending-acceptance" && feedbackTarget === "submitter-capability" && <label>能力升级范围<input aria-label="自身能力升级范围" placeholder="例如：提案具体性、事实调查、预期结果表达" value={capabilityScope} onChange={(event) => setCapabilityScope(event.currentTarget.value)} /></label>}{selected.status === "pending-acceptance" && acceptanceRun?.status !== "passed" && <p>真实应用检查全部通过后才能验收通过；发现的问题可携带检查步骤和截图返还{selected.submitterDisplayName}继续纠偏。</p>}{decisionError && <p role="alert">{decisionError}</p>}<nav><button type="button" className="primary" disabled={decisionBusy || planBusy || runBusy || (selected.status === "pending-acceptance" && acceptanceRun?.status !== "passed")} onClick={() => void decide(selected.proposalId, "approved")}>{selected.status === "pending-acceptance" ? "验收通过" : "通过"}</button><button type="button" disabled={decisionBusy || planBusy || runBusy} onClick={() => void decide(selected.proposalId, "supplement-required")}>{selected.status === "pending-acceptance" ? "继续纠偏" : "退回补充"}</button><button type="button" className="danger" disabled={decisionBusy || planBusy || runBusy} onClick={() => void decide(selected.proposalId, "rejected")}>驳回</button></nav></div>}{["pending-approval", "supplement-required"].includes(selected.status) && <button type="button" disabled={decisionBusy} onClick={() => void update(() => window.desktop?.autoApproveEvolutionProposal(selected.proposalId, evolutionMutationRequest(state)))}>韩立立即审批</button>}{selected.status === "approved" && <button type="button" className="primary" disabled={decisionBusy} onClick={() => void update(() => window.desktop?.dispatchEvolutionProposal(selected.proposalId, evolutionMutationRequest(state)))}>返还{selected.submitterDisplayName}并执行</button>}</EvolutionProposalDetail>}
    <section className="person-rail-section approval-governance-history"><div className="person-rail-heading"><h3>统一审批轨迹</h3><span>{governance.length}</span></div>{governance.length ? governance.slice(0, 12).map((record) => <article key={record.governanceId}><header><strong>{record.title}</strong><span>{record.decision}</span></header><small>{record.domain} · {record.approverDisplayName} · {new Date(record.decidedAt).toLocaleString()}</small>{record.reason && <p>{record.reason}</p>}</article>) : <p>数据库可用后，这里汇总演化审批、协作评审和 Codex 命令授权。</p>}</section>
  </aside>;
}

function readableError(error: unknown, fallback: string): string { return (error instanceof Error ? error.message : fallback).replace(/^Error invoking remote method '[^']+':\s*/, ""); }

function latestAcceptancePlan(state: EvolutionStateOutDto, proposalId: string): HanliAcceptancePlanOutDto | null {
  const payload = [...state.archiveRecords].reverse().find((record) => record.proposalId === proposalId && record.eventType === "acceptance.plan_generated")?.payload.acceptancePlan;
  if (!payload || typeof payload !== "object") return null;
  const plan = payload as Partial<HanliAcceptancePlanOutDto>;
  return plan.version === 1 && plan.proposalId === proposalId && Array.isArray(plan.concerns) && Array.isArray(plan.checks) ? plan as HanliAcceptancePlanOutDto : null;
}

function latestAcceptanceRun(state: EvolutionStateOutDto, planId: string): HanliAcceptanceRunOutDto | null {
  const payload = [...state.archiveRecords].reverse().find((record) => record.eventType === "acceptance.real_app_checked" && (record.payload.acceptanceRun as { planId?: string } | undefined)?.planId === planId)?.payload.acceptanceRun;
  if (!payload || typeof payload !== "object") return null;
  const run = payload as Partial<HanliAcceptanceRunOutDto>;
  return run.version === 1 && run.planId === planId && Array.isArray(run.stepResults) && Array.isArray(run.evidenceAttachmentIds) ? run as HanliAcceptanceRunOutDto : null;
}
