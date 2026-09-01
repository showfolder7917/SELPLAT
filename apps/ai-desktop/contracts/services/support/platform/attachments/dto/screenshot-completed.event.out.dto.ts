import type { ScreenshotAttachmentOutDto } from "./screenshot.out.dto.js";

export interface ScreenshotCompletedEventOutDto {
  attachment: ScreenshotAttachmentOutDto;
  dataUrl: string;
  hasAnnotations: boolean;
}
