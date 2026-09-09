/** Renderer 截图领域入口；取帧、标注窗口与附件均沿同名边界追踪。 */
import type { ScreenshotDesktopApi } from "../../../../contracts/system/desktop/index";
import { getDesktopApi, getOptionalDesktopApi } from "../desktop-api";

/** 返回必需的截图桥接。 */
export function getScreenshotDesktopApi(): ScreenshotDesktopApi {
  return getDesktopApi();
}

/** 返回可选截图桥接，供截图隔离窗口的初始化与回收路径使用。 */
export function getOptionalScreenshotDesktopApi(): ScreenshotDesktopApi | undefined {
  return getOptionalDesktopApi();
}
