import { useEffect, useState } from "react";

import type { PersonaConversationMessageOutDto, PersonaConversationOutDto } from "../../../../contracts/system/desktop/index";
import type { ComposerAttachment } from "./chat-message";
import { projectPersonaConversation } from "./realtime-conversation";

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
  const [attachmentPreviewErrors, setAttachmentPreviewErrors] = useState<Record<string, string>>({});
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
        .then((value) => { if (active && !receivedInternalUpdate && value) setSharedInternalMessages(projectPersonaConversation(value.messages).internal); })
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
        setSharedInternalMessages(projectPersonaConversation(value.messages).internal);
      }
    });
    return () => { active = false; removeListener?.(); };
  }, [personaId]);

  useEffect(() => {
    let active = true;
    const messages = [...conversation.messages, ...sharedInternalMessages];
    const attachmentIds = [...new Set(messages.flatMap((message) => message.attachmentIds || []))];
    if (!attachmentIds.length) return () => { active = false; };
    void Promise.all(attachmentIds.reduce<string[][]>((groups, id, index) => {
      if (index % 5 === 0) groups.push([]);
      groups.at(-1)!.push(id);
      return groups;
    }, []).map((ids) => window.desktop?.readAttachmentPreviews(ids))).then((groups) => {
      if (!active) return;
      const previews = groups.flatMap((group) => group || []);
      const readable = new Map(previews.filter((item) => item.status === "ready").map((item) => [item.id, item]));
      const unreadable = new Map(previews.filter((item) => item.status === "unavailable").map((item) => [item.id, item.reason]));
      setAttachmentPreviews(Object.fromEntries(messages.map((message) => [message.messageId,
        (message.attachmentIds || []).flatMap((id) => {
          const preview = readable.get(id);
          return preview ? [{ id: preview.id, name: preview.name, dataUrl: preview.dataUrl }] : [];
        }),
      ])));
      setAttachmentPreviewErrors(Object.fromEntries(messages.flatMap((message) => {
        const reason = (message.attachmentIds || []).map((id) => unreadable.get(id)).find(Boolean);
        return reason ? [[message.messageId, attachmentPreviewError(reason)]] : [];
      })));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [conversation.messages, sharedInternalMessages]);

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
    pendingMessage, setPendingMessage, attachmentPreviews, setAttachmentPreviews, attachmentPreviewErrors, setAttachmentPreviewErrors, sending, setSending,
    sharedInternalMessages, newConversationBusy, error, setError, startNewConversation,
  };
}

function attachmentPreviewError(reason: string): string {
  return reason === "not-found" || reason === "file-unavailable"
    ? "附件已被清理，当前无法读取预览。"
    : reason === "invalid-file" ? "附件文件不是有效 PNG，当前无法读取预览。"
      : "附件标识无效，当前无法读取预览。";
}
