import type { PersonaCustomerDisplayProjector } from "../conversation/index.js";
import type { DatabasePort } from "../platform/index.js";
import { SqliteCollaborationMemoryDao } from "./internal/collaboration-memory.dao.js";

/** 为后台 Worker 创建统一人物记忆 DAO。 */
export function createCollaborationMemoryDao(
  database: DatabasePort,
  customerDisplayProjector: PersonaCustomerDisplayProjector,
): SqliteCollaborationMemoryDao {
  return new SqliteCollaborationMemoryDao(database, customerDisplayProjector);
}
