export type HanliAcceptanceOperationValue =
  | { type: "click"; x: number; y: number; reason: string }
  | { type: "drag"; x: number; y: number; endX: number; endY: number; reason: string }
  | { type: "scroll"; x: number; y: number; deltaY: number; reason: string }
  | { type: "key"; key: string; reason: string }
  | { type: "hover"; x: number; y: number; reason: string }
  | { type: "send"; target: "persona-composer"; reason: string }
  | { type: "judgement"; criterionId: string };
