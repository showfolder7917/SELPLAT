import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import {
  Add24Regular,
  Branch24Regular,
  Bug24Regular,
  Code24Regular,
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
  Stop24Filled,
  Subtract20Regular,
  WindowDevTools24Regular,
} from "@fluentui/react-icons";

import type { Locale, SandboxMode } from "../../../shared/contracts/desktop";
import "./developer.css";

type Message = { id: number; role: "user" | "assistant"; text: string };

const labels = {
  ja: { title: "Developer", placeholder: "コード、調査、変更内容を入力", ready: "ローカル Codex 接続済み", files: "EXPLORER", tasks: "TASKS", newTask: "新しいタスク", settings: "実行設定", readOnly: "読み取り専用", write: "ワークスペース書き込み", thinking: "Codex が処理中..." },
  "zh-CN": { title: "Developer", placeholder: "输入代码、调查或修改任务", ready: "本地 Codex 已连接", files: "资源管理器", tasks: "任务", newTask: "新建任务", settings: "执行设置", readOnly: "只读", write: "工作区写入", thinking: "Codex 正在处理..." },
} as const;

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
  const text = labels[locale];
  const nextId = useMemo(() => messages.reduce((maximum, item) => Math.max(maximum, item.id), 0) + 1, [messages]);

  useEffect(() => {
    window.desktop?.getEnvironment().then((environment) => setProjectRoot(environment.projectRoot));
    window.desktop?.getSettings().then((settings) => {
      setLocale(settings.locale);
      setSandboxMode(settings.sandboxMode);
    });
  }, []);

  const updateSettings = (nextLocale: Locale, nextSandbox: SandboxMode) => {
    setLocale(nextLocale);
    setSandboxMode(nextSandbox);
    void window.desktop?.updateSettings({ locale: nextLocale, sandboxMode: nextSandbox });
  };

  const send = async () => {
    const message = input.trim();
    if (!message || loading) return;
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

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); }
  };

  return <div className="developer-shell" lang={locale}>
    <header className="dev-titlebar">
      <div className="dev-brand"><Code24Regular /><strong>CODEX</strong><span>{text.title}</span></div>
      <div className="dev-command"><Search24Regular /><span>{projectRoot}</span></div>
      <WindowControls />
    </header>

    <aside className="dev-activitybar">
      <button className="active"><Folder24Regular /></button><button><Search24Regular /></button><button><Branch24Regular /></button><button><Bug24Regular /></button>
      <button className="activity-settings" onClick={() => setSettingsOpen((value) => !value)}><Settings24Regular /></button>
    </aside>

    <aside className="dev-explorer">
      <div className="dev-section-title"><span>{text.files}</span><MoreHorizontal24Regular /></div>
      <div className="dev-project"><span>⌄</span><strong>SELPLAT</strong></div>
      <div className="dev-file"><span>⌄</span><Folder24Regular /> apps</div>
      <div className="dev-file indent"><Folder24Regular /> copilot-codex-desktop</div>
      <div className="dev-file indent"><Document24Regular /> package.json</div>
      <div className="dev-section-title tasks"><span>{text.tasks}</span><Add24Regular /></div>
      <button className="new-task" onClick={() => { void window.desktop?.newChat(); setMessages([]); }}><Add24Regular />{text.newTask}</button>
    </aside>

    <main className="dev-main">
      <div className="dev-tab"><Prompt24Regular /><span>Codex Chat</span><Dismiss20Regular /></div>
      <section className="dev-chat">
        {messages.length === 0 && <div className="dev-empty"><div className="dev-orb"><Code24Regular /></div><h1>{locale === "ja" ? "何を作りますか？" : "今天要构建什么？"}</h1><p>{text.ready}</p></div>}
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
      <dl><dt>PROJECT</dt><dd>{projectRoot}</dd><dt>MODE</dt><dd>{sandboxMode}</dd><dt>MODEL</dt><dd>Local Codex</dd></dl>
      <div className="status-card"><i />{text.ready}</div>
    </aside>

    <footer className="dev-statusbar"><span><Branch24Regular /> main*</span><span>0 errors</span><span>{sandboxMode}</span><span>UTF-8</span></footer>

    {settingsOpen && <section className="dev-settings">
      <h2>{text.settings}</h2>
      <label>Language<select value={locale} onChange={(event) => updateSettings(event.target.value as Locale, sandboxMode)}><option value="zh-CN">简体中文</option><option value="ja">日本語</option></select></label>
      <label>Sandbox<select value={sandboxMode} onChange={(event) => updateSettings(locale, event.target.value as SandboxMode)}><option value="read-only">{text.readOnly}</option><option value="workspace-write">{text.write}</option></select></label>
    </section>}
  </div>;
}
