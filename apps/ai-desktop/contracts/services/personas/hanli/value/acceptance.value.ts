export type HanliAcceptanceOperationValue =
  | { type: "click"; x: number; y: number; reason: string }
  | { type: "drag"; x: number; y: number; endX: number; endY: number; reason: string }
  | { type: "scroll"; x: number; y: number; deltaY: number; reason: string }
  | { type: "scroll-task-collaboration"; deltaY: number; reason: string }
  | { type: "scroll-settings-panel"; deltaY: number; reason: string }
  | { type: "resize-formal-window"; preset: "narrow" | "restore"; reason: string }
  | { type: "reload-formal-page"; reason: string }
  | { type: "key"; key: string; reason: string }
  | { type: "hover"; x: number; y: number; reason: string }
  | { type: "judgement"; criterionId: string };

/** 每条条件的证据来源；页面证据与只读代码证据不能相互替代。 */
export type HanliAcceptanceEvidenceModeValue = "page-experience" | "code-conformance";

/** 页面条件受阻时的可审计原因；产品实际不符合必须使用 failed，不能伪装成受阻。 */
export type HanliAcceptanceBlockerKindValue = "acceptance-capability" | "runtime-environment";

/** 验收运行写入共同状态前的唯一业务分流结论。 */
export type HanliAcceptanceDispositionValue = "passed" | "product-or-safety-failure" | "acceptance-capability-or-runtime-blocked";

/**
 * 韩立结果验收的运行方式。mixed 只汇总逐条件的两类证据，任何方式都不创建隔离验收环境。
 */
export type HanliAcceptanceModeValue = HanliAcceptanceEvidenceModeValue | "mixed";

/**
 * 判定某条记录是否必须满足正式窗口截图与布局门禁。
 * 旧页面归档没有逐条来源字段，继续按页面运行方式读取；mixed 必须显式声明来源。
 */
export function requiresPageAcceptanceEvidence(
  mode: HanliAcceptanceModeValue,
  evidenceMode: HanliAcceptanceEvidenceModeValue | undefined,
): boolean {
  return evidenceMode === "page-experience"
    || (mode === "page-experience" && evidenceMode === undefined);
}
