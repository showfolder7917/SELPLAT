import type { CollaborationMemoryPort } from "../../../../../../../contracts/services/support/capabilities/event-center/index.js";
import type { BackgroundPersistencePort } from "../../../../platform/persistence/index.js";

const collaborationMemoryMethods = new Set<keyof CollaborationMemoryPort>([
  "savePersonaConversation", "syncEvolutionState", "buildNangongContext", "approvalEvidence",
  "searchTrainingCorpusTopics", "readHanLiEvolutionCorpus", "recordRequirementDiscussionContext",
  "readRequirementDiscussionContext", "registerNangongRound", "claimHanliCorpusExtractions",
  "completeHanliCorpusExtraction", "failHanliCorpusExtraction", "readHanliSemanticContext",
  "recordVerifiedInspectionExperience", "readPersonaConversation", "readPersonaCustomerDisplayConversation",
  "readPersonaCustomerDisplayWindow", "retryPersonaCustomerDisplayMessage", "newPersonaConversation",
  "selectPersonaConversationModel", "appendPersonaInternalMessage", "updatePersonaInternalProgress",
  "appendPersonaRecoveryCheckpoint", "appendPersonaCustomerMessage", "registerPersonaRound",
]);

/** 主进程必须等待 Worker 回包，不能把跨线程调用伪装为同步数据库访问。 */
export type AsyncCollaborationMemoryPort = {
  [Method in keyof CollaborationMemoryPort]: CollaborationMemoryPort[Method] extends (...args: infer Args) => infer Result
    ? (...args: Args) => Promise<Result>
    : never;
};

/** 主进程人物记忆代理只发送可复制 DTO；Worker 负责白名单、FIFO 和 SQLite 事务。 */
export function createBackgroundCollaborationMemory(persistence: BackgroundPersistencePort): AsyncCollaborationMemoryPort {
  return new Proxy({}, {
    get: (_target, property) => {
      // Promise 同化会读取 then；它不是人物记忆命令，必须返回 undefined。
      if (property === "then" || typeof property !== "string" || !collaborationMemoryMethods.has(property as keyof CollaborationMemoryPort)) {
        return undefined;
      }
      return (...args: unknown[]) => persistence.request({
        operation: "collaboration-memory",
        payload: { method: property, args },
      });
    },
  }) as AsyncCollaborationMemoryPort;
}
