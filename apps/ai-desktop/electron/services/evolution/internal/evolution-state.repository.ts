import type { EvolutionStateOutDto } from "../../../../contracts/services/evolution/index.js";
import { PersonaConversationRepository } from "../../support/capabilities/conversation/index.js";
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
  readonly #conversations: PersonaConversationRepository;

  constructor(database: SqliteDatabase | null) {
    this.#database = database;
    this.#conversations = new PersonaConversationRepository(database);
  }

  load(): EvolutionStateOutDto | null {
    if (!this.#database) return null;
    const row = this.#database.withConnection((connection) => connection.prepare(`
      SELECT stateJson FROM AiDesktopEvolutionState WHERE singletonId = 1
    `).get() as { stateJson: string } | undefined);
    if (!row) return null;
    // Evolution JSON 只保存专题运行事实；南宫婉正文每次从统一人物会话表装配。
    return {
      ...(JSON.parse(row.stateJson) as Omit<EvolutionStateOutDto, "conversation">),
      conversation: this.#conversations.readActive("nangong-wan"),
    };
  }

  loadLatestConversation(): EvolutionStateOutDto["conversation"] | null {
    if (!this.#database) return null;
    const conversation = this.#conversations.readActive("nangong-wan");
    return conversation.conversationId ? conversation : null;
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
    if (!this.#database) throw new Error("AI Memory 数据库当前不可用，专题演化状态未保存；请先恢复数据库后重试。");
    // 先保存统一人物会话，再保存不含正文的 Evolution 状态，杜绝两个权威副本。
    const savedConversation = this.#conversations.save(state.conversation);
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
    // 返回统一仓储已分配的真实序号和同时追加的交接消息，避免下一轮继续使用旧投影。
    state.conversation = savedConversation;
  }
}
