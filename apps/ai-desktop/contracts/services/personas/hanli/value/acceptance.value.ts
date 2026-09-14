export type HanliAcceptanceOperationValue =
  | { type: "click"; x: number; y: number; reason: string }
  | { type: "drag"; x: number; y: number; endX: number; endY: number; reason: string }
  | { type: "scroll"; x: number; y: number; deltaY: number; reason: string }
  | { type: "scroll-task-collaboration"; deltaY: number; reason: string }
  | { type: "scroll-settings-panel"; deltaY: number; reason: string }
  | { type: "inspect-task-collaboration-state"; reason: string }
  | { type: "resize-acceptance-window"; preset: "narrow" | "restore"; reason: string }
  | { type: "key"; key: string; reason: string }
  | { type: "hover"; x: number; y: number; reason: string }
  | { type: "judgement"; criterionId: string };

/** 韩立结果验收的两种互斥方式；任何方式都不创建隔离验收环境。 */
export type HanliAcceptanceModeValue = "page-experience" | "code-conformance";
