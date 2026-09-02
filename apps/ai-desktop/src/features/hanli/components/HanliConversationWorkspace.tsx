import { type Dispatch, type SetStateAction, useState } from "react";
import { Code24Regular, Dismiss20Regular, EyeOff24Regular, Screenshot24Regular, Send24Filled } from "@fluentui/react-icons";

import type { HanliConversationOutDto, LocaleValue, WorkspaceStateOutDto } from "../../../../contracts/system/desktop/index";
import type { ComposerAttachment } from "../../conversation/model/chat-message";
import { MarkdownMessage } from "../../conversation/components/MarkdownMessage";
import { SelUiConversation } from "../../conversation/components/SelUiConversation";

function readableDesktopError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/^Error invoking remote method '[^']+':\s*/, "");
}

/** 韩立自由讨论沿用统一会话外壳，只暴露讨论能力，不暴露旧托管阶段或工程写入入口。 */
export function HanliConversationWorkspace({ conversation, attachments, workspaces, locale, newConversationBusy, error, onConversation, onAttachments, onScreenshot, onPaste, onError }: {
  conversation: HanliConversationOutDto;
  attachments: ComposerAttachment[];
  workspaces: WorkspaceStateOutDto | null;
  locale: LocaleValue;
  newConversationBusy: boolean;
  error: string;
  onConversation(value: HanliConversationOutDto): void;
  onAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>;
  onScreenshot(hidden: boolean): void;
  onPaste(files: File[]): void;
  onError(message: string): void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ messageId: string; content: string; attachments: ComposerAttachment[]; failed: boolean; createdAt: string } | null>(null);
  const [attachmentPreviews, setAttachmentPreviews] = useState<Record<string, ComposerAttachment[]>>({});
  const send = async () => {
    const message = text.trim() || (attachments.length ? "请结合这些截图和你掌握的客户语义资料，与我讨论这个问题。" : "");
    if (!message || !workspaces || busy) return;
    const clientMessageId = `hanli-message-${crypto.randomUUID()}`;
    const sentAttachments = [...attachments];
    setBusy(true); setText(""); onAttachments([]); onError("");
    setPending({ messageId: clientMessageId, content: message, attachments: sentAttachments, failed: false, createdAt: new Date().toISOString() });
    try {
      const next = await window.desktop?.sendHanliConversationMessage({ clientMessageId, message, attachmentIds: sentAttachments.map((item) => item.id), workspaceState: workspaces, locale });
      if (!next) throw new Error("韩立会话服务未返回结果。");
      if (sentAttachments.length) setAttachmentPreviews((current) => ({ ...current, [clientMessageId]: sentAttachments }));
      onConversation(next); setPending(null);
    } catch (sendError) {
      setPending((current) => current ? { ...current, failed: true } : null);
      onError(readableDesktopError(sendError, "发送给韩立失败。"));
    } finally { setBusy(false); }
  };
  const messages = [...conversation.messages, ...(pending ? [{
    messageId: pending.messageId, sequenceNumber: conversation.messages.length, role: "user" as const, content: pending.content,
    replyToMessageId: null, deliveryStatus: pending.failed ? "failed" as const : "sending" as const,
    attachmentIds: pending.attachments.map((item) => item.id), createdAt: pending.createdAt, completedAt: pending.failed ? new Date().toISOString() : null,
  }] : [])];
  return <SelUiConversation id="selConversationHanLiPersonaId" onSubmit={() => void send()} timeline={<section className="selconversation-timeline hanli-person-chat" aria-label="与韩立自由讨论">
    {messages.length === 0 && <div className="dev-empty"><div className="dev-orb"><Code24Regular /></div><h1>和韩立讨论客户真正需要什么</h1><p>可以直接描述问题。韩立会结合整理后的客户关注点、证据与历史轨迹回答，并只在确有信息缺口时追问。</p></div>}
    {messages.map((message) => { const previews = attachmentPreviews[message.messageId] || (pending?.messageId === message.messageId ? pending.attachments : []); return <article key={message.messageId} className="selconversation-message" data-role={message.role}><header>{message.role === "user" ? `我${message.deliveryStatus === "sending" ? " · 发送中" : message.deliveryStatus === "failed" ? " · 发送失败" : ""}` : message.role === "nangong" ? "南宫婉 · 内部研讨" : "韩立"}</header><div className="selconversation-message-body">{previews.length ? <div className="selconversation-message-attachments">{previews.map((attachment) => <img key={attachment.id} src={attachment.dataUrl} alt={attachment.name} />)}</div> : message.attachmentIds?.length ? <small>已附 {message.attachmentIds.length} 张截图</small> : null}<MarkdownMessage text={message.content} /></div></article>; })}
  </section>} composer={<form className="selconversation-composer hanli-person-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
    {attachments.length > 0 && <div className="selconversation-attachments">{attachments.map((attachment) => <figure key={attachment.id}><img src={attachment.dataUrl} alt={attachment.name} /><figcaption>讨论截图</figcaption><button type="button" aria-label="移除截图" onClick={() => onAttachments((current) => current.filter((item) => item.id !== attachment.id))}><Dismiss20Regular /></button></figure>)}</div>}
    {newConversationBusy && <div role="status">正在关闭当前韩立线程并建立新对话…</div>}
    {error && <div className="composer-error" role="alert"><span>{error}</span></div>}
    <textarea className="selconversation-input" data-sel-conversation-input aria-label="给韩立发送消息" placeholder="描述问题、真实目标或你不确定该怎么问的地方…（可粘贴截图）" value={text} onChange={(event) => setText(event.currentTarget.value)} onPaste={(event) => { const files = Array.from(event.clipboardData.items).filter((item) => item.kind === "file" && item.type.startsWith("image/")).map((item) => item.getAsFile()).filter((file): file is File => file !== null); if (files.length) { event.preventDefault(); onPaste(files); } }} />
    <div className="selconversation-footer"><div className="selconversation-tools"><button type="button" className="screenshot-button" aria-label="截取当前屏幕" onClick={() => onScreenshot(false)}><Screenshot24Regular /></button><button type="button" className="screenshot-button" aria-label="隐藏窗口后截图" onClick={() => onScreenshot(true)}><EyeOff24Regular /></button></div><div className="selconversation-actions"><button type="submit" className="selconversation-action" disabled={newConversationBusy || busy || (!text.trim() && !attachments.length)} aria-label={busy ? "思考中" : "发送给韩立"}><Send24Filled /></button></div></div>
  </form>} />;
}
