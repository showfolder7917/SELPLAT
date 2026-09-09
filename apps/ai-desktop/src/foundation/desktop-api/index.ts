/** Renderer 启动入口用它判断 preload 是否已经注入。 */
export { hasDesktopApi } from "./desktop-api";
/** Codex 正常业务操作使用的必需桥接入口。 */
export { getCodexDesktopApi } from "./domains/codex.desktop-api";
/** Codex 首屏探测使用的可选桥接入口。 */
export { getOptionalCodexDesktopApi } from "./domains/codex.desktop-api";
/** 协同正常业务操作使用的必需桥接入口。 */
export { getCollaborationDesktopApi } from "./domains/collaboration.desktop-api";
/** 协同首屏和恢复探测使用的可选桥接入口。 */
export { getOptionalCollaborationDesktopApi } from "./domains/collaboration.desktop-api";
/** 主会话正常业务操作使用的必需桥接入口。 */
export { getConversationDesktopApi } from "./domains/conversation.desktop-api";
/** 主会话启动订阅使用的可选桥接入口。 */
export { getOptionalConversationDesktopApi } from "./domains/conversation.desktop-api";
/** 规则管理正式页面使用的必需桥接入口。 */
export { getRulesDesktopApi } from "./domains/rules.desktop-api";
/** 规则状态探测使用的可选桥接入口。 */
export { getOptionalRulesDesktopApi } from "./domains/rules.desktop-api";
/** 截图正式操作使用的必需桥接入口。 */
export { getScreenshotDesktopApi } from "./domains/screenshot.desktop-api";
/** 截图窗口初始化与回收使用的可选桥接入口。 */
export { getOptionalScreenshotDesktopApi } from "./domains/screenshot.desktop-api";
/** 系统正常业务操作使用的必需桥接入口。 */
export { getSystemDesktopApi } from "./domains/system.desktop-api";
/** 系统启动和关闭容错路径使用的可选桥接入口。 */
export { getOptionalSystemDesktopApi } from "./domains/system.desktop-api";
