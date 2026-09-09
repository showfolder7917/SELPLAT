/** Renderer 系统领域入口；设置、工作区、诊断与窗口能力从这里进入主进程。 */
import type { SystemDesktopApi } from "../../../../contracts/system/desktop/index";
import { getDesktopApi, getOptionalDesktopApi } from "../desktop-api";

/** 返回必需的系统桥接。 */
export function getSystemDesktopApi(): SystemDesktopApi {
  return getDesktopApi();
}

/** 返回可选系统桥接，供启动和关闭等容错路径使用。 */
export function getOptionalSystemDesktopApi(): SystemDesktopApi | undefined {
  return getOptionalDesktopApi();
}
