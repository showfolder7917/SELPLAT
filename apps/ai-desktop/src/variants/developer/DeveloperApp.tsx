import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Add24Regular,
  Branch24Regular,
  Bug24Regular,
  ChevronDown16Regular,
  ChevronRight16Regular,
  Code24Regular,
  Delete16Regular,
  Dismiss20Regular,
  Document24Regular,
  Folder24Regular,
  MoreHorizontal24Regular,
  Prompt24Regular,
  Search24Regular,
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
  Locale,
  SandboxMode,
  WorkspaceEntry,
  WorkspacePermission,
  WorkspaceState,
} from "../../../shared/contracts/desktop";
import "./developer.css";

type Message = { id: number; role: "user" | "assistant"; text: string };

const labels = {
  ja: { title: "Developer", placeholder: "コード、調査、変更内容を入力", ready: "Codex harness 接続済み", signIn: "ChatGPT でログイン", signOut: "ログアウト", signedOut: "ChatGPT にログインしてください", browserOpened: "ブラウザーでログインを完了してください", files: "EXPLORER", workspaces: "WORKSPACES", addWorkspace: "ワークスペースを追加", primary: "メイン", makePrimary: "メインに設定", remove: "削除", tasks: "TASKS", newTask: "新しいタスク", settings: "接続と実行設定", account: "ChatGPT アカウント", readOnly: "読み取り専用", write: "ワークスペース書き込み", thinking: "Codex が処理中...", approve: "許可", decline: "拒否" },
  "zh-CN": { title: "Developer", placeholder: "输入代码、调查或修改任务", ready: "Codex harness 已连接", signIn: "使用 ChatGPT 登录", signOut: "退出登录", signedOut: "请先登录 ChatGPT", browserOpened: "请在浏览器中完成登录", files: "资源管理器", workspaces: "工作区", addWorkspace: "添加工作区", primary: "主目录", makePrimary: "设为主目录", remove: "移除", tasks: "任务", newTask: "新建任务", settings: "连接与执行设置", account: "ChatGPT 账号", readOnly: "只读", write: "工作区写入", thinking: "Codex 正在处理...", approve: "允许", decline: "拒绝" },
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
    if (!message || loading) return;
    if (!codexStatus.account.authenticated) {
      setSettingsOpen(true);
      setLoginHint(text.signedOut);
      return;
    }
    const userMessage = { id: nextId, role: "user" as const, text: message };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);
    try {
      const response = window.desktop
        ? await window.desktop.sendMessage({ message, locale, sandboxMode })
        : { text: locale === "ja" ? "デスクトップ版でローカル Codex に接続します。" : "桌面版本会在这里返回本地 Codex 的结果。", itemCount: 0 };
      setMessages((current) => [...current, { id: nextId + 1, role: "assistant", text: response.text }]);
    } catch (error) {
      setMessages((current) => [...current, { id: nextId + 1, role: "assistant", text: error instanceof Error ? error.message : "Codex unavailable" }]);
    } finally {
      setLoading(false);
    }
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
      <button className="new-task" onClick={() => { void window.desktop?.newChat(); setMessages([]); }}><Add24Regular />{text.newTask}</button>
    </aside>

    <main className="dev-main">
      <div className="dev-tab"><Prompt24Regular /><span>Codex Chat</span><Dismiss20Regular /></div>
      <section className="dev-chat">
        {messages.length === 0 && <div className="dev-empty"><div className="dev-orb"><Code24Regular /></div><h1>{locale === "ja" ? "何を作りますか？" : "今天要构建什么？"}</h1><p>{codexStatus.account.authenticated ? text.ready : text.signedOut}</p></div>}
        {messages.map((message) => <article key={message.id} className={`dev-message ${message.role}`}><span>{message.role === "user" ? "YOU" : "CODEX"}</span><div>{message.text}</div></article>)}
        {loading && <div className="dev-thinking"><i /><span>{text.thinking}</span></div>}
      </section>
      <form className="dev-composer" onSubmit={(event: FormEvent) => { event.preventDefault(); void send(); }}>
        <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onKeyDown} placeholder={text.placeholder} />
        <div className="composer-footer"><span><ShieldCheckmark24Regular />{sandboxMode}</span><button type="button" onClick={loading ? () => { void window.desktop?.cancel(); setLoading(false); } : () => void send()}>{loading ? <Stop24Filled /> : <Send24Filled />}</button></div>
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
    </section>}

    {approval && <section className="dev-approval" role="dialog" aria-modal="true" aria-label={approval.title}>
      <div className="approval-card"><span className="approval-kicker">CODEX APPROVAL</span><h2>{approval.title}</h2>{approval.reason && <p>{approval.reason}</p>}{approval.command && <pre>{approval.command}</pre>}{approval.cwd && <small>{approval.cwd}</small>}{approval.details && <details><summary>Details</summary><pre>{approval.details}</pre></details>}<div className="approval-actions"><button onClick={() => void resolveApproval("decline")}>{text.decline}</button><button className="primary" onClick={() => void resolveApproval("accept")}>{text.approve}</button></div></div>
    </section>}
  </div>;
}
