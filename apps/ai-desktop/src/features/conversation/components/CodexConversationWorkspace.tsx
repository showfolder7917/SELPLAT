import { ArrowClockwise24Regular, Code24Regular, Dismiss20Regular, EyeOff24Regular, Screenshot24Regular, Send24Filled, ShieldCheckmark24Regular, Stop24Filled } from "@fluentui/react-icons";
import type { FormEvent } from "react";

import type { LocaleValue, SandboxModeValue } from "../../../../contracts/system/desktop/index";
import type { useCollaborationWorkspace } from "../../collaboration/model/useCollaborationWorkspace";
import type { useScreenshotCapture } from "../../screenshot/model/useScreenshotCapture";
import { SelUiDialog } from "../../../theme/SelUiProvider";
import type { useCodexWorkspace } from "../model/useCodexWorkspace";
import { ChatGPTLoginAction } from "../../shell/components/DesktopChrome";
import { CodexUserInputPanel } from "./CodexUserInputPanel";
import { CollaborationStatusChain } from "./CollaborationStatusChain";
import { ManagedStageAction } from "./ManagedStageAction";
import { MarkdownMessage } from "./MarkdownMessage";
import { SelUiConversation } from "./SelUiConversation";
import { managedModeLabel, StreamDetails } from "./StreamDetails";

type CodexController = ReturnType<typeof useCodexWorkspace>;
type ScreenshotController = ReturnType<typeof useScreenshotCapture>;
type CollaborationController = ReturnType<typeof useCollaborationWorkspace>;

type CodexConversationWorkspaceProps = {
  locale: LocaleValue;
  sandboxMode: SandboxModeValue;
  controller: CodexController;
  screenshot: ScreenshotController;
  collaboration: CollaborationController;
};

/** 主 Codex 会话完整拥有时间线、输入、队列、审批请求和自动测试反馈视图。 */
export function CodexConversationWorkspace({ locale, sandboxMode, controller, screenshot, collaboration }: CodexConversationWorkspaceProps) {
  const { conversation, interaction, dispatch, automaticTesting, latestManagedAssistantId, send, cancelActiveTurn, submitConfirmedCollaborationTask } = controller;
  const { executionMode, setExecutionMode, messages, input, setInput, attachments, setAttachments, loading, chatRef, activeAssistantIdRef } = conversation;
  const {
    userInputRequest, userInputAnswers, setUserInputAnswers, customAnswerIds, setCustomAnswerIds,
    confirmedQuestionIds, userInputSubmitting, loginHint, login, submitUserInput,
  } = interaction;
  const { state: dispatchState, error: dispatchError, queuedSends, supplement, discard, recover, discardRecovery } = dispatch;
  const text = locale === "ja" ? {
    ready: "Codex harness 接続済み", signedOut: "ChatGPT にログインしてください", signIn: "ChatGPT でログイン", placeholder: "コード、調査、変更内容を入力（画像を貼り付け可能）", attachment: "画像添付", remove: "削除", screenshot: "現在の画面をキャプチャ", hiddenScreenshot: "AI Desktop を隠してキャプチャ", openSettings: "システム設定を開く", automaticTest: "自動テスト", checking: "自動テスト環境を確認中…", readyTest: "自動テスト環境の準備ができました", blocked: "自動テストを開始できません", close: "閉じる",
  } : {
    ready: "Codex harness 已连接", signedOut: "请先登录 ChatGPT", signIn: "使用 ChatGPT 登录", placeholder: "输入代码、调查或修改任务（可粘贴截图）", attachment: "图片附件", remove: "移除", screenshot: "截取当前屏幕", hiddenScreenshot: "隐藏 AI Desktop 后截图", openSettings: "打开系统设置", automaticTest: "自动测试", checking: "正在检查自动测试环境…", readyTest: "自动测试环境已就绪", blocked: "自动测试开启失败", close: "知道了",
  };

  return <>
    <section ref={chatRef} className="selconversation-timeline">
      {messages.length === 0 && <div className="dev-empty"><div className="dev-orb"><Code24Regular /></div><h1>{locale === "ja" ? "何を作りますか？" : "今天要构建什么？"}</h1><p>{interaction.status.account.authenticated ? text.ready : text.signedOut}</p>{!interaction.status.account.authenticated && <ChatGPTLoginAction label={text.signIn} onLogin={() => void login()} />}{!interaction.status.account.authenticated && loginHint && <em className="dev-login-hint">{loginHint}</em>}</div>}
      {messages.map((message) => {
        const messageTask = message.collaborationTaskId ? collaboration.state?.tasks.find((task) => task.taskId === message.collaborationTaskId) || null : null;
        return <article key={message.id} className="selconversation-message" data-role={message.role} data-streaming={message.streaming || undefined}><header>{message.role === "user" ? `YOU${message.status === "sending" ? " · 发送中" : message.status === "failed" ? " · 发送失败" : ""}` : "CODEX"}</header><div className="selconversation-message-body">{message.attachments?.length ? <div className="selconversation-message-attachments">{message.attachments.map((attachment) => <img key={attachment.id} src={attachment.dataUrl} alt={attachment.name} />)}</div> : null}{message.text && (message.role === "assistant" ? <MarkdownMessage text={message.text} /> : <div className="message-text">{message.text}</div>)}{message.role === "assistant" && <StreamDetails message={message} locale={locale} />}{message.role === "assistant" && messageTask && <CollaborationStatusChain task={messageTask} locale={locale} onRetry={async (taskId) => { await collaboration.continueTask(taskId); }} />}{message.role === "assistant" && message.id === activeAssistantIdRef.current && userInputRequest && <CodexUserInputPanel request={userInputRequest} answers={userInputAnswers} customAnswerIds={customAnswerIds} confirmedQuestionIds={confirmedQuestionIds} locale={locale} submitting={userInputSubmitting} onChoose={(questionId, value) => { setCustomAnswerIds((current) => { const next = new Set(current); next.delete(questionId); return next; }); setUserInputAnswers((current) => ({ ...current, [questionId]: value })); }} onChooseCustom={(questionId) => { setCustomAnswerIds((current) => new Set(current).add(questionId)); setUserInputAnswers((current) => ({ ...current, [questionId]: "" })); }} onCustomChange={(questionId, value) => setUserInputAnswers((current) => ({ ...current, [questionId]: value }))} onConfirm={(questionId) => void submitUserInput(questionId)} />}{message.role === "assistant" && !message.streamError && (message.actionTriggered || message.id === latestManagedAssistantId) && <ManagedStageAction message={message} locale={locale} actionable={message.id === latestManagedAssistantId} activeMode={executionMode} onReturn={setExecutionMode} onAdvance={(mode, label) => collaboration.collaborationMode && message.managedMode === "conversation-managed" ? void submitConfirmedCollaborationTask(message).catch((error) => dispatch.setError(error instanceof Error ? error.message : "无法提交协同任务。")) : void send({ message: "1", displayText: label, mode, sourceMessageId: message.id })} />}</div></article>;
      })}
    </section>
    <SelUiConversation id="selConversationCodexId" onSubmit={() => void send()} timeline={null} composer={<form className="selconversation-composer" onSubmit={(event: FormEvent) => { event.preventDefault(); void send(); }}>
      {attachments.length > 0 && <div className="composer-attachments">{attachments.map((attachment) => <figure key={attachment.id}><img src={attachment.dataUrl} alt={attachment.name} /><figcaption>{text.attachment}</figcaption><button type="button" title={text.remove} onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}><Dismiss20Regular /></button></figure>)}</div>}
      {dispatchState.activeTask?.status === "recoverable" && <div className="dispatch-recovery" role="status"><span>发现上次未完成的任务</span><div><button type="button" onClick={() => void recover()}>继续执行</button><button type="button" onClick={() => void discardRecovery()}>放弃任务</button></div></div>}
      {dispatchState.activeTask?.status === "running" && !loading && <div className="dispatch-background" role="status">任务正在后台执行，完成后将继续处理等待队列。</div>}
      {queuedSends.length > 0 && <div className="dispatch-queue" aria-label="等待队列">{queuedSends.map((item, index) => <div key={item.id} className="dispatch-queue-item"><span><b>{index + 1}</b>{item.displayText}</span><div>{dispatchState.activeTask?.status === "running" && <button type="button" onClick={() => void supplement(item.id)}>补充到当前任务</button>}<button type="button" onClick={() => void discard(item.id)}>移除</button></div></div>)}</div>}
      <textarea ref={screenshot.composerRef} className="selconversation-input" data-sel-conversation-input value={input} onChange={(event) => setInput(event.target.value)} onPaste={screenshot.onPaste} placeholder={text.placeholder} />
      {dispatchError && <div className="composer-error" role="alert"><span>{dispatchError}</span></div>}
      {screenshot.screenshotError && <div className="composer-error" role="alert"><span>{screenshot.screenshotError}</span>{(screenshot.screenRecordingSettingsAvailable || screenshot.screenRecordingRestartRequired) && <div className="composer-error-actions">{screenshot.screenRecordingSettingsAvailable && <button type="button" onClick={() => void screenshot.openScreenRecordingSettings()}>{text.openSettings}</button>}{screenshot.screenRecordingRestartRequired && <button type="button" className="primary" disabled={screenshot.screenRecordingRestarting} onClick={() => void screenshot.restartForScreenRecordingPermission()}>{locale === "ja" ? "AI Desktop を再起動" : "重启 AI Desktop"}</button>}</div>}</div>}
      <div className="selconversation-footer"><div className="composer-tools" aria-label="输入工具栏"><div className="composer-tool-group composer-context-tools"><span><ShieldCheckmark24Regular />{sandboxMode}</span><span className="execution-mode-badge">{managedModeLabel(executionMode, locale)}</span>{queuedSends.length > 0 && <span className="queued-send-count">待发送 {queuedSends.length}</span>}</div><div className="composer-tool-group composer-automation-tools"><button type="button" role="switch" aria-checked={automaticTesting.enabled} className="selswitch composer-automatic-test-switch" disabled={automaticTesting.checking || (loading && !automaticTesting.enabled)} onClick={() => void automaticTesting.toggle()}><span>{text.automaticTest}</span><i className="selswitch-track" aria-hidden="true"><i className="selswitch-thumb" /></i></button>{(automaticTesting.checking || automaticTesting.enabled) && <span className="automatic-test-status" role="status">{automaticTesting.checking ? text.checking : text.readyTest}</span>}</div><div className="composer-tool-group composer-attachment-tools"><button type="button" className="screenshot-button" aria-label={text.screenshot} data-sel-tooltip={text.screenshot} data-sel-tooltip-mode="always" disabled={screenshot.screenshotBusy} onClick={() => void screenshot.startScreenshot()}>{screenshot.screenshotMode === "current" ? <ArrowClockwise24Regular className="screenshot-spinner" /> : <Screenshot24Regular />}</button><button type="button" className="screenshot-button" aria-label={text.hiddenScreenshot} data-sel-tooltip={text.hiddenScreenshot} data-sel-tooltip-mode="always" disabled={screenshot.screenshotBusy} onClick={() => void screenshot.startScreenshot(true)}>{screenshot.screenshotMode === "hidden" ? <ArrowClockwise24Regular className="screenshot-spinner" /> : <EyeOff24Regular />}</button></div></div><div className="selconversation-actions">{loading && <button type="button" className="stop-action" aria-label="停止当前任务" title="停止当前任务" onClick={cancelActiveTurn}><Stop24Filled /></button>}<button type="button" className="selconversation-action" aria-label={loading ? "排队发送" : "发送"} title={loading ? "排队发送" : "发送"} onClick={() => void send()}><Send24Filled /></button></div></div>
    </form>} />
    <SelUiDialog id="ai-desktop-automatic-test" open={Boolean(automaticTesting.dialog)} title={text.blocked} kicker="AUTOMATIC TEST" dismissible size="compact" onRequestClose={() => automaticTesting.setDialog(null)}>{automaticTesting.dialog && <><ul className="seldialog-checks">{automaticTesting.dialog.checks.map((check) => <li className={check.status} key={check.id}><i /><span><strong>{check.label}</strong><small>{check.detail}</small></span></li>)}</ul><div className="seldialog-actions"><button data-sel-action="primary" onClick={() => automaticTesting.setDialog(null)}>{text.close}</button></div></>}</SelUiDialog>
  </>;
}
