/**
 * Desktop 能力类型注册表。
 *
 * 生产者：各主进程领域 handler 与 preload 领域桥接。
 * 消费者：边界测试、桥接实现和 Renderer foundation adapter。
 * 数据方向：每个 `DesktopApi` 方法稳定对应一组参数与一个异步或同步返回类型。
 * 本文件只从纯 contracts 推导类型，不导入 Electron、React、Node 或具体实现。
 */
import type { DesktopApi } from "../api/desktop.api.js";

type ApiMethod = (...arguments_: never[]) => unknown;

/** 将 DesktopApi 方法签名转换为可逐项审计的 request/response 协议。 */
export type DesktopCapabilityDefinitionValue<Method extends ApiMethod> = {
  request: Parameters<Method>;
  response: Awaited<ReturnType<Method>>;
};

/**
 * 统一能力注册表：能力 ID 就是稳定的 DesktopApi 方法名。
 * 新增跨进程方法若未进入 DesktopApi，就不会出现在注册表，也不允许由 preload 私自暴露。
 */
export type DesktopCapabilityRegistryValue = {
  [CapabilityId in keyof DesktopApi]: DesktopApi[CapabilityId] extends ApiMethod
    ? DesktopCapabilityDefinitionValue<DesktopApi[CapabilityId]>
    : never;
};

/** 按职责聚合能力 ID，供组合根和静态门禁检查领域归属。 */
export const DESKTOP_CAPABILITY_DOMAINS = {
  rules: ["getRuleBundleStatus", "listEffectiveRules", "resolveEffectiveRule"],
  system: ["getEnvironment", "getAiMemoryDatabaseStatus", "clearTestData", "getCorpusSemanticBackfillStatus", "startCorpusSemanticBackfill", "getSettings", "updateSettings", "getWorkspaces", "addWorkspace", "updateWorkspacePermission", "setPrimaryWorkspace", "removeWorkspace", "listWorkspaceEntries", "openExternalUrl", "getTempDirectoryInfo", "openTempDirectory", "clearTempFiles", "getAuditLogInfo", "openAuditLogDirectory", "reportRendererException", "windowControl"],
  codex: ["getCodexStatus", "getCodexModels", "getActiveCodexSession", "loginWithChatGPT", "logoutCodex", "getCodexApprovals", "getApprovalGovernance", "resolveCodexApproval", "getTrustedCommandInfo", "clearTrustedCommands", "prepareAutomaticTesting", "getCodexUserInputs", "resolveCodexUserInput", "newChat", "onCodexStreamEvent", "cancel"],
  screenshot: ["prepareScreenCapture", "openScreenRecordingSettings", "restartForScreenRecordingPermission", "captureScreen", "notifyScreenCaptureStage", "onScreenCaptureFrameRequested", "submitScreenCaptureFrameResult", "showScreenshotWindow", "onScreenCaptureReset", "enterScreenshotAnnotation", "returnScreenshotSelection", "endScreenshotEditing", "saveScreenshot", "onScreenshotCompleted"],
  collaboration: ["getCollaborationState", "getCollaborationTimeline", "onCollaborationTimelineChanged", "setDesktopOperatingMode", "selectCollaborationMember", "createCollaborationMember", "updateCollaborationMember", "deleteCollaborationMember", "submitCollaborationTask", "continueCollaborationTask", "cancelCollaborationTask", "onCollaborationState", "onCollaborationStream", "getLinghuAutomationState", "setLinghuAutomationEnabled", "createLinghuStartupPrompt", "updateLinghuStartupPrompt", "deleteLinghuStartupPrompt", "selectLinghuStartupPrompt", "onLinghuAutomationState", "getEvolutionState", "getEvolutionTopicDossier", "getPersonaConversation", "onPersonaConversationChanged", "sendPersonaConversationMessage", "newPersonaConversation", "createEvolutionTopic", "configureEvolutionAutomation", "controlEvolutionAutomation", "resumeEvolutionOneShot", "generateNangongTopicDraft", "convertNangongConversationToTopic", "createEvolutionProposal", "updateEvolutionTopic", "createLinghuRepairProposal", "decideEvolutionProposal", "decideEvolutionResult", "generateHanLiAcceptancePlan", "executeHanLiAcceptancePlan", "reviseEvolutionProposal", "autoApproveEvolutionProposal", "dispatchEvolutionProposal", "onEvolutionState"],
  conversation: ["getConversationDispatchState", "enqueueMessage", "supplementQueuedMessage", "discardQueuedMessage", "recoverConversationTask", "discardConversationRecovery", "onConversationDispatchState", "sendMessage"],
} as const satisfies Record<string, readonly (keyof DesktopCapabilityRegistryValue)[]>;
