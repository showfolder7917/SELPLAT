import { SelUiDisclosure } from "../../../../theme/SelUiDisclosure";
import { nodeOccurredAtLabel, taskGroupPrimaryPresentation, visibleTimelineNodes } from "./timeline-display";
import type { TaskGroupCardModel } from "./TaskGroupCard";

/** 退役专题只呈现落盘事实，不装配当前专题的恢复或派发操作。 */
export function TaskGroupAuditCard({ model }: { model: TaskGroupCardModel }) {
  const { group } = model;
  const { locale, open } = model.presentation;
  const primary = taskGroupPrimaryPresentation(group, locale);
  const labels = locale === "ja"
    ? { action: "操作", summary: "要約", content: "本文", detail: "詳細" }
    : { action: "动作", summary: "摘要", content: "正文", detail: "详情" };
  const auditEvidence = visibleTimelineNodes(group.nodes)
    .map((node) => [
      nodeOccurredAtLabel(node, locale),
      `${node.actor.displayName}：${labels.action} ${node.action}`,
      `${labels.summary}：${node.summary}`,
      node.content && `${labels.content}：${node.content}`,
      node.detail && `${labels.detail}：${node.detail}`,
    ].filter(Boolean).join("\n"))
    .filter(Boolean).join("\n\n");
  const cancelled = group.status === "cancelled";
  return (
    <article
      className="task-collaboration-cancelled-history-card task-collaboration-audit-history-card"
      aria-label={locale === "ja" ? "監査履歴" : "专题审计历史卡"}
      data-cancelled-history-card={cancelled || undefined}
      data-audit-history-card
      data-audit-final-status={group.status}
      data-task-timeline-topic-id={group.topicId || ""}
    >
      <SelUiDisclosure
        idPrefix="task-collaboration-cancelled-history"
        className="task-cancelled-history-disclosure"
        open={open}
        onOpenChange={model.actions.onOpenChange}
        trigger={<span className="task-cancelled-history-header">
          <span className="task-cancelled-history-status">
            <strong>{cancelled ? (locale === "ja" ? "取消済み" : "已取消") : (locale === "ja" ? "監査履歴" : "审计历史")}</strong>
            <span>{cancelled ? (locale === "ja" ? "この案件は取消済みです" : "本专题已取消") : (locale === "ja" ? "この案件は現在の作業領域に含まれません" : "此专题不属于当前工作区")}</span>
          </span>
          <strong>{group.title}</strong>
          <span className="task-cancelled-history-facts">
            <span><b>{locale === "ja" ? "内容" : "发生事项"}</b><small>{primary.matter}</small></span>
            <span><b>{locale === "ja" ? "担当" : "处理人和状态"}</b><small>{primary.ownerAndStatus}</small></span>
            <span><b>{locale === "ja" ? "必要な操作" : "是否需要你操作"}</b><small>{primary.customerAction}</small></span>
            <span><b>{locale === "ja" ? "次の対応" : "下一步"}</b><small>{primary.nextAction}</small></span>
          </span>
        </span>}
      >
        <div className="task-cancelled-history-detail">
          <p>{group.summary}</p>
          <small>{locale === "ja" ? "このカードは監査履歴としてのみ閲覧できます。" : "此卡仅供查看审计历史，不能执行任何操作。"}</small>
          {auditEvidence && <pre className="task-cancelled-history-evidence">{auditEvidence}</pre>}
        </div>
      </SelUiDisclosure>
    </article>
  );
}
