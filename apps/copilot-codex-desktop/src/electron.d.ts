export {};

declare global {
  interface Window {
    desktop?: {
      getEnvironment(): Promise<{ projectRoot: string; platform: string }>;
      newChat(): Promise<void>;
      sendMessage(request: {
        message: string;
        locale: "ja" | "zh-CN";
        sandboxMode: "read-only" | "workspace-write";
      }): Promise<{ text: string; itemCount: number }>;
      cancel(): Promise<boolean>;
      windowControl(action: "minimize" | "maximize" | "close"): void;
    };
  }
}
