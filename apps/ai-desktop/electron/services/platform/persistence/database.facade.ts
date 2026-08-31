// 数据库端口只描述业务 Repository 所需的事务能力，避免上层依赖 SQLite 文件与迁移细节。
export type DatabasePort = import("./internal/sqlite-database.js").SqliteDatabase;
// 初始化函数负责安全路径、迁移和恢复状态；调用方只接收可用端口或明确不可用状态。
export {
  initializeAiMemoryDatabase,
  type AiMemoryDatabaseInitialization,
  type InitializeAiMemoryDatabaseOptions,
} from "./internal/sqlite-database.js";
