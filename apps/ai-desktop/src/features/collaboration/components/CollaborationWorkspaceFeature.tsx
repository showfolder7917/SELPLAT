/**
 * Developer 右侧协作工作区的页面选择器。
 * 它根据左侧选择显示“任务协作群”或普通协作成员的任务进度页。
 */

import type {
  // 界面语言：传递给任务群和人物页选择中日文文案。
  LocaleValue,
} from "../../../../contracts/system/desktop/index";
import {
  // 演化请求转换器：人工审批时生成带版本信息的安全写请求。
  evolutionMutationRequest,
} from "../../evolution";
import type {
  // 演化控制器：人工审批、恢复专题和读取研讨状态使用。
  useEvolutionRuntime,
} from "../../evolution";
import {
  // SEL UI 上下文：人工审批复用正式可拖动审批窗口。
  useSelUi,
} from "../../../theme/SelUiProvider";
import type {
  // 协作控制器：提供当前页面、时间线、实时输出和继续任务操作。
  useCollaborationWorkspace,
} from "../model/useCollaborationWorkspace";
import {
  // 普通协作成员页面：显示该人物参与的真实交接和执行进度。
  CollaborationMemberPage,
} from "./CollaborationMemberPage";
import type {
  // 人物页面模型：把人物、时间线、显示状态和令狐操作归为一个参数。
  CollaborationMemberPageModel,
} from "./CollaborationMemberPage";
import {
  // 任务协作群页面：按专题展示完整权威时间线。
  TaskCollaborationGroup,
} from "./TaskCollaborationGroup";
import type {
  // 任务群模型：把时间线、演化状态和操作归为一个参数。
  TaskCollaborationGroupModel,
} from "./TaskCollaborationGroup.types";

type CollaborationController = ReturnType<typeof useCollaborationWorkspace>;
type EvolutionController = ReturnType<typeof useEvolutionRuntime>;

type CollaborationWorkspaceFeatureProps = {
  /** 当前界面语言。 */
  locale: LocaleValue;
  /** 协作状态、时间线和跨进程操作控制器。 */
  controller: CollaborationController;
  /** 专题演化、人工审批和卡点恢复控制器。 */
  evolution: EvolutionController;
};

/** 将 Electron 异常包装前缀移除，只显示人工审批真正失败的原因。 */
function readableDesktopError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/^Error invoking remote method '[^']+':\s*/, "");
}

/** 协作工作区拥有任务群和普通成员页的选择，以及任务群人工操作。 */
export function CollaborationWorkspaceFeature(props: CollaborationWorkspaceFeatureProps) {
  const { locale, controller, evolution } = props;
  const selUi = useSelUi();
  // 权威数据只读取时间线、实时节点输出和令狐自动化状态。
  const {
    timeline,
    timelineStreams,
    linghuAutomation,
  } = controller.data;
  // 导航状态决定当前显示任务群还是选中人物页面。
  const {
    panel,
    selectedMember,
  } = controller.navigation;
  // 跨进程错误由统一反馈对象提供，两个子页面共用同一错误条。
  const { error } = controller.feedback;
  // 页面只解包当前实际使用的令狐、恢复、刷新和错误操作。
  const {
    setLinghuAutomation,
    continueTask,
    refreshTimeline,
    setError,
  } = controller.actions;

  // 实时输出只向页面暴露可显示正文，隐藏流协议和内部消息结构。
  const liveTextByNodeId = Object.fromEntries(
    Object.entries(timelineStreams).map(([nodeId, output]) => [nodeId, output.message.text]),
  );

  /** 打开正式人工审批窗口，提交决定后重新读取已经落库的权威时间线。 */
  const manuallyApproveTimelineProposal = async (
    proposalId: string,
    title: string,
    content: string,
  ) => {
    if (!evolution.state) return;

    const approvalResult = await selUi.approval({
      title,
      subtitle: "专题任务 · 等待韩立审批",
      content,
    });
    if (!approvalResult) return;

    setError("");
    try {
      await evolution.decideProposal(proposalId, {
        // 版本快照：主进程用它阻止基于旧专题状态提交审批。
        mutation: evolutionMutationRequest(evolution.state),
        // 审批结论：通过或退回。
        decision: approvalResult.decision,
        // 审批原因：正式审批窗口要求用户填写的真实意见。
        advice: approvalResult.reason,
        // 反馈目标：退回意见明确指向提案正文。
        feedbackTarget: "proposal-content",
      });
      await refreshTimeline();
    } catch (reason) {
      setError(readableDesktopError(reason, "提交人工审批失败。"));
    }
  };

  /** 从任务群的等待节点继续原任务。 */
  const continueTimelineTask = async (taskId: string) => {
    await continueTask(taskId);
  };

  /** 接收任务卡的审批动作并启动上面的完整异步审批流程。 */
  const requestManualApproval = (proposalId: string, title: string, content: string) => {
    void manuallyApproveTimelineProposal(proposalId, title, content);
  };

  // 两个子页面共用同一错误条，避免每个页面重复解释主进程异常。
  const errorBanner = error ? <div className="composer-error" role="alert">{error}</div> : null;

  // 任务群模型把专题时间线、实时正文、演化状态和页面操作归成一个入口。
  const taskGroupModel: TaskCollaborationGroupModel = {
    // 演化控制器供专题恢复入口继续原始运行。
    evolution,
    // 权威数据组承载时间线事实和仍在生成的节点正文。
    data: {
      // 权威时间线是任务群展示专题和节点的唯一事实来源。
      snapshot: timeline,
      // 实时正文让当前节点在数据库定稿前立即显示进展。
      liveTextByNodeId,
    },
    // 显示状态组只决定当前页面如何呈现。
    presentation: {
      // 界面语言决定任务群的中日文标签。
      locale,
    },
    // 操作组集中承载任务群能够触发的审批和恢复行为。
    actions: {
      // 人工审批操作打开正式审批窗口并在成功后刷新时间线。
      onManualApproval: requestManualApproval,
      // 继续任务操作把恢复点交给协作控制器执行。
      onContinueTask: continueTimelineTask,
    },
  };

  // 人物页模型把当前人物、权威时间线和人物专项显示状态归成一个入口。
  const memberPageModel: CollaborationMemberPageModel = {
    // 当前人物来自协作导航状态，不根据页签标题猜测。
    member: selectedMember,
    // 权威时间线用于筛选该人物真实参与的节点。
    timeline,
    // 显示状态只决定人物页面如何呈现，不直接修改任务事实。
    presentation: {
      // 实时正文只覆盖当前尚未完成的节点。
      liveTextByNodeId,
      // 界面语言决定人物状态使用中文还是日文。
      locale,
      // 令狐自动化状态只在令狐人物页面显示对应面板。
      linghuAutomation,
      // 演化状态用于细化韩立与南宫婉的研讨状态。
      nangongEvolution: evolution.state,
    },
    // 人物页面操作集中保存在明确操作组中。
    actions: {
      // 令狐操作完成后把最新状态写回统一协作控制器。
      onLinghuState: setLinghuAutomation,
    },
  };

  if (panel === "task-group") {
    return (
      <>
        {errorBanner}
        <TaskCollaborationGroup model={taskGroupModel} />
      </>
    );
  }

  return (
    <>
      {errorBanner}
      <CollaborationMemberPage model={memberPageModel} />
    </>
  );
}
