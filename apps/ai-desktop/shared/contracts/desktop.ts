export const APP_VARIANTS = ["office", "developer"] as const;
export const LOCALES = ["ja", "zh-CN"] as const;
export const SANDBOX_MODES = ["read-only", "workspace-write"] as const;
export const WORKSPACE_PERMISSIONS = ["read-only", "workspace-write"] as const;

export type AppVariant = (typeof APP_VARIANTS)[number];
export type Locale = (typeof LOCALES)[number];
export type SandboxMode = (typeof SANDBOX_MODES)[number];
export type WorkspacePermission = (typeof WORKSPACE_PERMISSIONS)[number];
export type ManagedExecutionMode = "conversation-managed" | "requirement-managed" | "task-managed" | "test-managed";
export type WindowAction = "minimize" | "maximize" | "close";

export interface SendMessageRequest {
  message: string;
  locale: Locale;
  sandboxMode: SandboxMode;
  attachmentIds: string[];
  executionMode: ManagedExecutionMode;
  queueItemId?: string;
}

export interface SendMessageResponse {
  text: string;
  itemCount: number;
  threadId?: string;
  managedStatus?: "conversation-ready" | "requirement-ready" | "code-verified" | "test-verified" | "incomplete";
  pendingActions?: string[];
  disposition?: "completed" | "queued";
  queueItemId?: string;
}

export interface ConversationQueueItem {
  id: string;
  request: SendMessageRequest;
  displayText: string;
  createdAt: string;
  automatic: boolean;
}

export interface ConversationDispatchState {
  activeTask: {
    id: string;
    request: SendMessageRequest;
    startedAt: string;
    status: "running" | "recoverable";
  } | null;
  queue: ConversationQueueItem[];
}

export interface EnqueueMessageRequest {
  request: SendMessageRequest;
  displayText?: string;
  automatic?: boolean;
}

export interface CodexSessionInfo {
  threadId: string | null;
}

export interface ManagedExecutionUpdate {
  mode: ManagedExecutionMode;
  stage: "conversation" | "requirement-analysis" | "task-execution" | "code-validation" | "interaction-validation" | "build-validation" | "runtime-restart" | "completed";
  status: "started" | "continuing" | "completed" | "blocked";
  round: number;
  maximumRounds: number;
  message: string;
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
  exitCode?: number;
}

export interface CodexStreamEvent {
  type: "turn-started" | "message-delta" | "message-completed" | "reasoning-summary-delta" | "activity" | "plan-updated" | "diff-updated" | "turn-completed" | "managed-execution" | "error";
  turnId: string;
  segmentId?: string;
  itemId?: string;
  delta?: string;
  text?: string;
  activity?: CodexStreamActivity;
  plan?: CodexStreamPlanStep[];
  changedFiles?: string[];
  status?: string;
  error?: string;
  managedExecution?: ManagedExecutionUpdate;
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
  runtime: CodexRuntimeInfo | null;
}

export interface CodexRuntimeInfo {
  source: "system" | "bundled";
  path: string;
  version: string;
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
  trustEligible: boolean;
}

export interface TrustedCommandInfo {
  count: number;
}

export interface AutomaticTestPreflightCheck {
  id: "harness" | "workspace" | "runner" | "lock" | "port" | "screen" | "command";
  status: "passed" | "failed";
  label: string;
  detail: string;
}

export interface AutomaticTestPreflightResult {
  status: "ready" | "blocked";
  checkedAt: string;
  checks: AutomaticTestPreflightCheck[];
}

export interface CodexUserInputOption {
  label: string;
  description: string;
}

export interface CodexUserInputQuestion {
  id: string;
  header: string;
  question: string;
  options: CodexUserInputOption[];
}

export interface CodexUserInputRequest {
  requestId: number;
  questions: CodexUserInputQuestion[];
}

export interface ResolveCodexUserInputRequest {
  requestId: number;
  answers: Record<string, string[]>;
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

export type ScreenCapturePreparationResult =
  | { status: "ready" }
  | {
      status: "blocked";
      reason: "permission-required" | "source-unavailable";
      canOpenSettings: boolean;
    };

export interface ScreenCaptureFrameRequest {
  capture: ScreenCapture;
  requestId: number;
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
  hasAnnotations: boolean;
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
  hasAnnotations: boolean;
}

export interface TempDirectoryInfo {
  path: string;
  fileCount: number;
  totalBytes: number;
}

export interface AuditReason {
  code: string;
  message: string;
}

export interface AuditTaskSummary {
  taskId: string;
  startedAt: string;
  completedAt: string | null;
  status: "running" | "completed" | "partial" | "failed" | "interrupted";
  request: string;
  locale: Locale;
  sandboxMode: SandboxMode;
  workspaces: { path: string; permission: WorkspacePermission }[];
  attachmentCount: number;
  turnId: string | null;
  changedFiles: string[];
  commands: { id: string; command: string; phase: string; status: string | null; exitCode: number | null }[];
  reasons: AuditReason[];
  managedMode?: ManagedExecutionMode;
  managedStatus?: "conversation-ready" | "requirement-ready" | "code-verified" | "test-verified" | "incomplete";
  pendingActions?: string[];
  bundleState: { sourceMtimeMs: number; bundleMtimeMs: number; stale: boolean };
}

export interface AuditLogInfo {
  path: string;
  taskCount: number;
  latestTask: AuditTaskSummary | null;
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
  getActiveCodexSession(): Promise<CodexSessionInfo>;
  loginWithChatGPT(): Promise<CodexLoginResponse>;
  logoutCodex(): Promise<CodexHarnessStatus>;
  getCodexApprovals(): Promise<CodexApproval[]>;
  resolveCodexApproval(requestId: number, decision: "accept" | "decline"): Promise<void>;
  getTrustedCommandInfo(): Promise<TrustedCommandInfo>;
  clearTrustedCommands(): Promise<TrustedCommandInfo>;
  prepareAutomaticTesting(): Promise<AutomaticTestPreflightResult>;
  getCodexUserInputs(): Promise<CodexUserInputRequest[]>;
  resolveCodexUserInput(request: ResolveCodexUserInputRequest): Promise<void>;
  newChat(): Promise<void>;
  openExternalUrl(url: string): Promise<void>;
  prepareScreenCapture(): Promise<ScreenCapturePreparationResult>;
  openScreenRecordingSettings(): Promise<void>;
  restartForScreenRecordingPermission(): Promise<void>;
  captureScreen(request?: ScreenCaptureRequest): Promise<ScreenCapture | null>;
  notifyScreenCaptureStage(stage: string, detail?: string): Promise<void>;
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
  getAuditLogInfo(): Promise<AuditLogInfo>;
  openAuditLogDirectory(): Promise<void>;
  getConversationDispatchState(): Promise<ConversationDispatchState>;
  enqueueMessage(request: EnqueueMessageRequest): Promise<ConversationDispatchState>;
  supplementQueuedMessage(itemId: string): Promise<ConversationDispatchState>;
  discardQueuedMessage(itemId: string): Promise<ConversationDispatchState>;
  recoverConversationTask(): Promise<ConversationDispatchState>;
  discardConversationRecovery(): Promise<ConversationDispatchState>;
  onConversationDispatchState(listener: (state: ConversationDispatchState) => void): () => void;
  sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
  onCodexStreamEvent(listener: (event: CodexStreamEvent) => void): () => void;
  cancel(): Promise<boolean>;
  windowControl(action: WindowAction): void;
}
