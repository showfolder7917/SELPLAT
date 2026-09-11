import { useEffect, useState } from "react";

import type { LocaleValue, ScreenCaptureFrameInDto, ScreenCaptureOutDto } from "../../../../contracts/system/desktop/index";
import { getOptionalScreenshotDesktopApi, getOptionalSystemDesktopApi } from "../../../foundation/desktop-api";

/** 管理独立截图窗口的画面接收、保存和关闭流程。 */
export function useScreenshotApplicationController() {
  // 当前截图由主进程发送；为空时窗口显示透明加载层。
  const [capture, setCapture] = useState<ScreenCaptureOutDto | null>(null);
  // 每次收到新截图都递增版本，强制编辑器清空上一张图的内部状态。
  const [captureVersion, setCaptureVersion] = useState(0);
  // 截图窗口使用与主窗口一致的语言设置。
  const [locale, setLocale] = useState<LocaleValue>("zh-CN");
  // 主进程通信或截图校验失败时显示真实错误。
  const [error, setError] = useState("");

  useEffect(() => {
    /** 向主进程报告截图窗口已完成的阶段，供运行诊断追踪。 */
    function reportStage(stage: string, detail?: string) {
      void getOptionalScreenshotDesktopApi()?.notifyScreenCaptureStage(stage, detail).catch(() => {});
    }

    /** 校验并接收主进程提供的原生 PNG 画面。 */
    async function receiveNativeFrame(request: ScreenCaptureFrameInDto) {
      try {
        const nextCapture = request.capture;
        const validPng = nextCapture?.dataUrl.startsWith("data:image/png;base64,");
        const validSize = nextCapture && nextCapture.width >= 1 && nextCapture.height >= 1;
        if (!validPng || !validSize) throw new Error("主进程返回的截图画面无效。");

        setError("");
        setCapture(nextCapture);
        setCaptureVersion((current) => current + 1);
        reportStage("renderer-native-frame-received", `${nextCapture.width}x${nextCapture.height}`);
        await getOptionalScreenshotDesktopApi()?.submitScreenCaptureFrameResult({
          requestId: request.requestId,
          width: nextCapture.width,
          height: nextCapture.height,
        });
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "无法读取屏幕画面";
        setError(message);
        await getOptionalScreenshotDesktopApi()?.submitScreenCaptureFrameResult({
          requestId: request.requestId,
          width: 0,
          height: 0,
          error: message,
        });
      }
    }

    // 主进程请求画面时启动接收流程；组件卸载时注销监听器。
    const removeFrameListener = getOptionalScreenshotDesktopApi()?.onScreenCaptureFrameRequested(
      (request) => { void receiveNativeFrame(request); },
    );

    // 截图窗口没有自己的设置页，只读取主窗口已经保存的语言。
    void getOptionalSystemDesktopApi()?.getSettings()
      .then((settings) => {
        if (settings) setLocale(settings.locale);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "无法打开截图窗口"));

    return () => removeFrameListener?.();
  }, []);

  useEffect(() => {
    // 主进程要求重新截图时清空当前画面和错误，回到等待状态。
    return getOptionalScreenshotDesktopApi()?.onScreenCaptureReset(() => {
      setCapture(null);
      setError("");
    });
  }, []);

  useEffect(() => {
    // 连续等待两帧确保冻结画面已经绘制，再显示独立窗口，避免白屏闪烁。
    let paintedFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      paintedFrame = window.requestAnimationFrame(() => {
        void getOptionalScreenshotDesktopApi()?.showScreenshotWindow();
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (paintedFrame) window.cancelAnimationFrame(paintedFrame);
    };
  }, [capture]);

  /** 取消截图时通知主进程关闭独立编辑窗口。 */
  async function cancel() {
    await getOptionalScreenshotDesktopApi()?.endScreenshotEditing();
  }

  /** 保存原图和标注图，成功后关闭独立编辑窗口。 */
  async function complete(originalDataUrl: string, annotatedDataUrl: string, hasAnnotations: boolean) {
    const saved = await getOptionalScreenshotDesktopApi()?.saveScreenshot({
      originalDataUrl,
      annotatedDataUrl,
      hasAnnotations,
    });
    if (!saved) throw new Error("AI Desktop screenshot service is unavailable.");
    await getOptionalScreenshotDesktopApi()?.endScreenshotEditing();
  }

  return { capture, captureVersion, locale, error, cancel, complete };
}

/** Screenshot ViewModel 只读取该应用控制器公开的状态和动作。 */
export type ScreenshotApplicationController = ReturnType<typeof useScreenshotApplicationController>;
