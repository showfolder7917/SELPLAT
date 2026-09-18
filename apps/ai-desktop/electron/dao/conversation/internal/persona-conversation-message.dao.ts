import type { DatabaseSync } from "node:sqlite";
import type { PersonaConversationMessageOutDto } from "../../../../contracts/services/personas/conversation/index.js";
import { writePersonaCustomerDisplayMessage, type PersonaCustomerDisplayProjector } from "./persona-customer-display-message.dao.js";

/** 统一人物消息写入：调用方持有事务；新消息只追加，既有身份保留序号，禁止跨会话覆盖。 */
export function writePersonaConversationMessage(
  connection: DatabaseSync,
  ownerPersonaId: string,
  conversationId: string,
  message: Omit<PersonaConversationMessageOutDto, "sequenceNumber">,
  mode: "append" | "update",
  projector: PersonaCustomerDisplayProjector,
): number {
  // 同一立即写事务内读取已登记身份与最大序号；业务缓存中的消息数量不是数据库序号。
  const existing = connection.prepare(`SELECT ownerPersonaId, conversationId, sequenceNumber FROM AiDesktopPersonaConversationMessage WHERE messageId=$messageId`)
    .get({ $messageId: message.messageId }) as { ownerPersonaId: string; conversationId: string; sequenceNumber: number } | undefined;
  if (existing && (existing.ownerPersonaId !== ownerPersonaId || existing.conversationId !== conversationId)) {
    throw new Error("消息身份属于其他人物或会话，不能覆盖。");
  }
  if (existing && mode === "append") return existing.sequenceNumber;
  const maximum = connection.prepare(`SELECT COALESCE(MAX(sequenceNumber), -1) AS value FROM AiDesktopPersonaConversationMessage
    WHERE ownerPersonaId=$ownerPersonaId AND conversationId=$conversationId`)
    .get({ $ownerPersonaId: ownerPersonaId, $conversationId: conversationId }) as { value: number };
  const sequenceNumber = existing?.sequenceNumber ?? Number(maximum.value) + 1;
  connection.prepare(`
    INSERT INTO AiDesktopPersonaConversationMessage
      (messageId, ownerPersonaId, conversationId, sequenceNumber, messageType, contentRole, speakerType, speakerPersonaId, content,
       inferredIntent, attachmentIdsJson, replyToMessageId, deliveryStatus, createdAt, completedAt, recordedAt)
    VALUES ($messageId, $ownerPersonaId, $conversationId, $sequenceNumber, $messageType, $contentRole, $speakerType, $speakerPersonaId, $content,
      $inferredIntent, $attachmentIds, $replyToMessageId, $deliveryStatus, $createdAt, $completedAt, $recordedAt)
    ON CONFLICT(messageId) DO UPDATE SET
      messageType=excluded.messageType, contentRole=excluded.contentRole, content=excluded.content, inferredIntent=excluded.inferredIntent, attachmentIdsJson=excluded.attachmentIdsJson,
      replyToMessageId=excluded.replyToMessageId, deliveryStatus=excluded.deliveryStatus,
      completedAt=excluded.completedAt, recordedAt=excluded.recordedAt
  `).run({
    $messageId: message.messageId,
    $ownerPersonaId: ownerPersonaId,
    $conversationId: conversationId,
    $sequenceNumber: sequenceNumber,
    $messageType: message.messageType,
    // 历史会话快照没有 contentRole；迁移默认值与写边界共同把它收敛为普通正文，禁止把 undefined 传给 SQLite。
    $contentRole: message.contentRole || "conversation",
    $speakerType: message.speakerType,
    $speakerPersonaId: message.speakerType === "persona" ? requiredSpeaker(message.speakerPersonaId) : null,
    $content: message.content,
    $inferredIntent: message.inferredIntent || null,
    $attachmentIds: JSON.stringify(message.attachmentIds || []),
    $replyToMessageId: message.replyToMessageId,
    $deliveryStatus: message.deliveryStatus,
    $createdAt: message.createdAt,
    $completedAt: message.completedAt,
    $recordedAt: new Date().toISOString(),
  });
  writePersonaCustomerDisplayMessage(connection, ownerPersonaId, conversationId, { ...message, sequenceNumber }, projector);
  return sequenceNumber;
}

function requiredSpeaker(value: string | null): string {
  const speaker = value?.trim();
  if (!speaker) throw new Error("人物消息缺少发言人身份。");
  return speaker;
}
