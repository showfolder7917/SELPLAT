/** Renderer 访问 preload 白名单的唯一基础适配器；Feature 不感知 Electron 或 IPC channel。 */
import type { DesktopApi } from "../../../contracts/system/desktop/index";

/** 返回已经由 preload 注入的强类型 API；浏览器预览缺失桥接时给出稳定错误。 */
export function getDesktopApi(): DesktopApi {
  if (!window.desktop) throw new Error("AI Desktop bridge is unavailable in the current renderer.");
  return window.desktop;
}

/**
 * 返回可能尚未注入的桌面桥接。
 * 仅供启动占位、截图隔离窗口等允许桥接短暂缺失的边界使用；正常业务操作应调用领域入口并显式处理异常。
 */
export function getOptionalDesktopApi(): DesktopApi | undefined {
  return window.desktop;
}

/** 在应用入口判断 preload 是否已经完成注入，不把全量 DesktopApi 暴露给业务模块。 */
export function hasDesktopApi(): boolean {
  return Boolean(window.desktop);
}
