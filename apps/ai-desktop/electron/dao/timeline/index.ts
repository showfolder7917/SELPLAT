import type { CollaborationTimelinePersistencePort } from "../../services/support/capabilities/event-center/index.js";
import type { DatabasePort } from "../platform/index.js";
import { SqliteCollaborationTimelineDao } from "./internal/collaboration-timeline.dao.js";

/** 为系统组合根创建时间线 SQLite DAO。 */
export function createCollaborationTimelineDao(database: DatabasePort): CollaborationTimelinePersistencePort {
  return new SqliteCollaborationTimelineDao(database);
}
