import type { DeveloperWorkspaceRouterProps } from "./developerWorkspaceRouterTypes";
import type { DeveloperWorkspaceRouterController } from "./useDeveloperWorkspaceRouterController";

/** 页签右上角纯按钮所需的最终显示数据。 */
export type DeveloperWorkspaceTabActionViewModel = {
  /** 当前页面不支持新建会话时不创建按钮。 */
  visible: boolean;
  /** 工具提示与无障碍名称共用这一最终文案。 */
  label: string;
  /** 请求进行中或人物正在回答时禁止重复提交。 */
  disabled: boolean;
  /** 是否显示旋转反馈。 */
  busy: boolean;
  /** 对应 Feature Controller 提供的窄动作。 */
  onClick(): void;
};

type PageBase = {
  /** 当前页签的新建会话动作。 */
  tabAction: DeveloperWorkspaceTabActionViewModel;
};

/** 主 Codex 页只携带主会话真正需要的输入。 */
type MainPageViewModel = PageBase & {
  kind: "main";
  locale: DeveloperWorkspaceRouterProps["locale"];
  sandboxMode: DeveloperWorkspaceRouterProps["sandboxMode"];
  codex: DeveloperWorkspaceRouterProps["codex"];
  screenshot: DeveloperWorkspaceRouterProps["screenshot"];
  collaboration: DeveloperWorkspaceRouterProps["collaboration"];
};

/** 韩立页不接收南宫、Evolution 或主 Codex 的无关状态。 */
type HanliPageViewModel = PageBase & {
  kind: "hanli";
  locale: DeveloperWorkspaceRouterProps["locale"];
  workspaces: DeveloperWorkspaceRouterProps["workspaces"];
  hanli: DeveloperWorkspaceRouterProps["hanli"];
  screenshot: DeveloperWorkspaceRouterProps["screenshot"];
  /** 当前页签是否正是韩立会话，用于把键盘焦点交给需求输入框。 */
  isCurrentPage: boolean;
};

/** 南宫页只携带人物会话、Evolution、审批和截图输入。 */
type NangongPageViewModel = PageBase & {
  kind: "nangong";
  locale: DeveloperWorkspaceRouterProps["locale"];
  workspaces: DeveloperWorkspaceRouterProps["workspaces"];
  nangong: DeveloperWorkspaceRouterProps["nangong"];
  state: NonNullable<DeveloperWorkspaceRouterProps["evolution"]["state"]>;
  onState: DeveloperWorkspaceRouterProps["evolution"]["setState"];
  approval: DeveloperWorkspaceRouterProps["codex"]["interaction"]["approval"];
  screenshot: DeveloperWorkspaceRouterProps["screenshot"];
};

/** 任务群和普通成员页只依赖协作与 Evolution Feature。 */
type CollaborationPageViewModel = PageBase & {
  kind: "collaboration";
  locale: DeveloperWorkspaceRouterProps["locale"];
  collaboration: DeveloperWorkspaceRouterProps["collaboration"];
  evolution: DeveloperWorkspaceRouterProps["evolution"];
};

/** Section 通过 kind 得到具有严格字段范围的页面联合类型。 */
export type DeveloperWorkspacePageViewModel =
  | MainPageViewModel
  | HanliPageViewModel
  | NangongPageViewModel
  | CollaborationPageViewModel;

/** 把稳定页签键转换成客户可读标题。 */
function tabTitle(controller: DeveloperWorkspaceRouterController): string {
  if (controller.tabId === "main") return "Codex Chat";
  if (controller.tabId === "group") return "任务协作群";
  return controller.props.collaboration.navigation.selectedMember?.displayName || "韩立";
}

/** 无新建动作页面使用的空显示模型。 */
function hiddenTabAction(): DeveloperWorkspaceTabActionViewModel {
  return { visible: false, label: "", disabled: false, busy: false, onClick: () => undefined };
}

/** 把路由 Controller 状态转换为页签和页面 Section 可以直接消费的数据。 */
export function createDeveloperWorkspaceRouterViewModel(
  controller: DeveloperWorkspaceRouterController,
) {
  const props = controller.props;

  /** 每个已打开页签只获得自己真正需要的 Feature 输入。 */
  function createPage(key: string): DeveloperWorkspacePageViewModel {
    const collaboration = controller.createCollaborationView(key);
    const { collaborationMode, panel, selectedMember } = collaboration.navigation;
    const memberId = selectedMember?.memberId;

    if (!collaborationMode) {
      return {
        kind: "main",
        locale: props.locale,
        sandboxMode: props.sandboxMode,
        codex: props.codex,
        screenshot: props.screenshot,
        collaboration,
        tabAction: {
          visible: true,
          label: props.locale === "ja" ? "Codex セッションを新しく作り直す" : "重新建立一个 Codex 会话",
          disabled: false,
          busy: false,
          onClick: () => { void props.codex.startNewTask(); },
        },
      };
    }

    if (panel === "member" && memberId === "han-li") {
      return {
        kind: "hanli",
        locale: props.locale,
        workspaces: props.workspaces,
        hanli: props.hanli,
        screenshot: props.screenshot,
        isCurrentPage: key === controller.tabId,
        tabAction: {
          visible: true,
          label: "重新建立韩立对话",
          disabled: props.hanli.newConversationBusy || props.hanli.sending,
          busy: props.hanli.newConversationBusy,
          onClick: () => { void props.hanli.startNewConversation(); },
        },
      };
    }

    if (panel === "member" && memberId === "nangong-wan" && props.evolution.state) {
      return {
        kind: "nangong",
        locale: props.locale,
        workspaces: props.workspaces,
        nangong: props.nangong,
        state: props.evolution.state,
        onState: props.evolution.setState,
        approval: props.codex.interaction.approval,
        screenshot: props.screenshot,
        tabAction: {
          visible: true,
          label: props.locale === "ja" ? "南宮婉の会話を新しく作り直す" : "重新建立南宫婉对话",
          disabled: props.nangong.newConversationBusy || props.nangong.sending,
          busy: props.nangong.newConversationBusy,
          onClick: () => { void props.nangong.startNewConversation(); },
        },
      };
    }

    const tabAction = memberId === "linghu-ancestor"
      ? {
        visible: true,
        label: props.locale === "ja" ? "令狐老祖の会話を新しく作り直す" : "重新建立令狐老祖对话",
        disabled: controller.linghuDisplayConversation.busy,
        busy: controller.linghuDisplayConversation.busy,
        onClick: () => { void controller.linghuDisplayConversation.start(); },
      }
      : hiddenTabAction();
    return {
      kind: "collaboration",
      locale: props.locale,
      collaboration,
      evolution: props.evolution,
      tabAction,
    };
  }

  return {
    requestedTab: controller.state ? { id: controller.tabId, label: tabTitle(controller) } : null,
    revision: controller.revision,
    onActivate: controller.activateTab,
    createPage,
  };
}

/** Router 入口使用的完整显示模型类型。 */
export type DeveloperWorkspaceRouterViewModel = ReturnType<typeof createDeveloperWorkspaceRouterViewModel>;
