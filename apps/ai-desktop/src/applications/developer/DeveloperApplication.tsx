import { type CSSProperties, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";

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
import { WorkspaceExplorerFeature } from "../../features/workspace/components/WorkspaceExplorerFeature";
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
type ActiveExplorerSection = "workspace" | "tasks";

const DEFAULT_EXPLORER_WIDTH = 260;
const MINIMUM_EXPLORER_WIDTH = 200;
const MAXIMUM_EXPLORER_WIDTH = 520;

const labels = {
  ja: {
    title: "Developer", files: "EXPLORER", expand: "展開", collapse: "折りたたむ", settings: "接続と実行設定",
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
    title: "Developer", files: "资源管理器", expand: "展开", collapse: "折叠", settings: "连接与执行设置",
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
  const [explorerExpanded, setExplorerExpanded] = useState(true);
  const [activeExplorerSection, setActiveExplorerSection] = useState<ActiveExplorerSection | null>("workspace");
  const [explorerWidth, setExplorerWidth] = useState(DEFAULT_EXPLORER_WIDTH);
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

  useEffect(() => {
    const host = shellRef.current;
    const tooltip = (window as typeof window & { sel?: { components?: { tooltip?: SelTooltipApi } } }).sel?.components?.tooltip;
    if (!host || !tooltip) return;
    const controller = tooltip.attach(host, { id: "ai-desktop:developer-tooltip", selector: "[data-sel-tooltip]", delay: 260 });
    return () => { controller?.destroy(); };
  }, []);

  const clampExplorerWidth = (width: number) => Math.min(MAXIMUM_EXPLORER_WIDTH, Math.max(MINIMUM_EXPLORER_WIDTH, width));
  const startExplorerResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startWidth = explorerWidth;
    handle.setPointerCapture(pointerId);
    const onPointerMove = (moveEvent: globalThis.PointerEvent) => setExplorerWidth(clampExplorerWidth(startWidth + moveEvent.clientX - startX));
    const stopResize = () => { handle.removeEventListener("pointermove", onPointerMove); handle.removeEventListener("pointerup", stopResize); handle.removeEventListener("pointercancel", stopResize); };
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", stopResize);
    handle.addEventListener("pointercancel", stopResize);
  };
  const shellStyle = { "--explorer-width": `${explorerWidth}px` } as CSSProperties;

  return <DeveloperShell shellRef={shellRef} explorerExpanded={explorerExpanded} locale={settings.locale} style={shellStyle}>
    <DeveloperTitleBar projectRoot={workspace.projectRoot} title={text.title} />
    <DeveloperActivityBar explorerExpanded={explorerExpanded} filesLabel={text.files} expandLabel={text.expand} collapseLabel={text.collapse} onToggleExplorer={() => setExplorerExpanded((value) => !value)} settingsControl={<DeveloperSettingsFeature open={settingsOpen} onOpenChange={setSettingsOpen} status={codex.interaction.status} loginHint={codex.interaction.loginHint} text={text} settings={settings} diagnostics={diagnostics} onLogin={() => void codex.interaction.login()} onLogout={() => void codex.interaction.logout()} onTempFilesCleared={() => codex.conversation.setAttachments([])} />} />
    <DeveloperExplorer expanded={explorerExpanded} label={text.files} expandLabel={text.expand} collapseLabel={text.collapse} activeSection={activeExplorerSection} onToggle={() => setExplorerExpanded((value) => !value)}>
      <WorkspaceExplorerFeature expanded={activeExplorerSection === "workspace"} text={text} workspace={workspace} onToggle={() => setActiveExplorerSection((current) => current === "workspace" ? null : "workspace")} />
      <CollaborationExplorerFeature expanded={activeExplorerSection === "tasks"} locale={settings.locale} auditTask={diagnostics.auditInfo?.latestTask || null} controller={collaboration} onToggle={() => setActiveExplorerSection((current) => current === "tasks" ? null : "tasks")} />
    </DeveloperExplorer>
    {explorerExpanded && <div className="explorer-resizer" role="separator" aria-label={settings.locale === "ja" ? "エクスプローラーの幅を変更" : "调整资源管理器宽度"} aria-orientation="vertical" aria-valuemin={MINIMUM_EXPLORER_WIDTH} aria-valuemax={MAXIMUM_EXPLORER_WIDTH} aria-valuenow={explorerWidth} tabIndex={0} onDoubleClick={() => setExplorerWidth(DEFAULT_EXPLORER_WIDTH)} onPointerDown={startExplorerResize} onKeyDown={(event) => { if (event.key === "Home") { event.preventDefault(); setExplorerWidth(DEFAULT_EXPLORER_WIDTH); return; } if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return; event.preventDefault(); setExplorerWidth((width) => clampExplorerWidth(width + (event.key === "ArrowLeft" ? -16 : 16))); }} />}
    <DeveloperWorkspace>
      {diagnostics.aiMemoryDatabaseStatus && diagnostics.aiMemoryDatabaseStatus.state !== "ready" && <div className={`ai-memory-recovery ${diagnostics.aiMemoryDatabaseStatus.state}`} role="alert"><strong>{settings.locale === "ja" ? "AI Memory データベースは停止中です" : "AI Memory 数据库已停用"}</strong><span>{settings.locale === "ja" ? "設定、移行、または整合性の問題を確認し、元のデータベースを復旧してから再起動してください。" : diagnostics.aiMemoryDatabaseStatus.message || "请恢复数据库后重新启动。"}</span></div>}
      <DeveloperWorkspaceRouter locale={settings.locale} sandboxMode={settings.sandboxMode} workspaces={workspace.workspaces} collaboration={collaboration} codex={codex} evolution={evolution} hanli={hanli} nangong={nangong} screenshot={screenshot} />
    </DeveloperWorkspace>
    <DeveloperStatusBar sandboxMode={settings.sandboxMode} memoryStatus={diagnostics.aiMemoryDatabaseStatus} locale={settings.locale} />
    <CodexApprovalDialog controller={codex} locale={settings.locale} />
  </DeveloperShell>;
}
