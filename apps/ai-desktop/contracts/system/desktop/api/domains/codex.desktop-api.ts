/**
 * Codex Harness 跨进程 API 的唯一领域视图。
 *
 * 调用链：Renderer conversation/testing -> codex desktop adapter -> codex preload bridge
 * -> codex IPC -> CodexFacade 与审批治理服务。
 */
import type { DesktopApi } from "../desktop.api.js";

/** Codex 领域包含认证、审批、用户输入、测试预检、流事件和取消能力。 */
export const CODEX_DESKTOP_API_METHODS = [
  "getCodexStatus",
  "getCodexModels",
  "getActiveCodexSession",
  "loginWithChatGPT",
  "logoutCodex",
  "getCodexApprovals",
  "getApprovalGovernance",
  "resolveCodexApproval",
  "getTrustedCommandInfo",
  "clearTrustedCommands",
  "prepareAutomaticTesting",
  "getCodexUserInputs",
  "resolveCodexUserInput",
  "newChat",
  "onCodexStreamEvent",
  "cancel",
] as const satisfies readonly (keyof DesktopApi)[];

/** Renderer 的 Codex 交互只能使用这一组白名单能力。 */
export type CodexDesktopApi = Pick<DesktopApi, (typeof CODEX_DESKTOP_API_METHODS)[number]>;
