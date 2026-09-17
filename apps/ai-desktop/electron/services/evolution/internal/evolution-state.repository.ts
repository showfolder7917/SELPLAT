import { randomUUID } from "node:crypto";

import type { EvolutionStateOutDto } from "../../../../contracts/services/evolution/index.js";
import type { DatabasePort as SqliteDatabase } from "../../support/platform/persistence/index.js";

/**
 * 作用：为南宫婉专题演化状态提供唯一 SQLite 持久化边界。
 * 真实传参示例：保存 version=9 且 oneShotRun=null 的当前状态。
 * 真实返回示例：重新启动后读取同一份完整专题状态，并从统一人物会话表装配南宫婉原话。
 * 异常或副作用示例：数据库不可用或状态 JSON 损坏时阻断写入，不回退到 JSON 文件。
 */
export interface EvolutionStatePersistence {
  load(): EvolutionStateOutDto | null;
  loadLatestConversation(): EvolutionStateOutDto["conversation"] | null;
  loadLatestBlockedOneShotRecovery?(topicId: string, proposalId: string): {
    runId: string;
    startedAt: string;
    blockedAt: string;
    reason: string;
  } | null;
  save(state: EvolutionStateOutDto): void;
}

/** Evolution 状态的 SQLite 投影仓库；只保存共同事实，不保存任何人物私有会话控制器。 */
export class EvolutionStateRepository implements EvolutionStatePersistence {
  readonly #database: SqliteDatabase | null;
  readonly #initialConversation: EvolutionStateOutDto["conversation"];

  constructor(database: SqliteDatabase | null, initialConversation: EvolutionStateOutDto["conversation"] | null = null) {
    this.#database = database;
    this.#initialConversation = structuredClone(initialConversation || emptyConversation());
  }

  load(): EvolutionStateOutDto | null {
    if (!this.#database) return null;
    const row = this.#database.withConnection((connection) => connection.prepare(`
      SELECT stateJson FROM AiDesktopEvolutionState WHERE singletonId = 1
    `).get() as { stateJson: string } | undefined);
    if (!row) return null;
    // Evolution JSON 只保存专题运行事实；南宫婉正文由启动组合根从 AI Memory Worker 装配。
    return {
      ...(JSON.parse(row.stateJson) as Omit<EvolutionStateOutDto, "conversation">),
      conversation: this.#initialConversation,
    };
  }

  loadLatestConversation(): EvolutionStateOutDto["conversation"] | null {
    return this.#initialConversation ? structuredClone(this.#initialConversation) : null;
  }

  /** 只读查找统一异常中心已经落库的原验收运行事实，用于修复旧版本覆盖唯一运行指针的事故。 */
  loadLatestBlockedOneShotRecovery(topicId: string, proposalId: string): { runId: string; startedAt: string; blockedAt: string; reason: string } | null {
    if (!this.#database) return null;
    return this.#database.withConnection((connection) => connection.prepare(`
      SELECT
        json_extract(blocked.payloadJson, '$.runId') AS runId,
        COALESCE((
          SELECT confirmed.occurredAt
          FROM AiDesktopEvent confirmed
          WHERE confirmed.eventType = 'hanli.nangong.deliberation_confirmed'
            AND json_extract(confirmed.payloadJson, '$.runId') = json_extract(blocked.payloadJson, '$.runId')
          ORDER BY confirmed.occurredAt ASC
          LIMIT 1
        ), blocked.occurredAt) AS startedAt,
        blocked.occurredAt AS blockedAt,
        json_extract(blocked.payloadJson, '$.message') AS reason
      FROM AiDesktopEvent blocked
      WHERE blocked.eventType = 'technical.exception'
        AND json_extract(blocked.payloadJson, '$.operation') = 'run_hanli_result_acceptance'
        AND json_extract(blocked.payloadJson, '$.flowImpact') = 'blocked'
        AND json_extract(blocked.payloadJson, '$.topicId') = $topicId
        AND json_extract(blocked.payloadJson, '$.proposalId') = $proposalId
        AND length(trim(json_extract(blocked.payloadJson, '$.runId'))) > 0
      ORDER BY blocked.occurredAt DESC
      LIMIT 1
    `).get({ $topicId: topicId, $proposalId: proposalId }) as { runId: string; startedAt: string; blockedAt: string; reason: string } | undefined) || null;
  }

  save(state: EvolutionStateOutDto): void {
    if (!this.#database) throw new Error("工作流控制数据库当前不可用，专题演化状态未保存；请先恢复数据库后重试。");
    // 人物正文只由 AI Memory Worker 保存；控制库不得再打开或写入人物会话表。
    const { conversation: _conversation, ...persistedState } = state;
    this.#database.transaction((connection) => connection.prepare(`
      INSERT INTO AiDesktopEvolutionState (singletonId, stateVersion, stateJson, updatedAt)
      VALUES (1, $stateVersion, $stateJson, $updatedAt)
      ON CONFLICT(singletonId) DO UPDATE SET
        stateVersion=excluded.stateVersion,
        stateJson=excluded.stateJson,
        updatedAt=excluded.updatedAt
    `).run({
      $stateVersion: state.version,
      $stateJson: JSON.stringify(persistedState),
      $updatedAt: state.updatedAt,
    }));
  }
}

/** 无 Worker 的测试或数据库降级路径只建立内存会话，不在控制库创建人物正文。 */
function emptyConversation(): EvolutionStateOutDto["conversation"] {
  const now = new Date().toISOString();
  return {
    ownerPersonaId: "nangong-wan",
    conversationId: `persona-conversation-${randomUUID()}`,
    createdAt: now,
    messages: [],
    updatedAt: now,
  };
}
