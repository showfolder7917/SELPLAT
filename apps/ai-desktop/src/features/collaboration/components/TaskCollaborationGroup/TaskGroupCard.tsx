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
  canResumeOneShotForGroup,
  TaskGroupRecovery,
} from "../TaskGroupRecovery";
import {
  // 摘要压缩：节点头部保持一行可扫描文字。
  compactTimelineText,
  // 当前专题投影：完成态复核等待继续时让原卡显示卡点，运行后立即恢复历史完成态。
  currentTaskGroupPresentation,
  // 详情标签：按申请、审批、变更或验证证据选择名称。
  detailLabel,
  // 耗时转换：专题头部显示墙钟总耗时。
  formatTimelineDuration,
  // 专题活动事实：从同一组当前节点生成人数、人物和验收状态。
  groupActivityPresentation,
  // 专题状态：把稳定状态码转换成中日文。
  groupStatusLabel,
  // 当前恢复动作：统一放到专题当前流程区，并在同一任务恢复后立即失效。
  latestActiveRecoveryAction,
  // 节点耗时：正在执行或等待时随当前时间更新。
  nodeDurationLabel,
  // 节点状态：把完成、当前、等待和失败转换成中日文。
  nodeStatusLabel,
  // 路径显示保护：把临时候选工作树根替换成稳定逻辑名。
  presentTimelineText,
  // 收件人摘要：显示前三人和剩余总人数。
  recipientLabel,
  // 卡片主区域：固定生成事项、处理人、用户操作和下一步。
  taskGroupPrimaryPresentation,
  // 历史兼容筛选：折叠旧数据里的连续重复恢复记录。
  visibleTimelineNodes,
} from "./timeline-display";

/** 专题卡显示状态：只说明当前界面如何呈现，不直接执行业务操作。 */
type TaskGroupCardPresentation = {
  /** 当前界面语言，用于选择中文或日文标签。 */
  locale: LocaleValue;
  /** 当前时间，用于刷新仍在进行或等待中的耗时。 */
  nowMs: number;
  /** 当前专题卡是否展开。 */
  open: boolean;
  /** 正在执行“继续任务”的任务标识；没有恢复操作时为 null。 */
  continuingTaskId: string | null;
  /** 继续任务失败原因；空字符串表示当前没有错误。 */
  continueError: string;
  /** 按时间线节点保存的实时可见正文。 */
  liveTextByNodeId: Record<string, string>;
};

/** 专题卡用户操作：集中声明卡片可以读取或触发的交互。 */
type TaskGroupCardActions = {
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

/** 专题卡模型：父页面只传入这一份完整、按职责归组的数据。 */
export type TaskGroupCardModel = {
  /** 当前专题及其全部权威时间线节点。 */
  group: CollaborationTimelineGroupOutDto;
  /** 当前卡片的语言、时间、展开、错误和实时正文。 */
  presentation: TaskGroupCardPresentation;
  /** 专题演化状态和原运行恢复操作。 */
  evolution: ReturnType<typeof useEvolutionRuntime>;
  /** 当前卡片允许执行的展开、审批和恢复操作。 */
  actions: TaskGroupCardActions;
};

/** 专题卡组件入口只接收一份卡片模型，避免调用方逐项透传内部依赖。 */
type TaskGroupCardProps = {
  /** 已按数据、显示状态和操作分组的完整卡片模型。 */
  model: TaskGroupCardModel;
};

/** 专题卡折叠状态下显示标题、摘要、状态、并行人数和墙钟耗时。 */
function TaskGroupHeader({
  group,
  presentation,
  recoveryAction,
  oneShotRecoveryRequired,
}: Pick<TaskGroupCardModel, "group" | "presentation"> & {
  recoveryAction: ReturnType<typeof latestActiveRecoveryAction>;
  oneShotRecoveryRequired: boolean;
}) {
  // 界面语言（locale）决定专题状态和耗时使用中文还是日文。
  const { locale, nowMs, open } = presentation;
  // 停止状态（groupStopped）决定耗时固定，并且不再显示任何处理中人物。
  const groupStopped = group.status === "blocked" || group.status === "completed" || group.status === "cancelled";
  // 活动事实（activity）集中生成状态、去重人数和人物名称，三者不会彼此矛盾。
  const activity = groupActivityPresentation(group, locale);
  // 四项主区域文案只消费时间线权威状态，避免组件根据技术正文自行猜测。
  const primary = taskGroupPrimaryPresentation(group, locale, recoveryAction, oneShotRecoveryRequired);
  // 专题耗时（durationMs）在任务未结束时至少增长到当前墙钟时间。
  const durationMs = groupStopped
    ? group.durationMs
    : Math.max(group.durationMs, nowMs - Date.parse(group.startedAt));

  return (
    // 专题头部根区域把左侧摘要和右侧状态事实保持在同一个折叠按钮中。
    <span className="task-group-header-content">
      {/* 专题摘要区：让用户先识别专题名称和本轮协作目标。 */}
      <span>
        {/* 专题标题：直接显示后端时间线已经确定的专题名称。 */}
        <strong>{group.title}</strong>
      </span>
      {/* 用户主区域：固定回答发生事项、处理人状态、是否需要操作和下一步。 */}
      <span className="task-group-primary" aria-label={locale === "ja" ? "現在の状況" : "当前情况"}>
        <span className="task-group-primary-matter"><b>{locale === "ja" ? "内容" : "发生事项"}</b><small>{primary.matter}</small></span>
        <span className="task-group-primary-owner"><b>{locale === "ja" ? "担当" : "处理人和状态"}</b><small>{primary.ownerAndStatus}</small></span>
        <span className={`task-group-primary-customer-action${recoveryAction?.customerAction ? " customer-action" : ""}`}><b>{locale === "ja" ? "必要な操作" : "是否需要你操作"}</b><small>{primary.customerAction}</small></span>
        {/* 卡片展开后由时间线中的“下一流程”独占该状态，避免同一文案重复。 */}
        {!open && <span className="task-group-primary-next"><b>{locale === "ja" ? "次の対応" : "下一步"}</b><small>{primary.nextAction}</small></span>}
      </span>
      {/* 专题事实区：集中展示状态、并行人数和从开始到现在的总耗时。 */}
      <span className="task-group-facts">
        {/* 专题状态：把稳定状态码转换为当前语言的可读标签。 */}
        <b>{activity.statusLabel}</b>
        {/* 并行人数：只有确实有人执行或验证时才显示，避免无意义的零值。 */}
        {!groupStopped && activity.activeOwnerLabels.length > 0 && (
          <em>{locale === "ja" ? `並行 ${activity.activeOwnerLabels.length}人：${activity.activeOwnerLabels.join("、")}` : `并行处理中 ${activity.activeOwnerLabels.length} 人：${activity.activeOwnerLabels.join("、")}`}</em>
        )}
        {/* 专题总耗时：已结束专题固定，未结束专题跟随当前时间增长。 */}
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
  presentation,
}: {
  /** 当前时间线节点，提供人物、动作、摘要和状态。 */
  node: CollaborationTimelineNodeOutDto;
  /** 卡片显示状态，提供语言和动态计时所需的当前时间。 */
  presentation: TaskGroupCardPresentation;
}) {
  // 界面语言和当前时间只从统一显示状态读取，不再由父组件分别透传。
  const { locale, nowMs } = presentation;
  // 节点摘要（summary）清理路径并压缩成适合折叠标题的一行文字。
  const summary = compactTimelineText(presentTimelineText(node.summary));
  // 技术详情仍保持折叠，但在节点标题上明确提示其可用，避免完成节点看起来只有摘要。
  const hasTechnicalDetail = Boolean(node.detail || (node.content && node.content !== node.summary));

  return (
    // 节点头部根区域把人物动作和处理状态排列成可快速扫描的一行。
    <span className="task-node-header-content">
      {/* 节点主要信息区：说明谁对谁执行了什么动作，以及动作摘要。 */}
      <span className="task-node-main">
        {/* 人物动作行：按执行者、接收者、动作的阅读顺序展示。 */}
        <span>
          {/* 执行者姓名：回答“当前是谁接受或处理这个任务”。 */}
          <strong>{node.actor.displayName}</strong>
          {/* 接收人：只有当前动作确实存在接收对象时才显示。 */}
          {node.recipients.length > 0 && <em>{recipientLabel(node)}</em>}
          {/* 节点动作：显示接受、申请、审批、执行或验证等真实动作。 */}
          <b>{node.action}</b>
        </span>
        {/* 节点摘要：用一行文字说明本次动作正在处理的内容。 */}
        <small>{summary}</small>
        {/* 技术详情提示：只说明可查看的证据类型，不把修复过程重新放入主区域。 */}
        {hasTechnicalDetail && (
          <small className="task-node-detail-hint">
            {locale === "ja" ? `${detailLabel(node, locale)}あり` : `可查看${detailLabel(node, locale)}`}
          </small>
        )}
      </span>
      {/* 节点状态区：把本节点自己的耗时和当前状态放在右侧。 */}
      <span className="task-node-meta">
        {/* 节点耗时：执行中或等待中时使用当前时间持续更新。 */}
        <small>{nodeDurationLabel(node, locale, nowMs)}</small>
        {/* 节点状态：把内部状态码转换为当前语言的可读标签。 */}
        <b>{nodeStatusLabel(node.status, locale)}</b>
      </span>
    </span>
  );
}

/** 渲染一个人物时间线节点及其业务操作。 */
function TaskTimelineNode({
  model,
  node,
  index,
}: {
  /** 当前专题卡模型，统一提供专题、显示状态和用户操作。 */
  model: TaskGroupCardModel;
  /** 当前正在渲染的时间线节点。 */
  node: CollaborationTimelineNodeOutDto;
  /** 当前节点在可见时间线中的顺序。 */
  index: number;
}) {
  // 专题数据（group）用于审批窗口标题和节点所属专题判断。
  const { group } = model;
  // 显示状态统一提供语言、时间、继续状态和实时正文。
  const { locale, nowMs, liveTextByNodeId } = model.presentation;
  // 用户操作统一提供展开查询、展开保存和审批能力；恢复只由专题下一流程承载。
  const { isNodeOpen, onNodeOpenChange, onManualApproval } = model.actions;
  // 节点展开状态（nodeOpen）同时尊重后端自动展开提示和用户手动选择。
  const nodeOpen = isNodeOpen(node.nodeId, node.automaticOpen);
  // 实时输出属于技术记录，只能在详情中展开查看，不能覆盖节点正文。
  const liveText = node.status === "current" ? liveTextByNodeId[node.nodeId] || "" : "";
  // 可操作状态（hasAction）决定节点右侧是否需要预留操作区域。
  const hasAction = Boolean(node.manualApprovalProposalId);

  /** 把当前节点绑定的提案交给工作区打开正式审批窗口。 */
  const approveCurrentProposal = () => {
    // 没有提案标识时不允许构造虚假的审批请求。
    if (!node.manualApprovalProposalId) return;
    // 审批请求同时携带专题标题和节点正文，供正式审批窗口完整展示。
    onManualApproval(node.manualApprovalProposalId, group.title, node.content);
  };

  // 节点操作区只承载与当前节点直接相关的审批操作。
  const actionButtons = hasAction ? (
    <span className="task-node-actions">
      {/* 人工审批入口：仅为绑定了待审批提案的节点显示。 */}
      {node.manualApprovalProposalId && (
        <button
          type="button"
          className="task-manual-approval"
          onClick={approveCurrentProposal}
        >
          {locale === "ja" ? "手動承認" : "手动审批"}
        </button>
      )}
    </span>
  ) : undefined;
  // 节点详情保留完整业务事实和技术记录，主区域只显示投影时已确认的短摘要。
  const technicalDetail = [
    node.content && node.content !== node.summary ? `完整记录：\n${node.content}` : "",
    node.detail,
    liveText ? `实时技术记录：\n${liveText}` : "",
  ].filter(Boolean).join("\n\n");

  return (
    // 时间线位置容器使用节点状态控制连线和圆点的视觉状态。
    <div
      className={`task-timeline-position ${node.status}`}
      data-task-timeline-node-id={node.nodeId}
    >
      {/* 节点序号：帮助用户按真实发生顺序阅读完整协作过程。 */}
      <span className="task-timeline-index">{index + 1}</span>
      {/* 时间线圆点：用节点状态样式连接当前步骤和历史步骤。 */}
      <i className="task-timeline-dot" aria-hidden="true" />
      {/* 节点折叠区：头部用于浏览，展开后显示正文、详情和业务操作。 */}
      <SelUiDisclosure
        idPrefix="task-collaboration-node"
        className={`task-timeline-node ${node.kind} ${node.status}`}
        open={nodeOpen}
        onOpenChange={(open) => onNodeOpenChange(node.nodeId, open)}
        trigger={<TaskNodeHeader node={node} presentation={model.presentation} />}
        action={actionButtons}
      >
        {/* 节点正文：当前节点优先显示实时输出，结束后显示数据库正文。 */}
        <div className="task-node-content">
          {/* 正文内容：只显示投影器生成的用户摘要，完整过程统一收进详情。 */}
          <p>{presentTimelineText(node.summary || node.content)}</p>
        </div>
        {/* 技术详情入口：没有详情证据的节点不显示空折叠区。 */}
        {technicalDetail && (
          <SelUiDisclosure
            idPrefix="task-node-detail"
            className="task-node-detail"
            open={false}
            trigger={<span>{detailLabel(node, locale)}</span>}
          >
            {/* 技术详情正文：保留格式，同时隐藏临时候选工作树的物理路径。 */}
            <pre>{presentTimelineText(technicalDetail)}</pre>
          </SelUiDisclosure>
        )}
      </SelUiDisclosure>
    </div>
  );
}

/** 一张专题任务卡及其完整人物处理历史。 */
export function TaskGroupCard({ model }: TaskGroupCardProps) {
  // 专题数据和演化控制器属于卡片的业务输入。
  const { group, evolution } = model;
  // 当前专题（presentedGroup）只叠加运行中的卡点状态，不改写后端历史时间线。
  const presentedGroup = currentTaskGroupPresentation(group, evolution.state?.oneShotRun);
  // 卡片显示状态统一提供语言、时间、展开选择和错误信息。
  const { locale, open, continueError } = model.presentation;
  // 卡片操作这里只读取专题展开操作，节点操作继续由统一模型传给节点。
  const { onOpenChange } = model.actions;
  // 可见节点（visibleNodes）移除旧数据中的连续重复恢复记录。
  const visibleNodes = visibleTimelineNodes(group.nodes);
  // 当前恢复动作（recoveryAction）只来自某个任务的最新等待事实，历史节点不能重新获得按钮。
  const recoveryAction = latestActiveRecoveryAction(visibleNodes);
  // 恢复提交中（recoveryPending）仅禁用下一流程的唯一入口，避免重复请求。
  const recoveryPending = recoveryAction?.taskId === model.presentation.continuingTaskId;
  // 一次性运行恢复与按钮共用同一选择器，卡头不会再把阻塞状态说成自动处理中。
  const oneShotRecoveryRequired = evolution.state
    ? canResumeOneShotForGroup(presentedGroup, evolution.state)
    : false;

  return (
    // 专题卡根折叠区统一承载卡片头部、恢复入口、人物时间线和下一流程。
    <SelUiDisclosure
      idPrefix="task-collaboration-group"
      className={`task-collaboration-group ${presentedGroup.status}`}
      open={open}
      onOpenChange={onOpenChange}
      trigger={<TaskGroupHeader group={presentedGroup} presentation={model.presentation} recoveryAction={recoveryAction} oneShotRecoveryRequired={oneShotRecoveryRequired} />}
    >
      {/* 专题恢复入口：只在原始演化运行确实暂停或阻塞时提供恢复操作。 */}
      <TaskGroupRecovery group={presentedGroup} evolution={evolution} locale={locale} />
      {/* 下一流程统一显示当前专题的权威状态，并承载唯一恢复入口。 */}
      <div className="task-timeline-next">
        <i aria-hidden="true" />
        <strong>{locale === "ja" ? "次の工程" : "下一流程"}</strong>
        <span className="task-timeline-next-current">
          <span>{presentedGroup.nextStep}</span>
          {recoveryAction && (
            <button
              type="button"
              className="task-recovery-continue"
              disabled={recoveryPending}
              onClick={() => model.actions.onContinueTask(recoveryAction.taskId)}
            >
              <i className={recoveryPending ? "ri-loader-4-line" : "ri-play-circle-line"} aria-hidden="true" />
              {recoveryPending
                ? locale === "ja" ? "続行中…" : "继续中…"
                : recoveryAction.customerAction ? "从卡点继续" : locale === "ja" ? "実行を続ける" : "继续执行"}
            </button>
          )}
        </span>
      </div>
      {/* 人物时间线：按后端确定的稳定顺序展示过滤后的真实节点。 */}
      <div className="task-timeline-list">
        {visibleNodes.map((node, index) => (
          <TaskTimelineNode
            key={node.nodeId}
            model={model}
            node={node}
            index={index}
          />
        ))}
      </div>
      {/* 继续任务错误：恢复请求失败时向用户显示页面控制器返回的原因。 */}
      {continueError && <p className="task-recovery-error" role="alert">{continueError}</p>}


    </SelUiDisclosure>
  );
}
