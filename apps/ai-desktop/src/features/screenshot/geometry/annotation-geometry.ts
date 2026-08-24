import type { Annotation, CanvasViewport, Point, Rectangle, RectangleAnnotation, ResizeHandle } from "../model/annotations";

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeRectangle(startX: number, startY: number, endX: number, endY: number): Rectangle {
  return { x: Math.min(startX, endX), y: Math.min(startY, endY), width: Math.abs(endX - startX), height: Math.abs(endY - startY) };
}

/** 红框操作按钮优先跟随右下角，靠近底部工具栏时自动收到框内或翻到上方。 */
export function selectionConfirmPosition(selection: Rectangle, sourceWidth: number, sourceHeight: number, controlWidth = 72): { left: number; top: number } {
  const gap = 8;
  const buttonHeight = 36;
  const toolbarHeight = 80;
  const left = clamp(selection.x + selection.width - controlWidth, gap, Math.max(gap, sourceWidth - controlWidth - gap));
  const below = selection.y + selection.height + gap;
  if (below + buttonHeight <= sourceHeight - toolbarHeight) return { left, top: below };
  if (selection.height >= buttonHeight + gap * 2) return { left, top: selection.y + selection.height - buttonHeight - gap };
  return { left, top: Math.max(gap, selection.y - buttonHeight - gap) };
}

export function canvasPointFromClient(clientX: number, clientY: number, canvas: HTMLCanvasElement): Point {
  const bounds = canvas.getBoundingClientRect();
  return { x: clamp((clientX - bounds.left) * canvas.width / bounds.width, 0, canvas.width), y: clamp((clientY - bounds.top) * canvas.height / bounds.height, 0, canvas.height) };
}

export function rectangleToViewport(rectangle: Rectangle, viewport: CanvasViewport, sourceSize: { width: number; height: number }): Rectangle {
  if (sourceSize.width < 1 || sourceSize.height < 1) return { x: 0, y: 0, width: 0, height: 0 };
  const scaleX = viewport.width / sourceSize.width;
  const scaleY = viewport.height / sourceSize.height;
  return { x: viewport.x + rectangle.x * scaleX, y: viewport.y + rectangle.y * scaleY, width: rectangle.width * scaleX, height: rectangle.height * scaleY };
}

export function findTopRectangleAtPoint(annotations: Annotation[], point: Point, canvasWidth: number): RectangleAnnotation | undefined {
  const tolerance = Math.max(8, canvasWidth / 180);
  return [...annotations].reverse().find((annotation): annotation is RectangleAnnotation => {
    if (annotation.type !== "rectangle") return false;
    const { x, y, width, height } = annotation.rectangle;
    const insideExpanded = point.x >= x - tolerance && point.x <= x + width + tolerance && point.y >= y - tolerance && point.y <= y + height + tolerance;
    const insideContracted = width > tolerance * 2 && height > tolerance * 2 && point.x > x + tolerance && point.x < x + width - tolerance && point.y > y + tolerance && point.y < y + height - tolerance;
    return insideExpanded && !insideContracted;
  });
}

export function moveRectangle(rectangle: Rectangle, deltaX: number, deltaY: number, canvasWidth: number, canvasHeight: number): Rectangle {
  return { ...rectangle, x: clamp(rectangle.x + deltaX, 0, Math.max(0, canvasWidth - rectangle.width)), y: clamp(rectangle.y + deltaY, 0, Math.max(0, canvasHeight - rectangle.height)) };
}

export function resizeRectangle(rectangle: Rectangle, handle: ResizeHandle, deltaX: number, deltaY: number, canvasWidth: number, canvasHeight: number): Rectangle {
  const minimumSize = Math.max(8, canvasWidth / 120);
  let left = rectangle.x;
  let top = rectangle.y;
  let right = rectangle.x + rectangle.width;
  let bottom = rectangle.y + rectangle.height;
  if (handle.includes("w")) left = clamp(rectangle.x + deltaX, 0, right - minimumSize);
  if (handle.includes("e")) right = clamp(rectangle.x + rectangle.width + deltaX, left + minimumSize, canvasWidth);
  if (handle.includes("n")) top = clamp(rectangle.y + deltaY, 0, bottom - minimumSize);
  if (handle.includes("s")) bottom = clamp(rectangle.y + rectangle.height + deltaY, top + minimumSize, canvasHeight);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function sameRectangle(first: Rectangle, second: Rectangle): boolean {
  return first.x === second.x && first.y === second.y && first.width === second.width && first.height === second.height;
}
