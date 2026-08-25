import { randomUUID } from "node:crypto";

import type { ApprovalMemoryEvidence, CollaborationMemoryMessage, CollaborationMemoryPort, ConversationRoundTopicDecision } from "../../../contracts/collaboration-memory.js";
import type { EvolutionProposalOrigin, EvolutionProposalType, NangongConversation, NangongEvolutionState } from "../../../contracts/nangong-evolution.js";
import type { SqliteDatabase } from "./persistence/sqlite-database.js";

const CURRENT_CONVERSATION_TURN_LIMIT = 20;
const HISTORICAL_USER_CONCERN_LIMIT = 8;
const APPROVAL_EVIDENCE_LIMIT = 12;

/** 保存用户与南宫婉完整原文，并通过受控查询为后续调查和韩立审批提供上下文。 */
export class CollaborationMemoryService implements CollaborationMemoryPort {
  readonly #database: SqliteDatabase;

  constructor(database: SqliteDatabase) {
    this.#database = database;
  }

  syncConversation(conversation: NangongConversation): void {
    this.#database.transaction((connection) => {
      const upsert = connection.prepare(`
        INSERT INTO AiDesktopConversationMemory
          (messageId, conversationId, sequenceNumber, role, content, contentPreview, inferredIntent, createdAt, recordedAt)
        VALUES ($messageId, $conversationId, $sequenceNumber, $role, $content, $contentPreview, $inferredIntent, $createdAt, $recordedAt)
        ON CONFLICT(messageId) DO UPDATE SET
          conversationId=excluded.conversationId, sequenceNumber=excluded.sequenceNumber,
          role=excluded.role, content=excluded.content, contentPreview=excluded.contentPreview,
          inferredIntent=excluded.inferredIntent, createdAt=excluded.createdAt
      `);
      conversation.messages.forEach((message, sequenceNumber) => upsert.run({
        $messageId: message.messageId,
        $conversationId: conversation.conversationId,
        $sequenceNumber: sequenceNumber,
        $role: message.role,
        // 用户与南宫婉原文都完整保存；预览只是独立展示字段，不能替代分析原文。
        $content: message.content,
        $contentPreview: preview(message.content),
        $inferredIntent: message.inferredIntent || null,
        $createdAt: message.createdAt,
        $recordedAt: new Date().toISOString(),
      }));
    });
  }

  syncEvolutionState(state: NangongEvolutionState): void {
    this.syncConversation(state.conversation);
    this.#database.transaction((connection) => {
      const insert = connection.prepare(`
        INSERT OR IGNORE INTO AiDesktopConversationTopicLink (topicId, conversationId, messageId, linkedAt)
        SELECT $topicId, conversationId, messageId, $linkedAt
        FROM AiDesktopConversationMemory
        WHERE messageId = $messageId
      `);
      for (const topic of state.topics) {
        for (const messageId of topic.sourceConversationMessageIds) insert.run({
          $topicId: topic.topicId,
          $messageId: messageId,
          $linkedAt: topic.createdAt,
        });
      }
    });
  }

  buildNangongContext(conversation: NangongConversation): string {
    this.syncConversation(conversation);
    const current = conversation.messages.slice(-CURRENT_CONVERSATION_TURN_LIMIT)
      // 用户原话是方向事实，保持完整；AI 回答使用独立预览，避免长回复挤占后续分析上下文。
      .map((item) => item.role === "user"
        ? `用户：${item.content}${item.inferredIntent ? `\nAI登记的用户意图：${item.inferredIntent}` : ""}`
        : `南宫婉：${preview(item.content)}`);
    const historical = this.#database.withConnection((connection) => connection.prepare(`
      SELECT messageId, conversationId, sequenceNumber, role, content, contentPreview, inferredIntent, createdAt
      FROM AiDesktopConversationMemory
      WHERE role = 'user' AND conversationId <> $conversationId
      ORDER BY createdAt DESC
      LIMIT $limit
    `).all({ $conversationId: conversation.conversationId, $limit: HISTORICAL_USER_CONCERN_LIMIT }) as unknown as CollaborationMemoryMessage[])
      .reverse()
      .map((item) => `用户历史原话：${item.content}${item.inferredIntent ? `\nAI登记的用户意图：${item.inferredIntent}` : ""}`);
    return [
      historical.length ? `用户以往关心的事项（保持原话）：\n${historical.join("\n\n")}` : "",
      current.length ? `当前南宫婉对话：\n${current.join("\n\n")}` : "",
    ].filter(Boolean).join("\n\n");
  }

  approvalEvidence(proposalType: EvolutionProposalType, origin: EvolutionProposalOrigin): ApprovalMemoryEvidence[] {
    return this.#database.withConnection((connection) => connection.prepare(`
      SELECT approval.approvalId, approval.proposalType, run.origin, approval.decision, approval.advice, approval.approvedAt
      FROM AiDesktopApprovalRecord approval
      JOIN AiDesktopWorkflowRun run ON run.proposalId = approval.proposalId
      WHERE approval.source = 'manual-user' AND approval.proposalType = $proposalType AND run.origin = $origin
      ORDER BY approval.approvedAt DESC
      LIMIT $limit
    `).all({ $proposalType: proposalType, $origin: origin, $limit: APPROVAL_EVIDENCE_LIMIT }) as unknown as ApprovalMemoryEvidence[]);
  }

  registerRound(conversation: NangongConversation, userMessageId: string, nangongMessageId: string, decision: ConversationRoundTopicDecision): void {
    this.syncConversation(conversation);
    const now = new Date().toISOString();
    this.#database.transaction((connection) => {
      const current = connection.prepare(`
        SELECT conversationTopicId, title, topicType
        FROM AiDesktopConversationTopic
        WHERE conversationId = $conversationId AND state = 'active'
        ORDER BY updatedAt DESC LIMIT 1
      `).get({ $conversationId: conversation.conversationId }) as { conversationTopicId: string; title: string; topicType: string } | undefined;
      const normalizedTitle = normalizeTopicValue(decision.title, "待分类主题");
      const normalizedType = normalizeTopicValue(decision.type, "待分类");
      let conversationTopicId = current?.conversationTopicId;
      if (!current || decision.switchTopic) {
        if (current) connection.prepare(`
          UPDATE AiDesktopConversationTopic SET state = 'closed', endedAt = $now, updatedAt = $now
          WHERE conversationTopicId = $conversationTopicId
        `).run({ $now: now, $conversationTopicId: current.conversationTopicId });
        conversationTopicId = `conversation-topic-${randomUUID()}`;
        connection.prepare(`
          INSERT INTO AiDesktopConversationTopic
            (conversationTopicId, conversationId, title, topicType, state, detectedFromMessageId, startedAt, endedAt, updatedAt)
          VALUES ($conversationTopicId, $conversationId, $title, $topicType, 'active', $messageId, $now, NULL, $now)
        `).run({
          $conversationTopicId: conversationTopicId,
          $conversationId: conversation.conversationId,
          $title: normalizedTitle,
          $topicType: normalizedType,
          $messageId: userMessageId,
          $now: now,
        });
      } else if (current.title === "待分类主题" || current.topicType === "待分类") {
        connection.prepare(`
          UPDATE AiDesktopConversationTopic SET title = $title, topicType = $topicType, updatedAt = $now
          WHERE conversationTopicId = $conversationTopicId
        `).run({ $title: normalizedTitle, $topicType: normalizedType, $now: now, $conversationTopicId: current.conversationTopicId });
      }
      connection.prepare(`
        UPDATE AiDesktopConversationMemory SET conversationTopicId = $conversationTopicId
        WHERE messageId IN ($userMessageId, $nangongMessageId)
      `).run({ $conversationTopicId: conversationTopicId!, $userMessageId: userMessageId, $nangongMessageId: nangongMessageId });
    });
  }
}

function preview(content: string): string {
  const normalized = content.replaceAll(/\s+/g, " ").trim();
  const characters = Array.from(normalized);
  return characters.length <= 80 ? normalized : `${characters.slice(0, 80).join("")}…`;
}

function normalizeTopicValue(value: string, fallback: string): string {
  const normalized = typeof value === "string" ? value.replaceAll(/\s+/g, " ").trim() : "";
  return normalized.slice(0, 120) || fallback;
}
