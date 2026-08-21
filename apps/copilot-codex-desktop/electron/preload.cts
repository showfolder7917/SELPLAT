import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktop", {
  getEnvironment: () => ipcRenderer.invoke("desktop:get-environment"),
  getSettings: () => ipcRenderer.invoke("desktop:get-settings"),
  updateSettings: (settings: unknown) => ipcRenderer.invoke("desktop:update-settings", settings),
  newChat: () => ipcRenderer.invoke("desktop:new-chat"),
  sendMessage: (request: unknown) => ipcRenderer.invoke("desktop:send-message", request),
  cancel: () => ipcRenderer.invoke("desktop:cancel"),
  windowControl: (action: "minimize" | "maximize" | "close") => ipcRenderer.send("window:control", action),
});
