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
  getCodexModels: () => ipcRenderer.invoke("desktop:get-codex-models"),
  getActiveCodexSession: () => ipcRenderer.invoke("desktop:get-active-codex-session"),
  loginWithChatGPT: () => ipcRenderer.invoke("desktop:login-with-chatgpt"),
  logoutCodex: () => ipcRenderer.invoke("desktop:logout-codex"),
  getCodexApprovals: () => ipcRenderer.invoke("desktop:get-codex-approvals"),
  resolveCodexApproval: (requestId: number, decision: "accept" | "decline") =>
    ipcRenderer.invoke("desktop:resolve-codex-approval", requestId, decision),
  getTrustedCommandInfo: () => ipcRenderer.invoke("desktop:get-trusted-command-info"),
  clearTrustedCommands: () => ipcRenderer.invoke("desktop:clear-trusted-commands"),
  prepareAutomaticTesting: () => ipcRenderer.invoke("desktop:prepare-automatic-testing"),
  getCodexUserInputs: () => ipcRenderer.invoke("desktop:get-codex-user-inputs"),
  resolveCodexUserInput: (request: unknown) => ipcRenderer.invoke("desktop:resolve-codex-user-input", request),
  newChat: () => ipcRenderer.invoke("desktop:new-chat"),
  openExternalUrl: (url: string) => ipcRenderer.invoke("desktop:open-external-url", url),
  prepareScreenCapture: () => ipcRenderer.invoke("desktop:prepare-screen-capture"),
  openScreenRecordingSettings: () => ipcRenderer.invoke("desktop:open-screen-recording-settings"),
  restartForScreenRecordingPermission: () => ipcRenderer.invoke("desktop:restart-for-screen-recording-permission"),
  captureScreen: (request?: unknown) => ipcRenderer.invoke("desktop:capture-screen", request),
  notifyScreenCaptureStage: (stage: string, detail?: string) =>
    ipcRenderer.invoke("desktop:screen-capture-stage", stage, detail),
  onScreenCaptureFrameRequested: (listener: (request: unknown) => void) => {
    // 每轮只接收冻结帧命令，真实屏幕像素始终留在隔离截图窗口内处理。
    const handler = (_event: Electron.IpcRendererEvent, value: unknown) => listener(value);
    ipcRenderer.on("desktop:screen-capture-frame-requested", handler);
    return () => ipcRenderer.removeListener("desktop:screen-capture-frame-requested", handler);
  },
  submitScreenCaptureFrameResult: (result: unknown) => ipcRenderer.invoke("desktop:screen-capture-frame-result", result),
  showScreenshotWindow: () => ipcRenderer.invoke("desktop:show-screenshot-window"),
  onScreenCaptureReset: (listener: () => void) => {
    // 常驻截图壳进入空闲状态时通知渲染层销毁上一轮编辑器状态，防止复用旧选区和标注。
    const handler = () => listener();
    ipcRenderer.on("desktop:screen-capture-reset", handler);
    return () => ipcRenderer.removeListener("desktop:screen-capture-reset", handler);
  },
  enterScreenshotAnnotation: (request: unknown) => ipcRenderer.invoke("desktop:enter-screenshot-annotation", request),
  returnScreenshotSelection: () => ipcRenderer.invoke("desktop:return-screenshot-selection"),
  endScreenshotEditing: () => ipcRenderer.invoke("desktop:end-screenshot-editing"),
  saveScreenshot: (request: unknown) => ipcRenderer.invoke("desktop:save-screenshot", request),
  onScreenshotCompleted: (listener: (event: unknown) => void) => {
    // 独立截图窗口只回传主进程签发的附件与预览图，不向主窗口暴露窗口对象。
    const handler = (_event: Electron.IpcRendererEvent, value: unknown) => listener(value);
    ipcRenderer.on("desktop:screenshot-completed", handler);
    return () => ipcRenderer.removeListener("desktop:screenshot-completed", handler);
  },
  getTempDirectoryInfo: () => ipcRenderer.invoke("desktop:get-temp-directory-info"),
  openTempDirectory: () => ipcRenderer.invoke("desktop:open-temp-directory"),
  clearTempFiles: () => ipcRenderer.invoke("desktop:clear-temp-files"),
  getAuditLogInfo: () => ipcRenderer.invoke("desktop:get-audit-log-info"),
  openAuditLogDirectory: () => ipcRenderer.invoke("desktop:open-audit-log-directory"),
  getCollaborationState: () => ipcRenderer.invoke("desktop:get-collaboration-state"),
  setDesktopOperatingMode: (mode: string) => ipcRenderer.invoke("desktop:set-operating-mode", mode),
  selectCollaborationMember: (memberId: string) => ipcRenderer.invoke("desktop:select-collaboration-member", memberId),
  createCollaborationMember: (request: unknown) => ipcRenderer.invoke("desktop:create-collaboration-member", request),
  updateCollaborationMember: (memberId: string, request: unknown) => ipcRenderer.invoke("desktop:update-collaboration-member", memberId, request),
  deleteCollaborationMember: (memberId: string) => ipcRenderer.invoke("desktop:delete-collaboration-member", memberId),
  submitCollaborationTask: (request: unknown) => ipcRenderer.invoke("desktop:submit-collaboration-task", request),
  continueCollaborationTask: (taskId: string) => ipcRenderer.invoke("desktop:continue-collaboration-task", taskId),
  cancelCollaborationTask: (taskId: string) => ipcRenderer.invoke("desktop:cancel-collaboration-task", taskId),
  getLinghuAutomationState: () => ipcRenderer.invoke("desktop:get-linghu-automation-state"),
  setLinghuAutomationEnabled: (enabled: boolean) => ipcRenderer.invoke("desktop:set-linghu-automation-enabled", enabled),
  createLinghuStartupPrompt: (request: unknown) => ipcRenderer.invoke("desktop:create-linghu-startup-prompt", request),
  updateLinghuStartupPrompt: (promptId: string, request: unknown) => ipcRenderer.invoke("desktop:update-linghu-startup-prompt", promptId, request),
  deleteLinghuStartupPrompt: (promptId: string) => ipcRenderer.invoke("desktop:delete-linghu-startup-prompt", promptId),
  selectLinghuStartupPrompt: (promptId: string) => ipcRenderer.invoke("desktop:select-linghu-startup-prompt", promptId),
  onLinghuAutomationState: (listener: (event: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, value: unknown) => listener(value);
    ipcRenderer.on("desktop:linghu-automation-state", handler);
    return () => ipcRenderer.removeListener("desktop:linghu-automation-state", handler);
  },
  onCollaborationState: (listener: (event: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, value: unknown) => listener(value);
    ipcRenderer.on("desktop:collaboration-state", handler);
    return () => ipcRenderer.removeListener("desktop:collaboration-state", handler);
  },
  onCollaborationStream: (listener: (event: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, value: unknown) => listener(value);
    ipcRenderer.on("desktop:collaboration-stream", handler);
    return () => ipcRenderer.removeListener("desktop:collaboration-stream", handler);
  },
  getConversationDispatchState: () => ipcRenderer.invoke("desktop:get-conversation-dispatch-state"),
  enqueueMessage: (request: unknown) => ipcRenderer.invoke("desktop:enqueue-message", request),
  supplementQueuedMessage: (itemId: string) => ipcRenderer.invoke("desktop:supplement-queued-message", itemId),
  discardQueuedMessage: (itemId: string) => ipcRenderer.invoke("desktop:discard-queued-message", itemId),
  recoverConversationTask: () => ipcRenderer.invoke("desktop:recover-conversation-task"),
  discardConversationRecovery: () => ipcRenderer.invoke("desktop:discard-conversation-recovery"),
  onConversationDispatchState: (listener: (state: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, value: unknown) => listener(value);
    ipcRenderer.on("desktop:conversation-dispatch-state", handler);
    return () => ipcRenderer.removeListener("desktop:conversation-dispatch-state", handler);
  },
  sendMessage: (request: unknown) => ipcRenderer.invoke("desktop:send-message", request),
  onCodexStreamEvent: (listener: (event: unknown) => void) => {
    // 只向渲染层转发主进程筛选后的进度对象，禁止暴露原始 Electron 事件或 Harness 管道。
    const handler = (_event: Electron.IpcRendererEvent, value: unknown) => listener(value);
    ipcRenderer.on("desktop:codex-stream-event", handler);
    return () => ipcRenderer.removeListener("desktop:codex-stream-event", handler);
  },
  cancel: () => ipcRenderer.invoke("desktop:cancel"),
  windowControl: (action: "minimize" | "maximize" | "close") => ipcRenderer.send("window:control", action),
});
