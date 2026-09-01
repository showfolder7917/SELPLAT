import { useEffect, useMemo, useRef, useState } from "react";

import type {
  CollaborationMemberOutDto,
  EvolutionWorkbenchRowOutDto,
  EvolutionWorkbenchViewValue,
  EvolutionWorkspaceLocationOutDto,
  LocaleValue,
  EvolutionStateOutDto,
  WorkspaceStateOutDto,
} from "../../../../contracts/system/desktop/desktop";
import { EvolutionDatabaseGrid } from "./EvolutionDatabaseGrid";
import { HanLiEvolutionApprovalPanel } from "../../hanli";
import { NangongEvolutionRail, type EvolutionWorkspaceFlowNode } from "../../nangong";
import { EvolutionTreeNavigation } from "./EvolutionTreeNavigation";
import { EvolutionTopicGroupView } from "./EvolutionTopicGroupView";
import { evolutionOwnerForStatus, evolutionStatusLabel, workbenchOwnerLabel } from "../model/evolution-workbench";
import { defaultEvolutionWorkspaceLocation } from "../model/evolution-workbench";

type EvolutionWorkspaceModule = "people" | "evolution" | "audit";
type EvolutionWorkspaceView = "manual" | "automatic";
type EvolutionWorkspaceTreeNode = EvolutionWorkspaceModule | EvolutionWorkspaceFlowNode;
const EVOLUTION_WORKSPACE_NODE_IDS = new Set<EvolutionWorkspaceTreeNode>(["people", "evolution", "audit", "manual", "manual-topic", "manual-group", "manual-research", "manual-approval", "manual-proposal", "manual-release", "manual-archive", "automatic", "automatic-console", "automatic-topic", "automatic-queue", "automatic-switches", "automatic-exception", "automatic-recovery", "automatic-history", "people-nangong", "people-hanli", "audit-todo", "audit-approval", "audit-exception", "audit-archive"]);
const DEFAULT_EXPANDED_NODES = ["evolution", "manual", "automatic"];

function evolutionWorkbenchForNode(node: EvolutionWorkspaceFlowNode): { view: EvolutionWorkbenchViewValue; title: string } | null {
  return ({
    "manual-topic": { view: "topics", title: "当前专题" },
    "manual-research": { view: "deliberations", title: "调查与研讨" },
    "manual-approval": { view: "pending-approvals", title: "审批与待办" },
    "manual-proposal": { view: "proposals", title: "提案与任务" },
    "manual-release": { view: "releases", title: "发布与验收" },
    "manual-archive": { view: "archives", title: "原始档案" },
    "automatic-console": { view: "automation-runs", title: "运行总览" },
    "automatic-topic": { view: "topics", title: "自动控制台当前专题" },
    "automatic-queue": { view: "tasks", title: "等待队列" },
    "automatic-exception": { view: "exceptions", title: "异常与令狐修正" },
    "automatic-recovery": { view: "recovery", title: "纠偏与恢复" },
    "automatic-history": { view: "automation-runs", title: "自动运行历史" },
    "audit-todo": { view: "pending-approvals", title: "待办中心" },
    "audit-approval": { view: "approvals", title: "审批事实" },
    "audit-exception": { view: "exceptions", title: "异常与卡点" },
    "audit-archive": { view: "archives", title: "专题档案" },
  } as Partial<Record<EvolutionWorkspaceFlowNode, { view: EvolutionWorkbenchViewValue; title: string }>>)[node] || null;
}

/** 南宫婉与韩立共用一棵完整业务树；父节点展示总览，叶节点直接路由右侧页面。 */
export function EvolutionControlWorkspace({ perspective, requestedLocation, onLocationChange, member, state, workspaces, locale, onState, onError }: { perspective: "nangong" | "hanli"; requestedLocation: EvolutionWorkspaceLocationOutDto; onLocationChange(location: EvolutionWorkspaceLocationOutDto): void; member?: CollaborationMemberOutDto; state: EvolutionStateOutDto; workspaces: WorkspaceStateOutDto | null; locale: LocaleValue; onState(state: EvolutionStateOutDto): void; onError(message: string): void }) {
  const [selectedNode, setSelectedNode] = useState<EvolutionWorkspaceTreeNode>(perspective === "hanli" ? "manual-approval" : "manual-topic");
  const [workspacePreferenceReady, setWorkspacePreferenceReady] = useState(false);
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>(DEFAULT_EXPANDED_NODES);
  const workspacePreferencePerspectiveRef = useRef<"nangong" | "hanli" | null>(null);
  const [databaseSelection, setDatabaseSelection] = useState<EvolutionWorkbenchRowOutDto | null>(null);
  const canvasRef = useRef<HTMLElement>(null);
  const module: EvolutionWorkspaceModule = selectedNode === "people" || selectedNode.startsWith("people-")
    ? "people"
    : selectedNode === "audit" || selectedNode.startsWith("audit-")
      ? "audit"
      : "evolution";
  const flowNode = selectedNode as EvolutionWorkspaceFlowNode;
  const view: EvolutionWorkspaceView = flowNode === "automatic" || flowNode.startsWith("automatic-") ? "automatic" : "manual";
  const pendingCount = state.proposals.filter((proposal) => ["pending-approval", "supplement-required", "pending-acceptance"].includes(proposal.status)).length;
  const activeTopic = state.topics.find((topic) => topic.topicId === state.activeTopicId) || state.topics.at(-1) || null;
  const activeTopicGroupCount = activeTopic ? state.archiveRecords.filter((record) => record.topicId === activeTopic.topicId || (activeTopic.deliberationId && record.deliberationId === activeTopic.deliberationId)).length : 0;
  const treeItems = useMemo(() => [
    { id: "people", label: "人物与个性", icon: "ri-user-settings-line", count: 2, expanded: expandedNodeIds.includes("people"), children: [
      { id: "people-nangong", label: "南宫婉", icon: "ri-user-heart-line", count: 1 },
      { id: "people-hanli", label: "韩立", icon: "ri-user-star-line", count: 1 },
    ] },
    { id: "evolution", label: "专题演化", icon: "ri-git-merge-line", count: state.topics.length, expanded: expandedNodeIds.includes("evolution"), children: [
      { id: "manual", label: "人工工作区", icon: "ri-hand", count: state.proposals.length, expanded: expandedNodeIds.includes("manual"), children: [
        { id: "manual-topic", label: "当前专题", icon: "ri-focus-3-line", count: state.activeTopicId ? 1 : 0 },
        { id: "manual-group", label: "专题协作群", icon: "ri-discuss-line", count: activeTopicGroupCount },
        { id: "manual-research", label: "调查与研讨", icon: "ri-search-eye-line", count: state.deliberations.length },
        { id: "manual-approval", label: "韩立审批", icon: "ri-stamp-line", count: pendingCount },
        { id: "manual-proposal", label: "提案与任务", icon: "ri-file-list-3-line", count: state.proposals.length },
        { id: "manual-release", label: "发布与验收", icon: "ri-rocket-line", count: state.proposals.filter((proposal) => ["verifying", "pending-acceptance", "completed"].includes(proposal.status)).length },
        { id: "manual-archive", label: "原始档案", icon: "ri-archive-line", count: state.topics.length },
      ] },
      { id: "automatic", label: "自动控制台", icon: "ri-dashboard-3-line", count: state.automationRuntime.status === "idle" ? 0 : 1, expanded: expandedNodeIds.includes("automatic"), children: [
        { id: "automatic-console", label: "运行总览", icon: "ri-play-circle-line", count: 1 },
        { id: "automatic-topic", label: "当前专题", icon: "ri-focus-3-line", count: state.activeTopicId ? 1 : 0 },
        { id: "automatic-queue", label: "等待队列", icon: "ri-list-check-3", count: state.proposals.filter((proposal) => ["approved", "executing", "verifying"].includes(proposal.status)).length },
        { id: "automatic-switches", label: "审批与分发开关", icon: "ri-toggle-line", count: 4 },
        { id: "automatic-exception", label: "异常与令狐修正", icon: "ri-bug-line", count: state.proposals.filter((proposal) => ["blocked", "test-failed", "failed"].includes(proposal.status)).length },
        { id: "automatic-recovery", label: "纠偏与恢复", icon: "ri-restart-line", count: state.automationRuntime.correctionRounds },
        { id: "automatic-history", label: "自动运行历史", icon: "ri-history-line", count: state.topics.length },
      ] },
    ] },
    { id: "audit", label: "审计与异常", icon: "ri-shield-check-line", count: pendingCount, expanded: expandedNodeIds.includes("audit"), children: [
      { id: "audit-todo", label: "待办中心", icon: "ri-task-line", count: pendingCount },
      { id: "audit-approval", label: "审批轨迹", icon: "ri-file-shield-2-line", count: state.proposals.length },
      { id: "audit-exception", label: "异常入口", icon: "ri-alarm-warning-line", count: pendingCount },
      { id: "audit-archive", label: "专题档案", icon: "ri-history-line", count: state.topics.length },
    ] },
  ], [activeTopicGroupCount, expandedNodeIds, pendingCount, state.activeTopicId, state.automationRuntime.correctionRounds, state.automationRuntime.status, state.deliberations.length, state.proposals.length, state.topics.length]);
  useEffect(() => {
    // 只在人物视角真正切换时加载一次偏好。树内导航更新地址时不得重新进入加载态，否则连续点击会被静默丢弃。
    let active = true;
    workspacePreferencePerspectiveRef.current = null;
    setWorkspacePreferenceReady(false);
    void Promise.all([window.desktop?.getEvolutionWorkbenchPreference(perspective, "__workspace__"), window.desktop?.getEvolutionWorkbenchPreference(perspective, "__tree__")]).then(([preference, treePreference]) => {
      if (!active) return;
      const requestedNode = requestedLocation.perspective === perspective ? requestedLocation.nodeId as EvolutionWorkspaceTreeNode | null : null;
      const savedNode = preference?.selectedRowId as EvolutionWorkspaceTreeNode | null;
      setSelectedNode(requestedNode && EVOLUTION_WORKSPACE_NODE_IDS.has(requestedNode) ? requestedNode : savedNode && EVOLUTION_WORKSPACE_NODE_IDS.has(savedNode) ? savedNode : perspective === "hanli" ? "manual-approval" : "manual-topic");
      const savedExpanded = treePreference?.keyword.split("|").filter(Boolean) || [];
      setExpandedNodeIds(treePreference ? savedExpanded : DEFAULT_EXPANDED_NODES);
      workspacePreferencePerspectiveRef.current = perspective;
      setWorkspacePreferenceReady(true);
    }).catch(() => { if (active) { setSelectedNode(perspective === "hanli" ? "manual-approval" : "manual-topic"); setExpandedNodeIds(DEFAULT_EXPANDED_NODES); workspacePreferencePerspectiveRef.current = perspective; setWorkspacePreferenceReady(true); } });
    return () => { active = false; };
  }, [perspective]);
  useEffect(() => {
    if (!workspacePreferenceReady || requestedLocation.perspective !== perspective) return;
    const requestedNode = requestedLocation.nodeId as EvolutionWorkspaceTreeNode | null;
    if (requestedNode && EVOLUTION_WORKSPACE_NODE_IDS.has(requestedNode)) setSelectedNode(requestedNode);
  }, [perspective, requestedLocation.nodeId, requestedLocation.perspective, workspacePreferenceReady]);
  useEffect(() => {
    if (!workspacePreferenceReady || workspacePreferencePerspectiveRef.current !== perspective) return;
    void window.desktop?.saveEvolutionWorkbenchPreference({ perspective, nodeId: "__workspace__", page: 1, pageSize: 20, keyword: "", status: "", selectedRowId: selectedNode }).catch(() => undefined);
  }, [perspective, selectedNode, workspacePreferenceReady]);
  useEffect(() => { setDatabaseSelection(null); canvasRef.current?.scrollTo({ top: 0, left: 0 }); }, [selectedNode]);
  const showHanLiPanel = module === "evolution" && (flowNode === "manual-approval" || (perspective === "hanli" && (flowNode === "manual" || flowNode === "automatic")));
  const databasePage = evolutionWorkbenchForNode(flowNode);
  const navigateToFlowNode = (node: EvolutionWorkspaceFlowNode, selectedRowId: string | null = null) => {
    if (!workspacePreferenceReady) return;
    setSelectedNode(node);
    onLocationChange({ ...defaultEvolutionWorkspaceLocation(perspective, node), selectedRowId });
  };
  return <aside className="evolution-control-workspace" aria-label="专项演化统一工作台" aria-busy={!workspacePreferenceReady} data-preference-ready={workspacePreferenceReady} data-preference-perspective={workspacePreferencePerspectiveRef.current || ""}>
    <header className="evolution-workspace-header"><div><span>专项演化</span><h2>{perspective === "hanli" ? "韩立审批与演化工作台" : "南宫婉专题演化工作台"}</h2><p>模块、流程、表格、表单和动作各守其位；人工操作与自动运行互不混排。</p></div><strong>{evolutionStatusLabel(state.automationRuntime.status)}</strong></header>
    <div className="evolution-workspace-layout">
      <section className="evolution-tree-column"><h3>功能与流程</h3><aside className="evolution-tree-live-status" aria-label="当前专题状态">{activeTopic ? <><span>{evolutionStatusLabel(activeTopic.status)}</span><strong>{activeTopic.title}</strong><small>负责人：{workbenchOwnerLabel(evolutionOwnerForStatus(activeTopic.status, activeTopic.origin))}</small><small>{activeTopic.status === "blocked" ? `卡点：${state.automationRuntime.stopReason || "等待检查"}` : `恢复点：${activeTopic.recoveryPoint}`}</small></> : <><span>当前空闲</span><strong>尚未建立专题</strong><small>从“调查与研讨”或“人工登记”开始</small></>}</aside><EvolutionTreeNavigation id={`evolution-navigation-${perspective}`} label="功能与流程" selectedId={selectedNode} items={treeItems} onSelect={(id) => { if (workspacePreferenceReady) { const node = id as EvolutionWorkspaceTreeNode; setSelectedNode(node); onLocationChange(defaultEvolutionWorkspaceLocation(perspective, node)); } }} onExpandedChange={(ids) => { if (!workspacePreferenceReady) return; setExpandedNodeIds(ids); void window.desktop?.saveEvolutionWorkbenchPreference({ perspective, nodeId: "__tree__", page: 1, pageSize: 20, keyword: ids.join("|"), status: "", selectedRowId: null }).catch(() => undefined); }} /></section>
      <main ref={canvasRef} className="evolution-workspace-canvas" data-active-flow={flowNode}>
        {(selectedNode === "people" || selectedNode === "evolution" || selectedNode === "audit") && <EvolutionModuleOverview module={module} state={state} pendingCount={pendingCount} />}
        {flowNode === "manual-group" && <EvolutionTopicGroupView topic={activeTopic} stateVersion={state.updatedAt} perspective={perspective} locale={locale} workspaces={workspaces} onNavigate={navigateToFlowNode} onState={onState} onError={onError} />}
        {databasePage && <EvolutionDatabaseGrid id={`evolution-${perspective}-${flowNode}`} title={databasePage.title} view={databasePage.view} perspective={perspective} nodeId={flowNode} requestedLocation={requestedLocation.nodeId === flowNode ? requestedLocation : null} onLocationChange={onLocationChange} locale={locale} onError={onError} onSelectRow={setDatabaseSelection} />}
        {module === "evolution" && selectedNode !== "evolution" && flowNode !== "manual-group" && !showHanLiPanel && member && (!databasePage || ["manual-topic", "manual-research", "manual-proposal", "manual-release", "manual-archive", "automatic-console", "automatic-recovery"].includes(flowNode)) && <NangongEvolutionRail activeNode={flowNode} member={member} state={state} workspaces={workspaces} locale={locale} selectedProposalId={databaseSelection?.proposalId || null} databaseManaged={Boolean(databasePage && ["manual-proposal", "manual-release"].includes(flowNode))} onState={onState} onError={onError} />}
        {showHanLiPanel && <HanLiEvolutionApprovalPanel state={state} locale={locale} view={view} selectedProposalId={flowNode === "manual-approval" ? databaseSelection?.proposalId || null : null} databaseManaged={flowNode === "manual-approval"} onState={onState} onError={onError} />}
        {module === "people" && selectedNode !== "people" && <EvolutionPeopleSummary selectedNode={flowNode} />}
      </main>
    </div>
  </aside>;
}

/** 单树一级节点拥有自己的右侧总览，点击父节点同样产生可核对的页面切换。 */
function EvolutionModuleOverview({ module, state, pendingCount }: { module: EvolutionWorkspaceModule; state: EvolutionStateOutDto; pendingCount: number }) {
  const content = module === "people"
    ? { eyebrow: "人物与个性", title: "人物目录", detail: "查看南宫婉与韩立在专题演化中的职责和协作边界。", facts: [["人物", "2 位"], ["专题", `${state.topics.length} 项`]] }
    : module === "audit"
      ? { eyebrow: "审计与异常", title: "治理总览", detail: "集中查看审批事实、当前异常和专题档案。", facts: [["待处理审批", `${pendingCount} 项`], ["档案", `${state.archiveRecords.length} 条`]] }
      : { eyebrow: "专题演化", title: "演化流程总览", detail: "人工工作区与自动控制台共用同一棵导航树，具体页面在右侧展开。", facts: [["专题", `${state.topics.length} 项`], ["提案", `${state.proposals.length} 项`], ["自动运行", evolutionStatusLabel(state.automationRuntime.status)]] };
  return <section className="evolution-module-summary" aria-label={`${content.title}页面`}><span>{content.eyebrow}</span><h2>{content.title}</h2><p>{content.detail}</p><dl>{content.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>;
}

/** 人物目录按当前树节点展示对应职责，不能继续沿用窗口入口人物造成两个按钮同页。 */
function EvolutionPeopleSummary({ selectedNode }: { selectedNode: EvolutionWorkspaceFlowNode }) {
  const hanliSelected = selectedNode === "people-hanli";
  return <section className="evolution-module-summary" aria-label={hanliSelected ? "韩立人物设置" : "南宫婉人物设置"}><span>人物与个性</span><h2>{hanliSelected ? "韩立" : "南宫婉"}</h2><p>人物职责、说话模式、调查习惯和审批偏好在这里独立扩展。新增人物设置时只增加树节点与表单，不挤占专题流程。</p><dl><div><dt>当前职责</dt><dd>{hanliSelected ? "依据事实审批，学习用户审批习惯，控制提案返还与执行。" : "理解用户意图，充分调查，形成提案，收集本轮成果。"}</dd></div><div><dt>协作边界</dt><dd>人物配置与专题运行分开保存、分开操作。</dd></div></dl></section>;
}

/** 南宫婉右栏集中课题、自动化和提案进度，不再挤压连续对话。 */
