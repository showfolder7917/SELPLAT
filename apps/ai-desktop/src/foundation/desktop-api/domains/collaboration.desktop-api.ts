/** Renderer 协同领域入口；协同、人物和演化调用从同一入口进入对应主进程 Facade。 */
import type { CollaborationDesktopApi } from "../../../../contracts/system/desktop/index";
import { getDesktopApi, getOptionalDesktopApi } from "../desktop-api";

/** 返回必需的协同桥接。 */
export function getCollaborationDesktopApi(): CollaborationDesktopApi {
  return getDesktopApi();
}

/** 返回可选协同桥接，供只读首屏和恢复状态探测使用。 */
export function getOptionalCollaborationDesktopApi(): CollaborationDesktopApi | undefined {
  return getOptionalDesktopApi();
}
