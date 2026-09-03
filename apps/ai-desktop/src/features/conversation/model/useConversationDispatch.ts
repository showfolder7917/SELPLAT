import { useEffect, useState } from "react";

import type { ConversationDispatchStateOutDto, EnqueueMessageInDto, LocaleValue, SandboxModeValue } from "../../../../contracts/system/desktop/index";

const EMPTY_STATE: ConversationDispatchStateOutDto = { activeTask: null, queue: [] };

function readableDesktopError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/^Error invoking remote method '[^']+':\s*/, "");
}

/** 串行发送队列、后台任务恢复和自动测试排队的唯一状态所有者。 */
export function useConversationDispatch(locale: LocaleValue, sandboxMode: SandboxModeValue, automaticTestLabel: string, onAutomaticSourceTriggered: (messageId: number) => void) {
  const [state, setState] = useState<ConversationDispatchStateOutDto>(EMPTY_STATE);
  const [error, setError] = useState("");

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;
    void desktop.getConversationDispatchState().then(setState);
    return desktop.onConversationDispatchState(setState);
  }, []);

  const refresh = async () => {
    const next = await window.desktop?.getConversationDispatchState();
    if (next) setState(next);
  };

  const enqueue = async (request: EnqueueMessageInDto) => {
    const next = await window.desktop?.enqueueMessage(request);
    if (next) setState(next);
  };

  const discardAutomaticQueued = async () => {
    for (const item of state.queue.filter((candidate) => candidate.automatic)) {
      const next = await window.desktop?.discardQueuedMessage(item.id);
      if (next) setState(next);
    }
  };

  const enqueueAutomaticTest = async (sourceMessageId?: number) => {
    if (state.queue.some((item) => item.automatic)) return;
    if (sourceMessageId !== undefined) onAutomaticSourceTriggered(sourceMessageId);
    await enqueue({
      request: { message: "测试一下", locale, sandboxMode, attachmentIds: [], executionMode: "test-managed" },
      displayText: automaticTestLabel,
      automatic: true,
    });
  };

  const supplement = async (itemId: string) => {
    setError("");
    try {
      const next = await window.desktop?.supplementQueuedMessage(itemId);
      if (next) setState(next);
    } catch (reason) {
      setError(readableDesktopError(reason, "无法补充到当前任务。"));
    }
  };

  const discard = async (itemId: string) => {
    const next = await window.desktop?.discardQueuedMessage(itemId);
    if (next) setState(next);
  };

  const recover = async () => {
    setError("");
    try {
      const next = await window.desktop?.recoverConversationTask();
      if (next) setState(next);
    } catch (reason) {
      setError(readableDesktopError(reason, "无法继续未完成任务。"));
    }
  };

  const discardRecovery = async () => {
    const next = await window.desktop?.discardConversationRecovery();
    if (next) setState(next);
  };

  return {
    state, setState, error, setError, queuedSends: state.queue, refresh, enqueue, discardAutomaticQueued,
    enqueueAutomaticTest, supplement, discard, recover, discardRecovery,
  };
}
