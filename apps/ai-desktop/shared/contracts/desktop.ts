export const APP_VARIANTS = ["office", "developer"] as const;
export const LOCALES = ["ja", "zh-CN"] as const;
export const SANDBOX_MODES = ["read-only", "workspace-write"] as const;
export const WORKSPACE_PERMISSIONS = ["read-only", "workspace-write"] as const;

export type AppVariant = (typeof APP_VARIANTS)[number];
export type Locale = (typeof LOCALES)[number];
export type SandboxMode = (typeof SANDBOX_MODES)[number];
export type WorkspacePermission = (typeof WORKSPACE_PERMISSIONS)[number];
export type WindowAction = "minimize" | "maximize" | "close";

export interface SendMessageRequest {
  message: string;
  locale: Locale;
  sandboxMode: SandboxMode;
  attachmentIds: string[];
}

export interface SendMessageResponse {
  text: string;
  itemCount: number;
}

export interface CodexStreamPlanStep {
  step: string;
  status: "pending" | "inProgress" | "completed";
}

export interface CodexStreamActivity {
  id: string;
  itemType: string;
  phase: "started" | "completed" | "output";
  status: string | null;
  summary: string | null;
  detail: string | null;
}

export interface CodexStreamEvent {
  type: "turn-started" | "message-delta" | "message-completed" | "reasoning-summary-delta" | "activity" | "plan-updated" | "diff-updated" | "turn-completed" | "error";
  turnId: string;
  itemId?: string;
  delta?: string;
  text?: string;
  activity?: CodexStreamActivity;
  plan?: CodexStreamPlanStep[];
  changedFiles?: string[];
  status?: string;
  error?: string;
}

export interface CodexAccount {
  authenticated: boolean;
  authMode: string | null;
  email: string | null;
  planType: string | null;
  requiresOpenaiAuth: boolean;
}

export interface CodexHarnessStatus {
  connected: boolean;
  account: CodexAccount;
  error: string | null;
}

export interface CodexLoginResponse {
  loginId: string;
  authUrl: string;
}

export interface CodexApproval {
  requestId: number;
  kind: "command" | "fileChange";
  title: string;
  reason: string | null;
  command: string | null;
  cwd: string | null;
  details: string | null;
}

export interface DesktopEnvironment {
  projectRoot: string;
  platform: string;
  variant: AppVariant;
}

export interface DesktopSettings {
  locale: Locale;
  sandboxMode: SandboxMode;
}

export interface WorkspaceRoot {
  id: string;
  name: string;
  path: string;
  permission: WorkspacePermission;
}

export interface WorkspaceState {
  primaryId: string;
  roots: WorkspaceRoot[];
}

export interface WorkspaceEntry {
  name: string;
  kind: "directory" | "file";
}

export interface ScreenCapture {
  dataUrl: string;
  width: number;
  height: number;
}

export interface ScreenCaptureRequest {
  hideOwnerWindow?: boolean;
}

export interface ScreenCaptureStreamSource {
  sourceId: string;
  width: number;
  height: number;
}

export interface ScreenCaptureFrameRequest {
  requestId: number;
  waitForOwnerHidden: boolean;
}

export interface ScreenCaptureFrameResult {
  requestId: number;
  width: number;
  height: number;
  error?: string;
}

export interface ScreenshotSaveRequest {
  originalDataUrl: string;
  annotatedDataUrl: string;
}

export interface ScreenshotAnnotationWindowRequest {
  width: number;
  height: number;
}

export interface ScreenshotAttachment {
  id: string;
  name: string;
  filePath: string;
  sizeBytes: number;
  createdAt: string;
}

export interface ScreenshotCompletedEvent {
  attachment: ScreenshotAttachment;
  dataUrl: string;
}

export interface TempDirectoryInfo {
  path: string;
  fileCount: number;
  totalBytes: number;
}

export interface DesktopApi {
  getEnvironment(): Promise<DesktopEnvironment>;
  getSettings(): Promise<DesktopSettings>;
  updateSettings(settings: Partial<DesktopSettings>): Promise<DesktopSettings>;
  getWorkspaces(): Promise<WorkspaceState>;
  addWorkspace(): Promise<WorkspaceState>;
  updateWorkspacePermission(id: string, permission: WorkspacePermission): Promise<WorkspaceState>;
  setPrimaryWorkspace(id: string): Promise<WorkspaceState>;
  removeWorkspace(id: string): Promise<WorkspaceState>;
  listWorkspaceEntries(id: string): Promise<WorkspaceEntry[]>;
  getCodexStatus(): Promise<CodexHarnessStatus>;
  loginWithChatGPT(): Promise<CodexLoginResponse>;
  logoutCodex(): Promise<CodexHarnessStatus>;
  getCodexApprovals(): Promise<CodexApproval[]>;
  resolveCodexApproval(requestId: number, decision: "accept" | "decline"): Promise<void>;
  newChat(): Promise<void>;
  prepareScreenCapture(): Promise<void>;
  captureScreen(request?: ScreenCaptureRequest): Promise<ScreenCapture | null>;
  getScreenCaptureStreamSource(): Promise<ScreenCaptureStreamSource | null>;
  notifyScreenCaptureStreamReady(sourceId: string): Promise<void>;
  onScreenCaptureStreamConfigured(listener: (source: ScreenCaptureStreamSource) => void): () => void;
  onScreenCaptureFrameRequested(listener: (request: ScreenCaptureFrameRequest) => void): () => void;
  submitScreenCaptureFrameResult(result: ScreenCaptureFrameResult): Promise<void>;
  showScreenshotWindow(): Promise<void>;
  onScreenCaptureReset(listener: () => void): () => void;
  enterScreenshotAnnotation(request: ScreenshotAnnotationWindowRequest): Promise<void>;
  returnScreenshotSelection(): Promise<void>;
  endScreenshotEditing(): Promise<void>;
  saveScreenshot(request: ScreenshotSaveRequest): Promise<ScreenshotAttachment>;
  onScreenshotCompleted(listener: (event: ScreenshotCompletedEvent) => void): () => void;
  getTempDirectoryInfo(): Promise<TempDirectoryInfo>;
  openTempDirectory(): Promise<void>;
  clearTempFiles(): Promise<TempDirectoryInfo>;
  sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
  onCodexStreamEvent(listener: (event: CodexStreamEvent) => void): () => void;
  cancel(): Promise<boolean>;
  windowControl(action: WindowAction): void;
}
