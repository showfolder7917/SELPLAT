import type { AsyncCollaborationMemoryPort } from "../../../../../../../contracts/services/support/capabilities/event-center/index.js";
import type { BackgroundPersistencePort } from "../../../../platform/persistence/index.js";
import { isCollaborationMemoryMethod } from "./collaboration-memory-methods.js";

/** 主进程人物记忆代理只发送可复制 DTO；Worker 负责白名单、FIFO 和 SQLite 事务。 */
export function createBackgroundCollaborationMemory(persistence: BackgroundPersistencePort): AsyncCollaborationMemoryPort {
  return new Proxy({}, {
    get: (_target, property) => {
      // Promise 同化会读取 then；它不是人物记忆命令，必须返回 undefined。
      if (property === "then" || !isCollaborationMemoryMethod(property)) {
        return undefined;
      }
      return (...args: unknown[]) => persistence.request({
        operation: "collaboration-memory",
        payload: { method: property, args },
      });
    },
  }) as AsyncCollaborationMemoryPort;
}
