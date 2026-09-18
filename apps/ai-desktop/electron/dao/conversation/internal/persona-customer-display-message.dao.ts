import type { DatabaseSync } from "node:sqlite";

import type { PersonaConversationMessageOutDto, PersonaCustomerDisplayStateValue } from "../../../../contracts/services/personas/conversation/index.js";

/** DAO 只接收业务层注入的纯投影器，不理解历史文案或人物规则。 */
export interface PersonaCustomerDisplayProjector {
  readonly version: number;
  derive(message: PersonaConversationMessageOutDto): {
    readonly state: PersonaCustomerDisplayStateValue;
    readonly content: string | null;
    readonly failureReason: string | null;
  };
}

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
  projector: PersonaCustomerDisplayProjector,
): void {
  // 当前消息与历史消息必须得到相同的客户显示分类，避免同一内部正文因写入时机泄露。
  const derived = projector.derive(message);
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
    $derivationVersion: projector.version,
    $derivedAt: new Date().toISOString(),
  });
}
