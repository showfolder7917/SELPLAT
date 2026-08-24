import type { Annotation, CanvasViewport, Rectangle } from "../model/annotations";

export function syncCanvasViewport(canvas: HTMLCanvasElement, update: (viewport: CanvasViewport) => void): void {
  const bounds = canvas.getBoundingClientRect();
  update({ x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height });
}

export function nextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

export function drawAnnotations(baseImage: HTMLImageElement, annotations: Annotation[], draftAnnotation: Annotation | null, selectedRectangleId: string | null, rectangleTransformPreview: Rectangle | null, canvas: HTMLCanvasElement): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
  const visibleAnnotations = draftAnnotation ? [...annotations, draftAnnotation] : annotations;
  visibleAnnotations.forEach((annotation) => {
    context.strokeStyle = "#ff3030";
    context.lineWidth = Math.max(4, Math.round(canvas.width / 420));
    context.lineCap = "round";
    context.lineJoin = "round";
    if (annotation.type === "rectangle") {
      const rectangle = annotation.id === selectedRectangleId && rectangleTransformPreview ? rectangleTransformPreview : annotation.rectangle;
      context.strokeRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
      return;
    }
    if (annotation.points.length < 2) return;
    context.beginPath();
    context.moveTo(annotation.points[0].x, annotation.points[0].y);
    annotation.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
    context.stroke();
    context.closePath();
  });
}

export function loadDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load screenshot image."));
    image.src = dataUrl;
  });
}
