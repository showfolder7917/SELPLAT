import { ipcMain, type IpcMainInvokeEvent } from "electron";

import type { EventCenterFacade } from "../../services/support/capabilities/event-center/index.js";

type DesktopIpcAuthorizationPolicy = (event: IpcMainInvokeEvent, channel: string) => void;
let desktopIpcAuthorizationPolicy: DesktopIpcAuthorizationPolicy = () => undefined;

/** 安装主进程唯一 IPC 授权入口；preload 仅发布协议，不能依据可伪造参数承担业务权限判断。 */
export function installDesktopIpcAuthorizationPolicy(policy: DesktopIpcAuthorizationPolicy): void {
  desktopIpcAuthorizationPolicy = policy;
}

/** 所有 invoke IPC 通过同一异常边界登记，仍把原始错误返还调用页面。 */
export function registerEventCenterIpcHandler<Arguments extends unknown[]>(
  eventCenter: EventCenterFacade,
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: Arguments) => unknown,
  boundary: "business" | "technical" | "auto" = "auto",
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    desktopIpcAuthorizationPolicy(event, channel);
    try {
      return await handler(event, ...(args as Arguments));
    } catch (error) {
      eventCenter.recordIpcException(channel, error, boundary);
      throw error;
    }
  });
}
