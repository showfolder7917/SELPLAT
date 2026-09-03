import { useEffect, useMemo } from "react";

import type { ConversationQueueItemOutDto, LocaleValue, ManagedExecutionModeValue, SandboxModeValue, WorkspaceStateOutDto } from "../../../../contracts/system/desktop/index";
import type { useCollaborationWorkspace } from "../../collaboration/model/useCollaborationWorkspace";
import { clearStoredChat, createAssistantMessage, createUserMessage, managedModeForCommand, type Message } from "./chat-message";
import { useAutomaticTesting } from "../../testing/model/useAutomaticTesting";
import { useCodexConversation } from "./useCodexConversation";
import { useCodexInteractionRequests } from "./useCodexInteractionRequests";
import { useConversationDispatch } from "./useConversationDispatch";

type CodexWorkspaceOptions = {
  locale: LocaleValue;
  sandboxMode: SandboxModeValue;
  attachmentLabel: string;
  automaticTestLabel: string;
  signedOutMessage: string;
  browserOpenedMessage: string;
  workspaces: WorkspaceStateOutDto | null;
  collaboration: ReturnType<typeof useCollaborationWorkspace>;
  onOpenSettings: () => void;
  onTrustedCommandChanged: () => void;
  onAuditChanged: () => void;
};

function readableDesktopError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/^Error invoking remote method '[^']+':\s*/, "");
}

/** 主会话 Feature 组合流式会话、发送队列、审批和自动测试，Application 不再参与消息状态迁移。 */
export function useCodexWorkspace(options: CodexWorkspaceOptions) {
  const conversation = useCodexConversation();
  const {
    executionMode, setExecutionMode, messages, setMessages, setActiveThreadId, input, setInput, attachments,
    setAttachments, loading, setLoading, activeAssistantIdRef, activeTurnIdRef, completedTurnIdsRef,
    turnMessageIdsRef, messageIdSequenceRef, activeManagedModeRef, flushStreamEventsRef, sendMessage, discardChat,
    cancel: cancelCodex,
  } = conversation;
  const interaction = useCodexInteractionRequests({
    browserOpenedMessage: options.browserOpenedMessage,
    onError: (message) => dispatch.setError(message),
    onLogout: () => { activeAssistantIdRef.current = null; setMessages([]); },
    onTrustedCommandChanged: options.onTrustedCommandChanged,
  });
  const dispatch = useConversationDispatch(options.locale, options.sandboxMode, options.automaticTestLabel, (messageId) => {
    setMessages((current) => current.map((item) => item.id === messageId ? { ...item, actionTriggered: true } : item));
  });
  const automaticTesting = useAutomaticTesting({
    locale: options.locale,
    loading,
    approval: interaction.approval,
    messages,
    discardQueued: dispatch.discardAutomaticQueued,
    enqueueTest: dispatch.enqueueAutomaticTest,
  });
  const nextId = useMemo(() => messages.reduce((maximum, item) => Math.max(maximum, item.id), 0) + 1, [messages]);
  const latestManagedAssistantId = useMemo(() => messages.reduce((latest, message) => (
    message.role === "assistant" && message.managedMode !== undefined ? message.id : latest
  ), null as number | null), [messages]);

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
    if (!message && attachmentIds.length === 0) return;
    if ((loading || dispatch.state.activeTask) && !queued) {
      await dispatch.enqueue({ request: { message, locale: options.locale, sandboxMode: options.sandboxMode, attachmentIds, executionMode: mode }, displayText });
      setInput("");
      setAttachments([]);
      return;
    }
    if (loading) return;
    if (!interaction.status.account.authenticated) {
      options.onOpenSettings();
      interaction.setLoginHint(options.signedOutMessage);
      return;
    }
    if (override?.sourceMessageId !== undefined) setMessages((current) => current.map((item) => item.id === override.sourceMessageId ? { ...item, actionTriggered: true } : item));
    setExecutionMode(mode);
    const userId = Math.max(nextId, messageIdSequenceRef.current + 1);
    const assistantId = userId + 1;
    messageIdSequenceRef.current = assistantId;
    const userMessage = createUserMessage(userId, displayText || options.attachmentLabel, sentAttachments);
    activeTurnIdRef.current = null;
    completedTurnIdsRef.current = new Set();
    turnMessageIdsRef.current = new Map();
    activeManagedModeRef.current = mode;
    activeAssistantIdRef.current = assistantId;
    setMessages((current) => [...current, userMessage, createAssistantMessage(assistantId, mode, userMessage.messageId)]);
    setInput("");
    setAttachments([]);
    setLoading(true);
    try {
      const response = await sendMessage({ message, locale: options.locale, sandboxMode: options.sandboxMode, attachmentIds, executionMode: mode, queueItemId: queued?.id })
        || { text: options.locale === "ja" ? "デスクトップ版でローカル Codex に接続します。" : "桌面版本会在这里返回本地 Codex 的结果。", itemCount: 0 };
      if (response.disposition === "queued") {
        setMessages((current) => current.map((item) => item.id === userId ? { ...item, status: "completed" } : item.id === assistantId ? { ...item, status: "queued", text: "消息已进入等待队列。", streaming: false, streamTerminal: true, streamStatus: "queued" } : item));
        return;
      }
      if (response.threadId) setActiveThreadId(response.threadId);
      flushStreamEventsRef.current();
      const completedAssistantId = activeAssistantIdRef.current || assistantId;
      setMessages((current) => current.map((item) => item.id === userId ? { ...item, status: "completed" } : item.id === completedAssistantId ? { ...item, status: "completed", text: item.text || response.text, streaming: false, streamTerminal: true, streamStatus: "completed" } : item));
      if (automaticTesting.isEnabled() && mode === "task-managed" && "managedStatus" in response && response.managedStatus === "code-verified") void dispatch.enqueueAutomaticTest(completedAssistantId);
    } catch (error) {
      const messageText = readableDesktopError(error, "Codex unavailable");
      const failedAssistantId = activeAssistantIdRef.current || assistantId;
      setMessages((current) => current.map((item) => item.id === userId ? { ...item, status: "failed" } : item.id === failedAssistantId ? { ...item, status: "failed", text: item.text || messageText, streaming: false, streamTerminal: true, streamStatus: "failed", streamError: messageText } : item));
    } finally {
      flushStreamEventsRef.current();
      activeAssistantIdRef.current = null;
      setLoading(false);
      options.onAuditChanged();
      void dispatch.refresh();
    }
  };

  useEffect(() => {
    if (loading || dispatch.state.activeTask || dispatch.queuedSends.length === 0 || !interaction.status.account.authenticated) return;
    void send(undefined, dispatch.queuedSends[0]);
  }, [loading, dispatch.state.activeTask, dispatch.queuedSends, interaction.status.account.authenticated]);

  const submitConfirmedCollaborationTask = async (message: Message) => {
    if (!options.workspaces) throw new Error("协同任务缺少工作区。");
    const task = await options.collaboration.submitConversationTask(message, messages, options.workspaces, options.locale);
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, actionTriggered: true, collaborationTaskId: task?.taskId } : item));
  };

  const startNewTask = async () => {
    try {
      await discardChat();
      activeAssistantIdRef.current = null;
      interaction.setUserInputRequest(null);
      setExecutionMode("conversation-managed");
      setActiveThreadId(null);
      setMessages([]);
      setAttachments([]);
      automaticTesting.reset();
      void dispatch.discardAutomaticQueued();
      clearStoredChat();
      dispatch.setError("");
    } catch (error) {
      dispatch.setError(error instanceof Error ? error.message : "无法丢弃当前 Codex 任务。");
    }
  };

  const cancelActiveTurn = () => {
    void cancelCodex();
    flushStreamEventsRef.current();
    const assistantId = activeAssistantIdRef.current;
    if (assistantId !== null) setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, streaming: false, streamTerminal: true, streamStatus: "interrupted" } : item));
    activeAssistantIdRef.current = null;
    setLoading(false);
  };

  return { conversation, interaction, dispatch, automaticTesting, latestManagedAssistantId, send, startNewTask, cancelActiveTurn, submitConfirmedCollaborationTask };
}
