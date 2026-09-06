/**
 * 南宫婉会话页面的控制逻辑。
 *
 * 用户进入左侧人物树“南宫婉”页面后，页面结构会调用本 Hook。
 * 本文件负责输入、发送、截图附件、内部研讨投影和课题草稿，不描述可见页面节点。
 */

import {
  // 剪贴板事件类型（ClipboardEvent）描述输入框粘贴事件的数据结构。
  type ClipboardEvent,
  // 会话变化处理方法（useEffect）由 React 提供，在切换会话时清理旧草稿。
  useEffect,
  // 状态记录方法（useState）由 React 提供，保存输入文字、课题表单和等待状态。
  useState,
} from "react";

// 实时消息合并方法（mergeRealtimeConversationTimeline）合并数据库消息和前端临时消息。
// 人物消息分类方法（projectPersonaConversation）把直接问答与内部研讨消息分开。
import { mergeRealtimeConversationTimeline, projectPersonaConversation } from "../../conversation/model/realtime-conversation";
// 会话末尾跟随方法（usePersonaConversationTailFollow）让消息区在新增内容后跟随到最新位置。
import { usePersonaConversationTailFollow } from "../../conversation/model/usePersonaConversationTailFollow";
import type {
  // 南宫婉页面参数类型（NangongConversationWorkspaceProps）描述父页面交给控制逻辑的数据。
  NangongConversationWorkspaceProps,
  // 课题草稿类型（NangongTopicDraft）描述客户确认前可以编辑的课题数据。
  NangongTopicDraft,
} from "./NangongConversationWorkspace.types";

/** 创建一份互不共享引用的空课题草稿。 */
function createEmptyTopicDraft(): NangongTopicDraft {
  // 每次返回新对象，避免不同会话意外共用旧表单内容。
  return { title: "", goal: "", scope: "", evidence: "", acceptanceCriteria: "" };
}

/** 把 Electron 技术错误转换成客户可以直接阅读的页面提示。 */
function readableDesktopError(error: unknown, fallback: string): string {
  // 标准错误对象（Error）保留真实错误正文，其他未知值使用安全默认提示。
  const message = error instanceof Error ? error.message : fallback;
  // 桌面通信错误前缀不属于业务信息，显示前将它移除。
  return message.replace(/^Error invoking remote method '[^']+':\s*/, "");
}

/** 把逗号、分号或换行分隔的输入转换成去重业务清单。 */
function splitEvolutionList(value: string): string[] {
  // 分隔后的输入项目（separatedItems）按照逗号、分号或换行拆分客户原文。
  const separatedItems = value.split(/[，,；;\n]/);
  // 去空白项目（trimmedItems）移除每一项前后的输入空白。
  const trimmedItems = separatedItems.map((item) => item.trim());
  // 有效输入项目（normalizedItems）排除分隔符之间产生的空内容。
  const normalizedItems = trimmedItems.filter(Boolean);
  // 去重集合（Set）移除客户重复输入的相同项目，再转换成普通数组交给后端。
  return [...new Set(normalizedItems)];
}

/** 为南宫婉会话页面准备可见数据，并提供页面可以触发的操作。 */
export function useNangongConversationWorkspace(props: NangongConversationWorkspaceProps) {
  // 待发送文字（chatText）保存问答输入框中尚未发送的内容。
  const [chatText, setChatText] = useState("");
  // 课题草稿显示状态（topicDraftOpen）控制“整理为演化课题”表单是否显示。
  const [topicDraftOpen, setTopicDraftOpen] = useState(false);
  // 草稿生成等待状态（topicDraftBusy）表示南宫婉是否正在根据对话生成草稿。
  const [topicDraftBusy, setTopicDraftBusy] = useState(false);
  // 草稿生成反馈（topicDraftFeedback）保存草稿生成成功后的页面说明。
  const [topicDraftFeedback, setTopicDraftFeedback] = useState("");
  // 课题草稿（topicDraft）保存客户确认前可以继续修改的课题字段。
  const [topicDraft, setTopicDraft] = useState<NangongTopicDraft>(createEmptyTopicDraft);

  // 人物会话运行状态（runtime）由公共控制器提供，切换页面后仍保留未完成消息。
  const runtime = props.runtime;
  // 当前演化状态（state）是后端权威结果，用于判断确认卡片和后台动作。
  const state = props.state;
  // 当前南宫婉会话（conversation）是后端保存的完整会话。
  const conversation = props.conversation;
  // 待发送截图（attachments）是客户本轮已经选择、尚未提交的图片。
  const attachments = props.attachments;
  // 当前工作区（workspaces）限定本轮允许南宫婉读取的工程范围。
  const workspaces = props.workspaces;
  // 当前界面语言（locale）决定本轮请求和回答使用的语言。
  const locale = props.locale;
  // 演化状态更新操作（onState）把后端权威状态交回父页面。
  const onState = props.onState;
  // 会话更新操作（onConversation）把后端权威会话交回父页面。
  const onConversation = props.onConversation;
  // 附件更新操作（onAttachments）更新父页面保存的待发送截图。
  const onAttachments = props.onAttachments;
  // 图片粘贴操作（onPaste）把剪贴板图片交给统一截图能力。
  const onPaste = props.onPaste;
  // 错误更新操作（onError）把可见问题交回父页面统一显示。
  const onError = props.onError;

  // 消息发送等待状态（chatBusy）表示当前是否已有南宫婉消息正在发送。
  const chatBusy = runtime.sending;
  // 发送状态更新操作（setChatBusy）锁定或解除人物消息发送操作。
  const setChatBusy = runtime.setSending;
  // 临时客户消息（outgoingMessage）是在后端返回前显示在页面中的内容。
  const outgoingMessage = runtime.pendingMessage;
  // 临时消息更新操作（setOutgoingMessage）创建、标记失败或移除临时客户消息。
  const setOutgoingMessage = runtime.setPendingMessage;
  // 历史截图预览（attachmentPreviews）保存每条消息已经恢复出的可见图片。
  const attachmentPreviews = runtime.attachmentPreviews;
  // 截图预览更新操作（setAttachmentPreviews）把本轮截图绑定到正式消息编号。
  const setAttachmentPreviews = runtime.setAttachmentPreviews;
  // 截图恢复错误（attachmentPreviewErrors）保存历史附件无法恢复时的原因。
  const attachmentPreviewErrors = runtime.attachmentPreviewErrors;
  // 共享内部消息（sharedInternalMessages）是协作事件生成的跨人物研讨内容。
  const sharedInternalMessages = runtime.sharedInternalMessages;
  // 新建会话反馈（newConversationFeedback）是重新建立会话后的可见说明。
  const newConversationFeedback = runtime.newConversationFeedback;

  // 新会话是页面草稿的生命周期边界，不能继续显示旧会话未保存内容。
  useEffect(() => {
    // 清空旧会话中未发送的问答文字。
    setChatText("");
    // 关闭旧会话打开的课题草稿表单。
    setTopicDraftOpen(false);
    // 清除可能残留的草稿等待状态。
    setTopicDraftBusy(false);
    // 清除旧会话的草稿生成反馈。
    setTopicDraftFeedback("");
    // 恢复一份新的空课题草稿。
    setTopicDraft(createEmptyTopicDraft());
  // 会话编号（conversationId）由后端定义，只在编号变化时清理旧会话草稿。
  }, [conversation.conversationId]);

  /** 修改课题草稿中的一个指定字段。 */
  function updateTopicDraft(field: keyof NangongTopicDraft, value: string): void {
    // 保留其他字段，只替换客户当前编辑的字段。
    setTopicDraft((current) => ({ ...current, [field]: value }));
  }

  /** 执行一次演化状态变更，并使用后端结果刷新页面。 */
  async function updateEvolutionState(operation: () => Promise<NonNullable<typeof state>> | undefined): Promise<void> {
    // 新操作开始前清除上一轮页面错误。
    onError("");
    // 演化操作处理从这里开始，统一覆盖桌面能力缺失、后端失败和状态刷新。
    try {
      // 待完成演化请求（pending）是调用方创建的后端操作。
      const pending = operation();
      // 桌面 API 不存在时保持当前状态，不制造虚假成功。
      if (!pending) return;
      // 最新演化状态（next）是后端完成操作后返回的权威结果。
      const next = await pending;
      // 用权威结果刷新父页面。
      onState(next);
    // 异常处理分支（catch）把技术问题转换成客户可以理解的提示。
    } catch (error) {
      // 页面错误区统一展示演化操作失败原因。
      onError(readableDesktopError(error, "专项演化操作失败。"));
    }
  }

  /** 发送一轮客户与南宫婉的问答。 */
  async function sendChat(confirmedMessage?: string): Promise<void> {
    // 明确确认文字优先，其次使用输入原文，只有截图时补充安全说明。
    const message = confirmedMessage?.trim() || chatText.trim() || (attachments.length ? "请调查并分析这些截图中的问题。" : "");
    // 无内容、工作区未就绪或已有请求时不重复发送。
    if (!message || !workspaces || chatBusy) return;
    // 本轮已发送截图（sentAttachments）冻结点击发送时的图片，避免清空输入区后丢失引用。
    const sentAttachments = [...attachments];
    // 本条消息编号（clientMessageId）用于对齐临时消息、数据库消息和附件预览。
    const clientMessageId = `nangong-message-${crypto.randomUUID()}`;
    // 消息创建时间（createdAt）保存客户真实点击发送的时间。
    const createdAt = new Date().toISOString();

    // 锁定发送按钮，阻止等待期间重复提交。
    setChatBusy(true);
    // 清空已经进入发送流程的文字。
    setChatText("");
    // 清空待发送附件区，截图随后进入临时消息。
    onAttachments([]);
    // 立即显示客户原文和截图，让页面产生真实反馈。
    setOutgoingMessage({ messageId: clientMessageId, sequenceNumber: conversation.messages.length, content: message, attachments: sentAttachments, failed: false, createdAt });
    // 清除上一轮发送错误。
    onError("");

    // 消息发送处理从这里开始，统一覆盖桌面调用、附件绑定和会话刷新。
    try {
      // 最新会话（next）是后端保存消息并生成回答后返回的权威结果。
      const next = await window.desktop?.sendPersonaConversationMessage(
        // 接收人物：明确本轮消息由南宫婉处理。
        "nangong-wan",
        // 本轮消息资料：后端保存消息、读取截图并建立工程上下文所需的完整输入。
        {
          // 本条消息编号：对齐前端临时消息、后端正式消息和附件预览。
          clientMessageId,
          // 客户原文：保存并交给南宫婉调查和回答的本轮文字。
          message,
          // 截图编号列表：让后端取得本轮附带的全部截图资料。
          attachmentIds: sentAttachments.map((item) => item.id),
          // 当前工作区：限定南宫婉本轮可以调查的工程范围。
          workspaceState: workspaces,
          // 当前界面语言：要求后端使用客户当前选择的语言处理和回答。
          locale,
        },
      );
      // 未返回会话时按真实失败处理。
      if (!next) throw new Error("南宫婉会话服务未返回结果。");
      // 已保存客户消息（persisted）定位刚才写入数据库的本轮消息。
      const persisted = next.messages.find((item) => item.messageId === clientMessageId);
      // 有持久消息和截图时继续保存内存预览映射。
      if (persisted && sentAttachments.length) {
        // 合并历史预览，避免覆盖旧消息截图。
        setAttachmentPreviews((current) => ({ ...current, [persisted.messageId]: sentAttachments }));
      }
      // 使用后端会话刷新父页面。
      onConversation(next);
      // 正式消息出现后移除临时消息。
      setOutgoingMessage(null);
    // 发送失败处理保留客户消息并展示真实错误。
    } catch (error) {
      // 失败消息仍留在时间线中供客户识别。
      setOutgoingMessage((current) => current ? { ...current, failed: true } : null);
      // 页面错误区展示发送失败原因。
      onError(readableDesktopError(error, "发送给南宫婉失败。"));
    // 发送结束处理保证成功和失败都解除发送锁。
    } finally {
      // 允许客户继续发送或重试。
      setChatBusy(false);
    }
  }

  /** 把客户确认完整的草稿保存为演化课题。 */
  async function convertChat(): Promise<void> {
    // 没有工作区或会话事实时不能建立课题。
    if (!workspaces || !conversation.messages.length) return;
    // 课题标题（title）去掉输入首尾空白。
    const title = topicDraft.title.trim();
    // 课题目标（goal）去掉输入首尾空白。
    const goal = topicDraft.goal.trim();
    // 影响范围（scope）转换为去重清单。
    const scope = splitEvolutionList(topicDraft.scope);
    // 事实证据（evidence）转换为去重清单。
    const evidence = splitEvolutionList(topicDraft.evidence);
    // 验收条件（acceptanceCriteria）转换为去重清单。
    const acceptanceCriteria = splitEvolutionList(topicDraft.acceptanceCriteria);
    // 任一必填业务字段缺失时明确提示客户补全。
    if (!title || !goal || !scope.length || !evidence.length || !acceptanceCriteria.length) {
      // 错误区说明建立课题所缺少的完整性条件。
      onError("标题、目标、影响范围、事实证据和验收条件必须完整填写。");
      // 不向后端发送不完整课题。
      return;
    }
    // 请求后端冻结客户确认过的课题内容。
    await updateEvolutionState(() => window.desktop?.convertNangongConversationToTopic({ confirmedByUser: true, title, goal, scope, evidence, acceptanceCriteria, workspaceState: workspaces, locale }));
    // 保存流程结束后关闭草稿表单。
    setTopicDraftOpen(false);
    // 清除草稿生成反馈。
    setTopicDraftFeedback("");
    // 清空已经保存的草稿字段。
    setTopicDraft(createEmptyTopicDraft());
  }

  /** 请求南宫婉根据当前对话生成一份仍可编辑的课题草稿。 */
  async function generateTopicDraft(): Promise<void> {
    // 工作区、会话或空闲条件不满足时不发起请求。
    if (!workspaces || !conversation.messages.length || topicDraftBusy) return;
    // 清除上一次草稿反馈。
    setTopicDraftFeedback("");
    // 锁定草稿生成按钮。
    setTopicDraftBusy(true);
    // 草稿生成处理从这里开始，统一覆盖桌面请求和表单填充。
    try {
      // 可编辑课题草稿（draft）只是表单初值，不会直接建立课题。
      const draft = await window.desktop?.generateNangongTopicDraft({ workspaceState: workspaces, locale });
      // 后端确实返回草稿时才更新表单。
      if (draft) {
        // 把列表字段转换成客户容易继续编辑的逗号分隔文字。
        setTopicDraft({ title: draft.title, goal: draft.goal, scope: draft.scope.join("，"), evidence: draft.evidence.join("，"), acceptanceCriteria: draft.acceptanceCriteria.join("，") });
        // 告诉客户当前表单已经根据对话完成填充。
        setTopicDraftFeedback("已根据当前对话填充草稿");
      }
    // 草稿生成失败处理展示真实原因。
    } catch (error) {
      // 页面错误区统一承载错误。
      onError(readableDesktopError(error, "课题草稿生成失败。"));
    // 草稿生成结束处理保证请求完成后恢复按钮。
    } finally {
      // 解除草稿生成锁。
      setTopicDraftBusy(false);
    }
  }

  // 已保存直接问答（directMessages）来自后端当前会话，并附加页面需要的状态和截图预览。
  const directMessages = projectPersonaConversation(conversation.messages).direct.map((message, sequenceNumber) => ({
    // 保留后端消息的全部业务字段。
    ...message,
    // 旧消息缺少安全序号时使用当前数组位置作为页面内顺序。
    sequenceNumber: Number.isSafeInteger(message.sequenceNumber) ? message.sequenceNumber : sequenceNumber,
    // 已保存消息没有显式状态时按完成展示。
    status: message.deliveryStatus || "completed" as const,
    // 根据稳定消息身份附加已经恢复的截图预览。
    attachments: attachmentPreviews[message.messageId] || [],
  }));
  // 临时消息列表（pendingMessages）把当前发送中的客户消息转换成统一时间线结构。
  const pendingMessages = outgoingMessage ? [{
    // 临时消息编号（messageId）使用发送前创建的本条消息编号。
    messageId: outgoingMessage.messageId,
    // 页面顺序号（sequenceNumber）让临时消息排在当前已保存会话末尾。
    sequenceNumber: outgoingMessage.sequenceNumber ?? conversation.messages.length,
    // 发言方类型（speakerType）使用 user 表示消息来自当前客户。
    speakerType: "user" as const,
    // 客户消息不具有人物身份。
    speakerPersonaId: null,
    // 消息正文（content）保存客户实际发送的文字。
    content: outgoingMessage.content,
    // 临时客户消息不直接回复某条内部消息。
    replyToMessageId: null,
    // 消息传递状态（deliveryStatus）根据请求结果显示发送中或失败。
    deliveryStatus: outgoingMessage.failed ? "failed" as const : "sending" as const,
    // 页面消息状态（status）与统一实时消息结构保持一致。
    status: outgoingMessage.failed ? "failed" as const : "sending" as const,
    // 截图编号列表（attachmentIds）保留本轮截图与消息的对应关系。
    attachmentIds: outgoingMessage.attachments.map((item) => item.id),
    // 截图预览（attachments）直接使用发送瞬间冻结的图片。
    attachments: outgoingMessage.attachments,
    // 消息创建时间（createdAt）保留客户点击发送的真实时间。
    createdAt: outgoingMessage.createdAt,
    // 失败消息已经结束生命周期，发送中消息仍未结束。
    completedAt: outgoingMessage.failed ? new Date().toISOString() : null,
  }] : [];
  // 直接问答时间线（timelineMessages）合并已保存问答和发送中的临时消息。
  const timelineMessages = mergeRealtimeConversationTimeline(directMessages, pendingMessages);
  // 非验收内部消息（nonAcceptanceMessages）排除专门用于验收交接的共享消息。
  const nonAcceptanceMessages = sharedInternalMessages.filter((message) => !message.messageId.startsWith("internal:acceptance:"));
  // 当前会话内部消息（conversationInternalMessages）是数据库已经保存的内部研讨。
  const conversationInternalMessages = projectPersonaConversation(conversation.messages).internal;
  // 内部消息对应项（internalEntries）按照消息编号准备去重输入。
  const internalEntries = [...nonAcceptanceMessages, ...conversationInternalMessages].map((message) => [message.messageId, message] as const);
  // 去重内部消息（uniqueInternalMessages）让同一内部事件只显示一次。
  const uniqueInternalMessages = [...new Map(internalEntries).values()];
  // 当前内部消息（currentInternal）去掉发生在本次会话建立之前的历史内容。
  const currentInternal = uniqueInternalMessages.filter((message) => !conversation.createdAt || message.createdAt >= conversation.createdAt);
  // 内部消息编号集合（internalIds）让页面标记哪些内容属于内部研讨。
  const internalIds = new Set(currentInternal.map((message) => message.messageId));
  // 可见内部消息（visibleInternalMessages）为内部研讨补充页面状态和截图预览。
  const visibleInternalMessages = currentInternal.map((message) => ({
    // 保留内部消息的来源、正文和关联信息。
    ...message,
    // 页面消息状态（status）使用内部消息已经保存的传递状态。
    status: message.deliveryStatus,
    // 截图预览（attachments）根据内部消息编号恢复图片证据。
    attachments: attachmentPreviews[message.messageId] || [],
  }));
  // 待排序页面消息（unsortedVisibleMessages）汇合直接问答与内部研讨。
  const unsortedVisibleMessages = [...timelineMessages, ...visibleInternalMessages];
  // 页面消息列表（visibleMessages）依次按发生时间、会话序号和消息编号确定最终顺序。
  const visibleMessages = unsortedVisibleMessages.sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.sequenceNumber - right.sequenceNumber || left.messageId.localeCompare(right.messageId));
  // 时间线变化标识（timelineIdentity）汇总消息编号、状态和正文，用于判断是否需要跟随最新消息。
  const timelineIdentity = visibleMessages.map((message) => `${message.messageId}:${message.status}:${message.content}`).join("|");
  // 会话区引用（timelineRef）绑定问答区域，在时间线变化后跟随最新消息。
  const timelineRef = usePersonaConversationTailFollow(timelineIdentity);
  // 是否允许发送（canSend）是发送按钮使用的统一判断结果。
  const canSend = !props.newConversationBusy && !chatBusy && Boolean(chatText.trim() || attachments.length);
  // 是否允许整理课题（canOpenTopicDraft）表示当前已有会话事实且不在重建过程。
  const canOpenTopicDraft = Boolean(conversation.messages.length) && !props.newConversationBusy;
  // 是否显示持续演化确认（showOneShotConfirmation）表示启动条件已具备但仍等待客户确认。
  const showOneShotConfirmation = state.oneShotConfirmation?.status === "awaiting-user-confirmation" && state.oneShotRun?.status !== "running";

  /** 从发送前附件区移除一张指定截图。 */
  function removeAttachment(attachmentId: string): void {
    // 根据稳定附件 ID 过滤目标，其他截图保持原顺序。
    onAttachments((current) => current.filter((item) => item.id !== attachmentId));
  }

  /** 接管输入框粘贴的图片文件。 */
  function pasteImages(event: ClipboardEvent<HTMLTextAreaElement>): void {
    // 剪贴板条目（clipboardItems）包含本次粘贴操作中的全部内容。
    const clipboardItems = Array.from(event.clipboardData.items);
    // 剪贴板图片条目（imageItems）只保留图片文件。
    const imageItems = clipboardItems.filter((item) => item.kind === "file" && item.type.startsWith("image/"));
    // 待保存图片文件（files）转换为可以交给截图能力处理的文件数组。
    const files = imageItems.map((item) => item.getAsFile()).filter((file): file is File => file !== null);
    // 没有图片时保留普通文字的默认粘贴行为。
    if (!files.length) return;
    // 已接管图片时阻止浏览器写入二进制内容。
    event.preventDefault();
    // 把图片交给父页面统一保存。
    onPaste(files);
  }

  // 返回页面结构真正需要的数据和具名操作。
  return {
    // 待发送文字（chatText）是问答输入框当前显示的内容。
    chatText,
    // 文字更新操作（setChatText）让页面在客户输入时保存最新内容。
    setChatText,
    // 消息发送等待状态（chatBusy）控制发送按钮和等待提示。
    chatBusy,
    // 课题草稿显示状态（topicDraftOpen）控制草稿区域是否显示。
    topicDraftOpen,
    // 草稿显示更新操作（setTopicDraftOpen）负责打开和关闭草稿区域。
    setTopicDraftOpen,
    // 草稿生成等待状态（topicDraftBusy）控制草稿生成按钮和等待提示。
    topicDraftBusy,
    // 草稿生成反馈（topicDraftFeedback）是生成完成后的可见说明。
    topicDraftFeedback,
    // 课题草稿（topicDraft）是课题表单当前填写的数据。
    topicDraft,
    // 草稿字段更新操作（updateTopicDraft）修改一项课题数据。
    updateTopicDraft,
    // 消息发送操作（sendChat）发送一轮人物问答。
    sendChat,
    // 课题保存操作（convertChat）保存客户确认过的完整课题。
    convertChat,
    // 草稿生成操作（generateTopicDraft）根据对话生成可编辑课题。
    generateTopicDraft,
    // 页面消息列表（visibleMessages）是页面最终展示的时间线。
    visibleMessages,
    // 内部消息编号集合（internalIds）让页面识别内部研讨消息。
    internalIds,
    // 会话区引用（timelineRef）绑定可以滚动的消息区域。
    timelineRef,
    // 截图恢复错误（attachmentPreviewErrors）提供附件无法恢复的原因。
    attachmentPreviewErrors,
    // 是否允许发送（canSend）控制主发送按钮是否可用。
    canSend,
    // 是否允许整理课题（canOpenTopicDraft）控制课题整理入口是否可用。
    canOpenTopicDraft,
    // 是否显示持续演化确认（showOneShotConfirmation）控制确认卡片是否出现。
    showOneShotConfirmation,
    // 新建会话反馈（newConversationFeedback）展示会话建立结果。
    newConversationFeedback,
    // 截图移除操作（removeAttachment）移除一张待发送图片。
    removeAttachment,
    // 图片粘贴操作（pasteImages）接管输入框粘贴的图片。
    pasteImages,
  };
}
