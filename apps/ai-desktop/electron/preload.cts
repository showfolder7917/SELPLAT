import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktop", {
  getEnvironment: () => ipcRenderer.invoke("desktop:get-environment"),
  getSettings: () => ipcRenderer.invoke("desktop:get-settings"),
  updateSettings: (settings: unknown) => ipcRenderer.invoke("desktop:update-settings", settings),
  getWorkspaces: () => ipcRenderer.invoke("desktop:get-workspaces"),
  addWorkspace: () => ipcRenderer.invoke("desktop:add-workspace"),
  updateWorkspacePermission: (id: string, permission: "read-only" | "workspace-write") =>
    ipcRenderer.invoke("desktop:update-workspace-permission", id, permission),
  setPrimaryWorkspace: (id: string) => ipcRenderer.invoke("desktop:set-primary-workspace", id),
  removeWorkspace: (id: string) => ipcRenderer.invoke("desktop:remove-workspace", id),
  listWorkspaceEntries: (id: string) => ipcRenderer.invoke("desktop:list-workspace-entries", id),
  getCodexStatus: () => ipcRenderer.invoke("desktop:get-codex-status"),
  loginWithChatGPT: () => ipcRenderer.invoke("desktop:login-with-chatgpt"),
  logoutCodex: () => ipcRenderer.invoke("desktop:logout-codex"),
  getCodexApprovals: () => ipcRenderer.invoke("desktop:get-codex-approvals"),
  resolveCodexApproval: (requestId: number, decision: "accept" | "decline") =>
    ipcRenderer.invoke("desktop:resolve-codex-approval", requestId, decision),
  newChat: () => ipcRenderer.invoke("desktop:new-chat"),
  sendMessage: (request: unknown) => ipcRenderer.invoke("desktop:send-message", request),
  cancel: () => ipcRenderer.invoke("desktop:cancel"),
  windowControl: (action: "minimize" | "maximize" | "close") => ipcRenderer.send("window:control", action),
});
