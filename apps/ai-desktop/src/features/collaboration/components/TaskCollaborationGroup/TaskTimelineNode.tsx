import { memo } from "react";
import type { CollaborationTimelineNodeOutDto, LocaleValue } from "../../../../../contracts/system/desktop/index";
import { SelUiDisclosure } from "../../../../theme/SelUiDisclosure";
import type { TaskGroupCardModel } from "./TaskGroupCard";
import { useTimelineNow } from "./timeline-now";
import {
  compactTimelineText, currentStageTimelinePresentation, detailLabel, nodeDurationLabel,
  nodeOccurredAtLabel, nodeStatusLabel, presentTimelineText, recipientLabel,
} from "./timeline-display";

/** 当前节点标题、展开正文和状态共同消费一份阶段展示；历史记录留在技术详情。 */
export const TaskTimelineNode = memo(function TaskTimelineNode({ model, node, index }: {
  model: TaskGroupCardModel;
  node: CollaborationTimelineNodeOutDto;
  index: number;
}) {
  const { group } = model;
  const { locale, liveTextByNodeId } = model.presentation;
  const currentStage = model.presentation.currentTopicStage?.topicId === group.topicId
    && model.presentation.currentTopicStage?.proposalId === group.proposalId
    ? model.presentation.currentTopicStage : null;
  const stagePresentation = currentStageTimelinePresentation(node, currentStage);
  const displayedStatus = stagePresentation?.status || node.status;
  const displayedSummary = stagePresentation?.summary || node.summary || node.content;
  const { isNodeOpen, onNodeOpenChange, onManualApproval } = model.actions;
  const nodeOpen = isNodeOpen(node.nodeId, node.automaticOpen);
  const liveText = !stagePresentation && node.status === "current" ? liveTextByNodeId[node.nodeId] || "" : "";

  const approveCurrentProposal = () => {
    if (!node.manualApprovalProposalId) return;
    onManualApproval(node.manualApprovalProposalId, group.title, node.content);
  };
  const actionButtons = node.manualApprovalProposalId ? <span className="task-node-actions">
    <button type="button" className="task-manual-approval" onClick={approveCurrentProposal}>
      {locale === "ja" ? "手動承認" : "手动审批"}
    </button>
  </span> : undefined;

  const technicalDetail = [
    node.content ? `${stagePresentation ? "发生时记录（不是当前操作）" : detailLabel(node, locale)}：\n${node.content}` : "",
    node.detail ? `${stagePresentation ? "发生时技术依据（不是当前操作）" : detailLabel(node, locale)}：\n${node.detail}` : "",
    liveText ? `实时技术记录：\n${liveText}` : "",
  ].filter(Boolean).join("\n\n");

  return <div
    className={`task-timeline-position ${displayedStatus}`}
    data-task-timeline-node-id={node.nodeId}
    data-task-timeline-event-type={node.eventType}
    data-task-timeline-started-at={node.startedAt}
    data-task-timeline-status={displayedStatus}
    data-task-timeline-recorded-status={node.status}
  >
    <span className="task-timeline-index">{index + 1}</span>
    <i className="task-timeline-dot" aria-hidden="true" />
    <SelUiDisclosure
      idPrefix="task-collaboration-node"
      className={`task-timeline-node ${node.kind} ${displayedStatus}`}
      open={nodeOpen}
      onOpenChange={(open) => onNodeOpenChange(node.nodeId, open)}
      trigger={<TaskNodeHeader node={node} presentation={model.presentation} currentStagePresentation={stagePresentation} displayedStatus={displayedStatus} />}
      action={actionButtons}
    >
      <div className="task-node-content"><p>{presentTimelineText(displayedSummary)}</p></div>
      {technicalDetail && <SelUiDisclosure
        idPrefix="task-node-detail"
        className="task-node-detail"
        open={false}
        trigger={<span>{detailLabel(node, locale)}</span>}
      ><pre>{presentTimelineText(technicalDetail)}</pre></SelUiDisclosure>}
    </SelUiDisclosure>
  </div>;
}, (previous, next) => {
  const previousNode = previous.node;
  const nextNode = next.node;
  const previousOpen = previous.model.actions.isNodeOpen(previousNode.nodeId, previousNode.automaticOpen);
  const nextOpen = next.model.actions.isNodeOpen(nextNode.nodeId, nextNode.automaticOpen);
  const previousLiveText = previousNode.status === "current"
    ? previous.model.presentation.liveTextByNodeId[previousNode.nodeId] || "" : "";
  const nextLiveText = nextNode.status === "current"
    ? next.model.presentation.liveTextByNodeId[nextNode.nodeId] || "" : "";
  const previousStage = previous.model.presentation.currentTopicStage?.topicId === previous.model.group.topicId
    && previous.model.presentation.currentTopicStage?.proposalId === previous.model.group.proposalId
    ? previous.model.presentation.currentTopicStage : null;
  const nextStage = next.model.presentation.currentTopicStage?.topicId === next.model.group.topicId
    && next.model.presentation.currentTopicStage?.proposalId === next.model.group.proposalId
    ? next.model.presentation.currentTopicStage : null;
  return previousNode === nextNode && previous.index === next.index && previousOpen === nextOpen
    && previousLiveText === nextLiveText && previous.model.group.title === next.model.group.title
    && previous.model.presentation.locale === next.model.presentation.locale
    && previousStage?.status === nextStage?.status
    && previousStage?.waitingFor === nextStage?.waitingFor
    && previousStage?.nextAction === nextStage?.nextAction
    && previousStage?.summary === nextStage?.summary
    && previousStage?.userAction === nextStage?.userAction
    && previous.model.actions.onManualApproval === next.model.actions.onManualApproval;
});

/** 折叠标题从同一阶段读取当前负责人、动作、摘要和状态。 */
function TaskNodeHeader({ node, presentation, currentStagePresentation, displayedStatus }: {
  node: CollaborationTimelineNodeOutDto;
  presentation: TaskGroupCardModel["presentation"];
  currentStagePresentation: ReturnType<typeof currentStageTimelinePresentation>;
  displayedStatus: CollaborationTimelineNodeOutDto["status"];
}) {
  const { locale } = presentation;
  const summary = compactTimelineText(presentTimelineText(currentStagePresentation?.summary || node.summary));
  const hasTechnicalDetail = Boolean(node.detail || (node.content && node.content !== node.summary));
  return <span className="task-node-header-content">
    <span className="task-node-main">
      <span>
        <strong>{currentStagePresentation?.actor || node.actor.displayName}</strong>
        {!currentStagePresentation && node.recipients.length > 0 && <em>{recipientLabel(node)}</em>}
        <b>{currentStagePresentation?.action || node.action}</b>
      </span>
      <small>{summary}</small>
      <small className="task-node-occurred-at">{nodeOccurredAtLabel(node, locale)}</small>
      {hasTechnicalDetail && <small className="task-node-detail-hint">
        {locale === "ja" ? `${detailLabel(node, locale)}あり` : `可查看${detailLabel(node, locale)}`}
      </small>}
    </span>
    <span className="task-node-meta">
      <NodeDuration node={node} locale={locale} />
      <b>{nodeStatusLabel(displayedStatus, locale)}</b>
    </span>
  </span>;
}

function NodeDuration({ node, locale }: { node: CollaborationTimelineNodeOutDto; locale: LocaleValue }) {
  const running = !node.completedAt && node.status !== "completed" && node.status !== "failed";
  const nowMs = useTimelineNow(running);
  return <>{nodeDurationLabel(node, locale, nowMs)}</>;
}
