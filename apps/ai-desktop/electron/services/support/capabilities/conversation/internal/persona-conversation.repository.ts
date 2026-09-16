import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { writePersonaConversationMessage } from "./persona-conversation-message.writer.js";
import { PERSONA_CUSTOMER_DISPLAY_DERIVATION_VERSION } from "./persona-customer-display-message.projector.js";
import { writePersonaCustomerDisplayMessage } from "./persona-customer-display-message.writer.js";

import type { PersonaConversationMessageOutDto, PersonaConversationOutDto, PersonaConversationWindowOutDto, PersonaCustomerDisplayStateValue, ReadPersonaConversationWindowInDto } from "../../../../../../contracts/services/personas/conversation/index.js";
import type { DatabasePort } from "../../../platform/persistence/index.js";

/**
 * 所有人物共享的会话仓储。
 *
 * 新手阅读提示：业务服务只传入 personaId 和会话对象，本类负责把对象翻译成 SQL。
 * 韩立、南宫婉以及未来人物都不能再创建自己的消息表或直接复制这组查询。
 */
export class PersonaConversationRepository {
  constructor(private readonly database: DatabasePort | null) {}

  /** 读取某个人物的当前活动会话；首次使用或数据库不可用时返回可显示的空会话。 */
  readActive(ownerPersonaId: string): PersonaConversationOutDto {
    if (!this.database) return emptyConversation(ownerPersonaId);
    const conversationId = this.database.withConnection((connection) => {
      const row = connection.prepare(`
        SELECT conversationId FROM AiDesktopPersonaConversation
        WHERE ownerPersonaId=$ownerPersonaId AND status='active'
        LIMIT 1
      `).get({ $ownerPersonaId: requiredPersonaId(ownerPersonaId) }) as { conversationId: string } | undefined;
      return row?.conversationId || null;
    });
    return conversationId ? this.read(ownerPersonaId, conversationId) : emptyConversation(ownerPersonaId);
  }

  /** 按稳定会话 ID 恢复完整消息；ownerPersonaId 防止跨人物误读同名会话。 */
  read(ownerPersonaId: string, conversationId: string): PersonaConversationOutDto {
    if (!this.database) return emptyConversation(ownerPersonaId);
    return this.database.withConnection((connection) => {
      const header = connection.prepare(`
        SELECT conversationId, selectedModel, createdAt, updatedAt FROM AiDesktopPersonaConversation
        WHERE ownerPersonaId=$ownerPersonaId AND conversationId=$conversationId
      `).get({ $ownerPersonaId: requiredPersonaId(ownerPersonaId), $conversationId: requiredConversationId(conversationId) }) as {
        conversationId: string;
        selectedModel: string | null;
        createdAt: string;
        updatedAt: string;
      } | undefined;
      if (!header) return emptyConversation(ownerPersonaId);

      const rows = connection.prepare(`
        SELECT messageId, sequenceNumber, messageType, contentRole, speakerType, speakerPersonaId, content, inferredIntent,
          attachmentIdsJson, replyToMessageId, deliveryStatus, createdAt, completedAt
        FROM AiDesktopPersonaConversationMessage
        WHERE ownerPersonaId=$ownerPersonaId AND conversationId=$conversationId
        ORDER BY sequenceNumber
      `).all({ $ownerPersonaId: ownerPersonaId, $conversationId: conversationId }) as unknown as Array<Record<string, unknown>>;
      return {
        ownerPersonaId,
        conversationId: header.conversationId,
        selectedModel: header.selectedModel,
        createdAt: header.createdAt,
        messages: rows.map(mapMessage),
        updatedAt: header.updatedAt,
      };
    });
  }

  /** 读取客户显示投影；返回值不携带任何原始 customer-visible content。 */
  readCustomerDisplay(ownerPersonaId: string, conversationId?: string | null): PersonaConversationOutDto {
    if (!this.database) return emptyConversation(ownerPersonaId);
    const owner = requiredPersonaId(ownerPersonaId);
    const conversation = conversationId?.trim() || this.activeConversationId(owner);
    if (!conversation) return emptyConversation(owner);
    this.ensureCustomerDisplayRecords(owner, conversation);
    return this.database.withConnection((connection) => {
      const header = connection.prepare(`SELECT conversationId, selectedModel, createdAt, updatedAt FROM AiDesktopPersonaConversation
        WHERE ownerPersonaId=$owner AND conversationId=$conversation`).get({ $owner: owner, $conversation: conversation }) as HeaderRow | undefined;
      if (!header) return emptyConversation(owner);
      const rows = connection.prepare(customerDisplayRowsSql("ORDER BY source.sequenceNumber"))
        .all({ $owner: owner, $conversation: conversation }) as unknown as Array<Record<string, unknown>>;
      return { ownerPersonaId: owner, conversationId: header.conversationId, selectedModel: header.selectedModel, createdAt: header.createdAt,
        messages: rows.map(mapCustomerDisplayMessage), updatedAt: header.updatedAt };
    });
  }

  /** 页面与历史补载唯一使用的客户显示窗口；内部和审计正文不能经此端口返回。 */
  readCustomerDisplayWindow(ownerPersonaId: string, request: ReadPersonaConversationWindowInDto = {}): PersonaConversationWindowOutDto {
    if (!this.database) return emptyWindow(ownerPersonaId);
    const owner = requiredPersonaId(ownerPersonaId);
    const limit = normalizedWindowLimit(request.limit);
    const conversation = request.conversationId?.trim() || this.activeConversationId(owner);
    if (!conversation) return emptyWindow(owner);
    this.ensureCustomerDisplayRecords(owner, conversation);
    return this.database.withConnection((connection) => {
      const header = connection.prepare("SELECT conversationId, selectedModel, createdAt, updatedAt FROM AiDesktopPersonaConversation WHERE ownerPersonaId=$owner AND conversationId=$conversation")
        .get({ $owner: owner, $conversation: conversation }) as HeaderRow | undefined;
      if (!header) return emptyWindow(owner);
      const before = Number.isInteger(request.beforeSequenceNumber) ? Number(request.beforeSequenceNumber) : Number.MAX_SAFE_INTEGER;
      const rows = connection.prepare(customerDisplayRowsSql("AND source.sequenceNumber<$before ORDER BY source.sequenceNumber DESC LIMIT $limit"))
        .all({ $owner: owner, $conversation: conversation, $before: before, $limit: limit }) as unknown as Array<Record<string, unknown>>;
      const messages = rows.reverse().map(mapCustomerDisplayMessage);
      const earliest = messages[0]?.sequenceNumber;
      const hasEarlier = earliest === undefined ? false : Boolean(connection.prepare(`
        SELECT 1 FROM AiDesktopPersonaConversationMessage AS source
        LEFT JOIN AiDesktopPersonaCustomerDisplayMessage AS display ON display.sourceMessageId=source.messageId
        WHERE source.ownerPersonaId=$owner AND source.conversationId=$conversation
          AND (display.displayState IS NULL OR display.displayState<>'excluded') AND source.sequenceNumber<$earliest LIMIT 1
      `).get({ $owner: owner, $conversation: conversation, $earliest: earliest }));
      return { ownerPersonaId: owner, conversationId: header.conversationId, selectedModel: header.selectedModel, createdAt: header.createdAt,
        updatedAt: header.updatedAt, messages, hasEarlier };
    });
  }

  /** 客户主动重新读取失败位置，只重算对应派生记录且绝不展示原始正文。 */
  retryCustomerDisplayMessage(ownerPersonaId: string, conversationId: string, sourceMessageId: string): void {
    if (!this.database) throw new Error("AI Memory 数据库当前不可用，无法重新读取客户消息。");
    const owner = requiredPersonaId(ownerPersonaId);
    const conversation = requiredConversationId(conversationId);
    this.database.transaction((connection) => this.ensureCustomerDisplayRecords(owner, conversation, sourceMessageId, connection, true));
  }

  /**
   * 保存页面当前会话投影。
   * 旧活动会话先归档，新会话再成为唯一 active；消息按 messageId 幂等更新。
   */
  save(conversation: PersonaConversationOutDto): PersonaConversationOutDto {
    if (!this.database) throw new Error("AI Memory 数据库当前不可用，人物会话不能保存。");
    const ownerPersonaId = requiredPersonaId(conversation.ownerPersonaId);
    const conversationId = requiredConversationId(conversation.conversationId);
    this.database.transaction((connection) => {
      connection.prepare(`
        UPDATE AiDesktopPersonaConversation SET status='archived'
        WHERE ownerPersonaId=$ownerPersonaId AND status='active' AND conversationId<>$conversationId
      `).run({ $ownerPersonaId: ownerPersonaId, $conversationId: conversationId });
      connection.prepare(`
        INSERT INTO AiDesktopPersonaConversation (conversationId, ownerPersonaId, status, selectedModel, createdAt, updatedAt)
        VALUES ($conversationId, $ownerPersonaId, 'active', $selectedModel, $createdAt, $updatedAt)
        ON CONFLICT(conversationId) DO UPDATE SET
          status='active',
          -- Evolution 只投影正文和流程状态；模型选择始终由会话头的专用写入保留。
          selectedModel=COALESCE(excluded.selectedModel, AiDesktopPersonaConversation.selectedModel),
          updatedAt=excluded.updatedAt
      `).run({
        $conversationId: conversationId,
        $ownerPersonaId: ownerPersonaId,
        $selectedModel: normalizedModel(conversation.selectedModel),
        $createdAt: conversation.createdAt || conversation.messages[0]?.createdAt || conversation.updatedAt,
        $updatedAt: conversation.updatedAt,
      });
      for (const message of conversation.messages) writePersonaConversationMessage(connection, ownerPersonaId, conversationId, message, "update");
    });
    return this.read(ownerPersonaId, conversationId);
  }

  /** 新建业务会话只归档旧会话，不删除历史消息或训练语料。 */
  create(ownerPersonaId: string): PersonaConversationOutDto {
    if (!this.database) throw new Error("AI Memory 数据库当前不可用，人物会话不能新建。");
    const owner = requiredPersonaId(ownerPersonaId);
    const now = new Date().toISOString();
    const conversationId = `persona-conversation-${randomUUID()}`;
    this.database.transaction((connection) => {
      connection.prepare(`UPDATE AiDesktopPersonaConversation SET status='archived' WHERE ownerPersonaId=$ownerPersonaId AND status='active'`)
        .run({ $ownerPersonaId: owner });
      connection.prepare(`
        INSERT INTO AiDesktopPersonaConversation (conversationId, ownerPersonaId, status, selectedModel, createdAt, updatedAt)
        VALUES ($conversationId, $ownerPersonaId, 'active', NULL, $now, $now)
      `).run({ $conversationId: conversationId, $ownerPersonaId: owner, $now: now });
    });
    return { ownerPersonaId: owner, conversationId, selectedModel: null, createdAt: now, messages: [], updatedAt: now };
  }

  /** 只更新当前会话头的模型选择，不重写消息正文或 Evolution 运行状态。 */
  selectModel(ownerPersonaId: string, conversationId: string, selectedModel: string | null): PersonaConversationOutDto {
    if (!this.database) throw new Error("AI Memory 数据库当前不可用，人物会话模型不能保存。");
    const owner = requiredPersonaId(ownerPersonaId);
    const conversation = requiredConversationId(conversationId);
    const now = new Date().toISOString();
    this.database.transaction((connection) => {
      connection.prepare(`UPDATE AiDesktopPersonaConversation SET selectedModel=$selectedModel, updatedAt=$updatedAt
        WHERE ownerPersonaId=$ownerPersonaId AND conversationId=$conversationId`).run({
        $ownerPersonaId: owner, $conversationId: conversation, $selectedModel: normalizedModel(selectedModel), $updatedAt: now,
      });
      const changed = connection.prepare("SELECT changes() AS count").get() as { count: number };
      if (changed.count === 0) {
        throw new Error("当前人物会话不存在，不能保存模型选择。");
      }
    });
    return this.read(owner, conversation);
  }

  private activeConversationId(ownerPersonaId: string): string | null {
    if (!this.database) return null;
    return this.database.withConnection((connection) => {
      const row = connection.prepare("SELECT conversationId FROM AiDesktopPersonaConversation WHERE ownerPersonaId=$owner AND status='active' LIMIT 1")
        .get({ $owner: ownerPersonaId }) as { conversationId: string } | undefined;
      return row?.conversationId || null;
    });
  }

  /** 为旧记录补写可审计投影；失败状态可由指定的重试请求重新生成。 */
  private ensureCustomerDisplayRecords(ownerPersonaId: string, conversationId: string, sourceMessageId?: string, existingConnection?: DatabaseSync, force = false): void {
    if (!this.database) return;
    const write = (connection: DatabaseSync) => {
      const sourceMessageFilter = sourceMessageId ? "AND messageId=$sourceMessageId" : "";
      const statement = connection.prepare(`SELECT messageId, sequenceNumber, messageType, contentRole, speakerType, speakerPersonaId, content,
        attachmentIdsJson, replyToMessageId, deliveryStatus, createdAt, completedAt FROM AiDesktopPersonaConversationMessage
        WHERE ownerPersonaId=$owner AND conversationId=$conversation ${sourceMessageFilter}`);
      // 分支分别调用 SQLite，避免条件对象被推断为含 undefined 可选字段的联合类型。
      const rows = sourceMessageId
        ? statement.all({ $owner: ownerPersonaId, $conversation: conversationId, $sourceMessageId: sourceMessageId })
        : statement.all({ $owner: ownerPersonaId, $conversation: conversationId });
      for (const row of rows) {
        const existing = connection.prepare("SELECT derivationVersion FROM AiDesktopPersonaCustomerDisplayMessage WHERE sourceMessageId=$messageId")
          .get({ $messageId: String(row.messageId) }) as { derivationVersion: number } | undefined;
        if (!force && existing && Number(existing.derivationVersion) >= PERSONA_CUSTOMER_DISPLAY_DERIVATION_VERSION) continue;
        // 版本落后的记录只负责触发重算；正文安全分类由唯一派生器统一决定。
        writePersonaCustomerDisplayMessage(connection, ownerPersonaId, conversationId, mapMessage(row));
      }
    };
    if (existingConnection) write(existingConnection);
    else this.database.transaction(write);
  }
}

interface HeaderRow { conversationId: string; selectedModel: string | null; createdAt: string; updatedAt: string; }

/** 数据库行只在这里转换成公共 DTO，人物页面不需要理解 JSON 字段。 */
function mapMessage(row: Record<string, unknown>): PersonaConversationMessageOutDto {
  return {
    messageId: String(row.messageId),
    messageType: row.messageType as PersonaConversationMessageOutDto["messageType"],
    contentRole: (row.contentRole || "conversation") as PersonaConversationMessageOutDto["contentRole"],
    sequenceNumber: Number(row.sequenceNumber),
    speakerType: row.speakerType as PersonaConversationMessageOutDto["speakerType"],
    speakerPersonaId: row.speakerPersonaId ? String(row.speakerPersonaId) : null,
    content: String(row.content),
    replyToMessageId: row.replyToMessageId ? String(row.replyToMessageId) : null,
    deliveryStatus: row.deliveryStatus as PersonaConversationMessageOutDto["deliveryStatus"],
    ...(row.inferredIntent ? { inferredIntent: String(row.inferredIntent) } : {}),
    attachmentIds: parseStringArray(row.attachmentIdsJson),
    createdAt: String(row.createdAt),
    completedAt: row.completedAt ? String(row.completedAt) : null,
  };
}

/** 客户显示 DTO 只从派生字段读取 content；缺失或失败消息保留位置但没有原始正文。 */
function mapCustomerDisplayMessage(row: Record<string, unknown>): PersonaConversationMessageOutDto {
  const state = String(row.displayState || "missing") as PersonaCustomerDisplayStateValue;
  const content = state === "ready" ? String(row.displayContent || "") : state === "failed"
    ? "此消息暂时无法安全显示。" : "此消息正在准备显示。";
  return { ...mapMessage(row), content, customerDisplayState: state,
    customerDisplayFailureReason: row.failureReason ? String(row.failureReason) : null };
}

function customerDisplayRowsSql(suffix: string): string {
  return `SELECT source.messageId, source.sequenceNumber, source.messageType, source.contentRole, source.speakerType, source.speakerPersonaId,
    source.inferredIntent, source.attachmentIdsJson, source.replyToMessageId, source.deliveryStatus, source.createdAt, source.completedAt,
    display.displayState, display.displayContent, display.failureReason
    FROM AiDesktopPersonaConversationMessage AS source
    LEFT JOIN AiDesktopPersonaCustomerDisplayMessage AS display ON display.sourceMessageId=source.messageId
    WHERE source.ownerPersonaId=$owner AND source.conversationId=$conversation
      AND (display.displayState IS NULL OR display.displayState<>'excluded') ${suffix}`;
}


function emptyConversation(ownerPersonaId: string): PersonaConversationOutDto {
  return { ownerPersonaId: requiredPersonaId(ownerPersonaId), conversationId: null, selectedModel: null, messages: [], updatedAt: new Date(0).toISOString() };
}

function emptyWindow(ownerPersonaId: string): PersonaConversationWindowOutDto {
  return { ownerPersonaId: requiredPersonaId(ownerPersonaId), conversationId: null, selectedModel: null, messages: [], hasEarlier: false, updatedAt: new Date(0).toISOString() };
}

function normalizedWindowLimit(value: number | undefined): number {
  return Number.isInteger(value) ? Math.max(20, Math.min(Number(value), 100)) : 60;
}

function normalizedModel(value: string | null | undefined): string | null {
  const model = value?.trim() || "";
  return model || null;
}

function requiredPersonaId(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error("人物 ID 不能为空。");
  return normalized;
}

function requiredConversationId(value: string | null): string {
  const normalized = value?.trim() || "";
  if (!normalized) throw new Error("人物会话 ID 不能为空。");
  return normalized;
}

function parseStringArray(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
