import { randomUUID } from "node:crypto";

import type { ApprovalMemoryEvidence, CollaborationMemoryMessage, CollaborationMemoryPort, ConversationRoundTopicDecision, TrainingCorpusTopicSearchResult } from "../../../contracts/collaboration/collaboration-memory.js";
import type { EvolutionProposalOrigin, EvolutionProposalType, EvolutionSourceMessageSnapshot, NangongConversation, NangongEvolutionState } from "../../../contracts/collaboration/nangong-evolution.js";
import type { SqliteDatabase } from "./persistence/sqlite-database.js";

const CURRENT_CONVERSATION_TURN_LIMIT = 20;
const HISTORICAL_USER_CONCERN_LIMIT = 8;
const APPROVAL_EVIDENCE_LIMIT = 12;
const EVOLUTION_NANGONG_MESSAGE_LIMIT = 800;
const EVOLUTION_CODEX_USER_MESSAGE_LIMIT = 600;
const EVOLUTION_CODEX_AI_PREVIEW_LIMIT = 120;

/** 保存用户与南宫婉完整原文，并通过受控查询为后续调查和韩立审批提供上下文。 */
export class CollaborationMemoryService implements CollaborationMemoryPort {
  readonly #database: SqliteDatabase;

  constructor(database: SqliteDatabase) {
    this.#database = database;
  }

  syncConversation(conversation: NangongConversation): void {
    const completedMessages = conversation.messages.filter((message) => message.deliveryStatus === undefined || message.deliveryStatus === "completed");
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
      const upsertCorpusTopic = connection.prepare(`
        INSERT INTO AiDesktopTrainingCorpusTopic
          (corpusTopicId, source, sourceConversationId, sourceTurnId, title, topicType, inferredIntent,
           tagsJson, definitionSource, createdAt, updatedAt)
        VALUES ($topicId, 'nangong', $conversationId, $turnId, '待 AI 归类', '待归类', NULL,
          '[]', 'pending', $createdAt, $recordedAt)
        ON CONFLICT(corpusTopicId) DO NOTHING
      `);
      const insertUserCorpus = connection.prepare(`
        INSERT INTO AiDesktopTrainingCorpusMessage
          (corpusMessageId, corpusTopicId, source, sourceConversationId, sourceTurnId, sourceMessageId,
           sequenceNumber, speakerRole, content, contentRetention, evidenceTier, createdAt, recordedAt)
        VALUES ($corpusMessageId, $topicId, 'nangong', $conversationId, $turnId, $messageId,
          $sequenceNumber, 'user', $content, 'exact', 'primary', $createdAt, $recordedAt)
        ON CONFLICT(corpusMessageId) DO NOTHING
      `);
      completedMessages.forEach((message, fallbackSequenceNumber) => upsert.run({
        $messageId: message.messageId,
        $conversationId: conversation.conversationId,
        $sequenceNumber: Number.isSafeInteger(message.sequenceNumber) ? message.sequenceNumber : fallbackSequenceNumber,
        $role: message.role,
        // 用户与南宫婉原文都完整保存；预览只是独立展示字段，不能替代分析原文。
        $content: message.content,
        $contentPreview: preview(message.content),
        $inferredIntent: message.inferredIntent || null,
        $createdAt: message.createdAt,
        $recordedAt: new Date().toISOString(),
      }));
      completedMessages.forEach((message, fallbackSequenceNumber) => {
        if (message.role !== "user") return;
        const recordedAt = new Date().toISOString();
        const topicId = `corpus-topic:nangong:${conversation.conversationId}:${message.messageId}`;
        upsertCorpusTopic.run({
          $topicId: topicId, $conversationId: conversation.conversationId, $turnId: message.messageId,
          $createdAt: message.createdAt, $recordedAt: recordedAt,
        });
        insertUserCorpus.run({
          $corpusMessageId: `corpus:nangong:${message.messageId}`, $topicId: topicId,
          $conversationId: conversation.conversationId, $turnId: message.messageId, $messageId: message.messageId,
          $sequenceNumber: Number.isSafeInteger(message.sequenceNumber) ? message.sequenceNumber : fallbackSequenceNumber, $content: message.content, $createdAt: message.createdAt, $recordedAt: recordedAt,
        });
      });
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

  searchTrainingCorpusTopics(query: string, limit = 30): TrainingCorpusTopicSearchResult[] {
    const normalized = query.replaceAll(/\s+/g, " ").trim().slice(0, 100);
    if (!normalized) return [];
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    return this.#database.withConnection((connection) => {
      const phrase = `"${normalized.replaceAll('"', '""')}"`;
      const like = `%${normalized}%`;
      const topics = connection.prepare(`
        SELECT corpusTopicId, source, title, topicType, inferredIntent, tagsJson,
          definitionSource, createdAt
        FROM AiDesktopTrainingCorpusTopic
        WHERE title LIKE $like OR topicType LIKE $like OR tagsJson LIKE $like OR inferredIntent LIKE $like
          OR corpusTopicId IN (
            SELECT corpusTopicId FROM AiDesktopTrainingCorpusTopicSearch
            WHERE AiDesktopTrainingCorpusTopicSearch MATCH $phrase
          )
        ORDER BY CASE source WHEN 'codex' THEN 0 WHEN 'nangong' THEN 1 ELSE 2 END,
          createdAt DESC
        LIMIT $limit
      `).all({ $like: like, $phrase: phrase, $limit: safeLimit }) as Array<Record<string, unknown>>;
      const readMessages = connection.prepare(`
        SELECT speakerRole, content, createdAt
        FROM AiDesktopTrainingCorpusMessage
        WHERE corpusTopicId = $topicId
        ORDER BY sequenceNumber
      `);
      return topics.map((topic) => ({
        corpusTopicId: String(topic.corpusTopicId),
        source: String(topic.source) as TrainingCorpusTopicSearchResult["source"],
        title: String(topic.title),
        topicType: String(topic.topicType),
        inferredIntent: topic.inferredIntent ? String(topic.inferredIntent) : null,
        tags: JSON.parse(String(topic.tagsJson)) as string[],
        definitionSource: String(topic.definitionSource) as TrainingCorpusTopicSearchResult["definitionSource"],
        createdAt: String(topic.createdAt),
        messages: (readMessages.all({ $topicId: String(topic.corpusTopicId) }) as Array<Record<string, unknown>>).map((message) => ({
          speakerRole: String(message.speakerRole) as TrainingCorpusTopicSearchResult["messages"][number]["speakerRole"],
          content: String(message.content),
          createdAt: String(message.createdAt),
        })),
      }));
    });
  }

  readHanLiEvolutionCorpus(deliberationId: string): EvolutionSourceMessageSnapshot[] {
    const capturedAt = new Date().toISOString();
    return this.#database.withConnection((connection) => {
      // 训练只读统一语料表；近期南宫婉和 Codex 用户原话是主资料，AI 摘要只提供少量执行上下文。
      const nangongRows = connection.prepare(`
        SELECT sourceMessageId AS messageId, sourceConversationId AS conversationId,
          sequenceNumber, speakerRole AS role, content, createdAt
        FROM AiDesktopTrainingCorpusMessage
        WHERE source = 'nangong'
        ORDER BY createdAt DESC
        LIMIT $limit
      `).all({ $limit: EVOLUTION_NANGONG_MESSAGE_LIMIT }) as Array<Record<string, unknown>>;
      const codexRows = connection.prepare(`
        WITH recent_user AS (
          SELECT sourceMessageId AS messageId, sourceConversationId AS threadId, sequenceNumber,
            speakerRole AS sourceRole, NULL AS responsePhase, content, createdAt
          FROM AiDesktopTrainingCorpusMessage
          WHERE source = 'codex' AND evidenceTier = 'primary'
          ORDER BY createdAt DESC
          LIMIT $userLimit
        ), recent_ai AS (
          SELECT sourceMessageId AS messageId, sourceConversationId AS threadId, sequenceNumber,
            speakerRole AS sourceRole, NULL AS responsePhase, content, createdAt
          FROM AiDesktopTrainingCorpusMessage
          WHERE source = 'codex' AND evidenceTier = 'supporting'
          ORDER BY createdAt DESC
          LIMIT $aiLimit
        )
        SELECT * FROM recent_user
        UNION ALL
        SELECT * FROM recent_ai
        ORDER BY createdAt DESC
      `).all({ $userLimit: EVOLUTION_CODEX_USER_MESSAGE_LIMIT, $aiLimit: EVOLUTION_CODEX_AI_PREVIEW_LIMIT }) as Array<Record<string, unknown>>;
      const nangong = nangongRows.map((row) => sourceSnapshot({
        deliberationId, source: "nangong", conversationId: String(row.conversationId), sourceMessageId: String(row.messageId),
        sequenceNumber: Number(row.sequenceNumber), role: String(row.role), responsePhase: null,
        content: String(row.content), originalCreatedAt: String(row.createdAt), capturedAt,
      }));
      const codex = codexRows.map((row) => sourceSnapshot({
        deliberationId, source: "codex", conversationId: String(row.threadId), sourceMessageId: String(row.messageId),
        sequenceNumber: Number(row.sequenceNumber), role: String(row.sourceRole), responsePhase: row.responsePhase ? String(row.responsePhase) : null,
        content: String(row.content), originalCreatedAt: String(row.createdAt), capturedAt,
      }));
      return [...nangong, ...codex];
    });
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
      const userMessage = conversation.messages.find((message) => message.messageId === userMessageId);
      const nangongMessage = conversation.messages.find((message) => message.messageId === nangongMessageId);
      if (!userMessage || !nangongMessage) throw new Error("南宫婉回合缺少用户或人物原消息，不能登记训练主题。");
      const corpusTopicId = `corpus-topic:nangong:${conversation.conversationId}:${userMessageId}`;
      const confirmed = Boolean(decision.title && decision.type && decision.userIntent && decision.tags.length && decision.summary);
      connection.prepare(`
        INSERT INTO AiDesktopTrainingCorpusTopic
          (corpusTopicId, source, sourceConversationId, sourceTurnId, title, topicType, inferredIntent,
           tagsJson, definitionSource, createdAt, updatedAt)
        VALUES ($topicId, 'nangong', $conversationId, $turnId, $title, $topicType, $intent,
          $tagsJson, $definitionSource, $createdAt, $updatedAt)
        ON CONFLICT(corpusTopicId) DO UPDATE SET title=excluded.title, topicType=excluded.topicType,
          inferredIntent=excluded.inferredIntent, tagsJson=excluded.tagsJson,
          definitionSource=excluded.definitionSource, updatedAt=excluded.updatedAt
      `).run({
        $topicId: corpusTopicId, $conversationId: conversation.conversationId, $turnId: userMessageId,
        $title: confirmed ? decision.title : "待 AI 归类", $topicType: confirmed ? decision.type : "待归类",
        $intent: confirmed ? decision.userIntent : null, $tagsJson: JSON.stringify(confirmed ? decision.tags : []),
        $definitionSource: confirmed ? "ai-confirmed" : "pending", $createdAt: userMessage.createdAt, $updatedAt: new Date().toISOString(),
      });
      if (confirmed) connection.prepare(`
        INSERT INTO AiDesktopTrainingCorpusMessage
          (corpusMessageId, corpusTopicId, source, sourceConversationId, sourceTurnId, sourceMessageId,
           sequenceNumber, speakerRole, content, contentRetention, evidenceTier, createdAt, recordedAt)
        VALUES ($corpusMessageId, $topicId, 'nangong', $conversationId, $turnId, $messageId,
          $sequenceNumber, 'nangong', $content, 'preview-300', 'primary', $createdAt, $recordedAt)
        ON CONFLICT(corpusMessageId) DO UPDATE SET content=excluded.content, recordedAt=excluded.recordedAt
      `).run({
        $corpusMessageId: `corpus:nangong:${nangongMessageId}`, $topicId: corpusTopicId,
        $conversationId: conversation.conversationId, $turnId: userMessageId, $messageId: nangongMessageId,
        $sequenceNumber: conversation.messages.indexOf(nangongMessage), $content: decision.summary,
        $createdAt: nangongMessage.createdAt, $recordedAt: new Date().toISOString(),
      });
    });
  }
}

function sourceSnapshot(value: Omit<EvolutionSourceMessageSnapshot, "snapshotId">): EvolutionSourceMessageSnapshot {
  return { ...value, snapshotId: `evolution-source:${value.deliberationId}:${value.source}:${value.sourceMessageId}` };
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
