/** Renderer 访问 preload 白名单的唯一基础适配器；Feature 不感知 Electron 或 IPC channel。 */
import type { DesktopApi } from "../../../contracts/system/desktop/index";

/** 返回已经由 preload 注入的强类型 API；浏览器预览缺失桥接时给出稳定错误。 */
export function getDesktopApi(): DesktopApi {
  if (!window.desktop) throw new Error("AI Desktop bridge is unavailable in the current renderer.");
  return window.desktop;
}
