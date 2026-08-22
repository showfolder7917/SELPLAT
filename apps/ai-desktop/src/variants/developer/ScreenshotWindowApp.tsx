import { useEffect, useState } from "react";

import type {
  Locale,
  ScreenCapture,
  ScreenCaptureFrameRequest,
} from "../../../shared/contracts/desktop";
import { ScreenshotEditor } from "./ScreenshotEditor";
import "./developer.css";

/** 独立截图窗口只负责选择、标注和保存主进程取得的 macOS 原生无光标 PNG。 */
export function ScreenshotWindowApp() {
  const [capture, setCapture] = useState<ScreenCapture | null>(null);
  const [captureVersion, setCaptureVersion] = useState(0);
  const [locale, setLocale] = useState<Locale>("zh-CN");
  const [error, setError] = useState("");

  useEffect(() => {
    const reportStage = (stage: string, detail?: string) => {
      void window.desktop?.notifyScreenCaptureStage(stage, detail).catch(() => {});
    };

    const receiveNativeFrame = async (request: ScreenCaptureFrameRequest) => {
      try {
        const nextCapture = request.capture;
        if (!nextCapture?.dataUrl.startsWith("data:image/png;base64,") || nextCapture.width < 1 || nextCapture.height < 1) {
          throw new Error("主进程返回的截图画面无效。");
        }
        setError("");
        setCapture(nextCapture);
        setCaptureVersion((current) => current + 1);
        reportStage("renderer-native-frame-received", `${nextCapture.width}x${nextCapture.height}`);
        await window.desktop?.submitScreenCaptureFrameResult({
          requestId: request.requestId,
          width: nextCapture.width,
          height: nextCapture.height,
        });
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "无法读取屏幕画面";
        setError(message);
        await window.desktop?.submitScreenCaptureFrameResult({ requestId: request.requestId, width: 0, height: 0, error: message });
      }
    };

    const removeFrameListener = window.desktop?.onScreenCaptureFrameRequested((request) => void receiveNativeFrame(request));
    void window.desktop?.getSettings()
      .then((settings) => {
        if (settings) setLocale(settings.locale);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "无法打开截图窗口"));
    return () => removeFrameListener?.();
  }, []);

  useEffect(() => window.desktop?.onScreenCaptureReset(() => {
    setCapture(null);
    setError("");
  }), []);

  useEffect(() => {
    let paintedFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      paintedFrame = window.requestAnimationFrame(() => void window.desktop?.showScreenshotWindow());
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (paintedFrame) window.cancelAnimationFrame(paintedFrame);
    };
  }, [capture]);

  const cancel = async () => {
    await window.desktop?.endScreenshotEditing();
  };

  const complete = async (originalDataUrl: string, annotatedDataUrl: string, hasAnnotations: boolean) => {
    const saved = await window.desktop?.saveScreenshot({ originalDataUrl, annotatedDataUrl, hasAnnotations });
    if (!saved) throw new Error("AI Desktop screenshot service is unavailable.");
    await window.desktop?.endScreenshotEditing();
  };

  if (error) return <main className="screenshot-window-error"><p>{error}</p><button type="button" onClick={() => void cancel()}>关闭</button></main>;
  if (!capture) return <main className="screenshot-window-loading" aria-label="正在加载截图" />;
  return <ScreenshotEditor key={captureVersion} capture={capture} locale={locale} onCancel={() => void cancel()} onComplete={complete} />;
}
