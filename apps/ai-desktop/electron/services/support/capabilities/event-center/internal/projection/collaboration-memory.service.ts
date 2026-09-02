import { randomUUID } from "node:crypto";

import type {
  ApprovalMemoryEvidenceOutDto,
  CollaborationMemoryMessageOutDto,
  CollaborationMemoryPort,
  ConversationRoundTopicDecisionInDto,
  HanliCorpusExtractionCandidateOutDto,
  HanliSemanticContextOutDto,
  HanliSemanticExtractionInDto,
  TrainingCorpusTopicSearchResultOutDto,
} from "../../../../../../../contracts/services/support/capabilities/event-center/index.js";
import type { EvolutionProposalOriginValue, EvolutionProposalTypeValue, EvolutionSourceMessageSnapshotOutDto, EvolutionStateOutDto } from "../../../../../../../contracts/services/evolution/index.js";
import type { HanliAcceptanceExperienceCandidateOutDto, HanliConversationOutDto } from "../../../../../../../contracts/services/personas/hanli/index.js";
import type { NangongConversationOutDto } from "../../../../../../../contracts/services/personas/nangong/index.js";
import type { DatabasePort as SqliteDatabase } from "../../../../platform/persistence/index.js";
import { HanliSemanticMemoryRepository } from "./hanli-semantic-memory.repository.js";

const CURRENT_CONVERSATION_TURN_LIMIT = 20;
const HISTORICAL_USER_CONCERN_LIMIT = 8;
const APPROVAL_EVIDENCE_LIMIT = 12;
const EVOLUTION_NANGONG_MESSAGE_LIMIT = 800;
const EVOLUTION_HANLI_MESSAGE_LIMIT = 200;
const EVOLUTION_CODEX_USER_MESSAGE_LIMIT = 600;
const EVOLUTION_CODEX_AI_PREVIEW_LIMIT = 120;

/** 保存用户与南宫婉完整原文，并通过受控查询为后续调查和韩立审批提供上下文。 */
export class CollaborationMemoryService implements CollaborationMemoryPort {
  readonly #database: SqliteDatabase;
  readonly #hanliSemanticMemory: HanliSemanticMemoryRepository;

  constructor(database: SqliteDatabase) {
    this.#database = database;
    this.#hanliSemanticMemory = new HanliSemanticMemoryRepository(database);
  }

  /** 领取本轮尚未分析或内容版本已变化的统一语料。 */
  claimHanliCorpusExtractions(stableUserId: string, projectScope: string, extractorVersion: string, limit?: number): HanliCorpusExtractionCandidateOutDto[] {
    return this.#hanliSemanticMemory.claim(stableUserId, projectScope, extractorVersion, limit);
  }

  /** 原子保存 AI 校验后的客户关注点、需求轨迹和需求树。 */
  completeHanliCorpusExtraction(candidate: HanliCorpusExtractionCandidateOutDto, result: HanliSemanticExtractionInDto): void {
    this.#hanliSemanticMemory.complete(candidate, result);
  }

  /** 保存可恢复失败和退避时间，防止相同坏语料被启动循环反复调用。 */
  failHanliCorpusExtraction(candidate: HanliCorpusExtractionCandidateOutDto, error: unknown): void {
    this.#hanliSemanticMemory.fail(candidate, error);
  }

  /** 为韩立当前回合返回一个稳定用户、一个项目范围内的成熟语义上下文。 */
  readHanliSemanticContext(stableUserId: string, projectScope: string, query = "", limit?: number): HanliSemanticContextOutDto {
    return this.#hanliSemanticMemory.readContext(stableUserId, projectScope, query, limit);
  }

  /** 把修复并复验成功的验收候选提升为当前用户、当前项目经验。 */
  recordVerifiedInspectionExperience(stableUserId: string, projectScope: string, candidate: HanliAcceptanceExperienceCandidateOutDto): void {
    this.#hanliSemanticMemory.recordExperience(stableUserId, projectScope, candidate);
  }

  /** 从固定人物当前线程恢复韩立可见对话；没有线程时返回空会话。 */
  readHanliConversation(conversationId: string | null): HanliConversationOutDto {
    if (!conversationId) return { conversationId: null, messages: [], updatedAt: new Date(0).toISOString() };
    return this.#database.withConnection((connection) => {
      const rows = connection.prepare(`SELECT messageId, sequenceNumber, role, speakerPersonaId, content, inferredIntent,
          attachmentIdsJson, replyToMessageId, deliveryStatus, createdAt, completedAt
        FROM AiDesktopPersonaConversationMessage
        WHERE personaId='han-li' AND conversationId=$conversationId ORDER BY sequenceNumber`)
        .all({ $conversationId: conversationId }) as Array<Record<string, unknown>>;
      const messages = rows.map((row) => ({
        messageId: String(row.messageId), sequenceNumber: Number(row.sequenceNumber),
        role: (row.speakerPersonaId === "nangong-wan" ? "nangong" : row.role) as "user" | "hanli" | "nangong",
        content: String(row.content), replyToMessageId: row.replyToMessageId ? String(row.replyToMessageId) : null,
        deliveryStatus: String(row.deliveryStatus) as "sending" | "completed" | "failed",
        ...(row.inferredIntent ? { inferredIntent: String(row.inferredIntent) } : {}),
        attachmentIds: parseStringArray(row.attachmentIdsJson), createdAt: String(row.createdAt),
        completedAt: row.completedAt ? String(row.completedAt) : null,
      }));
      return { conversationId, messages, updatedAt: messages.at(-1)?.completedAt || messages.at(-1)?.createdAt || new Date(0).toISOString() };
    });
  }

  /** 把韩立与南宫婉的内部研讨投影到韩立人物会话；该入口不创建训练主题，也不触发语义整理。 */
  appendHanliInternalMessage(input: {
    conversationId: string; messageId: string; role: "hanli" | "nangong"; content: string;
    replyToMessageId?: string | null; createdAt: string;
  }): HanliConversationOutDto {
    const content = input.content.trim();
    if (!content) throw new Error("人物内部研讨消息不能为空。");
    this.#database.transaction((connection) => {
      const maximum = connection.prepare(`SELECT COALESCE(MAX(sequenceNumber), -1) AS value
        FROM AiDesktopPersonaConversationMessage WHERE personaId='han-li' AND conversationId=$conversationId`)
        .get({ $conversationId: input.conversationId }) as { value: number | bigint };
      connection.prepare(`INSERT INTO AiDesktopPersonaConversationMessage
        (messageId, personaId, conversationId, sequenceNumber, role, speakerPersonaId, content, inferredIntent,
         attachmentIdsJson, replyToMessageId, deliveryStatus, createdAt, completedAt)
        VALUES ($messageId, 'han-li', $conversationId, $sequenceNumber, 'hanli', $speakerPersonaId, $content, NULL,
          '[]', $replyToMessageId, 'completed', $createdAt, $createdAt)
        ON CONFLICT(messageId) DO NOTHING`).run({
        $messageId: input.messageId, $conversationId: input.conversationId,
        $sequenceNumber: Number(maximum.value) + 1, $speakerPersonaId: input.role === "nangong" ? "nangong-wan" : "han-li", $content: content,
        $replyToMessageId: input.replyToMessageId || null, $createdAt: input.createdAt,
      });
    });
    return this.readHanliConversation(input.conversationId);
  }

  /** 原子保存韩立自由对话与统一训练语料；完整回复只留在人物会话，语料层保存 AI 摘要。 */
  registerHanliRound(input: {
    conversationId: string; userMessageId: string; userContent: string; attachmentIds: string[];
    hanliMessageId: string; hanliContent: string; createdAt: string; completedAt: string;
    decision: ConversationRoundTopicDecisionInDto;
  }): HanliConversationOutDto {
    // 语义资料必须由真实用户回合产生；人物内部交流不能伪装成用户原话进入训练语料。
    if (!input.userContent.trim()) throw new Error("韩立回合缺少真实用户消息，不能登记人物会话或训练语料。");
    this.#database.transaction((connection) => {
      const existing = connection.prepare(`SELECT 1 AS found FROM AiDesktopPersonaConversationMessage WHERE messageId=$messageId`)
        .get({ $messageId: input.userMessageId });
      // Renderer 重试同一 clientMessageId 时整轮已经原子提交，不再分配新序号或复制语料。
      if (existing) return;
      const maximum = connection.prepare(`SELECT COALESCE(MAX(sequenceNumber), -1) AS value
        FROM AiDesktopPersonaConversationMessage WHERE personaId='han-li' AND conversationId=$conversationId`)
        .get({ $conversationId: input.conversationId }) as { value: number | bigint };
      const userSequence = Number(maximum.value) + 1;
      const insertMessage = connection.prepare(`INSERT INTO AiDesktopPersonaConversationMessage
        (messageId, personaId, conversationId, sequenceNumber, role, content, inferredIntent,
         attachmentIdsJson, replyToMessageId, deliveryStatus, createdAt, completedAt)
        VALUES ($messageId, 'han-li', $conversationId, $sequenceNumber, $role, $content, $intent,
          $attachments, $replyToMessageId, 'completed', $createdAt, $completedAt)
        ON CONFLICT(messageId) DO NOTHING`);
      insertMessage.run({
        $messageId: input.userMessageId, $conversationId: input.conversationId, $sequenceNumber: userSequence,
        $role: "user", $content: input.userContent, $intent: input.decision.userIntent || null,
        $attachments: JSON.stringify(input.attachmentIds), $replyToMessageId: null,
        $createdAt: input.createdAt, $completedAt: input.completedAt,
      });
      insertMessage.run({
        $messageId: input.hanliMessageId, $conversationId: input.conversationId, $sequenceNumber: userSequence + 1,
        $role: "hanli", $content: input.hanliContent, $intent: null, $attachments: "[]",
        $replyToMessageId: input.userMessageId, $createdAt: input.completedAt, $completedAt: input.completedAt,
      });

      const confirmed = Boolean(input.decision.title && input.decision.type && input.decision.userIntent && input.decision.tags.length && input.decision.summary);
      const corpusTopicId = `corpus-topic:hanli:${input.conversationId}:${input.userMessageId}`;
      connection.prepare(`INSERT INTO AiDesktopTrainingCorpusTopic
        (corpusTopicId, source, sourceConversationId, sourceTurnId, title, topicType, inferredIntent,
         tagsJson, definitionSource, createdAt, updatedAt)
        VALUES ($topicId, 'hanli', $conversationId, $turnId, $title, $type, $intent, $tags,
          $definitionSource, $createdAt, $updatedAt)
        ON CONFLICT(corpusTopicId) DO UPDATE SET title=excluded.title, topicType=excluded.topicType,
          inferredIntent=excluded.inferredIntent, tagsJson=excluded.tagsJson,
          definitionSource=excluded.definitionSource, updatedAt=excluded.updatedAt`)
        .run({
          $topicId: corpusTopicId, $conversationId: input.conversationId, $turnId: input.userMessageId,
          $title: confirmed ? input.decision.title : "待 AI 归类", $type: confirmed ? input.decision.type : "待归类",
          $intent: confirmed ? input.decision.userIntent : null, $tags: JSON.stringify(confirmed ? input.decision.tags : []),
          $definitionSource: confirmed ? "ai-confirmed" : "pending", $createdAt: input.createdAt, $updatedAt: input.completedAt,
        });
      const insertCorpusMessage = connection.prepare(`INSERT INTO AiDesktopTrainingCorpusMessage
        (corpusMessageId, corpusTopicId, source, sourceConversationId, sourceTurnId, sourceMessageId,
         sequenceNumber, speakerRole, content, contentRetention, evidenceTier, createdAt, recordedAt)
        VALUES ($corpusMessageId, $topicId, 'hanli', $conversationId, $turnId, $sourceMessageId,
          $sequenceNumber, $speakerRole, $content, $retention, 'primary', $createdAt, $recordedAt)
        ON CONFLICT(corpusMessageId) DO UPDATE SET content=excluded.content, recordedAt=excluded.recordedAt`);
      insertCorpusMessage.run({
        $corpusMessageId: `corpus:hanli:${input.userMessageId}`, $topicId: corpusTopicId,
        $conversationId: input.conversationId, $turnId: input.userMessageId, $sourceMessageId: input.userMessageId,
        $sequenceNumber: userSequence, $speakerRole: "user", $content: input.userContent,
        $retention: "exact", $createdAt: input.createdAt, $recordedAt: input.completedAt,
      });
      if (confirmed) insertCorpusMessage.run({
        $corpusMessageId: `corpus:hanli:${input.hanliMessageId}`, $topicId: corpusTopicId,
        $conversationId: input.conversationId, $turnId: input.userMessageId, $sourceMessageId: input.hanliMessageId,
        $sequenceNumber: userSequence + 1, $speakerRole: "hanli", $content: input.decision.summary,
        $retention: "preview-300", $createdAt: input.completedAt, $recordedAt: input.completedAt,
      });
    });
    return this.readHanliConversation(input.conversationId);
  }

  syncConversation(conversation: NangongConversationOutDto): void {
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

  syncEvolutionState(state: EvolutionStateOutDto): void {
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

  buildNangongContext(conversation: NangongConversationOutDto): string {
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
    `).all({ $conversationId: conversation.conversationId, $limit: HISTORICAL_USER_CONCERN_LIMIT }) as unknown as CollaborationMemoryMessageOutDto[])
      .reverse()
      .map((item) => `用户历史原话：${item.content}${item.inferredIntent ? `\nAI登记的用户意图：${item.inferredIntent}` : ""}`);
    return [
      historical.length ? `用户以往关心的事项（保持原话）：\n${historical.join("\n\n")}` : "",
      current.length ? `当前南宫婉对话：\n${current.join("\n\n")}` : "",
    ].filter(Boolean).join("\n\n");
  }

  approvalEvidence(proposalType: EvolutionProposalTypeValue, origin: EvolutionProposalOriginValue): ApprovalMemoryEvidenceOutDto[] {
    return this.#database.withConnection((connection) => connection.prepare(`
      SELECT approval.approvalId, approval.proposalType, run.origin, approval.decision, approval.advice, approval.approvedAt
      FROM AiDesktopApprovalRecord approval
      JOIN AiDesktopWorkflowRun run ON run.proposalId = approval.proposalId
      WHERE approval.source = 'manual-user' AND approval.proposalType = $proposalType AND run.origin = $origin
      ORDER BY approval.approvedAt DESC
      LIMIT $limit
    `).all({ $proposalType: proposalType, $origin: origin, $limit: APPROVAL_EVIDENCE_LIMIT }) as unknown as ApprovalMemoryEvidenceOutDto[]);
  }

  searchTrainingCorpusTopics(query: string, limit = 30): TrainingCorpusTopicSearchResultOutDto[] {
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
        source: String(topic.source) as TrainingCorpusTopicSearchResultOutDto["source"],
        title: String(topic.title),
        topicType: String(topic.topicType),
        inferredIntent: topic.inferredIntent ? String(topic.inferredIntent) : null,
        tags: JSON.parse(String(topic.tagsJson)) as string[],
        definitionSource: String(topic.definitionSource) as TrainingCorpusTopicSearchResultOutDto["definitionSource"],
        createdAt: String(topic.createdAt),
        messages: (readMessages.all({ $topicId: String(topic.corpusTopicId) }) as Array<Record<string, unknown>>).map((message) => ({
          speakerRole: String(message.speakerRole) as TrainingCorpusTopicSearchResultOutDto["messages"][number]["speakerRole"],
          content: String(message.content),
          createdAt: String(message.createdAt),
        })),
      }));
    });
  }

  readHanLiEvolutionCorpus(deliberationId: string, anchorHanliConversationId: string | null = null): EvolutionSourceMessageSnapshotOutDto[] {
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
      const hanliRows = connection.prepare(`
        SELECT sourceMessageId AS messageId, sourceConversationId AS conversationId,
          sequenceNumber, speakerRole AS role, content, createdAt
        FROM AiDesktopTrainingCorpusMessage
        WHERE source = 'hanli'
          AND ($conversationId IS NULL OR sourceConversationId = $conversationId)
        ORDER BY createdAt DESC
        LIMIT $limit
      `).all({ $conversationId: anchorHanliConversationId, $limit: EVOLUTION_HANLI_MESSAGE_LIMIT }) as Array<Record<string, unknown>>;
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
      const hanli = hanliRows.map((row) => sourceSnapshot({
        deliberationId, source: "hanli", conversationId: String(row.conversationId), sourceMessageId: String(row.messageId),
        sequenceNumber: Number(row.sequenceNumber), role: String(row.role), responsePhase: null,
        content: String(row.content), originalCreatedAt: String(row.createdAt), capturedAt,
      }));
      const codex = codexRows.map((row) => sourceSnapshot({
        deliberationId, source: "codex", conversationId: String(row.threadId), sourceMessageId: String(row.messageId),
        sequenceNumber: Number(row.sequenceNumber), role: String(row.sourceRole), responsePhase: row.responsePhase ? String(row.responsePhase) : null,
        content: String(row.content), originalCreatedAt: String(row.createdAt), capturedAt,
      }));
      return [...hanli, ...nangong, ...codex];
    });
  }

  registerRound(conversation: NangongConversationOutDto, userMessageId: string, nangongMessageId: string, decision: ConversationRoundTopicDecisionInDto): void {
    const userMessage = conversation.messages.find((message) => message.messageId === userMessageId);
    const nangongMessage = conversation.messages.find((message) => message.messageId === nangongMessageId);
    // 只有真实用户与南宫婉组成的完整回合才能进入语义资料；人物间内部消息只保留业务记录。
    if (userMessage?.role !== "user" || nangongMessage?.role !== "nangong") {
      throw new Error("南宫婉回合缺少真实用户或人物回复，不能登记训练主题。");
    }
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

function sourceSnapshot(value: Omit<EvolutionSourceMessageSnapshotOutDto, "snapshotId">): EvolutionSourceMessageSnapshotOutDto {
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

function parseStringArray(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value || "[]")) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}
