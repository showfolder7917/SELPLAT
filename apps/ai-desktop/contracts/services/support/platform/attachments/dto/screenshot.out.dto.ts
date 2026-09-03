export interface ScreenCaptureOutDto { dataUrl: string; width: number; height: number; }
export type ScreenCapturePreparationOutDto =
  | { status: "ready" }
  | { status: "blocked"; reason: "permission-required" | "source-unavailable"; canOpenSettings: boolean };
export interface ScreenCaptureFrameOutDto { requestId: number; width: number; height: number; error?: string; }
export interface ScreenshotAttachmentOutDto { id: string; name: string; filePath: string; sizeBytes: number; createdAt: string; }
/** 已签发截图附件的受控预览结果；不可读取时不会泄露内部路径。 */
export type ScreenshotAttachmentPreviewOutDto =
  | { id: string; status: "ready"; name: string; dataUrl: string }
  | { id: string; status: "unavailable"; reason: "invalid-id" | "not-found" | "file-unavailable" | "invalid-file" };
export interface TempDirectoryInfoOutDto { path: string; fileCount: number; totalBytes: number; }
