import { ipcMain, type IpcMainInvokeEvent } from "electron";

import type { EventCenterFacade } from "../services/event-center/event-center-facade.js";

/** 所有 invoke IPC 通过同一异常边界登记，仍把原始错误返还调用页面。 */
export function registerEventCenterIpcHandler<Arguments extends unknown[]>(
  eventCenter: EventCenterFacade,
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: Arguments) => unknown,
  boundary: "business" | "technical" | "auto" = "auto",
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...(args as Arguments));
    } catch (error) {
      eventCenter.recordIpcException(channel, error, boundary);
      throw error;
    }
  });
}
