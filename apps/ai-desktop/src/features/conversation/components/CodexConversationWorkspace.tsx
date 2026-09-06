/**
 * Codex 会话页面的 View。
 * 客户从 Developer 主工作区进入本页，会看到消息时间线、输入区、截图工具和自动测试反馈。
 * 本文件只选择文案并组装可见区域，不直接处理消息或截图状态。
 */

// 桌面对话框来自主题公共层，本页用它显示自动测试阻断原因。
import { SelUiDialog } from "../../../theme/SelUiProvider";
import type {
  // 页面参数：统一说明应用层交给本功能的公开边界。
  CodexConversationWorkspaceProps,
  // 页面文案：保证时间线与编辑区使用同一套语言文本。
  CodexConversationWorkspaceText,
} from "./CodexConversationWorkspace.types";
// 会话编辑区处理输入、附件、队列与底部工具栏。
import { CodexConversationComposer } from "./CodexConversationWorkspace/CodexConversationComposer";
// 消息时间线处理空状态、消息和每条消息的协作操作。
import { CodexConversationTimeline } from "./CodexConversationWorkspace/CodexConversationTimeline";

/** 会话页文案：根据当前区域选择完整文案，避免 JSX 中反复写语言判断。 */
function conversationWorkspaceText(locale: CodexConversationWorkspaceProps["locale"]): CodexConversationWorkspaceText {
  if (locale === "ja") {
    return {
      ready: "Codex harness 接続済み",
      signedOut: "ChatGPT にログインしてください",
      signIn: "ChatGPT でログイン",
      placeholder: "コード、調査、変更内容を入力（画像を貼り付け可能）",
      attachment: "画像添付",
      remove: "削除",
      screenshot: "現在の画面をキャプチャ",
      hiddenScreenshot: "AI Desktop を隠してキャプチャ",
      openSettings: "システム設定を開く",
      automaticTest: "自動テスト",
      checking: "自動テスト環境を確認中…",
      readyTest: "自動テスト環境の準備ができました",
      blocked: "自動テストを開始できません",
      close: "閉じる",
    };
  }
  return {
    ready: "Codex harness 已连接",
    signedOut: "请先登录 ChatGPT",
    signIn: "使用 ChatGPT 登录",
    placeholder: "输入代码、调查或修改任务（可粘贴截图）",
    attachment: "图片附件",
    remove: "移除",
    screenshot: "截取当前屏幕",
    hiddenScreenshot: "隐藏 AI Desktop 后截图",
    openSettings: "打开系统设置",
    automaticTest: "自动测试",
    checking: "正在检查自动测试环境…",
    readyTest: "自动测试环境已就绪",
    blocked: "自动测试开启失败",
    close: "知道了",
  };
}

/** 主 Codex 会话页面：按时间线、编辑区、阻断对话框的顺序组装子区域。 */
export function CodexConversationWorkspace(props: CodexConversationWorkspaceProps) {
  const text = conversationWorkspaceText(props.locale);
  const automaticTesting = props.controller.automaticTesting;

  /** 自动测试提示关闭操作：只清除当前对话框，不改动测试开关。 */
  function closeAutomaticTestDialog() {
    automaticTesting.setDialog(null);
  }

  return (
    <>
      {/* 消息时间线：页面上半部显示客户与 Codex 的完整交流。 */}
      <CodexConversationTimeline
        locale={props.locale}
        controller={props.controller}
        collaboration={props.collaboration}
        text={text}
      />
      {/* 会话编辑区：页面底部显示队列、附件、输入框和工具。 */}
      <CodexConversationComposer
        locale={props.locale}
        sandboxMode={props.sandboxMode}
        controller={props.controller}
        screenshot={props.screenshot}
        text={text}
      />
      {/* 自动测试阻断提示：告诉客户哪项环境检查未通过。 */}
      <SelUiDialog
        id="ai-desktop-automatic-test"
        open={Boolean(automaticTesting.dialog)}
        title={text.blocked}
        kicker="AUTOMATIC TEST"
        dismissible
        size="compact"
        onRequestClose={closeAutomaticTestDialog}
      >
        {automaticTesting.dialog && (
          <>
            <ul className="seldialog-checks">
              {automaticTesting.dialog.checks.map((check) => (
                <li className={check.status} key={check.id}>
                  <i />
                  <span><strong>{check.label}</strong><small>{check.detail}</small></span>
                </li>
              ))}
            </ul>
            <div className="seldialog-actions">
              <button data-sel-action="primary" onClick={closeAutomaticTestDialog}>{text.close}</button>
            </div>
          </>
        )}
      </SelUiDialog>
    </>
  );
}
