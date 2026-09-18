import type { EvolutionStateOutDto } from "../../../contracts/services/evolution/index.js";
import type { DatabasePort } from "../platform/index.js";
import { SqliteEvolutionStateDao } from "./internal/evolution-state.dao.js";

/** 为系统组合根创建唯一 Evolution SQLite DAO。 */
export function createEvolutionStateDao(
  database: DatabasePort | null,
  initialConversation: EvolutionStateOutDto["conversation"] | null = null,
): SqliteEvolutionStateDao {
  return new SqliteEvolutionStateDao(database, initialConversation);
}
