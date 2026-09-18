export type { BackgroundPersistencePort } from "./background-persistence.port.js";
export { BackgroundPersistenceWorkerPort } from "./background-persistence.worker-port.js";
export type { BackgroundPersistenceOperation, BackgroundPersistenceRequest } from "./background-persistence.port.js";
// 通用原子 JSON Port 让人物状态与文件系统实现解耦。
export {
  createAtomicJsonPersistence,
  type AtomicJsonPersistencePort,
} from "./internal/atomic-json.persistence.js";
