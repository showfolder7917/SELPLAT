/**
 * Developer 右侧协作工作区的页面选择器。
 * 它根据左侧选择显示“任务协作群”或普通协作成员的任务进度页。
 */

import type {
  // 界面语言：传递给任务群和人物页选择中日文文案。
  LocaleValue,
  // 工作区快照：保留在公开参数协议中，供协作工作区后续动作使用。
  WorkspaceStateOutDto,
} from "../../../../contracts/system/desktop/index";
import {
  // 演化请求转换器：人工审批时生成带版本信息的安全写请求。
  evolutionMutationRequest,
} from "../../evolution";
import type {
  // 演化控制器：人工审批、恢复专题和读取研讨状态使用。
  useEvolutionRuntime,
} from "../../evolution";
import type {
  // 人物会话控制器：保留工作区组合协议，不在本选择器中读取内部状态。
  usePersonaConversation,
} from "../../conversation";
import type {
  // 截图控制器：保留工作区组合协议，不在本选择器中处理截图流程。
  useScreenshotCapture,
} from "../../screenshot";
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
import {
  // 任务协作群页面：按专题展示完整权威时间线。
  TaskCollaborationGroup,
} from "./TaskCollaborationGroup";

type CollaborationController = ReturnType<typeof useCollaborationWorkspace>;
type EvolutionController = ReturnType<typeof useEvolutionRuntime>;
type NangongController = ReturnType<typeof usePersonaConversation>;
type ScreenshotController = ReturnType<typeof useScreenshotCapture>;

type CollaborationWorkspaceFeatureProps = {
  /** 当前界面语言。 */
  locale: LocaleValue;
  /** 当前登记的工作区快照；由 Developer 工作区统一传入。 */
  workspaces: WorkspaceStateOutDto | null;
  /** 协作状态、时间线和跨进程操作控制器。 */
  controller: CollaborationController;
  /** 专题演化、人工审批和卡点恢复控制器。 */
  evolution: EvolutionController;
  /** 南宫婉会话控制器；保持协作工作区统一组合边界。 */
  nangong: NangongController;
  /** 截图控制器；保持协作工作区统一组合边界。 */
  screenshot: ScreenshotController;
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
  const {
    panel,
    selectedMember,
    timeline,
    timelineStreams,
    linghuAutomation,
    setLinghuAutomation,
    continueTask,
    refreshTimeline,
    error,
    setError,
  } = controller;

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

  if (panel === "task-group") {
    return (
      <>
        {errorBanner}
        <TaskCollaborationGroup
          evolution={evolution}
          snapshot={timeline}
          liveTextByNodeId={liveTextByNodeId}
          locale={locale}
          onManualApproval={requestManualApproval}
          onContinueTask={continueTimelineTask}
        />
      </>
    );
  }

  return (
    <>
      {errorBanner}
      <CollaborationMemberPage
        timeline={timeline}
        member={selectedMember}
        liveTextByNodeId={liveTextByNodeId}
        locale={locale}
        linghuAutomation={linghuAutomation}
        nangongEvolution={evolution.state}
        onLinghuState={setLinghuAutomation}
      />
    </>
  );
}
