import { PointerEvent, useEffect, useRef, useState } from "react";
import {
  ArrowUndo24Regular,
  Dismiss20Regular,
  DrawShape24Regular,
  Eraser24Regular,
  Pen24Regular,
  Square20Regular,
} from "@fluentui/react-icons";

import type { LocaleValue, ScreenCaptureOutDto } from "../../../../contracts/system/desktop/desktop";
import { useSelUi } from "../../../theme/SelUiProvider";
import { drawAnnotations, loadDataUrl, nextPaint, syncCanvasViewport } from "../canvas/annotation-renderer";
import { canvasPointFromClient, clamp, findTopRectangleAtPoint, moveRectangle, normalizeRectangle, rectangleToViewport, resizeRectangle, sameRectangle, selectionConfirmPosition } from "../geometry/annotation-geometry";
import type { ActiveInteraction, Annotation, CanvasViewport, PenAnnotation, Point, PointerTarget, Rectangle, RectangleAnnotation, ResizeHandle, ScreenshotTool } from "../model/annotations";

interface ScreenshotEditorProps {
  capture: ScreenCaptureOutDto;
  locale: LocaleValue;
  onCancel(): void;
  onComplete(originalDataUrl: string, annotatedDataUrl: string, hasAnnotations: boolean): Promise<void>;
}

const editorLabels = {
  ja: { select: "範囲を選択", selectHint: "ドラッグして切り取る範囲を選択してください", annotate: "赤で注釈", done: "完了", pen: "ペン", rectangle: "四角", undo: "元に戻す", clear: "描画をすべて消去", clearConfirm: "すべての赤い注釈を消去しますか？", cancel: "キャンセル", back: "戻る", saving: "保存中..." },
  "zh-CN": { select: "选择截图区域", selectHint: "拖动鼠标框选需要截取的区域", annotate: "红色标注", done: "完成", pen: "画笔", rectangle: "方框", undo: "撤销", clear: "清空绘画框", clearConfirm: "确定清空全部红色绘画标注吗？", cancel: "取消", back: "返回", saving: "正在保存..." },
} as const;

const resizeHandles: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/** 在渲染层保存可编辑标注并合成最终 PNG，只把完成结果交给主进程落盘。 */
export function ScreenshotEditor({ capture, locale, onCancel, onComplete }: ScreenshotEditorProps) {
  const selUi = useSelUi();
  const [phase, setPhase] = useState<"select" | "annotate">("select");
  const [selection, setSelection] = useState<Rectangle | null>(null);
  const [croppedDataUrl, setCroppedDataUrl] = useState("");
  const [croppedSize, setCroppedSize] = useState({ width: 0, height: 0 });
  const [tool, setTool] = useState<ScreenshotTool>("rectangle");
  const [annotationHistory, setAnnotationHistory] = useState<Annotation[][]>([[]]);
  const [draftAnnotation, setDraftAnnotation] = useState<Annotation | null>(null);
  const [selectedRectangleId, setSelectedRectangleId] = useState<string | null>(null);
  const [rectangleTransformPreview, setRectangleTransformPreview] = useState<Rectangle | null>(null);
  const [canvasViewport, setCanvasViewport] = useState<CanvasViewport>({ x: 0, y: 0, width: 0, height: 0 });
  const [baseImageReady, setBaseImageReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);
  const selectionOriginRef = useRef<Point | null>(null);
  const interactionRef = useRef<ActiveInteraction | null>(null);
  const annotationIdRef = useRef(0);
  const text = editorLabels[locale];
  const annotations = annotationHistory[annotationHistory.length - 1] ?? [];
  const selectedRectangle = selectedRectangleId
    ? annotations.find((annotation): annotation is RectangleAnnotation => annotation.type === "rectangle" && annotation.id === selectedRectangleId)
    : undefined;
  const effectiveSelectedRectangle = selectedRectangle
    ? rectangleTransformPreview ?? selectedRectangle.rectangle
    : null;
  const selectedViewportRectangle = effectiveSelectedRectangle
    ? rectangleToViewport(effectiveSelectedRectangle, canvasViewport, croppedSize)
    : null;
  const annotationActionPosition = selectedViewportRectangle
    ? selectionConfirmPosition(selectedViewportRectangle, window.innerWidth, window.innerHeight, 152)
    : null;

  useEffect(() => {
    if (phase !== "annotate" || !croppedDataUrl) return;
    let disposed = false;
    setBaseImageReady(false);
    setAnnotationHistory([[]]);
    setDraftAnnotation(null);
    setSelectedRectangleId(null);
    setRectangleTransformPreview(null);
    void loadDataUrl(croppedDataUrl).then((image) => {
      if (disposed) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      baseImageRef.current = image;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      drawAnnotations(image, [], null, null, null, canvas);
      setBaseImageReady(true);
      window.requestAnimationFrame(() => syncCanvasViewport(canvas, setCanvasViewport));
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load screenshot image."));
    return () => { disposed = true; };
  }, [croppedDataUrl, phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = baseImageRef.current;
    if (!baseImageReady || !canvas || !image) return;
    drawAnnotations(image, annotations, draftAnnotation, selectedRectangleId, rectangleTransformPreview, canvas);
  }, [annotationHistory, baseImageReady, draftAnnotation, rectangleTransformPreview, selectedRectangleId]);

  useEffect(() => {
    if (phase !== "annotate") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateViewport = () => syncCanvasViewport(canvas, setCanvasViewport);
    const observer = new ResizeObserver(updateViewport);
    observer.observe(canvas);
    window.addEventListener("resize", updateViewport);
    updateViewport();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateViewport);
    };
  }, [baseImageReady, phase]);

  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    const clearSelectionOnWindowBlur = () => {
      setSelectedRectangleId(null);
      setRectangleTransformPreview(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("blur", clearSelectionOnWindowBlur);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("blur", clearSelectionOnWindowBlur);
    };
  }, [onCancel]);

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
    setAnnotationHistory([[]]);
    setDraftAnnotation(null);
    setSelectedRectangleId(null);
    setRectangleTransformPreview(null);
    setSaving(false);
    setError("");
    setPhase("select");
    baseImageRef.current = null;
    // 先让冻结蒙版完成两帧绘制，再由主进程把普通标注窗恢复为全屏框选窗，避免闪现旧画布。
    await nextPaint();
    await window.desktop?.returnScreenshotSelection();
  };

  const createAnnotationId = () => {
    annotationIdRef.current += 1;
    return `annotation-${annotationIdRef.current}`;
  };

  const beginCanvasInteraction = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const point = canvasPointFromClient(event.clientX, event.clientY, canvas);
    const hitRectangle = findTopRectangleAtPoint(annotations, point, canvas.width);
    event.currentTarget.setPointerCapture(event.pointerId);
    setError("");
    setDraftAnnotation(null);
    setRectangleTransformPreview(null);
    if (hitRectangle) {
      setSelectedRectangleId(hitRectangle.id);
      interactionRef.current = {
        kind: "move",
        pointerId: event.pointerId,
        annotationId: hitRectangle.id,
        origin: point,
        original: hitRectangle.rectangle,
        current: hitRectangle.rectangle,
      };
      return;
    }
    setSelectedRectangleId(null);
    if (tool === "pen") {
      const annotation: PenAnnotation = { id: createAnnotationId(), type: "pen", points: [point] };
      interactionRef.current = { kind: "draw-pen", pointerId: event.pointerId, annotation };
      setDraftAnnotation(annotation);
      return;
    }
    const annotation: RectangleAnnotation = {
      id: createAnnotationId(),
      type: "rectangle",
      rectangle: { x: point.x, y: point.y, width: 0, height: 0 },
    };
    interactionRef.current = { kind: "draw-rectangle", pointerId: event.pointerId, annotation, origin: point };
    setDraftAnnotation(annotation);
  };

  const moveCanvasInteraction = (event: PointerEvent<HTMLCanvasElement>) => {
    updateInteraction(event.clientX, event.clientY);
  };

  const finishCanvasInteraction = (event: PointerEvent<HTMLCanvasElement>) => {
    updateInteraction(event.clientX, event.clientY);
    finishInteraction(event.currentTarget, event.pointerId);
  };

  const cancelCanvasInteraction = (event: PointerEvent<HTMLCanvasElement>) => {
    cancelInteraction(event.currentTarget, event.pointerId);
  };

  const beginResize = (event: PointerEvent<HTMLButtonElement>, handle: ResizeHandle) => {
    if (!selectedRectangle) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = canvasPointFromClient(event.clientX, event.clientY, canvas);
    interactionRef.current = {
      kind: "resize",
      pointerId: event.pointerId,
      annotationId: selectedRectangle.id,
      origin: point,
      original: selectedRectangle.rectangle,
      current: selectedRectangle.rectangle,
      handle,
    };
    setRectangleTransformPreview(selectedRectangle.rectangle);
  };

  const moveResize = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    updateInteraction(event.clientX, event.clientY);
  };

  const finishResize = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    updateInteraction(event.clientX, event.clientY);
    finishInteraction(event.currentTarget, event.pointerId);
  };

  const cancelResize = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    cancelInteraction(event.currentTarget, event.pointerId);
  };

  const updateInteraction = (clientX: number, clientY: number) => {
    const interaction = interactionRef.current;
    const canvas = canvasRef.current;
    if (!interaction || !canvas) return;
    const point = canvasPointFromClient(clientX, clientY, canvas);
    if (interaction.kind === "draw-pen") {
      interaction.annotation = { ...interaction.annotation, points: [...interaction.annotation.points, point] };
      setDraftAnnotation(interaction.annotation);
      return;
    }
    if (interaction.kind === "draw-rectangle") {
      interaction.annotation = {
        ...interaction.annotation,
        rectangle: normalizeRectangle(interaction.origin.x, interaction.origin.y, point.x, point.y),
      };
      setDraftAnnotation(interaction.annotation);
      return;
    }
    const deltaX = point.x - interaction.origin.x;
    const deltaY = point.y - interaction.origin.y;
    const nextRectangle = interaction.kind === "move"
      ? moveRectangle(interaction.original, deltaX, deltaY, canvas.width, canvas.height)
      : resizeRectangle(interaction.original, interaction.handle, deltaX, deltaY, canvas.width, canvas.height);
    interaction.current = nextRectangle;
    setRectangleTransformPreview(nextRectangle);
  };

  const finishInteraction = (captureTarget: PointerTarget, pointerId: number) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== pointerId) return;
    if (captureTarget.hasPointerCapture(pointerId)) captureTarget.releasePointerCapture(pointerId);
    interactionRef.current = null;
    if (interaction.kind === "draw-pen") {
      if (interaction.annotation.points.length > 1) commitAnnotations([...annotations, interaction.annotation]);
      setDraftAnnotation(null);
      return;
    }
    if (interaction.kind === "draw-rectangle") {
      const rectangle = interaction.annotation.rectangle;
      if (rectangle.width >= 8 && rectangle.height >= 8) {
        commitAnnotations([...annotations, interaction.annotation]);
        setSelectedRectangleId(interaction.annotation.id);
      }
      setDraftAnnotation(null);
      return;
    }
    const nextRectangle = interaction.current;
    if (!sameRectangle(interaction.original, nextRectangle)) {
      commitAnnotations(annotations.map((annotation) => annotation.id === interaction.annotationId && annotation.type === "rectangle"
        ? { ...annotation, rectangle: nextRectangle }
        : annotation));
    }
    setRectangleTransformPreview(null);
  };

  const cancelInteraction = (captureTarget: PointerTarget, pointerId: number) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== pointerId) return;
    if (captureTarget.hasPointerCapture(pointerId)) captureTarget.releasePointerCapture(pointerId);
    interactionRef.current = null;
    setDraftAnnotation(null);
    setRectangleTransformPreview(null);
  };

  const commitAnnotations = (nextAnnotations: Annotation[]) => {
    setAnnotationHistory((current) => [...current, nextAnnotations]);
  };

  const undo = () => {
    if (annotationHistory.length <= 1) return;
    setAnnotationHistory((current) => current.slice(0, -1));
    setSelectedRectangleId(null);
    setRectangleTransformPreview(null);
    setDraftAnnotation(null);
  };

  const cancelSelectedRectangle = () => {
    if (!selectedRectangleId) return;
    commitAnnotations(annotations.filter((annotation) => annotation.id !== selectedRectangleId));
    setSelectedRectangleId(null);
    setRectangleTransformPreview(null);
  };

  const clear = async () => {
    if (!await selUi.confirm({ title: text.clear, message: text.clearConfirm, tone: "danger" })) return;
    setAnnotationHistory([[]]);
    setSelectedRectangleId(null);
    setRectangleTransformPreview(null);
    setDraftAnnotation(null);
  };

  const complete = async () => {
    const canvas = canvasRef.current;
    const image = baseImageRef.current;
    if (!canvas || !image || saving) return;
    setSaving(true);
    setError("");
    try {
      // 完成前同步按当前结构化状态重绘，避免最后一次移动或缩放尚未进入浏览器绘制帧。
      drawAnnotations(image, annotations, null, null, null, canvas);
      await onComplete(croppedDataUrl, canvas.toDataURL("image/png"), annotations.length > 0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save screenshot");
      setSaving(false);
    }
  };

  return <section className={`screenshot-overlay ${phase === "select" ? `select-only ${selection ? "has-selection" : ""}` : ""}`} role="dialog" aria-modal="true" aria-label={phase === "select" ? text.select : text.annotate}>
    {phase === "annotate" && <header className="screenshot-header" onPointerDown={() => setSelectedRectangleId(null)}>
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
    </div> : <div className="screenshot-annotate-stage" onPointerDown={(event) => {
      if (event.target === event.currentTarget) setSelectedRectangleId(null);
    }}>
      <canvas
        ref={canvasRef}
        aria-label={text.annotate}
        onPointerDown={beginCanvasInteraction}
        onPointerMove={moveCanvasInteraction}
        onPointerUp={finishCanvasInteraction}
        onPointerCancel={cancelCanvasInteraction}
      />
      {selectedViewportRectangle && <div
        className="screenshot-rectangle-selection"
        style={{ left: selectedViewportRectangle.x, top: selectedViewportRectangle.y, width: selectedViewportRectangle.width, height: selectedViewportRectangle.height }}
      >
        {resizeHandles.map((handle) => <button
          key={handle}
          type="button"
          className={`screenshot-resize-handle handle-${handle}`}
          aria-label={`调整红框-${handle}`}
          onPointerDown={(event) => beginResize(event, handle)}
          onPointerMove={moveResize}
          onPointerUp={finishResize}
          onPointerCancel={cancelResize}
        />)}
      </div>}
      {annotationActionPosition && <div className="screenshot-annotation-actions" style={annotationActionPosition} onPointerDown={(event) => event.stopPropagation()}>
        <button type="button" className="primary" disabled={saving} onClick={() => void complete()}>{saving ? text.saving : text.done}</button>
        <button type="button" disabled={saving} onClick={cancelSelectedRectangle}>{text.cancel}</button>
      </div>}
    </div>}

    {phase === "annotate" && <footer className="screenshot-toolbar" onPointerDown={() => setSelectedRectangleId(null)}>
      <div className="screenshot-tools">
        <button type="button" className={tool === "pen" ? "active" : ""} onClick={() => setTool("pen")}><Pen24Regular />{text.pen}</button>
        <button type="button" className={tool === "rectangle" ? "active" : ""} onClick={() => setTool("rectangle")}><DrawShape24Regular />{text.rectangle}</button>
        <button type="button" disabled={annotationHistory.length <= 1} onClick={undo}><ArrowUndo24Regular />{text.undo}</button>
        <button type="button" onClick={() => void clear()}><Eraser24Regular />{text.clear}</button>
      </div>
      <div className="screenshot-actions">
        {error && <span>{error}</span>}
        <button type="button" disabled={saving} onClick={() => void returnToSelection()}>{text.back}</button>
      </div>
    </footer>}
  </section>;
}
