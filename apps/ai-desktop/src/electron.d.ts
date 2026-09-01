import type { DesktopApi } from "../contracts/system/desktop/desktop";

export {};

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}
