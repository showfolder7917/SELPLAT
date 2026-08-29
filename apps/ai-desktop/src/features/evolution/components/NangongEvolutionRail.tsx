import { useEffect, useRef, useState } from "react";

import type {
  CollaborationMember,
  EvolutionTopicDossier,
  Locale,
  NangongEvolutionState,
  WorkspaceState,
} from "../../../../contracts/desktop/desktop";
import { EvolutionProposalDetail } from "./EvolutionProposalDetail";
import { EvolutionProposalGrid } from "./EvolutionProposalGrid";
import { EvolutionTopicDossierView } from "./EvolutionTopicDossierView";
import { MemberSelfUpgradePanel } from "./EvolutionRevisionPanels";
import { evolutionMutationRequest, evolutionStatusLabel } from "../model/evolution-workbench";

export type EvolutionWorkspaceFlowNode = "manual" | "manual-topic" | "manual-group" | "manual-research" | "manual-approval" | "manual-proposal" | "manual-release" | "manual-archive" | "automatic" | "automatic-console" | "automatic-topic" | "automatic-queue" | "automatic-switches" | "automatic-exception" | "automatic-recovery" | "automatic-history" | "people-nangong" | "people-hanli" | "audit-todo" | "audit-approval" | "audit-exception" | "audit-archive";

export function NangongEvolutionRail({ activeNode, member, state, workspaces, locale, selectedProposalId, databaseManaged, onState, onError }: { activeNode: EvolutionWorkspaceFlowNode; member: CollaborationMember; state: NangongEvolutionState; workspaces: WorkspaceState | null; locale: Locale; selectedProposalId: string | null; databaseManaged: boolean; onState(state: NangongEvolutionState): void; onError(message: string): void }) {
  const nangongTopics = state.topics.filter((item) => item.origin === "nangong");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(state.activeTopicId);
  const topic = nangongTopics.find((item) => item.topicId === selectedTopicId) || nangongTopics.find((item) => item.topicId === state.activeTopicId) || nangongTopics.at(-1) || null;
  const proposals = state.proposals.filter((item) => item.origin === "nangong").sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const [selectedId, setSelectedId] = useState<string | null>(proposals[0]?.proposalId || null);
  useEffect(() => { if (databaseManaged) setSelectedId(selectedProposalId); }, [databaseManaged, selectedProposalId]);
  const [topicEditorOpen, setTopicEditorOpen] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [proposalEditorOpen, setProposalEditorOpen] = useState(false);
  const [topicDraft, setTopicDraft] = useState({ title: "", goal: "", scope: "", exclusions: "", evidence: "", acceptanceCriteria: "" });
  const [proposalDraft, setProposalDraft] = useState({ content: "", risks: "", rollbackPlan: "" });
  const [automationDraft, setAutomationDraft] = useState({ maxRounds: state.automationSettings.maxRoundsPerTopic === null ? "" : String(state.automationSettings.maxRoundsPerTopic), maxCorrections: String(state.automationSettings.maxCorrectionRounds) });
  const [dossier, setDossier] = useState<EvolutionTopicDossier | null>(null);
  const [operationBusy, setOperationBusy] = useState(false);
  const [handoverAcknowledged, setHandoverAcknowledged] = useState(false);
  const operationBusyRef = useRef(false);
  const updateTopicDraft = (field: keyof typeof topicDraft, value: string) => setTopicDraft((current) => ({ ...current, [field]: value }));
  const updateProposalDraft = (field: keyof typeof proposalDraft, value: string) => setProposalDraft((current) => ({ ...current, [field]: value }));
  const activeDeliberation = [...state.deliberations].reverse().find((item) => ["questioning", "ready-to-establish", "blocked"].includes(item.status)) || null;
  const showAllManual = activeNode === "manual";
  const showAllAutomatic = activeNode === "automatic";
  const showTopic = showAllManual || activeNode === "manual-topic";
  const showResearch = showAllManual || activeNode === "manual-research";
  const showProposal = showAllManual || activeNode === "manual-proposal";
  const showRelease = showAllManual || activeNode === "manual-release";
  const showArchive = showAllManual || activeNode === "manual-archive";
  const showConsole = showAllAutomatic || activeNode === "automatic-console";
  const showSwitches = showAllAutomatic || activeNode === "automatic-switches";
  const showRecovery = showAllAutomatic || activeNode === "automatic-recovery";
  const visibleProposals = activeNode === "manual-release" ? proposals.filter((proposal) => ["verifying", "pending-acceptance", "completed"].includes(proposal.status)) : proposals;
  const selectedVisibleProposal = visibleProposals.find((proposal) => proposal.proposalId === selectedId) || (databaseManaged ? null : visibleProposals[0]) || null;
  const pageTitle = activeNode === "manual-research" ? "调查与研讨" : activeNode === "manual-proposal" ? "提案与任务" : activeNode === "manual-release" ? "发布与验收" : activeNode === "manual-archive" ? "原始档案" : activeNode === "automatic-console" ? "运行总览" : activeNode === "automatic-switches" ? "审批与分发开关" : activeNode === "automatic-recovery" ? "纠偏与恢复" : "专题池与全流程档案";
  useEffect(() => {
    if (!topic) { setDossier(null); return; }
    let active = true;
    void window.desktop?.getEvolutionTopicDossier(topic.topicId).then((value) => { if (active) setDossier(value); }).catch((error) => { if (active) onError(readableError(error, "无法读取专题全流程档案。")); });
    return () => { active = false; };
  }, [topic?.topicId, state.updatedAt]);
  const update = async (operation: () => Promise<NangongEvolutionState> | undefined): Promise<boolean> => {
    if (operationBusyRef.current) return false;
    operationBusyRef.current = true;
    setOperationBusy(true);
    try { const pending = operation(); if (!pending) return false; onState(await pending); return true; } catch (error) { onError(readableError(error, "专项演化操作失败。")); return false; }
    finally { operationBusyRef.current = false; setOperationBusy(false); }
  };
  const createTopic = async () => {
    if (!workspaces) return onError("专项课题缺少已登记工作区。");
    const title = topicDraft.title.trim();
    const goal = topicDraft.goal.trim();
    const scope = splitList(topicDraft.scope);
    const evidence = splitList(topicDraft.evidence);
    const acceptanceCriteria = splitList(topicDraft.acceptanceCriteria);
    if (!goal || !scope.length || !evidence.length || !acceptanceCriteria.length) return onError("目标、范围、证据和验收条件必须完整填写。");
    if (!title) return onError("课题标题不能为空。");
    await update(() => window.desktop?.createEvolutionTopic({ title, goal, scope, exclusions: splitList(topicDraft.exclusions), evidence, acceptanceCriteria, workspaceState: workspaces, locale }));
    setTopicDraft({ title: "", goal: "", scope: "", exclusions: "", evidence: "", acceptanceCriteria: "" });
    setTopicEditorOpen(false);
  };
  const startEditingTopic = (target: NonNullable<typeof topic>) => {
    setSelectedTopicId(target.topicId);
    setEditingTopicId(target.topicId);
    setTopicDraft({ title: target.title, goal: target.goal, scope: target.scope.join("，"), exclusions: target.exclusions.join("，"), evidence: target.evidence.join("，"), acceptanceCriteria: target.acceptanceCriteria.join("，") });
  };
  const saveTopic = async () => {
    const target = nangongTopics.find((item) => item.topicId === editingTopicId);
    if (!target) return;
    const title = topicDraft.title.trim();
    const goal = topicDraft.goal.trim();
    const scope = splitList(topicDraft.scope);
    const exclusions = splitList(topicDraft.exclusions);
    const evidence = splitList(topicDraft.evidence);
    const acceptanceCriteria = splitList(topicDraft.acceptanceCriteria);
    if (!title || !goal || !scope.length || !evidence.length || !acceptanceCriteria.length) return onError("标题、目标、范围、证据和验收条件必须完整填写。");
    // 读取时的修订号随保存一起提交，避免两个界面把彼此的课题修正静默覆盖。
    await update(() => window.desktop?.updateEvolutionTopic(target.topicId, { expectedTopicRevision: target.topicRevision, title, goal, scope, exclusions, evidence, acceptanceCriteria }));
    setEditingTopicId(null);
    setTopicDraft({ title: "", goal: "", scope: "", exclusions: "", evidence: "", acceptanceCriteria: "" });
  };
  const createProposal = async () => {
    if (!topic) return;
    const content = proposalDraft.content.trim();
    const risks = splitList(proposalDraft.risks);
    const rollbackPlan = proposalDraft.rollbackPlan.trim();
    if (!content) return onError("提案详细内容不能为空。");
    if (!risks.length || !rollbackPlan) return onError("风险和回退方案必须完整填写。");
    await update(() => window.desktop?.createEvolutionProposal(topic.topicId, { type: "代码修正", content, risks, rollbackPlan }));
    setProposalDraft({ content: "", risks: "", rollbackPlan: "" });
    setProposalEditorOpen(false);
  };
  const toggle = (kind: "evolution" | "nangong-approval" | "linghu-approval" | "execution", enabled: boolean) => void update(() => window.desktop?.setNangongAutomation(kind, enabled));
  const saveAutomation = () => void update(() => window.desktop?.configureEvolutionAutomation({ maxRoundsPerTopic: automationDraft.maxRounds.trim() ? Number(automationDraft.maxRounds) : null, maxCorrectionRounds: Number(automationDraft.maxCorrections), workspaceState: workspaces || undefined, locale }));
  const controlAutomation = (action: "start" | "pause" | "resume" | "stop" | "handover") => void update(() => window.desktop?.controlEvolutionAutomation(action));
  const handoverAutomation = async () => {
    if (await update(() => window.desktop?.controlEvolutionAutomation("handover"))) setHandoverAcknowledged(true);
  };
  const startAutomation = async () => {
    if (!workspaces?.roots.length) return onError("自动演化必须先登记实施工作区。 ");
    try {
      await window.desktop?.configureEvolutionAutomation({ maxRoundsPerTopic: automationDraft.maxRounds.trim() ? Number(automationDraft.maxRounds) : null, maxCorrectionRounds: Number(automationDraft.maxCorrections), workspaceState: workspaces, locale });
      await window.desktop?.controlEvolutionAutomation(state.automationRuntime.status === "paused" ? "resume" : "start");
      const next = await window.desktop?.advanceHanLiDeliberation();
      if (next) onState(next);
    } catch (error) { onError(readableError(error, "韩立无法推进专题研讨。")); }
  };
  return <aside className="person-workspace-rail nangong-workspace-rail" aria-label={`${pageTitle}页面`}>
    <header><div><span>专项演化</span><h2>{pageTitle}</h2><p>{topic ? topic.title : activeDeliberation ? "韩立正在根据对话库逐轮向南宫婉发问。" : "韩立先研讨确立，南宫婉再登记专题池。"}</p></div>{showTopic && <button type="button" onClick={() => { setEditingTopicId(null); setTopicDraft({ title: "", goal: "", scope: "", exclusions: "", evidence: "", acceptanceCriteria: "" }); setTopicEditorOpen((current) => !current); }}>人工登记</button>}</header>
    {showTopic && topicEditorOpen && <section className="selform-root" aria-label="新建演化课题"><label>课题标题<input aria-label="新课题标题" value={topicDraft.title} onChange={(event) => updateTopicDraft("title", event.currentTarget.value)} /></label><label>课题目标<textarea aria-label="新课题目标" value={topicDraft.goal} onChange={(event) => updateTopicDraft("goal", event.currentTarget.value)} /></label><label>影响范围<input aria-label="新课题影响范围" placeholder="多项用逗号分隔" value={topicDraft.scope} onChange={(event) => updateTopicDraft("scope", event.currentTarget.value)} /></label><label>排除范围<input aria-label="新课题排除范围" placeholder="多项用逗号分隔" value={topicDraft.exclusions} onChange={(event) => updateTopicDraft("exclusions", event.currentTarget.value)} /></label><label>事实证据<input aria-label="新课题事实证据" placeholder="多项用逗号分隔" value={topicDraft.evidence} onChange={(event) => updateTopicDraft("evidence", event.currentTarget.value)} /></label><label>验收条件<input aria-label="新课题验收条件" placeholder="多项用逗号分隔" value={topicDraft.acceptanceCriteria} onChange={(event) => updateTopicDraft("acceptanceCriteria", event.currentTarget.value)} /></label><nav><button type="button" onClick={() => setTopicEditorOpen(false)}>取消</button><button type="button" className="primary" onClick={() => void createTopic()}>保存课题</button></nav></section>}
    {showConsole && <section className="person-rail-section evolution-automation-control" aria-label="运行控制页面"><div className="person-rail-heading"><h3>自动演化控制</h3><span>{handoverAcknowledged ? "人工接管" : evolutionStatusLabel(state.automationRuntime.status)}</span></div><div className="evolution-automation-settings"><label>专题研讨最大轮次<input aria-label="专题研讨最大轮次" type="number" min="1" max="100" placeholder="留空为无限" value={automationDraft.maxRounds} onChange={(event) => setAutomationDraft((current) => ({ ...current, maxRounds: event.currentTarget.value }))} /></label><label>实施纠偏上限<input aria-label="实施纠偏上限" type="number" min="1" max="20" value={automationDraft.maxCorrections} onChange={(event) => setAutomationDraft((current) => ({ ...current, maxCorrections: event.currentTarget.value }))} /></label><button type="button" disabled={operationBusy} onClick={saveAutomation}>保存配置</button></div><nav><button type="button" className="primary" disabled={operationBusy} onClick={() => { setHandoverAcknowledged(false); void startAutomation(); }}>{handoverAcknowledged || state.automationRuntime.status === "paused" ? "恢复自动并推进一轮" : "开始并推进一轮"}</button><button type="button" disabled={operationBusy} onClick={() => controlAutomation("pause")}>暂停</button><button type="button" disabled={operationBusy} onClick={() => void handoverAutomation()}>转人工接管</button><button type="button" className="danger" disabled={operationBusy} onClick={() => controlAutomation("stop")}>停止</button></nav>{(handoverAcknowledged || state.automationRuntime.stopReason) && <p role="status">{handoverAcknowledged ? "当前专题已转入人工接管，自动控制台仅观察；明确恢复后才会继续推进。" : state.automationRuntime.stopReason}</p>}</section>}
    {showSwitches && <section className="person-rail-section" aria-label="审批与分发开关页面"><div className="person-rail-heading"><h3>审批与分发开关</h3><span>4 项独立控制</span></div><div className="nangong-automation-switches">
      <button type="button" role="switch" className="selswitch" disabled={operationBusy} aria-checked={state.automaticEvolutionEnabled} onClick={() => toggle("evolution", !state.automaticEvolutionEnabled)}><span>自动发现并推进专题</span><i className="selswitch-track" aria-hidden="true"><i className="selswitch-thumb" /></i></button>
      <button type="button" role="switch" className="selswitch" disabled={operationBusy} aria-checked={state.automaticNangongApprovalEnabled} onClick={() => toggle("nangong-approval", !state.automaticNangongApprovalEnabled)}><span>南宫婉提案自动审批</span><i className="selswitch-track" aria-hidden="true"><i className="selswitch-thumb" /></i></button>
      <button type="button" role="switch" className="selswitch" disabled={operationBusy} aria-checked={state.automaticLinghuApprovalEnabled} onClick={() => toggle("linghu-approval", !state.automaticLinghuApprovalEnabled)}><span>令狐修复提案自动审批</span><i className="selswitch-track" aria-hidden="true"><i className="selswitch-thumb" /></i></button>
      <button type="button" role="switch" className="selswitch" disabled={operationBusy} aria-checked={state.automaticExecutionEnabled} onClick={() => toggle("execution", !state.automaticExecutionEnabled)}><span>审批通过后自动分发</span><i className="selswitch-track" aria-hidden="true"><i className="selswitch-thumb" /></i></button>
    </div></section>}
    {showRecovery && <section className="person-rail-section" aria-label="纠偏与恢复页面"><div className="person-rail-heading"><h3>纠偏与恢复</h3><span>{state.automationRuntime.correctionRounds}</span></div><p>{state.automationRuntime.stopReason || "当前没有需要人工处理的停止原因。"}</p><small>已完成 {state.automationRuntime.completedRounds} 个专题 · 当前实施纠偏 {state.automationRuntime.correctionRounds} 轮 · 恢复点：{topic?.recoveryPoint || "未建立"}</small></section>}
    {showResearch && activeDeliberation && <section className="person-rail-section evolution-deliberation"><div className="person-rail-heading"><h3>韩立专题研讨原记录</h3><span>{evolutionStatusLabel(activeDeliberation.status)} · {activeDeliberation.rounds.length} 轮</span></div><p>已冻结 {activeDeliberation.sourceSnapshots.length} 条南宫婉和 Codex 对话原文。</p>{activeDeliberation.rounds.map((round) => <article key={round.roundId}><strong>第 {round.roundNumber} 轮 · 韩立发问</strong><p>{round.question}</p><small>依据：{round.questionReason}</small>{round.answer && <><strong>南宫婉原回答</strong><p>{round.answer}</p></>}{round.assessment && <><strong>韩立判断</strong><p>{round.assessment}</p></>}</article>)}{activeDeliberation.status !== "blocked" && <button type="button" className="primary" onClick={() => void update(() => window.desktop?.advanceHanLiDeliberation())}>推进下一轮研讨</button>}</section>}
    {showResearch && !activeDeliberation && <section className="person-rail-section" aria-label="调查与研讨空态"><p>当前没有进行中的调查与研讨。</p></section>}
    {showTopic && nangongTopics.length > 1 && <section className="person-rail-section"><h3>已保存课题</h3><div className="evolution-topic-list">{nangongTopics.map((item) => <button key={item.topicId} type="button" className={item.topicId === topic?.topicId ? "selected" : ""} onClick={() => setSelectedTopicId(item.topicId)}>{item.title}</button>)}</div></section>}
    {showTopic && topic && <article className="evolution-topic-card"><span>{evolutionStatusLabel(topic.status)}</span><h3>{topic.title}</h3><p>{topic.goal}</p><small>专题第 {topic.roundNumber} 轮 · 课题修订：v{topic.topicRevision} · 恢复点：{topic.recoveryPoint}</small>{topic.currentProposalVersion === 0 && ["registered", "investigating"].includes(topic.status) && <><button type="button" onClick={() => startEditingTopic(topic)}>编辑课题</button><button type="button" onClick={() => { setProposalDraft((current) => ({ ...current, content: current.content || `课题：${topic.title}\n\n目标：${topic.goal}\n\n推荐方向：` })); setProposalEditorOpen((current) => !current); }}>形成新版本提案</button></>}</article>}
    {showArchive && dossier && <EvolutionTopicDossierView dossier={dossier} />}
    {showTopic && editingTopicId && <section className="selform-root" aria-label="编辑已保存课题"><label>课题标题<input aria-label="编辑课题标题" value={topicDraft.title} onChange={(event) => updateTopicDraft("title", event.currentTarget.value)} /></label><label>课题目标<textarea aria-label="编辑课题目标" value={topicDraft.goal} onChange={(event) => updateTopicDraft("goal", event.currentTarget.value)} /></label><label>影响范围<input aria-label="编辑课题影响范围" value={topicDraft.scope} onChange={(event) => updateTopicDraft("scope", event.currentTarget.value)} /></label><label>排除范围<input aria-label="编辑课题排除范围" value={topicDraft.exclusions} onChange={(event) => updateTopicDraft("exclusions", event.currentTarget.value)} /></label><label>事实证据<input aria-label="编辑课题事实证据" value={topicDraft.evidence} onChange={(event) => updateTopicDraft("evidence", event.currentTarget.value)} /></label><label>验收条件<input aria-label="编辑课题验收条件" value={topicDraft.acceptanceCriteria} onChange={(event) => updateTopicDraft("acceptanceCriteria", event.currentTarget.value)} /></label><nav><button type="button" onClick={() => setEditingTopicId(null)}>取消</button><button type="button" className="primary" onClick={() => void saveTopic()}>确认保存修改</button></nav></section>}
    {showTopic && topic && proposalEditorOpen && <section className="selform-root" aria-label="形成演化提案"><label>详细方案<textarea aria-label="提案详细方案" value={proposalDraft.content} onChange={(event) => updateProposalDraft("content", event.currentTarget.value)} /></label><label>风险<input aria-label="提案风险" placeholder="多项用逗号分隔" value={proposalDraft.risks} onChange={(event) => updateProposalDraft("risks", event.currentTarget.value)} /></label><label>回退方案<textarea aria-label="提案回退方案" value={proposalDraft.rollbackPlan} onChange={(event) => updateProposalDraft("rollbackPlan", event.currentTarget.value)} /></label><nav><button type="button" onClick={() => setProposalEditorOpen(false)}>取消</button><button type="button" className="primary" onClick={() => void createProposal()}>提交韩立审批</button></nav></section>}
    {(showProposal || showRelease) && !databaseManaged && <section className="person-rail-section proposal-progress-section"><div className="person-rail-heading"><h3>{showRelease && !showProposal ? "发布与验收记录" : "提案进度"}</h3><span>{visibleProposals.length}</span></div><EvolutionProposalGrid id={showRelease && !showProposal ? "nangong-release-progress" : "nangong-proposal-progress"} proposals={visibleProposals} selectedId={selectedVisibleProposal?.proposalId || null} locale={locale} mode="progress" onSelect={setSelectedId} /></section>}
    {(showProposal || showRelease) && selectedVisibleProposal && <EvolutionProposalDetail proposal={selectedVisibleProposal} compact>{selectedVisibleProposal.status === "approved" && <button type="button" disabled={operationBusy} onClick={() => void update(() => window.desktop?.dispatchEvolutionProposal(selectedVisibleProposal.proposalId, evolutionMutationRequest(state)))}>返还南宫婉并分发</button>}</EvolutionProposalDetail>}
    {showProposal && <MemberSelfUpgradePanel member={member} state={state} onState={onState} onError={onError} />}
  </aside>;
}

function splitList(value: string): string[] {
  return [...new Set(value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean))];
}

function readableError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/^Error invoking remote method '[^']+':\s*/, "");
}
