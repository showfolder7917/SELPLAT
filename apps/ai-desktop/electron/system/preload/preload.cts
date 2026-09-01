/** Electron 安全桥接组合根：只拼装领域白名单，不承载业务判断或文件系统能力。 */
import { contextBridge } from "electron";

import { collaborationBridge } from "./domains/collaboration-bridge.cjs";
import { codexBridge } from "./domains/codex-bridge.cjs";
import { conversationBridge } from "./domains/conversation-bridge.cjs";
import { ruleBridge } from "./domains/rule-bridge.cjs";
import { screenshotBridge } from "./domains/screenshot-bridge.cjs";
import { systemBridge } from "./domains/system-bridge.cjs";

// 每个领域只返回可序列化函数；Renderer 永远拿不到 ipcRenderer 或 Electron Event。
contextBridge.exposeInMainWorld("desktop", {
  ...systemBridge(),
  ...ruleBridge(),
  ...codexBridge(),
  ...screenshotBridge(),
  ...collaborationBridge(),
  ...conversationBridge(),
});
