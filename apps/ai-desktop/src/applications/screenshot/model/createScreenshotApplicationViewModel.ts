import type { ScreenshotApplicationController } from "./useScreenshotApplicationController";
import { fixedUiText } from "../../../../contracts/foundation/index";

/** 截图窗口的显示模型使用状态联合，避免 View 再次判断业务字段组合。 */
export type ScreenshotApplicationViewModel =
  | {
    state: "error";
    title: string;
    message: string;
    technicalDetail: string;
    technicalDetailsLabel: string;
    closeLabel: string;
    onClose: () => void;
  }
  | {
    state: "loading";
    loadingLabel: string;
  }
  | {
    state: "editor";
    editorKey: number;
    capture: NonNullable<ScreenshotApplicationController["capture"]>;
    locale: ScreenshotApplicationController["locale"];
    onCancel: () => void;
    onComplete: ScreenshotApplicationController["complete"];
  };

/** 把截图应用 Controller 转换成错误、加载或编辑三种互斥页面状态。 */
export function createScreenshotApplicationViewModel(
  controller: ScreenshotApplicationController,
): ScreenshotApplicationViewModel {
  if (controller.error) {
    return {
      state: "error",
      title: controller.error.kind === "settings" ? fixedUiText(controller.locale, "screenshotSettingsReadTitle") : fixedUiText(controller.locale, "screenshotSettingsReadTitle"),
      message: controller.error.kind === "settings" ? fixedUiText(controller.locale, "screenshotSettingsReadDetail") : fixedUiText(controller.locale, "screenshotSettingsReadDetail"),
      technicalDetail: controller.error.technicalDetail,
      technicalDetailsLabel: fixedUiText(controller.locale, "technicalDetails"),
      closeLabel: fixedUiText(controller.locale, "close"),
      onClose: () => { void controller.cancel(); },
    };
  }

  if (!controller.capture) {
    return {
      state: "loading",
      loadingLabel: fixedUiText(controller.locale, "loadingScreenshot"),
    };
  }

  return {
    state: "editor",
    editorKey: controller.captureVersion,
    capture: controller.capture,
    locale: controller.locale,
    onCancel: () => { void controller.cancel(); },
    onComplete: controller.complete,
  };
}
