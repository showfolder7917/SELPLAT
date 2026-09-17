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
  /** 演化状态只供任务协作卡展示专题结论，不参与人物当前状态。 */
  evolution: EvolutionController;
  /** 人工审批动作由 Section 持有，因为它需要打开真实对话框。 */
  onManualApproval: TaskCollaborationGroupModel["actions"]["onManualApproval"];
  /** 继续任务动作由协作控制器执行。 */
  onContinueTask: TaskCollaborationGroupModel["actions"]["onContinueTask"];
  /** 恢复验收动作由 Evolution 控制器沿原专题运行执行。 */
  onResumeAcceptance: TaskCollaborationGroupModel["actions"]["onResumeAcceptance"];
  /** 旧卡兜底退役由 Section 串起 Evolution 与时间线刷新。 */
  onRetireStaleTopic: TaskCollaborationGroupModel["actions"]["onRetireStaleTopic"];
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
  onResumeAcceptance,
  onRetireStaleTopic,
}: CreateCollaborationWorkspaceViewModelOptions): CollaborationWorkspaceViewModel {
  // 实时协议对象只向 UI 暴露当前可见正文。
  const liveTextByNodeId = Object.fromEntries(
    Object.entries(controller.data.timelineStreams).map(([nodeId, output]) => [nodeId, output.message.text]),
  );

  return {
    showsTaskGroup: controller.navigation.panel === "task-group",
    errorMessage: controller.feedback.error,
    taskGroup: {
      data: {
        snapshot: controller.data.timeline,
        currentTopicStage: evolution.state?.currentTopicStage || null,
        liveTextByNodeId,
      },
      presentation: {
        locale,
        stateReadStatus: controller.data.stateReadStatus,
        deliveryReadStatus: evolution.readStatus,
        timelineReadStatus: controller.data.timelineReadStatus,
        timelineProjectionStatus: controller.data.timelineProjectionStatus,
        readError: evolution.readError || controller.data.timelineReadError,
        readRecovery: evolution.readRecovery,
      },
      actions: {
        onManualApproval,
        onContinueTask,
        onResumeAcceptance,
        onRetireStaleTopic,
        // 空状态入口复用成员导航，只选择韩立并打开其会话页面。
        onOpenHanliConversation: () => controller.actions.openMemberPage("han-li"),
        onRetryDeliveryRead: async () => {
          await evolution.retryRead();
          try {
            await controller.actions.refreshTimeline();
          } catch {
            // 读取失败已成为任务区的明确状态，重试操作不再向页面抛出未处理异常。
          }
        },
        onRetryTimelineRead: async () => { await controller.actions.refreshTimeline(); },
        onRetryTimelineProjection: async () => { await controller.actions.retryTimelineProjection(); },
      },
    },
    memberPage: {
      member: controller.navigation.selectedMember,
      timeline: controller.data.timeline,
      presentation: {
        liveTextByNodeId,
        locale,
        linghuAutomation: controller.data.linghuAutomation,
        stateReadStatus: controller.data.stateReadStatus,
      },
      actions: {
        onLinghuState: controller.actions.setLinghuAutomation,
      },
    },
  };
}
