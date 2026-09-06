/** 截图功能公开入口：向真实截图窗口和 Developer 应用提供编辑、捕获与附件能力。 */

/** 截图编辑器：负责选区、标注、复制和完成截图。 */
export { ScreenshotEditor } from "./components/ScreenshotEditor";
/** 截图捕获控制器：管理当前或隐藏窗口截图以及粘贴附件。 */
export { useScreenshotCapture } from "./model/useScreenshotCapture";
/** 截图发送目标：限定附件属于 Codex、韩立或南宫婉会话。 */
export type { ScreenshotDestination } from "./model/useScreenshotCapture";
