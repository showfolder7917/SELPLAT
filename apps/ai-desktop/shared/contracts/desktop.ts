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
}

export interface SendMessageResponse {
  text: string;
  itemCount: number;
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
  sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
  cancel(): Promise<boolean>;
  windowControl(action: WindowAction): void;
}
