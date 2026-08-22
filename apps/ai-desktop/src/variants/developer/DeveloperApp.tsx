import { ClipboardEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Add24Regular,
  ArrowClockwise24Regular,
  Branch24Regular,
  Bug24Regular,
  ChevronDown16Regular,
  ChevronRight16Regular,
  Code24Regular,
  Delete16Regular,
  Delete24Regular,
  Dismiss20Regular,
  Document24Regular,
  EyeOff24Regular,
  Folder24Regular,
  FolderOpen24Regular,
  MoreHorizontal24Regular,
  Prompt24Regular,
  Search24Regular,
  Screenshot24Regular,
  Send24Filled,
  Settings24Regular,
  ShieldCheckmark24Regular,
  Square20Regular,
  Star16Filled,
  Star16Regular,
  Stop24Filled,
  Subtract20Regular,
  WindowDevTools24Regular,
} from "@fluentui/react-icons";

import type {
  CodexAccount,
  CodexApproval,
  CodexHarnessStatus,
  CodexStreamActivity,
  CodexStreamEvent,
  CodexStreamPlanStep,
  Locale,
  SandboxMode,
  ScreenshotAttachment,
  TempDirectoryInfo,
  WorkspaceEntry,
  WorkspacePermission,
  WorkspaceState,
} from "../../../shared/contracts/desktop";
import "./developer.css";

type ComposerAttachment = ScreenshotAttachment & { dataUrl: string };
type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  attachments?: ComposerAttachment[];
  streaming?: boolean;
  streamStatus?: string;
  streamError?: string;
  reasoningSummary?: string;
  activities?: CodexStreamActivity[];
  plan?: CodexStreamPlanStep[];
  changedFiles?: string[];
};

const labels = {
  ja: { title: "Developer", placeholder: "コード、調査、変更内容を入力（画像を貼り付け可能）", ready: "Codex harness 接続済み", signIn: "ChatGPT でログイン", signOut: "ログアウト", signedOut: "ChatGPT にログインしてください", browserOpened: "ブラウザーでログインを完了してください", files: "EXPLORER", workspaces: "WORKSPACES", addWorkspace: "ワークスペースを追加", primary: "メイン", makePrimary: "メインに設定", remove: "削除", tasks: "TASKS", newTask: "新しいタスク", settings: "接続と実行設定", account: "ChatGPT アカウント", readOnly: "読み取り専用", write: "ワークスペース書き込み", thinking: "Codex が処理中...", approve: "許可", decline: "拒否", screenshot: "現在の画面をキャプチャ", hiddenScreenshot: "AI Desktop を隠してキャプチャ", tempFiles: "一時ファイル", openTemp: "一時フォルダーを開く", clearTemp: "すべて消去", clearConfirm: "AI Desktop の一時ファイルをすべて削除しますか？", attachment: "画像添付" },
  "zh-CN": { title: "Developer", placeholder: "输入代码、调查或修改任务（可粘贴截图）", ready: "Codex harness 已连接", signIn: "使用 ChatGPT 登录", signOut: "退出登录", signedOut: "请先登录 ChatGPT", browserOpened: "请在浏览器中完成登录", files: "资源管理器", workspaces: "工作区", addWorkspace: "添加工作区", primary: "主目录", makePrimary: "设为主目录", remove: "移除", tasks: "任务", newTask: "新建任务", settings: "连接与执行设置", account: "ChatGPT 账号", readOnly: "只读", write: "工作区写入", thinking: "Codex 正在处理...", approve: "允许", decline: "拒绝", screenshot: "截取当前屏幕", hiddenScreenshot: "隐藏 AI Desktop 后截图", tempFiles: "临时文件", openTemp: "临时目录", clearTemp: "一键清理", clearConfirm: "确定清理 AI Desktop temp 中的全部临时文件吗？", attachment: "图片附件" },
} as const;

const EMPTY_ACCOUNT: CodexAccount = { authenticated: false, authMode: null, email: null, planType: null, requiresOpenaiAuth: true };
const EMPTY_STATUS: CodexHarnessStatus = { connected: false, account: EMPTY_ACCOUNT, error: null };

function WindowControls() {
  return <div className="dev-window-controls">
    <button onClick={() => window.desktop?.windowControl("minimize")}><Subtract20Regular /></button>
    <button onClick={() => window.desktop?.windowControl("maximize")}><Square20Regular /></button>
    <button className="close" onClick={() => window.desktop?.windowControl("close")}><Dismiss20Regular /></button>
  </div>;
}

export function DeveloperApp() {
  const [locale, setLocale] = useState<Locale>("zh-CN");
  const [sandboxMode, setSandboxMode] = useState<SandboxMode>("workspace-write");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [screenshotBusy, setScreenshotBusy] = useState(false);
  const [screenshotMode, setScreenshotMode] = useState<"current" | "hidden" | null>(null);
  const [screenshotError, setScreenshotError] = useState("");
  const [tempInfo, setTempInfo] = useState<TempDirectoryInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectRoot, setProjectRoot] = useState("C:\\opt\\workspace\\SELPLAT");
  const [workspaces, setWorkspaces] = useState<WorkspaceState | null>(null);
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set());
  const [workspaceEntries, setWorkspaceEntries] = useState<Record<string, WorkspaceEntry[]>>({});
  const [workspaceError, setWorkspaceError] = useState("");
  const [codexStatus, setCodexStatus] = useState<CodexHarnessStatus>(EMPTY_STATUS);
  const [approval, setApproval] = useState<CodexApproval | null>(null);
  const [loginHint, setLoginHint] = useState("");
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsPanelRef = useRef<HTMLElement>(null);
  const chatRef = useRef<HTMLElement>(null);
  const activeAssistantIdRef = useRef<number | null>(null);
  const screenCapturePreparedRef = useRef(false);
  const text = labels[locale];
  const nextId = useMemo(() => messages.reduce((maximum, item) => Math.max(maximum, item.id), 0) + 1, [messages]);

  useEffect(() => {
    window.desktop?.getEnvironment().then((environment) => setProjectRoot(environment.projectRoot));
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
    });
    const refresh = () => window.desktop?.getCodexStatus().then(setCodexStatus);
    const refreshApprovals = () => window.desktop?.getCodexApprovals().then((items) => setApproval(items[0] || null));
    void refresh();
    void refreshApprovals();
    const statusTimer = window.setInterval(refresh, 2500);
    const approvalTimer = window.setInterval(refreshApprovals, 700);
    return () => { window.clearInterval(statusTimer); window.clearInterval(approvalTimer); };
  }, []);

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;
    return desktop.onScreenshotCompleted(({ attachment, dataUrl }) => {
      // 独立截图窗口完成后把签发附件与红框调查提示一起放回输入框，但不替用户自动发送。
      setAttachments((current) => current.some((item) => item.id === attachment.id) || current.length >= 5
        ? current
        : [...current, { ...attachment, dataUrl }]);
      setInput((current) => {
        const prompt = "调查图片红色部分是什么问题";
        if (current.includes(prompt)) return current;
        const existing = current.trimEnd();
        return existing ? `${existing}\n${prompt}` : prompt;
      });
      void desktop.getTempDirectoryInfo().then(setTempInfo);
    });
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (settingsPanelRef.current?.contains(target) || settingsButtonRef.current?.contains(target)) return;
      setSettingsOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [settingsOpen]);

  useEffect(() => {
    if (settingsOpen) void window.desktop?.getTempDirectoryInfo().then(setTempInfo);
  }, [settingsOpen]);

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;
    const queued: Array<{ messageId: number; event: CodexStreamEvent }> = [];
    let animationFrame = 0;
    const flush = () => {
      animationFrame = 0;
      const events = queued.splice(0);
      setMessages((current) => events.reduce(
        (next, entry) => next.map((message) => message.id === entry.messageId ? applyCodexStreamEvent(message, entry.event) : message),
        current,
      ));
    };
    const unsubscribe = desktop.onCodexStreamEvent((event) => {
      const messageId = activeAssistantIdRef.current;
      if (messageId === null) return;
      // Harness 的高频文字 delta 按动画帧合并，既保持实时感，也避免每个 token 都触发一次完整渲染。
      queued.push({ messageId, event });
      if (!animationFrame) animationFrame = window.requestAnimationFrame(flush);
    });
    return () => {
      unsubscribe();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  useEffect(() => {
    // 新消息和处理状态出现时保持最新内容可见，长会话仍可通过聊天区滚动条回看历史。
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const updateSettings = (nextLocale: Locale, nextSandbox: SandboxMode) => {
    setLocale(nextLocale);
    setSandboxMode(nextSandbox);
    void window.desktop?.updateSettings({ locale: nextLocale, sandboxMode: nextSandbox });
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

  const removeWorkspace = async (id: string) => {
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

  const send = async () => {
    const message = input.trim();
    if ((!message && attachments.length === 0) || loading) return;
    if (!codexStatus.account.authenticated) {
      setSettingsOpen(true);
      setLoginHint(text.signedOut);
      return;
    }
    const sentAttachments = attachments;
    const assistantId = nextId + 1;
    const userMessage = { id: nextId, role: "user" as const, text: message || text.attachment, attachments: sentAttachments };
    activeAssistantIdRef.current = assistantId;
    // 发送后立即创建回复卡，随后只使用官方 app-server 实时事件更新内容和执行阶段。
    setMessages((current) => [...current, userMessage, {
      id: assistantId,
      role: "assistant",
      text: "",
      streaming: true,
      streamStatus: "starting",
      activities: [],
      plan: [],
      changedFiles: [],
    }]);
    setInput("");
    setAttachments([]);
    setLoading(true);
    try {
      const response = window.desktop
        ? await window.desktop.sendMessage({ message, locale, sandboxMode, attachmentIds: sentAttachments.map((attachment) => attachment.id) })
        : { text: locale === "ja" ? "デスクトップ版でローカル Codex に接続します。" : "桌面版本会在这里返回本地 Codex 的结果。", itemCount: 0 };
      setMessages((current) => current.map((item) => item.id === assistantId
        ? { ...item, text: response.text || item.text, streaming: false, streamStatus: "completed" }
        : item));
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Codex unavailable";
      setMessages((current) => current.map((item) => item.id === assistantId
        ? { ...item, text: item.text || messageText, streaming: false, streamStatus: "failed", streamError: messageText }
        : item));
    } finally {
      activeAssistantIdRef.current = null;
      setLoading(false);
    }
  };

  const startScreenshot = async (hideOwnerWindow = false) => {
    if (screenshotBusy || loading) return;
    if (attachments.length >= 5) {
      setScreenshotError("最多可以同时发送 5 张截图。");
      return;
    }
    setScreenshotBusy(true);
    setScreenshotMode(hideOwnerWindow ? "hidden" : "current");
    setScreenshotError("");
    setSettingsOpen(false);
    try {
      if (window.desktop) {
        // 两个入口共用同一套预热与长期桌面流；本次应用运行中的后续截图只冻结新帧，不再分别建立截图资源。
        await nextRenderedFrame();
        if (!screenCapturePreparedRef.current) {
          const startedAt = performance.now();
          await window.desktop.prepareScreenCapture();
          const remainingIndicatorTime = Math.max(0, 320 - (performance.now() - startedAt));
          if (remainingIndicatorTime > 0) await delay(remainingIndicatorTime);
          screenCapturePreparedRef.current = true;
        }
      }
      await window.desktop?.captureScreen({ hideOwnerWindow });
    } catch (error) {
      setScreenshotError(error instanceof Error ? error.message : "Unable to capture screen");
    } finally {
      setScreenshotBusy(false);
      setScreenshotMode(null);
    }
  };

  const pasteClipboardImages = async (files: File[]) => {
    if (screenshotBusy || loading || files.length === 0) return;
    if (attachments.length + files.length > 5) {
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
        const saved = await window.desktop?.saveScreenshot({ originalDataUrl: dataUrl, annotatedDataUrl: dataUrl });
        if (!saved) throw new Error("AI Desktop clipboard image service is unavailable.");
        savedAttachments.push({ ...saved, dataUrl });
      }
      setAttachments((current) => [...current, ...savedAttachments]);
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
    if (!window.confirm(text.clearConfirm)) return;
    const info = await window.desktop?.clearTempFiles();
    if (info) setTempInfo(info);
    setAttachments([]);
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
    await window.desktop?.resolveCodexApproval(approval.requestId, decision);
    setApproval(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); }
  };

  return <div className="developer-shell" lang={locale}>
    <header className="dev-titlebar">
      <div className="dev-brand"><Code24Regular /><strong>AI DESKTOP</strong><span>{text.title}</span></div>
      <div className="dev-command"><Search24Regular /><span>{projectRoot}</span></div>
      <WindowControls />
    </header>

    <aside className="dev-activitybar">
      <button className="active"><Folder24Regular /></button><button><Search24Regular /></button><button><Branch24Regular /></button><button><Bug24Regular /></button>
      <button ref={settingsButtonRef} className="activity-settings" onClick={() => setSettingsOpen((value) => !value)}><Settings24Regular /></button>
    </aside>

    <aside className="dev-explorer">
      <div className="dev-section-title"><span>{text.files}</span><MoreHorizontal24Regular /></div>
      <div className="dev-section-title workspace-title"><span>{text.workspaces}</span><button title={text.addWorkspace} aria-label={text.addWorkspace} onClick={() => void addWorkspace()}><Add24Regular /></button></div>
      <div className="workspace-list">
        {workspaces?.roots.map((root) => {
          const expanded = expandedWorkspaces.has(root.id);
          const primary = root.id === workspaces.primaryId;
          return <section className={`workspace-accordion ${expanded ? "expanded" : ""}`} key={root.id}>
            <div className="workspace-header">
              <button className="workspace-toggle" onClick={() => void toggleWorkspace(root.id)} aria-expanded={expanded} title={root.path}>
                {expanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
                <Folder24Regular />
                <strong>{root.name}</strong>
              </button>
              <div className="workspace-actions">
                <button className={primary ? "primary-root" : ""} title={primary ? text.primary : text.makePrimary} onClick={() => void setPrimaryWorkspace(root.id)}>{primary ? <Star16Filled /> : <Star16Regular />}</button>
                <button title={text.remove} disabled={workspaces.roots.length === 1} onClick={() => void removeWorkspace(root.id)}><Delete16Regular /></button>
              </div>
            </div>
            {expanded && <div className="workspace-panel">
              <div className="workspace-meta" title={root.path}><span>{root.path}</span><select aria-label={`${root.name} permission`} value={root.permission} onChange={(event) => void updateWorkspacePermission(root.id, event.target.value as WorkspacePermission)}><option value="read-only">{text.readOnly}</option><option value="workspace-write">{text.write}</option></select></div>
              <div className="workspace-tree">
                {(workspaceEntries[root.id] || []).map((entry) => <div className="dev-file indent" key={`${entry.kind}:${entry.name}`}>{entry.kind === "directory" ? <Folder24Regular /> : <Document24Regular />}{entry.name}</div>)}
              </div>
            </div>}
          </section>;
        })}
        {workspaceError && <div className="workspace-error">{workspaceError}</div>}
      </div>
      <div className="dev-section-title tasks"><span>{text.tasks}</span><Add24Regular /></div>
      <button className="new-task" onClick={() => { activeAssistantIdRef.current = null; void window.desktop?.newChat(); setMessages([]); }}><Add24Regular />{text.newTask}</button>
    </aside>

    <main className="dev-main">
      <div className="dev-tab"><Prompt24Regular /><span>Codex Chat</span><Dismiss20Regular /></div>
      <section ref={chatRef} className="dev-chat">
        {messages.length === 0 && <div className="dev-empty"><div className="dev-orb"><Code24Regular /></div><h1>{locale === "ja" ? "何を作りますか？" : "今天要构建什么？"}</h1><p>{codexStatus.account.authenticated ? text.ready : text.signedOut}</p></div>}
        {messages.map((message) => <article key={message.id} className={`dev-message ${message.role} ${message.streaming ? "streaming" : ""}`}><span>{message.role === "user" ? "YOU" : "CODEX"}</span><div>{message.attachments?.length ? <div className="message-attachments">{message.attachments.map((attachment) => <img key={attachment.id} src={attachment.dataUrl} alt={attachment.name} />)}</div> : null}{message.text && <div className="message-text">{message.text}</div>}{message.role === "assistant" && <StreamDetails message={message} locale={locale} />}</div></article>)}
      </section>
      <form className="dev-composer" onSubmit={(event: FormEvent) => { event.preventDefault(); void send(); }}>
        {attachments.length > 0 && <div className="composer-attachments">{attachments.map((attachment) => <figure key={attachment.id}><img src={attachment.dataUrl} alt={attachment.name} /><figcaption>{text.attachment}</figcaption><button type="button" title={text.remove} onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}><Dismiss20Regular /></button></figure>)}</div>}
        <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onKeyDown} onPaste={onPaste} placeholder={text.placeholder} />
        {screenshotError && <div className="composer-error">{screenshotError}</div>}
        <div className="composer-footer"><div className="composer-tools"><span><ShieldCheckmark24Regular />{sandboxMode}</span><button type="button" className="screenshot-button" title={text.screenshot} aria-label={text.screenshot} data-tooltip={text.screenshot} disabled={screenshotBusy || loading} onClick={() => void startScreenshot()}>{screenshotMode === "current" ? <ArrowClockwise24Regular className="screenshot-spinner" /> : <Screenshot24Regular />}</button><button type="button" className="screenshot-button" title={text.hiddenScreenshot} aria-label={text.hiddenScreenshot} data-tooltip={text.hiddenScreenshot} disabled={screenshotBusy || loading} onClick={() => void startScreenshot(true)}>{screenshotMode === "hidden" ? <ArrowClockwise24Regular className="screenshot-spinner" /> : <EyeOff24Regular />}</button></div><button type="button" onClick={loading ? () => { void window.desktop?.cancel(); setLoading(false); } : () => void send()}>{loading ? <Stop24Filled /> : <Send24Filled />}</button></div>
      </form>
    </main>

    <aside className="dev-context">
      <div className="context-title"><WindowDevTools24Regular /><span>CONTEXT</span></div>
      <dl><dt>PROJECT</dt><dd>{projectRoot}</dd><dt>MODE</dt><dd>{sandboxMode}</dd><dt>HARNESS</dt><dd>openai/codex app-server</dd><dt>ACCOUNT</dt><dd>{codexStatus.account.email || codexStatus.account.planType || text.signedOut}</dd></dl>
      <div className={`status-card ${codexStatus.connected ? "online" : "offline"}`}><i />{codexStatus.account.authenticated ? text.ready : text.signedOut}</div>
    </aside>

    <footer className="dev-statusbar"><span><Branch24Regular /> main*</span><span>0 errors</span><span>{sandboxMode}</span><span>UTF-8</span></footer>

    {settingsOpen && <section ref={settingsPanelRef} className="dev-settings">
      <h2>{text.settings}</h2>
      <div className="dev-account"><span>{text.account}</span><strong>{codexStatus.account.email || codexStatus.account.planType || text.signedOut}</strong><small>{codexStatus.connected ? "openai/codex app-server" : codexStatus.error || "Harness offline"}</small>{codexStatus.account.authenticated ? <button onClick={() => void logout()}>{text.signOut}</button> : <button className="primary" onClick={() => void login()}>{text.signIn}</button>}{loginHint && <em>{loginHint}</em>}</div>
      <label>Language<select value={locale} onChange={(event) => updateSettings(event.target.value as Locale, sandboxMode)}><option value="zh-CN">简体中文</option><option value="ja">日本語</option></select></label>
      <label>Sandbox<select value={sandboxMode} onChange={(event) => updateSettings(locale, event.target.value as SandboxMode)}><option value="read-only">{text.readOnly}</option><option value="workspace-write">{text.write}</option></select></label>
      <div className="temp-card"><span>{text.tempFiles}</span><strong>{tempInfo ? `${tempInfo.fileCount} files · ${formatBytes(tempInfo.totalBytes)}` : "..."}</strong><small>{tempInfo?.path}</small><div><button onClick={() => void window.desktop?.openTempDirectory()}><FolderOpen24Regular />{text.openTemp}</button><button className="danger" onClick={() => void clearTempFiles()}><Delete24Regular />{text.clearTemp}</button></div></div>
    </section>}

    {approval && <section className="dev-approval" role="dialog" aria-modal="true" aria-label={approval.title}>
      <div className="approval-card"><span className="approval-kicker">CODEX APPROVAL</span><h2>{approval.title}</h2>{approval.reason && <p>{approval.reason}</p>}{approval.command && <pre>{approval.command}</pre>}{approval.cwd && <small>{approval.cwd}</small>}{approval.details && <details><summary>Details</summary><pre>{approval.details}</pre></details>}<div className="approval-actions"><button onClick={() => void resolveApproval("decline")}>{text.decline}</button><button className="primary" onClick={() => void resolveApproval("accept")}>{text.approve}</button></div></div>
    </section>}
  </div>;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
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

function applyCodexStreamEvent(message: Message, event: CodexStreamEvent): Message {
  if (event.type === "message-delta") return { ...message, text: `${message.text}${event.delta || ""}`, streamStatus: "responding" };
  if (event.type === "message-completed") return { ...message, text: event.text ?? message.text, streamStatus: "responding" };
  if (event.type === "reasoning-summary-delta") {
    return { ...message, reasoningSummary: `${message.reasoningSummary || ""}${event.delta || ""}`, streamStatus: "reasoning" };
  }
  if (event.type === "activity" && event.activity) {
    const activities = upsertStreamActivity(message.activities || [], event.activity);
    return { ...message, activities, streamStatus: event.activity.itemType };
  }
  if (event.type === "plan-updated") return { ...message, plan: event.plan || [], streamStatus: "planning" };
  if (event.type === "diff-updated") return { ...message, changedFiles: event.changedFiles || [], streamStatus: "fileChange" };
  if (event.type === "turn-completed") {
    return { ...message, streaming: false, streamStatus: event.status || "completed", streamError: event.error };
  }
  if (event.type === "error") return { ...message, streaming: false, streamStatus: "failed", streamError: event.error };
  if (event.type === "turn-started") return { ...message, streaming: true, streamStatus: "inProgress" };
  return message;
}

function upsertStreamActivity(current: CodexStreamActivity[], incoming: CodexStreamActivity): CodexStreamActivity[] {
  const index = current.findIndex((activity) => activity.id === incoming.id);
  if (index < 0) return [...current, incoming].slice(-12);
  const next = [...current];
  const previous = next[index];
  next[index] = {
    ...previous,
    ...incoming,
    summary: incoming.summary || previous.summary,
    detail: incoming.phase === "output"
      ? `${previous.detail || ""}${incoming.detail || ""}`.slice(-2_000)
      : incoming.detail || previous.detail,
  };
  return next;
}

function StreamDetails({ message, locale }: { message: Message; locale: Locale }) {
  const plan = message.plan || [];
  const activities = message.activities || [];
  const changedFiles = message.changedFiles || [];
  if (!message.streaming && !message.streamError && plan.length === 0 && activities.length === 0 && changedFiles.length === 0) return null;
  return <div className="stream-details">
    {message.reasoningSummary && <p className="stream-reasoning">{message.reasoningSummary}</p>}
    {plan.length > 0 && <ol className="stream-plan">{plan.map((entry, index) => <li className={entry.status} key={`${index}:${entry.step}`}><i />{entry.step}</li>)}</ol>}
    {activities.length > 0 && <details className="stream-activity-details">
      <summary><span>{locale === "ja" ? "実行プロセス" : "执行过程"}</span><small>{activities.length} {locale === "ja" ? "件" : "项"} · {activityLabel(activities.at(-1)?.itemType || "", locale)}</small></summary>
      <div className="stream-activities">{activities.map((activity) => <div className={activity.phase} key={activity.id}><i /><span><strong>{activityLabel(activity.itemType, locale)}</strong>{activity.summary && <small>{activity.summary}</small>}</span></div>)}</div>
    </details>}
    {changedFiles.length > 0 && <details className="stream-files" open><summary>{locale === "ja" ? `変更ファイル ${changedFiles.length}` : `已涉及 ${changedFiles.length} 个文件`}</summary>{changedFiles.map((file) => <code key={file}>{file}</code>)}</details>}
    {(message.streaming || message.streamError) && <div className={`stream-current ${message.streamError ? "failed" : ""}`}><i /><span>{message.streamError || streamStatusLabel(message.streamStatus, locale)}</span></div>}
  </div>;
}

function activityLabel(itemType: string, locale: Locale): string {
  const japanese: Record<string, string> = { reasoning: "分析中", commandExecution: "コマンド実行", fileChange: "ファイル変更", mcpToolCall: "ツール呼び出し", dynamicToolCall: "ツール実行", collabToolCall: "エージェント連携", webSearch: "Web 検索", imageView: "画像確認", contextCompaction: "会話整理", agentMessage: "回答作成" };
  const chinese: Record<string, string> = { reasoning: "正在分析", commandExecution: "执行命令", fileChange: "修改文件", mcpToolCall: "调用工具", dynamicToolCall: "执行工具", collabToolCall: "协作处理", webSearch: "搜索网页", imageView: "查看图片", contextCompaction: "整理会话", agentMessage: "生成回答" };
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
