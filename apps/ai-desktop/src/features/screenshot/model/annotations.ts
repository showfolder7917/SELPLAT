export type ScreenshotTool = "pen" | "rectangle";
export type Point = { x: number; y: number };
export type Rectangle = { x: number; y: number; width: number; height: number };
export type PenAnnotation = { id: string; type: "pen"; points: Point[] };
export type RectangleAnnotation = { id: string; type: "rectangle"; rectangle: Rectangle };
export type Annotation = PenAnnotation | RectangleAnnotation;
export type ResizeHandle = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
export type CanvasViewport = Rectangle;
export type PointerTarget = HTMLElement | SVGElement;
export type ActiveInteraction =
  | { kind: "draw-pen"; pointerId: number; annotation: PenAnnotation }
  | { kind: "draw-rectangle"; pointerId: number; annotation: RectangleAnnotation; origin: Point }
  | { kind: "move"; pointerId: number; annotationId: string; origin: Point; original: Rectangle; current: Rectangle }
  | { kind: "resize"; pointerId: number; annotationId: string; origin: Point; original: Rectangle; current: Rectangle; handle: ResizeHandle };
