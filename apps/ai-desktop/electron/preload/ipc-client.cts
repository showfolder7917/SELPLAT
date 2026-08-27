/** preload 内部唯一 IPC 适配器；领域桥接只使用 invoke、send 和可撤销订阅。 */
import { ipcRenderer } from "electron";

export const invoke = <T = unknown>(channel: string, ...args: unknown[]): Promise<T> => ipcRenderer.invoke(channel, ...args) as Promise<T>;
export const send = (channel: string, ...args: unknown[]): void => ipcRenderer.send(channel, ...args);

/** 订阅主进程筛选后的值，并返回释放函数；原始 Electron 事件不会离开 preload。 */
export function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, value: T) => listener(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

/** 订阅不携带数据的通知，并保持与值订阅相同的释放语义。 */
export function subscribeSignal(channel: string, listener: () => void): () => void {
  const handler = () => listener();
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}
