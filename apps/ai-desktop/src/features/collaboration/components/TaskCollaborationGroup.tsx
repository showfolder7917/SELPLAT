/**
 * Developer 右侧“任务协作群”主页面。
 * 一个专题对应一张任务卡，卡内按真实发生顺序展示申请、审批、分发、执行和验证节点。
 */

import {
  // 专题任务卡：展示一个专题的摘要、完整人物时间线和操作入口。
  TaskGroupCard,
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
  const {
    evolution,
    liveTextByNodeId,
    locale,
    onManualApproval,
  } = props;
  const controller = useTaskCollaborationGroup(props);
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
        {groups.map((group) => (
          <TaskGroupCard
            key={group.groupId}
            group={group}
            locale={locale}
            nowMs={nowMs}
            open={isGroupOpen(group)}
            continuingTaskId={continuingTaskId}
            continueError={continueError}
            liveTextByNodeId={liveTextByNodeId}
            evolution={evolution}
            isNodeOpen={isNodeOpen}
            onOpenChange={(open) => setGroupOpen(group.groupId, open)}
            onNodeOpenChange={setNodeOpen}
            onManualApproval={onManualApproval}
            onContinueTask={requestContinueTask}
          />
        ))}
      </div>
    </section>
  );
}
