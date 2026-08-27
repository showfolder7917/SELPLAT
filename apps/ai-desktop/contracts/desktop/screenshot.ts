/**
 * 截图协议，连接 Renderer 截图编辑器与主进程桌面捕获、临时保存能力。
 *
 * 生产者：Renderer 截图工具和主进程 ScreenshotStore。
 * 消费者：preload 白名单、截图编辑窗口和对话附件流程。
 * 数据方向：renderer <-> preload <-> main。
 * 本文件不实现屏幕权限申请、图像编码或临时目录清理。
 */
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
