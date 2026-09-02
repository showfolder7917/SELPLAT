export type HanliAcceptanceOperationValue =
  | { type: "focus-window" }
  | { type: "resize-window"; width: number; height: number }
  | { type: "click"; target: string }
  | { type: "scroll"; target: string; direction: "up" | "down"; amount: number }
  | { type: "press-key"; target?: string; key: "Tab" | "Enter" | "Escape" | "ArrowDown" | "ArrowUp" | "PageDown" | "PageUp" }
  | { type: "inspect-text"; text: string }
  | { type: "inspect-layout"; target: string }
  | { type: "capture"; label: string };
