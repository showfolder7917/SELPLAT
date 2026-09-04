import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import type { PersonaConversationMessageOutDto, PersonaConversationOutDto } from "../../../../../../contracts/services/personas/conversation/index.js";
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
        SELECT conversationId, createdAt, updatedAt FROM AiDesktopPersonaConversation
        WHERE ownerPersonaId=$ownerPersonaId AND conversationId=$conversationId
      `).get({ $ownerPersonaId: requiredPersonaId(ownerPersonaId), $conversationId: requiredConversationId(conversationId) }) as {
        conversationId: string;
        createdAt: string;
        updatedAt: string;
      } | undefined;
      if (!header) return emptyConversation(ownerPersonaId);

      const rows = connection.prepare(`
        SELECT messageId, sequenceNumber, speakerType, speakerPersonaId, content, inferredIntent,
          attachmentIdsJson, replyToMessageId, deliveryStatus, createdAt, completedAt
        FROM AiDesktopPersonaConversationMessage
        WHERE ownerPersonaId=$ownerPersonaId AND conversationId=$conversationId
        ORDER BY sequenceNumber
      `).all({ $ownerPersonaId: ownerPersonaId, $conversationId: conversationId }) as unknown as Array<Record<string, unknown>>;
      return {
        ownerPersonaId,
        conversationId: header.conversationId,
        createdAt: header.createdAt,
        messages: rows.map(mapMessage),
        updatedAt: header.updatedAt,
      };
    });
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
        INSERT INTO AiDesktopPersonaConversation (conversationId, ownerPersonaId, status, createdAt, updatedAt)
        VALUES ($conversationId, $ownerPersonaId, 'active', $createdAt, $updatedAt)
        ON CONFLICT(conversationId) DO UPDATE SET status='active', updatedAt=excluded.updatedAt
      `).run({
        $conversationId: conversationId,
        $ownerPersonaId: ownerPersonaId,
        $createdAt: conversation.createdAt || conversation.messages[0]?.createdAt || conversation.updatedAt,
        $updatedAt: conversation.updatedAt,
      });
      for (const message of conversation.messages) upsertMessage(connection, ownerPersonaId, conversationId, message);
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
        INSERT INTO AiDesktopPersonaConversation (conversationId, ownerPersonaId, status, createdAt, updatedAt)
        VALUES ($conversationId, $ownerPersonaId, 'active', $now, $now)
      `).run({ $conversationId: conversationId, $ownerPersonaId: owner, $now: now });
    });
    return { ownerPersonaId: owner, conversationId, createdAt: now, messages: [], updatedAt: now };
  }
}

/** 数据库行只在这里转换成公共 DTO，人物页面不需要理解 JSON 字段。 */
function mapMessage(row: Record<string, unknown>): PersonaConversationMessageOutDto {
  return {
    messageId: String(row.messageId),
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

function upsertMessage(
  connection: DatabaseSync,
  ownerPersonaId: string,
  conversationId: string,
  message: PersonaConversationMessageOutDto,
): void {
  connection.prepare(`
    INSERT INTO AiDesktopPersonaConversationMessage
      (messageId, ownerPersonaId, conversationId, sequenceNumber, speakerType, speakerPersonaId, content,
       inferredIntent, attachmentIdsJson, replyToMessageId, deliveryStatus, createdAt, completedAt, recordedAt)
    VALUES ($messageId, $ownerPersonaId, $conversationId, $sequenceNumber, $speakerType, $speakerPersonaId, $content,
      $inferredIntent, $attachmentIds, $replyToMessageId, $deliveryStatus, $createdAt, $completedAt, $recordedAt)
    ON CONFLICT(messageId) DO UPDATE SET
      content=excluded.content, inferredIntent=excluded.inferredIntent, attachmentIdsJson=excluded.attachmentIdsJson,
      replyToMessageId=excluded.replyToMessageId, deliveryStatus=excluded.deliveryStatus,
      completedAt=excluded.completedAt, recordedAt=excluded.recordedAt
  `).run({
    $messageId: message.messageId,
    $ownerPersonaId: ownerPersonaId,
    $conversationId: conversationId,
    $sequenceNumber: message.sequenceNumber,
    $speakerType: message.speakerType,
    $speakerPersonaId: message.speakerType === "persona" ? requiredPersonaId(message.speakerPersonaId || "") : null,
    $content: message.content,
    $inferredIntent: message.inferredIntent || null,
    $attachmentIds: JSON.stringify(message.attachmentIds || []),
    $replyToMessageId: message.replyToMessageId,
    $deliveryStatus: message.deliveryStatus,
    $createdAt: message.createdAt,
    $completedAt: message.completedAt,
    $recordedAt: new Date().toISOString(),
  });
}

function emptyConversation(ownerPersonaId: string): PersonaConversationOutDto {
  return { ownerPersonaId: requiredPersonaId(ownerPersonaId), conversationId: null, messages: [], updatedAt: new Date(0).toISOString() };
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
