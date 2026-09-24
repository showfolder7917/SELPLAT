import type { CollaborationMemoryPort } from "../../../../../../../contracts/services/support/capabilities/event-center/index.js";

/** Worker 与主进程代理共用的唯一人物记忆命令表，新增能力时不得复制第二份白名单。 */
export const collaborationMemoryMethodNames = [
  "savePersonaConversation", "syncEvolutionState", "buildNangongContext", "approvalEvidence",
  "searchTrainingCorpusTopics", "readHanLiEvolutionCorpus", "recordRequirementDiscussionContext",
  "readRequirementDiscussionContext", "registerNangongRound", "claimHanliCorpusExtractions",
  "completeHanliCorpusExtraction", "failHanliCorpusExtraction", "readHanliSemanticContext",
  "recordVerifiedInspectionExperience", "readPersonaConversation", "readPersonaCustomerDisplayConversation",
  "readPersonaConversationCodexThread", "linkPersonaConversationCodexThread", "claimPersonaConversationCodexThread", "unlinkPersonaConversationCodexThread", "recordPersonaConversationRecovery",
  "readPersonaCustomerDisplayWindow", "retryPersonaCustomerDisplayMessage", "newPersonaConversation",
  "selectPersonaConversationModel", "appendPersonaInternalMessage", "updatePersonaInternalProgress",
  "appendPersonaRecoveryCheckpoint", "appendPersonaCustomerMessage", "registerPersonaRound",
] as const satisfies readonly (keyof CollaborationMemoryPort)[];

const collaborationMemoryMethods = new Set<keyof CollaborationMemoryPort>(collaborationMemoryMethodNames);

/** 将动态属性收敛为已登记的人物记忆命令。 */
export function isCollaborationMemoryMethod(value: PropertyKey): value is keyof CollaborationMemoryPort {
  return typeof value === "string" && collaborationMemoryMethods.has(value as keyof CollaborationMemoryPort);
}
