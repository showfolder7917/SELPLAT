import type { EvolutionStateOutDto } from "../../../../contracts/collaboration/evolution/index.js";
import type { DatabasePort as SqliteDatabase } from "../../support/platform/persistence/index.js";

/**
 * 作用：为南宫婉专题演化状态提供唯一 SQLite 持久化边界。
 * 真实传参示例：保存 version=8 且 oneShotRun=null 的当前状态。
 * 真实返回示例：重新启动后读取同一份完整状态；首次启用时仅从会话记忆表恢复原话。
 * 异常或副作用示例：数据库不可用或状态 JSON 损坏时阻断写入，不回退到 JSON 文件。
 */
export interface EvolutionStatePersistence {
  load(): EvolutionStateOutDto | null;
  loadLatestConversation(): EvolutionStateOutDto["conversation"] | null;
  save(state: EvolutionStateOutDto): void;
}

/** Evolution 状态的 SQLite 投影仓库；只保存共同事实，不保存任何人物私有会话控制器。 */
export class EvolutionStateRepository implements EvolutionStatePersistence {
  readonly #database: SqliteDatabase | null;

  constructor(database: SqliteDatabase | null) {
    this.#database = database;
  }

  load(): EvolutionStateOutDto | null {
    if (!this.#database) return null;
    const row = this.#database.withConnection((connection) => connection.prepare(`
      SELECT stateJson FROM AiDesktopEvolutionState WHERE singletonId = 1
    `).get() as { stateJson: string } | undefined);
    if (!row) return null;
    return JSON.parse(row.stateJson) as EvolutionStateOutDto;
  }

  loadLatestConversation(): EvolutionStateOutDto["conversation"] | null {
    if (!this.#database) return null;
    return this.#database.withConnection((connection) => {
      const latest = connection.prepare(`
        SELECT conversationId FROM AiDesktopConversationMemory
        ORDER BY recordedAt DESC LIMIT 1
      `).get() as { conversationId: string } | undefined;
      if (!latest) return null;
      const rows = connection.prepare(`
        SELECT messageId, role, content, inferredIntent, createdAt
        FROM AiDesktopConversationMemory
        WHERE conversationId = $conversationId
        ORDER BY sequenceNumber
      `).all({ $conversationId: latest.conversationId }) as Array<{
        messageId: string;
        role: "user" | "nangong";
        content: string;
        inferredIntent: string | null;
        createdAt: string;
      }>;
      return {
        conversationId: latest.conversationId,
        messages: rows.map((row, sequenceNumber) => ({
          messageId: row.messageId,
          sequenceNumber,
          role: row.role,
          content: row.content,
          replyToMessageId: row.role === "nangong" ? rows.slice(0, sequenceNumber).reverse().find((candidate) => candidate.role === "user")?.messageId || null : null,
          deliveryStatus: "completed",
          attachmentIds: [],
          inferredIntent: row.inferredIntent || undefined,
          createdAt: row.createdAt,
          completedAt: row.createdAt,
        })),
        updatedAt: rows.at(-1)?.createdAt || new Date().toISOString(),
      };
    });
  }

  save(state: EvolutionStateOutDto): void {
    if (!this.#database) throw new Error("AI Memory 数据库当前不可用，专题演化状态未保存；请先恢复数据库后重试。");
    this.#database.transaction((connection) => connection.prepare(`
      INSERT INTO AiDesktopEvolutionState (singletonId, stateVersion, stateJson, updatedAt)
      VALUES (1, $stateVersion, $stateJson, $updatedAt)
      ON CONFLICT(singletonId) DO UPDATE SET
        stateVersion=excluded.stateVersion,
        stateJson=excluded.stateJson,
        updatedAt=excluded.updatedAt
    `).run({
      $stateVersion: state.version,
      $stateJson: JSON.stringify(state),
      $updatedAt: state.updatedAt,
    }));
  }
}
