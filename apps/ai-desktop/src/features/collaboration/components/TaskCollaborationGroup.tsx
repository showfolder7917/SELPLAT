import { useEffect, useState } from "react";

import type { CollaborationTimelineGroup, CollaborationTimelineNode, CollaborationTimelineSnapshot, Locale } from "../../../../contracts/desktop/desktop";
import { SelUiDisclosure } from "../../../theme/SelUiDisclosure";

/** 新任务协作群只消费主进程时间线投影；旧四阶段视图保留回退但不再参与本页排序和人物推断。 */
export function TaskCollaborationGroup({ snapshot, liveTextByNodeId, locale, onManualApproval }: {
  snapshot: CollaborationTimelineSnapshot | null;
  liveTextByNodeId: Record<string, string>;
  locale: Locale;
  onManualApproval(proposalId: string, title: string, content: string): void;
}) {
  const groups = snapshot?.groups || [];
  const [groupOpenOverrides, setGroupOpenOverrides] = useState<Map<string, boolean>>(new Map());
  const [nodeOpenOverrides, setNodeOpenOverrides] = useState<Map<string, boolean>>(new Map());
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  const currentGroupId = groups.find((group) => group.status !== "completed" && group.status !== "cancelled")?.groupId || groups[0]?.groupId;
  const locateCurrentStep = () => {
    const group = groups.find((candidate) => candidate.groupId === currentGroupId);
    const node = group ? [...group.nodes].reverse().find((candidate) => candidate.status === "current" || candidate.status === "waiting") : undefined;
    if (!group || !node) return;
    updateOpenOverride(setGroupOpenOverrides, group.groupId, true);
    updateOpenOverride(setNodeOpenOverrides, node.nodeId, true);
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-task-timeline-node-id="${CSS.escape(node.nodeId)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  if (!groups.length) return <section className="task-collaboration-page"><div className="task-collaboration-empty"><strong>{locale === "ja" ? "共同タスクはまだありません" : "暂无专题任务"}</strong><span>{locale === "ja" ? "申請、承認、配布と実行の履歴がここに表示されます。" : "审批、分发、执行和验证会按发生顺序显示在这里。"}</span></div></section>;

  return <section className="task-collaboration-page" aria-label={locale === "ja" ? "タスク協同グループ" : "任务协作群"}>
    <header className="task-collaboration-heading"><div><h1>{locale === "ja" ? "タスク協同グループ" : "任务协作群"}</h1><p>{locale === "ja" ? "案件ごとに完全な処理履歴を確認できます。" : "一个专题一张任务卡，按真实发生顺序查看每个人正在做什么。"}</p></div><button type="button" onClick={locateCurrentStep}>{locale === "ja" ? "現在の工程へ" : "定位当前步骤"}</button><span>{groups.length}</span></header>
    <div className="task-collaboration-groups">{groups.map((group) => {
      const groupOpen = groupOpenOverrides.get(group.groupId) ?? group.groupId === currentGroupId;
      return <SelUiDisclosure
        key={group.groupId}
        idPrefix="task-collaboration-group"
        className={`task-collaboration-group ${group.status}`}
        open={groupOpen}
        onOpenChange={(open) => updateOpenOverride(setGroupOpenOverrides, group.groupId, open)}
        trigger={<TaskGroupHeader group={group} locale={locale} nowMs={nowMs} />}
      >
        <div className="task-timeline-list">{group.nodes.map((node, index) => {
          const nodeOpen = nodeOpenOverrides.get(node.nodeId) ?? node.automaticOpen;
          const liveText = node.status === "current" ? liveTextByNodeId[node.nodeId] : "";
          return <div className={`task-timeline-position ${node.status}`} data-task-timeline-node-id={node.nodeId} key={node.nodeId}>
            <span className="task-timeline-index">{index + 1}</span><i className="task-timeline-dot" aria-hidden="true" />
            <SelUiDisclosure
              idPrefix="task-collaboration-node"
              className={`task-timeline-node ${node.kind} ${node.status}`}
              open={nodeOpen}
              onOpenChange={(open) => updateOpenOverride(setNodeOpenOverrides, node.nodeId, open)}
              trigger={<TaskNodeHeader node={node} locale={locale} nowMs={nowMs} />}
              action={node.manualApprovalProposalId ? <button type="button" className="task-manual-approval" onClick={() => onManualApproval(node.manualApprovalProposalId!, group.title, node.content)}>{locale === "ja" ? "手動承認" : "手动审批"}</button> : undefined}
            >
              <div className="task-node-content"><p>{liveText || node.content || node.summary}</p>{liveText && <span className="task-live-caret" aria-label={locale === "ja" ? "出力中" : "流式输出中"} />}</div>
              {node.detail && <SelUiDisclosure idPrefix="task-node-detail" className="task-node-detail" open={false} trigger={<span>{detailLabel(node, locale)}</span>}><pre>{node.detail}</pre></SelUiDisclosure>}
            </SelUiDisclosure>
          </div>;
        })}</div>
        <footer className="task-timeline-next"><i /> <strong>{locale === "ja" ? "次の工程" : "下一流程"}</strong><span>{group.nextStep}</span></footer>
      </SelUiDisclosure>;
    })}</div>
  </section>;
}

function TaskGroupHeader({ group, locale, nowMs }: { group: CollaborationTimelineGroup; locale: Locale; nowMs: number }) {
  const activeCount = group.executingCount + group.verifyingCount;
  const duration = group.status === "completed" || group.status === "cancelled" ? group.durationMs : Math.max(group.durationMs, nowMs - Date.parse(group.startedAt));
  return <span className="task-group-header-content"><span><strong>{group.title}</strong><small>{group.summary}</small></span><span className="task-group-facts"><b>{groupStatusLabel(group.status, locale)}</b>{activeCount > 0 && <em>{locale === "ja" ? `並行 ${activeCount}人` : `并行处理中 ${activeCount} 人`}</em>}<small>{locale === "ja" ? "テーマ総所要時間" : "专题总历时"} {formatDuration(duration, locale)}</small></span></span>;
}

function TaskNodeHeader({ node, locale, nowMs }: { node: CollaborationTimelineNode; locale: Locale; nowMs: number }) {
  return <span className="task-node-header-content"><span className="task-node-main"><span><strong>{node.actor.displayName}</strong>{node.recipients.length > 0 && <em>{recipientLabel(node)}</em>}<b>{node.action}</b></span><small>{compact(node.summary)}</small></span><span className="task-node-meta"><small>{durationLabel(node, locale, nowMs)}</small><b>{nodeStatusLabel(node.status, locale)}</b></span></span>;
}

function updateOpenOverride(setter: (update: (current: Map<string, boolean>) => Map<string, boolean>) => void, id: string, open: boolean): void {
  setter((current) => {
    const next = new Map(current);
    // 当前节点首次出现时自动展开；一旦人物主动操作，之后尊重该节点自己的展开或收起状态。
    next.set(id, open);
    return next;
  });
}

function recipientLabel(node: CollaborationTimelineNode): string {
  const visible = node.recipients.slice(0, 3).map((item) => item.displayName).join("、");
  const remaining = node.recipients.length - 3;
  return `→ ${visible}${remaining > 0 ? ` 等 ${node.recipients.length} 人` : ""}`;
}

function compact(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 120 ? `${normalized.slice(0, 120)}…` : normalized;
}

function groupStatusLabel(status: CollaborationTimelineGroup["status"], locale: Locale): string {
  const zh: Record<CollaborationTimelineGroup["status"], string> = { "waiting-approval": "等待审批", running: "进行中", verifying: "验证中", blocked: "已阻塞", completed: "已完成", cancelled: "已取消" };
  const ja: Record<CollaborationTimelineGroup["status"], string> = { "waiting-approval": "承認待ち", running: "進行中", verifying: "検証中", blocked: "停止", completed: "完了", cancelled: "取消" };
  return (locale === "ja" ? ja : zh)[status];
}

function nodeStatusLabel(status: CollaborationTimelineNode["status"], locale: Locale): string {
  const zh = { completed: "已完成", current: "进行中", waiting: "等待中", failed: "未通过" } as const;
  const ja = { completed: "完了", current: "進行中", waiting: "待機", failed: "失敗" } as const;
  return (locale === "ja" ? ja : zh)[status];
}

function durationLabel(node: CollaborationTimelineNode, locale: Locale, nowMs: number): string {
  const prefix = node.status === "completed" ? (locale === "ja" ? "処理時間" : "处理耗时") : node.kind === "verification" ? (locale === "ja" ? "検証済み" : "已验证") : node.status === "waiting" ? (locale === "ja" ? "待機" : "已等待") : (locale === "ja" ? "処理済み" : "已处理");
  const liveDuration = node.completedAt ? node.durationMs : Math.max(node.durationMs, nowMs - Date.parse(node.startedAt));
  return `${prefix} ${formatDuration(liveDuration, locale)}`;
}

function formatDuration(durationMs: number, locale: Locale): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor(totalSeconds % 3_600 / 60);
  const seconds = totalSeconds % 60;
  if (hours) return locale === "ja" ? `${hours}時間${minutes}分` : `${hours}小时${minutes}分`;
  return locale === "ja" ? `${minutes}分${seconds}秒` : `${minutes}分${seconds}秒`;
}

function detailLabel(node: CollaborationTimelineNode, locale: Locale): string {
  if (node.kind === "verification") return locale === "ja" ? "検証詳細" : "验证详情";
  if (node.kind === "approval-application") return locale === "ja" ? "申請根拠" : "申请依据";
  if (node.kind === "approval-decision") return locale === "ja" ? "承認補足" : "审批补充说明";
  if (node.kind === "repair") return locale === "ja" ? "復旧条件" : "阻塞与恢复条件";
  return locale === "ja" ? "実行詳細" : "执行详情";
}
