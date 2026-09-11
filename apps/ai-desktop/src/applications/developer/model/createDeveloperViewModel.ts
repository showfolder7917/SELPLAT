import type { DeveloperViewModel } from "./developerViewModelTypes";
import type { DeveloperApplicationController } from "./useDeveloperApplicationController";

/** 把数据库诊断状态转换为右侧工作区可以直接显示的恢复提示。 */
function createMemoryRecoveryViewModel(controller: DeveloperApplicationController) {
  const memoryStatus = controller.diagnostics.aiMemoryDatabaseStatus;
  // 数据库正常或尚未取得诊断结果时，不占用页面空间。
  if (!memoryStatus || memoryStatus.state === "ready") return null;

  // 中文是默认回退语言，避免未来未知语言产生空白提示。
  let title = "AI Memory 数据库已停用";
  let message = memoryStatus.message || "请恢复数据库后重新启动。";
  if (controller.settings.locale === "ja") {
    title = "AI Memory データベースは停止中です";
    message = "設定、移行、または整合性の問題を確認し、元のデータベースを復旧してから再起動してください。";
  }

  return { state: memoryStatus.state, title, message };
}

/**
 * 将应用 Controller 转换为按窗口区域切分的 Developer ViewModel。
 *
 * 本函数只读取状态并包装现有动作，不发请求、不渲染 JSX，也不修改业务数据。
 */
export function createDeveloperViewModel(controller: DeveloperApplicationController): DeveloperViewModel {
  const sidebar = controller.shell.sidebar;

  return {
    // 窗口外壳只取得网格、语言和 DOM 引用。
    shell: {
      shellRef: controller.shell.ref,
      locale: controller.settings.locale,
      collapsed: sidebar.collapsed,
      style: sidebar.shellStyle,
    },
    // 侧栏纯组件只取得显示值和具名事件。
    sidebar: {
      collapsed: sidebar.collapsed,
      width: sidebar.width,
      minimumWidth: sidebar.minimumWidth,
      maximumWidth: sidebar.maximumWidth,
      toggleLabel: sidebar.toggleLabel,
      resizeLabel: controller.settings.locale === "ja" ? "サイドバーの幅" : "调整侧栏宽度",
      onToggle: sidebar.toggle,
      onPointerResize: sidebar.resizeWithPointer,
      onKeyboardResize: sidebar.resizeWithKeyboard,
      onResetWidth: sidebar.resetWidth,
    },
    // 标题栏不需要知道完整工作区控制器。
    titleBar: {
      projectRoot: controller.workspace.projectRoot,
      title: controller.text.title,
    },
    // 活动栏只获得设置 Feature 所需的窄输入。
    activity: {
      open: controller.settingsPanel.open,
      onOpenChange: controller.settingsPanel.setOpen,
      status: controller.codex.interaction.status,
      loginHint: controller.codex.interaction.loginHint,
      text: controller.text,
      settings: controller.settings,
      diagnostics: controller.diagnostics,
      workspace: controller.workspace,
      onLogin: () => { void controller.codex.interaction.login(); },
      onLogout: () => { void controller.codex.interaction.logout(); },
      onTempFilesCleared: () => controller.codex.conversation.setAttachments([]),
    },
    // Explorer 只获得任务导航和协作 Feature 所需的数据。
    explorer: {
      evolution: controller.evolution.state,
      expanded: controller.tasks.expanded,
      locale: controller.settings.locale,
      auditTask: controller.diagnostics.auditInfo?.latestTask || null,
      personaConversationActivities: controller.personaConversationActivities,
      collaboration: controller.collaboration,
      onToggle: controller.tasks.toggle,
    },
    // 工作区把异常提示和页面路由分成两个明确输入。
    workspace: {
      memoryRecovery: createMemoryRecoveryViewModel(controller),
      router: {
        locale: controller.settings.locale,
        sandboxMode: controller.settings.sandboxMode,
        workspaces: controller.workspace.workspaces,
        collaboration: controller.collaboration,
        codex: controller.codex,
        evolution: controller.evolution,
        hanli: controller.hanli,
        nangong: controller.nangong,
        screenshot: controller.screenshot,
      },
    },
    // 状态栏不读取设置或诊断控制器的其他字段。
    statusBar: {
      sandboxMode: controller.settings.sandboxMode,
      memoryStatus: controller.diagnostics.aiMemoryDatabaseStatus,
      locale: controller.settings.locale,
    },
    // 审批弹窗继续复用主会话控制器，但不接触其他应用状态。
    approvalDialog: {
      controller: controller.codex,
      locale: controller.settings.locale,
    },
  };
}
