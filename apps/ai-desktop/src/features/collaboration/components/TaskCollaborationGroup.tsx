/**
 * Developer 右侧“任务协作群”主页面。
 * 一个专题对应一张任务卡，卡内按真实发生顺序展示申请、审批、分发、执行和验证节点。
 */

import { useEffect, useRef, useState } from "react";

import { recordCollaborationInteractionPerformance } from "../model/collaboration-interaction-performance";

import {
  // 专题任务卡：展示一个专题的摘要、完整人物时间线和操作入口。
  TaskGroupCard,
} from "./TaskCollaborationGroup/TaskGroupCard";
import type {
  // 专题任务卡模型：把卡片数据、显示状态和用户操作包装成一个明确入口。
  TaskGroupCardModel,
} from "./TaskCollaborationGroup/TaskGroupCard";
import type {
  // 页面参数：包含权威快照、实时正文、语言和人工操作。
  TaskCollaborationGroupProps,
} from "./TaskCollaborationGroup.types";
import type {
  // 读取受阻政策：由当前专题投影签发，页面只消费不改写。
  CurrentTopicReadRecoveryOutDto,
} from "../../../../contracts/services/evolution/index";
import {
  // 页面状态控制器：管理展开选择、定位、动态耗时和继续任务反馈。
  useTaskCollaborationGroup,
} from "./useTaskCollaborationGroup";
import { SelUiDisclosure } from "../../../theme/SelUiDisclosure";

/** 读取受阻的页面投影只描述重读政策，不能从旧专题或时间线猜测当前任务。 */
type ReadObstructionPresentation = {
  /** 当前专题投影版本，用来区分下一次独立读取故障。 */
  policyId: string;
  /** 当前无法取得的权威对象。 */
  waitingFor: string;
  /** 后台是否正在执行一次安全的只读重试。 */
  retryingAutomatically: boolean;
  /** 重试仍失败后是否需要用户手动再次发起读取。 */
  requiresUserAction: boolean;
  /** 用户或后台下一步的可读说明。 */
  nextAction: string;
};

/** 将读取状态与主进程签发的恢复政策收敛为任务区唯一的读取受阻说明。 */
function createReadObstructionPresentation(input: {
  deliveryUnavailable: boolean;
  timelineUnavailable: boolean;
  recovery: CurrentTopicReadRecoveryOutDto;
}): ReadObstructionPresentation | null {
  if (!input.deliveryUnavailable && !input.timelineUnavailable) return null;

  const waitingFor = input.deliveryUnavailable ? input.recovery.waitingFor : "专题历史证据";
  return {
    policyId: input.recovery.policyId,
    waitingFor,
    retryingAutomatically: input.deliveryUnavailable && !input.recovery.requiresUserAction,
    requiresUserAction: input.deliveryUnavailable && input.recovery.requiresUserAction,
    nextAction: input.deliveryUnavailable ? input.recovery.nextAction : "系统将自动重新读取专题历史证据；读取成功后再显示当前结论。",
  };
}

/** 按专题展示完整协作历史的主页面。 */
export function TaskCollaborationGroup(props: TaskCollaborationGroupProps) {
  const [retryingRead, setRetryingRead] = useState(false);
  const [retryingProjection, setRetryingProjection] = useState(false);
  const [auditHistoryOpen, setAuditHistoryOpen] = useState(false);
  const auditHistoryRef = useRef<HTMLElement | null>(null);
  /** 已提交状态只对应同一份档案政策；政策变化后不能继续禁用新的人工读取机会。 */
  const [submittedReadPolicyId, setSubmittedReadPolicyId] = useState<string | null>(null);
  const automaticRetryPolicyId = useRef<string | null>(null);
  const detailScrollStarts = useRef(new Map<string, number>());
  const detailScrollIdleTimers = useRef(new Map<string, number>());
  // 页面模型（model）是任务群展示状态和业务操作的唯一输入。
  const { model } = props;
  // 权威数据提供实时节点正文，显示状态提供当前界面语言。
  const { liveTextByNodeId } = model.data;
  const { locale, stateReadStatus, deliveryReadStatus, timelineReadStatus, readError, readRecovery } = model.presentation;
  // 页面只读取人工审批和需求入口操作，继续任务由页面控制器包装异步反馈。
  const { onManualApproval, onOpenHanliConversation, onRetryDeliveryRead, onRetryTimelineRead } = model.actions;
  // 页面控制器只消费模型，不再依赖组件外层的包装参数。
  const controller = useTaskCollaborationGroup(model);
  const {
    groups,
    continuingTaskId,
    continueError,
    continueFeedback,
    isGroupOpen,
    setGroupOpen,
    isNodeOpen,
    setNodeOpen,
    locateCurrentStep,
    continueTask,
    resumeAcceptance,
    retireStaleTopic,
  } = controller;
  const currentTopicStage = model.data.currentTopicStage;
  const establishingTopic = currentTopicStage && ["establishing-topic", "topic-establishment-failed"].includes(currentTopicStage.status)
    ? currentTopicStage : null;
  const deliberating = currentTopicStage?.status === "deliberating" ? currentTopicStage : null;
  // 当前区只接受当前投影明确关联的专题；建立阶段没有专题标识时保持为空，避免旧卡占用主区域。
  const activeGroups = establishingTopic || deliberating
    ? []
    : currentTopicStage?.topicId
      ? groups.filter((group) => group.topicId === currentTopicStage.topicId)
      : groups.filter((group) => group.status !== "cancelled");
  // 其余时间线组包括已取消、旧阻塞和无关联卡点，统一作为只读审计历史。
  const auditHistoryGroups = groups.filter((group) => !activeGroups.includes(group));
  // 当前专题未映射到活动时间线时，旧卡只保留审计；页面明确说明没有待处理技术卡点。
  const noActiveTechnicalRecovery = activeGroups.length === 0 && auditHistoryGroups.length > 0
    && (!currentTopicStage || currentTopicStage.status !== "failed-pending-repair");

  /** 只记录详情面板的连续滚动，防止页面外层滚动被误当成长任务。 */
  const recordDetailScroll = (groupId: string) => {
    detailScrollStarts.current.set(groupId, detailScrollStarts.current.get(groupId) || performance.now());
    const previousTimer = detailScrollIdleTimers.current.get(groupId);
    if (previousTimer) window.clearTimeout(previousTimer);
    detailScrollIdleTimers.current.set(groupId, window.setTimeout(() => {
      const startedAt = detailScrollStarts.current.get(groupId);
      if (startedAt !== undefined) recordCollaborationInteractionPerformance("long-task-continuous-scroll", startedAt, { groupId });
      detailScrollStarts.current.delete(groupId);
      detailScrollIdleTimers.current.delete(groupId);
    }, 120));
  };

  /** 任务卡只发出任务标识；页面控制器负责完整的异步状态和异常处理。 */
  const requestContinueTask = (taskId: string) => {
    void continueTask(taskId);
  };

  /** 验收卡点恢复原一次性运行，不再把已集成任务误交给任务级恢复接口。 */
  const requestResumeAcceptance = (request: { topicId: string; proposalId: string; runId: string }) => {
    void resumeAcceptance(request);
  };

  /** 将每张卡的显示状态和操作统一装配，历史卡由卡片内部按终态关闭操作区域。 */
  const createCardModel = (group: typeof groups[number], auditReadOnly = false): TaskGroupCardModel => {
    const cardModel: TaskGroupCardModel = {
      group,
      presentation: {
        locale,
        open: isGroupOpen(group, auditReadOnly),
        continuingTaskId,
        continueError,
        continueFeedback,
        liveTextByNodeId,
        currentTopicStage: model.data.currentTopicStage,
        auditReadOnly,
      },
      actions: {
        isNodeOpen,
        onOpenChange: (open) => {
          const startedAt = performance.now();
          setGroupOpen(group.groupId, open);
          requestAnimationFrame(() => requestAnimationFrame(() => recordCollaborationInteractionPerformance("task-card-page-update", startedAt, { groupId: group.groupId, action: open ? "expand" : "collapse" })));
        },
        onDetailScroll: () => recordDetailScroll(group.groupId),
        onNodeOpenChange: setNodeOpen,
        onManualApproval,
        onContinueTask: requestContinueTask,
        onResumeAcceptance: requestResumeAcceptance,
        onRetireStaleTopic: retireStaleTopic,
      },
    };
    return cardModel;
  };

  /** 空状态入口只打开韩立会话，不把用户带入任务提交流程。 */
  const openHanliConversation = () => {
    void onOpenHanliConversation();
  };

  const deliveryUnavailable = deliveryReadStatus === "unavailable";
  const deliveryReading = deliveryReadStatus === "syncing";
  const timelineUnavailable = timelineReadStatus === "unavailable";
  const timelineRefreshing = timelineReadStatus === "syncing" && groups.length > 0;
  const timelineProjectionUnavailable = model.presentation.timelineProjectionStatus.status === "unavailable";
  const readObstruction = createReadObstructionPresentation({
    deliveryUnavailable,
    // 最近成功的时间线仍可供阅读；失败只作为局部刷新状态，不能替换整页内容。
    timelineUnavailable: false,
    recovery: readRecovery,
  });
  // 首次时间线尚未形成快照时，读取失败不能被空数组误显示成“暂无专题任务”。
  // 已有快照后的失败继续沿用下方局部提示，保留用户正在查看的历史和操作位置。
  const initialTimelineReadFailed = timelineUnavailable && model.data.snapshot === null;

  // 权威结论刷新期间不继续显示上一次快照中的最终通过，避免把陈旧依据误当作当前事实。
  if (deliveryReading) {
    return (
      <section className="task-collaboration-page">
        <div className="task-collaboration-empty" role="status">
          <strong>正在读取验收依据</strong>
          <span>读取完成前不会推进、恢复或改写当前专题状态。</span>
        </div>
      </section>
    );
  }

  /** 自动重读只按档案政策执行一次；失败后仍等待同一政策，不把权限改成手动入口。 */
  useEffect(() => {
    if (!readObstruction || readObstruction.requiresUserAction || retryingRead || automaticRetryPolicyId.current === readObstruction.policyId) return;
    automaticRetryPolicyId.current = readObstruction.policyId;
    setRetryingRead(true);
    void onRetryDeliveryRead()
      .catch(() => undefined)
      .finally(() => setRetryingRead(false));
  }, [onRetryDeliveryRead, readObstruction, retryingRead]);

  /** 读取恢复或档案政策更新后，下一次独立故障重新按主进程政策判断。 */
  useEffect(() => {
    if (!readObstruction) {
      automaticRetryPolicyId.current = null;
      setSubmittedReadPolicyId(null);
    }
  }, [readObstruction]);

  /** 用户手动重读不推进协作任务，并在请求结束后继续展示最新权威读取结论。 */
  const retryDeliveryRead = () => {
    setSubmittedReadPolicyId(readObstruction?.policyId || null);
    setRetryingRead(true);
    void onRetryDeliveryRead()
      .catch(() => undefined)
      .finally(() => setRetryingRead(false));
  };

  /** 时间线更新失败时只重读当前权威快照，卡片、展开状态和详情滚动位置保持不变。 */
  const retryTimelineRead = () => {
    setRetryingRead(true);
    void onRetryTimelineRead()
      .catch(() => undefined)
      .finally(() => setRetryingRead(false));
  };

  // 历史审计是独立读取区域：即使当前没有旧专题，也要在展开后说明读取结果。
  // 此处位于 retryTimelineRead 初始化之后，失败提示才能安全绑定只读重新读取操作。
  const auditHistory = groups.length > 0 && (
    <section ref={auditHistoryRef} className="task-collaboration-audit-history" aria-label={locale === "ja" ? "監査履歴" : "专题审计历史"}>
      <SelUiDisclosure
        idPrefix="task-collaboration-audit-history"
        className="task-collaboration-audit-disclosure"
        open={auditHistoryOpen}
        onOpenChange={setAuditHistoryOpen}
        trigger={<span className="task-collaboration-audit-history-header"><strong>{locale === "ja" ? "監査履歴" : "历史审计"}</strong><span>{locale === "ja" ? `${auditHistoryGroups.length} 件の旧記録` : `${auditHistoryGroups.length} 条旧专题或历史记录`}</span></span>}
      >
        <div className="task-collaboration-history-cards">
          {timelineRefreshing && <p role="status">正在读取历史审计记录…</p>}
          {timelineUnavailable && <div role="alert">
            <p>{readError || "历史审计读取失败，正在保留上次成功内容。"}</p>
            <button type="button" disabled={retryingRead} onClick={retryTimelineRead}>{retryingRead ? "重新读取中…" : "重新读取"}</button>
          </div>}
          {auditHistoryGroups.map((group) => <TaskGroupCard key={group.groupId} model={createCardModel(group, true)} />)}
          {!timelineRefreshing && !timelineUnavailable && auditHistoryGroups.length === 0 && <p role="status">没有可显示的审计记录。</p>}
        </div>
      </SelUiDisclosure>
    </section>
  );

  /** 只重试已失败的时间线投影，旧卡片、展开状态和详情滚动不参与该忙碌锁。 */
  const retryTimelineProjection = () => {
    setRetryingProjection(true);
    void model.actions.onRetryTimelineProjection().catch(() => undefined).finally(() => setRetryingProjection(false));
  };

  // 任一权威读取受阻时，旧时间线不能继续承担当前结论。
  // 固定返回读取说明，避免旧卡片和恢复入口与当前受阻事实并列。
  if (readObstruction) {
    return (
      <section className="task-collaboration-page">
        <div className="task-collaboration-empty" role="alert">
          <strong>当前无法读取：验收依据暂时无法读取</strong>
          <span>正在等待：{readObstruction.waitingFor}</span>
          <span>是否需要你操作：{readObstruction.requiresUserAction ? "需要重新读取，当前不会推进或恢复任务。" : "暂不需要，系统正在自动重试。"}</span>
          <span>下一步：{readObstruction.nextAction}</span>
          {readError && <small>{readError}</small>}
          {readObstruction.requiresUserAction && (
            <button type="button" className="task-recovery-continue" disabled={retryingRead || submittedReadPolicyId === readObstruction.policyId} onClick={retryDeliveryRead}>
              {retryingRead ? "重新读取中…" : submittedReadPolicyId === readObstruction.policyId ? "已提交，等待处理" : "重新读取"}
            </button>
          )}
        </div>
      </section>
    );
  }

  // 此入口只重新读取 SQLite 时间线；不触发任务恢复、审批、派发或交付投影读取。
  if (initialTimelineReadFailed) {
    return (
      <section className="task-collaboration-page">
        <div className="task-collaboration-empty" role="alert">
          <strong>{locale === "ja" ? "タスク履歴を読み込めません" : "无法读取任务协作时间线"}</strong>
          <span>{readError || (locale === "ja" ? "履歴を再読み込みしてください。" : "请重新读取任务协作时间线。")}</span>
          <button type="button" className="task-collaboration-empty-action" disabled={retryingRead} onClick={retryTimelineRead}>
            {retryingRead ? (locale === "ja" ? "再読み込み中…" : "重新读取中…") : (locale === "ja" ? "再読み込み" : "重新读取")}
          </button>
        </div>
      </section>
    );
  }

  if (establishingTopic) {
    return (
      <section className="task-collaboration-page">
        <div className="task-collaboration-groups">
          <div className="task-topic-establishment" role={establishingTopic.status === "topic-establishment-failed" ? "alert" : "status"}>
            <strong>{establishingTopic.title}</strong>
            <span>发生事项：{establishingTopic.summary}</span>
            <span>处理人和状态：{establishingTopic.waitingFor}</span>
            <span>是否需要你操作：当前无需操作。</span>
            <span>下一步：{establishingTopic.nextAction}</span>
            {establishingTopic.remaining && <small>{establishingTopic.remaining}</small>}
          </div>
          {auditHistory}
        </div>
      </section>
    );
  }

  if (deliberating) {
    return (
      <section className="task-collaboration-page">
        <div className="task-collaboration-groups">
          <div className="task-deliberation-activity" role="status">
            <strong>{deliberating.title}</strong>
            <span>发生事项：{deliberating.summary}</span>
            <span>处理人和状态：{deliberating.waitingFor}</span>
            <span>是否需要你操作：当前无需操作。</span>
            <span>下一步：{deliberating.nextAction}</span>
            {deliberating.remaining && <small>{deliberating.remaining}</small>}
          </div>
          {auditHistory}
        </div>
      </section>
    );
  }

  if (groups.length === 0) {
    const statusMessage = stateReadStatus === "syncing"
      ? (locale === "ja" ? "共同状態を同期しています" : "正在同步")
      : stateReadStatus === "unavailable"
        ? (locale === "ja" ? "共同状態はまだ更新されていません" : "状态暂未更新")
        : null;
    return (
      <section className="task-collaboration-page">
        <div className="task-collaboration-empty">
          {statusMessage ? <strong role="status">{statusMessage}</strong> : <>
            <strong>{locale === "ja" ? "共同タスクはまだありません" : "暂无专题任务"}</strong>
            <span className="task-collaboration-empty-intro">
              {locale === "ja"
                ? "申請、承認、配布と実行の履歴がここに表示されます。"
                : "先点击“找韩立说需求”说明目标；会话会引导你确认需求与范围，之后的任务安排会显示在这里。"}
            </span>
            <button type="button" className="task-collaboration-empty-action" onClick={openHanliConversation}>
              {locale === "ja" ? "韓立に要望を伝える" : "找韩立说需求"}
            </button>
            {locale !== "ja" && <span className="task-collaboration-empty-detail">审批、分发、执行和验证会按发生顺序显示在这里。</span>}
          </>}
        </div>
      </section>
    );
  }

  return (
    <section
      className="task-collaboration-page"
      aria-label={locale === "ja" ? "タスク協同グループ" : "任务协作群"}
    >
      {/* 页面标题：提供专题数量和一键定位当前步骤。 */}
      <header className="task-collaboration-heading">
        <div>
          <h1>{locale === "ja" ? "タスク協同グループ" : "任务协作群"}</h1>
          <p>
            {locale === "ja"
              ? "案件ごとに完全な処理履歴を確認できます。"
              : "一个专题一张任务卡，按真实发生顺序查看每个人正在做什么。"}
          </p>
        </div>
        <button type="button" onClick={locateCurrentStep}>
          {locale === "ja" ? "現在の工程へ" : "定位当前步骤"}
        </button>
        {auditHistoryGroups.length > 0 && <button type="button" onClick={() => {
          setAuditHistoryOpen(true);
          const history = auditHistoryRef.current;
          const groupsPane = history?.closest<HTMLElement>(".task-collaboration-groups");
          if (history && groupsPane) groupsPane.scrollTo({
            top: groupsPane.scrollTop + history.getBoundingClientRect().top - groupsPane.getBoundingClientRect().top,
            behavior: "smooth",
          });
        }}>
          {locale === "ja" ? `監査履歴を見る（${auditHistoryGroups.length}）` : `查看历史审计（${auditHistoryGroups.length}）`}
        </button>}
        <span>{groups.length}</span>
      </header>
      {timelineRefreshing && <div className="task-collaboration-refresh-status" role="status" aria-live="polite">
        <span>正在更新任务进度，当前内容和操作保持可用。</span>
      </div>}
      {timelineUnavailable && <div className="task-collaboration-refresh-status" role="status">
        <span>{readError || "任务进度更新失败，正在保留上次成功内容。"}</span>
        <button type="button" disabled={retryingRead} onClick={retryTimelineRead}>{retryingRead ? "重新读取中…" : "重新读取更新"}</button>
      </div>}
      {timelineProjectionUnavailable && <div className="task-collaboration-refresh-status" role="alert" data-task-id={model.presentation.timelineProjectionStatus.taskId || undefined} data-projection-operation={model.presentation.timelineProjectionStatus.operation}>
        <span>{model.presentation.timelineProjectionStatus.message || "任务进度更新失败，正在保留上次成功内容。"}</span>
        <button type="button" disabled={retryingProjection} onClick={retryTimelineProjection}>{retryingProjection ? "重试更新中…" : "重试进度更新"}</button>
      </div>}
      {/* 当前专题列表保持后端已确定的稳定顺序，且只承载仍可能存在的操作。 */}
      <div className="task-collaboration-groups">
        {noActiveTechnicalRecovery && <div className="task-collaboration-empty task-collaboration-no-active-recovery" role="status">
          <strong>没有待处理技术卡点</strong>
          <span>处理人和状态：当前无需用户操作。</span>
          <span>是否需要你操作：当前无需用户操作。</span>
          <span>下一步：等待新证据。</span>
        </div>}
        {activeGroups.map((group) => {
          // 当前专题仍使用具名卡片模型，保持调用点能直接辨别展示与操作边界。
          const cardModel = createCardModel(group);
          return <TaskGroupCard key={group.groupId} model={cardModel} />;
        })}
        {auditHistory}
      </div>
    </section>
  );
}
