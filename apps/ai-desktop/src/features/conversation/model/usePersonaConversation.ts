import { useEffect, useState } from "react";

import type { PersonaConversationOutDto } from "../../../../contracts/system/desktop/index";
import type { ComposerAttachment } from "./chat-message";

function emptyConversation(personaId: string): PersonaConversationOutDto {
  return { ownerPersonaId: personaId, conversationId: null, messages: [], updatedAt: new Date(0).toISOString() };
}

function readableDesktopError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/^Error invoking remote method '[^']+':\s*/, "");
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
  const [newConversationBusy, setNewConversationBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setConversation(emptyConversation(personaId));
    void window.desktop?.getPersonaConversation(personaId)
      .then((value) => { if (active && value) setConversation(value); })
      .catch((reason) => { if (active) setError(readableDesktopError(reason, "无法读取人物会话。")); });
    return () => { active = false; };
  }, [personaId]);

  const startNewConversation = async () => {
    if (newConversationBusy) return;
    setNewConversationBusy(true);
    setError("");
    try {
      const value = await window.desktop?.newPersonaConversation(personaId);
      if (!value) throw new Error("新建人物会话服务没有返回结果。");
      setConversation(value);
      setAttachments([]);
    } catch (reason) {
      setError(readableDesktopError(reason, "无法新建人物会话。"));
    } finally {
      setNewConversationBusy(false);
    }
  };

  return { personaId, conversation, setConversation, attachments, setAttachments, newConversationBusy, error, setError, startNewConversation };
}
