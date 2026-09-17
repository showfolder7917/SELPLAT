import { useCallback, useEffect, useRef, useState } from "react";

import type { CodexModelOptionOutDto, PersonaConversationMessageOutDto, PersonaConversationOutDto, PersonaConversationWindowOutDto, ReadPersonaConversationWindowInDto } from "../../../../contracts/system/desktop/index";
import { getOptionalCollaborationDesktopApi } from "../../../foundation/desktop-api";
import { getOptionalScreenshotDesktopApi } from "../../../foundation/desktop-api";
import { loadOfficialModelCatalog } from "../../../foundation/model-catalog";
import type { ComposerAttachment } from "./chat-message";
import { projectPersonaConversation } from "./realtime-conversation";

function emptyConversation(personaId: string): PersonaConversationOutDto {
  return { ownerPersonaId: personaId, conversationId: null, selectedModel: null, messages: [], updatedAt: new Date(0).toISOString() };
}

function readableDesktopError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/^Error invoking remote method '[^']+':\s*/, "");
}

function windowConversation(window: PersonaConversationWindowOutDto): PersonaConversationOutDto {
  return {
    ownerPersonaId: window.ownerPersonaId,
    conversationId: window.conversationId,
    selectedModel: window.selectedModel,
    createdAt: window.createdAt,
    messages: window.messages,
    updatedAt: window.updatedAt,
    activity: window.activity,
  };
}

/**
 * 正式桥接只按客户显示窗口读取；能力缺失时保留错误，禁止回退原始混合正文。
 */
async function readPersonaConversationWindow(
  desktop: ReturnType<typeof getOptionalCollaborationDesktopApi>,
  personaId: string,
  request?: ReadPersonaConversationWindowInDto,
): Promise<PersonaConversationWindowOutDto | undefined> {
  if (!desktop) return undefined;
  if (typeof desktop.getPersonaConversationWindow !== "function") {
    throw new Error("客户显示消息窗口读取能力尚未就绪，可在服务恢复后重试。");
  }
  return desktop.getPersonaConversationWindow(personaId, request);
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
  // 待发送文字属于人物会话而不是页面实例；切换页签卸载长页面时仍要保留客户草稿。
  const [draftText, setDraftText] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  // 发送中消息属于人物会话控制器；切换页面只卸载视图，不再丢失消息、失败状态或附件预览。
  const [pendingMessage, setPendingMessage] = useState<PersonaPendingMessage | null>(null);
  const [attachmentPreviews, setAttachmentPreviews] = useState<Record<string, ComposerAttachment[]>>({});
  const [attachmentPreviewErrors, setAttachmentPreviewErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  // 南宫婉页面读取韩立会话中唯一保存的内部研讨消息，不复制数据库记录。
  const [sharedInternalMessages, setSharedInternalMessages] = useState<PersonaConversationMessageOutDto[]>([]);
  const [newConversationBusy, setNewConversationBusy] = useState(false);
  // 新线程建立成功后只提示当前页面，不把旧线程的错误或等待状态带入新对话。
  const [newConversationFeedback, setNewConversationFeedback] = useState("");
  // 新建失败单独保存，页面只能据此显示“重新建立对话”的专用重试入口。
  const [newConversationError, setNewConversationError] = useState("");
  const [error, setError] = useState("");
  const [hasEarlier, setHasEarlier] = useState(false);
  // 每条原消息独立追踪重读，避免客户连续点击同一位置时并发写入同一派生记录。
  const [retryingCustomerDisplayMessageIds, setRetryingCustomerDisplayMessageIds] = useState<ReadonlySet<string>>(() => new Set());
  const retryingCustomerDisplayMessageIdsRef = useRef<Set<string>>(new Set());
  // 客户显示窗口的代际和目标会话共同决定页面可接受的异步结果。
  const conversationDisplay = useRef({ generation: 0, targetConversationId: null as string | null });
  // React 状态尚未完成刷新前，也要立即拒绝重复点击建立会话。
  const newConversationInFlight = useRef(false);
  // 官方模型目录只从 Codex bridge 读取，人物页面不维护固定模型列表。
  const [modelCatalog, setModelCatalog] = useState<CodexModelOptionOutDto[]>([]);
  const [modelCatalogLoading, setModelCatalogLoading] = useState(false);
  const [modelCatalogError, setModelCatalogError] = useState("");

  // 调查状态只使用主进程活动投影；排队、评估和解释不冒充南宫婉正在调查。
  const inquiryActivity = conversation.activity;
  const delegatedResponderPersonaId = personaId === "han-li"
    && inquiryActivity?.status === "running" && inquiryActivity.phase === "investigating"
    ? "nangong-wan" : null;

  /** 开始一次新的页面显示代际；旧窗口读取在返回后不再有资格覆盖当前页面。 */
  function beginConversationDisplayGeneration(targetConversationId: string | null): number {
    const generation = conversationDisplay.current.generation + 1;
    conversationDisplay.current = { generation, targetConversationId };
    return generation;
  }

  /** 只有同一代际、同一目标会话的客户显示窗口才能更新页面。 */
  function acceptsConversationWindow(
    generation: number,
    expectedConversationId: string | null,
    window: PersonaConversationWindowOutDto,
  ): boolean {
    if (conversationDisplay.current.generation !== generation) return false;
    if (conversationDisplay.current.targetConversationId !== expectedConversationId) return false;
    return expectedConversationId === null || window.conversationId === expectedConversationId;
  }

  useEffect(() => {
    let active = true;
    let receivedOwnUpdate = false;
    let receivedInternalUpdate = false;
    const currentConversationId = conversation.conversationId;
    const generation = beginConversationDisplayGeneration(currentConversationId);
    const desktop = getOptionalCollaborationDesktopApi();
    void readPersonaConversationWindow(desktop, personaId, { conversationId: currentConversationId })
      .then((value) => {
        if (!active || receivedOwnUpdate || !value || !acceptsConversationWindow(generation, currentConversationId, value)) return;
        // 初次读取没有稳定 ID 时，读取到的当前会话成为本代际唯一目标。
        if (currentConversationId === null) conversationDisplay.current = { generation, targetConversationId: value.conversationId };
        setConversation(windowConversation(value));
        setHasEarlier(value.hasEarlier);
      })
      .catch((reason) => { if (active) setError(readableDesktopError(reason, "无法读取人物会话。")); });
    if (personaId === "nangong-wan") {
      void desktop?.getPersonaConversation("han-li")
        .then((value) => { if (active && !receivedInternalUpdate && value) setSharedInternalMessages(projectPersonaConversation(value.messages).internal); })
        .catch((reason) => { if (active) setError(readableDesktopError(reason, "无法读取内部研讨消息。")); });
    }
    const removeListener = desktop?.onPersonaConversationChanged((value) => {
      if (!active) return;
      if (value.ownerPersonaId === personaId) {
        receivedOwnUpdate = true;
        void readPersonaConversationWindow(desktop, personaId, { conversationId: currentConversationId })
          .then((window) => {
            if (active && window && acceptsConversationWindow(generation, currentConversationId, window)) {
              setConversation((current) => ({
                ...windowConversation(window),
                activity: value.activity,
                contextReadStats: value.contextReadStats || current.contextReadStats,
              }));
              setHasEarlier(window.hasEarlier);
            }
          })
          .catch((reason) => { if (active) setError(readableDesktopError(reason, "无法刷新人物会话。")); });
      }
      if (personaId === "nangong-wan" && value.ownerPersonaId === "han-li") {
        receivedInternalUpdate = true;
        setSharedInternalMessages(projectPersonaConversation(value.messages).internal);
      }
    });
    return () => { active = false; removeListener?.(); };
  }, [personaId, conversation.conversationId]);

  const loadEarlier = useCallback(async () => {
    const earliest = conversation.messages[0];
    if (!earliest || !hasEarlier) return;
    const generation = conversationDisplay.current.generation;
    const conversationId = conversation.conversationId;
    try {
      const page = await readPersonaConversationWindow(getOptionalCollaborationDesktopApi(), personaId, { conversationId, beforeSequenceNumber: earliest.sequenceNumber });
      if (!page || !acceptsConversationWindow(generation, conversationId, page)) return;
      setConversation((current) => ({ ...current, messages: [...page.messages, ...current.messages.filter((message) => !page.messages.some((loaded) => loaded.messageId === message.messageId))] }));
      setHasEarlier(page.hasEarlier);
    } catch (reason) { setError(readableDesktopError(reason, "无法读取更早消息，请重试。")); }
  }, [conversation.conversationId, conversation.messages, hasEarlier, personaId]);

  /** 在同一气泡位置重试客户显示派生；成功后只刷新窗口投影，绝不读取原始正文。 */
  const retryCustomerDisplayMessage = useCallback(async (sourceMessageId: string) => {
    const desktop = getOptionalCollaborationDesktopApi();
    const conversationId = conversation.conversationId;
    const generation = conversationDisplay.current.generation;
    if (!desktop || !conversationId || retryingCustomerDisplayMessageIdsRef.current.has(sourceMessageId)) return;
    retryingCustomerDisplayMessageIdsRef.current.add(sourceMessageId);
    setRetryingCustomerDisplayMessageIds((current) => new Set(current).add(sourceMessageId));
    try {
      const window = await desktop.retryPersonaCustomerDisplayMessage(personaId, conversationId, sourceMessageId);
      if (acceptsConversationWindow(generation, conversationId, window)) {
        setConversation(windowConversation(window));
        setHasEarlier(window.hasEarlier);
      }
    } catch (reason) {
      setError(readableDesktopError(reason, "无法重新读取客户显示消息，请稍后重试。"));
    } finally {
      retryingCustomerDisplayMessageIdsRef.current.delete(sourceMessageId);
      setRetryingCustomerDisplayMessageIds((current) => {
        const next = new Set(current);
        next.delete(sourceMessageId);
        return next;
      });
    }
  }, [conversation.conversationId, personaId]);

  useEffect(() => {
    let active = true;
    setModelCatalogLoading(true);
    setModelCatalogError("");
    void loadOfficialModelCatalog()
      .then((catalog) => { if (active) setModelCatalog(catalog.models); })
      .catch((reason) => { if (active) setModelCatalogError(readableDesktopError(reason, "无法读取官方模型目录。")); })
      .finally(() => { if (active) setModelCatalogLoading(false); });
    return () => { active = false; };
  }, []);

  /** 客户主动重读时跳过成功缓存；失败仍保留在模型控件附近，不覆盖会话发送错误。 */
  const reloadModelCatalog = async () => {
    if (modelCatalogLoading) return;
    setModelCatalogLoading(true);
    setModelCatalogError("");
    try {
      const catalog = await loadOfficialModelCatalog(true);
      setModelCatalog(catalog.models);
    } catch (reason) {
      setModelCatalog([]);
      setModelCatalogError(readableDesktopError(reason, "无法读取官方模型目录。"));
    } finally {
      setModelCatalogLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const messages = [...conversation.messages, ...sharedInternalMessages];
    const attachmentIds = [...new Set(messages.flatMap((message) => message.attachmentIds || []))];
    if (!attachmentIds.length) return () => { active = false; };
    void Promise.all(attachmentIds.reduce<string[][]>((groups, id, index) => {
      if (index % 5 === 0) groups.push([]);
      groups.at(-1)!.push(id);
      return groups;
    }, []).map((ids) => getOptionalScreenshotDesktopApi()?.readAttachmentPreviews(ids))).then((groups) => {
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
    if (newConversationBusy || newConversationInFlight.current || sending) return;
    newConversationInFlight.current = true;
    // 新建开始即废止旧监听、补载和设置回执，创建完成前不接受任何旧窗口。
    const generation = beginConversationDisplayGeneration(null);
    setNewConversationBusy(true);
    setNewConversationFeedback("");
    setNewConversationError("");
    setError("");
    try {
      const desktop = getOptionalCollaborationDesktopApi();
      const value = await desktop?.newPersonaConversation(personaId);
      if (!value) throw new Error("新建人物会话服务没有返回结果。");
      if (!value.conversationId) throw new Error("新建人物会话没有返回有效会话标识。");
      if (conversationDisplay.current.generation !== generation) return;
      // 新建动作只授权这一个新会话的客户显示窗口进入页面。
      conversationDisplay.current = { generation, targetConversationId: value.conversationId };
      // 新建动作只提供会话标识；页面正文必须重新从客户显示窗口读取。
      const customerDisplay = await readPersonaConversationWindow(desktop, personaId, { conversationId: value.conversationId });
      if (!customerDisplay) throw new Error("新建人物会话后无法读取客户显示消息。");
      if (!acceptsConversationWindow(generation, value.conversationId, customerDisplay)) return;
      setConversation(windowConversation(customerDisplay));
      setHasEarlier(customerDisplay.hasEarlier);
      setDraftText("");
      setAttachments([]);
      setPendingMessage(null);
      setAttachmentPreviews({});
      setAttachmentPreviewErrors({});
      setError("");
      setNewConversationFeedback("已建立新的空白对话。");
    } catch (reason) {
      if (conversationDisplay.current.generation === generation) {
        setNewConversationError(readableDesktopError(reason, "无法新建人物会话。"));
      }
    } finally {
      if (conversationDisplay.current.generation === generation) setNewConversationBusy(false);
      newConversationInFlight.current = false;
    }
  };

  const selectModel = async (selectedModel: string | null) => {
    if (sending || newConversationBusy) return;
    const generation = conversationDisplay.current.generation;
    setError("");
    try {
      const desktop = getOptionalCollaborationDesktopApi();
      const value = await desktop?.selectPersonaConversationModel(personaId, selectedModel);
      if (!value) throw new Error("人物会话模型服务没有返回结果。");
      // 模型选择的全量回执不参与页面投影，避免旧混合正文借设置操作回流。
      const customerDisplay = await readPersonaConversationWindow(desktop, personaId, { conversationId: value.conversationId });
      if (!customerDisplay) throw new Error("保存人物对话模型后无法读取客户显示消息。");
      if (!acceptsConversationWindow(generation, value.conversationId, customerDisplay)) return;
      setConversation(windowConversation(customerDisplay));
      setHasEarlier(customerDisplay.hasEarlier);
    } catch (reason) {
      setError(readableDesktopError(reason, "无法保存人物对话模型。"));
    }
  };

  return {
    personaId, conversation, setConversation, draftText, setDraftText, attachments, setAttachments, hasEarlier, loadEarlier, retryCustomerDisplayMessage, retryingCustomerDisplayMessageIds,
    pendingMessage, setPendingMessage, attachmentPreviews, setAttachmentPreviews, attachmentPreviewErrors, setAttachmentPreviewErrors, sending, setSending,
    sharedInternalMessages, newConversationBusy, newConversationFeedback, newConversationError, error, setError, startNewConversation,
    delegatedResponderPersonaId, modelCatalog, modelCatalogLoading, modelCatalogError, reloadModelCatalog, selectModel,
  };
}

function attachmentPreviewError(reason: string): string {
  return reason === "not-found" || reason === "file-unavailable"
    ? "附件已被清理，当前无法读取预览。"
    : reason === "invalid-file" ? "附件文件不是有效 PNG，当前无法读取预览。"
      : "附件标识无效，当前无法读取预览。";
}
