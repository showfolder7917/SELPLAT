export const APP_VARIANTS = ["office", "developer"] as const;
export const LOCALES = ["ja", "zh-CN"] as const;
export const SANDBOX_MODES = ["read-only", "workspace-write"] as const;

export type AppVariant = (typeof APP_VARIANTS)[number];
export type Locale = (typeof LOCALES)[number];
export type SandboxMode = (typeof SANDBOX_MODES)[number];
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

export interface DesktopEnvironment {
  projectRoot: string;
  platform: string;
  variant: AppVariant;
}

export interface DesktopSettings {
  locale: Locale;
  sandboxMode: SandboxMode;
}

export interface DesktopApi {
  getEnvironment(): Promise<DesktopEnvironment>;
  getSettings(): Promise<DesktopSettings>;
  updateSettings(settings: Partial<DesktopSettings>): Promise<DesktopSettings>;
  newChat(): Promise<void>;
  sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
  cancel(): Promise<boolean>;
  windowControl(action: WindowAction): void;
}
