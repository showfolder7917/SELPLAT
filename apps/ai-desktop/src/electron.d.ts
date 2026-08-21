import type { DesktopApi } from "../shared/contracts/desktop";

export {};

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}
