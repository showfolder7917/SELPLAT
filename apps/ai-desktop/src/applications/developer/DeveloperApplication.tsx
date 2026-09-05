import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { PanelLeft24Regular } from "@fluentui/react-icons";

import { CollaborationExplorerFeature } from "../../features/collaboration/components/CollaborationExplorerFeature";
import { useCollaborationWorkspace } from "../../features/collaboration/model/useCollaborationWorkspace";
import { CodexApprovalDialog } from "../../features/conversation/components/CodexApprovalDialog";
import { useCodexWorkspace } from "../../features/conversation/model/useCodexWorkspace";
import { useEvolutionRuntime } from "../../features/evolution/model/useEvolutionRuntime";
import { usePersonaConversation } from "../../features/conversation/model/usePersonaConversation";
import { useScreenshotCapture, type ScreenshotDestination } from "../../features/screenshot/model/useScreenshotCapture";
import { DeveloperSettingsFeature } from "../../features/settings/components/DeveloperSettingsFeature";
import { useDesktopDiagnostics } from "../../features/settings/model/useDesktopDiagnostics";
import { useDesktopSettings } from "../../features/settings/model/useDesktopSettings";
import { useWorkspaceRegistry } from "../../features/workspace/model/useWorkspaceRegistry";
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
  const clampSidebarWidth = (width: number) => Math.max(220, Math.min(520, width));
  const resizeSidebar = (event: ReactPointerEvent<HTMLDivElement>) => {
    const handle = event.currentTarget;
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    handle.setPointerCapture(event.pointerId);
    const move = (next: PointerEvent) => setSidebarWidth(clampSidebarWidth(startWidth + next.clientX - startX));
    const stop = () => { handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", stop); handle.removeEventListener("pointercancel", stop); };
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
  const getAttachments = (destination: ScreenshotDestination) => destination === "hanli" ? hanli.attachments : destination === "nangong" ? nangong.attachments : codex.conversation.attachments;
  const setAttachments = (destination: ScreenshotDestination, updater: Parameters<typeof codex.conversation.setAttachments>[0]) => {
    if (destination === "hanli") hanli.setAttachments(updater);
    else if (destination === "nangong") nangong.setAttachments(updater);
    else codex.conversation.setAttachments(updater);
  };
  const screenshot = useScreenshotCapture({ locale: settings.locale, screenSourceUnavailable: text.screenSourceUnavailable, setMainInput: codex.conversation.setInput, closeSettings: () => setSettingsOpen(false), refreshTempInfo: diagnostics.refreshTempInfo, getAttachments, setAttachments });
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

  useEffect(() => {
    const host = shellRef.current;
    const tooltip = (window as typeof window & { sel?: { components?: { tooltip?: SelTooltipApi } } }).sel?.components?.tooltip;
    if (!host || !tooltip) return;
    const controller = tooltip.attach(host, { id: "ai-desktop:developer-tooltip", selector: "[data-sel-tooltip]", delay: 260 });
    return () => { controller?.destroy(); };
  }, []);

  return <DeveloperShell shellRef={shellRef} locale={settings.locale} collapsed={sidebarCollapsed} style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
    <button className="sidebar-toggle" type="button" aria-controls="collaboration-sidebar" aria-expanded={!sidebarCollapsed} aria-label={settings.locale === "ja" ? (sidebarCollapsed ? "サイドバーを展開" : "サイドバーを折りたたむ") : (sidebarCollapsed ? "展开侧栏" : "折叠侧栏")} onClick={() => setSidebarCollapsed((value) => !value)}><PanelLeft24Regular /></button>
    <DeveloperTitleBar projectRoot={workspace.projectRoot} title={text.title} />
    <DeveloperActivityBar settingsControl={<DeveloperSettingsFeature open={settingsOpen} onOpenChange={setSettingsOpen} status={codex.interaction.status} loginHint={codex.interaction.loginHint} text={text} settings={settings} diagnostics={diagnostics} workspace={workspace} onLogin={() => void codex.interaction.login()} onLogout={() => void codex.interaction.logout()} onTempFilesCleared={() => codex.conversation.setAttachments([])} />} />
    <DeveloperExplorer>
      <CollaborationExplorerFeature evolution={evolution.state} expanded={tasksExpanded} locale={settings.locale} auditTask={diagnostics.auditInfo?.latestTask || null} personaConversationActivities={personaConversationActivities} controller={collaboration} onToggle={() => setTasksExpanded((current) => !current)} />
    </DeveloperExplorer>
    {!sidebarCollapsed && <div className="sidebar-resizer" role="separator" aria-label={settings.locale === "ja" ? "サイドバーの幅" : "调整侧栏宽度"} aria-orientation="vertical" aria-valuemin={220} aria-valuemax={520} aria-valuenow={sidebarWidth} tabIndex={0} onPointerDown={resizeSidebar} onDoubleClick={() => setSidebarWidth(260)} onKeyDown={(event) => { if (event.key === "Home") { event.preventDefault(); setSidebarWidth(260); } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); setSidebarWidth((width) => clampSidebarWidth(width + (event.key === "ArrowLeft" ? -16 : 16))); } }} />}
    <DeveloperWorkspace>
      {diagnostics.aiMemoryDatabaseStatus && diagnostics.aiMemoryDatabaseStatus.state !== "ready" && <div className={`ai-memory-recovery ${diagnostics.aiMemoryDatabaseStatus.state}`} role="alert"><strong>{settings.locale === "ja" ? "AI Memory データベースは停止中です" : "AI Memory 数据库已停用"}</strong><span>{settings.locale === "ja" ? "設定、移行、または整合性の問題を確認し、元のデータベースを復旧してから再起動してください。" : diagnostics.aiMemoryDatabaseStatus.message || "请恢复数据库后重新启动。"}</span></div>}
      <DeveloperWorkspaceRouter locale={settings.locale} sandboxMode={settings.sandboxMode} workspaces={workspace.workspaces} collaboration={collaboration} codex={codex} evolution={evolution} hanli={hanli} nangong={nangong} screenshot={screenshot} />
    </DeveloperWorkspace>
    <DeveloperStatusBar sandboxMode={settings.sandboxMode} memoryStatus={diagnostics.aiMemoryDatabaseStatus} locale={settings.locale} />
    <CodexApprovalDialog controller={codex} locale={settings.locale} />
  </DeveloperShell>;
}
