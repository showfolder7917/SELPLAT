import { useEffect, useState } from "react";

import type { PersonaConversationMessageOutDto, PersonaConversationOutDto } from "../../../../contracts/system/desktop/index";
import type { ComposerAttachment } from "./chat-message";

function emptyConversation(personaId: string): PersonaConversationOutDto {
  return { ownerPersonaId: personaId, conversationId: null, messages: [], updatedAt: new Date(0).toISOString() };
}

function readableDesktopError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/^Error invoking remote method '[^']+':\s*/, "");
}

export interface PersonaPendingMessage {
  messageId: string;
  sequenceNumber?: number;
  content: string;
  attachments: ComposerAttachment[];
  failed: boolean;
  createdAt: string;
}

/**
 * 所有人物共用的页面会话控制器。
 *
 * 新手阅读顺序：
 * 1. personaId 决定当前页面在和谁对话，例如 han-li 或 nangong-wan。
 * 2. 页面加载时通过统一 Desktop API 从数据库读取这个人物的当前会话。
 * 3. “新建会话”只归档旧会话并换成新的空会话，不会删除历史记录。
 * 4. 附件和错误属于当前页面临时状态，不写进人物会话主表。
 */
export function usePersonaConversation(personaId: string) {
  const [conversation, setConversation] = useState<PersonaConversationOutDto>(() => emptyConversation(personaId));
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  // 发送中消息属于人物会话控制器；切换页面只卸载视图，不再丢失消息、失败状态或附件预览。
  const [pendingMessage, setPendingMessage] = useState<PersonaPendingMessage | null>(null);
  const [attachmentPreviews, setAttachmentPreviews] = useState<Record<string, ComposerAttachment[]>>({});
  const [sending, setSending] = useState(false);
  // 南宫婉页面读取韩立会话中唯一保存的内部研讨消息，不复制数据库记录。
  const [sharedInternalMessages, setSharedInternalMessages] = useState<PersonaConversationMessageOutDto[]>([]);
  const [newConversationBusy, setNewConversationBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let receivedOwnUpdate = false;
    let receivedInternalUpdate = false;
    setConversation(emptyConversation(personaId));
    const desktop = window.desktop;
    void desktop?.getPersonaConversation(personaId)
      .then((value) => { if (active && !receivedOwnUpdate && value) setConversation(value); })
      .catch((reason) => { if (active) setError(readableDesktopError(reason, "无法读取人物会话。")); });
    if (personaId === "nangong-wan") {
      void desktop?.getPersonaConversation("han-li")
        .then((value) => { if (active && !receivedInternalUpdate && value) setSharedInternalMessages(internalMessages(value.messages)); })
        .catch((reason) => { if (active) setError(readableDesktopError(reason, "无法读取内部研讨消息。")); });
    }
    const removeListener = desktop?.onPersonaConversationChanged((value) => {
      if (!active || value.ownerPersonaId !== "han-li") return;
      if (personaId === "han-li") {
        receivedOwnUpdate = true;
        setConversation((current) => ({ ...value, contextReadStats: value.contextReadStats || current.contextReadStats }));
      }
      if (personaId === "nangong-wan") {
        receivedInternalUpdate = true;
        setSharedInternalMessages(internalMessages(value.messages));
      }
    });
    return () => { active = false; removeListener?.(); };
  }, [personaId]);

  const startNewConversation = async () => {
    if (newConversationBusy || sending) return;
    setNewConversationBusy(true);
    setError("");
    try {
      const value = await window.desktop?.newPersonaConversation(personaId);
      if (!value) throw new Error("新建人物会话服务没有返回结果。");
      setConversation(value);
      setAttachments([]);
      setPendingMessage(null);
      setAttachmentPreviews({});
    } catch (reason) {
      setError(readableDesktopError(reason, "无法新建人物会话。"));
    } finally {
      setNewConversationBusy(false);
    }
  };

  return {
    personaId, conversation, setConversation, attachments, setAttachments,
    pendingMessage, setPendingMessage, attachmentPreviews, setAttachmentPreviews, sending, setSending,
    sharedInternalMessages, newConversationBusy, error, setError, startNewConversation,
  };
}

function internalMessages(messages: PersonaConversationMessageOutDto[]): PersonaConversationMessageOutDto[] {
  // 历史判断报告仍保留原始记录，但它不是人物说出的对话，不再混入聊天。
  return messages.filter((message) => message.messageId.startsWith("internal:") && !message.messageId.endsWith(":assessment"));
}
