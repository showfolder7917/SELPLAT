// 持久化平台唯一出口提供数据库端口与初始化能力，不公开连接、迁移 Runner 或事务函数。
export {
  initializeAiMemoryDatabase,
  initializeWorkflowDatabase,
  discardFreshWorkflowDatabase,
  type AiMemoryDatabaseInitialization,
  type InitializeAiMemoryDatabaseOptions,
  type DatabasePort,
} from "./database.facade.js";
export type { BackgroundPersistencePort } from "./background-persistence.port.js";
export { BackgroundPersistenceWorkerPort } from "./background-persistence.worker-port.js";
// 首次拆分控制库时由后台 Worker 调用，外部不能取得底层 SQLite 连接。
export { migrateWorkflowControlData } from "./internal/workflow-control-migration.js";
export type { BackgroundPersistenceOperation, BackgroundPersistenceRequest } from "./background-persistence.port.js";
// 通用原子 JSON Port 让人物状态与文件系统实现解耦。
export {
  createAtomicJsonPersistence,
  type AtomicJsonPersistencePort,
} from "./internal/atomic-json.persistence.js";
