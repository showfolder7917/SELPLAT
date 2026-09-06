/**
 * 韩立会话页面的控制 Hook。
 *
 * 用户点击 Developer 左侧人物树中的“韩立”后，View 会调用本 Hook 取得页面数据和操作。
 * 本文件负责输入、发送、附件、消息投影和错误状态，不负责描述任何可见页面节点。
 */

import {
  // 剪贴板事件类型（ClipboardEvent）描述输入框粘贴事件，只用于声明参数类型。
  type ClipboardEvent,
  // 状态记录方法（useState）由 React 提供，用于保存输入框中尚未发送的文字。
  useState,
} from "react";

// 截图附件类型（ComposerAttachment）表示一张已经保存、可以发送和预览的图片。
import type { ComposerAttachment } from "../../conversation/model/chat-message";
// 实时消息合并方法（mergeRealtimeConversationTimeline）把数据库消息与发送中的临时消息合并为一条时间线。
// 人物消息分类方法（projectPersonaConversation）把韩立会话拆成直接对话和内部研讨两类消息。
import { mergeRealtimeConversationTimeline, projectPersonaConversation } from "../../conversation/model/realtime-conversation";
// 会话末尾跟随方法（usePersonaConversationTailFollow）让会话区在新增消息后跟随到最新内容。
import { usePersonaConversationTailFollow } from "../../conversation/model/usePersonaConversationTailFollow";
// 韩立页面参数类型（HanliConversationWorkspaceProps）描述页面结构交给控制逻辑的全部数据和操作。
import type { HanliConversationWorkspaceProps } from "./HanliConversationWorkspace.types";

/** 把 Electron 技术错误转换成客户可以直接阅读的页面提示。 */
function readableDesktopError(error: unknown, fallback: string): string {
  // 标准错误对象（Error）保留真实错误正文，其他未知值使用安全默认提示。
  const message = error instanceof Error ? error.message : fallback;
  // 桌面通信错误前缀不属于业务信息，显示前将它从错误正文中移除。
  return message.replace(/^Error invoking remote method '[^']+':\s*/, "");
}

/** 为韩立会话 View 准备页面数据，并提供用户可以触发的操作。 */
export function useHanliConversationWorkspace(props: HanliConversationWorkspaceProps) {
  // 待发送文字（text）保存输入框中尚未发送的内容，初始为空。
  const [text, setText] = useState("");

  // 人物会话运行状态（runtime）由公共控制器提供，页面切换后仍保留发送和附件恢复状态。
  const runtime = props.runtime;
  // 当前韩立会话（conversation）是后端已经保存的完整会话。
  const conversation = props.conversation;
  // 待发送截图（attachments）是客户本轮已经选择、但尚未发送的图片。
  const attachments = props.attachments;
  // 当前工作区（workspaces）限定本轮允许韩立读取的工程范围。
  const workspaces = props.workspaces;
  // 当前界面语言（locale）决定本轮请求和回答使用的语言。
  const locale = props.locale;
  // 会话更新操作（onConversation）把后端返回的权威会话交回父页面。
  const onConversation = props.onConversation;
  // 附件更新操作（onAttachments）更新父页面保存的待发送截图。
  const onAttachments = props.onAttachments;
  // 图片粘贴操作（onPaste）把剪贴板图片交给统一截图能力保存。
  const onPaste = props.onPaste;
  // 错误更新操作（onError）把发送失败原因交回父页面显示。
  const onError = props.onError;

  // 发送等待状态（busy）表示当前是否已有一轮韩立请求正在处理。
  const busy = runtime.sending;
  // 发送状态更新操作（setBusy）负责锁定或解除当前发送操作。
  const setBusy = runtime.setSending;
  // 临时客户消息（pending）是在后端返回前已经显示在会话区的消息。
  const pending = runtime.pendingMessage;
  // 临时消息更新操作（setPending）负责创建、标记失败或移除临时客户消息。
  const setPending = runtime.setPendingMessage;
  // 历史截图预览（attachmentPreviews）保存每条消息已经恢复出的可见图片。
  const attachmentPreviews = runtime.attachmentPreviews;
  // 截图预览更新操作（setAttachmentPreviews）把本轮截图绑定到对应的消息编号。
  const setAttachmentPreviews = runtime.setAttachmentPreviews;
  // 截图恢复错误（attachmentPreviewErrors）保存历史附件无法恢复时的可见原因。
  const attachmentPreviewErrors = runtime.attachmentPreviewErrors;

  /** 用户按发送按钮或提交表单时，完成一整轮韩立对话。 */
  async function send(): Promise<void> {
    // 优先发送用户输入的原文；只有截图时补充一条不冒充用户细节的说明。
    const message = text.trim() || (attachments.length ? "请结合这些截图和你掌握的客户语义资料，与我讨论这个问题。" : "");
    // 空消息、工作区未就绪或已有请求执行时，不重复调用后端。
    if (!message || !workspaces || busy) {
      // 当前条件不允许发送时直接结束，并保留用户尚未发送的内容。
      return;
    }

    // 本条消息编号（clientMessageId）让前端临时消息、后端持久消息和附件预览使用同一个身份。
    const clientMessageId = `hanli-message-${crypto.randomUUID()}`;
    // 本轮已发送截图（sentAttachments）冻结点击发送瞬间的附件，避免清空输入区后丢失引用。
    const sentAttachments = [...attachments];

    // 锁定发送按钮，阻止相同内容在等待期间被重复提交。
    setBusy(true);
    // 清空输入框，让用户明确看到本轮文字已经进入发送流程。
    setText("");
    // 清空待发送附件区，附件随后显示在本轮临时消息中。
    onAttachments([]);
    // 清除上一轮错误，避免旧提示干扰当前请求。
    onError("");

    // 在后端回答前立即显示用户原文和截图，让页面对点击产生即时反馈。
    setPending({ messageId: clientMessageId, content: message, attachments: sentAttachments, failed: false, createdAt: new Date().toISOString() });

    // 消息发送处理从这里开始，统一覆盖桌面调用、会话更新和附件预览绑定。
    try {
      // 调用人物会话后端，把本轮客户消息发送给韩立，并等待返回最新完整会话。
      const next = await window.desktop?.sendPersonaConversationMessage(
        // 接收人物：明确本轮消息由韩立处理。
        "han-li",
        // 本轮消息资料：后端保存消息、读取截图并建立工程上下文所需的完整输入。
        {
          // 本条消息编号：对齐前端临时消息、后端正式消息和附件预览。
          clientMessageId,
          // 客户原文：保存并交给韩立理解和回答的本轮文字。
          message,
          // 截图编号列表：让后端取得本轮附带的全部截图资料。
          attachmentIds: sentAttachments.map((item) => item.id),
          // 当前工作区：限定韩立本轮可以理解和调查的工程范围。
          workspaceState: workspaces,
          // 当前界面语言：要求后端使用客户当前选择的语言处理和回答。
          locale,
        },
      );
      // 没有桌面 API 或后端未返回会话都属于真实发送失败，不能显示假成功。
      if (!next) {
        // 抛出业务可读错误，交给下面的统一失败分支处理。
        throw new Error("韩立会话服务未返回结果。");
      }

      // 本轮包含截图时，把内存中的 dataUrl 继续绑定到已经持久化的用户消息。
      if (sentAttachments.length) {
        // 合并旧预览，防止新一轮发送覆盖历史消息已经恢复的图片。
        setAttachmentPreviews((current) => ({ ...current, [clientMessageId]: sentAttachments }));
      }

      // 使用后端返回的权威会话刷新消息区和会话状态。
      onConversation(next);
      // 正式消息已经出现后移除临时消息，避免同一用户消息显示两次。
      setPending(null);
    // 发送失败处理接住桌面通信、后端处理和页面状态更新中的异常。
    } catch (sendError) {
      // 保留用户刚才发送的内容，只把临时消息状态改成失败以便用户识别。
      setPending((current) => current ? { ...current, failed: true } : null);
      // 去掉 Electron 技术前缀后，把错误同步给页面错误区。
      onError(readableDesktopError(sendError, "发送给韩立失败。"));
    // 发送结束处理保证成功和失败都能解除发送锁。
    } finally {
      // 解除发送锁，让客户可以继续下一轮对话或重试。
      setBusy(false);
    }
  }

  // 直接问答消息（directMessages）只保留客户与韩立的交流，内部研讨继续只在南宫婉页面展示。
  const directMessages = projectPersonaConversation(conversation.messages).direct
    // 过滤其他人物消息，避免南宫婉或令狐的内部交接混入客户问答区。
    .filter((message) => message.speakerType === "user" || message.speakerPersonaId === "han-li")
    // 把后端 deliveryStatus 映射成实时消息组件使用的页面状态。
    .map((message) => ({ ...message, status: message.deliveryStatus }));
  // 页面消息列表（messages）把已保存消息与发送中的临时消息合并，并按消息编号去重。
  const messages = mergeRealtimeConversationTimeline(directMessages, pending ? [{
    // 临时消息编号（messageId）沿用发送前生成的编号，后端返回后可以替换临时消息。
    messageId: pending.messageId,
    // 页面顺序号（sequenceNumber）暂放在当前历史末尾，正式顺序以后端结果为准。
    sequenceNumber: conversation.messages.length,
    // 发言方类型（speakerType）使用 user 表示这条临时消息来自当前客户。
    speakerType: "user" as const,
    // 用户消息没有人物身份，所以 speakerPersonaId 固定为空。
    speakerPersonaId: null,
    // 消息正文（content）保存客户本轮实际提交的文字。
    content: pending.content,
    // 当前临时消息不是对某一条内部消息的回复。
    replyToMessageId: null,
    // 消息传递状态（deliveryStatus）根据失败标记决定显示发送中还是发送失败。
    deliveryStatus: pending.failed ? "failed" as const : "sending" as const,
    // 页面消息状态（status）与统一实时消息结构保持一致。
    status: pending.failed ? "failed" as const : "sending" as const,
    // 截图编号列表（attachmentIds）让临时消息与本轮截图保持稳定关联。
    attachmentIds: pending.attachments.map((item) => item.id),
    // 消息创建时间（createdAt）保留客户点击发送的真实时间。
    createdAt: pending.createdAt,
    // 只有发送失败时当前生命周期才结束，发送中保持为空。
    completedAt: pending.failed ? new Date().toISOString() : null,
  // 没有临时消息时传入空数组，避免制造不存在的用户气泡。
  }] : []);
  // 时间线变化标识（timelineIdentity）把消息编号、状态和正文组合起来，用于判断是否需要跟随最新消息。
  const timelineIdentity = messages.map((message) => `${message.messageId}:${message.deliveryStatus}:${message.content}`).join("|");
  // 会话区引用（timelineRef）绑定滚动区域，在时间线变化后跟随最新一轮问答。
  const timelineRef = usePersonaConversationTailFollow(timelineIdentity);
  // 是否允许发送（canSend）统一表达按钮是否具备条件，页面结构不再重复判断。
  const canSend = !props.newConversationBusy && !busy && Boolean(text.trim() || attachments.length);

  /** 返回某条消息当前可显示的截图；临时消息优先使用发送瞬间冻结的附件。 */
  function previewsForMessage(messageId: string): ComposerAttachment[] {
    // 历史消息已经恢复出预览时，直接返回数据库附件对应的图片。
    const restoredPreviews = attachmentPreviews[messageId];
    // 已有历史预览时不再检查临时消息，避免同一图片重复显示。
    if (restoredPreviews) {
      // 返回当前消息已经恢复的完整预览数组。
      return restoredPreviews;
    }
    // 当前消息正是发送中的临时消息时，直接返回发送前冻结的附件。
    if (pending?.messageId === messageId) {
      // 临时消息截图（pending.attachments）已经带有预览地址，不需要再次访问桌面文件。
      return pending.attachments;
    }
    // 没有历史预览也不是临时消息时，当前没有可直接显示的图片。
    return [];
  }

  /** 从发送前附件区移除客户点击的单张截图。 */
  function removeAttachment(attachmentId: string): void {
    // 根据稳定附件 ID 过滤目标，其他待发送截图保持原顺序。
    onAttachments((current) => current.filter((item) => item.id !== attachmentId));
  }

  /** 接管输入框中的图片粘贴，并把图片文件交给统一截图能力。 */
  function pasteImages(event: ClipboardEvent<HTMLTextAreaElement>): void {
    // 剪贴板数据（clipboardData）可能同时包含文字和文件，这里先读取全部条目。
    const clipboardItems = Array.from(event.clipboardData.items);
    // 剪贴板图片条目（imageItems）只保留文件类型且内容类型属于图片的项目。
    const imageItems = clipboardItems.filter((item) => item.kind === "file" && item.type.startsWith("image/"));
    // 待保存图片文件（files）把可用图片条目转换成浏览器文件对象，并丢弃转换失败的空值。
    const files = imageItems.map((item) => item.getAsFile()).filter((file): file is File => file !== null);
    // 没有图片时保留浏览器默认粘贴行为，普通文字仍可进入输入框。
    if (!files.length) {
      // 当前事件不包含需要截图能力接管的图片，因此直接结束。
      return;
    }
    // 已接管图片时阻止浏览器把二进制内容直接写入文本输入框。
    event.preventDefault();
    // 把真实图片文件交给父页面统一保存并生成附件身份。
    onPaste(files);
  }

  // 返回 View 渲染和响应交互所需的最小页面模型。
  return {
    // 待发送文字（text）是输入框当前显示的内容。
    text,
    // 文字更新操作（setText）让页面在客户输入时保存最新内容。
    setText,
    // 发送等待状态（busy）控制等待提示和发送按钮状态。
    busy,
    // 页面消息列表（messages）是客户问答区最终需要展示的时间线。
    messages,
    // 会话区引用（timelineRef）绑定客户问答区的滚动容器。
    timelineRef,
    // 截图恢复错误（attachmentPreviewErrors）为无法恢复的历史附件提供可读原因。
    attachmentPreviewErrors,
    // 是否允许发送（canSend）是发送按钮使用的统一判断结果。
    canSend,
    // 消息发送操作（send）执行一次完整的客户到韩立发送流程。
    send,
    // 消息截图读取操作（previewsForMessage）为每条问答消息返回对应图片。
    previewsForMessage,
    // 截图移除操作（removeAttachment）从发送前附件区移除指定图片。
    removeAttachment,
    // 图片粘贴操作（pasteImages）接管输入框粘贴的图片文件。
    pasteImages,
  };
}
