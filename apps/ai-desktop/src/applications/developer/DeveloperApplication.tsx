import {
  // 生命周期副作用：挂接页面级工具提示并在卸载时清理。
  useEffect,
  // DOM 引用：保存桌面壳节点，供工具提示查找真实元素。
  useRef,
  // 页面状态：保存设置面板、侧栏展开和侧栏宽度。
  useState,
  // 样式类型：约束传给布局组件的 CSS 自定义属性。
  type CSSProperties,
  // 键盘事件类型：约束侧栏分隔条的键盘调整操作。
  type KeyboardEvent as ReactKeyboardEvent,
  // 指针事件类型：约束拖动侧栏分隔条的起始事件。
  type PointerEvent as ReactPointerEvent,
} from "react";
import { PanelLeft24Regular } from "@fluentui/react-icons";

import {
  // 协作资源树：显示成员与任务入口。
  CollaborationExplorerFeature,
  // 协作控制器：集中持有成员、任务和恢复操作。
  useCollaborationWorkspace,
} from "../../features/collaboration";
import {
  // 命令审批框：承接 Codex 需要客户确认的操作。
  CodexApprovalDialog,
  // Codex 会话控制器：集中持有消息、输入和执行状态。
  useCodexWorkspace,
  // 人物会话控制器：供韩立和南宫婉复用同一套能力。
  usePersonaConversation,
} from "../../features/conversation";
import { useEvolutionRuntime } from "../../features/evolution";
import {
  // 截图控制器：集中处理选区、附件和屏幕权限。
  useScreenshotCapture,
  // 截图目标类型：限制附件只能进入已登记的会话。
  type ScreenshotDestination,
} from "../../features/screenshot";
import {
  // 设置页面：显示连接、权限和运行选项。
  DeveloperSettingsFeature,
  // 诊断控制器：读取可信命令、临时文件和业务日志。
  useDesktopDiagnostics,
  // 设置控制器：读取并保存桌面运行配置。
  useDesktopSettings,
} from "../../features/settings";
import { useWorkspaceRegistry } from "../../features/workspace";
import { useSelUi } from "../../theme/SelUiProvider";
import { DeveloperWorkspaceRouter } from "./DeveloperWorkspaceRouter";
import { DeveloperActivityBar } from "./layout/DeveloperActivityBar";
import { DeveloperExplorer } from "./layout/DeveloperExplorer";
import { DeveloperShell, DeveloperTitleBar } from "./layout/DeveloperShell";
import { DeveloperStatusBar } from "./layout/DeveloperStatusBar";
import { DeveloperWorkspace } from "./layout/DeveloperWorkspace";
import "@selplat/sel-ui/core/kernel";
import "@selplat/sel-ui/components/floating-panel";
import "@selplat/sel-ui/components/floating-panel/styles";
import "@selplat/sel-ui/components/tooltip";
import "@selplat/sel-ui/components/tooltip/styles";
import "@selplat/sel-ui/components/context-menu";
import "@selplat/sel-ui/components/context-menu/styles";
import "@selplat/sel-ui/components/disclosure";
import "@selplat/sel-ui/components/disclosure/styles";
import "@selplat/sel-ui/components/tree";
import "@selplat/sel-ui/components/tree/styles";
import "@selplat/sel-ui/components/grid";
import "@selplat/sel-ui/components/grid/styles";
import "@selplat/sel-ui/components/search";
import "@selplat/sel-ui/components/search/styles";
import "@selplat/sel-ui/components/switch/styles";
import "../styles/desktop-applications.css";

type SelTooltipController = { destroy: () => boolean };
type SelTooltipApi = { attach: (host: Element, options: Record<string, unknown>) => SelTooltipController | null };

/** 侧栏宽度边界：保证资源树不会窄到无法阅读，也不会挤占大部分对话区。 */
function clampSidebarWidth(width: number): number {
  return Math.max(220, Math.min(520, width));
}

/** 侧栏开关说明：同时考虑界面语言和当前收起状态，避免 JSX 中出现嵌套三元判断。 */
function sidebarToggleLabel(locale: "ja" | "zh-CN", collapsed: boolean): string {
  if (locale === "ja") return collapsed ? "サイドバーを展開" : "サイドバーを折りたたむ";
  return collapsed ? "展开侧栏" : "折叠侧栏";
}

const labels = {
  ja: {
    title: "Developer", settings: "接続と実行設定",
    workspaces: "WORKSPACES", addWorkspace: "ワークスペースを追加", primary: "メイン", makePrimary: "メインに設定",
    remove: "削除", removeConfirm: "ワークスペース一覧から「{name}」を削除しますか？ディスク上のフォルダーは削除されません。",
    minimumWorkspace: "ワークスペースを1つ以上残してください", readOnly: "読み取り専用", write: "ワークスペース書き込み",
    readOnlyTip: "現在は読み取り専用", writeTip: "現在は書き込み可能", account: "ChatGPT アカウント",
    signedOut: "ChatGPT にログインしてください", signOut: "ログアウト", signIn: "ChatGPT でログイン",
    browserOpened: "ブラウザーでログインを完了してください", tempFiles: "一時ファイル", openTemp: "一時フォルダーを開く",
    clearTemp: "すべて消去", clearConfirm: "AI Desktop の一時ファイルをすべて削除しますか？", trustedCommands: "信頼済みコマンド",
    trustHint: "同じプロジェクトとコマンドは次回から自動的に許可されます。", clearTrustedCommands: "信頼をすべて解除",
    clearTrustedConfirm: "登録済みの信頼コマンドをすべて解除しますか？", auditLogs: "業務ログ", openAuditLogs: "ログフォルダーを開く",
    noAuditTask: "タスク履歴はまだありません", attachment: "画像添付", automaticTestTriggered: "自動テスト",
    screenSourceUnavailable: "画面ソースを読み取れません。画面収録の権限を確認してから再試行してください。",
  },
  "zh-CN": {
    title: "Developer", settings: "连接与执行设置",
    workspaces: "工作区", addWorkspace: "添加工作区", primary: "主目录", makePrimary: "设为主目录", remove: "移除",
    removeConfirm: "确定从工作区列表移除“{name}”吗？不会删除磁盘中的真实目录。", minimumWorkspace: "至少保留一个工作区",
    readOnly: "只读", write: "工作区写入", readOnlyTip: "当前只读", writeTip: "当前可写入", account: "ChatGPT 账号",
    signedOut: "请先登录 ChatGPT", signOut: "退出登录", signIn: "使用 ChatGPT 登录", browserOpened: "请在浏览器中完成登录",
    tempFiles: "临时文件", openTemp: "临时目录", clearTemp: "一键清理", clearConfirm: "确定清理 AI Desktop temp 中的全部临时文件吗？",
    trustedCommands: "可信命令", trustHint: "相同项目和命令下次将自动允许。", clearTrustedCommands: "清除全部信任",
    clearTrustedConfirm: "确定清除全部项目可信命令吗？", auditLogs: "业务日志", openAuditLogs: "打开日志目录",
    noAuditTask: "暂无任务记录", attachment: "图片附件", automaticTestTriggered: "自动测试",
    screenSourceUnavailable: "无法读取屏幕来源，请检查屏幕录制权限后重试。",
  },
} as const;

/** Developer 窗口只装配布局、Feature 控制器和最小导航状态。 */
export function DeveloperApplication() {
  const selUi = useSelUi();
  const shellRef = useRef<HTMLDivElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tasksExpanded, setTasksExpanded] = useState(true);
  // 通用侧栏布局与任务、人物会话独立；收起时不卸载业务控件。
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const resizeSidebar = (event: ReactPointerEvent<HTMLDivElement>) => {
    const handle = event.currentTarget;
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    handle.setPointerCapture(event.pointerId);
    const move = (next: PointerEvent) => {
      const movedWidth = startWidth + next.clientX - startX;
      setSidebarWidth(clampSidebarWidth(movedWidth));
    };
    const stop = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  };
  const settings = useDesktopSettings(settingsOpen);
  const text = labels[settings.locale];
  const diagnostics = useDesktopDiagnostics(settingsOpen, settings.locale);
  const workspace = useWorkspaceRegistry({ confirmRemove: (name) => selUi.confirm({ title: text.remove, message: text.removeConfirm.replace("{name}", name), target: name, tone: "danger" }) });
  const collaboration = useCollaborationWorkspace();
  const evolution = useEvolutionRuntime();
  // 两个人物使用同一个会话控制器；以后新增人物只需要传新的 personaId。
  const hanli = usePersonaConversation("han-li");
  const nangong = usePersonaConversation("nangong-wan");
  const codex = useCodexWorkspace({
    locale: settings.locale,
    sandboxMode: settings.sandboxMode,
    attachmentLabel: text.attachment,
    automaticTestLabel: text.automaticTestTriggered,
    signedOutMessage: text.signedOut,
    browserOpenedMessage: text.browserOpened,
    workspaces: workspace.workspaces,
    collaboration,
    onOpenSettings: () => setSettingsOpen(true),
    onTrustedCommandChanged: diagnostics.refreshTrustedCommandInfo,
    onAuditChanged: diagnostics.refreshAuditInfo,
  });
  /** 截图附件读取：按明确会话目标返回对应功能自己持有的待发送图片。 */
  const getAttachments = (destination: ScreenshotDestination) => {
    if (destination === "hanli") return hanli.attachments;
    if (destination === "nangong") return nangong.attachments;
    return codex.conversation.attachments;
  };
  /** 截图附件写回：只更新目标会话，防止三个会话共用一份可变附件状态。 */
  const setAttachments = (destination: ScreenshotDestination, updater: Parameters<typeof codex.conversation.setAttachments>[0]) => {
    if (destination === "hanli") {
      hanli.setAttachments(updater);
      return;
    }
    if (destination === "nangong") {
      nangong.setAttachments(updater);
      return;
    }
    codex.conversation.setAttachments(updater);
  };
  const screenshot = useScreenshotCapture({
    // 界面语言：截图功能据此返回对应语言的权限错误。
    locale: settings.locale,
    // 屏幕来源错误：截图功能在系统不允许捕获时显示该文案。
    screenSourceUnavailable: text.screenSourceUnavailable,
    // 主会话输入：截图识别结果需要写回 Codex 编辑框时使用。
    setMainInput: codex.conversation.setInput,
    // 设置面板关闭：开始截图前移除可能挡住目标的浮层。
    closeSettings: () => setSettingsOpen(false),
    // 临时文件刷新：截图完成后让诊断页看到最新占用。
    refreshTempInfo: diagnostics.refreshTempInfo,
    // 附件读取边界：截图功能不直接依赖三个会话控制器。
    getAttachments,
    // 附件写回边界：截图功能通过目标标识将图片交还真实会话所有者。
    setAttachments,
  });
  // 当前人物页和后台未完成回复共同决定会话显示状态；协作调度仍使用后端成员状态。
  const activePersonaId = collaboration.collaborationMode && collaboration.panel === "member" ? collaboration.selectedMember?.memberId : null;
  let hanliActivity: "active" | "responding" | "creating" | "waiting-approval" | null = null;
  if (codex.interaction.approval?.ownerMemberId === "han-li") {
    hanliActivity = "waiting-approval";
  } else if (hanli.newConversationBusy) {
    hanliActivity = "creating";
  } else if (hanli.sending) {
    hanliActivity = "responding";
  } else if (activePersonaId === "han-li") {
    hanliActivity = "active";
  }

  let nangongActivity: "active" | "responding" | "investigating" | "creating" | "waiting-approval" | null = null;
  if (codex.interaction.approval?.ownerMemberId === "nangong-wan") {
    nangongActivity = "waiting-approval";
  } else if (nangong.newConversationBusy) {
    nangongActivity = "creating";
  } else if (nangong.sending) {
    nangongActivity = "responding";
  } else if (hanli.delegatedResponderPersonaId === "nangong-wan") {
    nangongActivity = "investigating";
  } else if (activePersonaId === "nangong-wan") {
    nangongActivity = "active";
  }
  const personaConversationActivities = {
    "han-li": hanliActivity,
    "nangong-wan": nangongActivity,
  };
  const toggleLabel = sidebarToggleLabel(settings.locale, sidebarCollapsed);

  /** 侧栏开关：收起时保留业务组件状态，只改变布局可见性。 */
  function toggleSidebar() {
    setSidebarCollapsed((value) => !value);
  }

  /** 侧栏宽度键盘操作：Home 恢复默认宽度，左右键按固定步长调整。 */
  function resizeSidebarWithKeyboard(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Home") {
      event.preventDefault();
      setSidebarWidth(260);
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowLeft" ? -16 : 16;
    setSidebarWidth((width) => clampSidebarWidth(width + direction));
  }

  useEffect(() => {
    const host = shellRef.current;
    const tooltip = (window as typeof window & { sel?: { components?: { tooltip?: SelTooltipApi } } }).sel?.components?.tooltip;
    if (!host || !tooltip) return;
    const controller = tooltip.attach(host, { id: "ai-desktop:developer-tooltip", selector: "[data-sel-tooltip]", delay: 260 });
    return () => { controller?.destroy(); };
  }, []);

  return (
    <DeveloperShell
      shellRef={shellRef}
      locale={settings.locale}
      collapsed={sidebarCollapsed}
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      {/* 侧栏开关：收起后仍保留任务和人物会话的运行状态。 */}
      <button
        className="sidebar-toggle"
        type="button"
        aria-controls="collaboration-sidebar"
        aria-expanded={!sidebarCollapsed}
        aria-label={toggleLabel}
        onClick={toggleSidebar}
      >
        <PanelLeft24Regular />
      </button>
      <DeveloperTitleBar projectRoot={workspace.projectRoot} title={text.title} />
      <DeveloperActivityBar
        settingsControl={(
          <DeveloperSettingsFeature
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            status={codex.interaction.status}
            loginHint={codex.interaction.loginHint}
            text={text}
            settings={settings}
            diagnostics={diagnostics}
            workspace={workspace}
            onLogin={() => void codex.interaction.login()}
            onLogout={() => void codex.interaction.logout()}
            onTempFilesCleared={() => codex.conversation.setAttachments([])}
          />
        )}
      />
      <DeveloperExplorer>
        <CollaborationExplorerFeature
          evolution={evolution.state}
          expanded={tasksExpanded}
          locale={settings.locale}
          auditTask={diagnostics.auditInfo?.latestTask || null}
          personaConversationActivities={personaConversationActivities}
          controller={collaboration}
          onToggle={() => setTasksExpanded((current) => !current)}
        />
      </DeveloperExplorer>
      {!sidebarCollapsed && (
        <div
          className="sidebar-resizer"
          role="separator"
          aria-label={settings.locale === "ja" ? "サイドバーの幅" : "调整侧栏宽度"}
          aria-orientation="vertical"
          aria-valuemin={220}
          aria-valuemax={520}
          aria-valuenow={sidebarWidth}
          tabIndex={0}
          onPointerDown={resizeSidebar}
          onDoubleClick={() => setSidebarWidth(260)}
          onKeyDown={resizeSidebarWithKeyboard}
        />
      )}
      <DeveloperWorkspace>
        {diagnostics.aiMemoryDatabaseStatus && diagnostics.aiMemoryDatabaseStatus.state !== "ready" && (
          <div className={`ai-memory-recovery ${diagnostics.aiMemoryDatabaseStatus.state}`} role="alert">
            <strong>{settings.locale === "ja" ? "AI Memory データベースは停止中です" : "AI Memory 数据库已停用"}</strong>
            <span>
              {settings.locale === "ja"
                ? "設定、移行、または整合性の問題を確認し、元のデータベースを復旧してから再起動してください。"
                : diagnostics.aiMemoryDatabaseStatus.message || "请恢复数据库后重新启动。"}
            </span>
          </div>
        )}
        <DeveloperWorkspaceRouter
          locale={settings.locale}
          sandboxMode={settings.sandboxMode}
          workspaces={workspace.workspaces}
          collaboration={collaboration}
          codex={codex}
          evolution={evolution}
          hanli={hanli}
          nangong={nangong}
          screenshot={screenshot}
        />
      </DeveloperWorkspace>
      <DeveloperStatusBar
        sandboxMode={settings.sandboxMode}
        memoryStatus={diagnostics.aiMemoryDatabaseStatus}
        locale={settings.locale}
      />
      <CodexApprovalDialog controller={codex} locale={settings.locale} />
    </DeveloperShell>
  );
}
