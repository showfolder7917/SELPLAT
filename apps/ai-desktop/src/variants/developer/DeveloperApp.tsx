import { ClipboardEvent, CSSProperties, FormEvent, PointerEvent as ReactPointerEvent, type Dispatch, type ReactNode, type SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import {
  Add24Regular,
  ArrowClockwise24Regular,
  ArrowReply24Regular,
  Beaker24Regular,
  Branch24Regular,
  Bug24Regular,
  ChevronDown16Regular,
  ChevronRight16Regular,
  CheckmarkCircle24Regular,
  Code24Regular,
  Delete16Regular,
  Delete24Regular,
  Dismiss20Regular,
  Document24Regular,
  EyeOff24Regular,
  Folder24Regular,
  FolderOpen24Regular,
  Prompt24Regular,
  Play24Regular,
  Search24Regular,
  Screenshot24Regular,
  Send24Filled,
  ShieldLock16Filled,
  ShieldLock16Regular,
  ShieldCheckmark24Regular,
  Star16Filled,
  Star16Regular,
  Stop24Filled,
} from "@fluentui/react-icons";

import type {
  AutomaticTestPreflightResult,
  AiMemoryDatabaseStatus,
  CodexAccount,
  CodexApproval,
  CodexHarnessStatus,
  CodexModelCatalog,
  CorpusSemanticBackfillStatus,
  CodexStreamActivity,
  CodexStreamEvent,
  CodexUserInputRequest,
  CollaborationMember,
  CollaborationState,
  CollaborationStateEvent,
  CollaborationStreamEnvelope,
  CollaborationTask,
  CollaborationTimelineSnapshot,
  ConversationDispatchState,
  ConversationQueueItem,
  DesktopSettings,
  Locale,
  LinghuAutomationState,
  LinghuAutomationStateEvent,
  LinghuStartupPrompt,
  ManagedExecutionMode,
  NangongEvolutionState,
  NangongEvolutionStateEvent,
  EvolutionWorkspaceLocation,
  ModelServiceTier,
  ReasoningEffort,
  SandboxMode,
  TempDirectoryInfo,
  TrustedCommandInfo,
  AuditLogInfo,
  AuditTaskSummary,
  ApprovalGovernanceRecord,
  WorkspaceEntry,
  WorkspacePermission,
  WorkspaceState,
} from "../../../contracts/desktop/desktop";
import { applyCodexStreamEvent, clearStoredChat, createAssistantMessage, managedModeForCommand, nextManagedMode, readStoredChat, writeStoredChat, type ComposerAttachment, type Message } from "../../features/conversation/model/chat-message";
import { SelUiConversation } from "../../features/conversation/components/SelUiConversation";
import { MarkdownMessage } from "./MarkdownMessage";
import { deriveCollaborationTaskCurrentStage, deriveCollaborationTaskProgress, type CollaborationProgressStageId } from "../../features/collaboration/model/collaboration-task-progress";
import { TaskCollaborationGroup } from "../../features/collaboration/components/TaskCollaborationGroup";
import { LinghuRepairProposalPanel, MemberSelfUpgradePanel } from "../../features/evolution/components/EvolutionRevisionPanels";
import { EvolutionControlWorkspace } from "../../features/evolution/components/EvolutionControlWorkspace";
import { EvolutionLiveActivity } from "../../features/evolution/components/EvolutionLiveActivity";
import { defaultEvolutionWorkspaceLocation, evolutionMutationRequest, evolutionWorkspaceLocationFromSearch, evolutionWorkspaceLocationSearch } from "../../features/evolution/model/evolution-workbench";
import { SettingsFloatingPanel } from "../../features/settings/components/SettingsFloatingPanel";
import { ChatGPTLoginAction, WindowControls } from "../../features/shell/components/DesktopChrome";
import { RuleManagementFeature } from "../../features/rules/components/RuleManagementFeature";
import { SelUiDialog, useSelUi } from "../../theme/SelUiProvider";
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
import "./developer.css";

type SelGridController = { destroy: () => boolean; setLocale?: (payload: Record<string, unknown>) => boolean };
type SelGridApi = {
  create: (host: HTMLElement, definition: Record<string, unknown>) => HTMLElement | null;
  mount: (root: HTMLElement, payload: Record<string, unknown>) => SelGridController | null;
};

type SelTooltipController = { destroy: () => boolean };
type SelTooltipApi = {
  attach: (host: Element, options: Record<string, unknown>) => SelTooltipController | null;
};

/** 每个协同流式回合保留收到时的环节，避免状态推进后把旧报告错放到新环节。 */
type CollaborationLiveOutput = {
  message: Message;
  stageId: CollaborationProgressStageId;
  turnId: string;
};

const labels = {
  ja: { title: "Developer", placeholder: "コード、調査、変更内容を入力（画像を貼り付け可能）", ready: "Codex harness 接続済み", signIn: "ChatGPT でログイン", signOut: "ログアウト", signedOut: "ChatGPT にログインしてください", browserOpened: "ブラウザーでログインを完了してください", files: "EXPLORER", workspaces: "WORKSPACES", addWorkspace: "ワークスペースを追加", primary: "メイン", makePrimary: "メインに設定", remove: "削除", removeConfirm: "ワークスペース一覧から「{name}」を削除しますか？ディスク上のフォルダーは削除されません。", minimumWorkspace: "ワークスペースを1つ以上残してください", tasks: "TASKS", newTask: "新しいタスク", newCodexSession: "Codex セッションを新しく作り直す", expand: "展開", collapse: "折りたたむ", settings: "接続と実行設定", account: "ChatGPT アカウント", readOnly: "読み取り専用", write: "ワークスペース書き込み", readOnlyTip: "現在は読み取り専用", writeTip: "現在は書き込み可能", thinking: "Codex が処理中...", approve: "許可", approveAndTrust: "許可して信頼", trustHint: "同じプロジェクトとコマンドは次回から自動的に許可されます。", decline: "拒否", screenshot: "現在の画面をキャプチャ", hiddenScreenshot: "AI Desktop を隠してキャプチャ", screenPermissionRequired: "システム設定で AI Desktop の画面収録を許可し、アプリを再起動してください。", screenSourceUnavailable: "画面ソースを読み取れません。画面収録の権限を確認してから再試行してください。", openScreenRecordingSettings: "システム設定を開く", tempFiles: "一時ファイル", openTemp: "一時フォルダーを開く", clearTemp: "すべて消去", clearConfirm: "AI Desktop の一時ファイルをすべて削除しますか？", trustedCommands: "信頼済みコマンド", clearTrustedCommands: "信頼をすべて解除", clearTrustedConfirm: "登録済みの信頼コマンドをすべて解除しますか？", auditLogs: "業務ログ", openAuditLogs: "ログフォルダーを開く", noAuditTask: "タスク履歴はまだありません", conversationManaged: "会話管理", requirementManaged: "要件管理", taskManaged: "タスク管理", testManaged: "テスト管理", attachment: "画像添付", automaticTest: "自動テスト", automaticTestChecking: "自動テスト環境を確認中…", automaticTestReady: "自動テスト環境の準備ができました", automaticTestBlocked: "自動テストを開始できません", automaticTestTriggered: "自動テスト", close: "閉じる" },
  "zh-CN": { title: "Developer", placeholder: "输入代码、调查或修改任务（可粘贴截图）", ready: "Codex harness 已连接", signIn: "使用 ChatGPT 登录", signOut: "退出登录", signedOut: "请先登录 ChatGPT", browserOpened: "请在浏览器中完成登录", files: "资源管理器", workspaces: "工作区", addWorkspace: "添加工作区", primary: "主目录", makePrimary: "设为主目录", remove: "移除", removeConfirm: "确定从工作区列表移除“{name}”吗？不会删除磁盘中的真实目录。", minimumWorkspace: "至少保留一个工作区", tasks: "任务", newTask: "新建任务", newCodexSession: "重新建立一个 Codex 会话", expand: "展开", collapse: "折叠", settings: "连接与执行设置", account: "ChatGPT 账号", readOnly: "只读", write: "工作区写入", readOnlyTip: "当前只读", writeTip: "当前可写入", thinking: "Codex 正在处理...", approve: "允许", approveAndTrust: "允许并信任", trustHint: "相同项目和命令下次将自动允许。", decline: "拒绝", screenshot: "截取当前屏幕", hiddenScreenshot: "隐藏 AI Desktop 后截图", screenPermissionRequired: "请在系统设置中允许 AI Desktop 使用屏幕录制权限，然后重新启动应用。", screenSourceUnavailable: "无法读取屏幕来源，请检查屏幕录制权限后重试。", openScreenRecordingSettings: "打开系统设置", tempFiles: "临时文件", openTemp: "临时目录", clearTemp: "一键清理", clearConfirm: "确定清理 AI Desktop temp 中的全部临时文件吗？", trustedCommands: "可信命令", clearTrustedCommands: "清除全部信任", clearTrustedConfirm: "确定清除全部项目可信命令吗？", auditLogs: "业务日志", openAuditLogs: "打开日志目录", noAuditTask: "暂无任务记录", conversationManaged: "会话托管", requirementManaged: "需求托管", taskManaged: "任务托管", testManaged: "测试托管", attachment: "图片附件", automaticTest: "自动测试", automaticTestChecking: "正在检查自动测试环境…", automaticTestReady: "自动测试环境已就绪", automaticTestBlocked: "自动测试开启失败", automaticTestTriggered: "自动测试", close: "知道了" },
} as const;

const EMPTY_ACCOUNT: CodexAccount = { authenticated: false, authMode: null, email: null, planType: null, requiresOpenaiAuth: true };
const EMPTY_STATUS: CodexHarnessStatus = { connected: false, account: EMPTY_ACCOUNT, error: null, runtime: null };
const DEFAULT_EXPLORER_WIDTH = 260;
const MINIMUM_EXPLORER_WIDTH = 200;
const MAXIMUM_EXPLORER_WIDTH = 520;
const EMPTY_DISPATCH_STATE: ConversationDispatchState = { activeTask: null, queue: [] };
type ActiveExplorerSection = "workspace" | "tasks";

const testDataResetCopy = {
  ja: {
    title: "テストデータ",
    summary: "テストトピック、タスク、承認、イベント、実行履歴",
    detail: "人物の会話、学習メモリ、ログイン、設定、ワークスペース、ルール、ソースコードは保持されます。完了後にアプリを再起動します。",
    action: "テストデータを一括消去",
    busy: "消去中…",
    confirm: "AI Desktop 内部のテスト実行データを消去しますか？この操作は元に戻せません。人物の会話、学習メモリ、ログイン、設定、ワークスペース、信頼済みコマンド、ルール、ソースコード、監査ファイルは削除されません。",
  },
  "zh-CN": {
    title: "测试数据",
    summary: "测试专题、任务、审批、事件和运行记录",
    detail: "保留人物对话、训练记忆、登录、设置、工作区、规则和源码；完成后自动重启应用。",
    action: "一键清空测试数据",
    busy: "正在清空…",
    confirm: "确定一键清空 AI Desktop 内部的测试运行数据吗？此操作不可撤销。不会删除人物对话、训练记忆、登录、设置、工作区、可信命令、规则、源码和工程审计文件。",
  },
} as const;

function readableDesktopError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/^Error invoking remote method '[^']+':\s*/, "");
}

/** 南宫婉与韩立共用一个独立专题演化窗口；人物入口只改变初始视角，不复制业务实现或状态。 */
export function EvolutionWorkspaceWindowApp() {
  const [requestedLocation, setRequestedLocation] = useState<EvolutionWorkspaceLocation>(() => evolutionWorkspaceLocationFromSearch(window.location.search));
  const perspective = requestedLocation.perspective;
  const [state, setState] = useState<NangongEvolutionState | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceState | null>(null);
  const [nangongMember, setNangongMember] = useState<CollaborationMember | null>(null);
  const [locale, setLocale] = useState<Locale>("zh-CN");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void Promise.all([
      window.desktop?.getNangongEvolutionState(),
      window.desktop?.getWorkspaces(),
      window.desktop?.getCollaborationState(),
      window.desktop?.getSettings(),
    ]).then(([nextState, nextWorkspaces, collaboration, settings]) => {
      if (!active) return;
      if (nextState) setState(nextState);
      if (nextWorkspaces) setWorkspaces(nextWorkspaces);
      if (collaboration) setNangongMember(collaboration.members.find((member) => member.memberId === "nangong-wan") || null);
      if (settings) setLocale(settings.locale);
    }).catch((reason) => { if (active) setError(readableDesktopError(reason, "无法打开专题演化工作台。")); });
    const unsubscribeState = window.desktop?.onNangongEvolutionState((event) => setState(event.state));
    const unsubscribeCollaboration = window.desktop?.onCollaborationState((event) => setNangongMember(event.state.members.find((member) => member.memberId === "nangong-wan") || null));
    const unsubscribeLocation = window.desktop?.onEvolutionWorkspaceLocation((location) => {
      setRequestedLocation(location);
      window.history.replaceState(null, "", evolutionWorkspaceLocationSearch(location));
    });
    return () => {
      active = false;
      unsubscribeState?.();
      unsubscribeCollaboration?.();
      unsubscribeLocation?.();
    };
  }, []);
  return <div className="evolution-window-shell" lang={locale}>
    <header className="dev-titlebar evolution-window-titlebar">
      <div className="dev-brand"><Code24Regular /><strong>AI Desktop</strong><span>专题演化工作台</span></div>
      <div className="operating-mode-switch evolution-perspective-switch" role="group" aria-label="工作台人物视角">
        <button type="button" className={perspective === "nangong" ? "active" : ""} aria-pressed={perspective === "nangong"} onClick={() => { const location = defaultEvolutionWorkspaceLocation("nangong"); setRequestedLocation(location); window.history.replaceState(null, "", evolutionWorkspaceLocationSearch(location)); }}>南宫婉</button>
        <button type="button" className={perspective === "hanli" ? "active" : ""} aria-pressed={perspective === "hanli"} onClick={() => { const location = defaultEvolutionWorkspaceLocation("hanli"); setRequestedLocation(location); window.history.replaceState(null, "", evolutionWorkspaceLocationSearch(location)); }}>韩立</button>
      </div>
      <WindowControls />
    </header>
    <main className="evolution-window-main">
      {error && <div className="evolution-window-error" role="alert">{error}</div>}
      {state && (perspective === "hanli" || nangongMember)
        ? <EvolutionControlWorkspace perspective={perspective} requestedLocation={requestedLocation} onLocationChange={(location) => window.history.replaceState(null, "", evolutionWorkspaceLocationSearch(location))} member={nangongMember || undefined} state={state} workspaces={workspaces} locale={locale} onState={setState} onError={setError} />
        : !error && <div className="evolution-window-loading" role="status">正在读取专题、审批和运行状态…</div>}
    </main>
  </div>;
}

export function DeveloperApp() {
  const selUi = useSelUi();
  const shellRef = useRef<HTMLDivElement>(null);
  const archiveDistribution = new URLSearchParams(window.location.search).get("distribution") === "archive";
  const [locale, setLocale] = useState<Locale>("zh-CN");
  const [sandboxMode, setSandboxMode] = useState<SandboxMode>("workspace-write");
  const [defaultModel, setDefaultModel] = useState<string | null>(null);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort | null>(null);
  const [serviceTier, setServiceTier] = useState<ModelServiceTier>("default");
  const [codexAppCorpusIngestionEnabled, setCodexAppCorpusIngestionEnabled] = useState(false);
  const [corpusSemanticBackfill, setCorpusSemanticBackfill] = useState<CorpusSemanticBackfillStatus | null>(null);
  const [modelCatalog, setModelCatalog] = useState<CodexModelCatalog>({ models: [] });
  const [modelCatalogLoading, setModelCatalogLoading] = useState(false);
  const [modelSettingsError, setModelSettingsError] = useState("");
  const [evolutionWorkspaceOpenError, setEvolutionWorkspaceOpenError] = useState("");
  const [executionMode, setExecutionMode] = useState<ManagedExecutionMode>("conversation-managed");
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [chatHydrated, setChatHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [nangongAttachments, setNangongAttachments] = useState<ComposerAttachment[]>([]);
  const screenshotDestinationRef = useRef<"main" | "nangong">("main");
  const [screenshotBusy, setScreenshotBusy] = useState(false);
  const [screenshotMode, setScreenshotMode] = useState<"current" | "hidden" | null>(null);
  const [screenshotError, setScreenshotError] = useState("");
  const [screenRecordingSettingsAvailable, setScreenRecordingSettingsAvailable] = useState(false);
  const [screenRecordingRestartRequired, setScreenRecordingRestartRequired] = useState(false);
  const [screenRecordingRestarting, setScreenRecordingRestarting] = useState(false);
  const [tempInfo, setTempInfo] = useState<TempDirectoryInfo | null>(null);
  const [auditInfo, setAuditInfo] = useState<AuditLogInfo | null>(null);
  const [aiMemoryDatabaseStatus, setAiMemoryDatabaseStatus] = useState<AiMemoryDatabaseStatus | null>(null);
  const [collaborationState, setCollaborationState] = useState<CollaborationState | null>(null);
  const [collaborationTimeline, setCollaborationTimeline] = useState<CollaborationTimelineSnapshot | null>(null);
  const [linghuAutomationState, setLinghuAutomationState] = useState<LinghuAutomationState | null>(null);
  const [nangongEvolutionState, setNangongEvolutionState] = useState<NangongEvolutionState | null>(null);
  const [collaborationStreams, setCollaborationStreams] = useState<Record<string, CollaborationLiveOutput>>({});
  const [collaborationPanel, setCollaborationPanel] = useState<"member" | "execution-list" | "task-group" | "task-detail">("member");
  const [selectedCollaborationTaskId, setSelectedCollaborationTaskId] = useState<string | null>(null);
  const [trustedCommandInfo, setTrustedCommandInfo] = useState<TrustedCommandInfo>({ count: 0 });
  const [testDataResetting, setTestDataResetting] = useState(false);
  const [testDataResetError, setTestDataResetError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dispatchState, setDispatchState] = useState<ConversationDispatchState>(EMPTY_DISPATCH_STATE);
  const [dispatchError, setDispatchError] = useState("");
  const [nangongNewConversationBusy, setNangongNewConversationBusy] = useState(false);
  const [nangongError, setNangongError] = useState("");
  const [automaticTestEnabled, setAutomaticTestEnabled] = useState(false);
  const [automaticTestChecking, setAutomaticTestChecking] = useState(false);
  const [automaticTestDialog, setAutomaticTestDialog] = useState<AutomaticTestPreflightResult | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 资源管理器控制整栏宽度；工作区和任务使用单一活动分区，确保切换后当前内容置顶并独占可用高度。
  const [explorerExpanded, setExplorerExpanded] = useState(true);
  const [activeExplorerSection, setActiveExplorerSection] = useState<ActiveExplorerSection | null>("workspace");
  const [explorerWidth, setExplorerWidth] = useState(DEFAULT_EXPLORER_WIDTH);
  const [projectRoot, setProjectRoot] = useState("C:\\opt\\workspace\\SELPLAT");
  const [workspaces, setWorkspaces] = useState<WorkspaceState | null>(null);
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set());
  const [workspaceEntries, setWorkspaceEntries] = useState<Record<string, WorkspaceEntry[]>>({});
  const [workspaceError, setWorkspaceError] = useState("");
  const [codexStatus, setCodexStatus] = useState<CodexHarnessStatus>(EMPTY_STATUS);
  const [approval, setApproval] = useState<CodexApproval | null>(null);
  const [userInputRequest, setUserInputRequest] = useState<CodexUserInputRequest | null>(null);
  const [userInputAnswers, setUserInputAnswers] = useState<Record<string, string>>({});
  const [customAnswerIds, setCustomAnswerIds] = useState<Set<string>>(new Set());
  const [confirmedQuestionIds, setConfirmedQuestionIds] = useState<Set<string>>(new Set());
  const [userInputSubmitting, setUserInputSubmitting] = useState(false);
  const [loginHint, setLoginHint] = useState("");
  const chatRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const activeAssistantIdRef = useRef<number | null>(null);
  const activeTurnIdRef = useRef<string | null>(null);
  const completedTurnIdsRef = useRef<Set<string>>(new Set());
  const turnMessageIdsRef = useRef<Map<string, number>>(new Map());
  const messageIdSequenceRef = useRef(0);
  const activeManagedModeRef = useRef<ManagedExecutionMode>("conversation-managed");
  const flushStreamEventsRef = useRef<() => void>(() => undefined);
  const screenCapturePreparedRef = useRef(false);
  const screenRecordingSettingsOpenedRef = useRef(false);
  const screenRecordingRecheckBusyRef = useRef(false);
  const automaticTestEnabledRef = useRef(false);
  const collaborationStateRef = useRef<CollaborationState | null>(null);
  const linghuAutomationStateRef = useRef<LinghuAutomationState | null>(null);
  const text = labels[locale];
  const screenPermissionRecoveryMessage = locale === "ja"
    ? "システム設定で AI Desktop の画面収録を許可してください。AI Desktop に戻ると自動的に再確認します。"
    : "请在系统设置中允许 AI Desktop 使用屏幕录制权限；返回 AI Desktop 后会自动重新检测。";
  const screenPermissionRestartMessage = locale === "ja"
    ? "現在のプロセスでは変更後の権限をまだ認識できません。権限が有効なら AI Desktop を再起動してください。"
    : "当前进程仍未识别更改后的权限；若系统开关已经开启，请重启 AI Desktop 使权限生效。";
  const queuedSends = dispatchState.queue;
  const nextId = useMemo(() => messages.reduce((maximum, item) => Math.max(maximum, item.id), 0) + 1, [messages]);
  const latestManagedAssistantId = useMemo(() => messages.reduce((latest, message) => (
    message.role === "assistant" && message.managedMode !== undefined ? message.id : latest
  ), null as number | null), [messages]);

  useEffect(() => {
    // 恢复历史记录后把运行期序号推进到现有最大值，保证后续每个 Harness 回合都能取得独立 React key。
    messageIdSequenceRef.current = Math.max(messageIdSequenceRef.current, ...messages.map((message) => message.id), 0);
  }, [messages]);

  useEffect(() => { collaborationStateRef.current = collaborationState; }, [collaborationState]);
  useEffect(() => { linghuAutomationStateRef.current = linghuAutomationState; }, [linghuAutomationState]);

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

    // 拖拽过程只改变开发版网格变量，不触发工作区重载或会话状态变化。
    const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
      setExplorerWidth(clampExplorerWidth(startWidth + moveEvent.clientX - startX));
    };
    const stopResize = () => {
      handle.removeEventListener("pointermove", onPointerMove);
      handle.removeEventListener("pointerup", stopResize);
      handle.removeEventListener("pointercancel", stopResize);
    };
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", stopResize);
    handle.addEventListener("pointercancel", stopResize);
  };

  const toggleExplorerSection = (section: ActiveExplorerSection) => {
    // 再次点击当前分区可全部收起；打开另一分区时会原子性替换活动值，禁止两块内容同时挤占侧栏。
    setActiveExplorerSection((current) => current === section ? null : section);
  };

  useEffect(() => {
    window.desktop?.getEnvironment().then((environment) => setProjectRoot(environment.projectRoot));
    window.desktop?.getAiMemoryDatabaseStatus().then(setAiMemoryDatabaseStatus);
    window.desktop?.getCorpusSemanticBackfillStatus().then(setCorpusSemanticBackfill);
    window.desktop?.getWorkspaces().then((state) => {
      setWorkspaces(state);
      const primary = state.roots.find((root) => root.id === state.primaryId);
      if (primary) setProjectRoot(primary.path);
      setExpandedWorkspaces(new Set(state.roots.map((root) => root.id)));
      for (const root of state.roots) {
        void window.desktop?.listWorkspaceEntries(root.id).then((entries) => {
          setWorkspaceEntries((current) => ({ ...current, [root.id]: entries }));
        });
      }
    });
    window.desktop?.getSettings().then((settings) => {
      setLocale(settings.locale);
      setSandboxMode(settings.sandboxMode);
      setDefaultModel(settings.defaultModel);
      setReasoningEffort(settings.reasoningEffort);
      setServiceTier(settings.serviceTier);
      setCodexAppCorpusIngestionEnabled(settings.codexAppCorpusIngestionEnabled);
    });
    // 任务分区只展示业务日志中的最新任务摘要，不在渲染层复制或猜测 Harness 会话状态。
    window.desktop?.getAuditLogInfo().then(setAuditInfo);
    window.desktop?.getTrustedCommandInfo().then(setTrustedCommandInfo);
    const refresh = () => window.desktop?.getCodexStatus().then(setCodexStatus);
    const refreshApprovals = () => window.desktop?.getCodexApprovals().then((items) => setApproval(items[0] || null));
    const refreshUserInputs = () => window.desktop?.getCodexUserInputs().then((items) => setUserInputRequest(items[0] || null));
    void refresh();
    void refreshApprovals();
    void refreshUserInputs();
    const statusTimer = window.setInterval(refresh, 2500);
    const approvalTimer = window.setInterval(refreshApprovals, 700);
    const userInputTimer = window.setInterval(refreshUserInputs, 350);
    return () => { window.clearInterval(statusTimer); window.clearInterval(approvalTimer); window.clearInterval(userInputTimer); };
  }, []);

  useEffect(() => {
    if (corpusSemanticBackfill?.state !== "running") return;
    const timer = window.setInterval(() => {
      void window.desktop?.getCorpusSemanticBackfillStatus().then(setCorpusSemanticBackfill);
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [corpusSemanticBackfill?.state]);

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;
    const refreshTimeline = () => void desktop.getCollaborationTimeline().then(setCollaborationTimeline).catch((error) => setDispatchError(readableDesktopError(error, "无法读取任务协作时间线。")));
    void desktop.getCollaborationState().then((state) => { collaborationStateRef.current = state; setCollaborationState(state); });
    refreshTimeline();
    void desktop.getLinghuAutomationState().then((state) => { linghuAutomationStateRef.current = state; setLinghuAutomationState(state); });
    void desktop.getNangongEvolutionState().then(setNangongEvolutionState);
    const removeStateListener = desktop.onCollaborationState((event: CollaborationStateEvent) => { collaborationStateRef.current = event.state; setCollaborationState(event.state); refreshTimeline(); });
    const removeLinghuListener = desktop.onLinghuAutomationState((event: LinghuAutomationStateEvent) => { linghuAutomationStateRef.current = event.state; setLinghuAutomationState(event.state); });
    const removeNangongListener = desktop.onNangongEvolutionState((event: NangongEvolutionStateEvent) => { setNangongEvolutionState(event.state); refreshTimeline(); });
    const removeStreamListener = desktop.onCollaborationStream((envelope: CollaborationStreamEnvelope) => {
      // 流式正文以回合开始时的真实状态归档，不会随之后的任务转交迁移到错误环节。
      setCollaborationStreams((current) => {
        const existing = current[envelope.taskId];
        const task = collaborationStateRef.current?.tasks.find((candidate) => candidate.taskId === envelope.taskId);
        const next = existing?.turnId === envelope.event.turnId
          ? existing
          : {
            message: createAssistantMessage(Date.now(), "task-managed"),
            stageId: task ? deriveCollaborationTaskCurrentStage(task, linghuAutomationStateRef.current) : "intent",
            turnId: envelope.event.turnId,
          };
        return { ...current, [envelope.taskId]: { ...next, message: applyCodexStreamEvent(next.message, envelope.event) } };
      });
    });
    return () => { removeStateListener(); removeLinghuListener(); removeNangongListener(); removeStreamListener(); };
  }, []);

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;
    void desktop.getConversationDispatchState().then(setDispatchState);
    return desktop.onConversationDispatchState(setDispatchState);
  }, []);

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) {
      setChatHydrated(true);
      return;
    }
    // 渲染热更新或 Electron 重建后，以主进程仍登记的活动 thread 为准恢复本应用显示状态。
    void desktop.getActiveCodexSession().then((session) => {
      setActiveThreadId(session.threadId);
      if (!session.threadId) {
        clearStoredChat();
        return;
      }
      const stored = readStoredChat(session.threadId);
      if (!stored) return;
      setMessages(stored.messages);
      setExecutionMode(stored.executionMode);
    }).finally(() => setChatHydrated(true));
  }, []);

  useEffect(() => {
    if (!chatHydrated || !activeThreadId) return;
    const timer = window.setTimeout(() => {
      // 图片像素已经安全落在应用 temp，不复制进 localStorage；恢复时保留文字、阶段和执行事实。
      const persistentMessages = messages.map(({ attachments: _attachments, ...message }) => ({
        ...message,
        streaming: false,
      }));
      writeStoredChat(activeThreadId, executionMode, persistentMessages);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [activeThreadId, chatHydrated, executionMode, messages]);

  useEffect(() => {
    if (!userInputRequest) {
      setUserInputAnswers({});
      setCustomAnswerIds(new Set());
      setConfirmedQuestionIds(new Set());
      setUserInputSubmitting(false);
      return;
    }
    // 无预设选项的问题直接进入文本回答；有选项的问题必须由用户明确点击，禁止代选推荐项。
    setUserInputAnswers({});
    setCustomAnswerIds(new Set(userInputRequest.questions.filter((question) => question.options.length === 0).map((question) => question.id)));
    setConfirmedQuestionIds(new Set());
    setUserInputSubmitting(false);
  }, [userInputRequest?.requestId]);

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;
    return desktop.onScreenshotCompleted(({ attachment, dataUrl, hasAnnotations }) => {
      // 独立截图窗口完成后把签发附件放回输入框；只有真实画过红色标注才追加定向调查提示。
      const setDestinationAttachments = screenshotDestinationRef.current === "nangong" ? setNangongAttachments : setAttachments;
      setDestinationAttachments((current) => current.some((item) => item.id === attachment.id) || current.length >= 5 ? current : [...current, { ...attachment, dataUrl }]);
      if (hasAnnotations && screenshotDestinationRef.current === "main") setInput((current) => {
        const prompt = "调查图片红色部分是什么问题";
        if (current.includes(prompt)) return current;
        const existing = current.trimEnd();
        return existing ? `${existing}\n${prompt}` : prompt;
      });
      void nextRenderedFrame().then(() => composerRef.current?.focus());
      void desktop.getTempDirectoryInfo().then(setTempInfo);
    });
  }, []);

  useEffect(() => {
    if (settingsOpen) {
      void window.desktop?.getTempDirectoryInfo().then(setTempInfo);
      void window.desktop?.getAuditLogInfo().then(setAuditInfo);
      void window.desktop?.getTrustedCommandInfo().then(setTrustedCommandInfo);
      setModelCatalogLoading(true);
      setModelSettingsError("");
      void window.desktop?.getCodexModels()
        .then(setModelCatalog)
        .catch((error) => setModelSettingsError(readableDesktopError(error, locale === "ja" ? "モデル一覧を取得できません。" : "无法读取模型列表。")))
        .finally(() => setModelCatalogLoading(false));
    }
  }, [locale, settingsOpen]);

  useEffect(() => {
    automaticTestEnabledRef.current = automaticTestEnabled;
  }, [automaticTestEnabled]);

  const refreshDispatchState = async () => {
    const state = await window.desktop?.getConversationDispatchState();
    if (state) setDispatchState(state);
  };

  const discardAutomaticQueued = async () => {
    const automaticItems = dispatchState.queue.filter((item) => item.automatic);
    for (const item of automaticItems) {
      const state = await window.desktop?.discardQueuedMessage(item.id);
      if (state) setDispatchState(state);
    }
  };

  useEffect(() => {
    if (!approval || !automaticTestEnabledRef.current) return;
    // 自动阶段出现任何未预检审批都立即退回关闭态，避免无人值守流程悬停在授权弹窗。
    automaticTestEnabledRef.current = false;
    setAutomaticTestEnabled(false);
    void discardAutomaticQueued();
    setAutomaticTestDialog({
      status: "blocked",
      checkedAt: new Date().toISOString(),
      checks: [{
        id: "command",
        status: "failed",
        label: locale === "ja" ? "予期しない承認" : "出现额外授权",
        detail: locale === "ja" ? "未確認の承認要求を検出したため、自動テストを停止しました。" : "检测到预检之外的授权请求，自动测试已关闭，请人工确认。",
      }],
    });
  }, [approval, locale]);

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;
    const queued: Array<{ messageId: number; event: CodexStreamEvent }> = [];
    let animationFrame = 0;
    const appendAssistantCard = () => {
      const previousAssistantId = activeAssistantIdRef.current;
      const messageId = messageIdSequenceRef.current + 1;
      messageIdSequenceRef.current = messageId;
      activeAssistantIdRef.current = messageId;
      setMessages((current) => [
        ...current.map((message) => message.id === previousAssistantId
          ? { ...message, streaming: false, streamTerminal: true }
          : message),
        createAssistantMessage(messageId, activeManagedModeRef.current),
      ]);
      return messageId;
    };
    const routeMessageId = (event: CodexStreamEvent) => {
      const currentMessageId = activeAssistantIdRef.current;
      if (currentMessageId === null) return null;
      if (event.type === "managed-execution" && event.managedExecution) {
        const beginsNextTurn = (event.managedExecution.status === "started" || event.managedExecution.status === "continuing")
          && activeTurnIdRef.current !== null
          && completedTurnIdsRef.current.has(activeTurnIdRef.current);
        if (beginsNextTurn) {
          // 先提交上一轮尚在动画帧队列中的最终文字，再冻结旧卡并创建下一张卡。
          flush();
          activeTurnIdRef.current = null;
          return appendAssistantCard();
        }
        return currentMessageId;
      }
      const existingMessageId = turnMessageIdsRef.current.get(event.turnId);
      if (existingMessageId !== undefined) return existingMessageId;
      if (event.type !== "turn-started") return currentMessageId;
      if (activeTurnIdRef.current !== null) flush();
      const messageId = activeTurnIdRef.current === null ? currentMessageId : appendAssistantCard();
      activeTurnIdRef.current = event.turnId;
      turnMessageIdsRef.current.set(event.turnId, messageId);
      return messageId;
    };
    const flush = () => {
      animationFrame = 0;
      const events = queued.splice(0);
      setMessages((current) => events.reduce(
        (next, entry) => next.map((message) => message.id === entry.messageId ? applyCodexStreamEvent(message, entry.event) : message),
        current,
      ));
    };
    flushStreamEventsRef.current = flush;
    const unsubscribe = desktop.onCodexStreamEvent((event) => {
      const messageId = routeMessageId(event);
      if (messageId === null) return;
      // 每个真实 turnId 固定路由到独立回复卡；高频 delta 仍按动画帧批量落盘，避免 token 级重绘。
      queued.push({ messageId, event });
      if (event.type === "turn-completed") completedTurnIdsRef.current.add(event.turnId);
      if (!animationFrame) animationFrame = window.requestAnimationFrame(flush);
    });
    return () => {
      unsubscribe();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      flushStreamEventsRef.current = () => undefined;
    };
  }, []);

  useEffect(() => {
    // 新消息和处理状态出现时保持最新内容可见，长会话仍可通过聊天区滚动条回看历史。
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const applySettings = (settings: DesktopSettings) => {
    setLocale(settings.locale);
    setSandboxMode(settings.sandboxMode);
    setDefaultModel(settings.defaultModel);
    setReasoningEffort(settings.reasoningEffort);
    setServiceTier(settings.serviceTier);
    setCodexAppCorpusIngestionEnabled(settings.codexAppCorpusIngestionEnabled);
  };

  /** 所有模型选择都写入同一主进程设置，渲染层不建立会话级副本或覆盖入口。 */
  const updateSettings = (patch: Partial<DesktopSettings>) => {
    setModelSettingsError("");
    void window.desktop?.updateSettings(patch)
      .then(applySettings)
      .catch((error) => setModelSettingsError(readableDesktopError(error, locale === "ja" ? "設定を保存できません。" : "无法保存全局设置。")));
  };

  const selectDefaultModel = (modelId: string) => {
    const model = modelCatalog.models.find((item) => item.id === modelId);
    const nextEffort = model && reasoningEffort && model.supportedReasoningEfforts.includes(reasoningEffort)
      ? reasoningEffort
      : model?.defaultReasoningEffort || model?.supportedReasoningEfforts[0] || null;
    // 切换模型时同时消除旧模型遗留的快速档位，保证设置页与发送前校验的能力判断一致。
    const nextServiceTier = model?.supportedServiceTiers?.includes(serviceTier) ? serviceTier : "default";
    updateSettings({ defaultModel: modelId || null, reasoningEffort: nextEffort, serviceTier: nextServiceTier });
  };

  const applyWorkspaceState = (state: WorkspaceState) => {
    setWorkspaces(state);
    const primary = state.roots.find((root) => root.id === state.primaryId);
    if (primary) setProjectRoot(primary.path);
  };

  const addWorkspace = async () => {
    setWorkspaceError("");
    try {
      const state = await window.desktop?.addWorkspace();
      if (!state) return;
      applyWorkspaceState(state);
      const added = state.roots.find((root) => !workspaces?.roots.some((current) => current.id === root.id));
      if (added) {
        setExpandedWorkspaces((current) => new Set(current).add(added.id));
        const entries = await window.desktop?.listWorkspaceEntries(added.id);
        if (entries) setWorkspaceEntries((current) => ({ ...current, [added.id]: entries }));
      }
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Unable to add workspace");
    }
  };

  const toggleWorkspace = async (id: string) => {
    const willOpen = !expandedWorkspaces.has(id);
    setExpandedWorkspaces((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    if (willOpen && !workspaceEntries[id]) {
      const entries = await window.desktop?.listWorkspaceEntries(id);
      if (entries) setWorkspaceEntries((current) => ({ ...current, [id]: entries }));
    }
  };

  const updateWorkspacePermission = async (id: string, permission: WorkspacePermission) => {
    const state = await window.desktop?.updateWorkspacePermission(id, permission);
    if (state) applyWorkspaceState(state);
  };

  const setPrimaryWorkspace = async (id: string) => {
    const state = await window.desktop?.setPrimaryWorkspace(id);
    if (state) applyWorkspaceState(state);
  };

  const removeWorkspace = async (id: string, name: string) => {
    if (!await selUi.confirm({ title: text.remove, message: text.removeConfirm.replace("{name}", name), target: name, tone: "danger" })) return;
    try {
      const state = await window.desktop?.removeWorkspace(id);
      if (state) applyWorkspaceState(state);
      setExpandedWorkspaces((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Unable to remove workspace");
    }
  };

  const enqueueAutomaticTest = async (sourceMessageId?: number) => {
    if (dispatchState.queue.some((item) => item.automatic)) return;
    if (sourceMessageId !== undefined) {
      setMessages((current) => current.map((item) => item.id === sourceMessageId ? { ...item, actionTriggered: true } : item));
    }
    const state = await window.desktop?.enqueueMessage({
      request: { message: "测试一下", locale, sandboxMode, attachmentIds: [], executionMode: "test-managed" },
      displayText: text.automaticTestTriggered,
      automatic: true,
    });
    if (state) setDispatchState(state);
  };

  const send = async (
    override?: { message: string; displayText: string; mode: ManagedExecutionMode; sourceMessageId?: number },
    queued?: ConversationQueueItem,
  ) => {
    const typedMessage = input.trim();
    const commandMode = override ? null : managedModeForCommand(typedMessage, executionMode);
    const mode = queued?.request.executionMode || override?.mode || commandMode || executionMode;
    const message = queued?.request.message ?? override?.message ?? typedMessage;
    const displayText = queued?.displayText ?? override?.displayText ?? typedMessage;
    const sentAttachments = queued ? [] : attachments;
    const attachmentIds = queued?.request.attachmentIds || sentAttachments.map((attachment) => attachment.id);
    const sourceMessageId = override?.sourceMessageId;
    if (!message && attachmentIds.length === 0) return;
    if ((loading || dispatchState.activeTask) && !queued) {
      const state = await window.desktop?.enqueueMessage({
        request: { message, locale, sandboxMode, attachmentIds, executionMode: mode },
        displayText,
      });
      if (state) setDispatchState(state);
      setInput("");
      setAttachments([]);
      return;
    }
    if (loading) return;
    if (!codexStatus.account.authenticated) {
      setSettingsOpen(true);
      setLoginHint(text.signedOut);
      return;
    }
    if (sourceMessageId !== undefined) {
      setMessages((current) => current.map((item) => item.id === sourceMessageId ? { ...item, actionTriggered: true } : item));
    }
    setExecutionMode(mode);
    const userId = Math.max(nextId, messageIdSequenceRef.current + 1);
    const assistantId = userId + 1;
    messageIdSequenceRef.current = assistantId;
    const userMessage = { id: userId, role: "user" as const, text: displayText || text.attachment, attachments: sentAttachments };
    activeTurnIdRef.current = null;
    completedTurnIdsRef.current = new Set();
    turnMessageIdsRef.current = new Map();
    activeManagedModeRef.current = mode;
    activeAssistantIdRef.current = assistantId;
    // 发送后立即创建回复卡，随后只使用官方 app-server 实时事件更新内容和执行阶段。
    setMessages((current) => [...current, userMessage, createAssistantMessage(assistantId, mode)]);
    setInput("");
    setAttachments([]);
    setLoading(true);
    try {
      const response = window.desktop
        ? await window.desktop.sendMessage({ message, locale, sandboxMode, attachmentIds, executionMode: mode, queueItemId: queued?.id })
        : { text: locale === "ja" ? "デスクトップ版でローカル Codex に接続します。" : "桌面版本会在这里返回本地 Codex 的结果。", itemCount: 0 };
      if (response.disposition === "queued") {
        setMessages((current) => current.map((item) => item.id === assistantId
          ? { ...item, text: "消息已进入等待队列。", streaming: false, streamTerminal: true, streamStatus: "queued" }
          : item));
        return;
      }
      if (response.threadId) setActiveThreadId(response.threadId);
      flushStreamEventsRef.current();
      const completedAssistantId = activeAssistantIdRef.current || assistantId;
      setMessages((current) => current.map((item) => item.id === completedAssistantId
        ? { ...item, text: item.text || response.text, streaming: false, streamTerminal: true, streamStatus: "completed" }
        : item));
      if (automaticTestEnabledRef.current
        && mode === "task-managed"
        && "managedStatus" in response
        && response.managedStatus === "code-verified") {
        // 代码级验证完成后只排入一条固定测试托管消息，交给现有串行队列在当前回合收尾后执行。
        void enqueueAutomaticTest(completedAssistantId);
      }
    } catch (error) {
      const messageText = readableDesktopError(error, "Codex unavailable");
      const failedAssistantId = activeAssistantIdRef.current || assistantId;
      setMessages((current) => current.map((item) => item.id === failedAssistantId
        ? { ...item, text: item.text || messageText, streaming: false, streamTerminal: true, streamStatus: "failed", streamError: messageText }
        : item));
    } finally {
      flushStreamEventsRef.current();
      activeAssistantIdRef.current = null;
      setLoading(false);
      void window.desktop?.getAuditLogInfo().then(setAuditInfo);
      void refreshDispatchState();
    }
  };

  useEffect(() => {
    if (loading || dispatchState.activeTask || queuedSends.length === 0 || !codexStatus.account.authenticated) return;
    void send(undefined, queuedSends[0]);
  }, [loading, dispatchState.activeTask, queuedSends, codexStatus.account.authenticated]);

  const supplementQueuedMessage = async (itemId: string) => {
    setDispatchError("");
    try {
      const state = await window.desktop?.supplementQueuedMessage(itemId);
      if (state) setDispatchState(state);
    } catch (error) {
      setDispatchError(readableDesktopError(error, "无法补充到当前任务。"));
    }
  };

  const discardQueuedMessage = async (itemId: string) => {
    const state = await window.desktop?.discardQueuedMessage(itemId);
    if (state) setDispatchState(state);
  };

  const recoverConversationTask = async () => {
    setDispatchError("");
    try {
      const state = await window.desktop?.recoverConversationTask();
      if (state) setDispatchState(state);
    } catch (error) {
      setDispatchError(readableDesktopError(error, "无法继续未完成任务。"));
    }
  };

  const discardConversationRecovery = async () => {
    const state = await window.desktop?.discardConversationRecovery();
    if (state) setDispatchState(state);
  };

  const startNewTask = async () => {
    try {
      await window.desktop?.newChat();
      activeAssistantIdRef.current = null;
      setUserInputRequest(null);
      setExecutionMode("conversation-managed");
      setActiveThreadId(null);
      setMessages([]);
      automaticTestEnabledRef.current = false;
      setAutomaticTestEnabled(false);
      setAutomaticTestDialog(null);
      void discardAutomaticQueued();
      clearStoredChat();
      setScreenshotError("");
    } catch (error) {
      // 只有官方确认删除后才清空页面；失败时把当前任务完整留在界面供用户重试。
      setScreenshotError(error instanceof Error ? error.message : "无法丢弃当前 Codex 任务。");
    }
  };

  const startNewNangongConversation = async () => {
    if (nangongNewConversationBusy) return;
    setNangongNewConversationBusy(true);
    setNangongError("");
    try {
      const state = await window.desktop?.newNangongConversation();
      if (!state) throw new Error("南宫婉新建对话服务没有返回状态。");
      setNangongEvolutionState(state);
      setNangongAttachments([]);
    } catch (error) {
      // 南宫婉必须在自己的页面看到线程删除失败，不能把错误留在只属于韩立的输入区。
      setNangongError(readableDesktopError(error, "无法重新建立南宫婉对话。"));
    } finally {
      setNangongNewConversationBusy(false);
    }
  };

  const setOperatingMode = async (mode: "single-conversation" | "collaboration") => {
    const state = await window.desktop?.setDesktopOperatingMode(mode);
    if (state) {
      setCollaborationState(state);
      setActiveExplorerSection("tasks");
    }
  };

  const selectCollaborationMember = async (memberId: string) => {
    const state = await window.desktop?.selectCollaborationMember(memberId);
    if (state) {
      setCollaborationState(state);
      setCollaborationPanel("member");
      setSelectedCollaborationTaskId(null);
    }
  };

  const createCollaborationMember = async () => {
    const displayName = (await selUi.prompt({ title: locale === "ja" ? "メンバーを追加" : "新增人物", label: locale === "ja" ? "メンバー名" : "人物名称" }))?.trim();
    if (!displayName) return;
    try {
      const state = await window.desktop?.createCollaborationMember({ displayName });
      if (state) setCollaborationState(state);
    } catch (error) {
      setDispatchError(readableDesktopError(error, "无法新增人物。"));
    }
  };

  const renameCollaborationMember = async (member: CollaborationMember) => {
    const displayName = (await selUi.prompt({ title: locale === "ja" ? "メンバー名を変更" : "修改人物名称", label: locale === "ja" ? "新しいメンバー名" : "新的人物名称", defaultValue: member.displayName }))?.trim();
    if (!displayName || displayName === member.displayName) return;
    const state = await window.desktop?.updateCollaborationMember(member.memberId, { displayName });
    if (state) setCollaborationState(state);
  };

  const deleteCollaborationMember = async (member: CollaborationMember) => {
    if (member.protected || !await selUi.confirm({ title: locale === "ja" ? "メンバーを削除" : "删除人物", message: locale === "ja" ? `${member.displayName}を削除しますか？` : `确定删除“${member.displayName}”吗？`, target: member.displayName, tone: "danger" })) return;
    const state = await window.desktop?.deleteCollaborationMember(member.memberId);
    if (state) setCollaborationState(state);
  };

  const manuallyApproveTimelineProposal = async (proposalId: string, title: string, content: string) => {
    if (!nangongEvolutionState) return;
    const result = await selUi.approval({ title, subtitle: `专题任务 · 等待韩立审批`, content });
    if (!result) return;
    setDispatchError("");
    try {
      // 审批写动作继续复用演化协调器；主进程 EventCenter 会记录成功或 catch 异常并供令狐老祖消费。
      const next = await window.desktop?.decideEvolutionProposal(proposalId, {
        mutation: evolutionMutationRequest(nangongEvolutionState),
        decision: result.decision,
        advice: result.reason,
        feedbackTarget: "proposal-content",
      });
      if (next) setNangongEvolutionState(next);
      const timeline = await window.desktop?.getCollaborationTimeline();
      if (timeline) setCollaborationTimeline(timeline);
    } catch (error) {
      setDispatchError(readableDesktopError(error, "提交人工审批失败。"));
    }
  };

  const submitConfirmedCollaborationTask = async (message: Message) => {
    if (!workspaces) throw new Error("协同任务缺少工作区。");
    const latestUser = [...messages].reverse().find((item) => item.role === "user");
    const attachmentIds = messages.flatMap((item) => item.attachments || []).map((attachment) => attachment.id);
    const state = await window.desktop?.submitCollaborationTask({
      title: (latestUser?.text || message.text).slice(0, 80),
      problemStatement: latestUser?.text || message.text,
      confirmedIntent: message.text,
      constraints: ["协同执行停在任务托管代码验证，不自动进入测试托管"],
      acceptanceCriteria: [],
      sourceMessageIds: messages.map((item) => item.id),
      attachmentIds,
      workspaceState: workspaces,
      locale,
      mergeStrategy: "INDEPENDENT",
      // 发起人取真实会话负责人，并在主进程提交时冻结姓名快照，后续重命名不改写历史。
      initiatorMemberId: collaborationState?.members.find((member) => member.kind === "conversation-owner")?.memberId,
    });
    if (state) setCollaborationState(state);
    const task = state?.tasks
      .filter((candidate) => candidate.snapshot.sourceMessageIds.includes(message.id))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, actionTriggered: true, collaborationTaskId: task?.taskId } : item));
  };

  const submitUserInput = async (questionId: string) => {
    if (!userInputRequest || userInputSubmitting) return;
    const answer = userInputAnswers[questionId]?.trim() || "";
    if (!answer) return;
    const nextConfirmedQuestionIds = new Set(confirmedQuestionIds).add(questionId);
    setConfirmedQuestionIds(nextConfirmedQuestionIds);
    // 官方请求仍按原 requestId 一次回传完整答案；正常会话每次只有一题，多题仅作为协议容错逐题锁定。
    if (nextConfirmedQuestionIds.size < userInputRequest.questions.length) return;
    const answers: Record<string, string[]> = Object.fromEntries(userInputRequest.questions.map((question) => [question.id, [userInputAnswers[question.id]?.trim() || ""]]));
    if (Object.values(answers).some((values) => !values[0])) return;
    setUserInputSubmitting(true);
    try {
      await window.desktop?.resolveCodexUserInput({ requestId: userInputRequest.requestId, answers });
      setUserInputRequest(null);
    } catch (error) {
      setScreenshotError(error instanceof Error ? error.message : "Unable to submit clarification answers.");
      setConfirmedQuestionIds((current) => {
        const next = new Set(current);
        next.delete(questionId);
        return next;
      });
      setUserInputSubmitting(false);
    }
  };

  const startScreenshot = async (hideOwnerWindow = false, destination: "main" | "nangong" = "main") => {
    if (screenshotBusy) return;
    const destinationAttachments = destination === "nangong" ? nangongAttachments : attachments;
    if (destinationAttachments.length >= 5) {
      setScreenshotError("最多可以同时发送 5 张截图。");
      return;
    }
    setScreenshotBusy(true);
    screenshotDestinationRef.current = destination;
    setScreenshotMode(hideOwnerWindow ? "hidden" : "current");
    setScreenshotError("");
    setScreenRecordingSettingsAvailable(false);
    setScreenRecordingRestartRequired(false);
    setSettingsOpen(false);
    try {
      if (window.desktop) {
        // 两个入口共用同一套预热与长期桌面流；本次应用运行中的后续截图只冻结新帧，不再分别建立截图资源。
        await nextRenderedFrame();
        if (!screenCapturePreparedRef.current) {
          const startedAt = performance.now();
          const preparation = await window.desktop.prepareScreenCapture();
          if (preparation.status === "blocked") {
            setScreenshotError(preparation.reason === "permission-required" ? screenPermissionRecoveryMessage : text.screenSourceUnavailable);
            setScreenRecordingSettingsAvailable(preparation.canOpenSettings);
            return;
          }
          const remainingIndicatorTime = Math.max(0, 320 - (performance.now() - startedAt));
          if (remainingIndicatorTime > 0) await delay(remainingIndicatorTime);
          screenCapturePreparedRef.current = true;
        }
      }
      await window.desktop?.captureScreen({ hideOwnerWindow });
    } catch (error) {
      setScreenshotError(readableDesktopError(error, "Unable to capture screen"));
    } finally {
      setScreenshotBusy(false);
      setScreenshotMode(null);
    }
  };

  const openScreenRecordingSettings = async () => {
    screenRecordingSettingsOpenedRef.current = true;
    try {
      await window.desktop?.openScreenRecordingSettings();
    } catch (error) {
      screenRecordingSettingsOpenedRef.current = false;
      setScreenshotError(readableDesktopError(error, text.screenSourceUnavailable));
      setScreenRecordingSettingsAvailable(false);
    }
  };

  useEffect(() => {
    if (!screenRecordingSettingsAvailable) return;
    const desktop = window.desktop;
    if (!desktop) return;
    const recheckScreenRecordingPermission = () => {
      if (!screenRecordingSettingsOpenedRef.current || screenRecordingRecheckBusyRef.current || document.visibilityState !== "visible") return;
      screenRecordingRecheckBusyRef.current = true;
      void desktop.prepareScreenCapture().then((preparation) => {
        if (preparation.status === "ready") {
          screenCapturePreparedRef.current = true;
          screenRecordingSettingsOpenedRef.current = false;
          setScreenshotError("");
          setScreenRecordingSettingsAvailable(false);
          setScreenRecordingRestartRequired(false);
          return;
        }
        setScreenshotError(preparation.reason === "permission-required" ? screenPermissionRestartMessage : text.screenSourceUnavailable);
        setScreenRecordingSettingsAvailable(preparation.canOpenSettings);
        setScreenRecordingRestartRequired(preparation.reason === "permission-required");
      }).catch((error) => {
        setScreenshotError(readableDesktopError(error, text.screenSourceUnavailable));
      }).finally(() => {
        screenRecordingRecheckBusyRef.current = false;
      });
    };
    window.addEventListener("focus", recheckScreenRecordingPermission);
    document.addEventListener("visibilitychange", recheckScreenRecordingPermission);
    return () => {
      window.removeEventListener("focus", recheckScreenRecordingPermission);
      document.removeEventListener("visibilitychange", recheckScreenRecordingPermission);
    };
  }, [screenPermissionRestartMessage, screenRecordingSettingsAvailable, text.screenSourceUnavailable]);

  const restartForScreenRecordingPermission = async () => {
    if (screenRecordingRestarting) return;
    setScreenRecordingRestarting(true);
    setScreenshotError(locale === "ja" ? "AI Desktop を再起動しています…" : "正在重启 AI Desktop 以应用屏幕录制权限…");
    try {
      await window.desktop?.restartForScreenRecordingPermission();
    } catch (error) {
      setScreenRecordingRestarting(false);
      setScreenshotError(readableDesktopError(error, text.screenSourceUnavailable));
    }
  };

  const pasteClipboardImages = async (files: File[], destination: "main" | "nangong" = "main") => {
    if (screenshotBusy || files.length === 0) return;
    const destinationAttachments = destination === "nangong" ? nangongAttachments : attachments;
    if (destinationAttachments.length + files.length > 5) {
      setScreenshotError("最多可以同时发送 5 张图片。");
      return;
    }
    setScreenshotBusy(true);
    setScreenshotError("");
    try {
      // 剪贴板图片先统一转为 PNG，再复用受主进程签名保护的截图附件落盘与发送链路。
      const dataUrls = await Promise.all(files.map(imageFileToPngDataUrl));
      const savedAttachments: ComposerAttachment[] = [];
      for (const dataUrl of dataUrls) {
        const saved = await window.desktop?.saveScreenshot({ originalDataUrl: dataUrl, annotatedDataUrl: dataUrl, hasAnnotations: false });
        if (!saved) throw new Error("AI Desktop clipboard image service is unavailable.");
        savedAttachments.push({ ...saved, dataUrl });
      }
      (destination === "nangong" ? setNangongAttachments : setAttachments)((current) => [...current, ...savedAttachments]);
      const info = await window.desktop?.getTempDirectoryInfo();
      if (info) setTempInfo(info);
    } catch (error) {
      setScreenshotError(error instanceof Error ? error.message : "Unable to paste clipboard image");
    } finally {
      setScreenshotBusy(false);
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (imageFiles.length === 0) return;
    // 只有图片剪贴板才接管粘贴；普通文字仍由 textarea 使用系统默认行为处理。
    event.preventDefault();
    void pasteClipboardImages(imageFiles);
  };

  const clearTempFiles = async () => {
    if (!await selUi.confirm({ title: text.clearTemp, message: text.clearConfirm, tone: "danger" })) return;
    const info = await window.desktop?.clearTempFiles();
    if (info) setTempInfo(info);
    setAttachments([]);
  };

  const clearTrustedCommands = async () => {
    if (!await selUi.confirm({ title: text.clearTrustedCommands, message: text.clearTrustedConfirm, tone: "danger" })) return;
    const info = await window.desktop?.clearTrustedCommands();
    if (info) setTrustedCommandInfo(info);
  };

  const clearTestData = async () => {
    const copy = testDataResetCopy[locale];
    if (!await selUi.confirm({ title: copy.action, message: copy.confirm, tone: "danger", confirmLabel: copy.action })) return;
    setTestDataResetting(true);
    setTestDataResetError("");
    try {
      await window.desktop?.clearTestData();
    } catch (error) {
      setTestDataResetError(readableDesktopError(error, locale === "ja" ? "テストデータを消去できませんでした。" : "清空测试数据失败。"));
      setTestDataResetting(false);
    }
  };

  const toggleAutomaticTesting = async () => {
    if (automaticTestEnabledRef.current) {
      automaticTestEnabledRef.current = false;
      setAutomaticTestEnabled(false);
      setAutomaticTestDialog(null);
      void discardAutomaticQueued();
      return;
    }
    if (automaticTestChecking || loading) return;
    setAutomaticTestChecking(true);
    setAutomaticTestDialog(null);
    try {
      const result = await window.desktop?.prepareAutomaticTesting();
      if (!result) throw new Error("Automatic test preflight is unavailable.");
      if (result.status !== "ready") {
        setAutomaticTestDialog(result);
        return;
      }
      automaticTestEnabledRef.current = true;
      setAutomaticTestEnabled(true);
      const latestCompletedTask = [...messages].reverse().find((message) =>
        message.role === "assistant"
        && message.managedMode === "task-managed"
        && message.streamTerminal
        && message.streamStatus !== "failed"
        && message.managedExecution?.stage === "completed"
        && message.managedExecution.status === "completed",
      );
      // 用户在代码验证已经结束后再开启开关时，立即把该任务送入自动测试，不要求再次点击“测试一下”。
      if (latestCompletedTask) enqueueAutomaticTest(latestCompletedTask.id);
    } catch (error) {
      setAutomaticTestDialog({
        status: "blocked",
        checkedAt: new Date().toISOString(),
        checks: [{
          id: "runner",
          status: "failed",
          label: locale === "ja" ? "事前確認" : "环境预检",
          detail: readableDesktopError(error, locale === "ja" ? "自動テスト環境を確認できません。" : "无法检查自动测试环境。"),
        }],
      });
    } finally {
      setAutomaticTestChecking(false);
    }
  };

  const cancelActiveTurn = () => {
    void window.desktop?.cancel();
    flushStreamEventsRef.current();
    const assistantId = activeAssistantIdRef.current;
    if (assistantId !== null) {
      setMessages((current) => current.map((item) => item.id === assistantId
        ? { ...item, streaming: false, streamTerminal: true, streamStatus: "interrupted" }
        : item));
    }
    activeAssistantIdRef.current = null;
    setLoading(false);
  };

  const login = async () => {
    setLoginHint("");
    try {
      await window.desktop?.loginWithChatGPT();
      setLoginHint(text.browserOpened);
    } catch (error) {
      setLoginHint(error instanceof Error ? error.message : "ChatGPT login unavailable");
    }
  };

  const logout = async () => {
    const status = await window.desktop?.logoutCodex();
    if (status) setCodexStatus(status);
    activeAssistantIdRef.current = null;
    setMessages([]);
  };

  const resolveApproval = async (decision: "accept" | "decline") => {
    if (!approval) return;
    const result = await window.desktop?.resolveCodexApproval(approval.requestId, decision);
    if (result?.status === "resolved" && decision === "accept" && approval.kind === "command" && approval.trustEligible) {
      const info = await window.desktop?.getTrustedCommandInfo();
      if (info) setTrustedCommandInfo(info);
    }
    setApproval(null);
  };

  const shellStyle = { "--explorer-width": `${explorerWidth}px` } as CSSProperties;
  const configuredModel = modelCatalog.models.find((model) => model.id === defaultModel) || null;
  const selectedModel = defaultModel ? configuredModel : modelCatalog.models.find((model) => model.isDefault) || null;
  const configuredModelUnavailable = Boolean(defaultModel && !modelCatalogLoading && modelCatalog.models.length > 0 && !configuredModel);
  const supportedEfforts = selectedModel?.supportedReasoningEfforts || [];
  // 固定 app-server 已提供该字段；对仍在刷新中的旧目录安全降级为仅支持标准速度，不能让设置页崩溃。
  const fastServiceTierSupported = selectedModel?.supportedServiceTiers?.includes("fast") === true;
  const configuredSpeedUnavailable = serviceTier === "fast" && !modelCatalogLoading && !fastServiceTierSupported;
  const workspaceSectionExpanded = activeExplorerSection === "workspace";
  const tasksSectionExpanded = activeExplorerSection === "tasks";
  const collaborationMode = collaborationState?.mode === "collaboration";
  const selectedCollaborationMember = collaborationState?.members.find((member) => member.memberId === collaborationState.selectedMemberId) || null;
  const terminalCollaborationStates = new Set<CollaborationTask["state"]>(["integrated", "cancelled"]);
  const completedCollaborationTasks = collaborationState?.tasks.filter((task) => terminalCollaborationStates.has(task.state)).sort((left, right) => (right.completedAt || right.updatedAt).localeCompare(left.completedAt || left.updatedAt)) || [];
  const selectedMemberTasks = collaborationState?.tasks.filter((task) => !terminalCollaborationStates.has(task.state) && (
    task.initiator?.memberId === selectedCollaborationMember?.memberId
    || task.executorMemberId === selectedCollaborationMember?.memberId
    || task.executionRecords.some((record) => record.executor.memberId === selectedCollaborationMember?.memberId)
  )) || [];
  const selectedCollaborationTask = collaborationState?.tasks.find((task) => task.taskId === selectedCollaborationTaskId) || null;
  const selectedCollaborationTaskMember = selectedCollaborationTask
    ? collaborationState?.members.find((member) => member.memberId === selectedCollaborationTask.executorMemberId)
      || collaborationState?.members.find((member) => member.memberId === selectedCollaborationTask.initiator?.memberId)
      || selectedCollaborationMember
    : null;
  const showHanLiConversationWorkspace = !collaborationMode || (collaborationPanel === "member" && selectedCollaborationMember?.memberId === "han-li");
  const showNangongConversationWorkspace = Boolean(collaborationMode && collaborationPanel === "member" && selectedCollaborationMember?.memberId === "nangong-wan" && nangongEvolutionState);
  const evolutionWorkspacePerspective = collaborationMode && collaborationPanel === "member" && selectedCollaborationMember?.memberId === "han-li"
    ? "hanli"
    : collaborationMode && collaborationPanel === "member" && selectedCollaborationMember?.memberId === "nangong-wan"
      ? "nangong"
      : null;
  const collaborationTabTitle = collaborationPanel === "execution-list"
    ? (locale === "ja" ? "実行一覧" : "执行列表")
    : collaborationPanel === "task-group"
      ? (locale === "ja" ? "タスク協同グループ" : "任务协作群")
    : collaborationPanel === "task-detail"
      ? selectedCollaborationTask?.snapshot.title || (locale === "ja" ? "タスク詳細" : "任务详情")
      : selectedCollaborationMember?.displayName || (locale === "ja" ? "協同" : "协同模式");
  const nangongNewConversationLabel = locale === "ja" ? "南宮婉の会話を新しく作り直す" : "重新建立南宫婉对话";

  return <div ref={shellRef} className={`developer-shell ${explorerExpanded ? "" : "explorer-collapsed"}`} lang={locale} style={shellStyle}>
    <header className="dev-titlebar">
      <div className="dev-brand"><Code24Regular /><strong>AI Desktop</strong><span>{text.title}</span>{archiveDistribution && <span>压缩包版</span>}</div>
      <div className="dev-command"><Search24Regular /><span>{projectRoot}</span></div>
      <WindowControls />
    </header>

    <aside className="dev-activitybar">
      <button className="active" title={`${explorerExpanded ? text.collapse : text.expand}${text.files}`} aria-label={`${explorerExpanded ? text.collapse : text.expand}${text.files}`} aria-pressed={explorerExpanded} onClick={() => setExplorerExpanded((value) => !value)}><Folder24Regular /></button><button><Search24Regular /></button><button><Branch24Regular /></button><button><Bug24Regular /></button>
      <SettingsFloatingPanel locale={locale} open={settingsOpen} onOpenChange={setSettingsOpen}>
        <div className="dev-account"><span>{text.account}</span><strong>{codexStatus.account.email || codexStatus.account.planType || text.signedOut}</strong><small>{codexStatus.runtime ? `${codexStatus.runtime.source === "downloaded" ? "校验下载" : "安装包内置"} Codex ${codexStatus.runtime.version}` : codexStatus.connected ? "openai/codex app-server" : codexStatus.error || "Harness offline"}</small>{codexStatus.account.authenticated ? <button type="button" onClick={() => void logout()}><span>{text.signOut}</span></button> : <ChatGPTLoginAction label={text.signIn} onLogin={() => void login()} />}{loginHint && <em>{loginHint}</em>}</div>
        {/* 测试数据清空是重启级危险操作，固定放在账号卡片后，避免被常规设置与长列表挤出首屏。 */}
        <div className="temp-card test-data-reset-card"><span>{testDataResetCopy[locale].title}</span><strong>{testDataResetCopy[locale].summary}</strong><small>{testDataResetCopy[locale].detail}</small>{testDataResetError && <em role="alert">{testDataResetError}</em>}<div><button className="danger" disabled={testDataResetting} onClick={() => void clearTestData()}><Delete24Regular />{testDataResetting ? testDataResetCopy[locale].busy : testDataResetCopy[locale].action}</button></div></div>
        <section className="model-settings-card" aria-labelledby="global-model-settings-title">
          <header><div><span id="global-model-settings-title">{locale === "ja" ? "グローバルモデル設定" : "全局模型配置"}</span><small>{locale === "ja" ? "すべての会話と協同タスクに適用" : "对所有会话与协同任务生效"}</small></div><strong>{selectedModel?.displayName || (locale === "ja" ? "Codex の既定値" : "Codex 默认")}</strong></header>
          <label><span>{locale === "ja" ? "既定モデル" : "默认模型"}</span><select aria-label={locale === "ja" ? "既定モデル" : "默认模型"} value={defaultModel || ""} disabled={modelCatalogLoading} onChange={(event) => selectDefaultModel(event.target.value)}><option value="">{modelCatalogLoading ? (locale === "ja" ? "モデルを読み込み中…" : "正在读取模型…") : (locale === "ja" ? "Codex の既定値" : "Codex 默认")}</option>{defaultModel && !modelCatalog.models.some((model) => model.id === defaultModel) && <option value={defaultModel}>{defaultModel}</option>}{modelCatalog.models.map((model) => <option key={model.id} value={model.id}>{model.displayName}{model.provider ? ` · ${model.provider}` : ""}</option>)}</select></label>
          <label><span>{locale === "ja" ? "推論の強度" : "推理强度"}</span><select aria-label={locale === "ja" ? "推論の強度" : "推理强度"} value={reasoningEffort || ""} disabled={modelCatalogLoading || supportedEfforts.length === 0} onChange={(event) => updateSettings({ reasoningEffort: (event.target.value || null) as ReasoningEffort | null })}><option value="">{locale === "ja" ? "モデルの既定値" : "模型默认"}</option>{supportedEfforts.map((effort) => <option key={effort} value={effort}>{reasoningEffortLabel(effort, locale)}</option>)}</select></label>
          <label><span>{locale === "ja" ? "推論速度" : "推理速度"}</span><select aria-label={locale === "ja" ? "推論速度" : "推理速度"} value={serviceTier} onChange={(event) => updateSettings({ serviceTier: event.target.value as ModelServiceTier })}><option value="default">{locale === "ja" ? "標準" : "标准"}</option><option value="fast" disabled={!fastServiceTierSupported}>{locale === "ja" ? "高速" : "快速"}</option></select></label>
          {configuredModelUnavailable && <em role="alert">{locale === "ja" ? "保存済みモデルは現在利用できません。別のモデルを選択してください。" : "已保存的模型当前不可用，请重新选择。"}</em>}
          {configuredSpeedUnavailable && <em role="alert">{locale === "ja" ? "選択中のモデルは高速処理に対応していません。標準速度へ変更してください。" : "当前模型不支持快速处理，请切换为标准速度。"}</em>}
          {modelSettingsError && <em role="alert">{modelSettingsError}</em>}
        </section>
        <div className="temp-card codex-corpus-card">
          <span>{locale === "ja" ? "Codex 会話の学習登録" : "Codex 聊天训练入库"}</span>
          <strong>{codexAppCorpusIngestionEnabled ? (locale === "ja" ? "有効" : "已开启") : (locale === "ja" ? "無効" : "未开启")}</strong>
          <small>{locale === "ja" ? "現在の SELPLAT ワークスペースに属する完了済みの各ターンだけを登録し、システム指示・ツール出力・ファイル注入は除外します。" : "只将当前 SELPLAT 工作区中已经完成的每轮可见对话入库，排除系统指令、工具输出和文件注入内容。"}</small>
          {corpusSemanticBackfill?.message && <em role="status">{corpusSemanticBackfill.message}{corpusSemanticBackfill.state === "running" ? ` · ${corpusSemanticBackfill.processedCount}/${corpusSemanticBackfill.targetCount}` : ""}</em>}
          <div>
            <button type="button" aria-pressed={codexAppCorpusIngestionEnabled} onClick={() => updateSettings({ codexAppCorpusIngestionEnabled: !codexAppCorpusIngestionEnabled })}>{codexAppCorpusIngestionEnabled ? (locale === "ja" ? "登録を停止" : "停止入库") : (locale === "ja" ? "登録を開始" : "开启入库")}</button>
            <button type="button" aria-label={locale === "ja" ? "履歴の AI 要約を一括補完" : "一键补齐历史 AI 摘要"} disabled={corpusSemanticBackfill?.state === "running"} onClick={() => void window.desktop?.startCorpusSemanticBackfill().then(setCorpusSemanticBackfill)}>{corpusSemanticBackfill?.state === "running" ? (locale === "ja" ? "補完中…" : "正在补齐…") : (locale === "ja" ? "履歴を一括補完" : "补齐历史摘要")}</button>
          </div>
        </div>
        <label>Language<select value={locale} onChange={(event) => updateSettings({ locale: event.target.value as Locale })}><option value="zh-CN">简体中文</option><option value="ja">日本語</option></select></label>
        <label>Sandbox<select value={sandboxMode} onChange={(event) => updateSettings({ sandboxMode: event.target.value as SandboxMode })}><option value="read-only">{text.readOnly}</option><option value="workspace-write">{text.write}</option></select></label>
        <div className="temp-card"><span>{text.tempFiles}</span><strong>{tempInfo ? `${tempInfo.fileCount} files · ${formatBytes(tempInfo.totalBytes)}` : "..."}</strong><div><button onClick={() => void window.desktop?.openTempDirectory()}><FolderOpen24Regular />{text.openTemp}</button><button className="danger" onClick={() => void clearTempFiles()}><Delete24Regular />{text.clearTemp}</button></div></div>
        <div className="temp-card trust-card"><span>{text.trustedCommands}</span><strong>{trustedCommandInfo.count}</strong><small>{text.trustHint}</small><div><button className="danger" disabled={trustedCommandInfo.count === 0} onClick={() => void clearTrustedCommands()}><Delete24Regular />{text.clearTrustedCommands}</button></div></div>
        <div className="temp-card audit-card"><span>{text.auditLogs}</span><strong>{auditInfo?.latestTask ? `${auditStatusText(auditInfo.latestTask.status, locale)} · ${auditInfo.latestTask.reasons.length} ${locale === "ja" ? "件の理由" : "项原因"}` : text.noAuditTask}</strong>{auditInfo?.latestTask?.reasons.map((reason) => <em key={reason.code}>{reason.message}</em>)}<div><button onClick={() => void window.desktop?.openAuditLogDirectory()}><FolderOpen24Regular />{text.openAuditLogs}</button></div></div>
        <RuleManagementFeature locale={locale} />
      </SettingsFloatingPanel>
    </aside>

    <aside className="dev-explorer">
      <div className="dev-section-title explorer-title">
        <button className="section-toggle" aria-expanded={explorerExpanded} aria-controls="developer-explorer-sections" aria-label={`${explorerExpanded ? text.collapse : text.expand}${text.files}`} onClick={() => setExplorerExpanded((value) => !value)}>{explorerExpanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}<span>{text.files}</span></button>
      </div>
      <div id="developer-explorer-sections" className={`dev-explorer-sections active-${activeExplorerSection ?? "none"}`}>
      <section className={`explorer-pane workspace-pane ${workspaceSectionExpanded ? "expanded" : "collapsed"}`}>
        <div className="dev-section-title workspace-title">
          <button className="section-toggle" aria-expanded={workspaceSectionExpanded} aria-controls="developer-workspace-list" aria-label={`${workspaceSectionExpanded ? text.collapse : text.expand}${text.workspaces}`} onClick={() => toggleExplorerSection("workspace")}>{workspaceSectionExpanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}<span>{text.workspaces}</span></button>
          <button className="section-action" title={text.addWorkspace} aria-label={text.addWorkspace} onClick={() => void addWorkspace()}><Add24Regular /></button>
        </div>
        {workspaceSectionExpanded && <div id="developer-workspace-list" className="workspace-list">
          {workspaces?.roots.map((root) => {
            const expanded = expandedWorkspaces.has(root.id);
            const primary = root.id === workspaces.primaryId;
            const readOnly = root.permission === "read-only";
            return <section className={`workspace-accordion ${expanded ? "expanded" : ""}`} key={root.id}>
              <div className="workspace-header">
                <button className="workspace-toggle" onClick={() => void toggleWorkspace(root.id)} aria-expanded={expanded} title={root.path}>
                  {expanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
                  <Folder24Regular />
                  <strong>{root.name}</strong>
                </button>
                <div className="workspace-actions">
                  <button className={`workspace-permission-action ${readOnly ? "read-only" : "workspace-write"}`} data-sel-tooltip={readOnly ? text.readOnlyTip : text.writeTip} data-sel-tooltip-mode="always" aria-label={readOnly ? text.readOnlyTip : text.writeTip} aria-pressed={readOnly} onClick={() => void updateWorkspacePermission(root.id, readOnly ? "workspace-write" : "read-only")}>{readOnly ? <ShieldLock16Filled /> : <ShieldLock16Regular />}</button>
                  <button className={`workspace-primary-action ${primary ? "primary-root" : ""}`} data-sel-tooltip={primary ? text.primary : text.makePrimary} data-sel-tooltip-mode="always" aria-label={primary ? text.primary : text.makePrimary} disabled={primary} onClick={() => void setPrimaryWorkspace(root.id)}>{primary ? <Star16Filled /> : <Star16Regular />}</button>
                  <button className="workspace-remove-action" data-sel-tooltip={workspaces.roots.length === 1 ? text.minimumWorkspace : text.remove} data-sel-tooltip-mode="always" aria-label={workspaces.roots.length === 1 ? text.minimumWorkspace : text.remove} disabled={workspaces.roots.length === 1} onClick={() => void removeWorkspace(root.id, root.name)}><Delete16Regular /></button>
                </div>
              </div>
              {expanded && <div className="workspace-panel">
                <div className="workspace-meta" title={root.path}><span>{root.path}</span></div>
                <div className="workspace-tree">
                  {(workspaceEntries[root.id] || []).map((entry) => <div className="dev-file indent" key={`${entry.kind}:${entry.name}`}>{entry.kind === "directory" ? <Folder24Regular /> : <Document24Regular />}{entry.name}</div>)}
                </div>
              </div>}
            </section>;
          })}
          {workspaceError && <div className="workspace-error">{workspaceError}</div>}
        </div>}
      </section>
      <section className={`explorer-pane tasks-pane ${tasksSectionExpanded ? "expanded" : "collapsed"}`}>
        <div className="dev-section-title tasks">
          <button className="section-toggle" aria-expanded={tasksSectionExpanded} aria-controls="developer-task-list" aria-label={`${tasksSectionExpanded ? text.collapse : text.expand}${text.tasks}`} onClick={() => toggleExplorerSection("tasks")}>{tasksSectionExpanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}<span>{text.tasks}</span></button>
        </div>
        {tasksSectionExpanded && <div id="developer-task-list" className="task-list">
          <div className="operating-mode-switch" role="group" aria-label={locale === "ja" ? "実行モード" : "运行模式"}>
            <button type="button" className={!collaborationMode ? "active" : ""} aria-pressed={!collaborationMode} onClick={() => void setOperatingMode("single-conversation")}>{locale === "ja" ? "単一会話" : "单会话"}</button>
            <button type="button" className={collaborationMode ? "active" : ""} aria-pressed={collaborationMode} onClick={() => void setOperatingMode("collaboration")}>{locale === "ja" ? "協同" : "协同模式"}</button>
          </div>
          {collaborationMode
            ? <><button type="button" className={`collaboration-execution-list-entry ${collaborationPanel === "execution-list" ? "selected" : ""}`} aria-pressed={collaborationPanel === "execution-list"} onClick={() => { setCollaborationPanel("execution-list"); setSelectedCollaborationTaskId(null); }}><span><Document24Regular />{locale === "ja" ? "実行一覧" : "执行列表"}</span><strong>{completedCollaborationTasks.length}</strong></button><button type="button" className={`collaboration-execution-list-entry collaboration-task-group-entry ${collaborationPanel === "task-group" ? "selected" : ""}`} aria-pressed={collaborationPanel === "task-group"} onClick={() => { setCollaborationPanel("task-group"); setSelectedCollaborationTaskId(null); }}><span><Branch24Regular />{locale === "ja" ? "タスク協同グループ" : "任务协作群"}</span><strong>{collaborationTimeline?.groups.length || 0}</strong></button><div className="collaboration-member-list">{collaborationState?.members.map((member) => <button type="button" key={member.memberId} className={`collaboration-member ${collaborationPanel === "member" && member.memberId === collaborationState.selectedMemberId ? "selected" : ""}`} aria-pressed={collaborationPanel === "member" && member.memberId === collaborationState.selectedMemberId} onClick={() => void selectCollaborationMember(member.memberId)}><span><i className={member.state} />{member.displayName}</span><small>{collaborationMemberStateLabel(member, locale)}</small></button>)}</div><button type="button" className="add-collaboration-member" onClick={() => void createCollaborationMember()}><Add24Regular />{locale === "ja" ? "メンバー追加" : "新增人物"}</button></>
            : auditInfo?.latestTask
              ? <div className="task-summary" title={auditInfo.latestTask.request}><strong>{auditInfo.latestTask.request || text.newTask}</strong><span>{auditStatusText(auditInfo.latestTask.status, locale)}</span></div>
              : <span className="task-empty">{text.noAuditTask}</span>}
        </div>}
      </section>
      </div>
    </aside>

    {explorerExpanded && <div
      className="explorer-resizer"
      role="separator"
      aria-label={locale === "ja" ? "エクスプローラーの幅を変更" : "调整资源管理器宽度"}
      aria-orientation="vertical"
      aria-valuemin={MINIMUM_EXPLORER_WIDTH}
      aria-valuemax={MAXIMUM_EXPLORER_WIDTH}
      aria-valuenow={explorerWidth}
      tabIndex={0}
      onDoubleClick={() => setExplorerWidth(DEFAULT_EXPLORER_WIDTH)}
      onPointerDown={startExplorerResize}
      onKeyDown={(event) => {
        if (event.key === "Home") { event.preventDefault(); setExplorerWidth(DEFAULT_EXPLORER_WIDTH); return; }
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        setExplorerWidth((width) => clampExplorerWidth(width + (event.key === "ArrowLeft" ? -16 : 16)));
      }}
    />}

    <div className="workspace-stage-single">
    <main className="dev-main">
      <div className={`dev-tab${evolutionWorkspacePerspective ? " with-workspace-action" : ""}`}><Prompt24Regular /><span>{collaborationMode ? collaborationTabTitle : "Codex Chat"}</span>{evolutionWorkspacePerspective && <button type="button" className="open-evolution-workspace" onClick={() => { setEvolutionWorkspaceOpenError(""); void window.desktop?.openEvolutionWorkspace(defaultEvolutionWorkspaceLocation(evolutionWorkspacePerspective)).catch((error) => setEvolutionWorkspaceOpenError(readableDesktopError(error, "无法打开专题演化工作台。"))); }}>{locale === "ja" ? "専門進化ワークベンチ" : "打开专题演化工作台"}</button>}{showHanLiConversationWorkspace && <button type="button" className="tab-new-task" data-sel-tooltip={text.newCodexSession} data-sel-tooltip-mode="always" aria-label={text.newCodexSession} onClick={() => void startNewTask()}><ArrowClockwise24Regular /></button>}{showNangongConversationWorkspace && <button type="button" className="tab-new-task" data-sel-tooltip={nangongNewConversationLabel} data-sel-tooltip-mode="always" aria-label={nangongNewConversationLabel} disabled={nangongNewConversationBusy} onClick={() => void startNewNangongConversation()}><ArrowClockwise24Regular className={nangongNewConversationBusy ? "screenshot-spinner" : undefined} /></button>}<Dismiss20Regular /></div>
      {evolutionWorkspaceOpenError && <div className="evolution-window-error" role="alert">{evolutionWorkspaceOpenError} 当前数据没有被修改，请检查工作台位置参数后重试。</div>}
      {aiMemoryDatabaseStatus && aiMemoryDatabaseStatus.state !== "ready" && <div className={`ai-memory-recovery ${aiMemoryDatabaseStatus.state}`} role="alert"><strong>{locale === "ja" ? "AI Memory データベースは停止中です" : "AI Memory 数据库已停用"}</strong><span>{locale === "ja" ? "設定、移行、または整合性の問題を確認し、元のデータベースを復旧してから再起動してください。" : aiMemoryDatabaseStatus.message || "请恢复数据库后重新启动。"}</span></div>}
      {showHanLiConversationWorkspace ? <section ref={chatRef} className="selconversation-timeline">
        {messages.length === 0 && <div className="dev-empty"><div className="dev-orb"><Code24Regular /></div><h1>{locale === "ja" ? "何を作りますか？" : "今天要构建什么？"}</h1><p>{codexStatus.account.authenticated ? text.ready : text.signedOut}</p>{!codexStatus.account.authenticated && <ChatGPTLoginAction label={text.signIn} onLogin={() => void login()} />}{!codexStatus.account.authenticated && loginHint && <em className="dev-login-hint">{loginHint}</em>}</div>}
        {messages.map((message) => {
          const messageTask = message.collaborationTaskId
            ? collaborationState?.tasks.find((task) => task.taskId === message.collaborationTaskId) || null
            : null;
          return <article key={message.id} className="selconversation-message" data-role={message.role} data-streaming={message.streaming || undefined}><header>{message.role === "user" ? "YOU" : "CODEX"}</header><div className="selconversation-message-body">{message.attachments?.length ? <div className="selconversation-message-attachments">{message.attachments.map((attachment) => <img key={attachment.id} src={attachment.dataUrl} alt={attachment.name} />)}</div> : null}{message.text && (message.role === "assistant" ? <MarkdownMessage text={message.text} /> : <div className="message-text">{message.text}</div>)}{message.role === "assistant" && <StreamDetails message={message} locale={locale} />}{message.role === "assistant" && messageTask && <CollaborationStatusChain task={messageTask} locale={locale} onRetry={async (taskId) => { const state = await window.desktop?.continueCollaborationTask(taskId); if (state) setCollaborationState(state); }} />}{message.role === "assistant" && message.id === activeAssistantIdRef.current && userInputRequest && <CodexUserInputPanel request={userInputRequest} answers={userInputAnswers} customAnswerIds={customAnswerIds} confirmedQuestionIds={confirmedQuestionIds} locale={locale} submitting={userInputSubmitting} onChoose={(questionId, value) => { setCustomAnswerIds((current) => { const next = new Set(current); next.delete(questionId); return next; }); setUserInputAnswers((current) => ({ ...current, [questionId]: value })); }} onChooseCustom={(questionId) => { setCustomAnswerIds((current) => new Set(current).add(questionId)); setUserInputAnswers((current) => ({ ...current, [questionId]: "" })); }} onCustomChange={(questionId, value) => setUserInputAnswers((current) => ({ ...current, [questionId]: value }))} onConfirm={(questionId) => void submitUserInput(questionId)} />}{message.role === "assistant" && !message.streamError && (message.actionTriggered || message.id === latestManagedAssistantId) && <ManagedStageAction message={message} locale={locale} actionable={message.id === latestManagedAssistantId} activeMode={executionMode} onReturn={setExecutionMode} onAdvance={(mode, label) => collaborationMode && message.managedMode === "conversation-managed" ? void submitConfirmedCollaborationTask(message).catch((error) => setDispatchError(readableDesktopError(error, "无法提交协同任务。"))) : void send({ message: "1", displayText: label, mode, sourceMessageId: message.id })} />}</div></article>;
        })}
      </section> : showNangongConversationWorkspace && nangongEvolutionState
        ? <NangongConversationWorkspace key={nangongEvolutionState.conversation.conversationId} state={nangongEvolutionState} attachments={nangongAttachments} workspaces={workspaces} locale={locale} newConversationBusy={nangongNewConversationBusy} error={nangongError} onState={setNangongEvolutionState} onAttachments={setNangongAttachments} onScreenshot={(hidden) => void startScreenshot(hidden, "nangong")} onPaste={(files) => void pasteClipboardImages(files, "nangong")} onError={setNangongError} />
        : collaborationPanel === "task-group"
        ? <TaskCollaborationGroup snapshot={collaborationTimeline} liveTextByTaskId={Object.fromEntries(Object.entries(collaborationStreams).map(([taskId, output]) => [taskId, output.message.text]))} locale={locale} onManualApproval={(proposalId, title, content) => void manuallyApproveTimelineProposal(proposalId, title, content)} />
        : collaborationPanel === "execution-list"
        ? <CollaborationExecutionList tasks={completedCollaborationTasks} locale={locale} onOpen={(taskId) => { setSelectedCollaborationTaskId(taskId); setCollaborationPanel("task-detail"); }} />
        : collaborationPanel === "task-detail" && selectedCollaborationTask && selectedCollaborationTaskMember
          ? <CollaborationTaskDetail task={selectedCollaborationTask} member={selectedCollaborationTaskMember} liveOutput={collaborationStreams[selectedCollaborationTask.taskId] || null} automation={linghuAutomationState} locale={locale} onBack={() => { setSelectedCollaborationTaskId(null); setCollaborationPanel(terminalCollaborationStates.has(selectedCollaborationTask.state) ? "execution-list" : "member"); }} />
          : <CollaborationMemberPage member={selectedCollaborationMember} tasks={selectedMemberTasks} streams={collaborationStreams} locale={locale} linghuAutomation={linghuAutomationState} nangongEvolution={nangongEvolutionState} nangongAttachments={nangongAttachments} workspaces={workspaces} onLinghuState={setLinghuAutomationState} onNangongState={setNangongEvolutionState} onNangongAttachments={setNangongAttachments} onNangongScreenshot={(hidden) => void startScreenshot(hidden, "nangong")} onNangongPaste={(files) => void pasteClipboardImages(files, "nangong")} onError={setDispatchError} onRename={(member) => void renameCollaborationMember(member)} onDelete={(member) => void deleteCollaborationMember(member)} onContinue={(taskId) => void window.desktop?.continueCollaborationTask(taskId)} onCancel={(taskId) => void window.desktop?.cancelCollaborationTask(taskId)} onOpen={(taskId) => { setSelectedCollaborationTaskId(taskId); setCollaborationPanel("task-detail"); }} />}
      {showHanLiConversationWorkspace && <SelUiConversation id="selConversationHanLiId" onSubmit={() => void send()} timeline={null} composer={<form className="selconversation-composer" onSubmit={(event: FormEvent) => { event.preventDefault(); void send(); }}>
        {attachments.length > 0 && <div className="composer-attachments">{attachments.map((attachment) => <figure key={attachment.id}><img src={attachment.dataUrl} alt={attachment.name} /><figcaption>{text.attachment}</figcaption><button type="button" title={text.remove} onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}><Dismiss20Regular /></button></figure>)}</div>}
        {dispatchState.activeTask?.status === "recoverable" && <div className="dispatch-recovery" role="status"><span>发现上次未完成的任务</span><div><button type="button" onClick={() => void recoverConversationTask()}>继续执行</button><button type="button" onClick={() => void discardConversationRecovery()}>放弃任务</button></div></div>}
        {dispatchState.activeTask?.status === "running" && !loading && <div className="dispatch-background" role="status">任务正在后台执行，完成后将继续处理等待队列。</div>}
        {queuedSends.length > 0 && <div className="dispatch-queue" aria-label="等待队列">{queuedSends.map((item, index) => <div key={item.id} className="dispatch-queue-item"><span><b>{index + 1}</b>{item.displayText}</span><div>{dispatchState.activeTask?.status === "running" && <button type="button" onClick={() => void supplementQueuedMessage(item.id)}>补充到当前任务</button>}<button type="button" onClick={() => void discardQueuedMessage(item.id)}>移除</button></div></div>)}</div>}
        <textarea ref={composerRef} className="selconversation-input" data-sel-conversation-input value={input} onChange={(event) => setInput(event.target.value)} onPaste={onPaste} placeholder={text.placeholder} />
        {dispatchError && <div className="composer-error" role="alert"><span>{dispatchError}</span></div>}
        {screenshotError && <div className="composer-error" role="alert"><span>{screenshotError}</span>{(screenRecordingSettingsAvailable || screenRecordingRestartRequired) && <div className="composer-error-actions">{screenRecordingSettingsAvailable && <button type="button" onClick={() => void openScreenRecordingSettings()}>{text.openScreenRecordingSettings}</button>}{screenRecordingRestartRequired && <button type="button" className="primary" disabled={screenRecordingRestarting} onClick={() => void restartForScreenRecordingPermission()}>{locale === "ja" ? "AI Desktop を再起動" : "重启 AI Desktop"}</button>}</div>}</div>}
        <div className="selconversation-footer"><div className="composer-tools" aria-label="输入工具栏"><div className="composer-tool-group composer-context-tools"><span><ShieldCheckmark24Regular />{sandboxMode}</span><span className="execution-mode-badge">{managedModeLabel(executionMode, locale)}</span>{queuedSends.length > 0 && <span className="queued-send-count">待发送 {queuedSends.length}</span>}</div><div className="composer-tool-group composer-automation-tools"><button type="button" role="switch" aria-checked={automaticTestEnabled} className="selswitch composer-automatic-test-switch" disabled={automaticTestChecking || (loading && !automaticTestEnabled)} onClick={() => void toggleAutomaticTesting()}><span>{text.automaticTest}</span><i className="selswitch-track" aria-hidden="true"><i className="selswitch-thumb" /></i></button>{(automaticTestChecking || automaticTestEnabled) && <span className="automatic-test-status" role="status">{automaticTestChecking ? text.automaticTestChecking : text.automaticTestReady}</span>}</div><div className="composer-tool-group composer-attachment-tools"><button type="button" className="screenshot-button" aria-label={text.screenshot} data-sel-tooltip={text.screenshot} data-sel-tooltip-mode="always" disabled={screenshotBusy} onClick={() => void startScreenshot()}>{screenshotMode === "current" ? <ArrowClockwise24Regular className="screenshot-spinner" /> : <Screenshot24Regular />}</button><button type="button" className="screenshot-button" aria-label={text.hiddenScreenshot} data-sel-tooltip={text.hiddenScreenshot} data-sel-tooltip-mode="always" disabled={screenshotBusy} onClick={() => void startScreenshot(true)}>{screenshotMode === "hidden" ? <ArrowClockwise24Regular className="screenshot-spinner" /> : <EyeOff24Regular />}</button></div></div><div className="selconversation-actions">{loading && <button type="button" className="stop-action" aria-label="停止当前任务" title="停止当前任务" onClick={cancelActiveTurn}><Stop24Filled /></button>}<button type="button" className="selconversation-action" aria-label={loading ? "排队发送" : "发送"} title={loading ? "排队发送" : "发送"} onClick={() => void send()}><Send24Filled /></button></div></div>
      </form>} />}
    </main>
    </div>

    <footer className="dev-statusbar"><span><Branch24Regular /> main*</span><span>0 errors</span><span>{sandboxMode}</span><span>AI Memory {aiMemoryDatabaseStatus?.state === "ready" ? `v${aiMemoryDatabaseStatus.schemaVersion || "-"} · ${locale === "ja" ? "統合イベントセンター" : "统一事件中心"}` : (locale === "ja" ? "要復旧" : "待恢复")}</span><span>UTF-8</span></footer>

    <SelUiDialog id="ai-desktop-codex-approval" open={Boolean(approval)} title={approval?.title || "Codex Approval"} kicker="CODEX APPROVAL" dismissible={false} onRequestClose={() => undefined}>
      {approval && <>{approval.reason && <p className="seldialog-copy">{approval.reason}</p>}{approval.command && <pre className="seldialog-code">{approval.command}</pre>}{approval.cwd && <small>{approval.cwd}</small>}{approval.kind === "command" && approval.trustEligible && <p className="seldialog-copy">{text.trustHint}</p>}{approval.details && <details className="seldialog-detail"><summary>Details</summary><pre className="seldialog-code">{approval.details}</pre></details>}<div className="seldialog-actions"><button onClick={() => void resolveApproval("decline")}>{text.decline}</button><button data-sel-action="primary" onClick={() => void resolveApproval("accept")}>{approval.kind === "command" && approval.trustEligible ? text.approveAndTrust : text.approve}</button></div></>}
    </SelUiDialog>

    <SelUiDialog id="ai-desktop-automatic-test" open={Boolean(automaticTestDialog)} title={text.automaticTestBlocked} kicker="AUTOMATIC TEST" dismissible size="compact" onRequestClose={() => setAutomaticTestDialog(null)}>
      {automaticTestDialog && <><ul className="seldialog-checks">{automaticTestDialog.checks.map((check) => <li className={check.status} key={check.id}><i /><span><strong>{check.label}</strong><small>{check.detail}</small></span></li>)}</ul><div className="seldialog-actions"><button data-sel-action="primary" onClick={() => setAutomaticTestDialog(null)}>{text.close}</button></div></>}
    </SelUiDialog>
  </div>;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function CollaborationExecutionList({ tasks, locale, onOpen }: { tasks: CollaborationTask[]; locale: Locale; onOpen(taskId: string): void }) {
  if (tasks.length === 0) return <section className="collaboration-execution-page"><div className="execution-list-empty"><Document24Regular /><strong>{locale === "ja" ? "実行履歴はまだありません" : "暂无执行记录"}</strong><span>{locale === "ja" ? "完了した協同タスクはここに保存されます。" : "协同任务完成后会统一归档到这里。"}</span></div></section>;
  return <section className="collaboration-execution-page" aria-label={locale === "ja" ? "実行一覧" : "执行列表"}>
    <header><div><h1>{locale === "ja" ? "実行一覧" : "执行列表"}</h1><p>{locale === "ja" ? "完了した協同タスクを結果からすばやく確認できます。" : "按任务结果快速查看全部协同归档。"}</p></div><strong>{tasks.length}</strong></header>
    <div className="execution-record-list">{tasks.map((task) => {
      const executors = collaborationExecutorNames(task);
      return <details className="execution-record" key={task.taskId}>
        <summary>
          <span className={`execution-outcome ${task.resultSummary?.success ? "success" : "failed"}`}>{task.resultSummary?.success ? (locale === "ja" ? "完了" : "成功") : (locale === "ja" ? "未完了" : "未完成")}</span>
          <strong>{task.snapshot.title}</strong>
          <span className="execution-record-facts"><span><small>{locale === "ja" ? "起案者" : "发起人"}</small><b>{task.initiator?.displayName || (locale === "ja" ? "履歴なし" : "历史未记录")}</b></span><span><small>{locale === "ja" ? "実行者" : "执行人"}</small><b>{executors.join("、") || (locale === "ja" ? "未割当" : "未分配")}</b></span><span><small>{locale === "ja" ? "開始" : "开始时间"}</small><b>{formatCollaborationTime(task.startedAt, locale)}</b></span><span><small>{locale === "ja" ? "完了" : "完成时间"}</small><b>{formatCollaborationTime(task.completedAt, locale)}</b></span><span><small>{locale === "ja" ? "所要時間" : "总耗时"}</small><b>{formatCollaborationDuration(task.startedAt, task.completedAt, locale)}</b></span></span>
        </summary>
        <div className="execution-record-preview"><strong>{locale === "ja" ? "結果概要" : "任务结果摘要"}</strong><p>{task.resultSummary?.finalResult || task.finalResult || (locale === "ja" ? "結果概要はありません。" : "暂无结果摘要。")}</p><button type="button" onClick={() => onOpen(task.taskId)}>{locale === "ja" ? "完全な記録を開く" : "打开完整记录"}</button></div>
      </details>;
    })}</div>
  </section>;
}

function CollaborationTaskDetail({ task, member, liveOutput, automation, locale, onBack }: { task: CollaborationTask; member: CollaborationMember; liveOutput: CollaborationLiveOutput | null; automation: LinghuAutomationState | null; locale: Locale; onBack(): void }) {
  const summary = task.resultSummary;
  return <section className="collaboration-task-detail" aria-label={task.snapshot.title}>
    <header><button type="button" onClick={onBack}><ArrowReply24Regular />{locale === "ja" ? "戻る" : "返回"}</button><div><h1>{task.snapshot.title}</h1><p>{collaborationTaskStateLabel(task.state, locale)}</p></div></header>
    {task.historyCompleteness === "legacy-partial" && <div className="history-incomplete-note">{locale === "ja" ? "旧版の記録には完全な参加者・引継ぎ履歴がありません。" : "历史版本未记录完整参与者与转交流程，以下仅展示可确认事实。"}</div>}
    <section className={`task-result-hero ${summary?.success ? "success" : "incomplete"}`}>
      <div><span>{locale === "ja" ? "タスク結果" : "任务结果"}</span><strong>{summary?.success ? (locale === "ja" ? "正常完了" : "成功完成") : (locale === "ja" ? "未完了・要確認" : "未完成或仍有遗留")}</strong></div>
      <dl><div><dt>{locale === "ja" ? "最終結果" : "最终执行结果"}</dt><dd>{summary?.finalResult || task.finalResult || "—"}</dd></div><div><dt>{locale === "ja" ? "元の問題" : "原来存在的问题"}</dt><dd>{summary?.originalProblem || task.snapshot.problemStatement}</dd></div><div><dt>{locale === "ja" ? "解決した問題" : "本次解决的问题"}</dt><dd>{summary?.solvedProblem || "—"}</dd></div><div><dt>{locale === "ja" ? "変更内容" : "具体修正或改变"}</dt><dd>{summary?.changes || "—"}</dd></div><div><dt>{locale === "ja" ? "残件" : "失败或遗留内容"}</dt><dd>{summary?.remaining || (summary?.success ? (locale === "ja" ? "なし" : "无") : task.blockingReason || "—")}</dd></div></dl>
    </section>
    <section className="task-fact-strip"><span>{locale === "ja" ? "起案者" : "发起人"}<strong>{task.initiator?.displayName || (locale === "ja" ? "履歴なし" : "历史未记录")}</strong></span><span>{locale === "ja" ? "実行者" : "执行人"}<strong>{collaborationExecutorNames(task).join("、") || "—"}</strong></span><span>{locale === "ja" ? "開始" : "开始"}<strong>{formatCollaborationTime(task.startedAt, locale)}</strong></span><span>{locale === "ja" ? "完了" : "完成"}<strong>{formatCollaborationTime(task.completedAt, locale)}</strong></span><span>{locale === "ja" ? "所要時間" : "总耗时"}<strong>{formatCollaborationDuration(task.startedAt, task.completedAt, locale)}</strong></span></section>
    <CollaborationTaskProgressView task={task} member={member} liveOutput={liveOutput} automation={automation} locale={locale} />
  </section>;
}

function CollaborationMemberPage({ member, tasks, streams, locale, linghuAutomation, nangongEvolution, nangongAttachments, workspaces, onLinghuState, onNangongState, onNangongAttachments, onNangongScreenshot, onNangongPaste, onError, onRename, onDelete, onContinue, onCancel, onOpen }: {
  member: CollaborationMember | null;
  tasks: CollaborationState["tasks"];
  streams: Record<string, CollaborationLiveOutput>;
  locale: Locale;
  linghuAutomation: LinghuAutomationState | null;
  nangongEvolution: NangongEvolutionState | null;
  nangongAttachments: ComposerAttachment[];
  workspaces: WorkspaceState | null;
  onLinghuState(state: LinghuAutomationState): void;
  onNangongState(state: NangongEvolutionState): void;
  onNangongAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>;
  onNangongScreenshot(hidden: boolean): void;
  onNangongPaste(files: File[]): void;
  onError(message: string): void;
  onRename(member: CollaborationMember): void;
  onDelete(member: CollaborationMember): void;
  onContinue(taskId: string): void;
  onCancel(taskId: string): void;
  onOpen(taskId: string): void;
}) {
  if (!member) return <section className="collaboration-member-page"><p>{locale === "ja" ? "メンバーを選択してください。" : "请选择人物。"}</p></section>;
  const orderedTasks = [...tasks].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const currentTask = orderedTasks.find((task) => !["integrated", "cancelled"].includes(task.state)) || orderedTasks[0] || null;
  const liveOutput = currentTask ? streams[currentTask.taskId] : null;
  const taskInitiatorName = currentTask?.initiator?.displayName || (locale === "ja" ? "履歴なし" : "历史未记录");
  return <section className="collaboration-member-page" aria-label={member.displayName}>
    <header><div><span className={`member-presence ${member.state}`} /><div><h1>{member.displayName}</h1><p>{collaborationMemberStateLabel(member, locale)}</p></div></div>{!member.protected && <nav><button type="button" onClick={() => onRename(member)}>{locale === "ja" ? "名前変更" : "重命名"}</button><button type="button" className="danger" onClick={() => onDelete(member)}>{member.state === "idle" ? (locale === "ja" ? "削除" : "删除") : (locale === "ja" ? "終了後に削除" : "完成后删除")}</button></nav>}</header>
    {member.memberId === "linghu-ancestor" && linghuAutomation && <LinghuAutomationPanel state={linghuAutomation} locale={locale} onState={onLinghuState} />}
    {member.memberId === "linghu-ancestor" && nangongEvolution && <LinghuRepairProposalPanel state={nangongEvolution} workspaces={workspaces} locale={locale} onState={onNangongState} onError={onError} />}
    {nangongEvolution && <MemberSelfUpgradePanel member={member} state={nangongEvolution} onState={onNangongState} onError={onError} />}
    {(currentTask?.blockingReason || member.blockingReason) && <div className="member-blocking-reason" role="status">{currentTask?.blockingReason || member.blockingReason}</div>}
    {currentTask ? <article className="member-current-task">
      <details key={currentTask.taskId} className="member-task-detail">
        <summary>{locale === "ja" ? `タスク詳細 · ${taskInitiatorName}` : `任务详细 · ${taskInitiatorName}`}</summary>
        <div><MarkdownMessage text={currentTask.snapshot.confirmedIntent} /></div>
      </details>
      <CollaborationTaskProgressView task={currentTask} member={member} liveOutput={liveOutput} automation={linghuAutomation} locale={locale} />
      <div className="member-task-actions"><button type="button" onClick={() => onOpen(currentTask.taskId)}>{locale === "ja" ? "詳細を見る" : "查看任务详情"}</button>{["recovering", "blocked", "test-failed"].includes(currentTask.state) && <button type="button" onClick={() => onContinue(currentTask.taskId)}>{currentTask.state === "test-failed" ? (locale === "ja" ? "再テスト" : "重新测试") : (locale === "ja" ? "続行" : "继续执行")}</button>}{!["integrated", "cancelled"].includes(currentTask.state) && <button type="button" className="danger" onClick={() => onCancel(currentTask.taskId)}>{locale === "ja" ? "キャンセル" : "取消任务"}</button>}</div>
    </article> : <div className="member-empty-task"><Code24Regular /><strong>{locale === "ja" ? "待機中" : "当前空闲"}</strong><span>{locale === "ja" ? "割り当て時に新しい Codex を作成します。" : "收到任务时才会创建新的 Codex。"}</span></div>}
    {orderedTasks.length > 1 && <section className="member-task-history"><h2>{locale === "ja" ? "過去のタスク" : "历史任务"}</h2>{orderedTasks.slice(1).map((task) => <div key={task.taskId}><strong>{task.snapshot.title}</strong><span>{collaborationTaskStateLabel(task.state, locale)}</span></div>)}</section>}
  </section>;
}

/** 南宫婉沿用韩立主会话的消息区和输入区，只替换人物文案与专项演化发送链路。 */
function NangongConversationWorkspace({ state, attachments, workspaces, locale, newConversationBusy, error, onState, onAttachments, onScreenshot, onPaste, onError }: { state: NangongEvolutionState; attachments: ComposerAttachment[]; workspaces: WorkspaceState | null; locale: Locale; newConversationBusy: boolean; error: string; onState(state: NangongEvolutionState): void; onAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>; onScreenshot(hidden: boolean): void; onPaste(files: File[]): void; onError(message: string): void }) {
  const [chatText, setChatText] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [resumeBusy, setResumeBusy] = useState(false);
  const [topicDraftOpen, setTopicDraftOpen] = useState(false);
  const [topicDraftBusy, setTopicDraftBusy] = useState(false);
  const [topicDraftFeedback, setTopicDraftFeedback] = useState("");
  const [outgoingMessage, setOutgoingMessage] = useState<{ content: string; attachments: ComposerAttachment[]; failed: boolean } | null>(null);
  const [attachmentPreviews, setAttachmentPreviews] = useState<Record<string, ComposerAttachment[]>>({});
  const [topicDraft, setTopicDraft] = useState({ title: "", goal: "", scope: "", evidence: "", acceptanceCriteria: "" });
  const updateTopicDraft = (field: keyof typeof topicDraft, value: string) => setTopicDraft((current) => ({ ...current, [field]: value }));
  const update = async (operation: () => Promise<NangongEvolutionState> | undefined) => {
    onError("");
    try { const pending = operation(); if (!pending) return; const next = await pending; onState(next); } catch (error) { onError(readableDesktopError(error, "专项演化操作失败。")); }
  };
  const resumeOneShot = async () => {
    if (resumeBusy) return;
    setResumeBusy(true);
    try { await update(() => window.desktop?.resumeNangongOneShotEvolution()); } finally { setResumeBusy(false); }
  };
  const sendChat = async (confirmedMessage?: string) => {
    const message = confirmedMessage?.trim() || chatText.trim() || (attachments.length ? "请调查并分析这些截图中的问题。" : "");
    if (!message || !workspaces || chatBusy) return;
    const sentAttachments = [...attachments];
    // 用户点击发送后立即把文字和图片移入消息区，输入框不再承担后台等待状态。
    setChatBusy(true);
    setChatText("");
    onAttachments([]);
    setOutgoingMessage({ content: message, attachments: sentAttachments, failed: false });
    onError("");
    try {
      const next = await window.desktop?.sendNangongConversationMessage({ message, attachmentIds: sentAttachments.map((item) => item.id), workspaceState: workspaces, locale });
      if (!next) throw new Error("南宫婉会话服务未返回结果。");
      const persisted = [...next.conversation.messages].reverse().find((item) => item.role === "user" && item.content === message);
      if (persisted && sentAttachments.length) setAttachmentPreviews((current) => ({ ...current, [persisted.messageId]: sentAttachments }));
      onState(next);
      setOutgoingMessage(null);
    } catch (error) {
      setOutgoingMessage((current) => current ? { ...current, failed: true } : null);
      onError(readableDesktopError(error, "发送给南宫婉失败。"));
    } finally { setChatBusy(false); }
  };
  const convertChat = async () => {
    if (!workspaces || !state.conversation.messages.length) return;
    const title = topicDraft.title.trim();
    const goal = topicDraft.goal.trim();
    const scope = splitEvolutionList(topicDraft.scope);
    const evidence = splitEvolutionList(topicDraft.evidence);
    const acceptanceCriteria = splitEvolutionList(topicDraft.acceptanceCriteria);
    if (!title || !goal || !scope.length || !evidence.length || !acceptanceCriteria.length) return onError("标题、目标、影响范围、事实证据和验收条件必须完整填写。");
    await update(() => window.desktop?.convertNangongConversationToTopic({ confirmedByUser: true, title, goal, scope, evidence, acceptanceCriteria, workspaceState: workspaces, locale }));
    setTopicDraftOpen(false);
    setTopicDraftFeedback("");
    setTopicDraft({ title: "", goal: "", scope: "", evidence: "", acceptanceCriteria: "" });
  };
  const generateTopicDraft = async () => {
    if (!workspaces || !state.conversation.messages.length || topicDraftBusy) return;
    setTopicDraftFeedback("");
    setTopicDraftBusy(true);
    try {
      // 生成结果只作为当前可编辑表单的初值，用户点击保存前不会冻结对话或创建课题。
      const draft = await window.desktop?.generateNangongTopicDraft({ workspaceState: workspaces, locale });
      if (draft) {
        setTopicDraft({ title: draft.title, goal: draft.goal, scope: draft.scope.join("，"), evidence: draft.evidence.join("，"), acceptanceCriteria: draft.acceptanceCriteria.join("，") });
        setTopicDraftFeedback("已根据当前对话填充草稿");
      }
    } catch (error) { onError(readableDesktopError(error, "课题草稿生成失败。")); } finally { setTopicDraftBusy(false); }
  };
  const outgoingPersistedMessageId = outgoingMessage
    ? [...state.conversation.messages].reverse().find((item) => item.role === "user" && item.content === outgoingMessage.content)?.messageId
    : null;
  return <SelUiConversation id="selConversationNangongWanId" onSubmit={() => void sendChat()} timeline={<section className="selconversation-timeline nangong-person-chat" aria-label="与南宫婉讨论演化课题">
      <EvolutionLiveActivity run={state.oneShotRun} onResume={() => void resumeOneShot()} resumeBusy={resumeBusy} />
      {state.oneShotConfirmation?.status === "awaiting-user-confirmation" && state.oneShotRun?.status !== "running" && <section className="nangong-one-shot-confirmation" role="status" aria-label="本轮演化等待确认">
        <strong>本轮已具备启动条件</strong>
        <span>回复 1 将整理为演化课题，并连续进入审批、分发、测试和验收。</span>
        <button type="button" className="selform-action" disabled={chatBusy || !workspaces} onClick={() => void sendChat("1")}>回复 1 并启动本轮完整流程</button>
      </section>}
      {state.conversation.messages.length === 0 && <div className="dev-empty"><div className="dev-orb"><Code24Regular /></div><h1>和南宫婉讨论演化方向</h1><p>先说现状、问题和不能改变的约束，调查成熟后再形成课题。</p></div>}
      {state.conversation.messages.filter((message) => message.messageId !== outgoingPersistedMessageId).map((message) => <article key={message.messageId} className="selconversation-message" data-role={message.role}><header>{message.role === "user" ? "我" : "南宫婉"}</header><div className="selconversation-message-body">{attachmentPreviews[message.messageId]?.length ? <div className="selconversation-message-attachments">{attachmentPreviews[message.messageId].map((attachment) => <img key={attachment.id} src={attachment.dataUrl} alt={attachment.name} />)}</div> : message.attachmentIds?.length ? <small>已附 {message.attachmentIds.length} 张调查截图</small> : null}<MarkdownMessage text={message.content} />{message.role === "user" && message.inferredIntent && <aside className="nangong-intent-summary"><strong>我了解到您的想法是</strong><span>{message.inferredIntent}</span><small>如果我理解有偏差，您可以直接纠正我。</small></aside>}</div></article>)}
      {outgoingMessage && <article className="selconversation-message" data-role="user"><header>我 · {outgoingMessage.failed ? "发送失败" : "发送中"}</header><div className="selconversation-message-body">{outgoingMessage.attachments.length > 0 && <div className="selconversation-message-attachments">{outgoingMessage.attachments.map((attachment) => <img key={attachment.id} src={attachment.dataUrl} alt={attachment.name} />)}</div>}<MarkdownMessage text={outgoingMessage.content} /></div></article>}
    </section>} composer={<form className="selconversation-composer nangong-person-composer" onSubmit={(event) => { event.preventDefault(); void sendChat(); }}>
      {topicDraftOpen && <section className="selform-root" aria-label="整理演化课题">
        <header className="selform-header"><strong>整理为演化课题</strong><button type="button" className="selform-action" disabled={topicDraftBusy} onClick={() => setTopicDraftOpen(false)}>取消</button></header>
        {topicDraftBusy && <p role="status">南宫婉正在根据当前对话整理课题草稿…</p>}
        {!topicDraftBusy && topicDraftFeedback && <p role="status" className="selform-feedback">{topicDraftFeedback}</p>}
        <button type="button" className="selform-action" disabled={topicDraftBusy} onClick={() => void generateTopicDraft()}>根据当前对话生成草稿</button>
        <label className="selform-field">课题标题<input aria-label="课题标题" value={topicDraft.title} onChange={(event) => updateTopicDraft("title", event.currentTarget.value)} /></label>
        <label className="selform-field">课题目标<textarea aria-label="课题目标" value={topicDraft.goal} onChange={(event) => updateTopicDraft("goal", event.currentTarget.value)} /></label>
        <label className="selform-field">影响范围<input aria-label="课题影响范围" placeholder="多项用逗号分隔" value={topicDraft.scope} onChange={(event) => updateTopicDraft("scope", event.currentTarget.value)} /></label>
        <label className="selform-field">事实证据<input aria-label="课题事实证据" placeholder="多项用逗号分隔" value={topicDraft.evidence} onChange={(event) => updateTopicDraft("evidence", event.currentTarget.value)} /></label>
        <label className="selform-field">验收条件<input aria-label="课题验收条件" placeholder="多项用逗号分隔" value={topicDraft.acceptanceCriteria} onChange={(event) => updateTopicDraft("acceptanceCriteria", event.currentTarget.value)} /></label>
        <button type="button" className="selform-action" data-tone="primary" disabled={topicDraftBusy} onClick={() => void convertChat()}>确认保存课题</button>
      </section>}
      {attachments.length > 0 && <div className="selconversation-attachments">{attachments.map((attachment) => <figure key={attachment.id}><img src={attachment.dataUrl} alt={attachment.name} /><figcaption>调查截图</figcaption><button type="button" aria-label="移除截图" onClick={() => onAttachments((current) => current.filter((item) => item.id !== attachment.id))}><Dismiss20Regular /></button></figure>)}</div>}
      {newConversationBusy && <div className="nangong-conversation-refresh-status" role="status">正在关闭当前南宫婉线程并建立新对话…</div>}
      {error && <div className="composer-error" role="alert"><span>{error}</span></div>}
      <textarea className="selconversation-input" data-sel-conversation-input aria-label="给南宫婉发送消息" placeholder="描述演化问题、现状和不可改变的约束…（可粘贴截图）" value={chatText} onChange={(event) => setChatText(event.currentTarget.value)} onPaste={(event) => { const files = Array.from(event.clipboardData.items).filter((item) => item.kind === "file" && item.type.startsWith("image/")).map((item) => item.getAsFile()).filter((file): file is File => file !== null); if (files.length) { event.preventDefault(); onPaste(files); } }} />
      <div className="selconversation-footer"><div className="selconversation-tools"><button type="button" className="screenshot-button" aria-label="截取当前屏幕" data-sel-tooltip="截取当前屏幕" data-sel-tooltip-mode="always" onClick={() => onScreenshot(false)}><Screenshot24Regular /></button><button type="button" className="screenshot-button" aria-label="隐藏窗口后截图" data-sel-tooltip="隐藏窗口后截图" data-sel-tooltip-mode="always" onClick={() => onScreenshot(true)}><EyeOff24Regular /></button><button type="button" className="selconversation-action" data-tone="neutral" disabled={!state.conversation.messages.length || newConversationBusy} onClick={() => setTopicDraftOpen(true)}>整理为演化课题</button></div><div className="selconversation-actions"><button type="submit" className="selconversation-action" disabled={newConversationBusy || (!chatText.trim() && !attachments.length) || chatBusy} aria-label={chatBusy ? "调查中" : "发送给南宫婉"}><Send24Filled /></button></div></div>
    </form>} />;
}

/** 人物工作栏把逗号分隔输入统一转换成去重的业务清单，提交给主进程后仍由合同做最终校验。 */
function splitEvolutionList(value: string): string[] {
  return [...new Set(value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean))];
}


/** 当前任务只展开真实卡点，报告、证据和评分留在所属流程环节内。 */
function CollaborationTaskProgressView({ task, member, liveOutput, automation, locale }: {
  task: CollaborationTask;
  member: CollaborationMember;
  liveOutput: CollaborationLiveOutput | null;
  automation: LinghuAutomationState | null;
  locale: Locale;
}) {
  const progress = useMemo(() => deriveCollaborationTaskProgress(task, member, automation, locale), [task, member, automation, locale]);
  const [openStages, setOpenStages] = useState<Set<CollaborationProgressStageId>>(() => new Set([progress.currentStageId]));
  const currentStageRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    setOpenStages(new Set([progress.currentStageId]));
    window.requestAnimationFrame(() => currentStageRef.current?.scrollIntoView({ block: "nearest" }));
  }, [task.taskId, progress.currentStageId]);

  const toggleStage = (stageId: CollaborationProgressStageId, open: boolean) => {
    setOpenStages((current) => {
      const next = new Set(current);
      if (open) next.add(stageId); else next.delete(stageId);
      return next;
    });
  };

  return <>
    <section className="task-progress-card" aria-label={locale === "ja" ? "現在の進捗" : "当前进度"}>
      <div className="task-progress-primary"><span>{progress.currentOwner}</span><strong>{progress.currentAction}</strong></div>
      <div className="task-progress-facts">
        <span>{locale === "ja" ? "現在の手順" : "当前步骤"}<strong>{locale === "ja" ? `${progress.currentStep}/${progress.totalSteps}` : `第 ${progress.currentStep}/${progress.totalSteps} 步`}</strong></span>
        <span>{locale === "ja" ? "更新" : "最近更新"}<strong>{formatCollaborationTime(progress.updatedAt, locale)}</strong></span>
        <span>{locale === "ja" ? "次の担当" : "下一步去向"}<strong>{progress.nextOwner} · {progress.nextAction}</strong></span>
      </div>
    </section>
    <div className="task-progress-stages">
      {progress.stages.map((stage) => <details
        key={stage.id}
        ref={stage.id === progress.currentStageId ? currentStageRef : undefined}
        className={`task-progress-stage ${stage.status}`}
        open={openStages.has(stage.id)}
        onToggle={(event) => toggleStage(stage.id, event.currentTarget.open)}
      >
        <summary><span><strong>{stage.label}</strong><b>{stage.owner}</b></span><small>{stage.statusLabel}</small></summary>
        <div className="task-progress-stage-content">
          {stage.waitingFor && stage.status !== "current" && <p className="task-stage-waiting">{stage.waitingFor}</p>}
          <CollaborationStageContent stageId={stage.id} task={task} liveMessage={stage.id === liveOutput?.stageId ? liveOutput.message : null} automation={automation} locale={locale} />
        </div>
      </details>)}
    </div>
  </>;
}

function CollaborationStageContent({ stageId, task, liveMessage, automation, locale }: {
  stageId: CollaborationProgressStageId;
  task: CollaborationTask;
  liveMessage: Message | null;
  automation: LinghuAutomationState | null;
  locale: Locale;
}) {
  const relevantEvents = task.flowEvents.filter((event) => stageId === "repair"
    ? event.stage === "recovery" || event.error
    : stageId === "unified-test"
      ? /test|测试|restart|重启|verif/i.test(`${event.type} ${event.summary}`)
      : false);
  return <>
    {stageId === "intent" && <>
      <MarkdownMessage text={task.snapshot.confirmedIntent} />
      {task.plans.map((plan) => <article key={plan.version} className="task-stage-record"><header><strong>{plan.ownerDisplayName}</strong><span>v{plan.version} · {collaborationPlanStatusLabel(plan.status, locale)}</span></header><MarkdownMessage text={plan.text} /></article>)}
    </>}
    {stageId === "execution" && <>
      {task.executionRecords.length === 0 && <p className="task-stage-empty">{locale === "ja" ? "実行記録はまだありません。" : "暂时没有执行记录。"}</p>}
      {task.executionRecords.map((record) => <article key={record.assignmentId} className="task-stage-record"><header><strong>{record.executor.displayName}</strong><span>{collaborationExecutionStatusLabel(record.status, locale)}</span></header>{record.changedFiles?.length ? <ChangedFileList files={record.changedFiles} locale={locale} /> : null}{record.result && <MarkdownMessage text={record.result} />}{record.blockingReason && <p className="task-detail-error">{record.blockingReason}</p>}</article>)}
    </>}
    {stageId === "repair" && <>
      {task.blockingReason && <p className="task-detail-error">{task.blockingReason}</p>}
      {relevantEvents.length === 0 && <p className="task-stage-empty">{locale === "ja" ? "修正が必要な問題はまだ記録されていません。" : "暂未记录需要修复的问题。"}</p>}
      {relevantEvents.map((event) => <article key={event.eventId} className="task-stage-record"><header><strong>{event.actor?.displayName || (locale === "ja" ? "システム" : "系统")}</strong><span>{formatCollaborationTime(event.occurredAt, locale)}</span></header><p className={event.error ? "task-detail-error" : ""}>{event.summary}</p></article>)}
    </>}
    {stageId === "unified-test" && <>
      {automation?.activeTaskId === task.taskId && automation.currentModule === "test-coverage" && <p>{locale === "ja" ? "テスト漏れ、競合、実行性能を確認しています。" : "正在检查测试漏点、资源竞争与执行性能。"}</p>}
      {relevantEvents.length === 0 && <p className="task-stage-empty">{locale === "ja" ? "統合テスト結果はまだありません。" : "暂时没有统一测试结果。"}</p>}
      {relevantEvents.map((event) => <article key={event.eventId} className="task-stage-record"><header><strong>{event.actor?.displayName || (locale === "ja" ? "システム" : "系统")}</strong><span>{formatCollaborationTime(event.occurredAt, locale)}</span></header><p className={event.error ? "task-detail-error" : ""}>{event.summary}</p></article>)}
      {automation?.lastFeedback?.taskId === task.taskId && <article className="task-stage-record"><MarkdownMessage text={automation.lastFeedback.summary} /></article>}
    </>}
    {liveMessage && <div className="member-live-result"><MarkdownMessage text={liveMessage.text} /><StreamDetails message={liveMessage} locale={locale} /></div>}
  </>;
}

function LinghuAutomationPanel({ state, locale, onState }: { state: LinghuAutomationState; locale: Locale; onState(state: LinghuAutomationState): void }) {
  const selUi = useSelUi();
  const [editingPromptId, setEditingPromptId] = useState<string | "new" | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [error, setError] = useState("");
  const busyTask = state.activeTaskId !== null;

  const beginEdit = (prompt?: LinghuStartupPrompt) => {
    setEditingPromptId(prompt?.promptId || "new");
    setDraftTitle(prompt?.title || "");
    setDraftContent(prompt?.content || "");
    setError("");
  };

  const savePrompt = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingPromptId) return;
    try {
      const next = editingPromptId === "new"
        ? await window.desktop?.createLinghuStartupPrompt({ title: draftTitle, content: draftContent })
        : await window.desktop?.updateLinghuStartupPrompt(editingPromptId, { title: draftTitle, content: draftContent });
      if (next) onState(next);
      setEditingPromptId(null);
      setError("");
    } catch (reason) {
      setError(readableDesktopError(reason, locale === "ja" ? "起動文を保存できません。" : "无法保存启动文案。"));
    }
  };

  const apply = async (operation: Promise<LinghuAutomationState> | undefined) => {
    try {
      if (!operation) throw new Error(locale === "ja" ? "Webプレビューは読み取り専用です。デスクトップアプリで変更してください。" : "网页预览为只读，请在桌面程序中修改。" );
      const next = await operation;
      if (next) onState(next);
      setError("");
    } catch (reason) {
      setError(readableDesktopError(reason, locale === "ja" ? "自動保障設定を更新できません。" : "无法更新自动保障设置。"));
    }
  };
  const deletePrompt = async (prompt: LinghuStartupPrompt) => {
    const confirmed = await selUi.confirm({ title: locale === "ja" ? "起動文を削除" : "删除启动文案", message: locale === "ja" ? `「${prompt.title}」を削除しますか？` : `确定删除启动文案“${prompt.title}”吗？`, target: prompt.title, tone: "danger" });
    if (confirmed) await apply(window.desktop?.deleteLinghuStartupPrompt(prompt.promptId));
  };

  return <section className="linghu-automation" aria-label={locale === "ja" ? "自動運行の最終保障" : "自动运行最后保障"}>
    <header>
      <div><ShieldCheckmark24Regular /><div><h2>{locale === "ja" ? "自動運行の最終保障" : "自动运行最后保障"}</h2><p>{locale === "ja" ? "有効中は30秒ごとの検査を停止しません。" : "开启后每30秒持续检测，永远不会自行停止。"}</p></div></div>
      <button type="button" className="selswitch linghu-automation-toggle" role="switch" aria-checked={state.enabled} onClick={() => void apply(window.desktop?.setLinghuAutomationEnabled(!state.enabled))}><span className="selswitch-track" aria-hidden="true"><i className="selswitch-thumb" /></span>{state.enabled ? (locale === "ja" ? "自動実行中" : "自动执行中") : (locale === "ja" ? "自動実行を開始" : "开启自动执行")}</button>
    </header>
    <div className="linghu-automation-facts">
      <span>{locale === "ja" ? "サイクル" : "循环"}<strong>{state.cycle}</strong></span>
      <span>{locale === "ja" ? "現在のモジュール" : "当前模块"}<strong>{linghuModuleLabel(state.currentModule, locale)}</strong></span>
      <span>{locale === "ja" ? "実行状態" : "执行状态"}<strong>{busyTask ? (locale === "ja" ? "処理中" : "执行中") : state.enabled ? (locale === "ja" ? "次回検査待ち" : "等待下一次检测") : (locale === "ja" ? "停止" : "未开启")}</strong></span>
      <span>{locale === "ja" ? "最終検査" : "最后检测"}<strong>{formatCollaborationTime(state.lastCheckedAt, locale)}</strong></span>
    </div>
    {state.blockingReason && <p className="linghu-automation-notice" role="status">{state.blockingReason}</p>}
    {state.lastFeedback && <details className="linghu-last-feedback"><summary>{locale === "ja" ? "前回のフィードバック" : "上一模块反馈"}</summary><div><strong>{linghuModuleLabel(state.lastFeedback.module, locale)}</strong><p>{state.lastFeedback.summary}</p></div></details>}
    <div className="linghu-prompt-heading"><div><h3>{locale === "ja" ? "起動文一覧" : "启动文案列表"}</h3><p>{locale === "ja" ? "追加・編集・削除・有効化ができます。" : "可新增、修改、删除、启停并选择当前文案。"}</p></div><button type="button" onClick={() => beginEdit()}><Add24Regular />{locale === "ja" ? "追加" : "新增启动文案"}</button></div>
    {editingPromptId && <form className="linghu-prompt-form" onSubmit={(event) => void savePrompt(event)}>
      <label>{locale === "ja" ? "名称" : "文案名称"}<input value={draftTitle} maxLength={80} onChange={(event) => setDraftTitle(event.target.value)} autoFocus /></label>
      <label>{locale === "ja" ? "内容" : "启动内容"}<textarea value={draftContent} maxLength={20_000} rows={12} onChange={(event) => setDraftContent(event.target.value)} /></label>
      <div><button type="button" onClick={() => setEditingPromptId(null)}>{locale === "ja" ? "キャンセル" : "取消"}</button><button type="submit" className="primary">{locale === "ja" ? "保存" : "保存文案"}</button></div>
    </form>}
    <div className="linghu-prompt-list">{state.prompts.length === 0 ? <p className="linghu-prompt-empty">{locale === "ja" ? "起動文がありません。検査は継続し、追加を待ちます。" : "暂无启动文案；检测仍保持运行，等待新增。"}</p> : state.prompts.map((prompt) => <article key={prompt.promptId} className={`${state.activePromptId === prompt.promptId ? "active" : ""} ${prompt.enabled ? "" : "disabled"}`}>
      <div className="linghu-prompt-summary"><div><strong>{prompt.title}</strong><span>{state.activePromptId === prompt.promptId ? (locale === "ja" ? "現在使用中" : "当前使用") : prompt.enabled ? (locale === "ja" ? "有効" : "已启用") : (locale === "ja" ? "無効" : "已停用")}</span></div><p>{prompt.content}</p></div>
      <nav>
        {prompt.enabled && state.activePromptId !== prompt.promptId && <button type="button" onClick={() => void apply(window.desktop?.selectLinghuStartupPrompt(prompt.promptId))}>{locale === "ja" ? "使用" : "设为当前"}</button>}
        <button type="button" onClick={() => void apply(window.desktop?.updateLinghuStartupPrompt(prompt.promptId, { enabled: !prompt.enabled }))}>{prompt.enabled ? (locale === "ja" ? "無効化" : "停用") : (locale === "ja" ? "有効化" : "启用")}</button>
        <button type="button" onClick={() => beginEdit(prompt)}>{locale === "ja" ? "編集" : "修改"}</button>
        <button type="button" className="danger" onClick={() => void deletePrompt(prompt)}>{locale === "ja" ? "削除" : "删除"}</button>
      </nav>
    </article>)}</div>
    {error && <p className="task-detail-error" role="alert">{error}</p>}
  </section>;
}

function linghuModuleLabel(module: LinghuAutomationState["currentModule"], locale: Locale): string {
  const labels = {
    "flow-completion": { ja: "自動フロー完遂", "zh-CN": "自动流程完成保障" },
    "test-coverage": { ja: "テスト漏れと能力改善", "zh-CN": "测试漏点与能力升级" },
    "audit-completeness": { ja: "監査ログ完全性", "zh-CN": "日志审计完整性" },
  } as const;
  return labels[module][locale];
}

function ChangedFileList({ files, locale }: { files: string[]; locale: Locale }) {
  return <div className="collaboration-changed-files"><strong>{locale === "ja" ? "ソース変更" : "源码变化"}</strong><ul>{files.map((file) => <li key={file}>{file}</li>)}</ul></div>;
}

function collaborationMemberStateLabel(member: CollaborationMember, locale: Locale): string {
  const chinese: Record<CollaborationMember["state"], string> = { idle: "空闲", conversation: "会话中", assigned: "已分配", working: member.phase === "verifying" ? "正在验证" : member.phase === "finalizing" ? "正在收尾" : "正在执行", retiring: "正在关闭连接", recovering: "等待恢复", draining: "等待退出", offline: "离线" };
  const japanese: Record<CollaborationMember["state"], string> = { idle: "待機", conversation: "会話中", assigned: "割当済み", working: "実行中", retiring: "接続終了中", recovering: "復旧待ち", draining: "終了待ち", offline: "オフライン" };
  return (locale === "ja" ? japanese : chinese)[member.state];
}

function collaborationTaskStateLabel(state: CollaborationState["tasks"][number]["state"], locale: Locale): string {
  const chinese: Record<CollaborationState["tasks"][number]["state"], string> = { "queued-executor": "等待执行人", "preparing-worktree": "准备独立版本", analyzing: "技术分析", executing: "执行修改", "repairing-execution": "令狐修复执行问题", "returned-to-nangong": "已返回南宫婉", "ready-for-integration": "本轮已封存", "queued-integration": "已进入测试批次", integrating: "正在集成", "unified-testing": "令狐老祖正在统一测试", "awaiting-restart": "等待重启确认", "test-failed": "统一测试失败", integrated: "统一测试通过", blocked: "已阻塞", recovering: "等待恢复", cancelled: "已取消" };
  const japanese: Record<CollaborationState["tasks"][number]["state"], string> = { "queued-executor": "実行者待ち", "preparing-worktree": "独立版を準備", analyzing: "技術分析", executing: "変更実行中", "repairing-execution": "令狐が実行問題を修復中", "returned-to-nangong": "南宮婉へ返却済み", "ready-for-integration": "ラウンド確定済み", "queued-integration": "テストキュー", integrating: "統合中", "unified-testing": "令狐が統合テスト中", "awaiting-restart": "再起動確認待ち", "test-failed": "統合テスト失敗", integrated: "統合テスト合格", blocked: "ブロック", recovering: "復旧待ち", cancelled: "キャンセル" };
  return (locale === "ja" ? japanese : chinese)[state];
}

function collaborationExecutorNames(task: CollaborationTask): string[] {
  return [...new Map(task.executionRecords.map((record) => [record.executor.memberId, record.executor.displayName])).values()];
}

function collaborationPlanStatusLabel(status: CollaborationTask["plans"][number]["status"], locale: Locale): string {
  const chinese = { "ready-for-execution": "技术分析完成" } as const;
  const japanese = { "ready-for-execution": "技術分析完了" } as const;
  return (locale === "ja" ? japanese : chinese)[status];
}

function collaborationExecutionStatusLabel(status: CollaborationTask["executionRecords"][number]["status"], locale: Locale): string {
  const chinese = { assigned: "已分配", analyzing: "分析中", executing: "执行中", "code-verified": "代码已验证", transferred: "已转交", blocked: "已阻塞", cancelled: "已取消" } as const;
  const japanese = { assigned: "割当済み", analyzing: "分析中", executing: "実行中", "code-verified": "コード検証済み", transferred: "引継ぎ済み", blocked: "ブロック", cancelled: "キャンセル" } as const;
  return (locale === "ja" ? japanese : chinese)[status];
}

function formatCollaborationTime(value: string | null, locale: Locale): string {
  if (!value) return locale === "ja" ? "進行中" : "进行中";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(parsed);
}

function formatCollaborationDuration(startedAt: string, completedAt: string | null, locale: Locale): string {
  if (!completedAt) return locale === "ja" ? "進行中" : "进行中";
  const durationMs = Math.max(0, Date.parse(completedAt) - Date.parse(startedAt));
  if (!Number.isFinite(durationMs)) return "—";
  const totalSeconds = Math.floor(durationMs / 1_000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const units = locale === "ja" ? [days && `${days}日`, hours && `${hours}時間`, minutes && `${minutes}分`, `${seconds}秒`] : [days && `${days}天`, hours && `${hours}小时`, minutes && `${minutes}分钟`, `${seconds}秒`];
  return units.filter(Boolean).join(" ");
}

function auditStatusText(status: AuditTaskSummary["status"], locale: Locale): string {
  const chinese = { running: "运行中", completed: "已完成", partial: "部分完成", failed: "失败", interrupted: "已中断" } as const;
  const japanese = { running: "実行中", completed: "完了", partial: "一部完了", failed: "失敗", interrupted: "中断" } as const;
  return (locale === "ja" ? japanese : chinese)[status];
}

function nextRenderedFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function imageFileToPngDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("剪贴板内容不是图片。");
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法读取剪贴板图片。");
    context.drawImage(bitmap, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    bitmap.close();
  }
}

function managedModeLabel(mode: ManagedExecutionMode, locale: Locale): string {
  const labelsByMode: Record<ManagedExecutionMode, { ja: string; "zh-CN": string }> = {
    "conversation-managed": { ja: "会話管理", "zh-CN": "会话托管" },
    "requirement-managed": { ja: "要件管理", "zh-CN": "需求托管" },
    "task-managed": { ja: "タスク管理", "zh-CN": "任务托管" },
    "test-managed": { ja: "テスト管理", "zh-CN": "测试托管" },
  };
  return labelsByMode[mode][locale];
}

function reasoningEffortLabel(effort: ReasoningEffort, locale: Locale): string {
  const chinese: Record<ReasoningEffort, string> = { none: "无", minimal: "最小", low: "低", medium: "中", high: "高", xhigh: "超高", max: "最大" };
  const japanese: Record<ReasoningEffort, string> = { none: "なし", minimal: "最小", low: "低", medium: "中", high: "高", xhigh: "最高", max: "最大" };
  return locale === "ja" ? japanese[effort] : chinese[effort];
}

function CodexUserInputPanel({
  request,
  answers,
  customAnswerIds,
  confirmedQuestionIds,
  locale,
  submitting,
  onChoose,
  onChooseCustom,
  onCustomChange,
  onConfirm,
}: {
  request: CodexUserInputRequest;
  answers: Record<string, string>;
  customAnswerIds: Set<string>;
  confirmedQuestionIds: Set<string>;
  locale: Locale;
  submitting: boolean;
  onChoose(questionId: string, value: string): void;
  onChooseCustom(questionId: string): void;
  onCustomChange(questionId: string, value: string): void;
  onConfirm(questionId: string): void;
}) {
  const otherLabel = locale === "ja" ? "その他" : "其他";
  return <section className="codex-user-input" aria-label={locale === "ja" ? "確認事項" : "待确认问题"}>
    {request.questions.map((question) => {
      const confirmed = confirmedQuestionIds.has(question.id);
      const hasAnswer = Boolean(answers[question.id]?.trim());
      return <fieldset key={question.id} className={confirmed ? "confirmed" : ""}>
      <legend><strong>{question.header}</strong><span>{question.question}</span></legend>
      {question.options.length > 0 && <div className="codex-user-input-options">{question.options.map((option) => <button type="button" role="radio" disabled={confirmed} aria-checked={!customAnswerIds.has(question.id) && answers[question.id] === option.label} className={!customAnswerIds.has(question.id) && answers[question.id] === option.label ? "selected" : ""} key={option.label} onClick={() => onChoose(question.id, option.label)}><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</button>)}<button type="button" role="radio" disabled={confirmed} aria-checked={customAnswerIds.has(question.id)} className={customAnswerIds.has(question.id) ? "selected" : ""} onClick={() => onChooseCustom(question.id)}><strong>{otherLabel}</strong></button></div>}
      {customAnswerIds.has(question.id) && <input value={answers[question.id] || ""} disabled={confirmed} maxLength={2_000} autoFocus={request.questions.length === 1} placeholder={locale === "ja" ? "回答を入力" : "请输入答案"} onChange={(event) => onCustomChange(question.id, event.target.value)} />}
      <div className="codex-user-input-actions"><button type="button" className="primary" disabled={!hasAnswer || confirmed || submitting} onClick={() => onConfirm(question.id)}>{confirmed ? (locale === "ja" ? "確認済み" : "已确认") : submitting ? (locale === "ja" ? "送信中…" : "正在确认…") : (locale === "ja" ? "確認" : "确认")}</button></div>
    </fieldset>})}
  </section>;
}

function ManagedStageAction({ message, locale, actionable, activeMode, onReturn, onAdvance }: { message: Message; locale: Locale; actionable: boolean; activeMode: ManagedExecutionMode; onReturn(mode: ManagedExecutionMode): void; onAdvance(mode: ManagedExecutionMode, label: string): void }) {
  if (message.collaborationTaskId) return null;
  const current = message.managedMode;
  if (!current) return null;
  const firstLabels: Record<ManagedExecutionMode, { ja: string; "zh-CN": string }> = {
    "conversation-managed": { ja: "この意図で合っています", "zh-CN": "就是这意思" },
    "requirement-managed": { ja: "この案で実行", "zh-CN": "按这个方案执行" },
    "task-managed": { ja: "テストする", "zh-CN": "测试一下" },
    "test-managed": { ja: "再テスト", "zh-CN": "重新测试" },
  };
  const repeatLabels: Record<ManagedExecutionMode, { ja: string; "zh-CN": string }> = {
    "conversation-managed": { ja: "要件を再分析", "zh-CN": "重新分析需求" },
    "requirement-managed": { ja: "再実行", "zh-CN": "重新执行" },
    "task-managed": { ja: "再テスト", "zh-CN": "重新测试" },
    "test-managed": { ja: "再テスト", "zh-CN": "重新测试" },
  };
  const returnLabels: Record<"conversation-managed" | "task-managed", { ja: string; "zh-CN": string }> = {
    "conversation-managed": { ja: "会話管理に戻る", "zh-CN": "回到会话托管" },
    "task-managed": { ja: "タスク管理に戻る", "zh-CN": "回到任务托管" },
  };
  const returnTargets: Array<"conversation-managed" | "task-managed"> = current === "requirement-managed"
    ? ["conversation-managed"]
    : current === "task-managed" || current === "test-managed"
      ? ["conversation-managed", "task-managed"]
      : [];
  const target = current === "test-managed" ? null : nextManagedMode(current);
  const label = (message.actionTriggered ? repeatLabels : firstLabels)[current][locale];
  const Icon = message.actionTriggered ? ArrowClockwise24Regular : target === "requirement-managed" ? CheckmarkCircle24Regular : target === "task-managed" ? Play24Regular : Beaker24Regular;
  return <div className="managed-stage-action">
    {returnTargets.map((returnTarget) => <button type="button" className="stage-return" aria-pressed={activeMode === returnTarget} disabled={!actionable || message.streaming || activeMode === returnTarget} key={returnTarget} onClick={() => onReturn(returnTarget)}><ArrowReply24Regular /><span>{returnLabels[returnTarget][locale]}</span></button>)}
    {target && <button type="button" className={`stage-advance ${message.actionTriggered ? "triggered" : ""}`} disabled={!actionable || message.streaming} onClick={() => onAdvance(target, label)}><Icon /><span>{label}</span></button>}
  </div>;
}

function CollaborationStatusChain({ task, locale, onRetry }: { task: CollaborationTask; locale: Locale; onRetry(taskId: string): Promise<void> }) {
  const stages = ["analysis", "execution", "recovery", "integration"] as const;
  const stageLabels = locale === "ja"
    ? { analysis: "技術分析", execution: "実行", recovery: "修復", integration: "統合テスト" }
    : { analysis: "技术分析", execution: "执行", recovery: "令狐修复", integration: "统一测试" };
  const latestByStage = new Map(stages.map((stage) => [stage, [...task.flowEvents].reverse().find((event) => event.stage === stage)]));
  const handler = task.currentHandler?.displayName || task.originalExecutor?.displayName || task.initiator?.displayName || (locale === "ja" ? "システム" : "系统");
  const retryLabel = task.state === "test-failed" ? (locale === "ja" ? "再テスト" : "重新测试") : (locale === "ja" ? "続行" : "继续执行");
  const retryable = ["test-failed", "blocked", "recovering"].includes(task.state);
  return <section className={`collaboration-status-chain ${task.blockingReason ? "has-blocker" : ""}`} aria-live="polite">
    <header><strong>{locale === "ja" ? "協同タスク" : "协作任务状态"}</strong><span>{handler} · {collaborationTaskStateLabel(task.state, locale)}</span></header>
    <ol>{stages.map((stage) => { const event = latestByStage.get(stage); if (!event && stage !== "analysis") return null; return <li key={stage} className={event?.error ? "failed" : event?.status === "completed" ? "completed" : "active"}><i /><span><strong>{stageLabels[stage]}</strong><small>{event?.summary || (locale === "ja" ? "担当者待ち" : "等待分配负责人")}</small></span></li>; })}</ol>
    {task.blockingReason && <p role="status"><strong>{locale === "ja" ? "停止理由" : "当前卡点"}</strong>{task.blockingReason}</p>}
    <details className="collaboration-status-task-details"><summary>{locale === "ja" ? `タスク詳細 · ${task.initiator?.displayName || "システム"}` : `任务详细 · ${task.initiator?.displayName || "系统"}`}</summary><div><MarkdownMessage text={task.snapshot.confirmedIntent} /></div></details>
    <footer><span>{locale === "ja" ? "現在の担当" : "当前负责人"}：<strong>{handler}</strong></span>{retryable && <button type="button" onClick={() => void onRetry(task.taskId)}><ArrowClockwise24Regular />{retryLabel}</button>}</footer>
  </section>;
}

function StreamDetails({ message, locale }: { message: Message; locale: Locale }) {
  const plan = message.plan || [];
  const activities = message.activities || [];
  const changedFiles = message.changedFiles || [];
  if (!message.streaming && !message.streamError && plan.length === 0 && activities.length === 0 && changedFiles.length === 0) return null;
  return <div className="stream-details">
    {message.reasoningSummary && <p className="stream-reasoning">{message.reasoningSummary}</p>}
    {message.managedExecution && <div className={`managed-execution-status ${message.managedExecution.status}`}><strong>{managedModeLabel(message.managedExecution.mode, locale)}</strong><span>{message.managedExecution.message}</span><small>{message.managedExecution.round}/{message.managedExecution.maximumRounds}</small></div>}
    {plan.length > 0 && <ol className="stream-plan">{plan.map((entry, index) => <li className={entry.status} key={`${index}:${entry.step}`}><i />{entry.step}</li>)}</ol>}
    {activities.length > 0 && <details className="stream-activity-details">
      <summary><span>{locale === "ja" ? "実行プロセス" : "执行过程"}</span><small>{activities.length} {locale === "ja" ? "件" : "项"} · {activityLabel(activities.at(-1)?.itemType || "", locale)}</small></summary>
      <div className="stream-activities">{activities.map((activity) => <div className={activity.phase} key={activity.id}><i /><span><strong>{activityLabel(activity.itemType, locale)}</strong>{activity.summary && <small>{activity.summary}</small>}</span></div>)}</div>
    </details>}
    {changedFiles.length > 0 && <details className="stream-files" open><summary>{locale === "ja" ? `変更ファイル ${changedFiles.length}` : `已涉及 ${changedFiles.length} 个文件`}</summary>{changedFiles.map((file) => <code key={file}>{file}</code>)}</details>}
    {!message.collaborationTaskId && (message.streaming || message.streamTerminal || message.streamError || message.managedExecution) && <div className={`stream-current ${message.streamError || message.streamStatus === "failed" ? "failed" : message.streaming ? "running" : "completed"}`}><i /><span>{message.streamError || (message.streaming ? streamStatusLabel(message.streamStatus, locale) : completedStatusLabel(message, locale))}</span></div>}
  </div>;
}

function activityLabel(itemType: string, locale: Locale): string {
  const japanese: Record<string, string> = { reasoning: "分析中", commandExecution: "コマンド実行", commandPolicy: "実行ポリシー", fileChange: "ファイル変更", mcpToolCall: "ツール呼び出し", dynamicToolCall: "ツール実行", collabToolCall: "エージェント連携", webSearch: "Web 検索", imageView: "画像確認", contextCompaction: "会話整理", agentMessage: "回答作成" };
  const chinese: Record<string, string> = { reasoning: "正在分析", commandExecution: "执行命令", commandPolicy: "执行策略", fileChange: "修改文件", mcpToolCall: "调用工具", dynamicToolCall: "执行工具", collabToolCall: "协作处理", webSearch: "搜索网页", imageView: "查看图片", contextCompaction: "整理会话", agentMessage: "生成回答" };
  return (locale === "ja" ? japanese : chinese)[itemType] || itemType;
}

function streamStatusLabel(status: string | undefined, locale: Locale): string {
  if (locale === "ja") {
    const labelsByStatus: Record<string, string> = { starting: "Codex を開始しています…", inProgress: "Codex が処理中…", planning: "計画を更新しています…", reasoning: "分析中…", responding: "回答を生成しています…", commandExecution: "コマンドを実行しています…", fileChange: "ファイルを変更しています…" };
    return labelsByStatus[status || ""] || "Codex が処理中…";
  }
  const labelsByStatus: Record<string, string> = { starting: "正在启动 Codex…", inProgress: "Codex 正在处理…", planning: "正在更新计划…", reasoning: "正在分析…", responding: "正在生成回答…", commandExecution: "正在执行命令…", fileChange: "正在修改文件…" };
  return labelsByStatus[status || ""] || "Codex 正在处理…";
}

function completedStatusLabel(message: Message, locale: Locale): string {
  if (message.streamStatus === "interrupted") return locale === "ja" ? "中断しました" : "已中断";
  if (message.streamStatus === "failed") return locale === "ja" ? "失敗しました" : "执行失败";
  const mode = message.managedExecution?.mode || message.managedMode;
  if (locale === "ja") {
    if (mode === "conversation-managed") return "意図の分析が完了しました";
    if (mode === "requirement-managed") return "要件分析が完了しました";
    if (mode === "task-managed") return "実行とコード検証が完了しました";
    if (mode === "test-managed") return "テストが完了しました";
    return "完了しました";
  }
  if (mode === "conversation-managed") return "意图分析完成";
  if (mode === "requirement-managed") return "需求分析完成";
  if (mode === "task-managed") return "执行与代码验证完成";
  if (mode === "test-managed") return "测试完成";
  return "已完成";
}
