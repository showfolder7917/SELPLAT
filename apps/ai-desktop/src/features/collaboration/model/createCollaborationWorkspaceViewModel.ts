import type { LocaleValue } from "../../../../contracts/system/desktop/index";
import type { useEvolutionRuntime } from "../../evolution";
import type { CollaborationMemberPageModel } from "../components/CollaborationMemberPage";
import type { TaskCollaborationGroupModel } from "../components/TaskCollaborationGroup.types";
import type { useCollaborationWorkspace } from "./useCollaborationWorkspace";

type CollaborationController = ReturnType<typeof useCollaborationWorkspace>;
type EvolutionController = ReturnType<typeof useEvolutionRuntime>;

type CreateCollaborationWorkspaceViewModelOptions = {
  /** 当前语言决定两个协作页面的中日文文案。 */
  locale: LocaleValue;
  /** 协作控制器提供权威时间线、成员和当前页面。 */
  controller: CollaborationController;
  /** 演化控制器提供专题状态和恢复操作。 */
  evolution: EvolutionController;
  /** 人工审批动作由 Section 持有，因为它需要打开真实对话框。 */
  onManualApproval: TaskCollaborationGroupModel["actions"]["onManualApproval"];
  /** 继续任务动作由协作控制器执行。 */
  onContinueTask: TaskCollaborationGroupModel["actions"]["onContinueTask"];
};

/** 协作工作区的显示模型只描述页面选择和两个子页面输入。 */
export type CollaborationWorkspaceViewModel = {
  /** 当前是否显示任务协作群页面。 */
  showsTaskGroup: boolean;
  /** 跨进程错误为空时不显示错误条。 */
  errorMessage: string;
  /** 任务协作群页面已经归组的显示模型。 */
  taskGroup: TaskCollaborationGroupModel;
  /** 当前人物页面已经归组的显示模型。 */
  memberPage: CollaborationMemberPageModel;
};

/** 把协作 Controller 转换为两个右侧页面可以直接消费的显示模型。 */
export function createCollaborationWorkspaceViewModel({
  locale,
  controller,
  evolution,
  onManualApproval,
  onContinueTask,
}: CreateCollaborationWorkspaceViewModelOptions): CollaborationWorkspaceViewModel {
  // 实时协议对象只向 UI 暴露当前可见正文。
  const liveTextByNodeId = Object.fromEntries(
    Object.entries(controller.data.timelineStreams).map(([nodeId, output]) => [nodeId, output.message.text]),
  );

  return {
    showsTaskGroup: controller.navigation.panel === "task-group",
    errorMessage: controller.feedback.error,
    taskGroup: {
      evolution,
      data: {
        snapshot: controller.data.timeline,
        liveTextByNodeId,
      },
      presentation: { locale },
      actions: {
        onManualApproval,
        onContinueTask,
      },
    },
    memberPage: {
      member: controller.navigation.selectedMember,
      timeline: controller.data.timeline,
      presentation: {
        liveTextByNodeId,
        locale,
        linghuAutomation: controller.data.linghuAutomation,
        nangongEvolution: evolution.state,
      },
      actions: {
        onLinghuState: controller.actions.setLinghuAutomation,
      },
    },
  };
}
