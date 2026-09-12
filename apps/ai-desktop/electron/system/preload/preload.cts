/** Electron 安全桥接组合根：只拼装领域白名单，不承载业务判断或文件系统能力。 */
import { contextBridge } from "electron";

import { collaborationBridge } from "./domains/collaboration-bridge.cjs";
import { codexBridge } from "./domains/codex-bridge.cjs";
import { conversationBridge } from "./domains/conversation-bridge.cjs";
import { rulesBridge } from "./domains/rules-bridge.cjs";
import { screenshotBridge } from "./domains/screenshot-bridge.cjs";
import { systemBridge } from "./domains/system-bridge.cjs";

// 每个领域只返回可序列化函数；Renderer 永远拿不到 ipcRenderer 或 Electron Event。
const desktopBridge = {
  ...systemBridge(),
  ...rulesBridge(),
  ...codexBridge(),
  ...screenshotBridge(),
  ...collaborationBridge(),
  ...conversationBridge(),
};

// 韩立空状态验收窗口仅用于观察和固定导航；即使 Renderer 被错误操作也不能写入正式应用状态。
const readOnlyAcceptanceWindow = process.argv.includes("--hanli-empty-task-group-acceptance");
const rejectAcceptanceMutation = () => Promise.reject(new Error("独立空状态验收窗口为只读，不能执行写入操作。"));
const acceptanceMutationNames = [
  "clearTestData", "startCorpusSemanticBackfill", "updateSettings", "addWorkspace", "updateWorkspacePermission", "setPrimaryWorkspace", "removeWorkspace",
  "loginWithChatGPT", "logoutCodex", "resolveCodexApproval", "clearTrustedCommands", "resolveCodexUserInput", "newChat", "openExternalUrl",
  "openScreenRecordingSettings", "restartForScreenRecordingPermission", "showScreenshotWindow", "enterScreenshotAnnotation", "returnScreenshotSelection", "endScreenshotEditing", "saveScreenshot", "openTempDirectory", "clearTempFiles", "openAuditLogDirectory",
  "setDesktopOperatingMode", "submitCollaborationTask", "continueCollaborationTask", "cancelCollaborationTask", "setLinghuAutomationEnabled", "newLinghuDisplayConversation",
  "sendPersonaConversationMessage", "newPersonaConversation", "selectPersonaConversationModel", "generateNangongTopicDraft", "convertNangongConversationToTopic", "createEvolutionTopic", "updateEvolutionTopic", "configureEvolutionAutomation", "controlEvolutionAutomation", "resumeEvolutionOneShot", "createEvolutionProposal", "decideEvolutionProposal", "decideEvolutionResult", "reviseEvolutionProposal", "autoApproveEvolutionProposal", "dispatchEvolutionProposal",
  "enqueueMessage", "supplementQueuedMessage", "discardQueuedMessage", "recoverConversationTask", "discardConversationRecovery", "sendMessage", "cancel",
];
const isolatedAcceptanceBridge = readOnlyAcceptanceWindow
  ? Object.fromEntries(acceptanceMutationNames.map((name) => [name, rejectAcceptanceMutation]))
  : {};

contextBridge.exposeInMainWorld("desktop", { ...desktopBridge, ...isolatedAcceptanceBridge });
