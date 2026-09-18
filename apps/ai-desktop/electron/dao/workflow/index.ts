import type { WorkflowPersistencePort } from "../../services/workflow/index.js";
import type { DatabasePort } from "../platform/index.js";
import { SqliteWorkflowDao } from "./internal/workflow.dao.js";

/** 为系统组合根创建 Workflow SQLite DAO。 */
export function createWorkflowDao(database: DatabasePort): WorkflowPersistencePort {
  return new SqliteWorkflowDao(database);
}
