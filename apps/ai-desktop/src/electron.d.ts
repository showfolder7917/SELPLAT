import type { DesktopApi } from "../contracts/system/desktop/index";

export {};

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}
