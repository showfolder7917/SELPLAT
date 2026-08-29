import { useEffect, useMemo, useState } from "react";

import type {
  EvolutionArchiveCategory,
  EvolutionArchiveRecord,
  EvolutionTopic,
  EvolutionTopicDossier,
  Locale,
  NangongEvolutionState,
  WorkspaceState,
} from "../../../../contracts/desktop/desktop";
import { evolutionOwnerForStatus, evolutionStatusLabel, workbenchOwnerLabel } from "../model/evolution-workbench";
import type { EvolutionWorkspaceFlowNode } from "./NangongEvolutionRail";
import { EvolutionLiveActivity } from "./EvolutionLiveActivity";

interface TopicGroupEntry {
  id: string;
  actor: string;
  category: string;
  title: string;
  summary: string;
  occurredAt: string;
  targetNode: EvolutionWorkspaceFlowNode;
  selectedRowId: string | null;
  status: string;
  nextOwner: string;
  blockingReason: string | null;
  active: boolean;
}

/**
 * 作用：把专题来源、研讨、审批、执行、测试与验收事实组织为只读执行群时间线。
 * 真实传参示例：topic=当前南宫婉专题，stateVersion=最新状态版本，perspective="nangong"。
 * 真实返回示例：返回可跳往既有审批、任务、发布和恢复页面的群卡片，不触发任何业务写动作。
 * 异常或副作用示例：SQLite 档案读取失败时显示错误并上报；组件本身不审批、不分发、不恢复任务。
 */
export function EvolutionTopicGroupView({ topic, stateVersion, oneShotRun, perspective, locale, workspaces, onNavigate, onState, onError }: {
  topic: EvolutionTopic | null;
  stateVersion: string;
  oneShotRun: NangongEvolutionState["oneShotRun"];
  perspective: "nangong" | "hanli";
  locale: Locale;
  workspaces: WorkspaceState | null;
  onState(state: NangongEvolutionState): void;
  onNavigate(nodeId: EvolutionWorkspaceFlowNode, selectedRowId: string | null): void;
  onError(message: string): void;
}) {
  const [dossier, setDossier] = useState<EvolutionTopicDossier | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [filterReady, setFilterReady] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [actorFilter, setActorFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [lastReadId, setLastReadId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [messageBusy, setMessageBusy] = useState(false);

  const preferenceNodeId = topic ? `manual-group::${topic.topicId}` : "manual-group";

  const loadDossier = async (target: EvolutionTopic) => {
    setLoading(true);
    setLoadError("");
    try {
      const value = await window.desktop?.getEvolutionTopicDossier(target.topicId);
      if (value) setDossier(value);
      setSyncMessage(`已与 SQLite 核对 · ${new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-US", { timeStyle: "medium" }).format(new Date())}`);
    } catch (error) {
      const message = readableError(error, "无法读取专题执行群记录。");
      setLoadError(message);
      onError(message);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!topic) { setDossier(null); setLoadError(""); setFilterReady(false); return; }
    let active = true;
    setFilterReady(false);
    void Promise.all([
      window.desktop?.getEvolutionTopicDossier(topic.topicId),
      window.desktop?.getEvolutionWorkbenchPreference(perspective, preferenceNodeId),
    ]).then(([value, preference]) => {
      if (!active) return;
      if (value) setDossier(value);
      setKeyword(preference?.keyword || "");
      const [savedActor = "all", savedCategory = "all"] = (preference?.status || "all|all").split("|");
      setActorFilter(savedActor || "all");
      setCategoryFilter(savedCategory || "all");
      setLastReadId(preference?.selectedRowId || null);
      setSyncMessage("已从 SQLite 恢复筛选与未读水位");
    }).catch((error: unknown) => {
      if (!active) return;
      const message = readableError(error, "无法恢复专题执行群投影。");
      setLoadError(message);
      onError(message);
    }).finally(() => { if (active) { setLoading(false); setFilterReady(true); } });
    return () => { active = false; };
  }, [topic?.topicId, perspective, preferenceNodeId, stateVersion]);

  const sourceAddresses = useMemo(() => [...new Set((dossier?.deliberation?.sourceSnapshots || []).map((message) => `${message.source === "codex" ? "Codex" : "南宫婉"} · ${message.conversationId}`))], [dossier]);
  const timeline = useMemo(() => buildTimeline(dossier), [dossier]);
  const actorOptions = useMemo(() => [...new Set(timeline.map((entry) => entry.actor))], [timeline]);
  const categoryOptions = useMemo(() => [...new Set(timeline.map((entry) => entry.category))], [timeline]);
  const visibleTimeline = useMemo(() => timeline.filter((entry) => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase();
    return (actorFilter === "all" || entry.actor === actorFilter)
      && (categoryFilter === "all" || entry.category === categoryFilter)
      && (!normalizedKeyword || `${entry.actor} ${entry.category} ${entry.title} ${entry.summary} ${entry.status} ${entry.nextOwner}`.toLocaleLowerCase().includes(normalizedKeyword));
  }), [actorFilter, categoryFilter, keyword, timeline]);
  const lastReadIndex = lastReadId ? timeline.findIndex((entry) => entry.id === lastReadId) : -1;
  const unreadCount = lastReadIndex >= 0 ? Math.max(0, timeline.length - lastReadIndex - 1) : timeline.length;
  const saveGroupPreference = async (next: { keyword?: string; actor?: string; category?: string; lastReadId?: string | null }) => {
    if (!topic || !filterReady) return;
    const nextKeyword = next.keyword ?? keyword;
    const nextActor = next.actor ?? actorFilter;
    const nextCategory = next.category ?? categoryFilter;
    const nextLastReadId = next.lastReadId === undefined ? lastReadId : next.lastReadId;
    await window.desktop?.saveEvolutionWorkbenchPreference({ perspective, nodeId: preferenceNodeId, page: 1, pageSize: 20, keyword: nextKeyword, status: `${nextActor}|${nextCategory}`, selectedRowId: nextLastReadId });
  };
  const markAllRead = () => {
    const nextLastReadId = timeline.at(-1)?.id || null;
    setLastReadId(nextLastReadId);
    void saveGroupPreference({ lastReadId: nextLastReadId }).catch((error) => onError(readableError(error, "无法保存专题群已读水位。")));
  };
  const sendGroupMessage = async () => {
    const message = messageDraft.trim();
    if (!topic || !message) return;
    if (!workspaces?.roots.length) return onError("专题群发言前必须先登记实施工作区。");
    setMessageBusy(true);
    try {
      const next = await window.desktop?.sendNangongConversationMessage({ message, topicId: topic.topicId, workspaceState: workspaces, locale });
      if (next) onState(next);
      setMessageDraft("");
      setSyncMessage("人物消息已回流专题群，正在核对 SQLite 时间线");
    } catch (error) { onError(readableError(error, "专题群人物消息发送失败。")); }
    finally { setMessageBusy(false); }
  };

  if (!topic) return <section className="person-workspace-rail evolution-topic-group" aria-label="专题协作群页面" data-perspective={perspective}><header><div><span>专题演化</span><h2>专题协作群</h2><p>南宫婉建立专题后，人物之间的 @交接、回复、执行、验证、测试与验收会集中显示在这里。</p></div><strong>当前空闲</strong></header></section>;

  return <section className="person-workspace-rail evolution-topic-group" aria-label="专题协作群页面" aria-busy={loading} data-perspective={perspective}>
    <header><div><span>专题协作群</span><h2>人物协作与实时交接</h2><p>群聊只投影现有业务事实；审批、分发、令狐验证和韩立验收仍走原流程。</p></div><strong>{evolutionStatusLabel(topic.status)}</strong></header>
    <details className="evolution-topic-group-topic" open>
      <summary><span>当前专题</span><strong>{topic.title}</strong><em>{evolutionStatusLabel(topic.status)}</em></summary>
    <section className="evolution-topic-group-summary" aria-label="专题群当前状态">
      {oneShotRun?.topicId === topic.topicId && <EvolutionLiveActivity run={oneShotRun} />}
      <dl>
        <div><dt>当前负责人</dt><dd>{workbenchOwnerLabel(evolutionOwnerForStatus(topic.status, topic.origin))}</dd></div>
        <div><dt>下一步</dt><dd>{nextStepForTopic(topic.status)}</dd></div>
        <div><dt>恢复点</dt><dd>{topic.recoveryPoint || "尚未建立"}</dd></div>
        <div><dt>群内记录</dt><dd>{timeline.length} 条</dd></div>
      </dl>
      <nav aria-label="专题群快捷入口">
        <button type="button" onClick={() => onNavigate("manual-research", topic.deliberationId)}>查看来源与研讨</button>
        <button type="button" onClick={() => onNavigate("manual-approval", dossier?.proposals.at(-1)?.proposalId || null)}>查看审批</button>
        <button type="button" onClick={() => onNavigate("manual-proposal", dossier?.proposals.at(-1)?.proposalId || null)}>查看提案与任务</button>
        <button type="button" onClick={() => onNavigate("manual-release", dossier?.proposals.at(-1)?.proposalId || null)}>查看发布与验收</button>
        {topic.status === "blocked" && <button type="button" className="primary" onClick={() => onNavigate("automatic-recovery", topic.topicId)}>交给令狐检查并恢复</button>}
        <button type="button" disabled={loading} onClick={() => void loadDossier(topic)}>重新核对数据库</button>
      </nav>
      <small role="status">{syncMessage}</small>
    </section>
    <section className="evolution-topic-group-sources" aria-label="来源会话地址">
      <div className="person-rail-heading"><h3>来源会话</h3><span>{sourceAddresses.length}</span></div>
      {sourceAddresses.length ? <ul>{sourceAddresses.map((address) => <li key={address}>{address}</li>)}</ul> : <p>当前专题没有可显示的来源会话地址。</p>}
    </section>
    <section className="evolution-topic-group-timeline" aria-label="专题协作群时间线">
      <div className="person-rail-heading"><h3>群内进展</h3><span>{unreadCount ? `${unreadCount} 未读` : "已读"}</span></div>
      <div className="selform-root evolution-topic-group-filters" aria-label="专题群筛选">
        <label>搜索<input type="search" aria-label="搜索专题群记录" value={keyword} onChange={(event) => { const value = event.currentTarget.value; setKeyword(value); void saveGroupPreference({ keyword: value }).catch(() => undefined); }} /></label>
        <label>人物<select aria-label="按人物筛选专题群" value={actorFilter} onChange={(event) => { const value = event.currentTarget.value; setActorFilter(value); void saveGroupPreference({ actor: value }).catch(() => undefined); }}><option value="all">全部人物</option>{actorOptions.map((actor) => <option key={actor} value={actor}>{actor}</option>)}</select></label>
        <label>类型<select aria-label="按类型筛选专题群" value={categoryFilter} onChange={(event) => { const value = event.currentTarget.value; setCategoryFilter(value); void saveGroupPreference({ category: value }).catch(() => undefined); }}><option value="all">全部类型</option>{categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
        <button type="button" disabled={!unreadCount} onClick={markAllRead}>全部标为已读</button>
      </div>
      {loadError && <p role="alert">{loadError}</p>}
      {!loading && !loadError && !timeline.length && <p>当前专题尚未产生群内记录。</p>}
      {!loading && !loadError && timeline.length > 0 && !visibleTimeline.length && <p>没有符合当前筛选条件的记录。</p>}
      {visibleTimeline.map((entry) => <article key={entry.id} data-active={entry.active} data-unread={lastReadIndex < timeline.findIndex((candidate) => candidate.id === entry.id)}>
        <header><div><span>{entry.actor} · {entry.category}</span><strong>{entry.actor} <b>@{entry.nextOwner}</b> · {entry.title}</strong></div><time>{formatTime(entry.occurredAt, locale)}</time></header>
        <div className="evolution-topic-group-message"><p>{entry.summary}</p>{entry.active && <i>正在处理…</i>}</div>
        <details><summary>查看状态与完整报告</summary><dl><div><dt>当前状态</dt><dd>{entry.status}</dd></div><div><dt>下一负责人</dt><dd>@{entry.nextOwner}</dd></div>{entry.blockingReason && <div><dt>阻塞报告</dt><dd>{entry.blockingReason}</dd></div>}</dl></details>
        <button type="button" onClick={() => onNavigate(entry.targetNode, entry.selectedRowId)}>前往原页面查看</button>
      </article>)}
    </section>
    <section className="selform-root evolution-topic-group-composer" aria-label="专题群人物消息">
      <label>发给南宫婉<textarea aria-label="专题群消息内容" placeholder="围绕当前专题继续询问、补充事实或要求南宫婉说明下一步" value={messageDraft} onChange={(event) => setMessageDraft(event.currentTarget.value)} /></label>
      <p>消息进入现有南宫婉人物会话；完整原话保存在人物对话库，群时间线只保留专题关联与短预览。</p>
      <button type="button" className="primary" disabled={messageBusy || !messageDraft.trim()} onClick={() => void sendGroupMessage()}>{messageBusy ? "等待南宫婉回复…" : "发送并回流专题群"}</button>
    </section>
    </details>
  </section>;
}

function buildTimeline(dossier: EvolutionTopicDossier | null): TopicGroupEntry[] {
  if (!dossier) return [];
  const sourceEntries: TopicGroupEntry[] = (dossier.deliberation?.sourceSnapshots || []).map((message) => ({
    id: `source:${message.snapshotId}`, actor: message.role === "user" ? "用户" : message.source === "codex" ? "Codex" : "南宫婉",
    category: "来源会话", title: `会话消息 · ${message.conversationId}`, summary: concise(message.content), occurredAt: message.originalCreatedAt,
    targetNode: "manual-research", selectedRowId: dossier.deliberation?.deliberationId || null, status: "已保存原文", nextOwner: message.role === "user" ? "南宫婉" : "韩立", blockingReason: null, active: false,
  }));
  const roundEntries: TopicGroupEntry[] = (dossier.deliberation?.rounds || []).map((round) => ({
    id: `round:${round.roundId}`, actor: "韩立与南宫婉", category: "调查研讨", title: `第 ${round.roundNumber} 轮专题研讨`,
    summary: concise(`韩立：${round.question}${round.answer ? `；南宫婉：${round.answer}` : ""}${round.assessment ? `；韩立判断：${round.assessment}` : ""}`),
    occurredAt: round.assessedAt || round.answeredAt || round.createdAt, targetNode: "manual-research", selectedRowId: dossier.deliberation?.deliberationId || null,
    status: round.decision === "blocked" ? "已阻塞" : round.decision === "establish-topic" ? "可确立专题" : round.answer ? "已回答" : "等待回答",
    nextOwner: round.answer ? "韩立" : "南宫婉", blockingReason: round.decision === "blocked" ? round.assessment || "研讨证据不足" : null, active: !round.answer,
  }));
  const recordEntries = [...dossier.archiveRecords, ...dossier.executionRecords].map((record) => recordEntry(record));
  return [...sourceEntries, ...roundEntries, ...recordEntries].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id));
}

function recordEntry(record: EvolutionArchiveRecord): TopicGroupEntry {
  const targetNode = targetNodeForCategory(record.category);
  return {
    id: `record:${record.recordId}`, actor: typeof record.payload.actorName === "string" ? record.payload.actorName : actorLabel(record.actor), category: categoryLabel(record.category), title: record.title,
    summary: archiveSummary(record), occurredAt: record.occurredAt, targetNode,
    selectedRowId: targetNode === "automatic-recovery" ? record.topicId : record.proposalId || record.taskId || record.deliberationId,
    status: evolutionStatusLabel(String(record.payload.status || record.payload.state || record.payload.runtimeStatus || categoryLabel(record.category))),
    nextOwner: workbenchOwnerLabel(String(record.payload.nextOwner || record.payload.owner || record.payload.executorMemberId || record.actor)),
    blockingReason: typeof record.payload.blockingReason === "string" ? record.payload.blockingReason : typeof record.payload.reason === "string" && record.category === "recovery" ? record.payload.reason : null,
    active: ["running", "executing", "verifying", "integrating", "unified-testing", "pending-approval"].includes(String(record.payload.status || record.payload.state || record.payload.runtimeStatus || "")),
  };
}

function targetNodeForCategory(category: EvolutionArchiveCategory): EvolutionWorkspaceFlowNode {
  if (["source", "deliberation"].includes(category)) return "manual-research";
  if (category === "approval") return "manual-approval";
  if (["proposal", "distribution", "execution"].includes(category)) return "manual-proposal";
  if (["test", "release", "acceptance"].includes(category)) return "manual-release";
  if (category === "recovery") return "automatic-recovery";
  return "manual-topic";
}

function archiveSummary(record: EvolutionArchiveRecord): string {
  const payload = record.payload;
  const candidate = payload.experienceCandidate as { title?: string; status?: string; sourceFailureEvidenceIds?: string[] } | null | undefined;
  if (candidate?.title) return concise(`形成候选项目检查经验：${candidate.title}；状态：${candidate.status === "candidate" ? "待跨场景验证" : candidate.status || "待治理"}；来源失败证据 ${candidate.sourceFailureEvidenceIds?.length || 0} 项。`);
  const parts = [payload.userPreview, payload.nangongPreview, payload.advice, payload.reason, payload.summary, payload.resultSummary, payload.blockingReason, payload.nextAction, payload.state, payload.phase]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
  return concise(parts.join("；") || `已记录 ${categoryLabel(record.category)} 事实，可前往原页面查看完整业务信息。`);
}

function concise(value: string): string { const normalized = value.replace(/\s+/g, " ").trim(); return normalized.length > 300 ? `${normalized.slice(0, 300)}…` : normalized; }
function actorLabel(actor: string): string { return ({ "han-li": "韩立", "nangong-wan": "南宫婉", codex: "Codex", "linghu-ancestor": "令狐老祖", system: "系统", user: "用户" } as Record<string, string>)[actor] || actor; }
function categoryLabel(category: EvolutionArchiveCategory): string { return ({ source: "来源", deliberation: "研讨", topic: "专题", proposal: "提案", approval: "审批", distribution: "分发", execution: "执行", test: "测试", release: "发布", acceptance: "验收", recovery: "修复恢复" } as Record<EvolutionArchiveCategory, string>)[category]; }
function nextStepForTopic(status: string): string { return ({ registered: "继续调查并形成提案", investigating: "完成调查并形成提案", "pending-approval": "等待韩立审批", "supplement-required": "按审批意见补充提案", rejected: "查看退回意见", approved: "返还南宫婉并分发", executing: "等待执行结果", verifying: "等待令狐测试", "pending-acceptance": "等待韩立验收", completed: "查看归档并准备下一专题", blocked: "交给令狐检查后从恢复点继续" } as Record<string, string>)[status] || "查看专题当前状态"; }
function formatTime(value: string, locale: Locale): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(date); }
function readableError(error: unknown, fallback: string): string { const message = error instanceof Error ? error.message : fallback; return message.replace(/^Error invoking remote method '[^']+':\s*/, ""); }
