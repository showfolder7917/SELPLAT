import { PointerEvent, useEffect, useRef, useState } from "react";
import {
  ArrowUndo24Regular,
  Dismiss20Regular,
  DrawShape24Regular,
  Eraser24Regular,
  Pen24Regular,
  Square20Regular,
} from "@fluentui/react-icons";

import type { Locale, ScreenCapture } from "../../../shared/contracts/desktop";

type Tool = "pen" | "rectangle";
type Rectangle = { x: number; y: number; width: number; height: number };

interface ScreenshotEditorProps {
  capture: ScreenCapture;
  locale: Locale;
  onCancel(): void;
  onComplete(originalDataUrl: string, annotatedDataUrl: string, hasAnnotations: boolean): Promise<void>;
}

const editorLabels = {
  ja: { select: "範囲を選択", selectHint: "ドラッグして切り取る範囲を選択してください", annotate: "赤で注釈", done: "完了", pen: "ペン", rectangle: "四角", undo: "元に戻す", clear: "描画をすべて消去", clearConfirm: "すべての赤い注釈を消去しますか？", cancel: "キャンセル", back: "戻る", saving: "保存中..." },
  "zh-CN": { select: "选择截图区域", selectHint: "拖动鼠标框选需要截取的区域", annotate: "红色标注", done: "完成", pen: "画笔", rectangle: "方框", undo: "撤销", clear: "清空绘画框", clearConfirm: "确定清空全部红色绘画标注吗？", cancel: "取消", back: "返回", saving: "正在保存..." },
} as const;

/** 在渲染层完成选区和画布标注，只把最终 PNG 数据交给主进程落盘。 */
export function ScreenshotEditor({ capture, locale, onCancel, onComplete }: ScreenshotEditorProps) {
  const [phase, setPhase] = useState<"select" | "annotate">("select");
  const [selection, setSelection] = useState<Rectangle | null>(null);
  const [croppedDataUrl, setCroppedDataUrl] = useState("");
  const [croppedSize, setCroppedSize] = useState({ width: 0, height: 0 });
  const [tool, setTool] = useState<Tool>("rectangle");
  const [history, setHistory] = useState<string[]>([]);
  const [annotationConfirmPosition, setAnnotationConfirmPosition] = useState<{ left: number; top: number } | null>(null);
  const [rectanglePreview, setRectanglePreview] = useState<Rectangle | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const annotationActionFrameRef = useRef(0);
  const annotationActionsAvailableAtRef = useRef(0);
  const selectionOriginRef = useRef<{ x: number; y: number } | null>(null);
  const drawingRef = useRef<{ tool: Tool; startX: number; startY: number; lastX: number; lastY: number } | null>(null);
  const text = editorLabels[locale];

  useEffect(() => {
    if (phase !== "annotate" || !croppedDataUrl) return;
    void drawDataUrl(croppedDataUrl, canvasRef.current).then(() => setHistory([croppedDataUrl]));
  }, [croppedDataUrl, phase]);

  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onCancel]);

  useEffect(() => () => {
    if (annotationActionFrameRef.current) window.cancelAnimationFrame(annotationActionFrameRef.current);
  }, []);

  const selectionPoint = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp(event.clientX - bounds.left, 0, bounds.width),
      y: clamp(event.clientY - bounds.top, 0, bounds.height),
    };
  };

  const beginSelection = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = selectionPoint(event);
    selectionOriginRef.current = point;
    setSelection({ x: point.x, y: point.y, width: 0, height: 0 });
  };

  const moveSelection = (event: PointerEvent<HTMLDivElement>) => {
    const origin = selectionOriginRef.current;
    if (!origin) return;
    const point = selectionPoint(event);
    setSelection(normalizeRectangle(origin.x, origin.y, point.x, point.y));
  };

  const finishSelection = (event: PointerEvent<HTMLDivElement>) => {
    const origin = selectionOriginRef.current;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    selectionOriginRef.current = null;
    if (!origin) return;
    const point = selectionPoint(event);
    const finishedSelection = normalizeRectangle(origin.x, origin.y, point.x, point.y);
    setSelection(finishedSelection);
    if (finishedSelection.width >= 12 && finishedSelection.height >= 12) void cropSelection(finishedSelection);
  };

  async function cropSelection(targetSelection: Rectangle) {
    const image = imageRef.current;
    if (!image) return;
    const bounds = image.getBoundingClientRect();
    const scaleX = image.naturalWidth / bounds.width;
    const scaleY = image.naturalHeight / bounds.height;
    const sourceX = Math.round(targetSelection.x * scaleX);
    const sourceY = Math.round(targetSelection.y * scaleY);
    const sourceWidth = Math.max(1, Math.round(targetSelection.width * scaleX));
    const sourceHeight = Math.max(1, Math.round(targetSelection.height * scaleY));
    const canvas = document.createElement("canvas");
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    canvas.getContext("2d")?.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
    const nextCroppedDataUrl = canvas.toDataURL("image/png");
    await window.desktop?.enterScreenshotAnnotation({ width: sourceWidth, height: sourceHeight });
    setCroppedSize({ width: sourceWidth, height: sourceHeight });
    setCroppedDataUrl(nextCroppedDataUrl);
    setPhase("annotate");
  }

  const returnToSelection = async () => {
    setSelection(null);
    setCroppedDataUrl("");
    setCroppedSize({ width: 0, height: 0 });
    setHistory([]);
    setAnnotationConfirmPosition(null);
    setRectanglePreview(null);
    setSaving(false);
    setError("");
    setPhase("select");
    // 先让冻结蒙版完成两帧绘制，再由主进程把普通标注窗恢复为全屏框选窗，避免闪现旧画布。
    await nextPaint();
    await window.desktop?.returnScreenshotSelection();
  };

  const canvasPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * canvas.width / bounds.width,
      y: (event.clientY - bounds.top) * canvas.height / bounds.height,
    };
  };

  const beginDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = canvasPoint(event);
    if (annotationActionFrameRef.current) window.cancelAnimationFrame(annotationActionFrameRef.current);
    annotationActionsAvailableAtRef.current = Number.POSITIVE_INFINITY;
    setAnnotationConfirmPosition(null);
    setRectanglePreview(null);
    drawingRef.current = {
      tool,
      startX: point.x,
      startY: point.y,
      lastX: point.x,
      lastY: point.y,
    };
    configureRedStroke(context, canvas.width);
    if (tool === "pen") {
      context.beginPath();
      context.moveTo(point.x, point.y);
    }
  };

  const moveDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    const drawing = drawingRef.current;
    const context = event.currentTarget.getContext("2d");
    if (!drawing || !context) return;
    const point = canvasPoint(event);
    configureRedStroke(context, event.currentTarget.width);
    if (drawing.tool === "pen") {
      context.lineTo(point.x, point.y);
      context.stroke();
    } else {
      const canvasBounds = event.currentTarget.getBoundingClientRect();
      const preview = normalizeRectangle(drawing.startX, drawing.startY, point.x, point.y);
      setRectanglePreview({
        x: canvasBounds.left + preview.x * canvasBounds.width / event.currentTarget.width,
        y: canvasBounds.top + preview.y * canvasBounds.height / event.currentTarget.height,
        width: preview.width * canvasBounds.width / event.currentTarget.width,
        height: preview.height * canvasBounds.height / event.currentTarget.height,
      });
    }
    drawing.lastX = point.x;
    drawing.lastY = point.y;
  };

  const finishDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    const drawing = drawingRef.current;
    if (!drawing) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const context = event.currentTarget.getContext("2d");
    if (context && drawing.tool === "pen") context.closePath();
    if (context && drawing.tool === "rectangle") {
      configureRedStroke(context, event.currentTarget.width);
      context.strokeRect(drawing.startX, drawing.startY, drawing.lastX - drawing.startX, drawing.lastY - drawing.startY);
    }
    setRectanglePreview(null);
    const canvasBounds = event.currentTarget.getBoundingClientRect();
    const scaleX = canvasBounds.width / event.currentTarget.width;
    const scaleY = canvasBounds.height / event.currentTarget.height;
    const annotationBounds = normalizeRectangle(
      canvasBounds.left + drawing.startX * scaleX,
      canvasBounds.top + drawing.startY * scaleY,
      canvasBounds.left + drawing.lastX * scaleX,
      canvasBounds.top + drawing.lastY * scaleY,
    );
    // React 结束 pointer 事件后会清空 currentTarget；必须在同步事件周期内生成快照，
    // 禁止在状态更新回调中继续读取 event.currentTarget，否则会导致编辑器渲染崩溃并黑屏。
    const annotatedDataUrl = event.currentTarget.toDataURL("image/png");
    drawingRef.current = null;
    setHistory((current) => [...current, annotatedDataUrl]);
    // 第二个完成按钮跟随刚绘制的标注框，边缘场景使用同一翻转算法避免超出屏幕。
    const nextActionPosition = drawing.tool === "rectangle" && (annotationBounds.width < 8 || annotationBounds.height < 8)
      ? null
      : selectionConfirmPosition(annotationBounds, window.innerWidth, window.innerHeight, 152);
    // 跟随按钮延迟到当前 pointerup/click 手势完全结束后出现，避免连续画第二框时误触刚挂载的“完成”。
    annotationActionFrameRef.current = window.requestAnimationFrame(() => {
      annotationActionFrameRef.current = 0;
      annotationActionsAvailableAtRef.current = performance.now() + 180;
      setAnnotationConfirmPosition(nextActionPosition);
    });
  };

  const restorePreviousAnnotation = async () => {
    if (history.length <= 1) return;
    const next = history.slice(0, -1);
    await drawDataUrl(next[next.length - 1], canvasRef.current);
    setHistory(next);
    setAnnotationConfirmPosition(null);
    setRectanglePreview(null);
  };

  const undo = async () => {
    await restorePreviousAnnotation();
  };

  const cancelLatestAnnotation = async () => {
    if (performance.now() < annotationActionsAvailableAtRef.current) return;
    await restorePreviousAnnotation();
  };

  const clear = async () => {
    if (!window.confirm(text.clearConfirm)) return;
    await drawDataUrl(croppedDataUrl, canvasRef.current);
    setHistory([croppedDataUrl]);
    setAnnotationConfirmPosition(null);
    setRectanglePreview(null);
  };

  const complete = async (respectFloatingActionDelay = false) => {
    const canvas = canvasRef.current;
    if (!canvas || saving || (respectFloatingActionDelay && performance.now() < annotationActionsAvailableAtRef.current)) return;
    setSaving(true);
    setError("");
    try {
      // 历史首项永远是未标注裁剪图；只有存在后续快照时才向对话框追加“红色部分”提示。
      await onComplete(croppedDataUrl, canvas.toDataURL("image/png"), history.length > 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save screenshot");
      setSaving(false);
    }
  };

  return <section className={`screenshot-overlay ${phase === "select" ? `select-only ${selection ? "has-selection" : ""}` : ""}`} role="dialog" aria-modal="true" aria-label={phase === "select" ? text.select : text.annotate}>
    {phase === "annotate" && <header className="screenshot-header">
      <div><strong>{text.annotate}</strong><span>{croppedSize.width} × {croppedSize.height}</span></div>
      <div className="screenshot-window-controls">
        <button type="button" title="最大化/还原" onClick={() => window.desktop?.windowControl("maximize")}><Square20Regular /></button>
        <button type="button" title={text.cancel} onClick={onCancel}><Dismiss20Regular /></button>
      </div>
    </header>}

    {phase === "select" ? <div className="screenshot-select-stage">
      <div className="screenshot-source" onPointerDown={beginSelection} onPointerMove={moveSelection} onPointerUp={finishSelection}>
        <img ref={imageRef} src={capture.dataUrl} draggable={false} alt="Captured screen" />
        {selection && <div className="screenshot-selection" style={{ left: selection.x, top: selection.y, width: selection.width, height: selection.height }}><span>{Math.round(selection.width)} × {Math.round(selection.height)}</span></div>}
      </div>
    </div> : <div className="screenshot-annotate-stage">
      <canvas ref={canvasRef} onPointerDown={beginDrawing} onPointerMove={moveDrawing} onPointerUp={finishDrawing} />
      {rectanglePreview && <div className="screenshot-rectangle-preview" style={{ left: rectanglePreview.x, top: rectanglePreview.y, width: rectanglePreview.width, height: rectanglePreview.height }} />}
      {annotationConfirmPosition && <div className="screenshot-annotation-actions" style={annotationConfirmPosition}>
        <button type="button" className="primary" disabled={saving} onClick={() => void complete(true)}>{saving ? text.saving : text.done}</button>
        <button type="button" disabled={saving} onClick={() => void cancelLatestAnnotation()}>{text.cancel}</button>
      </div>}
    </div>}

    {phase === "annotate" && <footer className="screenshot-toolbar">
      <div className="screenshot-tools">
        <button type="button" className={tool === "pen" ? "active" : ""} onClick={() => setTool("pen")}><Pen24Regular />{text.pen}</button>
        <button type="button" className={tool === "rectangle" ? "active" : ""} onClick={() => setTool("rectangle")}><DrawShape24Regular />{text.rectangle}</button>
        <button type="button" disabled={history.length <= 1} onClick={() => void undo()}><ArrowUndo24Regular />{text.undo}</button>
        <button type="button" onClick={() => void clear()}><Eraser24Regular />{text.clear}</button>
      </div>
      <div className="screenshot-actions">
        {error && <span>{error}</span>}
        <button type="button" disabled={saving} onClick={onCancel}>{text.cancel}</button>
        <button type="button" className="primary" disabled={saving} onClick={() => void complete()}>{saving ? text.saving : text.done}</button>
        <button type="button" disabled={saving} onClick={() => void returnToSelection()}>{text.back}</button>
      </div>
    </footer>}
  </section>;
}

function normalizeRectangle(startX: number, startY: number, endX: number, endY: number): Rectangle {
  return { x: Math.min(startX, endX), y: Math.min(startY, endY), width: Math.abs(endX - startX), height: Math.abs(endY - startY) };
}

/** 选区确定按钮优先跟随右下角，靠近底部工具栏时自动收到选区内或翻到上方。 */
function selectionConfirmPosition(selection: Rectangle, sourceWidth: number, sourceHeight: number, controlWidth = 72): { left: number; top: number } {
  const gap = 8;
  const buttonHeight = 36;
  const toolbarHeight = 80;
  const left = clamp(selection.x + selection.width - controlWidth, gap, Math.max(gap, sourceWidth - controlWidth - gap));
  const below = selection.y + selection.height + gap;
  if (below + buttonHeight <= sourceHeight - toolbarHeight) return { left, top: below };
  if (selection.height >= buttonHeight + gap * 2) return { left, top: selection.y + selection.height - buttonHeight - gap };
  return { left, top: Math.max(gap, selection.y - buttonHeight - gap) };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function configureRedStroke(context: CanvasRenderingContext2D, canvasWidth: number): void {
  context.strokeStyle = "#ff3030";
  context.lineWidth = Math.max(4, Math.round(canvasWidth / 420));
  context.lineCap = "round";
  context.lineJoin = "round";
}

function drawDataUrl(dataUrl: string, canvas: HTMLCanvasElement | null): Promise<void> {
  if (!canvas) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d")?.drawImage(image, 0, 0);
      resolve();
    };
    image.onerror = () => reject(new Error("Unable to load screenshot image."));
    image.src = dataUrl;
  });
}
