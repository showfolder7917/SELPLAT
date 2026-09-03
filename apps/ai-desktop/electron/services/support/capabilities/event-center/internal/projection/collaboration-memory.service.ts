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
import type { HanliAcceptanceExperienceCandidateOutDto } from "../../../../../../../contracts/services/personas/hanli/index.js";
import type { PersonaConversationOutDto } from "../../../../../../../contracts/services/personas/conversation/index.js";
import { PersonaConversationRepository } from "../../../conversation/index.js";
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
  readonly #conversations: PersonaConversationRepository;

  constructor(database: SqliteDatabase) {
    this.#database = database;
    this.#hanliSemanticMemory = new HanliSemanticMemoryRepository(database);
    this.#conversations = new PersonaConversationRepository(database);
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

  /** 所有人物通过同一个入口恢复会话；不传 conversationId 时读取该人物唯一活动会话。 */
  readPersonaConversation(ownerPersonaId: string, conversationId?: string | null): PersonaConversationOutDto {
    return conversationId
      ? this.#conversations.read(ownerPersonaId, conversationId)
      : this.#conversations.readActive(ownerPersonaId);
  }

  /** 建立新的活动业务会话；旧会话只归档，不删除原始消息。 */
  newPersonaConversation(ownerPersonaId: string): PersonaConversationOutDto {
    return this.#conversations.create(ownerPersonaId);
  }

  /** 把人物内部研讨追加到所属人物会话；发言人使用稳定 personaId，不再扩充角色枚举。 */
  appendPersonaInternalMessage(input: {
    ownerPersonaId: string; conversationId: string; messageId: string; speakerPersonaId: string; content: string;
    replyToMessageId?: string | null; createdAt: string;
  }): PersonaConversationOutDto {
    const content = input.content.trim();
    if (!content) throw new Error("人物内部研讨消息不能为空。");
    this.#database.transaction((connection) => {
      const maximum = connection.prepare(`SELECT COALESCE(MAX(sequenceNumber), -1) AS value
        FROM AiDesktopPersonaConversationMessage WHERE ownerPersonaId=$ownerPersonaId AND conversationId=$conversationId`)
        .get({ $ownerPersonaId: input.ownerPersonaId, $conversationId: input.conversationId }) as { value: number | bigint };
      connection.prepare(`INSERT INTO AiDesktopPersonaConversationMessage
        (messageId, ownerPersonaId, conversationId, sequenceNumber, speakerType, speakerPersonaId, content, inferredIntent,
         attachmentIdsJson, replyToMessageId, deliveryStatus, createdAt, completedAt, recordedAt)
        VALUES ($messageId, $ownerPersonaId, $conversationId, $sequenceNumber, 'persona', $speakerPersonaId, $content, NULL,
          '[]', $replyToMessageId, 'completed', $createdAt, $createdAt, $createdAt)
        ON CONFLICT(messageId) DO NOTHING`).run({
        $messageId: input.messageId, $ownerPersonaId: input.ownerPersonaId, $conversationId: input.conversationId,
        $sequenceNumber: Number(maximum.value) + 1, $speakerPersonaId: input.speakerPersonaId, $content: content,
        $replyToMessageId: input.replyToMessageId || null, $createdAt: input.createdAt,
      });
      connection.prepare(`UPDATE AiDesktopPersonaConversation SET updatedAt=$updatedAt
        WHERE ownerPersonaId=$ownerPersonaId AND conversationId=$conversationId`).run({
        $updatedAt: input.createdAt, $ownerPersonaId: input.ownerPersonaId, $conversationId: input.conversationId,
      });
    });
    return this.readPersonaConversation(input.ownerPersonaId, input.conversationId);
  }

  /** 原子保存任意人物的真实用户回合与统一训练语料；人物完整回复只留在人物会话。 */
  registerPersonaRound(input: {
    ownerPersonaId: string; responderPersonaId: string; corpusSource: string;
    conversationId: string; userMessageId: string; userContent: string; attachmentIds: string[];
    personaMessageId: string; personaContent: string; createdAt: string; completedAt: string;
    decision: ConversationRoundTopicDecisionInDto;
  }): PersonaConversationOutDto {
    // 语义资料必须由真实用户回合产生；人物内部交流不能伪装成用户原话进入训练语料。
    if (!input.userContent.trim()) throw new Error("人物回合缺少真实用户消息，不能登记人物会话或训练语料。");
    this.#database.transaction((connection) => {
      const existing = connection.prepare(`SELECT 1 AS found FROM AiDesktopPersonaConversationMessage WHERE messageId=$messageId`)
        .get({ $messageId: input.userMessageId });
      // Renderer 重试同一 clientMessageId 时整轮已经原子提交，不再分配新序号或复制语料。
      if (existing) return;
      const maximum = connection.prepare(`SELECT COALESCE(MAX(sequenceNumber), -1) AS value
        FROM AiDesktopPersonaConversationMessage WHERE ownerPersonaId=$ownerPersonaId AND conversationId=$conversationId`)
        .get({ $ownerPersonaId: input.ownerPersonaId, $conversationId: input.conversationId }) as { value: number | bigint };
      const userSequence = Number(maximum.value) + 1;
      const insertMessage = connection.prepare(`INSERT INTO AiDesktopPersonaConversationMessage
        (messageId, ownerPersonaId, conversationId, sequenceNumber, speakerType, speakerPersonaId, content, inferredIntent,
          attachmentIdsJson, replyToMessageId, deliveryStatus, createdAt, completedAt, recordedAt)
        VALUES ($messageId, $ownerPersonaId, $conversationId, $sequenceNumber, $speakerType, $speakerPersonaId, $content, $intent,
          $attachments, $replyToMessageId, 'completed', $createdAt, $completedAt, $completedAt)
        ON CONFLICT(messageId) DO NOTHING`);
      insertMessage.run({
        $messageId: input.userMessageId, $ownerPersonaId: input.ownerPersonaId, $conversationId: input.conversationId, $sequenceNumber: userSequence,
        $speakerType: "user", $speakerPersonaId: null, $content: input.userContent, $intent: input.decision.userIntent || null,
        $attachments: JSON.stringify(input.attachmentIds), $replyToMessageId: null,
        $createdAt: input.createdAt, $completedAt: input.completedAt,
      });
      insertMessage.run({
        $messageId: input.personaMessageId, $ownerPersonaId: input.ownerPersonaId, $conversationId: input.conversationId, $sequenceNumber: userSequence + 1,
        $speakerType: "persona", $speakerPersonaId: input.responderPersonaId, $content: input.personaContent, $intent: null, $attachments: "[]",
        $replyToMessageId: input.userMessageId, $createdAt: input.completedAt, $completedAt: input.completedAt,
      });
      connection.prepare(`UPDATE AiDesktopPersonaConversation SET updatedAt=$updatedAt
        WHERE ownerPersonaId=$ownerPersonaId AND conversationId=$conversationId`).run({
        $updatedAt: input.completedAt, $ownerPersonaId: input.ownerPersonaId, $conversationId: input.conversationId,
      });

      const confirmed = Boolean(input.decision.title && input.decision.type && input.decision.userIntent && input.decision.tags.length && input.decision.summary);
      const corpusTopicId = `corpus-topic:${input.corpusSource}:${input.conversationId}:${input.userMessageId}`;
      connection.prepare(`INSERT INTO AiDesktopTrainingCorpusTopic
        (corpusTopicId, source, sourceConversationId, sourceTurnId, title, topicType, inferredIntent,
         tagsJson, definitionSource, createdAt, updatedAt)
        VALUES ($topicId, $source, $conversationId, $turnId, $title, $type, $intent, $tags,
          $definitionSource, $createdAt, $updatedAt)
        ON CONFLICT(corpusTopicId) DO UPDATE SET title=excluded.title, topicType=excluded.topicType,
          inferredIntent=excluded.inferredIntent, tagsJson=excluded.tagsJson,
          definitionSource=excluded.definitionSource, updatedAt=excluded.updatedAt`)
        .run({
          $topicId: corpusTopicId, $source: input.corpusSource, $conversationId: input.conversationId, $turnId: input.userMessageId,
          $title: confirmed ? input.decision.title : "待 AI 归类", $type: confirmed ? input.decision.type : "待归类",
          $intent: confirmed ? input.decision.userIntent : null, $tags: JSON.stringify(confirmed ? input.decision.tags : []),
          $definitionSource: confirmed ? "ai-confirmed" : "pending", $createdAt: input.createdAt, $updatedAt: input.completedAt,
        });
      const insertCorpusMessage = connection.prepare(`INSERT INTO AiDesktopTrainingCorpusMessage
        (corpusMessageId, corpusTopicId, source, sourceConversationId, sourceTurnId, sourceMessageId,
         sequenceNumber, speakerRole, content, contentRetention, evidenceTier, createdAt, recordedAt)
        VALUES ($corpusMessageId, $topicId, $source, $conversationId, $turnId, $sourceMessageId,
          $sequenceNumber, $speakerRole, $content, $retention, 'primary', $createdAt, $recordedAt)
        ON CONFLICT(corpusMessageId) DO UPDATE SET content=excluded.content, recordedAt=excluded.recordedAt`);
      insertCorpusMessage.run({
        $corpusMessageId: `corpus:${input.corpusSource}:${input.userMessageId}`, $topicId: corpusTopicId, $source: input.corpusSource,
        $conversationId: input.conversationId, $turnId: input.userMessageId, $sourceMessageId: input.userMessageId,
        $sequenceNumber: userSequence, $speakerRole: "user", $content: input.userContent,
        $retention: "exact", $createdAt: input.createdAt, $recordedAt: input.completedAt,
      });
      if (confirmed) insertCorpusMessage.run({
        $corpusMessageId: `corpus:${input.corpusSource}:${input.personaMessageId}`, $topicId: corpusTopicId, $source: input.corpusSource,
        $conversationId: input.conversationId, $turnId: input.userMessageId, $sourceMessageId: input.personaMessageId,
        $sequenceNumber: userSequence + 1, $speakerRole: input.responderPersonaId, $content: input.decision.summary,
        $retention: "preview-300", $createdAt: input.completedAt, $recordedAt: input.completedAt,
      });
    });
    return this.readPersonaConversation(input.ownerPersonaId, input.conversationId);
  }

  /** 保存统一人物会话，并把其中真实用户消息登记成可追溯训练语料。 */
  savePersonaConversation(conversation: PersonaConversationOutDto): void {
    const completedMessages = conversation.messages.filter((message) => message.deliveryStatus === undefined || message.deliveryStatus === "completed");
    this.#conversations.save({ ...conversation, messages: completedMessages });
    // 旧来源名继续服务既有语义查询；未来人物默认直接使用自己的稳定 personaId。
    const corpusSource = conversation.ownerPersonaId === "nangong-wan" ? "nangong"
      : conversation.ownerPersonaId === "han-li" ? "hanli"
        : conversation.ownerPersonaId;
    this.#database.transaction((connection) => {
      const upsertCorpusTopic = connection.prepare(`
        INSERT INTO AiDesktopTrainingCorpusTopic
          (corpusTopicId, source, sourceConversationId, sourceTurnId, title, topicType, inferredIntent,
           tagsJson, definitionSource, createdAt, updatedAt)
        VALUES ($topicId, $source, $conversationId, $turnId, '待 AI 归类', '待归类', NULL,
          '[]', 'pending', $createdAt, $recordedAt)
        ON CONFLICT(corpusTopicId) DO NOTHING
      `);
      const insertUserCorpus = connection.prepare(`
        INSERT INTO AiDesktopTrainingCorpusMessage
          (corpusMessageId, corpusTopicId, source, sourceConversationId, sourceTurnId, sourceMessageId,
           sequenceNumber, speakerRole, content, contentRetention, evidenceTier, createdAt, recordedAt)
        VALUES ($corpusMessageId, $topicId, $source, $conversationId, $turnId, $messageId,
          $sequenceNumber, 'user', $content, 'exact', 'primary', $createdAt, $recordedAt)
        ON CONFLICT(corpusMessageId) DO NOTHING
      `);
      completedMessages.forEach((message, fallbackSequenceNumber) => {
        if (message.speakerType !== "user") return;
        const recordedAt = new Date().toISOString();
        const topicId = `corpus-topic:${corpusSource}:${conversation.conversationId}:${message.messageId}`;
        upsertCorpusTopic.run({
          $topicId: topicId, $source: corpusSource, $conversationId: conversation.conversationId, $turnId: message.messageId,
          $createdAt: message.createdAt, $recordedAt: recordedAt,
        });
        insertUserCorpus.run({
          $corpusMessageId: `corpus:${corpusSource}:${message.messageId}`, $topicId: topicId, $source: corpusSource,
          $conversationId: conversation.conversationId, $turnId: message.messageId, $messageId: message.messageId,
          $sequenceNumber: Number.isSafeInteger(message.sequenceNumber) ? message.sequenceNumber : fallbackSequenceNumber, $content: message.content, $createdAt: message.createdAt, $recordedAt: recordedAt,
        });
      });
    });
  }

  syncEvolutionState(state: EvolutionStateOutDto): void {
    this.savePersonaConversation(state.conversation);
    this.#database.transaction((connection) => {
      const insert = connection.prepare(`
        INSERT OR IGNORE INTO AiDesktopConversationTopicLink (topicId, conversationId, messageId, linkedAt)
        SELECT $topicId, conversationId, messageId, $linkedAt
        FROM AiDesktopPersonaConversationMessage
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

  buildNangongContext(conversation: PersonaConversationOutDto): string {
    const current = conversation.messages.slice(-CURRENT_CONVERSATION_TURN_LIMIT)
      // 用户原话是方向事实，保持完整；AI 回答使用独立预览，避免长回复挤占后续分析上下文。
      .map((item) => item.speakerType === "user"
        ? `用户：${item.content}${item.inferredIntent ? `\nAI登记的用户意图：${item.inferredIntent}` : ""}`
        : `南宫婉：${preview(item.content)}`);
    const historical = this.#database.withConnection((connection) => connection.prepare(`
        SELECT messageId, conversationId, sequenceNumber, content, inferredIntent, createdAt
        FROM AiDesktopPersonaConversationMessage
        WHERE ownerPersonaId = 'nangong-wan' AND speakerType = 'user' AND conversationId <> $conversationId
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

  registerNangongRound(conversation: PersonaConversationOutDto, userMessageId: string, nangongMessageId: string, decision: ConversationRoundTopicDecisionInDto): void {
    const userMessage = conversation.messages.find((message) => message.messageId === userMessageId);
    const nangongMessage = conversation.messages.find((message) => message.messageId === nangongMessageId);
    // 只有真实用户与南宫婉组成的完整回合才能进入语义资料；人物间内部消息只保留业务记录。
    if (userMessage?.speakerType !== "user" || nangongMessage?.speakerType !== "persona" || nangongMessage.speakerPersonaId !== "nangong-wan") {
      throw new Error("南宫婉回合缺少真实用户或人物回复，不能登记训练主题。");
    }
    this.savePersonaConversation(conversation);
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
