import { createHash, randomUUID } from "node:crypto";

import type { HanliAcceptanceExperienceCandidateOutDto } from "../../../../../../../contracts/services/personas/hanli/index.js";
import type {
  HanliCorpusExtractionCandidateOutDto,
  HanliCustomerConcernOutDto,
  HanliInspectionExperienceOutDto,
  HanliRequirementNodeOutDto,
  HanliRequirementTrajectoryOutDto,
  HanliSemanticContextOutDto,
  HanliSemanticExtractionInDto,
} from "../../../../../../../contracts/services/support/capabilities/event-center/index.js";
import type { DatabasePort as SqliteDatabase } from "../../../../platform/persistence/index.js";

const EXTRACTION_TYPE = "hanli-autonomous-analysis";
const PROCESSING_LEASE_MILLISECONDS = 15 * 60_000;

/** 保存韩立派生认知；统一训练消息始终是客户原话与轨迹结论的权威证据。 */
export class HanliSemanticMemoryRepository {
  constructor(private readonly database: SqliteDatabase) {}

  /** 领取新增、变化或可重试语料；完成且哈希、版本未变化的记录不会再次进入模型。 */
  claim(stableUserId: string, projectScope: string, extractorVersion: string, requestedLimit = 4): HanliCorpusExtractionCandidateOutDto[] {
    const now = new Date();
    const nowIso = now.toISOString();
    const leaseExpiredAt = new Date(now.getTime() - PROCESSING_LEASE_MILLISECONDS).toISOString();
    const limit = Math.max(1, Math.min(20, Math.trunc(requestedLimit)));
    return this.database.transaction((connection) => {
      const topics = connection.prepare(`
        SELECT topic.corpusTopicId AS corpusTopicId, topic.source AS source,
          topic.sourceConversationId AS sourceConversationId, topic.sourceTurnId AS sourceTurnId,
          topic.title AS title, topic.topicType AS topicType, topic.inferredIntent AS inferredIntent,
          topic.tagsJson AS tagsJson, topic.updatedAt AS updatedAt
        FROM AiDesktopTrainingCorpusTopic topic
        LEFT JOIN AiDesktopCorpusExtractionState extraction
          ON extraction.corpusTopicId=topic.corpusTopicId
          AND extraction.stableUserId=$stableUserId
          AND extraction.extractorType=$extractorType
        WHERE topic.definitionSource='ai-confirmed'
          AND EXISTS (SELECT 1 FROM AiDesktopTrainingCorpusMessage message
            WHERE message.corpusTopicId=topic.corpusTopicId AND message.speakerRole='user')
          AND (extraction.extractionId IS NULL
            OR extraction.extractorVersion<>$extractorVersion
            OR topic.updatedAt>extraction.updatedAt
            OR extraction.status IN ('pending', 'superseded')
            OR (extraction.status='retryable' AND (extraction.nextRetryAt IS NULL OR extraction.nextRetryAt<=$now))
            OR (extraction.status='processing' AND (extraction.claimedAt IS NULL OR extraction.claimedAt<=$leaseExpiredAt)))
        ORDER BY topic.updatedAt DESC LIMIT $scanLimit
      `).all({
        $stableUserId: stableUserId, $extractorType: EXTRACTION_TYPE, $extractorVersion: extractorVersion,
        $leaseExpiredAt: leaseExpiredAt, $now: nowIso, $scanLimit: Math.max(40, limit * 20),
      }) as Array<Record<string, unknown>>;
      const readMessages = connection.prepare(`
        SELECT sourceMessageId, speakerRole, content, createdAt
        FROM AiDesktopTrainingCorpusMessage WHERE corpusTopicId=$corpusTopicId ORDER BY sequenceNumber
      `);
      const readState = connection.prepare(`
        SELECT extractionId, sourceContentHash, extractorVersion, status, claimedAt, nextRetryAt
        FROM AiDesktopCorpusExtractionState
        WHERE corpusTopicId=$corpusTopicId AND stableUserId=$stableUserId AND extractorType=$extractorType
      `);
      const claim = connection.prepare(`
        INSERT INTO AiDesktopCorpusExtractionState
          (extractionId, corpusTopicId, stableUserId, extractorType, sourceContentHash, extractorVersion,
           status, attemptCount, claimedAt, completedAt, nextRetryAt, lastError, updatedAt)
        VALUES ($extractionId, $corpusTopicId, $stableUserId, $extractorType, $sourceContentHash, $extractorVersion,
          'processing', 1, $now, NULL, NULL, NULL, $now)
        ON CONFLICT(corpusTopicId, stableUserId, extractorType) DO UPDATE SET
          attemptCount=CASE
            WHEN AiDesktopCorpusExtractionState.sourceContentHash<>excluded.sourceContentHash
              OR AiDesktopCorpusExtractionState.extractorVersion<>excluded.extractorVersion THEN 1
            ELSE AiDesktopCorpusExtractionState.attemptCount + 1 END,
          sourceContentHash=excluded.sourceContentHash, extractorVersion=excluded.extractorVersion,
          status='processing',
          claimedAt=excluded.claimedAt, completedAt=NULL, nextRetryAt=NULL, lastError=NULL, updatedAt=excluded.updatedAt
      `);
      const candidates: HanliCorpusExtractionCandidateOutDto[] = [];
      for (const topic of topics) {
        if (candidates.length >= limit) break;
        const corpusTopicId = String(topic.corpusTopicId);
        const messages = (readMessages.all({ $corpusTopicId: corpusTopicId }) as Array<Record<string, unknown>>).map((message) => ({
          sourceMessageId: String(message.sourceMessageId),
          speakerRole: String(message.speakerRole) as HanliCorpusExtractionCandidateOutDto["messages"][number]["speakerRole"],
          content: String(message.content), createdAt: String(message.createdAt),
        }));
        const sourceContentHash = hashJson({ topic, messages });
        const state = readState.get({ $corpusTopicId: corpusTopicId, $stableUserId: stableUserId, $extractorType: EXTRACTION_TYPE }) as Record<string, unknown> | undefined;
        if (!shouldClaim(state, sourceContentHash, extractorVersion, nowIso, leaseExpiredAt)) continue;
        const extractionId = state ? String(state.extractionId) : `hanli-extraction-${randomUUID()}`;
        claim.run({ $extractionId: extractionId, $corpusTopicId: corpusTopicId, $stableUserId: stableUserId,
          $extractorType: EXTRACTION_TYPE, $sourceContentHash: sourceContentHash, $extractorVersion: extractorVersion, $now: nowIso });
        candidates.push({
          extractionId, corpusTopicId, stableUserId,
          source: String(topic.source) as HanliCorpusExtractionCandidateOutDto["source"],
          sourceConversationId: String(topic.sourceConversationId), sourceTurnId: String(topic.sourceTurnId),
          title: String(topic.title), topicType: String(topic.topicType), inferredIntent: topic.inferredIntent ? String(topic.inferredIntent) : null,
          tags: parseStringArray(topic.tagsJson), sourceContentHash, extractorVersion, projectScope, messages,
          existingConcerns: this.readContext(stableUserId, projectScope, "", 12).concerns,
        });
      }
      return candidates;
    });
  }

  /** 原子写入关注点、证据、轨迹和需求树，最后才推进完成水位。 */
  complete(candidate: HanliCorpusExtractionCandidateOutDto, result: HanliSemanticExtractionInDto): void {
    const now = new Date().toISOString();
    const sourceMessages = new Map(candidate.messages.map((message) => [message.sourceMessageId, message]));
    this.database.transaction((connection) => {
      const state = connection.prepare(`SELECT sourceContentHash, extractorVersion, status FROM AiDesktopCorpusExtractionState
        WHERE extractionId=$extractionId AND stableUserId=$stableUserId`)
        .get({ $extractionId: candidate.extractionId, $stableUserId: candidate.stableUserId }) as Record<string, unknown> | undefined;
      if (!state || state.status !== "processing" || state.sourceContentHash !== candidate.sourceContentHash || state.extractorVersion !== candidate.extractorVersion) {
        throw new Error("韩立语料提取租约或内容版本已经变化，拒绝写入过期分析结果。");
      }
      for (const concern of result.concerns.slice(0, 20)) {
        const concernId = stableId("hanli-concern", candidate.stableUserId, concern.semanticKey);
        const firstObservedAt = evidenceTime(concern.evidence, sourceMessages, false) || now;
        const lastObservedAt = evidenceTime(concern.evidence, sourceMessages, true) || now;
        connection.prepare(`
          INSERT INTO AiDesktopCustomerConcern
            (concernId, stableUserId, semanticKey, name, description, category, scopeType, scopeId,
             status, confidence, weight, firstObservedAt, lastObservedAt, confirmedAt,
             supersededByConcernId, createdAt, updatedAt)
          VALUES ($concernId, $stableUserId, $semanticKey, $name, $description, $category, $scopeType, $scopeId,
            $status, $confidence, $weight, $firstObservedAt, $lastObservedAt, $confirmedAt, NULL, $now, $now)
          ON CONFLICT(stableUserId, semanticKey) DO UPDATE SET
            name=excluded.name, description=excluded.description, category=excluded.category,
            scopeType=excluded.scopeType, scopeId=excluded.scopeId, status=excluded.status,
            confidence=excluded.confidence, weight=excluded.weight,
            firstObservedAt=MIN(AiDesktopCustomerConcern.firstObservedAt, excluded.firstObservedAt),
            lastObservedAt=MAX(AiDesktopCustomerConcern.lastObservedAt, excluded.lastObservedAt),
            confirmedAt=COALESCE(AiDesktopCustomerConcern.confirmedAt, excluded.confirmedAt), updatedAt=excluded.updatedAt
        `).run({
          $concernId: concernId, $stableUserId: candidate.stableUserId, $semanticKey: bounded(concern.semanticKey, 160),
          $name: bounded(concern.name, 160), $description: bounded(concern.description, 2_000), $category: bounded(concern.category, 120),
          $scopeType: concern.scopeType, $scopeId: concern.scopeType === "global" ? null : bounded(concern.scopeId || candidate.projectScope, 1_000),
          $status: concern.status, $confidence: normalizedScore(concern.confidence), $weight: normalizedScore(concern.weight),
          $firstObservedAt: firstObservedAt, $lastObservedAt: lastObservedAt,
          $confirmedAt: concern.status === "confirmed" ? lastObservedAt : null, $now: now,
        });
        for (const evidence of concern.evidence.slice(0, 20)) {
          const message = sourceMessages.get(evidence.sourceMessageId);
          if (!message) throw new Error(`关注点证据引用了当前语料之外的消息：${evidence.sourceMessageId}`);
          connection.prepare(`
            INSERT INTO AiDesktopCustomerConcernEvidence
              (evidenceId, concernId, source, sourceConversationId, sourceTurnId, sourceMessageId,
               evidenceType, stance, evidenceExcerpt, occurredAt, createdAt)
            VALUES ($evidenceId, $concernId, $source, $conversationId, $turnId, $messageId,
              $evidenceType, $stance, $excerpt, $occurredAt, $now)
            ON CONFLICT(concernId, source, sourceMessageId, evidenceType, stance) DO UPDATE SET
              evidenceExcerpt=excluded.evidenceExcerpt, occurredAt=excluded.occurredAt
          `).run({
            $evidenceId: stableId("hanli-concern-evidence", concernId, candidate.source, message.sourceMessageId, evidence.evidenceType, evidence.stance),
            $concernId: concernId, $source: candidate.source, $conversationId: candidate.sourceConversationId,
            $turnId: candidate.sourceTurnId, $messageId: message.sourceMessageId, $evidenceType: evidence.evidenceType,
            $stance: evidence.stance, $excerpt: bounded(evidence.evidenceExcerpt, 600), $occurredAt: message.createdAt, $now: now,
          });
        }
      }
      const trajectoryId = stableId("hanli-trajectory", candidate.stableUserId, candidate.corpusTopicId);
      const trajectory = result.trajectory;
      connection.prepare(`
        INSERT INTO AiDesktopRequirementTrajectory
          (trajectoryId, stableUserId, sourceCorpusTopicId, projectScope, customerGoal,
           confirmedFactsJson, assumptionsJson, conflictsJson, informationGapsJson,
           implicitRequirementsJson, selectedAction, questionAsked, questionReason, customerAnswer,
           resultSummary, evolutionDirection, acceptanceEvidenceJson, maturityScore, createdAt, updatedAt)
        VALUES ($trajectoryId, $stableUserId, $topicId, $projectScope, $customerGoal,
          $confirmed, $assumptions, $conflicts, $gaps, $implicit, $action, $question, $reason, $answer,
          $result, $direction, $acceptance, $maturity, $now, $now)
        ON CONFLICT(stableUserId, sourceCorpusTopicId) DO UPDATE SET
          projectScope=excluded.projectScope, customerGoal=excluded.customerGoal,
          confirmedFactsJson=excluded.confirmedFactsJson, assumptionsJson=excluded.assumptionsJson,
          conflictsJson=excluded.conflictsJson, informationGapsJson=excluded.informationGapsJson,
          implicitRequirementsJson=excluded.implicitRequirementsJson, selectedAction=excluded.selectedAction,
          questionAsked=excluded.questionAsked, questionReason=excluded.questionReason, customerAnswer=excluded.customerAnswer,
          resultSummary=excluded.resultSummary, evolutionDirection=excluded.evolutionDirection,
          acceptanceEvidenceJson=excluded.acceptanceEvidenceJson, maturityScore=excluded.maturityScore, updatedAt=excluded.updatedAt
      `).run({
        $trajectoryId: trajectoryId, $stableUserId: candidate.stableUserId, $topicId: candidate.corpusTopicId,
        $projectScope: bounded(candidate.projectScope, 1_000), $customerGoal: bounded(trajectory.customerGoal, 2_000),
        $confirmed: jsonList(trajectory.confirmedFacts), $assumptions: jsonList(trajectory.assumptions), $conflicts: jsonList(trajectory.conflicts),
        $gaps: jsonList(trajectory.informationGaps), $implicit: jsonList(trajectory.implicitRequirements), $action: trajectory.selectedAction,
        $question: nullableText(trajectory.questionAsked, 1_000), $reason: nullableText(trajectory.questionReason, 2_000),
        $answer: nullableText(trajectory.customerAnswer, 4_000), $result: nullableText(trajectory.resultSummary, 4_000),
        $direction: nullableText(trajectory.evolutionDirection, 2_000), $acceptance: jsonList(trajectory.acceptanceEvidence),
        $maturity: normalizedScore(trajectory.maturityScore), $now: now,
      });
      connection.prepare(`DELETE FROM AiDesktopRequirementNode WHERE trajectoryId=$trajectoryId`).run({ $trajectoryId: trajectoryId });
      for (const node of trajectory.nodes.slice(0, 80)) {
        const evidenceMessageIds = [...new Set(node.evidenceMessageIds)];
        for (const messageId of evidenceMessageIds) if (!sourceMessages.has(messageId)) throw new Error(`需求节点引用了当前语料之外的消息：${messageId}`);
        connection.prepare(`INSERT INTO AiDesktopRequirementNode
          (requirementNodeId, trajectoryId, nodeKey, parentNodeKey, title, category, status,
           statement, critical, evidenceMessageIdsJson, createdAt, updatedAt)
          VALUES ($nodeId, $trajectoryId, $nodeKey, $parentNodeKey, $title, $category, $status,
            $statement, $critical, $evidence, $now, $now)`)
          .run({
            $nodeId: stableId("hanli-requirement-node", trajectoryId, node.nodeKey), $trajectoryId: trajectoryId,
            $nodeKey: bounded(node.nodeKey, 160), $parentNodeKey: nullableText(node.parentNodeKey, 160),
            $title: bounded(node.title, 240), $category: bounded(node.category, 120), $status: node.status,
            $statement: bounded(node.statement, 3_000), $critical: node.critical ? 1 : 0,
            $evidence: JSON.stringify(evidenceMessageIds), $now: now,
          });
      }
      connection.prepare(`UPDATE AiDesktopCorpusExtractionState
        SET status='completed', completedAt=$now, nextRetryAt=NULL, lastError=NULL, updatedAt=$now
        WHERE extractionId=$extractionId`).run({ $now: now, $extractionId: candidate.extractionId });
    });
  }

  /** 保存失败并指数退避；连续五次无效结果进入 blocked，防止启动后无限消耗模型。 */
  fail(candidate: HanliCorpusExtractionCandidateOutDto, error: unknown): void {
    const now = new Date();
    this.database.transaction((connection) => {
      const current = connection.prepare(`SELECT attemptCount FROM AiDesktopCorpusExtractionState WHERE extractionId=$extractionId`)
        .get({ $extractionId: candidate.extractionId }) as { attemptCount: number } | undefined;
      const attempts = Number(current?.attemptCount || 1);
      const blocked = attempts >= 5;
      connection.prepare(`UPDATE AiDesktopCorpusExtractionState
        SET status=$status, nextRetryAt=$nextRetryAt, lastError=$lastError, updatedAt=$now
        WHERE extractionId=$extractionId AND status='processing'`).run({
          $status: blocked ? "blocked" : "retryable",
          $nextRetryAt: blocked ? null : new Date(now.getTime() + Math.min(1_440, 2 ** Math.max(0, attempts - 1)) * 60_000).toISOString(),
          $lastError: bounded(error instanceof Error ? error.message : String(error), 2_000),
          $now: now.toISOString(), $extractionId: candidate.extractionId,
        });
    });
  }

  /** 按稳定用户和项目读取近期成熟认知；每条关注点保留原始消息证据地址。 */
  readContext(stableUserId: string, projectScope: string, query = "", requestedLimit = 20): HanliSemanticContextOutDto {
    const limit = Math.max(1, Math.min(50, Math.trunc(requestedLimit)));
    // 当前 query 只表示调用场景，不用关键词裁剪事实；由韩立对有证据的有限候选做语义判断。
    void query;
    return this.database.withConnection((connection) => {
      const concernRows = connection.prepare(`SELECT * FROM AiDesktopCustomerConcern
        WHERE stableUserId=$stableUserId AND status <> 'invalid'
          AND (scopeType='global' OR scopeId IS NULL OR scopeId=$projectScope)
        ORDER BY CASE status WHEN 'confirmed' THEN 0 WHEN 'conflicted' THEN 1 ELSE 2 END,
          weight DESC, lastObservedAt DESC LIMIT $limit`)
        .all({ $stableUserId: stableUserId, $projectScope: projectScope, $limit: limit }) as Array<Record<string, unknown>>;
      const evidenceQuery = connection.prepare(`SELECT evidenceId, source, sourceMessageId, evidenceType, stance, evidenceExcerpt, occurredAt
        FROM AiDesktopCustomerConcernEvidence WHERE concernId=$concernId ORDER BY occurredAt DESC LIMIT 12`);
      const concerns = concernRows.map((row) => concernFromRow(row, evidenceQuery.all({ $concernId: String(row.concernId) }) as Array<Record<string, unknown>>));
      const trajectoryRows = connection.prepare(`SELECT * FROM AiDesktopRequirementTrajectory
        WHERE stableUserId=$stableUserId AND (projectScope=$projectScope OR projectScope='global')
        ORDER BY maturityScore DESC, updatedAt DESC LIMIT $limit`)
        .all({ $stableUserId: stableUserId, $projectScope: projectScope, $limit: limit }) as Array<Record<string, unknown>>;
      const nodeQuery = connection.prepare(`SELECT * FROM AiDesktopRequirementNode WHERE trajectoryId=$trajectoryId ORDER BY critical DESC, createdAt`);
      const trajectories = trajectoryRows.map((row) => trajectoryFromRow(row, nodeQuery.all({ $trajectoryId: String(row.trajectoryId) }) as Array<Record<string, unknown>>));
      const experienceRows = connection.prepare(`SELECT * FROM AiDesktopInspectionExperience
        WHERE stableUserId=$stableUserId AND (projectScope=$projectScope OR projectScope='global')
          AND confidenceStatus IN ('verified-project', 'limited')
        ORDER BY updatedAt DESC LIMIT $limit`)
        .all({ $stableUserId: stableUserId, $projectScope: projectScope, $limit: limit }) as Array<Record<string, unknown>>;
      return { stableUserId, projectScope, concerns, trajectories, inspectionExperiences: experienceRows.map(experienceFromRow) };
    });
  }

  /** 只有失败后修正且真实复验通过的候选进入项目经验；同一复验运行重复提交保持幂等。 */
  recordExperience(stableUserId: string, projectScope: string, candidate: HanliAcceptanceExperienceCandidateOutDto): void {
    const now = new Date().toISOString();
    this.database.withConnection((connection) => connection.prepare(`INSERT INTO AiDesktopInspectionExperience
      (inspectionExperienceId, stableUserId, projectScope, title, scopeLevel,
       applicableObjectTypesJson, applicabilityConditionsJson, sourceFindingIdsJson,
       failedProposalId, correctionProposalId, failedRunId, passedRetestRunId,
       counterexamplesJson, confidenceStatus, supersededByExperienceId, createdAt, updatedAt)
      VALUES ($id, $stableUserId, $projectScope, $title, 'project', $objects, '[]', $findings,
        $failedProposalId, $correctionProposalId, $failedRunId, $passedRetestRunId,
        '[]', 'verified-project', NULL, $createdAt, $now)
      ON CONFLICT(stableUserId, passedRetestRunId) DO UPDATE SET title=excluded.title,
        applicableObjectTypesJson=excluded.applicableObjectTypesJson,
        sourceFindingIdsJson=excluded.sourceFindingIdsJson, confidenceStatus='verified-project', updatedAt=excluded.updatedAt`)
      .run({
        $id: candidate.candidateId, $stableUserId: stableUserId, $projectScope: bounded(projectScope, 1_000),
        $title: bounded(candidate.title, 1_000), $objects: JSON.stringify(candidate.applicableScope.slice(0, 30)),
        $findings: JSON.stringify(candidate.sourceFailureEvidenceIds.slice(0, 100)), $failedProposalId: candidate.failedProposalId,
        $correctionProposalId: candidate.correctionProposalId, $failedRunId: candidate.failedRunId,
        $passedRetestRunId: candidate.passedRetestRunId, $createdAt: candidate.createdAt, $now: now,
      }));
  }
}

function shouldClaim(state: Record<string, unknown> | undefined, hash: string, version: string, now: string, leaseExpiredAt: string): boolean {
  if (!state || state.sourceContentHash !== hash || state.extractorVersion !== version) return true;
  if (["pending", "superseded"].includes(String(state.status))) return true;
  if (state.status === "retryable") return !state.nextRetryAt || String(state.nextRetryAt) <= now;
  if (state.status === "processing") return !state.claimedAt || String(state.claimedAt) <= leaseExpiredAt;
  return false;
}

function concernFromRow(row: Record<string, unknown>, evidenceRows: Array<Record<string, unknown>>): HanliCustomerConcernOutDto {
  return {
    concernId: String(row.concernId), semanticKey: String(row.semanticKey), name: String(row.name), description: String(row.description),
    category: String(row.category), scopeType: String(row.scopeType) as HanliCustomerConcernOutDto["scopeType"], scopeId: row.scopeId ? String(row.scopeId) : null,
    status: String(row.status) as HanliCustomerConcernOutDto["status"], confidence: Number(row.confidence), weight: Number(row.weight),
    lastObservedAt: String(row.lastObservedAt), evidence: evidenceRows.map((item) => ({
      evidenceId: String(item.evidenceId), source: String(item.source) as HanliCustomerConcernOutDto["evidence"][number]["source"],
      sourceMessageId: String(item.sourceMessageId), evidenceType: String(item.evidenceType) as HanliCustomerConcernOutDto["evidence"][number]["evidenceType"],
      stance: String(item.stance) as HanliCustomerConcernOutDto["evidence"][number]["stance"], evidenceExcerpt: String(item.evidenceExcerpt), occurredAt: String(item.occurredAt),
    })),
  };
}

function trajectoryFromRow(row: Record<string, unknown>, nodeRows: Array<Record<string, unknown>>): HanliRequirementTrajectoryOutDto {
  return {
    trajectoryId: String(row.trajectoryId), sourceCorpusTopicId: String(row.sourceCorpusTopicId), projectScope: String(row.projectScope),
    customerGoal: String(row.customerGoal), confirmedFacts: parseStringArray(row.confirmedFactsJson), assumptions: parseStringArray(row.assumptionsJson),
    conflicts: parseStringArray(row.conflictsJson), informationGaps: parseStringArray(row.informationGapsJson), implicitRequirements: parseStringArray(row.implicitRequirementsJson),
    selectedAction: String(row.selectedAction), questionAsked: row.questionAsked ? String(row.questionAsked) : null,
    questionReason: row.questionReason ? String(row.questionReason) : null, resultSummary: row.resultSummary ? String(row.resultSummary) : null,
    evolutionDirection: row.evolutionDirection ? String(row.evolutionDirection) : null, maturityScore: Number(row.maturityScore),
    updatedAt: String(row.updatedAt), nodes: nodeRows.map((item) => ({
      requirementNodeId: String(item.requirementNodeId), nodeKey: String(item.nodeKey), parentNodeKey: item.parentNodeKey ? String(item.parentNodeKey) : null,
      title: String(item.title), category: String(item.category), status: String(item.status) as HanliRequirementNodeOutDto["status"],
      statement: String(item.statement), critical: Number(item.critical) === 1, evidenceMessageIds: parseStringArray(item.evidenceMessageIdsJson),
    })),
  };
}

function experienceFromRow(row: Record<string, unknown>): HanliInspectionExperienceOutDto {
  return {
    inspectionExperienceId: String(row.inspectionExperienceId), title: String(row.title), projectScope: String(row.projectScope),
    scopeLevel: String(row.scopeLevel) as HanliInspectionExperienceOutDto["scopeLevel"], applicableObjectTypes: parseStringArray(row.applicableObjectTypesJson),
    applicabilityConditions: parseStringArray(row.applicabilityConditionsJson), sourceFindingIds: parseStringArray(row.sourceFindingIdsJson),
    confidenceStatus: String(row.confidenceStatus) as HanliInspectionExperienceOutDto["confidenceStatus"], updatedAt: String(row.updatedAt),
  };
}

function stableId(prefix: string, ...parts: string[]): string { return `${prefix}-${createHash("sha256").update(parts.join("\u001f"), "utf8").digest("hex").slice(0, 32)}`; }
function hashJson(value: unknown): string { return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex"); }
function bounded(value: string, maximum: number): string { return String(value || "").replaceAll(/\s+/g, " ").trim().slice(0, maximum); }
function nullableText(value: string | null | undefined, maximum: number): string | null { const result = bounded(value || "", maximum); return result || null; }
function normalizedScore(value: number): number { return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)); }
function jsonList(value: string[]): string { return JSON.stringify([...new Set((value || []).map((item) => bounded(item, 2_000)).filter(Boolean))].slice(0, 100)); }
function parseStringArray(value: unknown): string[] { try { const parsed = JSON.parse(String(value || "[]")); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []; } catch { return []; } }
function evidenceTime(evidence: HanliSemanticExtractionInDto["concerns"][number]["evidence"], messages: Map<string, { createdAt: string }>, newest: boolean): string | null {
  const values = evidence.map((item) => messages.get(item.sourceMessageId)?.createdAt).filter((value): value is string => Boolean(value)).sort();
  return (newest ? values.at(-1) : values[0]) || null;
}
