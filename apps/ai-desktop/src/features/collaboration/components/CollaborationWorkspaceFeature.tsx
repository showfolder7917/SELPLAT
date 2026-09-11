/**
 * Developer 右侧协作区域的 Section。
 *
 * Controller 负责审批和任务动作，ViewModel 负责准备页面数据，两个页面组件只负责显示。
 */

import type { LocaleValue } from "../../../../contracts/system/desktop/index";
import { evolutionMutationRequest, type useEvolutionRuntime } from "../../evolution";
import { useSelUi } from "../../../theme/SelUiProvider";
import { createCollaborationWorkspaceViewModel } from "../model/createCollaborationWorkspaceViewModel";
import type { useCollaborationWorkspace } from "../model/useCollaborationWorkspace";
import { CollaborationMemberPage } from "./CollaborationMemberPage";
import { TaskCollaborationGroup } from "./TaskCollaborationGroup";

type CollaborationWorkspaceFeatureProps = {
  /** 当前语言决定任务群和人物页面显示中文还是日文。 */
  locale: LocaleValue;
  /** 协作控制器拥有时间线、成员、导航状态和任务动作。 */
  controller: ReturnType<typeof useCollaborationWorkspace>;
  /** 演化控制器拥有人工作出专题审批决定的能力。 */
  evolution: ReturnType<typeof useEvolutionRuntime>;
};

/** 移除 Electron 调用包装前缀，只把真实失败原因显示给用户。 */
function readableDesktopError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/^Error invoking remote method '[^']+':\s*/, "");
}

/** 组合协作任务群页面或当前人物页面。 */
export function CollaborationWorkspaceFeature({
  locale,
  controller,
  evolution,
}: CollaborationWorkspaceFeatureProps) {
  // 正式审批窗口由 SELUI 提供，Section 只负责把结果交回业务控制器。
  const selUi = useSelUi();

  /** 打开人工审批窗口，成功写入后重新读取权威时间线。 */
  async function manuallyApproveTimelineProposal(proposalId: string, title: string, content: string) {
    // 没有专题状态时缺少版本快照，禁止提交过期或无归属审批。
    if (!evolution.state) return;

    const approvalResult = await selUi.approval({
      title,
      subtitle: "专题任务 · 等待韩立审批",
      content,
    });
    // 用户关闭审批窗口表示取消，不产生业务写操作。
    if (!approvalResult) return;

    controller.actions.setError("");
    try {
      await evolution.decideProposal(proposalId, {
        mutation: evolutionMutationRequest(evolution.state),
        decision: approvalResult.decision,
        advice: approvalResult.reason,
        feedbackTarget: "proposal-content",
      });
      await controller.actions.refreshTimeline();
    } catch (error) {
      controller.actions.setError(readableDesktopError(error, "提交人工审批失败。"));
    }
  }

  /** 任务卡点击审批时启动完整异步流程，避免把异步业务压进 JSX。 */
  function requestManualApproval(proposalId: string, title: string, content: string) {
    void manuallyApproveTimelineProposal(proposalId, title, content);
  }

  /** 等待节点继续原任务时交给协作控制器执行。 */
  async function continueTimelineTask(taskId: string) {
    await controller.actions.continueTask(taskId);
  }

  // ViewModel 只把 Controller 状态映射成任务群和人物页面输入。
  const viewModel = createCollaborationWorkspaceViewModel({
    locale,
    controller,
    evolution,
    onManualApproval: requestManualApproval,
    onContinueTask: continueTimelineTask,
  });

  return (
    <>
      {/* 所有协作子页面共用同一个跨进程错误显示位置。 */}
      {viewModel.errorMessage && (
        <div className="composer-error" role="alert">{viewModel.errorMessage}</div>
      )}

      {/* 左侧选择任务群时显示完整专题时间线。 */}
      {viewModel.showsTaskGroup
        ? <TaskCollaborationGroup model={viewModel.taskGroup} />
        : <CollaborationMemberPage model={viewModel.memberPage} />}
    </>
  );
}
