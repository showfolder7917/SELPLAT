/**
 * Developer 左侧栏的协同任务导航。
 *
 * 本组件只选择任务协作群或人物；右侧内容由 DeveloperWorkspaceRouter 渲染。
 */

import {
  // 分支图标表示多个人物共同处理的任务协作群。
  Branch24Regular,
} from "@fluentui/react-icons";

import type {
  // 人物演化状态用于细化韩立和南宫婉当前显示状态。
  EvolutionStateOutDto,
  // 界面语言决定任务群和人物状态使用中文还是日文。
  LocaleValue,
} from "../../../../contracts/system/desktop/index";
import {
  // 人物圆点状态综合后端状态与当前会话活动。
  collaborationMemberPresenceState,
  // 人物文字状态综合任务时间线、演化状态和会话活动。
  collaborationMemberStateLabel,
  // 人物会话活动描述正在回复、核实、创建会话或等待授权。
  type PersonaConversationActivity,
  // 协作控制器提供当前人物、任务群时间线和页面选择操作。
  type useCollaborationWorkspace,
} from "../../../features/collaboration";

type CollaborationController = ReturnType<typeof useCollaborationWorkspace>;

type CollaborationTaskNavigationProps = {
  /** 协作状态和页面操作的唯一控制器。 */
  controller: CollaborationController;
  /** 韩立和南宫婉当前共同研讨状态。 */
  evolution: EvolutionStateOutDto | null;
  /** 当前界面语言。 */
  locale: LocaleValue;
  /** 每个人物独立会话页面当前正在进行的临时活动。 */
  personaConversationActivities: Record<string, PersonaConversationActivity | null>;
};

/** 协同导航展示任务群入口和全部真实成员。 */
export function CollaborationTaskNavigation({
  controller,
  evolution,
  locale,
  personaConversationActivities,
}: CollaborationTaskNavigationProps) {
  // 权威数据提供成员列表和任务群时间线。
  const { state, timeline } = controller.data;
  // 导航状态提供当前选中的页面。
  const { panel } = controller.navigation;
  // 导航操作集中负责选人和切换右侧页面。
  const { setPanel, openMemberPage } = controller.actions;

  /** 任务群按钮只切换右侧面板，不修改协作任务数据。 */
  const openTaskGroup = () => setPanel("task-group");

  return (
    <>
      <button
        type="button"
        className={`collaboration-task-group-entry ${panel === "task-group" ? "selected" : ""}`}
        aria-pressed={panel === "task-group"}
        onClick={openTaskGroup}
      >
        <span>
          <Branch24Regular />
          {locale === "ja" ? "タスク協同グループ" : "任务协作群"}
        </span>
        <strong>{timeline?.groups.length || 0}</strong>
      </button>

      <div className="collaboration-member-list">
        {state?.members.map((member) => {
          const conversationActivity = personaConversationActivities[member.memberId];
          const memberSelected = panel === "member" && member.memberId === state.selectedMemberId;
          const presenceState = collaborationMemberPresenceState(member, conversationActivity);
          const stateLabel = collaborationMemberStateLabel({
            member,
            locale,
            timeline,
            evolution,
            conversationActivity,
          });
          const selectCurrentMember = () => void openMemberPage(member.memberId);

          return (
            <button
              type="button"
              key={member.memberId}
              className={`collaboration-member ${memberSelected ? "selected" : ""}`}
              aria-pressed={memberSelected}
              onClick={selectCurrentMember}
            >
              <span>
                <i className={presenceState} />
                {member.displayName}
              </span>
              <small>{stateLabel}</small>
            </button>
          );
        })}
      </div>
    </>
  );
}
