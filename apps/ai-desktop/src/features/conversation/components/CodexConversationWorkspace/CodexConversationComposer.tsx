/**
 * Codex 会话页面中的“编辑与发送”子模块。
 * 它按顺序显示附件、恢复任务、等待队列、输入框、错误和底部工具栏。
 */

import {
  // 截图等待图标：截图进行中替代普通截图图标并显示旋转反馈。
  ArrowClockwise24Regular,
  // 附件移除图标：从本轮待发送图片中删除指定图片。
  Dismiss20Regular,
  // 隐藏截图图标：表示截图前先暂时隐藏 AI Desktop。
  EyeOff24Regular,
  // 当前屏幕截图图标：表示保留 AI Desktop 窗口的普通截图。
  Screenshot24Regular,
  // 发送图标：提交当前文字和附件，忙碌时则进入等待队列。
  Send24Filled,
  // 沙箱图标：在工具栏标识当前文件访问模式。
  ShieldCheckmark24Regular,
  // 停止图标：中断当前正在流式输出的 Codex 任务。
  Stop24Filled,
} from "@fluentui/react-icons";
// 表单事件是纯类型，用于阻止浏览器默认提交并转交给会话控制器。
import type { FormEvent } from "react";
// 会话容器来自 SEL UI，用于连接统一提交事件和实际编辑区。
import { SelUiConversation } from "../SelUiConversation";
// 执行模式文案转换器用于显示当前托管阶段。
import { managedModeLabel } from "../StreamDetails";
// 会话页参数与文案是纯类型，让本子模块复用父页面公开边界。
import type { CodexConversationComposerProps } from "../CodexConversationWorkspace.types";

/** 会话编辑区：使用具名方法连接全部业务操作，避免 JSX 内嵌入异步流程。 */
export function CodexConversationComposer(props: CodexConversationComposerProps) {
  const { locale, sandboxMode, controller, screenshot, text } = props;
  const { conversation, dispatch, automaticTesting } = controller;
  const { executionMode, attachments, setAttachments, input, setInput, loading } = conversation;
  const { state: dispatchState, error: dispatchError, queuedSends } = dispatch;

  /** 发送表单：阻止页面刷新，并将当前输入交给会话控制器。 */
  function submitConversation(event?: FormEvent) {
    event?.preventDefault();
    void controller.send();
  }

  /** 附件移除：仅从待发送列表中删除目标图片，不删除已发送历史。 */
  function removeAttachment(attachmentId: string) {
    setAttachments((current) => current.filter((item) => item.id !== attachmentId));
  }

  /** 输入更新：保存客户正在编辑但尚未发送的文字。 */
  function changeInput(value: string) {
    setInput(value);
  }

  /** 恢复任务：让发送队列继续处理上次未完成的任务。 */
  function recoverInterruptedTask() {
    void dispatch.recover();
  }

  /** 放弃恢复：丢弃上次的可恢复任务，保留本页其他消息。 */
  function discardInterruptedTask() {
    void dispatch.discardRecovery();
  }

  /** 队列补充：将待发送项合并到当前正在运行的任务。 */
  function supplementRunningTask(queueItemId: string) {
    void dispatch.supplement(queueItemId);
  }

  /** 队列移除：取消指定待发送项，不影响正在运行的任务。 */
  function discardQueuedMessage(queueItemId: string) {
    void dispatch.discard(queueItemId);
  }

  /** 打开录屏设置：引导客户在操作系统中授予截图所需权限。 */
  function openScreenRecordingSettings() {
    void screenshot.openScreenRecordingSettings();
  }

  /** 重启恢复权限：在 macOS 录屏权限变更后重启 AI Desktop。 */
  function restartForScreenRecordingPermission() {
    void screenshot.restartForScreenRecordingPermission();
  }

  /** 自动测试开关：调用预检后切换自动测试状态。 */
  function toggleAutomaticTesting() {
    void automaticTesting.toggle();
  }

  /** 当前窗口截图：保留 AI Desktop 可见状态并开始捕获。 */
  function captureCurrentScreen() {
    void screenshot.startScreenshot();
  }

  /** 隐藏窗口截图：捕获前暂时隐藏 AI Desktop，避免挡住目标界面。 */
  function captureScreenWithoutDesktop() {
    void screenshot.startScreenshot(true);
  }

  const showsRecoverableTask = dispatchState.activeTask?.status === "recoverable";
  const showsBackgroundTask = dispatchState.activeTask?.status === "running" && !loading;
  const showsScreenPermissionActions = screenshot.screenRecordingSettingsAvailable
    || screenshot.screenRecordingRestartRequired;
  const currentScreenshotIcon = screenshot.screenshotMode === "current"
    ? <ArrowClockwise24Regular className="screenshot-spinner" />
    : <Screenshot24Regular />;
  const hiddenScreenshotIcon = screenshot.screenshotMode === "hidden"
    ? <ArrowClockwise24Regular className="screenshot-spinner" />
    : <EyeOff24Regular />;

  const composer = (
    <form className="selconversation-composer" onSubmit={submitConversation}>
      {/* 待发送附件区：允许客户在发送前确认或移除图片。 */}
      {attachments.length > 0 && (
        <div className="composer-attachments">
          {attachments.map((attachment) => (
            <figure key={attachment.id}>
              <img src={attachment.dataUrl} alt={attachment.name} />
              <figcaption>{text.attachment}</figcaption>
              <button type="button" title={text.remove} onClick={() => removeAttachment(attachment.id)}>
                <Dismiss20Regular />
              </button>
            </figure>
          ))}
        </div>
      )}

      {/* 任务恢复区：只在后端找到上次可恢复任务时显示。 */}
      {showsRecoverableTask && (
        <div className="dispatch-recovery" role="status">
          <span>发现上次未完成的任务</span>
          <div>
            <button type="button" onClick={recoverInterruptedTask}>继续执行</button>
            <button type="button" onClick={discardInterruptedTask}>放弃任务</button>
          </div>
        </div>
      )}
      {showsBackgroundTask && (
        <div className="dispatch-background" role="status">
          任务正在后台执行，完成后将继续处理等待队列。
        </div>
      )}

      {/* 等待队列：按发送顺序显示尚未开始的客户请求。 */}
      {queuedSends.length > 0 && (
        <div className="dispatch-queue" aria-label="等待队列">
          {queuedSends.map((item, index) => (
            <div key={item.id} className="dispatch-queue-item">
              <span><b>{index + 1}</b>{item.displayText}</span>
              <div>
                {dispatchState.activeTask?.status === "running" && (
                  <button type="button" onClick={() => supplementRunningTask(item.id)}>补充到当前任务</button>
                )}
                <button type="button" onClick={() => discardQueuedMessage(item.id)}>移除</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 文字输入区：接收客户任务，并把粘贴的图片交给截图功能。 */}
      <textarea
        ref={screenshot.composerRef}
        className="selconversation-input"
        data-sel-conversation-input
        value={input}
        onChange={(event) => changeInput(event.target.value)}
        onPaste={screenshot.onPaste}
        placeholder={text.placeholder}
      />

      {dispatchError && <div className="composer-error" role="alert"><span>{dispatchError}</span></div>}
      {screenshot.screenshotError && (
        <div className="composer-error" role="alert">
          <span>{screenshot.screenshotError}</span>
          {showsScreenPermissionActions && (
            <div className="composer-error-actions">
              {screenshot.screenRecordingSettingsAvailable && (
                <button type="button" onClick={openScreenRecordingSettings}>{text.openSettings}</button>
              )}
              {screenshot.screenRecordingRestartRequired && (
                <button type="button" className="primary" disabled={screenshot.screenRecordingRestarting} onClick={restartForScreenRecordingPermission}>
                  {locale === "ja" ? "AI Desktop を再起動" : "重启 AI Desktop"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 底部工具栏：左侧显示运行模式和截图，右侧显示停止与发送。 */}
      <div className="selconversation-footer">
        <div className="composer-tools" aria-label="输入工具栏">
          <div className="composer-tool-group composer-context-tools">
            <span><ShieldCheckmark24Regular />{sandboxMode}</span>
            <span className="execution-mode-badge">{managedModeLabel(executionMode, locale)}</span>
            {queuedSends.length > 0 && <span className="queued-send-count">待发送 {queuedSends.length}</span>}
          </div>
          <div className="composer-tool-group composer-automation-tools">
            <button
              type="button"
              role="switch"
              aria-checked={automaticTesting.enabled}
              className="selswitch composer-automatic-test-switch"
              disabled={automaticTesting.checking || (loading && !automaticTesting.enabled)}
              onClick={toggleAutomaticTesting}
            >
              <span>{text.automaticTest}</span>
              <i className="selswitch-track" aria-hidden="true"><i className="selswitch-thumb" /></i>
            </button>
            {(automaticTesting.checking || automaticTesting.enabled) && (
              <span className="automatic-test-status" role="status">
                {automaticTesting.checking ? text.checking : text.readyTest}
              </span>
            )}
          </div>
          <div className="composer-tool-group composer-attachment-tools">
            <button type="button" className="screenshot-button" aria-label={text.screenshot} data-sel-tooltip={text.screenshot} data-sel-tooltip-mode="always" disabled={screenshot.screenshotBusy} onClick={captureCurrentScreen}>
              {currentScreenshotIcon}
            </button>
            <button type="button" className="screenshot-button" aria-label={text.hiddenScreenshot} data-sel-tooltip={text.hiddenScreenshot} data-sel-tooltip-mode="always" disabled={screenshot.screenshotBusy} onClick={captureScreenWithoutDesktop}>
              {hiddenScreenshotIcon}
            </button>
          </div>
        </div>
        <div className="selconversation-actions">
          {loading && (
            <button type="button" className="stop-action" aria-label="停止当前任务" title="停止当前任务" onClick={controller.cancelActiveTurn}>
              <Stop24Filled />
            </button>
          )}
          <button type="button" className="selconversation-action" aria-label={loading ? "排队发送" : "发送"} title={loading ? "排队发送" : "发送"} onClick={() => submitConversation()}>
            <Send24Filled />
          </button>
        </div>
      </div>
    </form>
  );

  return <SelUiConversation id="selConversationCodexId" onSubmit={() => submitConversation()} timeline={null} composer={composer} />;
}
