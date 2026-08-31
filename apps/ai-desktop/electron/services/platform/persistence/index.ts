// 持久化平台唯一出口提供数据库端口与初始化能力，不公开连接、迁移 Runner 或事务函数。
export {
  initializeAiMemoryDatabase,
  type AiMemoryDatabaseInitialization,
  type InitializeAiMemoryDatabaseOptions,
  type DatabasePort,
} from "./database.facade.js";
// 通用原子 JSON Port 让人物状态与文件系统实现解耦。
export {
  createAtomicJsonPersistence,
  type AtomicJsonPersistencePort,
} from "./internal/atomic-json.persistence.js";
