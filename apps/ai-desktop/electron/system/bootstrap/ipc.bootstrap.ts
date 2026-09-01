import { registerDesktopIpc } from "../ipc/register-desktop-ipc.js";

export type DesktopIpcApplicationPorts = Parameters<typeof registerDesktopIpc>[0];

/** IPC 组合边界：应用层只在这里把公开 Facade 暴露给各 IPC domain。 */
export function registerApplicationIpc(ports: DesktopIpcApplicationPorts): void {
  registerDesktopIpc(ports);
}
