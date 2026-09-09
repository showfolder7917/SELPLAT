/** Renderer Codex 领域入口；认证、审批、输入和流事件不再从页面直接访问 window.desktop。 */
import type { CodexDesktopApi } from "../../../../contracts/system/desktop/index";
import { getDesktopApi, getOptionalDesktopApi } from "../desktop-api";

/** 返回必需的 Codex Harness 桥接。 */
export function getCodexDesktopApi(): CodexDesktopApi {
  return getDesktopApi();
}

/** 返回可选 Codex 桥接，供首屏状态探测使用。 */
export function getOptionalCodexDesktopApi(): CodexDesktopApi | undefined {
  return getOptionalDesktopApi();
}
