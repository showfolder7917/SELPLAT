/** 无边框桌面窗口控件；按钮只发送白名单动作，不直接持有 Electron 对象。 */
import { Dismiss20Regular, Square20Regular, Subtract20Regular } from "@fluentui/react-icons";

export function WindowControls() {
  return <div className="dev-window-controls">
    <button onClick={() => window.desktop?.windowControl("minimize")}><Subtract20Regular /></button>
    <button onClick={() => window.desktop?.windowControl("maximize")}><Square20Regular /></button>
    <button className="close" onClick={() => window.desktop?.windowControl("close")}><Dismiss20Regular /></button>
  </div>;
}

/** 统一 ChatGPT 登录入口的视觉和事件语义。 */
export function ChatGPTLoginAction({ label, onLogin }: { label: string; onLogin: () => void }) {
  return <button type="button" className="chatgpt-login-action primary" onClick={onLogin}><span>{label}</span></button>;
}
