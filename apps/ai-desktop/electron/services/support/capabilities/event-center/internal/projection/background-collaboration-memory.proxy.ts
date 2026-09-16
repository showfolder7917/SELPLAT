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

/** Worker 请求始终异步完成，不能被同步业务端口误用。 */
export type BackgroundCollaborationMemoryPort = {
  [Method in keyof CollaborationMemoryPort]: CollaborationMemoryPort[Method] extends (...args: infer Args) => infer Result
    ? (...args: Args) => Promise<Result>
    : never;
};

/** 主进程人物记忆代理只发送可复制 DTO；Worker 负责白名单、FIFO 和 SQLite 事务。 */
export function createBackgroundCollaborationMemory(persistence: BackgroundPersistencePort): BackgroundCollaborationMemoryPort {
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
  }) as BackgroundCollaborationMemoryPort;
}
