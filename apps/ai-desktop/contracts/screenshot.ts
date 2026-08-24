export interface ScreenCapture {
  dataUrl: string;
  width: number;
  height: number;
}

export interface ScreenCaptureRequest {
  hideOwnerWindow?: boolean;
}

export type ScreenCapturePreparationResult =
  | { status: "ready" }
  | { status: "blocked"; reason: "permission-required" | "source-unavailable"; canOpenSettings: boolean };

export interface ScreenCaptureFrameRequest {
  capture: ScreenCapture;
  requestId: number;
}

export interface ScreenCaptureFrameResult {
  requestId: number;
  width: number;
  height: number;
  error?: string;
}

export interface ScreenshotSaveRequest {
  originalDataUrl: string;
  annotatedDataUrl: string;
  hasAnnotations: boolean;
}

export interface ScreenshotAnnotationWindowRequest {
  width: number;
  height: number;
}

export interface ScreenshotAttachment {
  id: string;
  name: string;
  filePath: string;
  sizeBytes: number;
  createdAt: string;
}

export interface ScreenshotCompletedEvent {
  attachment: ScreenshotAttachment;
  dataUrl: string;
  hasAnnotations: boolean;
}

export interface TempDirectoryInfo {
  path: string;
  fileCount: number;
  totalBytes: number;
}
