import { type ClipboardEvent, type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";

import type { LocaleValue } from "../../../../contracts/system/desktop/index";
import type { ComposerAttachment } from "../../conversation";
import { appendComposerAttachment, imageFileToPngDataUrl } from "./prepareComposerImage";

export type ScreenshotDestination = "main" | "nangong" | "hanli";

type ScreenshotCaptureOptions = {
  locale: LocaleValue;
  screenSourceUnavailable: string;
  setMainInput: Dispatch<SetStateAction<string>>;
  closeSettings: () => void;
  refreshTempInfo: () => void;
  getAttachments: (destination: ScreenshotDestination) => ComposerAttachment[];
  setAttachments: (destination: ScreenshotDestination, updater: (current: ComposerAttachment[]) => ComposerAttachment[]) => void;
};

function readableDesktopError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/^Error invoking remote method '[^']+':\s*/, "");
}

function nextRenderedFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** 截图 Feature 只负责捕获、权限恢复和图片签发，通过目标枚举把结果返回给真实会话所有者。 */
export function useScreenshotCapture(options: ScreenshotCaptureOptions) {
  const [screenshotBusy, setScreenshotBusy] = useState(false);
  const [screenshotMode, setScreenshotMode] = useState<"current" | "hidden" | null>(null);
  const [screenshotError, setScreenshotError] = useState("");
  const [screenRecordingSettingsAvailable, setScreenRecordingSettingsAvailable] = useState(false);
  const [screenRecordingRestartRequired, setScreenRecordingRestartRequired] = useState(false);
  const [screenRecordingRestarting, setScreenRecordingRestarting] = useState(false);
  const optionsRef = useRef(options);
  const destinationRef = useRef<ScreenshotDestination>("main");
  const screenCapturePreparedRef = useRef(false);
  const screenRecordingSettingsOpenedRef = useRef(false);
  const screenRecordingRecheckBusyRef = useRef(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  optionsRef.current = options;

  const screenPermissionRecoveryMessage = options.locale === "ja"
    ? "システム設定で AI Desktop の画面収録を許可してください。AI Desktop に戻ると自動的に再確認します。"
    : "请在系统设置中允许 AI Desktop 使用屏幕录制权限；返回 AI Desktop 后会自动重新检测。";
  const screenPermissionRestartMessage = options.locale === "ja"
    ? "現在のプロセスでは変更後の権限をまだ認識できません。権限が有効なら AI Desktop を再起動してください。"
    : "当前进程仍未识别更改后的权限；若系统开关已经开启，请重启 AI Desktop 使权限生效。";

  useEffect(() => window.desktop?.onScreenshotCompleted(({ attachment, dataUrl, hasAnnotations }) => {
    const currentOptions = optionsRef.current;
    currentOptions.setAttachments(destinationRef.current, (current) => appendComposerAttachment(current, { ...attachment, dataUrl }));
    if (hasAnnotations && destinationRef.current === "main") currentOptions.setMainInput((current) => {
      const prompt = "调查图片红色部分是什么问题";
      if (current.includes(prompt)) return current;
      const existing = current.trimEnd();
      return existing ? `${existing}\n${prompt}` : prompt;
    });
    void nextRenderedFrame().then(() => composerRef.current?.focus());
    currentOptions.refreshTempInfo();
  }), []);

  const startScreenshot = async (hideOwnerWindow = false, destination: ScreenshotDestination = "main") => {
    if (screenshotBusy) return;
    if (options.getAttachments(destination).length >= 5) {
      setScreenshotError("最多可以同时发送 5 张截图。");
      return;
    }
    setScreenshotBusy(true);
    destinationRef.current = destination;
    setScreenshotMode(hideOwnerWindow ? "hidden" : "current");
    setScreenshotError("");
    setScreenRecordingSettingsAvailable(false);
    setScreenRecordingRestartRequired(false);
    options.closeSettings();
    try {
      if (window.desktop) {
        await nextRenderedFrame();
        if (!screenCapturePreparedRef.current) {
          const startedAt = performance.now();
          const preparation = await window.desktop.prepareScreenCapture();
          if (preparation.status === "blocked") {
            setScreenshotError(preparation.reason === "permission-required" ? screenPermissionRecoveryMessage : options.screenSourceUnavailable);
            setScreenRecordingSettingsAvailable(preparation.canOpenSettings);
            return;
          }
          const remainingIndicatorTime = Math.max(0, 320 - (performance.now() - startedAt));
          if (remainingIndicatorTime > 0) await delay(remainingIndicatorTime);
          screenCapturePreparedRef.current = true;
        }
      }
      await window.desktop?.captureScreen({ hideOwnerWindow });
    } catch (error) {
      setScreenshotError(readableDesktopError(error, "Unable to capture screen"));
    } finally {
      setScreenshotBusy(false);
      setScreenshotMode(null);
    }
  };

  const openScreenRecordingSettings = async () => {
    screenRecordingSettingsOpenedRef.current = true;
    try {
      await window.desktop?.openScreenRecordingSettings();
    } catch (error) {
      screenRecordingSettingsOpenedRef.current = false;
      setScreenshotError(readableDesktopError(error, options.screenSourceUnavailable));
      setScreenRecordingSettingsAvailable(false);
    }
  };

  useEffect(() => {
    if (!screenRecordingSettingsAvailable) return;
    const desktop = window.desktop;
    if (!desktop) return;
    const recheck = () => {
      if (!screenRecordingSettingsOpenedRef.current || screenRecordingRecheckBusyRef.current || document.visibilityState !== "visible") return;
      screenRecordingRecheckBusyRef.current = true;
      void desktop.prepareScreenCapture().then((preparation) => {
        if (preparation.status === "ready") {
          screenCapturePreparedRef.current = true;
          screenRecordingSettingsOpenedRef.current = false;
          setScreenshotError("");
          setScreenRecordingSettingsAvailable(false);
          setScreenRecordingRestartRequired(false);
          return;
        }
        setScreenshotError(preparation.reason === "permission-required" ? screenPermissionRestartMessage : options.screenSourceUnavailable);
        setScreenRecordingSettingsAvailable(preparation.canOpenSettings);
        setScreenRecordingRestartRequired(preparation.reason === "permission-required");
      }).catch((error) => setScreenshotError(readableDesktopError(error, options.screenSourceUnavailable)))
        .finally(() => { screenRecordingRecheckBusyRef.current = false; });
    };
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [screenPermissionRestartMessage, screenRecordingSettingsAvailable, options.screenSourceUnavailable]);

  const restartForScreenRecordingPermission = async () => {
    if (screenRecordingRestarting) return;
    setScreenRecordingRestarting(true);
    setScreenshotError(options.locale === "ja" ? "AI Desktop を再起動しています…" : "正在重启 AI Desktop 以应用屏幕录制权限…");
    try {
      await window.desktop?.restartForScreenRecordingPermission();
    } catch (error) {
      setScreenRecordingRestarting(false);
      setScreenshotError(readableDesktopError(error, options.screenSourceUnavailable));
    }
  };

  const pasteClipboardImages = async (files: File[], destination: ScreenshotDestination = "main") => {
    if (screenshotBusy || files.length === 0) return;
    if (options.getAttachments(destination).length + files.length > 5) {
      setScreenshotError("最多可以同时发送 5 张图片。");
      return;
    }
    setScreenshotBusy(true);
    setScreenshotError("");
    try {
      const dataUrls = await Promise.all(files.map(imageFileToPngDataUrl));
      const savedAttachments: ComposerAttachment[] = [];
      for (const dataUrl of dataUrls) {
        const saved = await window.desktop?.saveScreenshot({ originalDataUrl: dataUrl, annotatedDataUrl: dataUrl, hasAnnotations: false });
        if (!saved) throw new Error("AI Desktop clipboard image service is unavailable.");
        savedAttachments.push({ ...saved, dataUrl });
      }
      options.setAttachments(destination, (current) => savedAttachments.reduce(appendComposerAttachment, current));
      options.refreshTempInfo();
    } catch (error) {
      setScreenshotError(error instanceof Error ? error.message : "Unable to paste clipboard image");
    } finally {
      setScreenshotBusy(false);
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (imageFiles.length === 0) return;
    event.preventDefault();
    void pasteClipboardImages(imageFiles);
  };

  return {
    screenshotBusy, screenshotMode, screenshotError, setScreenshotError, screenRecordingSettingsAvailable,
    screenRecordingRestartRequired, screenRecordingRestarting, composerRef, startScreenshot, pasteClipboardImages,
    onPaste, openScreenRecordingSettings, restartForScreenRecordingPermission,
  };
}
