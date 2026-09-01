export interface ScreenCaptureOutDto { dataUrl: string; width: number; height: number; }
export type ScreenCapturePreparationOutDto =
  | { status: "ready" }
  | { status: "blocked"; reason: "permission-required" | "source-unavailable"; canOpenSettings: boolean };
export interface ScreenCaptureFrameOutDto { requestId: number; width: number; height: number; error?: string; }
export interface ScreenshotAttachmentOutDto { id: string; name: string; filePath: string; sizeBytes: number; createdAt: string; }
export interface TempDirectoryInfoOutDto { path: string; fileCount: number; totalBytes: number; }
