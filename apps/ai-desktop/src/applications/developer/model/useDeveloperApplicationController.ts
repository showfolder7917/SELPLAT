import { useRef, useState } from "react";

import { useCollaborationWorkspace } from "../../../features/collaboration";
import { useCodexWorkspace, usePersonaConversation } from "../../../features/conversation";
import { useEvolutionRuntime } from "../../../features/evolution";
import { useScreenshotCapture, type ScreenshotDestination } from "../../../features/screenshot";
import { useDesktopDiagnostics, useDesktopSettings } from "../../../features/settings";
import { useWorkspaceRegistry } from "../../../features/workspace";
import { useSelUi } from "../../../theme/SelUiProvider";
import { developerApplicationLabels } from "./developerApplicationLabels";
import { getDeveloperPersonaActivities } from "./getDeveloperPersonaActivities";
import { useDeveloperSidebar } from "./useDeveloperSidebar";
import { useDeveloperTooltip } from "./useDeveloperTooltip";

/** 准备 Developer 窗口需要的状态；主组件只负责展示窗体布局。 */
export function useDeveloperApplicationController() {
  // SELUI 提供删除工作区时使用的统一确认框。
  const selUi = useSelUi();
  // 外壳引用用于把工具提示限制在当前 Developer 窗口。
  const shellRef = useRef<HTMLDivElement>(null);
  // 设置面板打开时，设置和诊断控制器会刷新桌面数据。
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 测试台是独立只读窗口，打开时会关闭设置窗口以避免活动栏浮层互相遮挡。
  const [testConsoleOpen, setTestConsoleOpen] = useState(false);
  // 任务区域可以独立折叠，不影响左侧栏本身。
  const [tasksExpanded, setTasksExpanded] = useState(true);

  // 设置先提供语言和沙箱模式，后续控制器共享这些配置。
  const settings = useDesktopSettings(settingsOpen || testConsoleOpen);
  const text = developerApplicationLabels[settings.locale];
  const sidebar = useDeveloperSidebar(settings.locale);
  const diagnostics = useDesktopDiagnostics(settingsOpen || testConsoleOpen, settings.locale);

  /** 打开设置时关闭测试台，两个活动栏窗口始终只有一个接收用户操作。 */
  const setSettingsPanelOpen = (open: boolean) => {
    setSettingsOpen(open);
    if (open) setTestConsoleOpen(false);
  };

  /** 打开测试台时关闭设置，并触发模型与诊断状态刷新。 */
  const setTestConsolePanelOpen = (open: boolean) => {
    setTestConsoleOpen(open);
    if (open) setSettingsOpen(false);
  };

  // 工作区列表的“移除”只删除登记信息，不删除磁盘目录。
  const workspace = useWorkspaceRegistry({
    confirmRemove: (name) => selUi.confirm({
      title: text.remove,
      message: text.removeConfirm.replace("{name}", name),
      target: name,
      tone: "danger",
    }),
  });

  // 协作、人物演化和两个人物会话分别持有自己的业务状态。
  const collaboration = useCollaborationWorkspace();
  const evolution = useEvolutionRuntime();
  const hanli = usePersonaConversation("han-li");
  const nangong = usePersonaConversation("nangong-wan");

  // 主 Codex 控制器负责登录、审批、任务执行和审计刷新。
  const codex = useCodexWorkspace({
    locale: settings.locale,
    sandboxMode: settings.sandboxMode,
    attachmentLabel: text.attachment,
    automaticTestLabel: text.automaticTestTriggered,
    signedOutMessage: text.signedOut,
    browserOpenedMessage: text.browserOpened,
    workspaces: workspace.workspaces,
    collaboration,
    onOpenSettings: () => setSettingsPanelOpen(true),
    onTrustedCommandChanged: diagnostics.refreshTrustedCommandInfo,
    onAuditChanged: diagnostics.refreshAuditInfo,
  });

  /** 按截图目标读取对应会话的附件。 */
  function getAttachments(destination: ScreenshotDestination) {
    if (destination === "hanli") return hanli.attachments;
    if (destination === "nangong") return nangong.attachments;
    return codex.conversation.attachments;
  }

  /** 截图完成后只更新目标会话，防止图片进入错误会话。 */
  function setAttachments(destination: ScreenshotDestination, updater: Parameters<typeof codex.conversation.setAttachments>[0]) {
    if (destination === "hanli") {
      hanli.setAttachments(updater);
      return;
    }
    if (destination === "nangong") {
      nangong.setAttachments(updater);
      return;
    }
    codex.conversation.setAttachments(updater);
  }

  // 截图控制器通过明确接口访问会话，不直接依赖整个页面组件。
  const screenshot = useScreenshotCapture({
    locale: settings.locale,
    screenSourceUnavailable: text.screenSourceUnavailable,
    setMainInput: codex.conversation.setInput,
    closeSettings: () => setSettingsPanelOpen(false),
    refreshTempInfo: diagnostics.refreshTempInfo,
    getAttachments,
    setAttachments,
  });

  // 左侧人物状态由当前页面、回复、调查和审批状态共同决定。
  const personaConversationActivities = getDeveloperPersonaActivities({ collaboration, codex, hanli, nangong });
  // 工具提示跟随整个 Developer 外壳创建和销毁。
  useDeveloperTooltip(shellRef);

  // 按页面区块分组返回，主组件可以直接对应到可见布局。
  return {
    shell: { ref: shellRef, sidebar },
    settingsPanel: { open: settingsOpen, setOpen: setSettingsPanelOpen },
    testConsolePanel: { open: testConsoleOpen, setOpen: setTestConsolePanelOpen },
    tasks: { expanded: tasksExpanded, toggle: () => setTasksExpanded((current) => !current) },
    text,
    settings,
    diagnostics,
    workspace,
    collaboration,
    evolution,
    hanli,
    nangong,
    codex,
    screenshot,
    personaConversationActivities,
  };
}

/** Developer ViewModel 只读取该类型暴露的应用状态和业务动作。 */
export type DeveloperApplicationController = ReturnType<typeof useDeveloperApplicationController>;
