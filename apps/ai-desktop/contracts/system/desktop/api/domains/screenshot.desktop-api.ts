/**
 * 截图跨进程 API 的唯一领域视图。
 *
 * 调用链：Renderer screenshot feature/application -> screenshot desktop adapter
 * -> screenshot preload bridge -> screenshot IPC -> AttachmentFacade 与 BrowserWindow。
 */
import type { DesktopApi } from "../desktop.api.js";

/** 截图领域覆盖权限预检、取帧、编辑窗口、保存和附件预览。 */
export const SCREENSHOT_DESKTOP_API_METHODS = [
  "prepareScreenCapture",
  "openScreenRecordingSettings",
  "restartForScreenRecordingPermission",
  "captureScreen",
  "notifyScreenCaptureStage",
  "onScreenCaptureFrameRequested",
  "submitScreenCaptureFrameResult",
  "showScreenshotWindow",
  "onScreenCaptureReset",
  "enterScreenshotAnnotation",
  "returnScreenshotSelection",
  "endScreenshotEditing",
  "saveScreenshot",
  "readAttachmentPreviews",
  "onScreenshotCompleted",
] as const satisfies readonly (keyof DesktopApi)[];

/** Renderer 截图模块只能取得这些受控能力，不能直接访问 Electron。 */
export type ScreenshotDesktopApi = Pick<DesktopApi, (typeof SCREENSHOT_DESKTOP_API_METHODS)[number]>;
