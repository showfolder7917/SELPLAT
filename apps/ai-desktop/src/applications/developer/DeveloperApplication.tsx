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
  AutomaticTestPreflightResultOutDto,
  AiMemoryDatabaseStatusOutDto,
  CodexAccountOutDto,
  CodexApprovalOutDto,
  CodexHarnessStatusOutDto,
  CodexModelCatalogOutDto,
  CorpusSemanticBackfillStatusOutDto,
  CodexStreamActivityOutDto,
  CodexStreamEventOutDto,
  CodexUserInputRequestOutDto,
  CollaborationMemberOutDto,
  CollaborationStateOutDto,
  CollaborationStateEventOutDto,
  CollaborationStreamEventOutDto,
  CollaborationTaskOutDto,
  CollaborationTimelineSnapshotOutDto,
  ConversationDispatchStateOutDto,
  ConversationQueueItemOutDto,
  DesktopSettingsOutDto,
  LocaleValue,
  LinghuAutomationStateEventOutDto,
  LinghuAutomationStateOutDto,
  ManagedExecutionModeValue,
  EvolutionStateOutDto,
  EvolutionStateEventOutDto,
  HanliConversationOutDto,
  ModelServiceTierValue,
  ReasoningEffortValue,
  SandboxModeValue,
  TempDirectoryInfoOutDto,
  TrustedCommandInfoOutDto,
  AuditLogInfoOutDto,
  AuditTaskSummaryOutDto,
  ApprovalGovernanceRecordOutDto,
  WorkspaceEntryOutDto,
  WorkspacePermissionValue,
  WorkspaceStateOutDto,
} from "../../../contracts/system/desktop/index";
import { applyCodexStreamEvent, clearStoredChat, createAssistantMessage, createUserMessage, managedModeForCommand, readStoredChat, writeStoredChat, type ComposerAttachment, type Message } from "../../features/conversation/model/chat-message";
import { SelUiConversation } from "../../features/conversation/components/SelUiConversation";
import { MarkdownMessage } from "../../features/conversation/components/MarkdownMessage";
import { CodexUserInputPanel } from "../../features/conversation/components/CodexUserInputPanel";
import { ManagedStageAction } from "../../features/conversation/components/ManagedStageAction";
import { managedModeLabel, StreamDetails } from "../../features/conversation/components/StreamDetails";
import { CollaborationStatusChain } from "../../features/conversation/components/CollaborationStatusChain";
import { deriveCollaborationTaskCurrentStage } from "../../features/collaboration/model/collaboration-task-progress";
import type { CollaborationLiveOutput } from "../../features/collaboration/model/collaboration-live-output";
import { collaborationExecutionStatusLabel, collaborationExecutorNames, collaborationMemberStateLabel, collaborationPlanStatusLabel, collaborationTaskStateLabel, formatCollaborationDuration, formatCollaborationTime } from "../../features/collaboration/model/collaboration-formatters";
import { CollaborationTaskProgressView } from "../../features/collaboration/components/CollaborationTaskProgressView";
import { CollaborationExecutionList } from "../../features/collaboration/components/CollaborationExecutionList";
import { CollaborationTaskDetail } from "../../features/collaboration/components/CollaborationTaskDetail";
import { CollaborationMemberPage } from "../../features/collaboration/components/CollaborationMemberPage";
import { TaskCollaborationGroup } from "../../features/collaboration/components/TaskCollaborationGroup";
import { defaultEvolutionWorkspaceLocation, evolutionMutationRequest } from "../../features/evolution/model/evolution-workbench";
import { SettingsFloatingPanel } from "../../features/settings/components/SettingsFloatingPanel";
import { ChatGPTLoginAction } from "../../features/shell/components/DesktopChrome";
import { DeveloperShell, DeveloperTitleBar } from "./layout/DeveloperShell";
import { DeveloperActivityBar } from "./layout/DeveloperActivityBar";
import { DeveloperStatusBar } from "./layout/DeveloperStatusBar";
import { DeveloperExplorer } from "./layout/DeveloperExplorer";
import { DeveloperWorkspace } from "./layout/DeveloperWorkspace";
import { RuleManagementFeature } from "../../features/rules/components/RuleManagementFeature";
import { NangongConversationWorkspace } from "../../features/nangong/components/NangongConversationWorkspace";
import { HanliConversationWorkspace } from "../../features/hanli/components/HanliConversationWorkspace";
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
import "../styles/desktop-applications.css";

type SelGridController = { destroy: () => boolean; setLocale?: (payload: Record<string, unknown>) => boolean };
type SelGridApi = {
  create: (host: HTMLElement, definition: Record<string, unknown>) => HTMLElement | null;
  mount: (root: HTMLElement, payload: Record<string, unknown>) => SelGridController | null;
};

type SelTooltipController = { destroy: () => boolean };
type SelTooltipApi = {
  attach: (host: Element, options: Record<string, unknown>) => SelTooltipController | null;
};

const labels = {
  ja: { title: "Developer", placeholder: "コード、調査、変更内容を入力（画像を貼り付け可能）", ready: "Codex harness 接続済み", signIn: "ChatGPT でログイン", signOut: "ログアウト", signedOut: "ChatGPT にログインしてください", browserOpened: "ブラウザーでログインを完了してください", files: "EXPLORER", workspaces: "WORKSPACES", addWorkspace: "ワークスペースを追加", primary: "メイン", makePrimary: "メインに設定", remove: "削除", removeConfirm: "ワークスペース一覧から「{name}」を削除しますか？ディスク上のフォルダーは削除されません。", minimumWorkspace: "ワークスペースを1つ以上残してください", tasks: "TASKS", newTask: "新しいタスク", newCodexSession: "Codex セッションを新しく作り直す", expand: "展開", collapse: "折りたたむ", settings: "接続と実行設定", account: "ChatGPT アカウント", readOnly: "読み取り専用", write: "ワークスペース書き込み", readOnlyTip: "現在は読み取り専用", writeTip: "現在は書き込み可能", thinking: "Codex が処理中...", approve: "許可", approveAndTrust: "許可して信頼", trustHint: "同じプロジェクトとコマンドは次回から自動的に許可されます。", decline: "拒否", screenshot: "現在の画面をキャプチャ", hiddenScreenshot: "AI Desktop を隠してキャプチャ", screenPermissionRequired: "システム設定で AI Desktop の画面収録を許可し、アプリを再起動してください。", screenSourceUnavailable: "画面ソースを読み取れません。画面収録の権限を確認してから再試行してください。", openScreenRecordingSettings: "システム設定を開く", tempFiles: "一時ファイル", openTemp: "一時フォルダーを開く", clearTemp: "すべて消去", clearConfirm: "AI Desktop の一時ファイルをすべて削除しますか？", trustedCommands: "信頼済みコマンド", clearTrustedCommands: "信頼をすべて解除", clearTrustedConfirm: "登録済みの信頼コマンドをすべて解除しますか？", auditLogs: "業務ログ", openAuditLogs: "ログフォルダーを開く", noAuditTask: "タスク履歴はまだありません", conversationManaged: "会話管理", requirementManaged: "要件管理", taskManaged: "タスク管理", testManaged: "テスト管理", attachment: "画像添付", automaticTest: "自動テスト", automaticTestChecking: "自動テスト環境を確認中…", automaticTestReady: "自動テスト環境の準備ができました", automaticTestBlocked: "自動テストを開始できません", automaticTestTriggered: "自動テスト", close: "閉じる" },
  "zh-CN": { title: "Developer", placeholder: "输入代码、调查或修改任务（可粘贴截图）", ready: "Codex harness 已连接", signIn: "使用 ChatGPT 登录", signOut: "退出登录", signedOut: "请先登录 ChatGPT", browserOpened: "请在浏览器中完成登录", files: "资源管理器", workspaces: "工作区", addWorkspace: "添加工作区", primary: "主目录", makePrimary: "设为主目录", remove: "移除", removeConfirm: "确定从工作区列表移除“{name}”吗？不会删除磁盘中的真实目录。", minimumWorkspace: "至少保留一个工作区", tasks: "任务", newTask: "新建任务", newCodexSession: "重新建立一个 Codex 会话", expand: "展开", collapse: "折叠", settings: "连接与执行设置", account: "ChatGPT 账号", readOnly: "只读", write: "工作区写入", readOnlyTip: "当前只读", writeTip: "当前可写入", thinking: "Codex 正在处理...", approve: "允许", approveAndTrust: "允许并信任", trustHint: "相同项目和命令下次将自动允许。", decline: "拒绝", screenshot: "截取当前屏幕", hiddenScreenshot: "隐藏 AI Desktop 后截图", screenPermissionRequired: "请在系统设置中允许 AI Desktop 使用屏幕录制权限，然后重新启动应用。", screenSourceUnavailable: "无法读取屏幕来源，请检查屏幕录制权限后重试。", openScreenRecordingSettings: "打开系统设置", tempFiles: "临时文件", openTemp: "临时目录", clearTemp: "一键清理", clearConfirm: "确定清理 AI Desktop temp 中的全部临时文件吗？", trustedCommands: "可信命令", clearTrustedCommands: "清除全部信任", clearTrustedConfirm: "确定清除全部项目可信命令吗？", auditLogs: "业务日志", openAuditLogs: "打开日志目录", noAuditTask: "暂无任务记录", conversationManaged: "会话托管", requirementManaged: "需求托管", taskManaged: "任务托管", testManaged: "测试托管", attachment: "图片附件", automaticTest: "自动测试", automaticTestChecking: "正在检查自动测试环境…", automaticTestReady: "自动测试环境已就绪", automaticTestBlocked: "自动测试开启失败", automaticTestTriggered: "自动测试", close: "知道了" },
} as const;

const EMPTY_ACCOUNT: CodexAccountOutDto = { authenticated: false, authMode: null, email: null, planType: null, requiresOpenaiAuth: true };
const EMPTY_STATUS: CodexHarnessStatusOutDto = { connected: false, account: EMPTY_ACCOUNT, error: null, runtime: null };
const DEFAULT_EXPLORER_WIDTH = 260;
const MINIMUM_EXPLORER_WIDTH = 200;
const MAXIMUM_EXPLORER_WIDTH = 520;
const EMPTY_DISPATCH_STATE: ConversationDispatchStateOutDto = { activeTask: null, queue: [] };
type ActiveExplorerSection = "workspace" | "tasks";

const testDataResetCopy = {
  ja: {
    title: "テストデータ",
    summary: "データベース内のテストトピック、タスク、承認、イベント、実行状態",
    detail: "人物の会話、学習メモリ、ログイン、設定、ワークスペース、ルール、ソースコードは保持されます。完了後にアプリを再起動します。",
    action: "テストデータを一括消去",
    busy: "消去中…",
    confirm: "AI Desktop 内部のテスト実行データを消去しますか？この操作は元に戻せません。人物の会話、学習メモリ、ログイン、設定、ワークスペース、信頼済みコマンド、ルール、ソースコード、監査ファイルは削除されません。",
  },
  "zh-CN": {
    title: "测试数据",
    summary: "数据库中的测试专题、任务、审批、事件和运行状态",
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

export function DeveloperApplication() {
  const selUi = useSelUi();
  const shellRef = useRef<HTMLDivElement>(null);
  const [locale, setLocale] = useState<LocaleValue>("zh-CN");
  const [sandboxMode, setSandboxMode] = useState<SandboxModeValue>("workspace-write");
  const [defaultModel, setDefaultModel] = useState<string | null>(null);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffortValue | null>(null);
  const [serviceTier, setServiceTier] = useState<ModelServiceTierValue>("default");
  const [codexAppCorpusIngestionEnabled, setCodexAppCorpusIngestionEnabled] = useState(false);
  const [corpusSemanticBackfill, setCorpusSemanticBackfill] = useState<CorpusSemanticBackfillStatusOutDto | null>(null);
  const [modelCatalog, setModelCatalog] = useState<CodexModelCatalogOutDto>({ models: [] });
  const [modelCatalogLoading, setModelCatalogLoading] = useState(false);
  const [modelSettingsError, setModelSettingsError] = useState("");
  const [evolutionWorkspaceOpenError, setEvolutionWorkspaceOpenError] = useState("");
  const [executionMode, setExecutionMode] = useState<ManagedExecutionModeValue>("conversation-managed");
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [chatHydrated, setChatHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [nangongAttachments, setNangongAttachments] = useState<ComposerAttachment[]>([]);
  const [hanliAttachments, setHanliAttachments] = useState<ComposerAttachment[]>([]);
  const screenshotDestinationRef = useRef<"main" | "nangong" | "hanli">("main");
  const [screenshotBusy, setScreenshotBusy] = useState(false);
  const [screenshotMode, setScreenshotMode] = useState<"current" | "hidden" | null>(null);
  const [screenshotError, setScreenshotError] = useState("");
  const [screenRecordingSettingsAvailable, setScreenRecordingSettingsAvailable] = useState(false);
  const [screenRecordingRestartRequired, setScreenRecordingRestartRequired] = useState(false);
  const [screenRecordingRestarting, setScreenRecordingRestarting] = useState(false);
  const [tempInfo, setTempInfo] = useState<TempDirectoryInfoOutDto | null>(null);
  const [auditInfo, setAuditInfo] = useState<AuditLogInfoOutDto | null>(null);
  const [aiMemoryDatabaseStatus, setAiMemoryDatabaseStatus] = useState<AiMemoryDatabaseStatusOutDto | null>(null);
  const [collaborationState, setCollaborationState] = useState<CollaborationStateOutDto | null>(null);
  const [collaborationTimeline, setCollaborationTimeline] = useState<CollaborationTimelineSnapshotOutDto | null>(null);
  const [linghuAutomationState, setLinghuAutomationState] = useState<LinghuAutomationStateOutDto | null>(null);
  const [evolutionState, setEvolutionState] = useState<EvolutionStateOutDto | null>(null);
  const [hanliConversation, setHanliConversation] = useState<HanliConversationOutDto>({ conversationId: null, messages: [], updatedAt: new Date(0).toISOString() });
  const [collaborationStreams, setCollaborationStreams] = useState<Record<string, CollaborationLiveOutput>>({});
  const [collaborationTimelineStreams, setCollaborationTimelineStreams] = useState<Record<string, CollaborationLiveOutput>>({});
  const [collaborationPanel, setCollaborationPanel] = useState<"member" | "execution-list" | "task-group" | "task-detail">("member");
  const [selectedCollaborationTaskId, setSelectedCollaborationTaskId] = useState<string | null>(null);
  const [trustedCommandInfo, setTrustedCommandInfo] = useState<TrustedCommandInfoOutDto>({ count: 0 });
  const [testDataResetting, setTestDataResetting] = useState(false);
  const [testDataResetError, setTestDataResetError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dispatchState, setDispatchState] = useState<ConversationDispatchStateOutDto>(EMPTY_DISPATCH_STATE);
  const [dispatchError, setDispatchError] = useState("");
  const [nangongNewConversationBusy, setNangongNewConversationBusy] = useState(false);
  const [nangongError, setNangongError] = useState("");
  const [hanliNewConversationBusy, setHanliNewConversationBusy] = useState(false);
  const [hanliError, setHanliError] = useState("");
  const [automaticTestEnabled, setAutomaticTestEnabled] = useState(false);
  const [automaticTestChecking, setAutomaticTestChecking] = useState(false);
  const [automaticTestDialog, setAutomaticTestDialog] = useState<AutomaticTestPreflightResultOutDto | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 资源管理器控制整栏宽度；工作区和任务使用单一活动分区，确保切换后当前内容置顶并独占可用高度。
  const [explorerExpanded, setExplorerExpanded] = useState(true);
  const [activeExplorerSection, setActiveExplorerSection] = useState<ActiveExplorerSection | null>("workspace");
  const [explorerWidth, setExplorerWidth] = useState(DEFAULT_EXPLORER_WIDTH);
  const [projectRoot, setProjectRoot] = useState("C:\\opt\\workspace\\SELPLAT");
  const [workspaces, setWorkspaces] = useState<WorkspaceStateOutDto | null>(null);
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set());
  const [workspaceEntries, setWorkspaceEntries] = useState<Record<string, WorkspaceEntryOutDto[]>>({});
  const [workspaceError, setWorkspaceError] = useState("");
  const [codexStatus, setCodexStatus] = useState<CodexHarnessStatusOutDto>(EMPTY_STATUS);
  const [approval, setApproval] = useState<CodexApprovalOutDto | null>(null);
  const [userInputRequest, setUserInputRequest] = useState<CodexUserInputRequestOutDto | null>(null);
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
  const activeManagedModeRef = useRef<ManagedExecutionModeValue>("conversation-managed");
  const flushStreamEventsRef = useRef<() => void>(() => undefined);
  const screenCapturePreparedRef = useRef(false);
  const screenRecordingSettingsOpenedRef = useRef(false);
  const screenRecordingRecheckBusyRef = useRef(false);
  const automaticTestEnabledRef = useRef(false);
  const collaborationStateRef = useRef<CollaborationStateOutDto | null>(null);
  const linghuAutomationStateRef = useRef<LinghuAutomationStateOutDto | null>(null);
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
    void desktop.getEvolutionState().then(setEvolutionState);
    void desktop.getHanliConversation().then(setHanliConversation).catch((error) => setHanliError(readableDesktopError(error, "无法读取韩立会话。")));
    const removeStateListener = desktop.onCollaborationState((event: CollaborationStateEventOutDto) => { collaborationStateRef.current = event.state; setCollaborationState(event.state); });
    const removeTimelineListener = desktop.onCollaborationTimelineChanged(() => refreshTimeline());
    const removeLinghuListener = desktop.onLinghuAutomationState((event: LinghuAutomationStateEventOutDto) => { linghuAutomationStateRef.current = event.state; setLinghuAutomationState(event.state); });
    const removeNangongListener = desktop.onEvolutionState((event: EvolutionStateEventOutDto) => { setEvolutionState(event.state); });
    const removeStreamListener = desktop.onCollaborationStream((envelope: CollaborationStreamEventOutDto) => {
      // 流式正文以回合开始时的真实状态归档，不会随之后的任务转交迁移到错误环节。
      const updateStream = (current: Record<string, CollaborationLiveOutput>, key: string, preserveNodeHistory = false) => {
        const existing = current[key];
        const task = collaborationStateRef.current?.tasks.find((candidate) => candidate.taskId === envelope.taskId);
        const next = preserveNodeHistory && existing
          ? existing
          : existing?.turnId === envelope.event.turnId
          ? existing
          : {
            message: createAssistantMessage(Date.now(), "task-managed"),
            stageId: task ? deriveCollaborationTaskCurrentStage(task, linghuAutomationStateRef.current) : "intent",
            turnId: envelope.event.turnId,
          };
        return { ...current, [key]: { ...next, message: applyCodexStreamEvent(next.message, envelope.event) } };
      };
      setCollaborationStreams((current) => updateStream(current, envelope.taskId));
      if (envelope.timelineNodeId) setCollaborationTimelineStreams((current) => updateStream(current, envelope.timelineNodeId!, true));
    });
    return () => { removeStateListener(); removeTimelineListener(); removeLinghuListener(); removeNangongListener(); removeStreamListener(); };
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
      const setDestinationAttachments = screenshotDestinationRef.current === "nangong" ? setNangongAttachments : screenshotDestinationRef.current === "hanli" ? setHanliAttachments : setAttachments;
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
    const queued: Array<{ messageId: number; event: CodexStreamEventOutDto }> = [];
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
    const routeMessageId = (event: CodexStreamEventOutDto) => {
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

  const applySettings = (settings: DesktopSettingsOutDto) => {
    setLocale(settings.locale);
    setSandboxMode(settings.sandboxMode);
    setDefaultModel(settings.defaultModel);
    setReasoningEffort(settings.reasoningEffort);
    setServiceTier(settings.serviceTier);
    setCodexAppCorpusIngestionEnabled(settings.codexAppCorpusIngestionEnabled);
  };

  /** 所有模型选择都写入同一主进程设置，渲染层不建立会话级副本或覆盖入口。 */
  const updateSettings = (patch: Partial<DesktopSettingsOutDto>) => {
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

  const applyWorkspaceState = (state: WorkspaceStateOutDto) => {
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

  const updateWorkspacePermission = async (id: string, permission: WorkspacePermissionValue) => {
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
    override?: { message: string; displayText: string; mode: ManagedExecutionModeValue; sourceMessageId?: number },
    queued?: ConversationQueueItemOutDto,
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
    const userMessage = createUserMessage(userId, displayText || text.attachment, sentAttachments);
    activeTurnIdRef.current = null;
    completedTurnIdsRef.current = new Set();
    turnMessageIdsRef.current = new Map();
    activeManagedModeRef.current = mode;
    activeAssistantIdRef.current = assistantId;
    // 发送后立即创建回复卡，随后只使用官方 app-server 实时事件更新内容和执行阶段。
    setMessages((current) => [...current, userMessage, createAssistantMessage(assistantId, mode, userMessage.messageId)]);
    setInput("");
    setAttachments([]);
    setLoading(true);
    try {
      const response = window.desktop
        ? await window.desktop.sendMessage({ message, locale, sandboxMode, attachmentIds, executionMode: mode, queueItemId: queued?.id })
        : { text: locale === "ja" ? "デスクトップ版でローカル Codex に接続します。" : "桌面版本会在这里返回本地 Codex 的结果。", itemCount: 0 };
      if (response.disposition === "queued") {
        setMessages((current) => current.map((item) => item.id === userId
          ? { ...item, status: "completed" }
          : item.id === assistantId
            ? { ...item, status: "queued", text: "消息已进入等待队列。", streaming: false, streamTerminal: true, streamStatus: "queued" }
            : item));
        return;
      }
      if (response.threadId) setActiveThreadId(response.threadId);
      flushStreamEventsRef.current();
      const completedAssistantId = activeAssistantIdRef.current || assistantId;
      setMessages((current) => current.map((item) => item.id === userId
        ? { ...item, status: "completed" }
        : item.id === completedAssistantId
          ? { ...item, status: "completed", text: item.text || response.text, streaming: false, streamTerminal: true, streamStatus: "completed" }
          : item));
      if (automaticTestEnabledRef.current
        && mode === "task-managed"
        && "managedStatus" in response
        && response.managedStatus === "code-verified") {
        // 代码级验证完成后只排入一条固定结果验证消息，交给现有串行队列在当前回合收尾后执行。
        void enqueueAutomaticTest(completedAssistantId);
      }
    } catch (error) {
      const messageText = readableDesktopError(error, "Codex unavailable");
      const failedAssistantId = activeAssistantIdRef.current || assistantId;
      setMessages((current) => current.map((item) => item.id === userId
        ? { ...item, status: "failed" }
        : item.id === failedAssistantId
          ? { ...item, status: "failed", text: item.text || messageText, streaming: false, streamTerminal: true, streamStatus: "failed", streamError: messageText }
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
      setEvolutionState(state);
      setNangongAttachments([]);
    } catch (error) {
      // 南宫婉必须在自己的页面看到线程删除失败，不能把错误留在只属于韩立的输入区。
      setNangongError(readableDesktopError(error, "无法重新建立南宫婉对话。"));
    } finally {
      setNangongNewConversationBusy(false);
    }
  };

  const startNewHanliConversation = async () => {
    if (hanliNewConversationBusy) return;
    setHanliNewConversationBusy(true); setHanliError("");
    try {
      const conversation = await window.desktop?.newHanliConversation();
      if (!conversation) throw new Error("韩立新建对话服务没有返回结果。");
      setHanliConversation(conversation); setHanliAttachments([]);
    } catch (error) { setHanliError(readableDesktopError(error, "无法重新建立韩立对话。")); }
    finally { setHanliNewConversationBusy(false); }
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

  const renameCollaborationMember = async (member: CollaborationMemberOutDto) => {
    const displayName = (await selUi.prompt({ title: locale === "ja" ? "メンバー名を変更" : "修改人物名称", label: locale === "ja" ? "新しいメンバー名" : "新的人物名称", defaultValue: member.displayName }))?.trim();
    if (!displayName || displayName === member.displayName) return;
    const state = await window.desktop?.updateCollaborationMember(member.memberId, { displayName });
    if (state) setCollaborationState(state);
  };

  const deleteCollaborationMember = async (member: CollaborationMemberOutDto) => {
    if (member.protected || !await selUi.confirm({ title: locale === "ja" ? "メンバーを削除" : "删除人物", message: locale === "ja" ? `${member.displayName}を削除しますか？` : `确定删除“${member.displayName}”吗？`, target: member.displayName, tone: "danger" })) return;
    const state = await window.desktop?.deleteCollaborationMember(member.memberId);
    if (state) setCollaborationState(state);
  };

  const manuallyApproveTimelineProposal = async (proposalId: string, title: string, content: string) => {
    if (!evolutionState) return;
    const result = await selUi.approval({ title, subtitle: `专题任务 · 等待韩立审批`, content });
    if (!result) return;
    setDispatchError("");
    try {
      // 审批写动作继续复用演化协调器；主进程 EventCenter 会记录成功或 catch 异常并供令狐老祖消费。
      const next = await window.desktop?.decideEvolutionProposal(proposalId, {
        mutation: evolutionMutationRequest(evolutionState),
        decision: result.decision,
        advice: result.reason,
        feedbackTarget: "proposal-content",
      });
      if (next) setEvolutionState(next);
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
      constraints: ["协同执行停在代码级验证，不自动进入构建与应用验证"],
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

  const startScreenshot = async (hideOwnerWindow = false, destination: "main" | "nangong" | "hanli" = "main") => {
    if (screenshotBusy) return;
    const destinationAttachments = destination === "nangong" ? nangongAttachments : destination === "hanli" ? hanliAttachments : attachments;
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

  const pasteClipboardImages = async (files: File[], destination: "main" | "nangong" | "hanli" = "main") => {
    if (screenshotBusy || files.length === 0) return;
    const destinationAttachments = destination === "nangong" ? nangongAttachments : destination === "hanli" ? hanliAttachments : attachments;
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
      (destination === "nangong" ? setNangongAttachments : destination === "hanli" ? setHanliAttachments : setAttachments)((current) => [...current, ...savedAttachments]);
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
  const terminalCollaborationStates = new Set<CollaborationTaskOutDto["state"]>(["integrated", "cancelled"]);
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
  const showMainConversationWorkspace = !collaborationMode;
  const showHanLiConversationWorkspace = Boolean(collaborationMode && collaborationPanel === "member" && selectedCollaborationMember?.memberId === "han-li");
  const showNangongConversationWorkspace = Boolean(collaborationMode && collaborationPanel === "member" && selectedCollaborationMember?.memberId === "nangong-wan" && evolutionState);
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

  return <DeveloperShell shellRef={shellRef} explorerExpanded={explorerExpanded} locale={locale} style={shellStyle}>
    <DeveloperTitleBar projectRoot={projectRoot} title={text.title} />

    <DeveloperActivityBar explorerExpanded={explorerExpanded} filesLabel={text.files} expandLabel={text.expand} collapseLabel={text.collapse} onToggleExplorer={() => setExplorerExpanded((value) => !value)} settingsControl={<SettingsFloatingPanel locale={locale} open={settingsOpen} onOpenChange={setSettingsOpen}>
        <div className="dev-account"><span>{text.account}</span><strong>{codexStatus.account.email || codexStatus.account.planType || text.signedOut}</strong><small>{codexStatus.runtime ? `${codexStatus.runtime.source === "downloaded" ? "校验下载" : "安装包内置"} Codex ${codexStatus.runtime.version}` : codexStatus.connected ? "openai/codex app-server" : codexStatus.error || "Harness offline"}</small>{codexStatus.account.authenticated ? <button type="button" onClick={() => void logout()}><span>{text.signOut}</span></button> : <ChatGPTLoginAction label={text.signIn} onLogin={() => void login()} />}{loginHint && <em>{loginHint}</em>}</div>
        {/* 测试数据清空是重启级危险操作，固定放在账号卡片后，避免被常规设置与长列表挤出首屏。 */}
        <div className="temp-card test-data-reset-card"><span>{testDataResetCopy[locale].title}</span><strong>{testDataResetCopy[locale].summary}</strong><small>{testDataResetCopy[locale].detail}</small>{testDataResetError && <em role="alert">{testDataResetError}</em>}<div><button className="danger" disabled={testDataResetting} onClick={() => void clearTestData()}><Delete24Regular />{testDataResetting ? testDataResetCopy[locale].busy : testDataResetCopy[locale].action}</button></div></div>
        <section className="model-settings-card" aria-labelledby="global-model-settings-title">
          <header><div><span id="global-model-settings-title">{locale === "ja" ? "グローバルモデル設定" : "全局模型配置"}</span><small>{locale === "ja" ? "すべての会話と協同タスクに適用" : "对所有会话与协同任务生效"}</small></div><strong>{selectedModel?.displayName || (locale === "ja" ? "Codex の既定値" : "Codex 默认")}</strong></header>
          <label><span>{locale === "ja" ? "既定モデル" : "默认模型"}</span><select aria-label={locale === "ja" ? "既定モデル" : "默认模型"} value={defaultModel || ""} disabled={modelCatalogLoading} onChange={(event) => selectDefaultModel(event.target.value)}><option value="">{modelCatalogLoading ? (locale === "ja" ? "モデルを読み込み中…" : "正在读取模型…") : (locale === "ja" ? "Codex の既定値" : "Codex 默认")}</option>{defaultModel && !modelCatalog.models.some((model) => model.id === defaultModel) && <option value={defaultModel}>{defaultModel}</option>}{modelCatalog.models.map((model) => <option key={model.id} value={model.id}>{model.displayName}{model.provider ? ` · ${model.provider}` : ""}</option>)}</select></label>
          <label><span>{locale === "ja" ? "推論の強度" : "推理强度"}</span><select aria-label={locale === "ja" ? "推論の強度" : "推理强度"} value={reasoningEffort || ""} disabled={modelCatalogLoading || supportedEfforts.length === 0} onChange={(event) => updateSettings({ reasoningEffort: (event.target.value || null) as ReasoningEffortValue | null })}><option value="">{locale === "ja" ? "モデルの既定値" : "模型默认"}</option>{supportedEfforts.map((effort) => <option key={effort} value={effort}>{reasoningEffortLabel(effort, locale)}</option>)}</select></label>
          <label><span>{locale === "ja" ? "推論速度" : "推理速度"}</span><select aria-label={locale === "ja" ? "推論速度" : "推理速度"} value={serviceTier} onChange={(event) => updateSettings({ serviceTier: event.target.value as ModelServiceTierValue })}><option value="default">{locale === "ja" ? "標準" : "标准"}</option><option value="fast" disabled={!fastServiceTierSupported}>{locale === "ja" ? "高速" : "快速"}</option></select></label>
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
        <label>Language<select value={locale} onChange={(event) => updateSettings({ locale: event.target.value as LocaleValue })}><option value="zh-CN">简体中文</option><option value="ja">日本語</option></select></label>
        <label>Sandbox<select value={sandboxMode} onChange={(event) => updateSettings({ sandboxMode: event.target.value as SandboxModeValue })}><option value="read-only">{text.readOnly}</option><option value="workspace-write">{text.write}</option></select></label>
        <div className="temp-card"><span>{text.tempFiles}</span><strong>{tempInfo ? `${tempInfo.fileCount} files · ${formatBytes(tempInfo.totalBytes)}` : "..."}</strong><div><button onClick={() => void window.desktop?.openTempDirectory()}><FolderOpen24Regular />{text.openTemp}</button><button className="danger" onClick={() => void clearTempFiles()}><Delete24Regular />{text.clearTemp}</button></div></div>
        <div className="temp-card trust-card"><span>{text.trustedCommands}</span><strong>{trustedCommandInfo.count}</strong><small>{text.trustHint}</small><div><button className="danger" disabled={trustedCommandInfo.count === 0} onClick={() => void clearTrustedCommands()}><Delete24Regular />{text.clearTrustedCommands}</button></div></div>
        <div className="temp-card audit-card"><span>{text.auditLogs}</span><strong>{auditInfo?.latestTask ? `${auditStatusText(auditInfo.latestTask.status, locale)} · ${auditInfo.latestTask.reasons.length} ${locale === "ja" ? "件の理由" : "项原因"}` : text.noAuditTask}</strong>{auditInfo?.latestTask?.reasons.map((reason) => <em key={reason.code}>{reason.message}</em>)}<div><button onClick={() => void window.desktop?.openAuditLogDirectory()}><FolderOpen24Regular />{text.openAuditLogs}</button></div></div>
        <RuleManagementFeature locale={locale} />
      </SettingsFloatingPanel>} />

    <DeveloperExplorer expanded={explorerExpanded} label={text.files} expandLabel={text.expand} collapseLabel={text.collapse} activeSection={activeExplorerSection} onToggle={() => setExplorerExpanded((value) => !value)}>
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
    </DeveloperExplorer>

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

    <DeveloperWorkspace>
      <div className={`dev-tab${evolutionWorkspacePerspective ? " with-workspace-action" : ""}`}><Prompt24Regular /><span>{collaborationMode ? collaborationTabTitle : "Codex Chat"}</span>{evolutionWorkspacePerspective && <button type="button" className="open-evolution-workspace" onClick={() => { setEvolutionWorkspaceOpenError(""); void window.desktop?.openEvolutionWorkspace(defaultEvolutionWorkspaceLocation(evolutionWorkspacePerspective)).catch((error) => setEvolutionWorkspaceOpenError(readableDesktopError(error, "无法打开专题演化工作台。"))); }}>{locale === "ja" ? "専門進化ワークベンチ" : "打开专题演化工作台"}</button>}{showMainConversationWorkspace && <button type="button" className="tab-new-task" data-sel-tooltip={text.newCodexSession} data-sel-tooltip-mode="always" aria-label={text.newCodexSession} onClick={() => void startNewTask()}><ArrowClockwise24Regular /></button>}{showHanLiConversationWorkspace && <button type="button" className="tab-new-task" data-sel-tooltip="重新建立韩立对话" data-sel-tooltip-mode="always" aria-label="重新建立韩立对话" disabled={hanliNewConversationBusy} onClick={() => void startNewHanliConversation()}><ArrowClockwise24Regular className={hanliNewConversationBusy ? "screenshot-spinner" : undefined} /></button>}{showNangongConversationWorkspace && <button type="button" className="tab-new-task" data-sel-tooltip={nangongNewConversationLabel} data-sel-tooltip-mode="always" aria-label={nangongNewConversationLabel} disabled={nangongNewConversationBusy} onClick={() => void startNewNangongConversation()}><ArrowClockwise24Regular className={nangongNewConversationBusy ? "screenshot-spinner" : undefined} /></button>}<Dismiss20Regular /></div>
      {evolutionWorkspaceOpenError && <div className="evolution-window-error" role="alert">{evolutionWorkspaceOpenError} 当前数据没有被修改，请检查工作台位置参数后重试。</div>}
      {aiMemoryDatabaseStatus && aiMemoryDatabaseStatus.state !== "ready" && <div className={`ai-memory-recovery ${aiMemoryDatabaseStatus.state}`} role="alert"><strong>{locale === "ja" ? "AI Memory データベースは停止中です" : "AI Memory 数据库已停用"}</strong><span>{locale === "ja" ? "設定、移行、または整合性の問題を確認し、元のデータベースを復旧してから再起動してください。" : aiMemoryDatabaseStatus.message || "请恢复数据库后重新启动。"}</span></div>}
      {showMainConversationWorkspace ? <section ref={chatRef} className="selconversation-timeline">
        {messages.length === 0 && <div className="dev-empty"><div className="dev-orb"><Code24Regular /></div><h1>{locale === "ja" ? "何を作りますか？" : "今天要构建什么？"}</h1><p>{codexStatus.account.authenticated ? text.ready : text.signedOut}</p>{!codexStatus.account.authenticated && <ChatGPTLoginAction label={text.signIn} onLogin={() => void login()} />}{!codexStatus.account.authenticated && loginHint && <em className="dev-login-hint">{loginHint}</em>}</div>}
        {messages.map((message) => {
          const messageTask = message.collaborationTaskId
            ? collaborationState?.tasks.find((task) => task.taskId === message.collaborationTaskId) || null
            : null;
          return <article key={message.id} className="selconversation-message" data-role={message.role} data-streaming={message.streaming || undefined}><header>{message.role === "user" ? `YOU${message.status === "sending" ? " · 发送中" : message.status === "failed" ? " · 发送失败" : ""}` : "CODEX"}</header><div className="selconversation-message-body">{message.attachments?.length ? <div className="selconversation-message-attachments">{message.attachments.map((attachment) => <img key={attachment.id} src={attachment.dataUrl} alt={attachment.name} />)}</div> : null}{message.text && (message.role === "assistant" ? <MarkdownMessage text={message.text} /> : <div className="message-text">{message.text}</div>)}{message.role === "assistant" && <StreamDetails message={message} locale={locale} />}{message.role === "assistant" && messageTask && <CollaborationStatusChain task={messageTask} locale={locale} onRetry={async (taskId) => { const state = await window.desktop?.continueCollaborationTask(taskId); if (state) setCollaborationState(state); }} />}{message.role === "assistant" && message.id === activeAssistantIdRef.current && userInputRequest && <CodexUserInputPanel request={userInputRequest} answers={userInputAnswers} customAnswerIds={customAnswerIds} confirmedQuestionIds={confirmedQuestionIds} locale={locale} submitting={userInputSubmitting} onChoose={(questionId, value) => { setCustomAnswerIds((current) => { const next = new Set(current); next.delete(questionId); return next; }); setUserInputAnswers((current) => ({ ...current, [questionId]: value })); }} onChooseCustom={(questionId) => { setCustomAnswerIds((current) => new Set(current).add(questionId)); setUserInputAnswers((current) => ({ ...current, [questionId]: "" })); }} onCustomChange={(questionId, value) => setUserInputAnswers((current) => ({ ...current, [questionId]: value }))} onConfirm={(questionId) => void submitUserInput(questionId)} />}{message.role === "assistant" && !message.streamError && (message.actionTriggered || message.id === latestManagedAssistantId) && <ManagedStageAction message={message} locale={locale} actionable={message.id === latestManagedAssistantId} activeMode={executionMode} onReturn={setExecutionMode} onAdvance={(mode, label) => collaborationMode && message.managedMode === "conversation-managed" ? void submitConfirmedCollaborationTask(message).catch((error) => setDispatchError(readableDesktopError(error, "无法提交协同任务。"))) : void send({ message: "1", displayText: label, mode, sourceMessageId: message.id })} />}</div></article>;
        })}
      </section> : showHanLiConversationWorkspace
        ? <HanliConversationWorkspace key={hanliConversation.conversationId || "new-hanli-conversation"} conversation={hanliConversation} attachments={hanliAttachments} workspaces={workspaces} locale={locale} newConversationBusy={hanliNewConversationBusy} error={hanliError} onConversation={setHanliConversation} onAttachments={setHanliAttachments} onScreenshot={(hidden) => void startScreenshot(hidden, "hanli")} onPaste={(files) => void pasteClipboardImages(files, "hanli")} onError={setHanliError} />
        : showNangongConversationWorkspace && evolutionState
        ? <NangongConversationWorkspace key={evolutionState.conversation.conversationId} state={evolutionState} attachments={nangongAttachments} workspaces={workspaces} locale={locale} newConversationBusy={nangongNewConversationBusy} error={nangongError} onState={setEvolutionState} onAttachments={setNangongAttachments} onScreenshot={(hidden) => void startScreenshot(hidden, "nangong")} onPaste={(files) => void pasteClipboardImages(files, "nangong")} onError={setNangongError} />
        : collaborationPanel === "task-group"
        ? <TaskCollaborationGroup snapshot={collaborationTimeline} liveTextByNodeId={Object.fromEntries(Object.entries(collaborationTimelineStreams).map(([nodeId, output]) => [nodeId, output.message.text]))} locale={locale} onManualApproval={(proposalId, title, content) => void manuallyApproveTimelineProposal(proposalId, title, content)} onContinueTask={async (taskId) => { const state = await window.desktop?.continueCollaborationTask(taskId); if (state) setCollaborationState(state); }} />
        : collaborationPanel === "execution-list"
        ? <CollaborationExecutionList tasks={completedCollaborationTasks} locale={locale} onOpen={(taskId) => { setSelectedCollaborationTaskId(taskId); setCollaborationPanel("task-detail"); }} />
        : collaborationPanel === "task-detail" && selectedCollaborationTask && selectedCollaborationTaskMember
          ? <CollaborationTaskDetail task={selectedCollaborationTask} member={selectedCollaborationTaskMember} liveOutput={collaborationStreams[selectedCollaborationTask.taskId] || null} automation={linghuAutomationState} locale={locale} onBack={() => { setSelectedCollaborationTaskId(null); setCollaborationPanel(terminalCollaborationStates.has(selectedCollaborationTask.state) ? "execution-list" : "member"); }} />
          : <CollaborationMemberPage member={selectedCollaborationMember} tasks={selectedMemberTasks} streams={collaborationStreams} locale={locale} linghuAutomation={linghuAutomationState} nangongEvolution={evolutionState} nangongAttachments={nangongAttachments} workspaces={workspaces} onLinghuState={setLinghuAutomationState} onNangongState={setEvolutionState} onNangongAttachments={setNangongAttachments} onNangongScreenshot={(hidden) => void startScreenshot(hidden, "nangong")} onNangongPaste={(files) => void pasteClipboardImages(files, "nangong")} onError={setDispatchError} onRename={(member) => void renameCollaborationMember(member)} onDelete={(member) => void deleteCollaborationMember(member)} onContinue={(taskId) => void window.desktop?.continueCollaborationTask(taskId)} onCancel={(taskId) => void window.desktop?.cancelCollaborationTask(taskId)} onOpen={(taskId) => { setSelectedCollaborationTaskId(taskId); setCollaborationPanel("task-detail"); }} />}
      {showMainConversationWorkspace && <SelUiConversation id="selConversationHanLiId" onSubmit={() => void send()} timeline={null} composer={<form className="selconversation-composer" onSubmit={(event: FormEvent) => { event.preventDefault(); void send(); }}>
        {attachments.length > 0 && <div className="composer-attachments">{attachments.map((attachment) => <figure key={attachment.id}><img src={attachment.dataUrl} alt={attachment.name} /><figcaption>{text.attachment}</figcaption><button type="button" title={text.remove} onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}><Dismiss20Regular /></button></figure>)}</div>}
        {dispatchState.activeTask?.status === "recoverable" && <div className="dispatch-recovery" role="status"><span>发现上次未完成的任务</span><div><button type="button" onClick={() => void recoverConversationTask()}>继续执行</button><button type="button" onClick={() => void discardConversationRecovery()}>放弃任务</button></div></div>}
        {dispatchState.activeTask?.status === "running" && !loading && <div className="dispatch-background" role="status">任务正在后台执行，完成后将继续处理等待队列。</div>}
        {queuedSends.length > 0 && <div className="dispatch-queue" aria-label="等待队列">{queuedSends.map((item, index) => <div key={item.id} className="dispatch-queue-item"><span><b>{index + 1}</b>{item.displayText}</span><div>{dispatchState.activeTask?.status === "running" && <button type="button" onClick={() => void supplementQueuedMessage(item.id)}>补充到当前任务</button>}<button type="button" onClick={() => void discardQueuedMessage(item.id)}>移除</button></div></div>)}</div>}
        <textarea ref={composerRef} className="selconversation-input" data-sel-conversation-input value={input} onChange={(event) => setInput(event.target.value)} onPaste={onPaste} placeholder={text.placeholder} />
        {dispatchError && <div className="composer-error" role="alert"><span>{dispatchError}</span></div>}
        {screenshotError && <div className="composer-error" role="alert"><span>{screenshotError}</span>{(screenRecordingSettingsAvailable || screenRecordingRestartRequired) && <div className="composer-error-actions">{screenRecordingSettingsAvailable && <button type="button" onClick={() => void openScreenRecordingSettings()}>{text.openScreenRecordingSettings}</button>}{screenRecordingRestartRequired && <button type="button" className="primary" disabled={screenRecordingRestarting} onClick={() => void restartForScreenRecordingPermission()}>{locale === "ja" ? "AI Desktop を再起動" : "重启 AI Desktop"}</button>}</div>}</div>}
        <div className="selconversation-footer"><div className="composer-tools" aria-label="输入工具栏"><div className="composer-tool-group composer-context-tools"><span><ShieldCheckmark24Regular />{sandboxMode}</span><span className="execution-mode-badge">{managedModeLabel(executionMode, locale)}</span>{queuedSends.length > 0 && <span className="queued-send-count">待发送 {queuedSends.length}</span>}</div><div className="composer-tool-group composer-automation-tools"><button type="button" role="switch" aria-checked={automaticTestEnabled} className="selswitch composer-automatic-test-switch" disabled={automaticTestChecking || (loading && !automaticTestEnabled)} onClick={() => void toggleAutomaticTesting()}><span>{text.automaticTest}</span><i className="selswitch-track" aria-hidden="true"><i className="selswitch-thumb" /></i></button>{(automaticTestChecking || automaticTestEnabled) && <span className="automatic-test-status" role="status">{automaticTestChecking ? text.automaticTestChecking : text.automaticTestReady}</span>}</div><div className="composer-tool-group composer-attachment-tools"><button type="button" className="screenshot-button" aria-label={text.screenshot} data-sel-tooltip={text.screenshot} data-sel-tooltip-mode="always" disabled={screenshotBusy} onClick={() => void startScreenshot()}>{screenshotMode === "current" ? <ArrowClockwise24Regular className="screenshot-spinner" /> : <Screenshot24Regular />}</button><button type="button" className="screenshot-button" aria-label={text.hiddenScreenshot} data-sel-tooltip={text.hiddenScreenshot} data-sel-tooltip-mode="always" disabled={screenshotBusy} onClick={() => void startScreenshot(true)}>{screenshotMode === "hidden" ? <ArrowClockwise24Regular className="screenshot-spinner" /> : <EyeOff24Regular />}</button></div></div><div className="selconversation-actions">{loading && <button type="button" className="stop-action" aria-label="停止当前任务" title="停止当前任务" onClick={cancelActiveTurn}><Stop24Filled /></button>}<button type="button" className="selconversation-action" aria-label={loading ? "排队发送" : "发送"} title={loading ? "排队发送" : "发送"} onClick={() => void send()}><Send24Filled /></button></div></div>
      </form>} />}
    </DeveloperWorkspace>

    <DeveloperStatusBar sandboxMode={sandboxMode} memoryStatus={aiMemoryDatabaseStatus} locale={locale} />

    <SelUiDialog id="ai-desktop-codex-approval" open={Boolean(approval)} title={approval?.title || "Codex Approval"} kicker="CODEX APPROVAL" dismissible={false} onRequestClose={() => undefined}>
      {approval && <>{approval.reason && <p className="seldialog-copy">{approval.reason}</p>}{approval.command && <pre className="seldialog-code">{approval.command}</pre>}{approval.cwd && <small>{approval.cwd}</small>}{approval.kind === "command" && approval.trustEligible && <p className="seldialog-copy">{text.trustHint}</p>}{approval.details && <details className="seldialog-detail"><summary>Details</summary><pre className="seldialog-code">{approval.details}</pre></details>}<div className="seldialog-actions"><button onClick={() => void resolveApproval("decline")}>{text.decline}</button><button data-sel-action="primary" onClick={() => void resolveApproval("accept")}>{approval.kind === "command" && approval.trustEligible ? text.approveAndTrust : text.approve}</button></div></>}
    </SelUiDialog>

    <SelUiDialog id="ai-desktop-automatic-test" open={Boolean(automaticTestDialog)} title={text.automaticTestBlocked} kicker="AUTOMATIC TEST" dismissible size="compact" onRequestClose={() => setAutomaticTestDialog(null)}>
      {automaticTestDialog && <><ul className="seldialog-checks">{automaticTestDialog.checks.map((check) => <li className={check.status} key={check.id}><i /><span><strong>{check.label}</strong><small>{check.detail}</small></span></li>)}</ul><div className="seldialog-actions"><button data-sel-action="primary" onClick={() => setAutomaticTestDialog(null)}>{text.close}</button></div></>}
    </SelUiDialog>
  </DeveloperShell>;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function auditStatusText(status: AuditTaskSummaryOutDto["status"], locale: LocaleValue): string {
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

function reasoningEffortLabel(effort: ReasoningEffortValue, locale: LocaleValue): string {
  const chinese: Record<ReasoningEffortValue, string> = { none: "无", minimal: "最小", low: "低", medium: "中", high: "高", xhigh: "超高", max: "最大" };
  const japanese: Record<ReasoningEffortValue, string> = { none: "なし", minimal: "最小", low: "低", medium: "中", high: "高", xhigh: "最高", max: "最大" };
  return locale === "ja" ? japanese[effort] : chinese[effort];
}
