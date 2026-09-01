/** Codex Harness 桥接；认证、审批、进程和凭据始终留在主进程。 */
import { invoke, subscribe } from "../ipc-client.cjs";

export function codexBridge() {
  return {
    getCodexStatus: () => invoke("desktop:get-codex-status"),
    getCodexModels: () => invoke("desktop:get-codex-models"),
    getActiveCodexSession: () => invoke("desktop:get-active-codex-session"),
    loginWithChatGPT: () => invoke("desktop:login-with-chatgpt"),
    logoutCodex: () => invoke("desktop:logout-codex"),
    getCodexApprovals: () => invoke("desktop:get-codex-approvals"),
    resolveCodexApproval: (requestId: number, decision: "accept" | "decline") => invoke("desktop:resolve-codex-approval", requestId, decision),
    getTrustedCommandInfo: () => invoke("desktop:get-trusted-command-info"),
    clearTrustedCommands: () => invoke("desktop:clear-trusted-commands"),
    prepareAutomaticTesting: () => invoke("desktop:prepare-automatic-testing"),
    getCodexUserInputs: () => invoke("desktop:get-codex-user-inputs"),
    resolveCodexUserInput: (request: unknown) => invoke("desktop:resolve-codex-user-input", request),
    newChat: () => invoke("desktop:new-chat"),
    onCodexStreamEvent: (listener: (event: unknown) => void) => subscribe("desktop:codex-stream-event", listener),
    cancel: () => invoke("desktop:cancel"),
  };
}
