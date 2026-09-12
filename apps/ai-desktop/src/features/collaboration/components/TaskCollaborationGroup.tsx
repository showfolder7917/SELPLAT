/**
 * Developer 右侧“任务协作群”主页面。
 * 一个专题对应一张任务卡，卡内按真实发生顺序展示申请、审批、分发、执行和验证节点。
 */

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
import {
  // 页面状态控制器：管理展开选择、定位、动态耗时和继续任务反馈。
  useTaskCollaborationGroup,
} from "./useTaskCollaborationGroup";

/** 按专题展示完整协作历史的主页面。 */
export function TaskCollaborationGroup(props: TaskCollaborationGroupProps) {
  // 页面模型（model）是任务群展示状态和业务操作的唯一输入。
  const { model } = props;
  const {
    evolution,
  } = model;
  // 权威数据提供实时节点正文，显示状态提供当前界面语言。
  const { liveTextByNodeId } = model.data;
  const { locale } = model.presentation;
  // 页面只读取人工审批和需求入口操作，继续任务由页面控制器包装异步反馈。
  const { onManualApproval, onOpenHanliConversation } = model.actions;
  // 页面控制器只消费模型，不再依赖组件外层的包装参数。
  const controller = useTaskCollaborationGroup(model);
  const {
    groups,
    nowMs,
    continuingTaskId,
    continueError,
    isGroupOpen,
    setGroupOpen,
    isNodeOpen,
    setNodeOpen,
    locateCurrentStep,
    continueTask,
  } = controller;

  /** 任务卡只发出任务标识；页面控制器负责完整的异步状态和异常处理。 */
  const requestContinueTask = (taskId: string) => {
    void continueTask(taskId);
  };

  /** 空状态入口只打开韩立会话，不把用户带入任务提交流程。 */
  const openHanliConversation = () => {
    void onOpenHanliConversation();
  };

  if (groups.length === 0) {
    return (
      <section className="task-collaboration-page">
        <div className="task-collaboration-empty">
          <strong>{locale === "ja" ? "共同タスクはまだありません" : "暂无专题任务"}</strong>
          <span>
            {locale === "ja"
              ? "申請、承認、配布と実行の履歴がここに表示されます。"
              : "审批、分发、执行和验证会按发生顺序显示在这里。"}
          </span>
          <button type="button" className="task-collaboration-empty-action" onClick={openHanliConversation}>
            {locale === "ja" ? "韓立に要望を伝える" : "找韩立说需求"}
          </button>
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
        <span>{groups.length}</span>
      </header>

      {/* 专题列表：保持后端时间线已经确定的稳定顺序。 */}
      <div className="task-collaboration-groups">
        {groups.map((group) => {
          // 卡片模型（cardModel）把原来散落在 JSX 上的十多个参数按业务职责归组。
          const cardModel: TaskGroupCardModel = {
            // 专题数据（group）是当前卡片需要展示的唯一后端时间线专题。
            group,
            // 显示数据（presentation）只决定卡片此刻如何呈现，不执行任何业务操作。
            presentation: {
              // 界面语言（locale）决定卡片显示中文还是日文标签。
              locale,
              // 当前时间（nowMs）用于刷新仍在执行或等待中的动态耗时。
              nowMs,
              // 卡片展开状态（open）来自页面控制器保存的用户选择。
              open: isGroupOpen(group),
              // 继续任务标识（continuingTaskId）用于锁定正在恢复的按钮。
              continuingTaskId,
              // 继续任务错误（continueError）用于在卡片底部显示失败原因。
              continueError,
              // 实时节点正文（liveTextByNodeId）让当前执行节点立即显示流式内容。
              liveTextByNodeId,
            },
            // 演化控制器（evolution）供专题恢复入口判断并恢复原始运行。
            evolution,
            // 卡片操作（actions）集中描述用户在卡片中可以触发的全部行为。
            actions: {
              // 节点展开查询（isNodeOpen）保留自动展开与用户选择的统一规则。
              isNodeOpen,
              // 卡片展开操作（onOpenChange）只更新当前专题的展开状态。
              onOpenChange: (open) => setGroupOpen(group.groupId, open),
              // 节点展开操作（onNodeOpenChange）把节点选择交回页面控制器保存。
              onNodeOpenChange: setNodeOpen,
              // 人工审批操作（onManualApproval）打开当前提案的正式审批窗口。
              onManualApproval,
              // 继续任务操作（onContinueTask）从时间线保存的恢复点继续原任务。
              onContinueTask: requestContinueTask,
            },
          };

          // 每张专题卡只接收一个具名模型，调用处无需理解内部组件的参数透传链。
          return <TaskGroupCard key={group.groupId} model={cardModel} />;
        })}
      </div>
    </section>
  );
}
