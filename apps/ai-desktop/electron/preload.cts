/** Electron 安全桥接组合根：只拼装领域白名单，不承载业务判断或文件系统能力。 */
import { contextBridge } from "electron";

import { collaborationBridge } from "./preload/domains/collaboration-bridge.cjs";
import { codexBridge } from "./preload/domains/codex-bridge.cjs";
import { conversationBridge } from "./preload/domains/conversation-bridge.cjs";
import { ruleBridge } from "./preload/domains/rule-bridge.cjs";
import { screenshotBridge } from "./preload/domains/screenshot-bridge.cjs";
import { systemBridge } from "./preload/domains/system-bridge.cjs";

// 每个领域只返回可序列化函数；Renderer 永远拿不到 ipcRenderer 或 Electron Event。
contextBridge.exposeInMainWorld("desktop", {
  ...systemBridge(),
  ...ruleBridge(),
  ...codexBridge(),
  ...screenshotBridge(),
  ...collaborationBridge(),
  ...conversationBridge(),
});
