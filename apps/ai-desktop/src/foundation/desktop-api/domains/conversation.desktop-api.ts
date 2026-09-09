/** Renderer 主会话领域入口；队列、发送和恢复能力沿同名 preload 与 IPC 继续追踪。 */
import type { ConversationDesktopApi } from "../../../../contracts/system/desktop/index";
import { getDesktopApi, getOptionalDesktopApi } from "../desktop-api";

/** 返回必需的主会话桥接。 */
export function getConversationDesktopApi(): ConversationDesktopApi {
  return getDesktopApi();
}

/** 返回可选主会话桥接，供启动状态订阅使用。 */
export function getOptionalConversationDesktopApi(): ConversationDesktopApi | undefined {
  return getOptionalDesktopApi();
}
