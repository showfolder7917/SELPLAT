import { type Dispatch, type SetStateAction, useState } from "react";
import { Code24Regular, Dismiss20Regular, EyeOff24Regular, Screenshot24Regular, Send24Filled } from "@fluentui/react-icons";

import type { PersonaConversationOutDto, LocaleValue, WorkspaceStateOutDto } from "../../../../contracts/system/desktop/index";
import type { ComposerAttachment } from "../../conversation/model/chat-message";
import type { usePersonaConversation } from "../../conversation/model/usePersonaConversation";
import { MarkdownMessage } from "../../conversation/components/MarkdownMessage";
import { HanliCustodySwitch } from "./HanliCustodySwitch";
import { SelUiConversation } from "../../conversation/components/SelUiConversation";
import { mergeRealtimeConversationTimeline, projectPersonaConversation } from "../../conversation/model/realtime-conversation";
import { usePersonaConversationTailFollow } from "../../conversation/model/usePersonaConversationTailFollow";

/**
 * Electron IPC 抛出的错误通常带有一段技术前缀。
 * 页面只保留用户能理解的正文；如果收到的不是 Error，则使用调用方提供的默认文案。
 */
function readableDesktopError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/^Error invoking remote method '[^']+':\s*/, "");
}

/** 韩立自由讨论沿用统一会话外壳，只暴露讨论能力，不暴露旧托管阶段或工程写入入口。 */
export function HanliConversationWorkspace({ runtime, conversation, attachments, workspaces, locale, newConversationBusy, error, onConversation, onAttachments, onScreenshot, onPaste, onError }: {
  runtime: ReturnType<typeof usePersonaConversation>;
  // 后端已经保存的完整韩立会话，包含用户、韩立和内部研讨消息。
  conversation: PersonaConversationOutDto;
  // 用户本轮准备发送、但尚未提交的截图附件。
  attachments: ComposerAttachment[];
  // 当前登记的工作区。韩立必须知道讨论的是哪个工程，所以 null 时不能发送。
  workspaces: WorkspaceStateOutDto | null;
  // 当前界面语言，会随请求一起交给韩立后端。
  locale: LocaleValue;
  // 点击“新建韩立会话”后，由父组件传入的等待状态。
  newConversationBusy: boolean;
  // 父组件保存的页面级错误，例如 IPC 调用失败。
  error: string;
  // 后端返回新会话后，用它替换父组件中的旧会话。
  onConversation(value: PersonaConversationOutDto): void;
  // 更新父组件中的待发送附件；类型与 React 的 setState 函数一致。
  onAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>;
  // 请求桌面端截图；hidden=true 表示截图前先隐藏 AI Desktop 窗口。
  onScreenshot(hidden: boolean): void;
  // 把从剪贴板粘贴的图片文件交给统一截图功能处理。
  onPaste(files: File[]): void;
  // 把当前错误同步回父组件，空字符串表示清除错误。
  onError(message: string): void;
}) {
  // 输入框中尚未发送的文字。
  const [text, setText] = useState("");
  // 控制器位于应用层，页面卸载后发送锁、待确认消息与截图预览仍保留。
  const { sending: busy, setSending: setBusy, pendingMessage: pending, setPendingMessage: setPending, attachmentPreviews, setAttachmentPreviews, attachmentPreviewErrors } = runtime;

  /** 用户按发送按钮或在表单中提交时，完成一整轮韩立对话。 */
  const send = async () => {
    // 有文字时发送文字；只有截图时自动补一条说明，避免向后端发送空消息。
    const message = text.trim() || (attachments.length ? "请结合这些截图和你掌握的客户语义资料，与我讨论这个问题。" : "");
    // 空消息、工作区未就绪或已有请求进行中时，不重复调用后端。
    if (!message || !workspaces || busy) return;

    // 前端先生成稳定消息 ID，后端入库和附件预览都用同一个 ID 对齐。
    const clientMessageId = `hanli-message-${crypto.randomUUID()}`;
    // 复制本轮附件，防止清空输入区后丢失正在发送的附件引用。
    const sentAttachments = [...attachments];

    // 进入发送状态，同时清空输入区和上一次错误。
    setBusy(true);
    setText("");
    onAttachments([]);
    onError("");

    // 后端回答前，时间线立即显示一条“发送中”的用户消息。
    setPending({ messageId: clientMessageId, content: message, attachments: sentAttachments, failed: false, createdAt: new Date().toISOString() });

    try {
      // preload 暴露的 Desktop API 会通过 IPC 把消息交给 Electron 主进程中的韩立服务。
      const next = await window.desktop?.sendPersonaConversationMessage("han-li", { clientMessageId, message, attachmentIds: sentAttachments.map((item) => item.id), workspaceState: workspaces, locale });
      // API 不存在或后端没有返回会话时，也按发送失败处理，不能假装成功。
      if (!next) throw new Error("韩立会话服务未返回结果。");

      // 保存本轮附件预览，后端返回后仍可在对应用户消息下面显示图片。
      if (sentAttachments.length) setAttachmentPreviews((current) => ({ ...current, [clientMessageId]: sentAttachments }));

      // 使用后端返回的权威会话刷新页面；正式消息已存在后即可移除 pending。
      onConversation(next);
      setPending(null);
    } catch (sendError) {
      // 请求失败时保留用户刚才输入的消息，并把显示状态改成“发送失败”。
      setPending((current) => current ? { ...current, failed: true } : null);
      onError(readableDesktopError(sendError, "发送给韩立失败。"));
    } finally {
      // 无论成功或失败都解除发送锁，让用户可以进行下一次操作。
      setBusy(false);
    }
  };

  // 韩立页面只承载用户与韩立的直接交流和判断纠正；内部研讨保留原始记录，仅在南宫婉页面展示。
  const directMessages = projectPersonaConversation(conversation.messages).direct
    .filter((message) => message.speakerType === "user" || message.speakerPersonaId === "han-li")
    .map((message) => ({ ...message, status: message.deliveryStatus }));
  const messages = mergeRealtimeConversationTimeline(directMessages, pending ? [{
    messageId: pending.messageId,
    sequenceNumber: conversation.messages.length,
    speakerType: "user" as const,
    speakerPersonaId: null,
    content: pending.content,
    replyToMessageId: null,
    deliveryStatus: pending.failed ? "failed" as const : "sending" as const,
    status: pending.failed ? "failed" as const : "sending" as const,
    attachmentIds: pending.attachments.map((item) => item.id),
    createdAt: pending.createdAt,
    completedAt: pending.failed ? new Date().toISOString() : null,
  }] : []);
  const timelineRef = usePersonaConversationTailFollow(messages.map((message) => `${message.messageId}:${message.deliveryStatus}:${message.content}`).join("|"));

  return <SelUiConversation
    // 固定 ID 供样式、自动化测试和页面定位使用。
    id="selConversationHanLiPersonaId"
    // 统一会话外壳也可以触发提交，最终仍复用上面的 send 函数。
    onSubmit={() => void send()}
    // timeline 是会话上半部分，负责展示空页面提示和历史消息。
    timeline={<section ref={timelineRef} className="selconversation-timeline hanli-person-chat" aria-label="与韩立自由讨论">
      {/* 没有任何消息时显示使用说明。 */}
      {messages.length === 0 && <div className="dev-empty">
        <div className="dev-orb"><Code24Regular /></div>
        <h1>和韩立讨论客户真正需要什么</h1>
        <p>可以直接描述问题。韩立会学习已整理的提问、调查和问题扩展方法，但不会按相似历史结论模仿回答。</p>
      </div>}

      {/* 统计只显示本次实际读入规模，不混入会话正文或下一轮方法学习。 */}
      {!busy && conversation.contextReadStats && <p className="hanli-context-read-stats" role="status" aria-live="polite">
        本轮读取：方法资料 {conversation.contextReadStats.methodCharacters.toLocaleString()} 字
        · 当前会话 {conversation.contextReadStats.recentConversationCharacters.toLocaleString()} 字
        · 本轮问题 {conversation.contextReadStats.latestUserMessageCharacters.toLocaleString()} 字
        · 发送上下文 {conversation.contextReadStats.promptCharacters.toLocaleString()} 字
      </p>}

      {/* 每条直接对话渲染成一个 article，data-role 区分用户和韩立。 */}
      {messages.map((message) => {
        // 优先读取已保存的预览；当前 pending 消息则直接使用本轮附件。
        const previews = attachmentPreviews[message.messageId]
          || (pending?.messageId === message.messageId ? pending.attachments : []);

        return <article key={message.messageId} className="selconversation-message" data-role={message.speakerType}>
          {/* 标题同时展示说话人，以及用户消息是否仍在发送或已经失败。 */}
          <header>{message.speakerType === "user"
            ? `我${message.deliveryStatus === "sending" ? " · 发送中" : message.deliveryStatus === "failed" ? " · 发送失败" : ""}`
            : "韩立"}</header>

          <div className="selconversation-message-body">
            {/* 有 dataUrl 时直接展示图片；只有后端附件 ID 时显示附件数量。 */}
            {previews.length
              ? <div className="selconversation-message-attachments">
                {previews.map((attachment) => <img key={attachment.id} src={attachment.dataUrl} alt={attachment.name} />)}
              </div>
              : message.attachmentIds?.length
                ? <small>{attachmentPreviewErrors[message.messageId] || "附件预览正在恢复。"}</small>
                : null}
            {/* 消息正文支持 Markdown，而不是直接显示未经格式化的纯文本。 */}
            <MarkdownMessage text={message.content} />
          </div>
        </article>;
      })}
    </section>}
    // composer 是会话下半部分，负责附件、输入框、截图按钮和发送按钮。
    composer={<form
      className="selconversation-composer hanli-person-composer"
      onSubmit={(event) => {
        // 阻止浏览器刷新整个页面，再调用 React 内部的异步发送逻辑。
        event.preventDefault();
        void send();
      }}
    >
      {/* 发送前的附件预览；移除按钮只删除被点击的那一张。 */}
      {attachments.length > 0 && <div className="selconversation-attachments">
        {attachments.map((attachment) => <figure key={attachment.id}>
          <img src={attachment.dataUrl} alt={attachment.name} />
          <figcaption>讨论截图</figcaption>
          <button
            type="button"
            aria-label="移除截图"
            onClick={() => onAttachments((current) => current.filter((item) => item.id !== attachment.id))}
          >
            <Dismiss20Regular />
          </button>
        </figure>)}
      </div>}

      {/* 新建会话期间给屏幕阅读器和用户显示进度。 */}
      {newConversationBusy && <div role="status">正在关闭当前韩立线程并建立新对话…</div>}
      {/* role=alert 会让辅助技术及时读出错误。 */}
      {error && <div className="composer-error" role="alert"><span>{error}</span></div>}

      <textarea
        className="selconversation-input"
        data-sel-conversation-input
        aria-label="给韩立发送消息"
        placeholder="描述问题、真实目标或你不确定该怎么问的地方…（可粘贴截图）"
        value={text}
        // 受控输入框：页面文字始终来自 text 状态。
        onChange={(event) => setText(event.currentTarget.value)}
        onPaste={(event) => {
          // 剪贴板可能同时包含文字和文件，这里只提取图片文件。
          const files = Array.from(event.clipboardData.items)
            .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
            .map((item) => item.getAsFile())
            .filter((file): file is File => file !== null);
          if (files.length) {
            // 已接管图片粘贴时阻止浏览器把图片内容直接塞进 textarea。
            event.preventDefault();
            onPaste(files);
          }
        }}
      />

      <div className="selconversation-footer">
        <div className="selconversation-tools">
          <HanliCustodySwitch onError={onError} />
          {/* false：保留 AI Desktop 窗口，直接截取当前屏幕。 */}
          <button type="button" className="screenshot-button" aria-label="截取当前屏幕" onClick={() => onScreenshot(false)}>
            <Screenshot24Regular />
          </button>
          {/* true：先隐藏 AI Desktop，避免窗口挡住需要截取的目标。 */}
          <button type="button" className="screenshot-button" aria-label="隐藏窗口后截图" onClick={() => onScreenshot(true)}>
            <EyeOff24Regular />
          </button>
        </div>

        <div className="selconversation-actions">
          <button
            type="submit"
            className="selconversation-action"
            // 新建会话、等待回复、文字和附件都为空时禁止发送。
            disabled={newConversationBusy || busy || (!text.trim() && !attachments.length)}
            aria-label={busy ? "思考中" : "发送给韩立"}
          >
            <Send24Filled />
          </button>
        </div>
      </div>
    </form>}
  />;
}
