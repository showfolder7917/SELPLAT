import { useEffect, useRef, useState } from "react";

import type { CodexStreamEventOutDto, ManagedExecutionModeValue, SendMessageInDto } from "../../../../contracts/system/desktop/index";
import { applyCodexStreamEvent, clearStoredChat, createAssistantMessage, readStoredChat, writeStoredChat, type ComposerAttachment, type Message } from "./chat-message";

/** 主 Codex 会话的消息、thread 恢复、流式分卡和本地持久化。 */
export function useCodexConversation() {
  const [executionMode, setExecutionMode] = useState<ManagedExecutionModeValue>("conversation-managed");
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [chatHydrated, setChatHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const chatRef = useRef<HTMLElement>(null);
  const activeAssistantIdRef = useRef<number | null>(null);
  const activeTurnIdRef = useRef<string | null>(null);
  const completedTurnIdsRef = useRef<Set<string>>(new Set());
  const turnMessageIdsRef = useRef<Map<string, number>>(new Map());
  const messageIdSequenceRef = useRef(0);
  const activeManagedModeRef = useRef<ManagedExecutionModeValue>("conversation-managed");
  const flushStreamEventsRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    messageIdSequenceRef.current = Math.max(messageIdSequenceRef.current, ...messages.map((message) => message.id), 0);
  }, [messages]);

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) {
      setChatHydrated(true);
      return;
    }
    void desktop.getActiveCodexSession().then((session) => {
      setActiveThreadId(session.threadId);
      if (!session.threadId) {
        clearStoredChat();
        return;
      }
      const stored = readStoredChat(session.threadId);
      if (!stored) return;
      setMessages(stored.messages);
      setExecutionMode(stored.executionMode);
    }).finally(() => setChatHydrated(true));
  }, []);

  useEffect(() => {
    if (!chatHydrated || !activeThreadId) return;
    const timer = window.setTimeout(() => {
      const persistentMessages = messages.map(({ attachments: _attachments, ...message }) => ({ ...message, streaming: false }));
      writeStoredChat(activeThreadId, executionMode, persistentMessages);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [activeThreadId, chatHydrated, executionMode, messages]);

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;
    const queued: Array<{ messageId: number; event: CodexStreamEventOutDto }> = [];
    let animationFrame = 0;
    const appendAssistantCard = () => {
      const previousAssistantId = activeAssistantIdRef.current;
      const messageId = messageIdSequenceRef.current + 1;
      messageIdSequenceRef.current = messageId;
      activeAssistantIdRef.current = messageId;
      setMessages((current) => [
        ...current.map((message) => message.id === previousAssistantId ? { ...message, streaming: false, streamTerminal: true } : message),
        createAssistantMessage(messageId, activeManagedModeRef.current),
      ]);
      return messageId;
    };
    const flush = () => {
      animationFrame = 0;
      const events = queued.splice(0);
      setMessages((current) => events.reduce(
        (next, entry) => next.map((message) => message.id === entry.messageId ? applyCodexStreamEvent(message, entry.event) : message),
        current,
      ));
    };
    const routeMessageId = (event: CodexStreamEventOutDto) => {
      const currentMessageId = activeAssistantIdRef.current;
      if (currentMessageId === null) return null;
      if (event.type === "managed-execution" && event.managedExecution) {
        const beginsNextTurn = (event.managedExecution.status === "started" || event.managedExecution.status === "continuing")
          && activeTurnIdRef.current !== null
          && completedTurnIdsRef.current.has(activeTurnIdRef.current);
        if (beginsNextTurn) {
          flush();
          activeTurnIdRef.current = null;
          return appendAssistantCard();
        }
        return currentMessageId;
      }
      const existingMessageId = turnMessageIdsRef.current.get(event.turnId);
      if (existingMessageId !== undefined) return existingMessageId;
      if (event.type !== "turn-started") return currentMessageId;
      if (activeTurnIdRef.current !== null) flush();
      const messageId = activeTurnIdRef.current === null ? currentMessageId : appendAssistantCard();
      activeTurnIdRef.current = event.turnId;
      turnMessageIdsRef.current.set(event.turnId, messageId);
      return messageId;
    };
    flushStreamEventsRef.current = flush;
    const unsubscribe = desktop.onCodexStreamEvent((event) => {
      const messageId = routeMessageId(event);
      if (messageId === null) return;
      queued.push({ messageId, event });
      if (event.type === "turn-completed") completedTurnIdsRef.current.add(event.turnId);
      if (!animationFrame) animationFrame = window.requestAnimationFrame(flush);
    });
    return () => {
      unsubscribe();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      flushStreamEventsRef.current = () => undefined;
    };
  }, []);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = (request: SendMessageInDto) => window.desktop?.sendMessage(request);
  const discardChat = () => window.desktop?.newChat();
  const cancel = () => window.desktop?.cancel();

  return {
    executionMode, setExecutionMode, messages, setMessages, activeThreadId, setActiveThreadId, input, setInput,
    attachments, setAttachments, loading, setLoading,
    chatRef, activeAssistantIdRef, activeTurnIdRef, completedTurnIdsRef, turnMessageIdsRef, messageIdSequenceRef,
    activeManagedModeRef, flushStreamEventsRef, sendMessage, discardChat, cancel,
  };
}
