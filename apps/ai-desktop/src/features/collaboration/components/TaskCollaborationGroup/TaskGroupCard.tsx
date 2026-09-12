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
}: Pick<TaskGroupCardModel, "group" | "presentation">) {
  // 界面语言（locale）决定专题状态和耗时使用中文还是日文。
  const { locale, nowMs } = presentation;
  // 活跃人数（activePeopleCount）合并正在执行和正在验证的人数。
  const activePeopleCount = group.executingCount + group.verifyingCount;
  // 结束状态（groupFinished）决定耗时使用后端定稿值还是本地动态计算值。
  const groupFinished = group.status === "completed" || group.status === "cancelled";
  // 专题耗时（durationMs）在任务未结束时至少增长到当前墙钟时间。
  const durationMs = groupFinished
    ? group.durationMs
    : Math.max(group.durationMs, nowMs - Date.parse(group.startedAt));

  return (
    // 专题头部根区域把左侧摘要和右侧状态事实保持在同一个折叠按钮中。
    <span className="task-group-header-content">
      {/* 专题摘要区：让用户先识别专题名称和本轮协作目标。 */}
      <span>
        {/* 专题标题：直接显示后端时间线已经确定的专题名称。 */}
        <strong>{group.title}</strong>
        {/* 专题摘要：补充标题无法完整表达的处理范围。 */}
        <small>{compactTimelineText(presentTimelineText(group.summary))}</small>
      </span>
      {/* 专题事实区：集中展示状态、并行人数和从开始到现在的总耗时。 */}
      <span className="task-group-facts">
        {/* 专题状态：把稳定状态码转换为当前语言的可读标签。 */}
        <b>{groupStatusLabel(group.status, locale)}</b>
        {/* 并行人数：只有确实有人执行或验证时才显示，避免无意义的零值。 */}
        {activePeopleCount > 0 && (
          <em>{locale === "ja" ? `並行 ${activePeopleCount}人` : `并行处理中 ${activePeopleCount} 人`}</em>
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
  visibleNodes,
}: {
  /** 当前专题卡模型，统一提供专题、显示状态和用户操作。 */
  model: TaskGroupCardModel;
  /** 当前正在渲染的时间线节点。 */
  node: CollaborationTimelineNodeOutDto;
  /** 当前节点在可见时间线中的顺序。 */
  index: number;
  /** 已过滤连续重复恢复记录后的完整可见节点。 */
  visibleNodes: CollaborationTimelineNodeOutDto[];
}) {
  // 专题数据（group）用于审批窗口标题和节点所属专题判断。
  const { group } = model;
  // 显示状态统一提供语言、时间、继续状态和实时正文。
  const { locale, nowMs, continuingTaskId, liveTextByNodeId } = model.presentation;
  // 用户操作统一提供展开查询、展开保存、审批和任务恢复能力。
  const { isNodeOpen, onNodeOpenChange, onManualApproval, onContinueTask } = model.actions;
  // 节点展开状态（nodeOpen）同时尊重后端自动展开提示和用户手动选择。
  const nodeOpen = isNodeOpen(node.nodeId, node.automaticOpen);
  // 实时正文（liveText）只属于当前执行节点，历史节点始终显示数据库正文。
  const liveText = node.status === "current" ? liveTextByNodeId[node.nodeId] || "" : "";
  // 恢复任务标识（recoveryTaskId）只选择最新且仍有效的等待节点。
  const recoveryTaskId = latestRecoveryTaskId(visibleNodes, node, index);
  // 客户卡点（isCustomerAction）需要使用更明确的“从卡点继续”按钮文字。
  const isCustomerAction = node.eventType === "customer.action_required";
  // 继续状态（continuing）用于防止同一个恢复任务被重复提交。
  const continuing = recoveryTaskId === continuingTaskId;
  // 可操作状态（hasAction）决定节点右侧是否需要预留操作区域。
  const hasAction = Boolean(node.manualApprovalProposalId || recoveryTaskId);

  // 默认继续文字适用于普通暂停或阻塞任务。
  let continueLabel = locale === "ja" ? "実行を続ける" : "继续执行";
  // 客户动作节点使用“卡点”文字，帮助用户理解恢复来源。
  if (isCustomerAction) continueLabel = "从卡点继续";
  // 正在提交恢复请求时显示进行中状态，并与按钮禁用状态保持一致。
  if (continuing) continueLabel = locale === "ja" ? "続行中…" : "继续中…";

  /** 把当前节点绑定的提案交给工作区打开正式审批窗口。 */
  const approveCurrentProposal = () => {
    // 没有提案标识时不允许构造虚假的审批请求。
    if (!node.manualApprovalProposalId) return;
    // 审批请求同时携带专题标题和节点正文，供正式审批窗口完整展示。
    onManualApproval(node.manualApprovalProposalId, group.title, node.content);
  };

  /** 从当前等待节点保存的恢复点继续原任务。 */
  const continueCurrentTask = () => {
    // 没有恢复任务标识时不允许发出无法定位原任务的继续请求。
    if (!recoveryTaskId) return;
    // 有效恢复点只提交任务标识，异步状态和异常由页面控制器统一处理。
    onContinueTask(recoveryTaskId);
  };

  // 节点操作区（actionButtons）只在存在审批或恢复动作时交给统一折叠控件。
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
      {/* 任务恢复入口：仅为最新且仍有效的等待节点显示。 */}
      {recoveryTaskId && (
        <button
          type="button"
          className="task-recovery-continue"
          disabled={continuing}
          aria-label={isCustomerAction ? "从卡点继续" : continueLabel}
          onClick={continueCurrentTask}
        >
          {/* 恢复图标：请求处理中显示旋转提示，空闲时显示继续执行提示。 */}
          <i className={continuing ? "ri-loader-4-line" : "ri-play-circle-line"} aria-hidden="true" />
          {/* 恢复文字：随节点类型、语言和提交状态显示准确动作。 */}
          {continueLabel}
        </button>
      )}
    </span>
  ) : undefined;

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
          {/* 正文内容：按实时正文、正式正文、摘要的优先级选择可见文字。 */}
          <p>{presentTimelineText(liveText || node.content || node.summary)}</p>
          {/* 流式光标：只有当前节点收到实时输出时才提示仍在生成。 */}
          {liveText && <span className="task-live-caret" aria-label={locale === "ja" ? "出力中" : "流式输出中"} />}
        </div>
        {/* 技术详情入口：没有详情证据的节点不显示空折叠区。 */}
        {node.detail && (
          <SelUiDisclosure
            idPrefix="task-node-detail"
            className="task-node-detail"
            open={false}
            trigger={<span>{detailLabel(node, locale)}</span>}
          >
            {/* 技术详情正文：保留格式，同时隐藏临时候选工作树的物理路径。 */}
            <pre>{presentTimelineText(node.detail)}</pre>
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
  // 卡片显示状态统一提供语言、时间、展开选择和错误信息。
  const { locale, open, continueError } = model.presentation;
  // 卡片操作这里只读取专题展开操作，节点操作继续由统一模型传给节点。
  const { onOpenChange } = model.actions;
  // 可见节点（visibleNodes）移除旧数据中的连续重复恢复记录。
  const visibleNodes = visibleTimelineNodes(group.nodes);

  return (
    // 专题卡根折叠区统一承载卡片头部、恢复入口、人物时间线和下一流程。
    <SelUiDisclosure
      idPrefix="task-collaboration-group"
      className={`task-collaboration-group ${group.status}`}
      open={open}
      onOpenChange={onOpenChange}
      trigger={<TaskGroupHeader group={group} presentation={model.presentation} />}
    >
      {/* 专题恢复入口：只在原始演化运行确实暂停或阻塞时提供恢复操作。 */}
      <TaskGroupRecovery group={group} evolution={evolution} locale={locale} />
      {/* 历史记录之前显示唯一权威下一流程；阻塞时额外解释失败后的恢复方向。 */}
      <div className="task-timeline-next">
        {/* 下一流程引导线：与时间线视觉相连，不承载可读文字。 */}
        <i />
        {/* 下一流程标签：按当前界面语言说明这一栏的业务含义。 */}
        <strong>{locale === "ja" ? "次の工程" : "下一流程"}</strong>
        {/* 权威下一步骤：直接展示后端为当前专题计算的继续方向。 */}
        <span>{group.nextStep}</span>
        {/* 失败恢复方向：只有专题阻塞且后端提供说明时才追加显示。 */}
        {group.status === "blocked" && group.failureNextStep && (
          <small>{locale === "ja" ? "失敗時" : "失败后"}：{group.failureNextStep}</small>
        )}
      </div>
      {/* 人物时间线：按后端确定的稳定顺序展示过滤后的真实节点。 */}
      <div className="task-timeline-list">
        {visibleNodes.map((node, index) => (
          <TaskTimelineNode
            key={node.nodeId}
            model={model}
            node={node}
            index={index}
            visibleNodes={visibleNodes}
          />
        ))}
      </div>
      {/* 继续任务错误：恢复请求失败时向用户显示页面控制器返回的原因。 */}
      {continueError && <p className="task-recovery-error" role="alert">{continueError}</p>}


    </SelUiDisclosure>
  );
}
