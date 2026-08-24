import type { DesktopApi } from "../contracts/desktop";

export {};

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}
