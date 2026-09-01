import type { ScreenCaptureOutDto } from "./screenshot.out.dto.js";

export interface ScreenCaptureInDto { hideOwnerWindow?: boolean; }
export interface ScreenCaptureFrameInDto { capture: ScreenCaptureOutDto; requestId: number; }
export interface ScreenshotSaveInDto { originalDataUrl: string; annotatedDataUrl: string; hasAnnotations: boolean; }
export interface ScreenshotAnnotationWindowInDto { width: number; height: number; }
