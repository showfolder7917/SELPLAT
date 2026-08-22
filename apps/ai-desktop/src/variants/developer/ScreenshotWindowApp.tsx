import { useEffect, useRef, useState } from "react";

import type {
  Locale,
  ScreenCapture,
  ScreenCaptureFrameRequest,
  ScreenCaptureStreamSource,
} from "../../../shared/contracts/desktop";
import { ScreenshotEditor } from "./ScreenshotEditor";
import "./developer.css";

/** 等待桌面视频送达一张真正的新画面，避免使用固定毫秒数猜测系统合成器何时完成。 */
function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => video.requestVideoFrameCallback(() => resolve()));
}

/** 独立截图窗口只负责长期桌面流、选择、标注和保存，主编辑器窗口在整个过程中保持原尺寸。 */
export function ScreenshotWindowApp() {
  const [capture, setCapture] = useState<ScreenCapture | null>(null);
  const [captureVersion, setCaptureVersion] = useState(0);
  const [locale, setLocale] = useState<Locale>("zh-CN");
  const [error, setError] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const streamSourceIdRef = useRef("");
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let disposed = false;

    const startScreenStream = async (source: ScreenCaptureStreamSource) => {
      if (disposed) return;
      if (streamSourceIdRef.current === source.sourceId && videoRef.current?.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA) {
        await window.desktop?.notifyScreenCaptureStreamReady(source.sourceId);
        return;
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const constraints = {
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: source.sourceId,
            maxWidth: source.width,
            maxHeight: source.height,
            maxFrameRate: 30,
          },
        },
      } as unknown as MediaStreamConstraints;
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (disposed) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      await waitForVideoFrame(video);
      streamRef.current = stream;
      streamSourceIdRef.current = source.sourceId;
      videoRef.current = video;
      await window.desktop?.notifyScreenCaptureStreamReady(source.sourceId);
    };

    const freezeScreenFrame = async (request: ScreenCaptureFrameRequest) => {
      try {
        const video = videoRef.current;
        if (!video || video.videoWidth < 1 || video.videoHeight < 1) throw new Error("屏幕流尚未准备完成，请重试。");
        // 隐藏主窗体后连续跨过两张视频帧，确保冻结的是没有 AI Desktop 的真实背景；普通截图只需下一张新帧。
        const frameCount = request.waitForOwnerHidden ? 2 : 1;
        for (let index = 0; index < frameCount; index += 1) await waitForVideoFrame(video);
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("无法创建截图画布。");
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const nextCapture = { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
        setCapture(nextCapture);
        setCaptureVersion((current) => current + 1);
        await window.desktop?.submitScreenCaptureFrameResult({
          requestId: request.requestId,
          width: canvas.width,
          height: canvas.height,
        });
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "无法读取屏幕画面";
        await window.desktop?.submitScreenCaptureFrameResult({ requestId: request.requestId, width: 0, height: 0, error: message });
      }
    };

    const removeConfiguredListener = window.desktop?.onScreenCaptureStreamConfigured((source) => {
      void startScreenStream(source).catch((caught) => setError(caught instanceof Error ? caught.message : "无法准备屏幕流"));
    });
    const removeFrameListener = window.desktop?.onScreenCaptureFrameRequested((request) => void freezeScreenFrame(request));
    void Promise.all([window.desktop?.getScreenCaptureStreamSource(), window.desktop?.getSettings()])
      .then(([source, settings]) => {
        if (settings) setLocale(settings.locale);
        if (source) return startScreenStream(source);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "无法打开截图窗口"));

    return () => {
      disposed = true;
      removeConfiguredListener?.();
      removeFrameListener?.();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      videoRef.current = null;
    };
  }, []);

  useEffect(() => window.desktop?.onScreenCaptureReset(() => {
    // 常驻截图壳空闲时卸载编辑器，但保留桌面流，下一轮两个截图入口都能直接冻结最新画面。
    setCapture(null);
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
