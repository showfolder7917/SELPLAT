/** 截图桥接；屏幕像素在隔离截图窗口处理，主窗口只接收签发后的附件信息。 */
import { invoke, subscribe, subscribeSignal } from "../ipc-client.cjs";

export function screenshotBridge() {
  return {
    prepareScreenCapture: () => invoke("desktop:prepare-screen-capture"),
    openScreenRecordingSettings: () => invoke("desktop:open-screen-recording-settings"),
    restartForScreenRecordingPermission: () => invoke("desktop:restart-for-screen-recording-permission"),
    captureScreen: (request?: unknown) => invoke("desktop:capture-screen", request),
    notifyScreenCaptureStage: (stage: string, detail?: string) => invoke("desktop:screen-capture-stage", stage, detail),
    onScreenCaptureFrameRequested: (listener: (request: unknown) => void) => subscribe("desktop:screen-capture-frame-requested", listener),
    submitScreenCaptureFrameResult: (result: unknown) => invoke("desktop:screen-capture-frame-result", result),
    showScreenshotWindow: () => invoke("desktop:show-screenshot-window"),
    onScreenCaptureReset: (listener: () => void) => subscribeSignal("desktop:screen-capture-reset", listener),
    enterScreenshotAnnotation: (request: unknown) => invoke("desktop:enter-screenshot-annotation", request),
    returnScreenshotSelection: () => invoke("desktop:return-screenshot-selection"),
    endScreenshotEditing: () => invoke("desktop:end-screenshot-editing"),
    saveScreenshot: (request: unknown) => invoke("desktop:save-screenshot", request),
    readAttachmentPreviews: (attachmentIds: string[]) => invoke("desktop:read-attachment-previews", attachmentIds),
    onScreenshotCompleted: (listener: (event: unknown) => void) => subscribe("desktop:screenshot-completed", listener),
  };
}
