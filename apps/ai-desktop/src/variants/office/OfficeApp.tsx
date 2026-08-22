import { FormEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Add24Regular,
  AddCircle24Regular,
  Apps24Regular,
  ArrowClockwise24Regular,
  ArrowDownload24Regular,
  ArrowRight20Regular,
  Book24Regular,
  Bot24Regular,
  Briefcase24Regular,
  Chat24Regular,
  ChevronRight20Regular,
  Copy24Regular,
  Dismiss20Regular,
  PersonFeedback24Regular,
  Globe24Regular,
  Library24Regular,
  Mic24Regular,
  MoreHorizontal24Regular,
  PanelLeft24Regular,
  Pin24Regular,
  Search24Regular,
  Send24Filled,
  Settings24Regular,
  ShieldCheckmark24Regular,
  Sparkle24Regular,
  Square20Regular,
  Stop24Filled,
  Subtract20Regular,
  ThumbDislike24Regular,
  ThumbLike24Regular,
} from "@fluentui/react-icons";

import type { Locale, SandboxMode } from "../../../shared/contracts/desktop";
import "./office.css";

type Message = { id: number; role: "user" | "assistant"; text: string };

const copy = {
  ja: {
    newChat: "新しいチャット", search: "検索", library: "ライブラリ", agents: "エージェント",
    promptCoach: "Prompt Coach", learningCoach: "Learning Coach", careerCoach: "Career Coach",
    newAgent: "新しいエージェント", otherAgents: "その他のエージェント", chats: "チャット",
    allChats: "すべてのチャットを表示", account: "職場 Xu,", basic: "Copilot Chat (Basic)", upgrade: "アップグレード",
    auto: "自動", welcome: "何かお手伝いできることはありますか?", placeholder: "Copilot にメッセージを送信する",
    polish: "作文を洗練します", draft: "コンテンツを下書きします", summarize: "要約", searchContent: "コンテンツを検索します",
    disclaimer: "AI で生成されたコンテンツは誤りを含む可能性があります。", settings: "設定",
    recent: "最近表示したページ", scheduled: "スケジュールされたプロンプト", feedback: "フィードバックの提供",
    download: "アプリのダウンロード", pin: "タスク バーにアプリをピン留めする",
    privacy: "プライバシー　使用条件", faq: "よくあるご質問", settingsTitle: "設定",
    language: "表示言語", japanese: "日本語", chinese: "简体中文", project: "作業フォルダー",
    connection: "ローカル接続", connected: "接続済み", execution: "実行モード",
    readOnly: "読み取り専用", workspaceWrite: "ワークスペース書き込み", close: "閉じる",
    working: "回答を準備しています", cancelled: "処理をキャンセルしました。", unavailable: "ローカル接続を利用できません。",
  },
  "zh-CN": {
    newChat: "新建聊天", search: "搜索", library: "库", agents: "智能体",
    promptCoach: "提示词教练", learningCoach: "学习教练", careerCoach: "职业教练",
    newAgent: "新建智能体", otherAgents: "其他智能体", chats: "聊天",
    allChats: "显示所有聊天", account: "职场 Xu,", basic: "Copilot Chat（基础版）", upgrade: "升级",
    auto: "自动", welcome: "有什么可以帮您?", placeholder: "向 Copilot 发送消息",
    polish: "润色作文", draft: "起草内容", summarize: "总结", searchContent: "搜索内容",
    disclaimer: "AI 生成的内容可能包含错误。", settings: "设置",
    recent: "最近查看的页面", scheduled: "计划的提示词", feedback: "提供反馈",
    download: "下载应用", pin: "将应用固定到任务栏",
    privacy: "隐私　使用条款", faq: "常见问题", settingsTitle: "设置",
    language: "显示语言", japanese: "日本語", chinese: "简体中文", project: "工作目录",
    connection: "本地连接", connected: "已连接", execution: "执行模式",
    readOnly: "只读", workspaceWrite: "允许写入工作区", close: "关闭",
    working: "正在准备回答", cancelled: "处理已取消。", unavailable: "本地连接不可用。",
  },
} as const;

const exampleChats = ["红色是代码同要件不一致部分 ...", "火曜日 是星期三吗", "聊天"];

function IconButton({ label, children, onClick, className = "" }: {
  label: string; children: ReactNode; onClick?: () => void; className?: string;
}) {
  return <button className={`icon-button ${className}`} aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

function WindowControls() {
  return (
    <div className="window-controls">
      <button aria-label="Minimize" onClick={() => window.desktop?.windowControl("minimize")}><Subtract20Regular /></button>
      <button aria-label="Maximize" onClick={() => window.desktop?.windowControl("maximize")}><Square20Regular /></button>
      <button aria-label="Close" className="window-close" onClick={() => window.desktop?.windowControl("close")}><Dismiss20Regular /></button>
    </div>
  );
}

function Sidebar({ locale, onNewChat, onOpenSettings }: {
  locale: Locale; onNewChat: () => void; onOpenSettings: () => void;
}) {
  const text = copy[locale];
  const [settingsMenu, setSettingsMenu] = useState(false);
  return (
    <aside className="sidebar">
      <div className="sidebar-drag-region" />
      <header className="sidebar-header">
        <div className="brand">Copilot</div>
        <div className="sidebar-header-actions">
          <IconButton label="Apps"><Apps24Regular /></IconButton>
          <IconButton label="Panel"><PanelLeft24Regular /></IconButton>
        </div>
      </header>
      <nav className="primary-nav" aria-label="Primary">
        <button className="nav-item selected" onClick={onNewChat}><AddCircle24Regular /><span>{text.newChat}</span></button>
        <button className="nav-item"><Search24Regular /><span>{text.search}</span></button>
        <button className="nav-item"><Library24Regular /><span>{text.library}</span></button>
      </nav>
      <section className="sidebar-section agents-section">
        <h2>{text.agents}</h2>
        <button className="nav-item"><Sparkle24Regular className="agent-icon pink" /><span>{text.promptCoach}</span></button>
        <button className="nav-item"><Book24Regular className="agent-icon orange" /><span>{text.learningCoach}</span></button>
        <button className="nav-item"><Briefcase24Regular className="agent-icon blue" /><span>{text.careerCoach}</span></button>
        <button className="nav-item"><Bot24Regular /><span>{text.newAgent}</span></button>
        <button className="nav-item"><MoreHorizontal24Regular /><span>{text.otherAgents}</span></button>
      </section>
      <section className="sidebar-section chats-section">
        <h2>{text.chats}</h2>
        {exampleChats.map((title, index) => <button key={title} className={`chat-row ${index === 0 ? "active" : ""}`}>{title}</button>)}
      </section>
      <div className="sidebar-footer">
        <button className="all-chats">{text.allChats}<ArrowRight20Regular /></button>
        <div className="profile-row">
          <div className="avatar">X楠</div>
          <div className="profile-copy"><strong>{text.account}</strong><span>{text.basic} ⓘ</span></div>
          <IconButton label={text.settings} className={settingsMenu ? "active" : ""} onClick={() => setSettingsMenu((value) => !value)}><Settings24Regular /></IconButton>
        </div>
        <button className="upgrade-button">{text.upgrade}</button>
      </div>
      {settingsMenu && <SettingsMenu locale={locale} onSettings={() => { setSettingsMenu(false); onOpenSettings(); }} />}
    </aside>
  );
}

function SettingsMenu({ locale, onSettings }: { locale: Locale; onSettings: () => void }) {
  const text = copy[locale];
  return (
    <div className="settings-menu" data-testid="settings-menu">
      <button onClick={onSettings}>{text.settings}</button>
      <button>{text.recent}</button>
      <button>{text.scheduled}</button>
      <button className="focus-outline"><PersonFeedback24Regular />{text.feedback}</button>
      <div className="menu-divider" />
      <button>{text.download}<ChevronRight20Regular /></button>
      <div className="menu-divider" />
      <button className="pin-item"><Pin24Regular />{text.pin}</button>
      <div className="legal-copy"><span>{text.privacy}</span><span>{text.faq}</span></div>
    </div>
  );
}

function SettingsDialog({ locale, sandboxMode, projectRoot, onLocale, onSandbox, onClose }: {
  locale: Locale; sandboxMode: SandboxMode; projectRoot: string;
  onLocale: (locale: Locale) => void; onSandbox: (mode: SandboxMode) => void; onClose: () => void;
}) {
  const text = copy[locale];
  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <header><h2 id="settings-title">{text.settingsTitle}</h2><IconButton label={text.close} onClick={onClose}><Dismiss20Regular /></IconButton></header>
        <div className="setting-row"><div><strong><Globe24Regular />{text.language}</strong></div><div className="segmented">
          <button className={locale === "ja" ? "selected" : ""} onClick={() => onLocale("ja")}>{text.japanese}</button>
          <button className={locale === "zh-CN" ? "selected" : ""} onClick={() => onLocale("zh-CN")}>{text.chinese}</button>
        </div></div>
        <div className="setting-row"><div><strong><ShieldCheckmark24Regular />{text.execution}</strong></div><div className="segmented wide">
          <button className={sandboxMode === "read-only" ? "selected" : ""} onClick={() => onSandbox("read-only")}>{text.readOnly}</button>
          <button className={sandboxMode === "workspace-write" ? "selected" : ""} onClick={() => onSandbox("workspace-write")}>{text.workspaceWrite}</button>
        </div></div>
        <div className="setting-card"><span>{text.project}</span><strong>{projectRoot || "C:\\opt\\workspace\\SELPLAT"}</strong></div>
        <div className="setting-card connection"><span>{text.connection}</span><strong><i />{text.connected}</strong></div>
      </section>
    </div>
  );
}

function Composer({ locale, value, loading, centered, onChange, onSubmit, onCancel }: {
  locale: Locale; value: string; loading: boolean; centered?: boolean;
  onChange: (value: string) => void; onSubmit: () => void; onCancel: () => void;
}) {
  const text = copy[locale];
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSubmit(); }
  };
  return (
    <form className={`composer ${centered ? "composer-centered" : ""}`} onSubmit={(event: FormEvent) => { event.preventDefault(); onSubmit(); }}>
      <IconButton label="Add"><Add24Regular /></IconButton>
      <textarea rows={1} value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown} placeholder={text.placeholder} aria-label={text.placeholder} />
      {value.trim() || loading ? (
        <IconButton label={loading ? "Stop" : "Send"} className="send-button" onClick={loading ? onCancel : onSubmit}>{loading ? <Stop24Filled /> : <Send24Filled />}</IconButton>
      ) : <IconButton label="Microphone"><Mic24Regular /></IconButton>}
    </form>
  );
}

function EmptyState({ locale, value, loading, onChange, onSubmit, onCancel }: {
  locale: Locale; value: string; loading: boolean; onChange: (value: string) => void; onSubmit: () => void; onCancel: () => void;
}) {
  const text = copy[locale];
  return (
    <div className="empty-state" data-testid="empty-state">
      <h1>{text.welcome}</h1>
      <Composer locale={locale} value={value} loading={loading} centered onChange={onChange} onSubmit={onSubmit} onCancel={onCancel} />
      <div className="suggestion-row">
        {[text.polish, text.draft, text.summarize, text.searchContent].map((label) => <button key={label} onClick={() => onChange(label)}>{label}</button>)}
        <IconButton label="More"><MoreHorizontal24Regular /></IconButton>
      </div>
    </div>
  );
}

function Conversation({ locale, messages, loading }: { locale: Locale; messages: Message[]; loading: boolean }) {
  const text = copy[locale];
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, loading]);
  return (
    <div className="conversation" data-testid="conversation">
      <div className="message-column">
        {messages.map((message) => message.role === "user" ? (
          <article className="user-message" key={message.id}>{message.text}</article>
        ) : (
          <article className="assistant-message" key={message.id}>
            <div className="message-copy">{message.text.split("\n").map((line, index) => <p key={`${message.id}-${index}`}>{line || "\u00a0"}</p>)}</div>
            <div className="message-actions"><Copy24Regular /><ThumbLike24Regular /><ThumbDislike24Regular /><ArrowClockwise24Regular /><MoreHorizontal24Regular /></div>
          </article>
        ))}
        {loading && <div className="thinking"><span /><span /><span />{text.working}</div>}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export function OfficeApp() {
  const [locale, setLocale] = useState<Locale>(() => (localStorage.getItem("copilot-locale") as Locale) || "ja");
  const [sandboxMode, setSandboxMode] = useState<SandboxMode>(() => (localStorage.getItem("copilot-sandbox") as SandboxMode) || "read-only");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectRoot, setProjectRoot] = useState("");
  const text = copy[locale];
  const hasConversation = messages.length > 0 || loading;
  const nextId = useMemo(() => messages.reduce((max, item) => Math.max(max, item.id), 0) + 1, [messages]);

  useEffect(() => {
    window.desktop?.getEnvironment().then((environment) => setProjectRoot(environment.projectRoot));
    window.desktop?.getSettings().then((settings) => {
      setLocale(settings.locale);
      setSandboxMode(settings.sandboxMode);
    });
  }, []);
  useEffect(() => {
    localStorage.setItem("copilot-locale", locale);
    void window.desktop?.updateSettings({ locale });
  }, [locale]);
  useEffect(() => {
    localStorage.setItem("copilot-sandbox", sandboxMode);
    void window.desktop?.updateSettings({ sandboxMode });
  }, [sandboxMode]);

  const newChat = async () => {
    if (loading) await window.desktop?.cancel();
    await window.desktop?.newChat();
    setMessages([]); setInput(""); setLoading(false);
  };

  const send = async () => {
    const message = input.trim();
    if (!message || loading) return;
    const userMessage: Message = { id: nextId, role: "user", text: message };
    setMessages((current) => [...current, userMessage]);
    setInput(""); setLoading(true);
    try {
      const result = window.desktop
          ? await window.desktop.sendMessage({ message, locale, sandboxMode, attachmentIds: [], executionMode: "conversation-managed" })
        : await new Promise<{ text: string; itemCount: number }>((resolve) => setTimeout(() => resolve({ text: locale === "ja" ? "ローカルの Codex 応答はデスクトップアプリで表示されます。" : "本地 Codex 的回复将在桌面应用中显示。", itemCount: 1 }), 700));
      setMessages((current) => [...current, { id: userMessage.id + 1, role: "assistant", text: result.text || text.unavailable }]);
    } catch (error) {
      setMessages((current) => [...current, { id: userMessage.id + 1, role: "assistant", text: error instanceof Error ? error.message : text.unavailable }]);
    } finally { setLoading(false); }
  };

  const cancel = async () => { await window.desktop?.cancel(); setLoading(false); };
  return (
    <div className="app-shell" lang={locale}>
      <Sidebar locale={locale} onNewChat={newChat} onOpenSettings={() => setSettingsOpen(true)} />
      <main className="main-pane">
        <div className="main-drag-region" />
        <WindowControls />
        <header className="main-toolbar"><button>{text.auto}<span>⌄</span></button><div><ShieldCheckmark24Regular /><Chat24Regular /><MoreHorizontal24Regular /></div></header>
        {!hasConversation ? <EmptyState locale={locale} value={input} loading={loading} onChange={setInput} onSubmit={send} onCancel={cancel} /> : (
          <><Conversation locale={locale} messages={messages} loading={loading} /><div className="conversation-composer"><Composer locale={locale} value={input} loading={loading} onChange={setInput} onSubmit={send} onCancel={cancel} /><p>{text.disclaimer}</p></div></>
        )}
      </main>
      {settingsOpen && <SettingsDialog locale={locale} sandboxMode={sandboxMode} projectRoot={projectRoot} onLocale={setLocale} onSandbox={setSandboxMode} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
