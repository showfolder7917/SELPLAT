/**
 * 任务协作群中的一张专题卡。
 * 卡片展示专题摘要、人物时间线节点、人工审批/继续入口和唯一下一流程。
 */

import type {
  // 时间线专题：渲染专题摘要、状态、节点和下一流程。
  CollaborationTimelineGroupOutDto,
  // 界面语言：选择中文或日文标签。
  LocaleValue,
} from "../../../../../contracts/system/desktop/index";
import type { CurrentTopicStageOutDto } from "../../../../../contracts/services/evolution/index";
import { TaskGroupAuditCard } from "./TaskGroupAuditCard";
import { TaskGroupAcceptanceEvidence } from "./TaskGroupAcceptanceEvidence";
import { TaskTimelineNode } from "./TaskTimelineNode";
import { useTimelineNow } from "./timeline-now";
import {
  // 统一折叠控件：专题卡、人物节点和技术详情都使用相同交互。
  SelUiDisclosure,
} from "../../../../theme/SelUiDisclosure";
import {
  // 摘要压缩：节点头部保持一行可扫描文字。
  compactTimelineText,
  // 耗时转换：专题头部显示墙钟总耗时。
  formatTimelineDuration,
  // 专题活动事实：从同一组当前节点生成人数、人物和验收状态。
  groupActivityPresentation,
  // 专题状态：把稳定状态码转换成中日文。
  groupStatusLabel,
  // 路径显示保护：把临时候选工作树根替换成稳定逻辑名。
  presentTimelineText,
  // 卡片主区域：固定生成事项、处理人、用户操作和下一步。
  taskGroupPrimaryPresentation,
  // 历史兼容筛选：折叠旧数据里的连续重复恢复记录。
  visibleTimelineNodes,
} from "./timeline-display";

/** 专题卡显示状态：只说明当前界面如何呈现，不直接执行业务操作。 */
type TaskGroupCardPresentation = {
  /** 当前界面语言，用于选择中文或日文标签。 */
  locale: LocaleValue;
  /** 当前专题卡是否展开。 */
  open: boolean;
  /** 正在执行“继续任务”的任务标识；没有恢复操作时为 null。 */
  continuingTaskId: string | null;
  /** 继续任务失败原因；空字符串表示当前没有错误。 */
  continueError: string;
  /** 继续任务已受理后的可读反馈；空字符串表示当前没有反馈。 */
  continueFeedback: string;
  /** 按时间线节点保存的实时可见正文。 */
  liveTextByNodeId: Record<string, string>;
  /** 当前专题唯一交付结论；历史时间线不能覆盖它。 */
  currentTopicStage: CurrentTopicStageOutDto | null;
  /** 审计区的旧卡只允许查看历史，不能装配业务操作。 */
  auditReadOnly: boolean;
};

/** 专题卡用户操作：集中声明卡片可以读取或触发的交互。 */
type TaskGroupCardActions = {
  /** 读取节点当前是否展开。 */
  isNodeOpen: (nodeId: string, automaticOpen: boolean) => boolean;
  /** 保存用户对专题卡的展开选择。 */
  onOpenChange: (open: boolean) => void;
  /** 详情面板滚动只上报给页面，由页面集中记录非业务性能证据。 */
  onDetailScroll: () => void;
  /** 保存用户对节点的展开选择。 */
  onNodeOpenChange: (nodeId: string, open: boolean) => void;
  /** 对当前待审批提案执行人工审批。 */
  onManualApproval: (proposalId: string, title: string, content: string) => void;
  /** 从最新等待节点继续原任务。 */
  onContinueTask: (taskId: string) => void;
  /** 从验收卡点恢复原一次性专题运行。 */
  onResumeAcceptance: (request: { topicId: string; proposalId: string; runId: string }) => void;
  /** 退役已退出当前运行的旧专题卡。 */
  onRetireStaleTopic: (request: { topicId: string; proposalId: string }) => void;
};

/** 恢复失败先显示简短警告，完整错误证据仍由用户按需展开查看。 */
function RecoveryError({ message, locale }: { message: string; locale: LocaleValue }) {
  const detail = presentTimelineText(message);
  const summary = compactTimelineText(detail);
  const normalizedDetail = detail.replace(/\s+/gu, " ").trim();
  return (
    <div className="task-recovery-error" role="alert">
      <p>{summary}</p>
      {summary !== normalizedDetail && (
        <SelUiDisclosure
          idPrefix="task-recovery-error-evidence"
          className="task-recovery-evidence"
          open={false}
          trigger={<span>{locale === "ja" ? "完全な理由と証拠を見る" : "查看完整原因与证据"}</span>}
        >
          <pre>{detail}</pre>
        </SelUiDisclosure>
      )}
    </div>
  );
}

/** 恢复请求已被主进程确认后，明确提示用户原任务已经继续。 */
function RecoveryFeedback({ message }: { message: string }) {
  return <p className="task-recovery-feedback" role="status">{message}</p>;
}

/** 专题卡模型：父页面只传入这一份完整、按职责归组的数据。 */
export type TaskGroupCardModel = {
  /** 当前专题及其全部权威时间线节点。 */
  group: CollaborationTimelineGroupOutDto;
  /** 当前卡片的语言、时间、展开、错误和实时正文。 */
  presentation: TaskGroupCardPresentation;
  /** 当前卡片允许执行的展开、审批和恢复操作。 */
  actions: TaskGroupCardActions;
};

/** 专题卡组件入口只接收一份卡片模型，避免调用方逐项透传内部依赖。 */
type TaskGroupCardProps = {
  /** 已按数据、显示状态和操作分组的完整卡片模型。 */
  model: TaskGroupCardModel;
};

/** 动态耗时只刷新自己的文字，不能带动专题卡和整条时间线重新渲染。 */
function TimelineDuration({ durationMs, startedAt, running, locale, prefix }: {
  durationMs: number;
  startedAt: string;
  running: boolean;
  locale: LocaleValue;
  prefix: string;
}) {
  const nowMs = useTimelineNow(running);
  const visibleDuration = running ? Math.max(durationMs, nowMs - Date.parse(startedAt)) : durationMs;
  return <small>{prefix} {formatTimelineDuration(visibleDuration, locale)}</small>;
}

/** 专题卡折叠状态下显示标题、摘要、状态、并行人数和墙钟耗时。 */
function TaskGroupHeader({
  group,
  presentation,
}: Pick<TaskGroupCardModel, "group" | "presentation">) {
  // 界面语言（locale）决定专题状态和耗时使用中文还是日文。
  const { locale, open } = presentation;
  // 停止状态（groupStopped）决定耗时固定，并且不再显示任何处理中人物。
  const currentStage = presentation.currentTopicStage?.topicId === group.topicId && presentation.currentTopicStage?.proposalId === group.proposalId
    ? presentation.currentTopicStage : null;
  const groupStopped = currentStage?.status === "completed" || currentStage?.status === "completed-unverified"
    || currentStage?.status === "cancelled" || currentStage?.status === "failed-pending-repair" || group.status === "cancelled";
  // 活动事实（activity）集中生成状态、去重人数和人物名称，三者不会彼此矛盾。
  const activity = groupActivityPresentation(group, locale, currentStage);
  // 四项主区域文案只消费时间线权威状态，避免组件根据技术正文自行猜测。
  const primary = currentStage ? {
    matter: currentStage.summary,
    ownerAndStatus: currentStage.waitingFor,
    customerAction: currentStage.userAction === "none" ? "当前无需你操作。" : "需要你完成一项操作。",
    nextAction: currentStage.nextAction,
  } : taskGroupPrimaryPresentation(group, locale);
  // 只有已转交令狐且不要求用户恢复的活动技术卡点，才把投影的未完成原因展示为转交原因。
  const technicalRecoveryReason = currentStage?.status === "failed-pending-repair"
    && currentStage.userAction === "none"
    && currentStage.waitingFor === "令狐老祖"
    ? currentStage.remaining
    : null;
  // 专题耗时（durationMs）在任务未结束时至少增长到当前墙钟时间。

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
        {technicalRecoveryReason && <span className="task-group-primary-handoff-reason"><b>{locale === "ja" ? "引き継ぎ理由" : "转交原因"}</b><small>{technicalRecoveryReason}</small></span>}
        <span className="task-group-primary-customer-action"><b>{locale === "ja" ? "必要な操作" : "是否需要你操作"}</b><small>{primary.customerAction}</small></span>
        {/* 卡片展开后由时间线中的“下一流程”独占该状态，避免同一文案重复。 */}
        {!open && <span className="task-group-primary-next"><b>{locale === "ja" ? "次の対応" : "下一步"}</b><small>{primary.nextAction}</small></span>}
      </span>
      {/* 专题事实区：集中展示状态、并行人数和从开始到现在的总耗时。 */}
      <span className="task-group-facts">
        {/* 专题状态：把稳定状态码转换为当前语言的可读标签。 */}
        <b>{activity.statusLabel}</b>
        {/* 任务执行人数：只描述当前任务节点的执行或验收人物，不表示内部研讨成员。 */}
        {!groupStopped && activity.activeOwnerLabels.length > 0 && (
          <em>{locale === "ja" ? `タスク実行中 ${activity.activeOwnerLabels.length}人：${activity.activeOwnerLabels.join("、")}` : `任务执行中 ${activity.activeOwnerLabels.length} 人：${activity.activeOwnerLabels.join("、")}`}</em>
        )}
        {/* 专题总耗时：已结束专题固定，未结束专题跟随当前时间增长。 */}
        <TimelineDuration
          durationMs={group.durationMs}
          startedAt={group.startedAt}
          running={!groupStopped}
          locale={locale}
          prefix={locale === "ja" ? "テーマ総所要時間" : "专题总历时"}
        />
      </span>
    </span>
  );
}

/** 一张专题任务卡及其完整人物处理历史。 */
export function TaskGroupCard({ model }: TaskGroupCardProps) {
  // 专题数据属于卡片的业务输入。
  const { group } = model;
  // 卡片显示状态统一提供语言、时间、展开选择和错误信息。
  const { locale, open, continueError, continueFeedback, auditReadOnly } = model.presentation;
  // 卡片操作这里只读取专题展开操作，节点操作继续由统一模型传给节点。
  const { onOpenChange } = model.actions;
  // 已取消专题只保留审计阅读；展开状态仍由专题卡的统一 groupId 状态管理。
  if (group.status === "cancelled" || auditReadOnly) {
    return <TaskGroupAuditCard model={model} />;
  }
  // 可见节点（visibleNodes）移除旧数据中的连续重复恢复记录。
  const visibleNodes = visibleTimelineNodes(group.nodes);
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.nodeId));
  const topicNodes = (group.topicNodes || visibleNodes.filter((node) => !node.taskId))
    .filter((node) => visibleNodeIds.has(node.nodeId));
  const taskCards = (group.taskCards || []).map((card) => ({
    ...card,
    nodes: card.nodes.filter((node) => visibleNodeIds.has(node.nodeId)),
  })).filter((card) => card.nodes.length > 0);
  const hasStructuredTaskCards = taskCards.length > 0;
  // 历史时间线不再决定当前恢复入口。
  const activeStage = model.presentation.currentTopicStage;
  const currentStage = activeStage?.topicId === group.topicId && activeStage?.proposalId === group.proposalId
    ? activeStage : null;
  // 已保存的旧投影和隔离运行夹具可能尚未提供新增的 Host 启动字段；缺失时只显示尚未核验，不能中断整张任务卡。
  const hostStartupAcceptance = currentStage?.hostStartupAcceptance ?? {
    launchId: null,
    handler: null,
    startedAt: null,
    commandStatus: "missing" as const,
    exitCode: null,
    healthStatus: "missing" as const,
    healthSummary: null,
    evidenceReadable: false,
    evidenceReferences: [],
    launcherSource: null,
    healthResponse: null,
    status: "unverified" as const,
    reason: "尚未记录当前专题的 Host 启动验收依据。",
  };
  // 当前投影明确要求客户恢复时，优先使用它签发的原一次性运行标识；普通任务卡点才读取有效任务链。
  const projectedResumeRunId = currentStage?.userAction === "resume" ? currentStage.resumeOneShotRunId : null;
  const projectedResumeTaskId = currentStage?.userAction === "resume" && !projectedResumeRunId
    ? currentStage.resumeTaskId || null : null;
  // 两类恢复共用一个页面忙碌锁，但分别调用各自已有的权威业务入口。
  const projectedRecoveryId = projectedResumeRunId || projectedResumeTaskId;
  const recoveryPending = projectedRecoveryId === model.presentation.continuingTaskId;
  const staleActiveTopic = Boolean(group.topicId && group.proposalId
    && activeStage?.topicId && activeStage.topicId !== group.topicId
    && !["completed", "cancelled"].includes(group.status));
  const staleRetirementId = group.topicId ? `retire:${group.topicId}` : null;
  const staleRetirementPending = staleRetirementId === model.presentation.continuingTaskId;

  return (
    // 专题卡根折叠区统一承载卡片头部、恢复入口、人物时间线和下一流程。
    <SelUiDisclosure
      idPrefix="task-collaboration-group"
      className={`task-collaboration-group ${currentStage?.status || group.status}`}
      rootData={{
        "data-task-collaboration-group-id": group.groupId,
        "data-task-collaboration-topic-id": group.topicId || undefined,
        "data-task-collaboration-proposal-id": group.proposalId || undefined,
      }}
      open={open}
      onOpenChange={onOpenChange}
      trigger={<TaskGroupHeader group={group} presentation={model.presentation} />}
    >
      {/* 下一流程统一显示当前专题的权威状态，并承载唯一恢复入口。 */}
      <div className="task-timeline-next">
        <i aria-hidden="true" />
        <strong>{locale === "ja" ? "次の工程" : "下一流程"}</strong>
        <span className="task-timeline-next-current">
          <span>{currentStage?.nextAction || group.nextStep}</span>
          {currentStage?.customerActionGuidance && (
            <span className="task-recovery-guidance">
              <b>{currentStage.customerActionGuidance.affectedFiles.join("、")}</b>
              <small>{currentStage.customerActionGuidance.problem}</small>
              <small>{currentStage.customerActionGuidance.reasonCustomerMustAct}</small>
              <small>{currentStage.customerActionGuidance.steps.join(" ")}</small>
              <small>{currentStage.customerActionGuidance.completionCriteria.join(" ")}</small>
            </span>
          )}
          {projectedRecoveryId && currentStage?.topicId && currentStage.proposalId && (
            <button
              type="button"
              className="task-recovery-continue"
              data-task-recovery-id={projectedRecoveryId}
              disabled={recoveryPending}
              onClick={() => projectedResumeRunId
                ? model.actions.onResumeAcceptance({ topicId: currentStage.topicId!, proposalId: currentStage.proposalId!, runId: projectedResumeRunId })
                : model.actions.onContinueTask(projectedResumeTaskId!)}
            >
              <i className={recoveryPending ? "ri-loader-4-line" : "ri-play-circle-line"} aria-hidden="true" />
              {recoveryPending
                ? locale === "ja" ? "復旧中…" : "恢复中…"
                : currentStage?.customerActionGuidance?.resumeLabel || "从卡点继续"}
            </button>
          )}
          {staleActiveTopic && group.topicId && group.proposalId && (
            <button
              type="button"
              className="task-stale-retire"
              disabled={staleRetirementPending}
              onClick={() => model.actions.onRetireStaleTopic({ topicId: group.topicId!, proposalId: group.proposalId! })}
            >
              <i className={staleRetirementPending ? "ri-loader-4-line" : "ri-archive-line"} aria-hidden="true" />
              {staleRetirementPending ? "正在退役…" : "退役旧卡"}
            </button>
          )}
        </span>
      </div>
      {open && <>
        {/* 展开后才装载人物节点正文和技术详情；详情面板单独滚动，卡片摘要与下一流程持续可见。 */}
        <div className="task-timeline-detail-pane" onScroll={model.actions.onDetailScroll}>
          {currentStage && <TaskGroupAcceptanceEvidence stage={currentStage} host={hostStartupAcceptance} locale={locale} />}
          <div className="task-timeline-list" data-task-timeline-topic-id={group.topicId || ""} data-task-timeline-proposal-id={group.proposalId || ""}>
            {hasStructuredTaskCards ? <>
              {topicNodes.length > 0 && <section className="task-topic-flow" aria-label={locale === "ja" ? "案件フロー" : "专题流程"}>
                <header><strong>{locale === "ja" ? "案件フロー" : "专题流程"}</strong></header>
                {topicNodes.map((node, index) => <TaskTimelineNode key={node.nodeId} model={model} node={node} index={index} />)}
              </section>}
              {taskCards.map((card) => <section
                key={card.taskId}
                className={`task-nested-card ${card.role}`}
                data-task-card-id={card.taskId}
                data-task-card-role={card.role}
              >
                <header className="task-nested-card-header">
                  <span>{card.role === "original-task"
                    ? locale === "ja" ? "元の実装タスク" : "原始实现任务"
                    : `${locale === "ja" ? "問題カード" : "问题卡"} ${card.issueNumber}`}</span>
                  <strong>{card.title}</strong>
                  {card.repairAttempts.length > 0 && <small>
                    {locale === "ja" ? "修正試行" : "修复尝试"}：{card.repairAttempts.map((attempt) => `r${attempt}`).join("、")}
                  </small>}
                </header>
                <div className="task-nested-card-nodes">
                  {card.nodes.map((node, index) => <TaskTimelineNode key={node.nodeId} model={model} node={node} index={index} />)}
                </div>
              </section>)}
            </> : visibleNodes.map((node, index) => <TaskTimelineNode key={node.nodeId} model={model} node={node} index={index} />)}
          </div>
          {continueError && <RecoveryError message={continueError} locale={locale} />}
          {continueFeedback && <RecoveryFeedback message={continueFeedback} />}
        </div>
      </>}


    </SelUiDisclosure>
  );
}
