import type { DesktopApi } from "../contracts/system/desktop/index";

export {};

declare global {
  interface Window {
    desktop?: DesktopApi;
    sel?: {
      core?: {
        copyText?(value: string): Promise<boolean>;
        toast?(message: string, tone?: "info" | "success" | "warning" | "error"): boolean;
      };
    };
  }
}
