import { type Dispatch, type SetStateAction, useState } from "react";
import { Code24Regular, Dismiss20Regular, EyeOff24Regular, Screenshot24Regular, Send24Filled } from "@fluentui/react-icons";

import type { EvolutionStateOutDto, LocaleValue, WorkspaceStateOutDto } from "../../../../contracts/system/desktop/index";
import type { ComposerAttachment } from "../../conversation/model/chat-message";
import { mergeRealtimeConversationTimeline } from "../../conversation/model/realtime-conversation";
import { MarkdownMessage } from "../../conversation/components/MarkdownMessage";
import { SelUiConversation } from "../../conversation/components/SelUiConversation";

function readableDesktopError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/^Error invoking remote method '[^']+':\\s*/, "");
}

/** 人物工作栏把逗号分隔输入统一转换成去重的业务清单。 */
function splitEvolutionList(value: string): string[] {
  return [...new Set(value.split(/[，,；;\\n]/).map((item) => item.trim()).filter(Boolean))];
}

/** 南宫婉沿用韩立主会话的消息区和输入区，只替换人物文案与专项演化发送链路。 */
export function NangongConversationWorkspace({ state, attachments, workspaces, locale, newConversationBusy, error, onState, onAttachments, onScreenshot, onPaste, onError }: { state: EvolutionStateOutDto; attachments: ComposerAttachment[]; workspaces: WorkspaceStateOutDto | null; locale: LocaleValue; newConversationBusy: boolean; error: string; onState(state: EvolutionStateOutDto): void; onAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>; onScreenshot(hidden: boolean): void; onPaste(files: File[]): void; onError(message: string): void }) {
  const [chatText, setChatText] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [topicDraftOpen, setTopicDraftOpen] = useState(false);
  const [topicDraftBusy, setTopicDraftBusy] = useState(false);
  const [topicDraftFeedback, setTopicDraftFeedback] = useState("");
  const [outgoingMessage, setOutgoingMessage] = useState<{ messageId: string; sequenceNumber: number; content: string; attachments: ComposerAttachment[]; failed: boolean; createdAt: string } | null>(null);
  const [attachmentPreviews, setAttachmentPreviews] = useState<Record<string, ComposerAttachment[]>>({});
  const [topicDraft, setTopicDraft] = useState({ title: "", goal: "", scope: "", evidence: "", acceptanceCriteria: "" });
  const updateTopicDraft = (field: keyof typeof topicDraft, value: string) => setTopicDraft((current) => ({ ...current, [field]: value }));
  const update = async (operation: () => Promise<EvolutionStateOutDto> | undefined) => {
    onError("");
    try { const pending = operation(); if (!pending) return; const next = await pending; onState(next); } catch (error) { onError(readableDesktopError(error, "专项演化操作失败。")); }
  };
  const sendChat = async (confirmedMessage?: string) => {
    const message = confirmedMessage?.trim() || chatText.trim() || (attachments.length ? "请调查并分析这些截图中的问题。" : "");
    if (!message || !workspaces || chatBusy) return;
    const sentAttachments = [...attachments];
    const clientMessageId = `nangong-message-${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    // 用户点击发送后立即把文字和图片移入消息区，输入框不再承担后台等待状态。
    setChatBusy(true);
    setChatText("");
    onAttachments([]);
    setOutgoingMessage({ messageId: clientMessageId, sequenceNumber: state.conversation.messages.length, content: message, attachments: sentAttachments, failed: false, createdAt });
    onError("");
    try {
      const next = await window.desktop?.sendNangongConversationMessage({ clientMessageId, message, attachmentIds: sentAttachments.map((item) => item.id), workspaceState: workspaces, locale });
      if (!next) throw new Error("南宫婉会话服务未返回结果。");
      const persisted = next.conversation.messages.find((item) => item.messageId === clientMessageId);
      if (persisted && sentAttachments.length) setAttachmentPreviews((current) => ({ ...current, [persisted.messageId]: sentAttachments }));
      onState(next);
      setOutgoingMessage(null);
    } catch (error) {
      setOutgoingMessage((current) => current ? { ...current, failed: true } : null);
      onError(readableDesktopError(error, "发送给南宫婉失败。"));
    } finally { setChatBusy(false); }
  };
  const convertChat = async () => {
    if (!workspaces || !state.conversation.messages.length) return;
    const title = topicDraft.title.trim();
    const goal = topicDraft.goal.trim();
    const scope = splitEvolutionList(topicDraft.scope);
    const evidence = splitEvolutionList(topicDraft.evidence);
    const acceptanceCriteria = splitEvolutionList(topicDraft.acceptanceCriteria);
    if (!title || !goal || !scope.length || !evidence.length || !acceptanceCriteria.length) return onError("标题、目标、影响范围、事实证据和验收条件必须完整填写。");
    await update(() => window.desktop?.convertNangongConversationToTopic({ confirmedByUser: true, title, goal, scope, evidence, acceptanceCriteria, workspaceState: workspaces, locale }));
    setTopicDraftOpen(false);
    setTopicDraftFeedback("");
    setTopicDraft({ title: "", goal: "", scope: "", evidence: "", acceptanceCriteria: "" });
  };
  const generateTopicDraft = async () => {
    if (!workspaces || !state.conversation.messages.length || topicDraftBusy) return;
    setTopicDraftFeedback("");
    setTopicDraftBusy(true);
    try {
      // 生成结果只作为当前可编辑表单的初值，用户点击保存前不会冻结对话或创建课题。
      const draft = await window.desktop?.generateNangongTopicDraft({ workspaceState: workspaces, locale });
      if (draft) {
        setTopicDraft({ title: draft.title, goal: draft.goal, scope: draft.scope.join("，"), evidence: draft.evidence.join("，"), acceptanceCriteria: draft.acceptanceCriteria.join("，") });
        setTopicDraftFeedback("已根据当前对话填充草稿");
      }
    } catch (error) { onError(readableDesktopError(error, "课题草稿生成失败。")); } finally { setTopicDraftBusy(false); }
  };
  const timelineMessages = mergeRealtimeConversationTimeline(
    state.conversation.messages.map((message, sequenceNumber) => ({
      ...message,
      sequenceNumber: Number.isSafeInteger(message.sequenceNumber) ? message.sequenceNumber : sequenceNumber,
      status: message.deliveryStatus || "completed" as const,
      attachments: attachmentPreviews[message.messageId] || [],
    })),
    outgoingMessage ? [{
      messageId: outgoingMessage.messageId, sequenceNumber: outgoingMessage.sequenceNumber, role: "user" as const,
      content: outgoingMessage.content, replyToMessageId: null, deliveryStatus: outgoingMessage.failed ? "failed" as const : "sending" as const,
      status: outgoingMessage.failed ? "failed" as const : "sending" as const, attachmentIds: outgoingMessage.attachments.map((item) => item.id),
      attachments: outgoingMessage.attachments, createdAt: outgoingMessage.createdAt, completedAt: outgoingMessage.failed ? new Date().toISOString() : null,
    }] : [],
  );
  return <SelUiConversation id="selConversationNangongWanId" onSubmit={() => void sendChat()} timeline={<section className="selconversation-timeline nangong-person-chat" aria-label="与南宫婉讨论演化课题">
      {state.oneShotConfirmation?.status === "awaiting-user-confirmation" && state.oneShotRun?.status !== "running" && <section className="nangong-one-shot-confirmation" role="status" aria-label="本轮演化等待确认">
        <strong>本轮已具备启动条件</strong>
        <span>回复 1 将整理为演化课题，并连续进入审批、分发、测试和验收。</span>
        <button type="button" className="selform-action" disabled={chatBusy || !workspaces} onClick={() => void sendChat("1")}>回复 1 并启动本轮完整流程</button>
      </section>}
      {state.conversation.messages.length === 0 && <div className="dev-empty"><div className="dev-orb"><Code24Regular /></div><h1>和南宫婉讨论演化方向</h1><p>先说现状、问题和不能改变的约束，调查成熟后再形成课题。</p></div>}
      {timelineMessages.map((message) => <article key={message.messageId} className="selconversation-message" data-role={message.role}><header>{message.role === "user" ? `我${message.status === "sending" ? " · 发送中" : message.status === "failed" ? " · 发送失败" : ""}` : "南宫婉"}</header><div className="selconversation-message-body">{message.attachments.length ? <div className="selconversation-message-attachments">{message.attachments.map((attachment) => <img key={attachment.id} src={attachment.dataUrl} alt={attachment.name} />)}</div> : message.attachmentIds?.length ? <small>已附 {message.attachmentIds.length} 张调查截图</small> : null}<MarkdownMessage text={message.content} /></div></article>)}
    </section>} composer={<form className="selconversation-composer nangong-person-composer" onSubmit={(event) => { event.preventDefault(); void sendChat(); }}>
      {topicDraftOpen && <section className="selform-root" aria-label="整理演化课题">
        <header className="selform-header"><strong>整理为演化课题</strong><button type="button" className="selform-action" disabled={topicDraftBusy} onClick={() => setTopicDraftOpen(false)}>取消</button></header>
        {topicDraftBusy && <p role="status">南宫婉正在根据当前对话整理课题草稿…</p>}
        {!topicDraftBusy && topicDraftFeedback && <p role="status" className="selform-feedback">{topicDraftFeedback}</p>}
        <button type="button" className="selform-action" disabled={topicDraftBusy} onClick={() => void generateTopicDraft()}>根据当前对话生成草稿</button>
        <label className="selform-field">课题标题<input aria-label="课题标题" value={topicDraft.title} onChange={(event) => updateTopicDraft("title", event.currentTarget.value)} /></label>
        <label className="selform-field">课题目标<textarea aria-label="课题目标" value={topicDraft.goal} onChange={(event) => updateTopicDraft("goal", event.currentTarget.value)} /></label>
        <label className="selform-field">影响范围<input aria-label="课题影响范围" placeholder="多项用逗号分隔" value={topicDraft.scope} onChange={(event) => updateTopicDraft("scope", event.currentTarget.value)} /></label>
        <label className="selform-field">事实证据<input aria-label="课题事实证据" placeholder="多项用逗号分隔" value={topicDraft.evidence} onChange={(event) => updateTopicDraft("evidence", event.currentTarget.value)} /></label>
        <label className="selform-field">验收条件<input aria-label="课题验收条件" placeholder="多项用逗号分隔" value={topicDraft.acceptanceCriteria} onChange={(event) => updateTopicDraft("acceptanceCriteria", event.currentTarget.value)} /></label>
        <button type="button" className="selform-action" data-tone="primary" disabled={topicDraftBusy} onClick={() => void convertChat()}>确认保存课题</button>
      </section>}
      {attachments.length > 0 && <div className="selconversation-attachments">{attachments.map((attachment) => <figure key={attachment.id}><img src={attachment.dataUrl} alt={attachment.name} /><figcaption>调查截图</figcaption><button type="button" aria-label="移除截图" onClick={() => onAttachments((current) => current.filter((item) => item.id !== attachment.id))}><Dismiss20Regular /></button></figure>)}</div>}
      {newConversationBusy && <div className="nangong-conversation-refresh-status" role="status">正在关闭当前南宫婉线程并建立新对话…</div>}
      {error && <div className="composer-error" role="alert"><span>{error}</span></div>}
      <textarea className="selconversation-input" data-sel-conversation-input aria-label="给南宫婉发送消息" placeholder="描述演化问题、现状和不可改变的约束…（可粘贴截图）" value={chatText} onChange={(event) => setChatText(event.currentTarget.value)} onPaste={(event) => { const files = Array.from(event.clipboardData.items).filter((item) => item.kind === "file" && item.type.startsWith("image/")).map((item) => item.getAsFile()).filter((file): file is File => file !== null); if (files.length) { event.preventDefault(); onPaste(files); } }} />
      <div className="selconversation-footer"><div className="selconversation-tools"><button type="button" className="screenshot-button" aria-label="截取当前屏幕" data-sel-tooltip="截取当前屏幕" data-sel-tooltip-mode="always" onClick={() => onScreenshot(false)}><Screenshot24Regular /></button><button type="button" className="screenshot-button" aria-label="隐藏窗口后截图" data-sel-tooltip="隐藏窗口后截图" data-sel-tooltip-mode="always" onClick={() => onScreenshot(true)}><EyeOff24Regular /></button><button type="button" className="selconversation-action" data-tone="neutral" disabled={!state.conversation.messages.length || newConversationBusy} onClick={() => setTopicDraftOpen(true)}>整理为演化课题</button></div><div className="selconversation-actions"><button type="submit" className="selconversation-action" disabled={newConversationBusy || (!chatText.trim() && !attachments.length) || chatBusy} aria-label={chatBusy ? "调查中" : "发送给南宫婉"}><Send24Filled /></button></div></div>
    </form>} />;
}
