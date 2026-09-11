import type { DeveloperWorkspaceRouterProps } from "./developerWorkspaceRouterTypes";
import { useLinghuDisplayConversationController } from "./useLinghuDisplayConversationController";

/** 根据当前协作导航生成稳定页签键。 */
function currentTabId(props: DeveloperWorkspaceRouterProps): string {
  const { collaborationMode, panel, selectedMember } = props.collaboration.navigation;
  if (!collaborationMode) return "main";
  if (panel === "task-group") return "group";
  return `member:${selectedMember?.memberId || "han-li"}`;
}

/** 工作区路由 Controller 只负责页签状态转换和令狐副作用。 */
export function useDeveloperWorkspaceRouterController(props: DeveloperWorkspaceRouterProps) {
  const collaboration = props.collaboration;
  const { state } = collaboration.data;
  const { collaborationMode, selectedMember } = collaboration.navigation;
  const { setOperatingMode, selectMember, syncPanel } = collaboration.actions;
  const linghuDisplayConversation = useLinghuDisplayConversationController({
    onError: collaboration.actions.setError,
    onState: collaboration.actions.setLinghuAutomation,
  });

  /** 用户切换页签时，只更新导航投影，不修改任务事实。 */
  function activateTab(key: string) {
    if (key === "main") {
      if (collaborationMode) void setOperatingMode("single-conversation");
      return;
    }
    if (!collaborationMode) void setOperatingMode("collaboration");
    if (key === "group") {
      syncPanel("task-group");
      return;
    }
    syncPanel("member");
    const memberId = key.slice("member:".length);
    if (selectedMember?.memberId !== memberId) void selectMember(memberId);
  }

  /** 为一个已打开页签建立独立导航投影，权威协作数据仍由原 Feature 持有。 */
  function createCollaborationView(key: string) {
    const memberId = key.slice("member:".length);
    const pageMember = state?.members.find((item) => item.memberId === memberId) || selectedMember;
    const selectedMemberTasks = state?.tasks.filter((task) => {
      if (collaboration.configuration.terminalTaskStates.has(task.state)) return false;
      if (task.executorMemberId === pageMember?.memberId) return true;
      if (task.initiator?.memberId === pageMember?.memberId) return true;
      return task.executionRecords.some((record) => record.executor.memberId === pageMember?.memberId);
    }) || [];
    const panel = key === "group" ? "task-group" : "member";
    return {
      ...collaboration,
      navigation: {
        ...collaboration.navigation,
        collaborationMode: key !== "main",
        panel: panel as typeof collaboration.navigation.panel,
        selectedMember: pageMember,
        selectedMemberTasks,
      },
    };
  }

  return {
    props,
    state,
    tabId: currentTabId(props),
    revision: collaboration.navigation.revision,
    activateTab,
    createCollaborationView,
    linghuDisplayConversation,
  };
}

/** ViewModel 使用的路由 Controller 类型。 */
export type DeveloperWorkspaceRouterController = ReturnType<typeof useDeveloperWorkspaceRouterController>;
