import type { DesktopApi } from "../contracts/desktop/desktop";

export {};

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}
