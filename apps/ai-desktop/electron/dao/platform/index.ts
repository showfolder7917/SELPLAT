// SQLite 技术实现的唯一公开入口；业务服务不得直接导入本模块。
export {
  SqliteDatabase,
  initializeAiMemoryDatabase,
  initializeWorkflowDatabase,
  discardFreshWorkflowDatabase,
  type AiMemoryDatabaseInitialization,
  type InitializeAiMemoryDatabaseOptions,
} from "./internal/sqlite-database.js";
export { migrateWorkflowControlData } from "./internal/workflow-control-migration.js";
export type DatabasePort = import("./internal/sqlite-database.js").SqliteDatabase;
