/**
 * Codex 会话页面中的“消息时间线”子模块。
 * 它显示空会话引导、客户消息、Codex 回复、执行过程和协作阶段操作。
 */

// 空会话图标来自 Fluent UI，用于让客户快速识别主 Codex 工作区。
import { Code24Regular } from "@fluentui/react-icons";
// 执行模式值是纯类型，用于约束托管阶段按钮可传回的模式。
import type { ManagedExecutionModeValue } from "../../../../../contracts/system/desktop/index";
// 账号登录操作来自桌面壳公开入口，仅在空会话且未登录时显示。
import { ChatGPTLoginAction } from "../../../shell";
// 对话消息图片负责把已发送附件统一接入公共大图预览。
import { ConversationMessageImage } from "../ConversationMessageImage";
// 主会话消息类型来自对话模型，用于限定托管操作的目标消息。
import type { Message } from "../../model/chat-message";
// 结构化追问面板负责收集 Codex 继续执行前需要的客户答案。
import { CodexUserInputPanel } from "../CodexUserInputPanel";
// 协作状态链负责显示某条 Codex 回复关联任务的真实执行阶段。
import { CollaborationStatusChain } from "../CollaborationStatusChain";
// 托管阶段操作负责把已确认回复推进到需求、任务或测试阶段。
import { ManagedStageAction } from "../ManagedStageAction";
// 格式化消息视图负责用 Markdown 安全渲染 Codex 回复。
import { MarkdownMessage } from "../MarkdownMessage";
// 执行过程视图负责展开工具、计划和流式状态。
import { StreamDetails } from "../StreamDetails";
// 会话页参数与文案是纯类型，让本子模块复用父页面公开边界。
import type { CodexConversationTimelineProps } from "../CodexConversationWorkspace.types";

/** 消息头部文字：把客户消息发送状态转成简短可读标记。 */
function messageHeader(message: Message): string {
  if (message.role === "assistant") return "CODEX";
  if (message.status === "sending") return "YOU · 发送中";
  if (message.status === "failed") return "YOU · 发送失败";
  return "YOU";
}

/** 消息时间线：按发生顺序渲染消息，并把交互操作收敛为具名方法。 */
export function CodexConversationTimeline(props: CodexConversationTimelineProps) {
  const { locale, controller, collaboration, text } = props;
  const { conversation, interaction, latestManagedAssistantId } = controller;
  const { executionMode, setExecutionMode, messages, chatRef, activeAssistantIdRef } = conversation;
  const {
    userInputRequest,
    userInputAnswers,
    setUserInputAnswers,
    customAnswerIds,
    setCustomAnswerIds,
    confirmedQuestionIds,
    userInputSubmitting,
    loginHint,
  } = interaction;

  /** 登录操作：把客户点击交给会话控制器，页面不直接调用桌面桥。 */
  function loginWithChatGPT() {
    void interaction.login();
  }

  /** 协作任务重试：把关联任务标识交给协作控制器继续执行。 */
  async function retryCollaborationTask(taskId: string): Promise<void> {
    await collaboration.continueTask(taskId);
  }

  /** 预设答案选择：保存选中文本，并退出该问题的自定义输入模式。 */
  function chooseUserInputAnswer(questionId: string, value: string) {
    setCustomAnswerIds((current) => {
      const next = new Set(current);
      next.delete(questionId);
      return next;
    });
    setUserInputAnswers((current) => ({ ...current, [questionId]: value }));
  }

  /** 自定义答案选择：清空旧预设值，等待客户输入真实答案。 */
  function chooseCustomUserInput(questionId: string) {
    setCustomAnswerIds((current) => new Set(current).add(questionId));
    setUserInputAnswers((current) => ({ ...current, [questionId]: "" }));
  }

  /** 自定义答案输入：按问题标识保存客户正在编辑的文本。 */
  function changeCustomUserInput(questionId: string, value: string) {
    setUserInputAnswers((current) => ({ ...current, [questionId]: value }));
  }

  /** 答案确认：由会话控制器判断是否已收齐全部问题并提交。 */
  function confirmUserInput(questionId: string) {
    void interaction.submitUserInput(questionId);
  }

  /** 托管阶段推进：协作模式提交真实协作任务，单会话模式发送确认命令。 */
  async function advanceManagedStage(mode: ManagedExecutionModeValue, label: string, message: Message) {
    const shouldCreateCollaborationTask = collaboration.collaborationMode
      && message.managedMode === "conversation-managed";
    if (shouldCreateCollaborationTask) {
      try {
        await controller.submitConfirmedCollaborationTask(message);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "无法提交协同任务。";
        controller.dispatch.setError(errorMessage);
      }
      return;
    }
    void controller.send({
      // 确认命令：后端使用独立 1 推进已展示给客户的下一阶段。
      message: "1",
      // 可见文字：消息时间线显示客户刚刚确认的动作。
      displayText: label,
      // 执行模式：后端据此进入需求、任务或测试托管阶段。
      mode,
      // 来源消息：稳定关联这次确认所属的 Codex 回复。
      sourceMessageId: message.id,
    });
  }

  return (
    <section ref={chatRef} className="selconversation-timeline">
      {messages.length === 0 && (
        <div className="dev-empty">
          <div className="dev-orb"><Code24Regular /></div>
          <h1>{locale === "ja" ? "何を作りますか？" : "今天要构建什么？"}</h1>
          <p>{interaction.status.account.authenticated ? text.ready : text.signedOut}</p>
          {!interaction.status.account.authenticated && (
            <ChatGPTLoginAction label={text.signIn} onLogin={loginWithChatGPT} />
          )}
          {!interaction.status.account.authenticated && loginHint && (
            <em className="dev-login-hint">{loginHint}</em>
          )}
        </div>
      )}

      {messages.map((message) => {
        const collaborationTaskId = message.collaborationTaskId;
        const messageTask = collaborationTaskId
          ? collaboration.state?.tasks.find((task) => task.taskId === collaborationTaskId) || null
          : null;
        const isAssistantMessage = message.role === "assistant";
        const showsUserInput = isAssistantMessage
          && message.id === activeAssistantIdRef.current
          && Boolean(userInputRequest);
        const showsManagedStage = isAssistantMessage
          && !message.streamError
          && (message.actionTriggered || message.id === latestManagedAssistantId);

        return (
          <article
            key={message.id}
            className="selconversation-message"
            data-role={message.role}
            data-streaming={message.streaming || undefined}
          >
            <header>{messageHeader(message)}</header>
            <div className="selconversation-message-body">
              {message.attachments?.length ? (
                <div className="selconversation-message-attachments">
                  {message.attachments.map((attachment) => (
                    <ConversationMessageImage key={attachment.id} src={attachment.dataUrl} alt={attachment.name} />
                  ))}
                </div>
              ) : null}
              {message.text && (
                isAssistantMessage
                  ? <MarkdownMessage text={message.text} />
                  : <div className="message-text">{message.text}</div>
              )}
              {isAssistantMessage && <StreamDetails message={message} locale={locale} />}
              {isAssistantMessage && messageTask && (
                <CollaborationStatusChain task={messageTask} locale={locale} onRetry={retryCollaborationTask} />
              )}
              {showsUserInput && userInputRequest && (
                <CodexUserInputPanel
                  request={userInputRequest}
                  answers={userInputAnswers}
                  customAnswerIds={customAnswerIds}
                  confirmedQuestionIds={confirmedQuestionIds}
                  locale={locale}
                  submitting={userInputSubmitting}
                  onChoose={chooseUserInputAnswer}
                  onChooseCustom={chooseCustomUserInput}
                  onCustomChange={changeCustomUserInput}
                  onConfirm={confirmUserInput}
                />
              )}
              {showsManagedStage && (
                <ManagedStageAction
                  message={message}
                  locale={locale}
                  actionable={message.id === latestManagedAssistantId}
                  activeMode={executionMode}
                  onReturn={setExecutionMode}
                  onAdvance={(mode, label) => void advanceManagedStage(mode, label, message)}
                />
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}
