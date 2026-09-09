/**
 * 任务协作群中的一张专题卡。
 * 卡片展示专题摘要、人物时间线节点、人工审批/继续入口和唯一下一流程。
 */

import type {
  // 时间线专题：渲染专题摘要、状态、节点和下一流程。
  CollaborationTimelineGroupOutDto,
  // 时间线节点：渲染人物动作、收件人、正文、详情和恢复操作。
  CollaborationTimelineNodeOutDto,
  // 界面语言：选择中文或日文标签。
  LocaleValue,
} from "../../../../../contracts/system/desktop/index";
import {
  // 统一折叠控件：专题卡、人物节点和技术详情都使用相同交互。
  SelUiDisclosure,
} from "../../../../theme/SelUiDisclosure";
import type {
  // 演化控制器：专题顶部恢复原一次性运行时使用。
  useEvolutionRuntime,
} from "../../../evolution";
import {
  // 专题恢复入口：只在原运行真实暂停或阻塞时显示。
  TaskGroupRecovery,
} from "../TaskGroupRecovery";
import {
  // 摘要压缩：节点头部保持一行可扫描文字。
  compactTimelineText,
  // 详情标签：按申请、审批、变更或验证证据选择名称。
  detailLabel,
  // 耗时转换：专题头部显示墙钟总耗时。
  formatTimelineDuration,
  // 专题状态：把稳定状态码转换成中日文。
  groupStatusLabel,
  // 恢复任务选择：只在最新等待节点返回任务标识。
  latestRecoveryTaskId,
  // 节点耗时：正在执行或等待时随当前时间更新。
  nodeDurationLabel,
  // 节点状态：把完成、当前、等待和失败转换成中日文。
  nodeStatusLabel,
  // 路径显示保护：把临时候选工作树根替换成稳定逻辑名。
  presentTimelineText,
  // 收件人摘要：显示前三人和剩余总人数。
  recipientLabel,
  // 历史兼容筛选：折叠旧数据里的连续重复恢复记录。
  visibleTimelineNodes,
} from "./timeline-display";

type TaskGroupCardProps = {
  /** 当前专题卡及其全部权威时间线节点。 */
  group: CollaborationTimelineGroupOutDto;
  /** 当前界面语言。 */
  locale: LocaleValue;
  /** 当前时间，用于刷新仍在进行的耗时。 */
  nowMs: number;
  /** 当前专题卡是否展开。 */
  open: boolean;
  /** 正在执行“继续任务”的任务标识。 */
  continuingTaskId: string | null;
  /** 继续任务失败原因；沿用原页面行为显示在每张展开的专题卡中。 */
  continueError: string;
  /** 按时间线节点保存的实时可见正文。 */
  liveTextByNodeId: Record<string, string>;
  /** 专题演化状态和原运行恢复操作。 */
  evolution: ReturnType<typeof useEvolutionRuntime>;
  /** 读取节点当前是否展开。 */
  isNodeOpen: (nodeId: string, automaticOpen: boolean) => boolean;
  /** 保存用户对专题卡的展开选择。 */
  onOpenChange: (open: boolean) => void;
  /** 保存用户对节点的展开选择。 */
  onNodeOpenChange: (nodeId: string, open: boolean) => void;
  /** 对当前待审批提案执行人工审批。 */
  onManualApproval: (proposalId: string, title: string, content: string) => void;
  /** 从最新等待节点继续原任务。 */
  onContinueTask: (taskId: string) => void;
};

/** 专题卡折叠状态下显示标题、摘要、状态、并行人数和墙钟耗时。 */
function TaskGroupHeader({
  group,
  locale,
  nowMs,
}: Pick<TaskGroupCardProps, "group" | "locale" | "nowMs">) {
  const activePeopleCount = group.executingCount + group.verifyingCount;
  const groupFinished = group.status === "completed" || group.status === "cancelled";
  const durationMs = groupFinished
    ? group.durationMs
    : Math.max(group.durationMs, nowMs - Date.parse(group.startedAt));

  return (
    <span className="task-group-header-content">
      <span>
        <strong>{group.title}</strong>
        <small>{group.summary}</small>
      </span>
      <span className="task-group-facts">
        <b>{groupStatusLabel(group.status, locale)}</b>
        {activePeopleCount > 0 && (
          <em>{locale === "ja" ? `並行 ${activePeopleCount}人` : `并行处理中 ${activePeopleCount} 人`}</em>
        )}
        <small>
          {locale === "ja" ? "テーマ総所要時間" : "专题总历时"} {formatTimelineDuration(durationMs, locale)}
        </small>
      </span>
    </span>
  );
}

/** 节点折叠状态下显示人物、收件人、动作、摘要、耗时和状态。 */
function TaskNodeHeader({
  node,
  locale,
  nowMs,
}: {
  node: CollaborationTimelineNodeOutDto;
  locale: LocaleValue;
  nowMs: number;
}) {
  const summary = compactTimelineText(presentTimelineText(node.summary));

  return (
    <span className="task-node-header-content">
      <span className="task-node-main">
        <span>
          <strong>{node.actor.displayName}</strong>
          {node.recipients.length > 0 && <em>{recipientLabel(node)}</em>}
          <b>{node.action}</b>
        </span>
        <small>{summary}</small>
      </span>
      <span className="task-node-meta">
        <small>{nodeDurationLabel(node, locale, nowMs)}</small>
        <b>{nodeStatusLabel(node.status, locale)}</b>
      </span>
    </span>
  );
}

/** 渲染一个人物时间线节点及其业务操作。 */
function TaskTimelineNode({
  group,
  node,
  index,
  visibleNodes,
  locale,
  nowMs,
  continuingTaskId,
  liveTextByNodeId,
  isNodeOpen,
  onNodeOpenChange,
  onManualApproval,
  onContinueTask,
}: Pick<
  TaskGroupCardProps,
  | "group"
  | "locale"
  | "nowMs"
  | "continuingTaskId"
  | "liveTextByNodeId"
  | "isNodeOpen"
  | "onNodeOpenChange"
  | "onManualApproval"
  | "onContinueTask"
> & {
  node: CollaborationTimelineNodeOutDto;
  index: number;
  visibleNodes: CollaborationTimelineNodeOutDto[];
}) {
  const nodeOpen = isNodeOpen(node.nodeId, node.automaticOpen);
  const liveText = node.status === "current" ? liveTextByNodeId[node.nodeId] || "" : "";
  const recoveryTaskId = latestRecoveryTaskId(visibleNodes, node, index);
  const isCustomerAction = node.eventType === "customer.action_required";
  const continuing = recoveryTaskId === continuingTaskId;
  const hasAction = Boolean(node.manualApprovalProposalId || recoveryTaskId);

  let continueLabel = locale === "ja" ? "実行を続ける" : "继续执行";
  if (isCustomerAction) continueLabel = "从卡点继续";
  if (continuing) continueLabel = locale === "ja" ? "続行中…" : "继续中…";

  /** 把当前节点绑定的提案交给工作区打开正式审批窗口。 */
  const approveCurrentProposal = () => {
    if (!node.manualApprovalProposalId) return;
    onManualApproval(node.manualApprovalProposalId, group.title, node.content);
  };

  /** 从当前等待节点保存的恢复点继续原任务。 */
  const continueCurrentTask = () => {
    if (!recoveryTaskId) return;
    onContinueTask(recoveryTaskId);
  };

  const actionButtons = hasAction ? (
    <span className="task-node-actions">
      {node.manualApprovalProposalId && (
        <button
          type="button"
          className="task-manual-approval"
          onClick={approveCurrentProposal}
        >
          {locale === "ja" ? "手動承認" : "手动审批"}
        </button>
      )}
      {recoveryTaskId && (
        <button
          type="button"
          className="task-recovery-continue"
          disabled={continuing}
          aria-label={isCustomerAction ? "从卡点继续" : continueLabel}
          onClick={continueCurrentTask}
        >
          <i className={continuing ? "ri-loader-4-line" : "ri-play-circle-line"} aria-hidden="true" />
          {continueLabel}
        </button>
      )}
    </span>
  ) : undefined;

  return (
    <div
      className={`task-timeline-position ${node.status}`}
      data-task-timeline-node-id={node.nodeId}
    >
      <span className="task-timeline-index">{index + 1}</span>
      <i className="task-timeline-dot" aria-hidden="true" />
      <SelUiDisclosure
        idPrefix="task-collaboration-node"
        className={`task-timeline-node ${node.kind} ${node.status}`}
        open={nodeOpen}
        onOpenChange={(open) => onNodeOpenChange(node.nodeId, open)}
        trigger={<TaskNodeHeader node={node} locale={locale} nowMs={nowMs} />}
        action={actionButtons}
      >
        {/* 节点正文：当前节点优先显示实时输出，结束后显示数据库正文。 */}
        <div className="task-node-content">
          <p>{presentTimelineText(liveText || node.content || node.summary)}</p>
          {liveText && <span className="task-live-caret" aria-label={locale === "ja" ? "出力中" : "流式输出中"} />}
        </div>
        {node.detail && (
          <SelUiDisclosure
            idPrefix="task-node-detail"
            className="task-node-detail"
            open={false}
            trigger={<span>{detailLabel(node, locale)}</span>}
          >
            <pre>{presentTimelineText(node.detail)}</pre>
          </SelUiDisclosure>
        )}
      </SelUiDisclosure>
    </div>
  );
}

/** 一张专题任务卡及其完整人物处理历史。 */
export function TaskGroupCard({
  group,
  locale,
  nowMs,
  open,
  continuingTaskId,
  continueError,
  liveTextByNodeId,
  evolution,
  isNodeOpen,
  onOpenChange,
  onNodeOpenChange,
  onManualApproval,
  onContinueTask,
}: TaskGroupCardProps) {
  const visibleNodes = visibleTimelineNodes(group.nodes);

  return (
    <SelUiDisclosure
      idPrefix="task-collaboration-group"
      className={`task-collaboration-group ${group.status}`}
      open={open}
      onOpenChange={onOpenChange}
      trigger={<TaskGroupHeader group={group} locale={locale} nowMs={nowMs} />}
    >
      <TaskGroupRecovery group={group} evolution={evolution} />
      <div className="task-timeline-list">
        {visibleNodes.map((node, index) => (
          <TaskTimelineNode
            key={node.nodeId}
            group={group}
            node={node}
            index={index}
            visibleNodes={visibleNodes}
            locale={locale}
            nowMs={nowMs}
            continuingTaskId={continuingTaskId}
            liveTextByNodeId={liveTextByNodeId}
            isNodeOpen={isNodeOpen}
            onNodeOpenChange={onNodeOpenChange}
            onManualApproval={onManualApproval}
            onContinueTask={onContinueTask}
          />
        ))}
      </div>
      {continueError && <p className="task-recovery-error" role="alert">{continueError}</p>}

      {/* 专题只显示一个权威下一流程；阻塞时额外解释失败后的恢复方向。 */}
      <footer className="task-timeline-next">
        <i />
        <strong>{locale === "ja" ? "次の工程" : "下一流程"}</strong>
        <span>{group.nextStep}</span>
        {group.status === "blocked" && group.failureNextStep && (
          <small>{locale === "ja" ? "失敗時" : "失败后"}：{group.failureNextStep}</small>
        )}
      </footer>
    </SelUiDisclosure>
  );
}
