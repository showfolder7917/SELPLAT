import type { DatabaseSync } from "node:sqlite";

import type { PersonaConversationMessageOutDto } from "../../../../../../contracts/services/personas/conversation/index.js";
import { derivePersonaCustomerDisplayMessage, PERSONA_CUSTOMER_DISPLAY_DERIVATION_VERSION } from "./persona-customer-display-message.projector.js";

/**
 * 唯一的客户显示派生写端口。
 *
 * 新消息写入和历史会话补写都经这里落库，保证两条路径使用同一版本、同一
 * 净化规则和同一审计字段。
 */
export function writePersonaCustomerDisplayMessage(
  connection: DatabaseSync,
  ownerPersonaId: string,
  conversationId: string,
  message: PersonaConversationMessageOutDto,
): void {
  // 当前消息与历史消息必须得到相同的客户显示分类，避免同一内部正文因写入时机泄露。
  const derived = derivePersonaCustomerDisplayMessage(message);
  connection.prepare(`
    INSERT INTO AiDesktopPersonaCustomerDisplayMessage
      (sourceMessageId, ownerPersonaId, conversationId, displayState, displayContent, failureReason, derivationVersion, derivedAt)
    VALUES ($sourceMessageId, $ownerPersonaId, $conversationId, $displayState, $displayContent, $failureReason, $derivationVersion, $derivedAt)
    ON CONFLICT(sourceMessageId) DO UPDATE SET
      displayState=excluded.displayState, displayContent=excluded.displayContent,
      failureReason=excluded.failureReason, derivationVersion=excluded.derivationVersion, derivedAt=excluded.derivedAt
  `).run({
    $sourceMessageId: message.messageId,
    $ownerPersonaId: ownerPersonaId,
    $conversationId: conversationId,
    $displayState: derived.state,
    $displayContent: derived.content,
    $failureReason: derived.failureReason,
    $derivationVersion: PERSONA_CUSTOMER_DISPLAY_DERIVATION_VERSION,
    $derivedAt: new Date().toISOString(),
  });
}
